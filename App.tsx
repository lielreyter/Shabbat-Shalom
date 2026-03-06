import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import {
  getUserProfile,
  completeCongregationOnboarding,
  recordBrokenShabbatWeek,
  recordKeptShabbatWeek,
  setUserCongregation,
  updateUserProfile,
} from "./src/firebase/firestore";
import { useShabbatTimes } from "./src/hooks/useShabbatTimes";
import { useShabbatMode } from "./src/hooks/useShabbatMode";
import { getCurrentLocation } from "./src/location/locationService";
import { LocationResult } from "./src/location/locationTypes";
import {
  cancelReminder,
  scheduleNextReminder,
} from "./src/reminders/reminderScheduler";
import { ReminderType } from "./src/reminders/reminderTypes";
import {
  clearIntentFlowHandler,
  IntentFlowResult,
  setIntentFlowHandler,
} from "./src/shabbatMode/shabbatIntentFlow";
import { scheduleShabbatMode } from "./src/shabbatMode/shabbatModeScheduler";
import { getCurrentWeekId } from "./src/shabbatMode/shabbatModeState";
import { signInWithApple, signOut, subscribeToAuthState } from "./src/auth/authService";
import { UserProfile } from "./src/types/UserProfile";
import {
  approveJoinRequest,
  createCongregation,
  getCongregationById,
  joinCongregationAsUser,
  kickMember,
  leaveCongregationAsUser,
  listNearbyCongregations,
  rejectJoinRequest,
  setCongregationJoinPolicy,
} from "./src/congregation/congregationService";
import { Congregation, NearbyCongregation } from "./src/congregation/congregationTypes";

const COLORS = {
  background: "#F9EFD5",
  accent: "#1F2C5D",
  text: "#000000",
  card: "#FFFFFF",
  border: "#D7CBA8",
  danger: "#B3261E",
};

const RESTRICTIONS_KEY = "restrictions:v1";
const SHABBAT_UI_STATE_KEY = "shabbatUiState:v1";
const GENDER_OPTIONS = ["Male", "Female"] as const;
type GenderOption = (typeof GENDER_OPTIONS)[number];

type TabKey = "account" | "restrictions" | "home" | "congregations" | "notifications";

type RestrictionSetting = {
  id: string;
  label: string;
  enabled: boolean;
  currentStreak: number;
  longestStreak: number;
  lastWeekId: string | null;
};

type ShabbatUiState = {
  lastIntentPromptWeekId: string | null;
  optedOutWeekId: string | null;
  firstRestrictionPromptWeekId: string | null;
};

const defaultRestrictions: RestrictionSetting[] = [
  {
    id: "social",
    label: "Social apps",
    enabled: true,
    currentStreak: 0,
    longestStreak: 0,
    lastWeekId: null,
  },
  {
    id: "video",
    label: "Streaming apps",
    enabled: true,
    currentStreak: 0,
    longestStreak: 0,
    lastWeekId: null,
  },
  {
    id: "games",
    label: "Games",
    enabled: true,
    currentStreak: 0,
    longestStreak: 0,
    lastWeekId: null,
  },
];

const defaultShabbatUiState: ShabbatUiState = {
  lastIntentPromptWeekId: null,
  optedOutWeekId: null,
  firstRestrictionPromptWeekId: null,
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatTime24 = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

const formatDay = (date: Date): string => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()] ?? "";
};

const cleanCity = (raw: string | null | undefined): string => {
  if (!raw) {
    return "Unknown city";
  }
  const first = raw.split(",")[0]?.trim();
  return first || raw.trim();
};

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  const timeoutPromise = new Promise<T>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [city, setCity] = useState("Unknown city");

  const [restrictions, setRestrictions] =
    useState<RestrictionSetting[]>(defaultRestrictions);
  const [shabbatUiState, setShabbatUiState] =
    useState<ShabbatUiState>(defaultShabbatUiState);

  const [intentDraft, setIntentDraft] = useState("");
  const [intentModalVisible, setIntentModalVisible] = useState(false);

  const [nearbyCongregations, setNearbyCongregations] = useState<NearbyCongregation[]>(
    []
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [newCongregationName, setNewCongregationName] = useState("");
  const [newCongregationCity, setNewCongregationCity] = useState("");
  const [currentLocation, setCurrentLocation] = useState<LocationResult | null>(null);
  const [currentCongregationName, setCurrentCongregationName] = useState<string | null>(
    null
  );
  const [currentCongregation, setCurrentCongregation] =
    useState<Congregation | null>(null);
  const [congregationMembers, setCongregationMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  const [lastJoinRequestStatus, setLastJoinRequestStatus] = useState<
    "JOINED" | "REQUESTED" | null
  >(null);

  const [profileName, setProfileName] = useState("");
  const [profileGender, setProfileGender] = useState<GenderOption | "">("");
  const tabContentAnim = useRef(new Animated.Value(1)).current;

  const {
    shabbatTimes,
    loading: timesLoading,
    error: timesError,
    refresh: refreshTimes,
  } = useShabbatTimes();
  const {
    status: modeStatus,
    isActive: isModeActive,
    start: startMode,
    end: endMode,
    breakShabbat,
  } = useShabbatMode();

  const weekId = useMemo(() => {
    const existing = getCurrentWeekId();
    if (existing) {
      return existing;
    }
    if (shabbatTimes) {
      return `week-${shabbatTimes.shabbatStart.toISOString().slice(0, 10)}`;
    }
    return `week-${new Date().toISOString().slice(0, 10)}`;
  }, [shabbatTimes]);

  const isShabbatNow = useMemo(() => {
    if (!shabbatTimes) {
      return false;
    }
    const now = Date.now();
    return (
      now >= shabbatTimes.shabbatStart.getTime() &&
      now < shabbatTimes.shabbatEnd.getTime()
    );
  }, [shabbatTimes]);

  const homeCity = useMemo(() => {
    if (city !== "Unknown city") {
      return cleanCity(city);
    }
    return cleanCity(shabbatTimes?.cityName);
  }, [city, shabbatTimes?.cityName]);

  const saveShabbatUiState = useCallback(async (next: ShabbatUiState) => {
    setShabbatUiState(next);
    await AsyncStorage.setItem(SHABBAT_UI_STATE_KEY, JSON.stringify(next));
  }, []);

  const saveRestrictions = useCallback(async (next: RestrictionSetting[]) => {
    setRestrictions(next);
    await AsyncStorage.setItem(RESTRICTIONS_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    const loadLocal = async () => {
      const [rawRestrictions, rawUiState] = await Promise.all([
        AsyncStorage.getItem(RESTRICTIONS_KEY),
        AsyncStorage.getItem(SHABBAT_UI_STATE_KEY),
      ]);
      if (rawRestrictions) {
        try {
          setRestrictions(JSON.parse(rawRestrictions) as RestrictionSetting[]);
        } catch {
          setRestrictions(defaultRestrictions);
        }
      }
      if (rawUiState) {
        try {
          setShabbatUiState(JSON.parse(rawUiState) as ShabbatUiState);
        } catch {
          setShabbatUiState(defaultShabbatUiState);
        }
      }
    };
    loadLocal().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setAuthLoading(false);
      if (profile) {
        setProfileName(profile.displayName ?? "");
        if (profile.gender === "Male" || profile.gender === "Female") {
          setProfileGender(profile.gender);
        } else {
          setProfileGender("");
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    tabContentAnim.setValue(0);
    Animated.timing(tabContentAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabContentAnim]);

  useEffect(() => {
    setIntentFlowHandler((): Promise<IntentFlowResult> => {
      return new Promise((resolve) => {
        Alert.alert(
          "Pause and reflect",
          user?.shabbatIntentText
            ? `Your intention:\n\n${user.shabbatIntentText}\n\nDo you still want to break Shabbat?`
            : "Do you still want to break Shabbat?",
          [
            { text: "Go back", style: "cancel", onPress: () => resolve("ABORT") },
            { text: "Break Shabbat", style: "destructive", onPress: () => resolve("PROCEED") },
          ],
          { cancelable: false }
        );
      });
    });
    return () => clearIntentFlowHandler();
  }, [user?.shabbatIntentText]);

  const loadLocationAndCongregations = useCallback(async () => {
    if (!user) {
      return;
    }
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      if (location.city) {
        setCity(location.city);
      }
      if (!newCongregationCity && location.city) {
        setNewCongregationCity(location.city);
      }
      const nearby = await listNearbyCongregations(location, 8, 75);
      setNearbyCongregations(nearby);
    } catch (error) {
      setNearbyError(errorMessage(error, "Could not load nearby congregations."));
      setNearbyCongregations([]);
    } finally {
      setNearbyLoading(false);
    }
  }, [newCongregationCity, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    loadLocationAndCongregations().catch(() => {});
  }, [loadLocationAndCongregations, user]);

  useEffect(() => {
    if (!user?.congregationId) {
      setCurrentCongregationName(null);
      setCurrentCongregation(null);
      setCongregationMembers([]);
      setPendingMembers([]);
      return;
    }
    getCongregationById(user.congregationId)
      .then(async (found) => {
        setCurrentCongregation(found);
        setCurrentCongregationName(found?.name ?? "Unknown");
        if (!found) {
          return;
        }
        const members = await Promise.all(found.memberUids.map((uid) => getUserProfile(uid)));
        setCongregationMembers(
          members.filter((profile): profile is UserProfile => Boolean(profile))
        );
        const pending = await Promise.all(found.pendingUids.map((uid) => getUserProfile(uid)));
        setPendingMembers(
          pending.filter((profile): profile is UserProfile => Boolean(profile))
        );
      })
      .catch(() => setCurrentCongregationName("Unknown"));
  }, [user?.congregationId]);

  useEffect(() => {
    if (!shabbatTimes || !user) {
      return;
    }
    scheduleShabbatMode(shabbatTimes).catch(() => {});
  }, [shabbatTimes, user]);

  useEffect(() => {
    if (!isShabbatNow || !user) {
      return;
    }
    const hasPrompted = shabbatUiState.lastIntentPromptWeekId === weekId;
    const optedOut = shabbatUiState.optedOutWeekId === weekId;
    if (!hasPrompted && !optedOut) {
      setIntentDraft(user.shabbatIntentText ?? "");
      setIntentModalVisible(true);
    }
  }, [isShabbatNow, shabbatUiState.lastIntentPromptWeekId, shabbatUiState.optedOutWeekId, user, weekId]);

  const applyRestrictionWeekOutcome = useCallback(
    async (kept: boolean) => {
      const next = restrictions.map((restriction) => {
        if (!restriction.enabled) {
          return restriction;
        }
        if (restriction.lastWeekId === weekId) {
          return restriction;
        }
        if (!kept) {
          return { ...restriction, currentStreak: 0, lastWeekId: weekId };
        }
        const nextCurrent = restriction.currentStreak + 1;
        return {
          ...restriction,
          currentStreak: nextCurrent,
          longestStreak: Math.max(restriction.longestStreak, nextCurrent),
          lastWeekId: weekId,
        };
      });
      await saveRestrictions(next);
    },
    [restrictions, saveRestrictions, weekId]
  );

  const onPressContinue = useCallback(async () => {
    setAuthError(null);
    setActionLoading(true);
    try {
      const profile = await signInWithApple();
      setUser(profile);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to sign in."));
    } finally {
      setActionLoading(false);
    }
  }, []);

  const onPressSignOut = useCallback(async () => {
    setActionLoading(true);
    try {
      await signOut();
      setUser(null);
    } finally {
      setActionLoading(false);
    }
  }, []);

  const onToggleMode = useCallback(async () => {
    if (!user) {
      return;
    }
    if (!isModeActive && !isShabbatNow) {
      Alert.alert(
        "Shabbat mode",
        "Shabbat mode can only be activated during Shabbat."
      );
      return;
    }
    setActionLoading(true);
    try {
      if (isModeActive) {
        await endMode();
        const profile = await recordKeptShabbatWeek(user.uid, weekId);
        setUser(profile);
        await applyRestrictionWeekOutcome(true);
      } else {
        await startMode();
      }
    } catch (error) {
      Alert.alert("Shabbat mode", errorMessage(error, "Unknown error."));
    } finally {
      setActionLoading(false);
    }
  }, [
    applyRestrictionWeekOutcome,
    endMode,
    isModeActive,
    isShabbatNow,
    startMode,
    user,
    weekId,
  ]);

  const onBreakShabbatNow = useCallback(async () => {
    if (!user) {
      return;
    }
    setActionLoading(true);
    try {
      const result = await breakShabbat();
      if (result === "ALLOWED") {
        const profile = await recordBrokenShabbatWeek(user.uid, weekId);
        setUser(profile);
        await applyRestrictionWeekOutcome(false);
      }
    } catch (error) {
      Alert.alert("Break Shabbat", errorMessage(error, "Unknown error."));
    } finally {
      setActionLoading(false);
    }
  }, [applyRestrictionWeekOutcome, breakShabbat, user, weekId]);

  const onToggleRestriction = useCallback(
    async (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const next = restrictions.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      );
      await saveRestrictions(next);
    },
    [restrictions, saveRestrictions]
  );

  const onSimulateRestrictedOpen = useCallback(
    async (restriction: RestrictionSetting) => {
      if (!restriction.enabled) {
        Alert.alert("Allowed", `${restriction.label} is not restricted.`);
        return;
      }
      if (!isShabbatNow) {
        Alert.alert("Allowed", "It is not currently Shabbat.");
        return;
      }
      if (shabbatUiState.optedOutWeekId === weekId) {
        Alert.alert("Not keeping this week", "You opted out for this week.");
        return;
      }
      if (shabbatUiState.firstRestrictionPromptWeekId !== weekId) {
        const intent =
          user?.shabbatIntentText ??
          "You chose to keep Shabbat with intention this week.";
        Alert.alert(
          "Pause and remember",
          `Your intention:\n\n${intent}\n\nStay strong.`,
          [{ text: "Continue" }]
        );
        await saveShabbatUiState({
          ...shabbatUiState,
          firstRestrictionPromptWeekId: weekId,
        });
        return;
      }
      Alert.alert("Blocked", `${restriction.label} is blocked during Shabbat.`);
    },
    [isShabbatNow, saveShabbatUiState, shabbatUiState, user?.shabbatIntentText, weekId]
  );

  const refreshCongregationData = useCallback(async () => {
    if (!user?.congregationId) {
      setCurrentCongregation(null);
      setCongregationMembers([]);
      setPendingMembers([]);
      return;
    }
    const congregation = await getCongregationById(user.congregationId);
    if (!congregation) {
      setCurrentCongregation(null);
      setCongregationMembers([]);
      setPendingMembers([]);
      return;
    }
    setCurrentCongregation(congregation);
    setCurrentCongregationName(congregation.name);
    const members = await Promise.all(
      congregation.memberUids.map((uid) => getUserProfile(uid))
    );
    setCongregationMembers(
      members.filter((profile): profile is UserProfile => Boolean(profile))
    );
    const pending = await Promise.all(
      congregation.pendingUids.map((uid) => getUserProfile(uid))
    );
    setPendingMembers(
      pending.filter((profile): profile is UserProfile => Boolean(profile))
    );
  }, [user?.congregationId]);

  const onJoinCongregation = useCallback(
    async (congregationId: string) => {
      if (!user) {
        return;
      }
      setActionLoading(true);
      try {
        const result = await joinCongregationAsUser(congregationId, user.uid);
        setLastJoinRequestStatus(result);
        if (result === "JOINED") {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            setUser(profile);
          }
          await refreshCongregationData();
        } else {
          Alert.alert(
            "Request sent",
            "This congregation requires approval. The leader can approve your request."
          );
        }
        await completeCongregationOnboarding(user.uid);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshCongregationData, user]
  );

  const onLeaveCongregation = useCallback(async () => {
    if (!user || !user.congregationId) {
      return;
    }
    setActionLoading(true);
    try {
      await leaveCongregationAsUser(user.congregationId, user.uid);
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setUser(profile);
      }
      setCurrentCongregation(null);
      setCongregationMembers([]);
      setPendingMembers([]);
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const onCreateCongregation = useCallback(async () => {
    if (!user || !currentLocation) {
      Alert.alert("Location required", "Allow location to create a congregation.");
      return;
    }
    const name = newCongregationName.trim();
    const cityValue = (newCongregationCity || cleanCity(currentLocation.city)).trim();
    if (!name || !cityValue) {
      Alert.alert("Missing info", "Please enter congregation name and city.");
      return;
    }
    setActionLoading(true);
    try {
      const congregation = await createCongregation({
        name,
        city: cityValue,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timezone: currentLocation.timezone,
        creatorUid: user.uid,
      });
      const profile = await setUserCongregation(user.uid, congregation.id);
      setUser(profile);
      setNewCongregationName("");
      await loadLocationAndCongregations();
      await refreshCongregationData();
    } catch (error) {
      Alert.alert("Create congregation", errorMessage(error, "Failed to create."));
    } finally {
      setActionLoading(false);
    }
  }, [
    currentLocation,
    loadLocationAndCongregations,
    newCongregationCity,
    newCongregationName,
    refreshCongregationData,
    user,
  ]);

  const onChangeJoinPolicy = useCallback(
    async (policy: "OPEN" | "REQUEST" | "CLOSED") => {
      if (!user || !currentCongregation) {
        return;
      }
      setActionLoading(true);
      try {
        await setCongregationJoinPolicy({
          congregationId: currentCongregation.id,
          leaderUid: user.uid,
          policy,
        });
        await refreshCongregationData();
      } catch (error) {
        Alert.alert("Join policy", errorMessage(error, "Failed to update policy."));
      } finally {
        setActionLoading(false);
      }
    },
    [currentCongregation, refreshCongregationData, user]
  );

  const onApproveRequest = useCallback(
    async (targetUid: string) => {
      if (!user || !currentCongregation) {
        return;
      }
      setActionLoading(true);
      try {
        await approveJoinRequest({
          congregationId: currentCongregation.id,
          leaderUid: user.uid,
          targetUid,
        });
        await refreshCongregationData();
      } catch (error) {
        Alert.alert("Approve request", errorMessage(error, "Failed to approve."));
      } finally {
        setActionLoading(false);
      }
    },
    [currentCongregation, refreshCongregationData, user]
  );

  const onRejectRequest = useCallback(
    async (targetUid: string) => {
      if (!user || !currentCongregation) {
        return;
      }
      setActionLoading(true);
      try {
        await rejectJoinRequest({
          congregationId: currentCongregation.id,
          leaderUid: user.uid,
          targetUid,
        });
        await refreshCongregationData();
      } catch (error) {
        Alert.alert("Reject request", errorMessage(error, "Failed to reject."));
      } finally {
        setActionLoading(false);
      }
    },
    [currentCongregation, refreshCongregationData, user]
  );

  const onKickMember = useCallback(
    async (targetUid: string) => {
      if (!user || !currentCongregation) {
        return;
      }
      setActionLoading(true);
      try {
        await kickMember({
          congregationId: currentCongregation.id,
          leaderUid: user.uid,
          targetUid,
        });
        await refreshCongregationData();
      } catch (error) {
        Alert.alert("Kick member", errorMessage(error, "Failed to kick member."));
      } finally {
        setActionLoading(false);
      }
    },
    [currentCongregation, refreshCongregationData, user]
  );

  const onSaveProfile = useCallback(async () => {
    if (!user) {
      return;
    }
    const nextName = profileName.trim();
    const nextGender = profileGender;
    if (!nextName || !nextGender) {
      Alert.alert("Profile", "Name and gender are required.");
      return;
    }
    setActionLoading(true);
    try {
      // Local-only dev profile: do not wait on Firestore.
      if (user.uid.startsWith("dev-local-")) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                displayName: nextName,
                gender: nextGender,
              }
            : prev
        );
        return;
      }

      try {
        const updated = await withTimeout(
          updateUserProfile(user.uid, {
            displayName: nextName,
            gender: nextGender,
          }),
          6000,
          "Profile save timed out."
        );
        setUser(updated);
      } catch (error) {
        // DEV/local fallback: keep UX unblocked even when Firestore doc isn't present.
        setUser((prev) =>
          prev
            ? {
                ...prev,
                displayName: nextName,
                gender: nextGender,
              }
            : prev
        );
        console.warn("Profile save fell back to local state:", error);
      }
    } finally {
      setActionLoading(false);
    }
  }, [profileGender, profileName, user]);

  const onToggleMorningReminder = useCallback(async () => {
    if (!user || !shabbatTimes) {
      return;
    }
    const next = !user.wantsMorningReminders;
    setActionLoading(true);
    try {
      if (next) {
        await scheduleNextReminder(
          {
            type: ReminderType.TEFILLIN,
            enabled: true,
            time: "07:00",
            title: "Tefillin reminder",
            body: "Morning reminder (except Saturday mornings).",
          },
          shabbatTimes
        );
      } else {
        await cancelReminder(ReminderType.TEFILLIN);
      }
      const updated = await updateUserProfile(user.uid, {
        wantsMorningReminders: next,
      });
      setUser(updated);
    } catch (error) {
      Alert.alert("Notifications", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [shabbatTimes, user]);

  const onToggleShabbatReminder = useCallback(async () => {
    if (!user || !shabbatTimes) {
      return;
    }
    const next = !user.wantsShabbatReminders;
    setActionLoading(true);
    try {
      if (next) {
        const reminderDate = new Date(shabbatTimes.shabbatStart.getTime() - 15 * 60000);
        await scheduleNextReminder(
          {
            type: ReminderType.SHABBAT_PREP,
            enabled: true,
            time: formatTime24(reminderDate),
            title: "Shabbat starts soon",
            body: "Shabbat starts in about 15 minutes.",
          },
          shabbatTimes
        );
      } else {
        await cancelReminder(ReminderType.SHABBAT_PREP);
      }
      const updated = await updateUserProfile(user.uid, {
        wantsShabbatReminders: next,
      });
      setUser(updated);
    } catch (error) {
      Alert.alert("Notifications", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [shabbatTimes, user]);

  const onSubmitIntent = useCallback(async () => {
    if (!user) {
      return;
    }
    const text = intentDraft.trim();
    if (!text) {
      Alert.alert("Intent required", "Please write your intention for this week.");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await updateUserProfile(user.uid, { shabbatIntentText: text });
      setUser(updated);
      await saveShabbatUiState({
        ...shabbatUiState,
        lastIntentPromptWeekId: weekId,
      });
      setIntentModalVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [intentDraft, saveShabbatUiState, shabbatUiState, user, weekId]);

  const onOptOutThisWeek = useCallback(async () => {
    if (!user) {
      return;
    }
    setActionLoading(true);
    try {
      const updated = await recordBrokenShabbatWeek(user.uid, weekId);
      setUser(updated);
      await applyRestrictionWeekOutcome(false);
      await saveShabbatUiState({
        ...shabbatUiState,
        optedOutWeekId: weekId,
        lastIntentPromptWeekId: weekId,
      });
      setIntentModalVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [applyRestrictionWeekOutcome, saveShabbatUiState, shabbatUiState, user, weekId]);

  const timesDisplay = useMemo(() => {
    if (timesLoading) {
      return "Loading...";
    }
    if (timesError) {
      return timesError.message;
    }
    if (!shabbatTimes) {
      return "No times loaded";
    }
    return `${formatDay(shabbatTimes.shabbatStart)} ${formatTime(
      shabbatTimes.shabbatStart
    )} - ${formatDay(shabbatTimes.shabbatEnd)} ${formatTime(shabbatTimes.shabbatEnd)}`;
  }, [shabbatTimes, timesError, timesLoading]);

  const totalRestrictionStreak = useMemo(
    () =>
      restrictions.reduce((sum, item) => sum + item.currentStreak, 0),
    [restrictions]
  );

  const renderHomeTab = () => (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Home</Text>
        <Text style={s.rowText}>Streak: {user?.currentStreak ?? 0}</Text>
        <Text style={s.rowText}>Restriction streak total: {totalRestrictionStreak}</Text>
        <Text style={s.rowText}>Congregation: {currentCongregationName ?? "Not joined"}</Text>
        <Text style={s.rowText}>Location: {homeCity}</Text>
        <Text style={s.rowText}>Shabbat: {timesDisplay}</Text>
        {user?.shabbatIntentText ? (
          <Text style={s.metaText}>This week intention: "{user.shabbatIntentText}"</Text>
        ) : null}
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Shabbat mode</Text>
        <View style={s.rowBetween}>
          <Text style={s.rowText}>Status: {modeStatus}</Text>
          <Switch
            value={isModeActive}
            onValueChange={onToggleMode}
            disabled={!isShabbatNow && !isModeActive}
          />
        </View>
        {!isShabbatNow ? (
          <Text style={s.metaText}>
            Shabbat mode activates only during Shabbat.
          </Text>
        ) : null}
        <Pressable
          style={[s.dangerButton, !isModeActive && s.disabled]}
          onPress={onBreakShabbatNow}
          disabled={!isModeActive || actionLoading}
        >
          <Text style={s.dangerButtonText}>Break Shabbat now</Text>
        </Pressable>
        <Pressable style={s.secondaryButton} onPress={refreshTimes}>
          <Text style={s.secondaryButtonText}>Refresh times</Text>
        </Pressable>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Quick highlights</Text>
        <Text style={s.rowText}>
          Enabled restrictions: {restrictions.filter((r) => r.enabled).length}
        </Text>
        <Text style={s.rowText}>
          Notifications: {user?.wantsShabbatReminders ? "Shabbat ON" : "Shabbat OFF"} /{" "}
          {user?.wantsMorningReminders ? "Tefillin ON" : "Tefillin OFF"}
        </Text>
        <Text style={s.rowText}>
          Congregation policy: {currentCongregation?.joinPolicy ?? "N/A"}
        </Text>
      </View>
    </ScrollView>
  );

  const renderRestrictionsTab = () => (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Restriction settings</Text>
        <Text style={s.subText}>Each restriction has its own streak.</Text>
        {restrictions.map((restriction) => (
          <View key={restriction.id} style={s.listItem}>
            <View style={s.rowBetween}>
              <Text style={s.rowText}>{restriction.label}</Text>
              <Switch
                value={restriction.enabled}
                onValueChange={() => onToggleRestriction(restriction.id)}
              />
            </View>
            <Text style={s.metaText}>
              Streak: {restriction.currentStreak} (best {restriction.longestStreak})
            </Text>
            <Pressable
              style={s.secondaryButton}
              onPress={() => onSimulateRestrictedOpen(restriction)}
            >
              <Text style={s.secondaryButtonText}>Simulate opening restricted app</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderAccountTab = () => (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Account and stats</Text>
        <Text style={s.rowText}>Global streak: {user?.currentStreak ?? 0}</Text>
        <Text style={s.rowText}>Longest streak: {user?.longestStreak ?? 0}</Text>
        <Text style={s.rowText}>Restriction streak total: {totalRestrictionStreak}</Text>
        <Text style={s.rowText}>Congregation: {currentCongregationName ?? "None"}</Text>
        <Text style={s.rowText}>Gender: {user?.gender ?? "Not set"}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Profile details</Text>
        <TextInput
          placeholder="Name"
          value={profileName}
          onChangeText={setProfileName}
          style={s.input}
          placeholderTextColor="#777"
        />
        <GenderPicker value={profileGender} onChange={setProfileGender} />
        <Pressable style={s.secondaryButton} onPress={onSaveProfile}>
          <Text style={s.secondaryButtonText}>Save profile</Text>
        </Pressable>
        <Pressable style={s.ghostButton} onPress={onPressSignOut}>
          <Text style={s.ghostButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderCongregationsTab = () => (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Join or create congregation</Text>
        <Text style={s.rowText}>Current: {currentCongregationName ?? "Not joined"}</Text>
        {lastJoinRequestStatus === "REQUESTED" ? (
          <Text style={s.metaText}>Your latest join action is pending approval.</Text>
        ) : null}
        {nearbyLoading ? <ActivityIndicator color={COLORS.accent} /> : null}
        {nearbyError ? <Text style={s.errorText}>{nearbyError}</Text> : null}
        {nearbyCongregations.length === 0 && !nearbyLoading ? (
          <Text style={s.subText}>
            There are no congregations near you yet. Would you like to start one?
          </Text>
        ) : null}
        {nearbyCongregations.map((congregation) => (
          <Pressable
            key={congregation.id}
            style={s.listItem}
            onPress={() => onJoinCongregation(congregation.id)}
          >
            <Text style={s.rowText}>{congregation.name}</Text>
            <Text style={s.metaText}>
              {congregation.city} ({congregation.distanceKm.toFixed(1)} km away)
            </Text>
          </Pressable>
        ))}
        {user?.congregationId ? (
          <Pressable style={s.dangerButton} onPress={onLeaveCongregation}>
            <Text style={s.dangerButtonText}>Leave congregation</Text>
          </Pressable>
        ) : null}
        {currentCongregation?.leaderUid === user?.uid ? (
          <View style={s.policyWrap}>
            <Text style={s.rowText}>Leader controls</Text>
            <Text style={s.metaText}>
              Join policy: {currentCongregation?.joinPolicy ?? "OPEN"}
            </Text>
            <View style={s.policyButtons}>
              <Pressable
                style={s.smallPill}
                onPress={() => onChangeJoinPolicy("OPEN")}
              >
                <Text style={s.smallPillText}>Open</Text>
              </Pressable>
              <Pressable
                style={s.smallPill}
                onPress={() => onChangeJoinPolicy("REQUEST")}
              >
                <Text style={s.smallPillText}>Request</Text>
              </Pressable>
              <Pressable
                style={s.smallPill}
                onPress={() => onChangeJoinPolicy("CLOSED")}
              >
                <Text style={s.smallPillText}>Closed</Text>
              </Pressable>
            </View>
            {pendingMembers.length > 0 ? (
              <View style={s.listSubsection}>
                <Text style={s.rowText}>Pending requests</Text>
                {pendingMembers.map((member) => (
                  <View key={member.uid} style={s.memberRow}>
                    <Text style={s.metaText}>
                      {(member.displayName ?? "Unnamed") +
                        " • " +
                        (member.gender ?? "Unspecified")}
                    </Text>
                    <View style={s.memberActions}>
                      <Pressable
                        style={s.smallPill}
                        onPress={() => onApproveRequest(member.uid)}
                      >
                        <Text style={s.smallPillText}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={s.smallDangerPill}
                        onPress={() => onRejectRequest(member.uid)}
                      >
                        <Text style={s.smallDangerPillText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {currentCongregation && congregationMembers.length > 0 ? (
          <View style={s.listSubsection}>
            <Text style={s.rowText}>Members</Text>
            {congregationMembers.map((member) => (
              <View key={member.uid} style={s.memberRow}>
                <Text style={s.metaText}>
                  {(member.displayName ?? "Unnamed") +
                    " • " +
                    (member.gender ?? "Unspecified")}
                </Text>
                {currentCongregation.leaderUid === user?.uid &&
                member.uid !== user.uid ? (
                  <Pressable
                    style={s.smallDangerPill}
                    onPress={() => onKickMember(member.uid)}
                  >
                    <Text style={s.smallDangerPillText}>Kick</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <TextInput
          placeholder="New congregation name"
          value={newCongregationName}
          onChangeText={setNewCongregationName}
          style={s.input}
          placeholderTextColor="#777"
        />
        <TextInput
          placeholder="City"
          value={newCongregationCity}
          onChangeText={setNewCongregationCity}
          style={s.input}
          placeholderTextColor="#777"
        />
        <Pressable style={s.secondaryButton} onPress={onCreateCongregation}>
          <Text style={s.secondaryButtonText}>Create and join</Text>
        </Pressable>
        {!user?.congregationOnboardingCompleted ? (
          <Pressable
            style={s.ghostButton}
            onPress={async () => {
              if (!user) {
                return;
              }
              const updated = await completeCongregationOnboarding(user.uid);
              setUser(updated);
            }}
          >
            <Text style={s.ghostButtonText}>Skip for now</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );

  const renderNotificationsTab = () => (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Notifications</Text>
        <View style={s.rowBetween}>
          <Text style={s.rowText}>Shabbat reminder (15 min before start)</Text>
          <Switch
            value={Boolean(user?.wantsShabbatReminders)}
            onValueChange={onToggleShabbatReminder}
          />
        </View>
        <View style={s.rowBetween}>
          <Text style={s.rowText}>
            Tefillin reminder (morning, except Saturday)
          </Text>
          <Switch
            value={Boolean(user?.wantsMorningReminders)}
            onValueChange={onToggleMorningReminder}
          />
        </View>
      </View>
    </ScrollView>
  );

  if (authLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <ActivityIndicator color={COLORS.accent} />
          <Text style={s.subText}>Loading account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <Text style={s.title}>Shabbat Shalom</Text>
          <Text style={s.subText}>Continue to enter the app.</Text>
          <Pressable
            style={[s.primaryButton, actionLoading && s.disabled]}
            onPress={onPressContinue}
            disabled={actionLoading}
          >
            <Text style={s.primaryButtonText}>Continue</Text>
          </Pressable>
          {authError ? <Text style={s.errorText}>{authError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  const needsProfileSetup =
    !user.displayName?.trim() || !user.gender?.trim();
  if (needsProfileSetup) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <Text style={s.title}>Welcome</Text>
          <Text style={s.subText}>
            Please enter your name and gender to continue. These are shown to your
            congregation and can be edited later in Stats.
          </Text>
          <TextInput
            placeholder="Name"
            value={profileName}
            onChangeText={setProfileName}
            style={s.input}
            placeholderTextColor="#777"
          />
          <GenderPicker value={profileGender} onChange={setProfileGender} />
          <Pressable
            style={[s.primaryButton, actionLoading && s.disabled]}
            onPress={onSaveProfile}
            disabled={actionLoading}
          >
            <Text style={s.primaryButtonText}>Save and continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>
          {activeTab === "home"
            ? "Home"
            : activeTab === "account"
              ? "Account"
              : activeTab === "restrictions"
                ? "Restrictions"
                : activeTab === "congregations"
                  ? "Congregations"
                  : "Notifications"}
        </Text>
        <Text style={s.headerSub}>
          {user.displayName ?? "User"} | {homeCity}
        </Text>
      </View>

      <Animated.View
        style={[
          s.body,
          {
            opacity: tabContentAnim,
            transform: [
              {
                translateY: tabContentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, 0],
                }),
              },
            ],
          },
        ]}
      >
        {activeTab === "home" ? renderHomeTab() : null}
        {activeTab === "restrictions" ? renderRestrictionsTab() : null}
        {activeTab === "account" ? renderAccountTab() : null}
        {activeTab === "congregations" ? renderCongregationsTab() : null}
        {activeTab === "notifications" ? renderNotificationsTab() : null}
      </Animated.View>

      <View style={s.tabBar}>
        <TabItem label="Stats" active={activeTab === "account"} onPress={() => setActiveTab("account")} />
        <TabItem
          label="Restrict"
          active={activeTab === "restrictions"}
          onPress={() => setActiveTab("restrictions")}
        />
        <TabItem label="Home" active={activeTab === "home"} onPress={() => setActiveTab("home")} />
        <TabItem
          label="Congregate"
          active={activeTab === "congregations"}
          onPress={() => setActiveTab("congregations")}
        />
        <TabItem
          label="Notify"
          active={activeTab === "notifications"}
          onPress={() => setActiveTab("notifications")}
        />
      </View>

      <Modal visible={intentModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.cardTitle}>Shabbat is starting</Text>
            <Text style={s.subText}>
              Write your intention for keeping Shabbat this week.
            </Text>
            <TextInput
              multiline
              value={intentDraft}
              onChangeText={setIntentDraft}
              style={[s.input, s.intentInput]}
              placeholder="I am keeping Shabbat because..."
              placeholderTextColor="#777"
            />
            <Pressable style={s.primaryButton} onPress={onSubmitIntent}>
              <Text style={s.primaryButtonText}>Save intention</Text>
            </Pressable>
            <Pressable style={s.dangerButton} onPress={onOptOutThisWeek}>
              <Text style={s.dangerButtonText}>No, I am not keeping Shabbat this week</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TabItem({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.tabItem, active && s.tabItemActive]} onPress={onPress}>
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function GenderPicker({
  value,
  onChange,
}: {
  value: GenderOption | "";
  onChange: (next: GenderOption) => void;
}) {
  return (
    <View style={s.genderWrap}>
      <Text style={s.metaText}>Gender</Text>
      <View style={s.genderRow}>
        {GENDER_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              style={[s.genderChip, active && s.genderChipActive]}
              onPress={() => onChange(option)}
            >
              <Text style={[s.genderChipText, active && s.genderChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
  },
  headerSub: {
    marginTop: 4,
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  card: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  rowText: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 15,
  },
  subText: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 13,
  },
  metaText: {
    marginTop: 4,
    color: COLORS.accent,
    fontSize: 12,
  },
  rowBetween: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: "#EBEEF8",
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  ghostButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  ghostButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  dangerButton: {
    marginTop: 10,
    backgroundColor: "#FDECEB",
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  dangerButtonText: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  input: {
    marginTop: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  intentInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  listItem: {
    marginTop: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FFFDF8",
  },
  policyWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  policyButtons: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  smallPill: {
    borderRadius: 999,
    backgroundColor: "#EBEEF8",
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallPillText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  smallDangerPill: {
    borderRadius: 999,
    backgroundColor: "#FDECEB",
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallDangerPillText: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 12,
  },
  listSubsection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  memberRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  genderWrap: {
    marginTop: 10,
  },
  genderRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  genderChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  genderChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "#EBEEF8",
  },
  genderChipText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 13,
  },
  genderChipTextActive: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: COLORS.accent,
  },
  tabLabel: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 8,
    color: COLORS.danger,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 16,
  },
});
