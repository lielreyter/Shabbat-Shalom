import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
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
import {
  geocodeCity,
  geocodeCitySuggestions,
  GeocodingResult,
} from "./src/location/geocodingService";
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
import {
  checkEmailVerified,
  confirmPhoneSignIn,
  confirmPhoneSignUp,
  createProfileAfterVerification,
  deleteCurrentUser,
  isCurrentUserEmailVerified,
  isEmailProvider,
  registerWithEmailPassword,
  resetPassword,
  sendVerification,
  signInWithApple,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
  startPhoneSignIn,
  subscribeToAuthState,
  type PhoneAuthConfirmation,
} from "./src/auth/authService";
import { UserProfile } from "./src/types/UserProfile";
import {
  approveJoinRequest,
  createCongregation,
  getCongregationById,
  joinCongregationAsUser,
  kickMember,
  leaveCongregationAsUser,
  listCongregationMembers,
  listNearbyCongregations,
  rejectJoinRequest,
  setCongregationJoinPolicy,
} from "./src/congregation/congregationService";
import {
  Congregation,
  NearbyCongregation,
} from "./src/congregation/congregationTypes";
import {
  searchUsersByName,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendProfiles,
} from "./src/friends/friendsService";
import { getParashaInfo, getChabadParashaUrl } from "./src/parasha/parashaData";
import {
  sendCongregationMessage,
  subscribeToCongregationMessages,
  type CongregationMessage,
} from "./src/congregation/congregationMessages";

/* ─── theme ──────────────────────────────────────────────────── */

const C = {
  bg: "#FFFFFF",
  primary: "#2563EB",
  primaryLight: "#DBEAFE",
  primaryDark: "#1E40AF",
  text: "#1E293B",
  textSecondary: "#64748B",
  textLight: "#94A3B8",
  border: "#E2E8F0",
  surface: "#F1F5F9",
  card: "#FFFFFF",
  danger: "#EF4444",
  dangerLight: "#FEE2E2",
  success: "#10B981",
  successLight: "#D1FAE5",
  streak: "#F59E0B",
  streakBg: "#FEF3C7",
};

/* ─── types ──────────────────────────────────────────────────── */

type TabKey = "home" | "social" | "parasha";
type SocialSubTab = "friends" | "chat" | "buddies";
type BlockLevel = "full" | "medium" | "custom" | "none";
type GenderOption = "Male" | "Female";

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

/* ─── constants ──────────────────────────────────────────────── */

const RESTRICTIONS_KEY = "restrictions:v1";
const SHABBAT_UI_STATE_KEY = "shabbatUiState:v1";
const BLOCK_LEVEL_KEY = "blockLevel:v1";
const CUSTOM_BLOCKS_KEY = "customBlocks:v1";
const GENDER_OPTIONS: GenderOption[] = ["Male", "Female"];

const WAKE_TIMES = [
  "5:00 AM", "5:30 AM", "6:00 AM", "6:30 AM", "7:00 AM",
  "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM",
];

const BED_TIMES = [
  "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM",
  "10:30 PM", "11:00 PM", "11:30 PM", "12:00 AM",
];

const defaultRestrictions: RestrictionSetting[] = [
  { id: "social", label: "Social apps", enabled: true, currentStreak: 0, longestStreak: 0, lastWeekId: null },
  { id: "video", label: "Streaming apps", enabled: true, currentStreak: 0, longestStreak: 0, lastWeekId: null },
  { id: "games", label: "Games", enabled: true, currentStreak: 0, longestStreak: 0, lastWeekId: null },
];

const defaultShabbatUiState: ShabbatUiState = {
  lastIntentPromptWeekId: null,
  optedOutWeekId: null,
  firstRestrictionPromptWeekId: null,
};

const defaultCustomBlocks = { social: true, games: true, streaming: false };

/* ─── helpers ────────────────────────────────────────────────── */

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
  if (!raw) return "Unknown city";
  const first = raw.split(",")[0]?.trim();
  return first || raw.trim();
};

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  )
    return (error as { message: string }).message;
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

const BLOCK_INFO: Record<BlockLevel, { title: string; desc: string; emoji: string }> = {
  full: { title: "Full Block", desc: "Block all apps during Shabbat and grow your streak!", emoji: "🛡️" },
  medium: { title: "Medium", desc: "Block social media & games. Start reclaiming your Shabbat.", emoji: "⚡" },
  custom: { title: "Custom", desc: "Choose which apps to block during Shabbat.", emoji: "🎯" },
  none: { title: "No Block", desc: "No apps blocked. Keep Shabbat in your own way.", emoji: "🕊️" },
};

/* ─── app ─────────────────────────────────────────────────────── */

export default function App() {
  /* ── auth state ── */
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<"choose" | "login" | "signup">("choose");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPhoneCode, setAuthPhoneCode] = useState("");
  const [phoneConfirmation, setPhoneConfirmation] = useState<PhoneAuthConfirmation | null>(null);
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [signupName, setSignupName] = useState("");
  const [signupGender, setSignupGender] = useState<GenderOption | "">("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPhoneCode, setSignupPhoneCode] = useState("");
  const [signupPhoneConfirmation, setSignupPhoneConfirmation] = useState<PhoneAuthConfirmation | null>(null);
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false);
  const [pendingSignupData, setPendingSignupData] = useState<{ name: string; gender: string } | null>(null);
  const [verificationChecking, setVerificationChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [resetEmailValue, setResetEmailValue] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [city, setCity] = useState("Unknown city");

  /* ── tab state ── */
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [socialSubTab, setSocialSubTab] = useState<SocialSubTab>("friends");

  /* ── profile / settings ── */
  const [profileName, setProfileName] = useState("");
  const [profileGender, setProfileGender] = useState<GenderOption | "">("");
  const [settingsVisible, setSettingsVisible] = useState(false);

  /* ── shabbat / restrictions ── */
  const [restrictions, setRestrictions] = useState<RestrictionSetting[]>(defaultRestrictions);
  const [shabbatUiState, setShabbatUiState] = useState<ShabbatUiState>(defaultShabbatUiState);
  const [blockLevel, setBlockLevel] = useState<BlockLevel>("none");
  const [customBlocks, setCustomBlocks] = useState(defaultCustomBlocks);
  const [intentDraft, setIntentDraft] = useState("");
  const [intentModalVisible, setIntentModalVisible] = useState(false);

  /* ── congregation ── */
  const [nearbyCongregations, setNearbyCongregations] = useState<NearbyCongregation[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [newCongregationName, setNewCongregationName] = useState("");
  const [currentLocation, setCurrentLocation] = useState<LocationResult | null>(null);
  const [currentCongregationName, setCurrentCongregationName] = useState<string | null>(null);
  const [currentCongregation, setCurrentCongregation] = useState<Congregation | null>(null);
  const [congregationMembers, setCongregationMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  const [joinCongregationVisible, setJoinCongregationVisible] = useState(false);
  const [congregationCitySearch, setCongregationCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<GeocodingResult[]>([]);
  const citySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── friends ── */
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<UserProfile[]>([]);
  const [addFriendVisible, setAddFriendVisible] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<UserProfile[]>([]);
  const [friendSearching, setFriendSearching] = useState(false);
  const friendSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── chat ── */
  const [chatMessages, setChatMessages] = useState<CongregationMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  /* ── animation ── */
  const tabContentAnim = useRef(new Animated.Value(1)).current;

  /* ── hooks ── */
  const { shabbatTimes, loading: timesLoading, error: timesError, refresh: refreshTimes } = useShabbatTimes();
  const { status: modeStatus, isActive: isModeActive, start: startMode, end: endMode, breakShabbat } = useShabbatMode();

  const weekId = useMemo(() => {
    const existing = getCurrentWeekId();
    if (existing) return existing;
    if (shabbatTimes) return `week-${shabbatTimes.shabbatStart.toISOString().slice(0, 10)}`;
    return `week-${new Date().toISOString().slice(0, 10)}`;
  }, [shabbatTimes]);

  const isShabbatNow = useMemo(() => {
    if (!shabbatTimes) return false;
    const now = Date.now();
    return now >= shabbatTimes.shabbatStart.getTime() && now < shabbatTimes.shabbatEnd.getTime();
  }, [shabbatTimes]);

  const homeCity = useMemo(() => {
    if (city !== "Unknown city") return cleanCity(city);
    return cleanCity(shabbatTimes?.cityName);
  }, [city, shabbatTimes?.cityName]);

  const parashaInfo = useMemo(() => {
    if (!shabbatTimes?.parsha) return null;
    return getParashaInfo(shabbatTimes.parsha);
  }, [shabbatTimes?.parsha]);

  /* ── persistence helpers ── */
  const saveShabbatUiState = useCallback(async (next: ShabbatUiState) => {
    setShabbatUiState(next);
    await AsyncStorage.setItem(SHABBAT_UI_STATE_KEY, JSON.stringify(next));
  }, []);

  const saveRestrictions = useCallback(async (next: RestrictionSetting[]) => {
    setRestrictions(next);
    await AsyncStorage.setItem(RESTRICTIONS_KEY, JSON.stringify(next));
  }, []);

  const saveBlockLevel = useCallback(async (level: BlockLevel) => {
    setBlockLevel(level);
    await AsyncStorage.setItem(BLOCK_LEVEL_KEY, level);
  }, []);

  const saveCustomBlocks = useCallback(async (next: typeof defaultCustomBlocks) => {
    setCustomBlocks(next);
    await AsyncStorage.setItem(CUSTOM_BLOCKS_KEY, JSON.stringify(next));
  }, []);

  /* ── effects ── */
  useEffect(() => {
    const loadLocal = async () => {
      const [rawR, rawU, rawB, rawCb] = await Promise.all([
        AsyncStorage.getItem(RESTRICTIONS_KEY),
        AsyncStorage.getItem(SHABBAT_UI_STATE_KEY),
        AsyncStorage.getItem(BLOCK_LEVEL_KEY),
        AsyncStorage.getItem(CUSTOM_BLOCKS_KEY),
      ]);
      if (rawR) { try { setRestrictions(JSON.parse(rawR)); } catch { /* use defaults */ } }
      if (rawU) { try { setShabbatUiState(JSON.parse(rawU)); } catch { /* use defaults */ } }
      if (rawB && ["full", "medium", "custom", "none"].includes(rawB)) setBlockLevel(rawB as BlockLevel);
      if (rawCb) { try { setCustomBlocks(JSON.parse(rawCb)); } catch { /* use defaults */ } }
    };
    loadLocal().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setAuthLoading(false);
      if (profile) {
        setProfileName(profile.displayName ?? "");
        if (profile.gender === "Male" || profile.gender === "Female") setProfileGender(profile.gender);
        else setProfileGender("");
        if (isEmailProvider() && !isCurrentUserEmailVerified()) setPendingEmailVerification(true);
        else setPendingEmailVerification(false);
      } else {
        setPendingEmailVerification(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    tabContentAnim.setValue(0);
    Animated.timing(tabContentAnim, {
      toValue: 1,
      duration: 200,
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
            ? `Your intention:\n\n"${user.shabbatIntentText}"\n\nDo you still want to break Shabbat?`
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

  /* ── load location & congregations ── */
  const loadLocationAndCongregations = useCallback(async () => {
    if (!user) return;
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      if (location.city) setCity(location.city);
      const nearby = await listNearbyCongregations(location, 8, 50);
      setNearbyCongregations(nearby);
    } catch (error) {
      setNearbyError(errorMessage(error, "Could not load nearby congregations."));
      setNearbyCongregations([]);
    } finally {
      setNearbyLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
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
        if (!found) return;
        const members = await listCongregationMembers(user.congregationId!);
        setCongregationMembers(members);
        const pending = await Promise.all(found.pendingUids.map((uid) => getUserProfile(uid)));
        setPendingMembers(pending.filter((p): p is UserProfile => Boolean(p)));
      })
      .catch(() => setCurrentCongregationName("Unknown"));
  }, [user?.congregationId]);

  useEffect(() => {
    if (!shabbatTimes || !user) return;
    scheduleShabbatMode(shabbatTimes).catch(() => {});
  }, [shabbatTimes, user]);

  useEffect(() => {
    if (!isShabbatNow || !user) return;
    const hasPrompted = shabbatUiState.lastIntentPromptWeekId === weekId;
    const optedOut = shabbatUiState.optedOutWeekId === weekId;
    if (!hasPrompted && !optedOut) {
      setIntentDraft(user.shabbatIntentText ?? "");
      setIntentModalVisible(true);
    }
  }, [isShabbatNow, shabbatUiState.lastIntentPromptWeekId, shabbatUiState.optedOutWeekId, user, weekId]);

  /* ── load friends ── */
  useEffect(() => {
    if (!user) return;
    const loadFriends = async () => {
      if (user.friendUids.length > 0) {
        const profiles = await getFriendProfiles(user.friendUids);
        setFriends(profiles.sort((a, b) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0)));
      } else {
        setFriends([]);
      }
      if (user.pendingFriendUids.length > 0) {
        const profiles = await getFriendProfiles(user.pendingFriendUids);
        setPendingRequests(profiles);
      } else {
        setPendingRequests([]);
      }
    };
    loadFriends().catch(() => {});
  }, [user?.friendUids, user?.pendingFriendUids, user]);

  /* ── chat subscription ── */
  useEffect(() => {
    if (!user?.congregationId || socialSubTab !== "chat") return;
    const unsubscribe = subscribeToCongregationMessages(user.congregationId, setChatMessages);
    return () => unsubscribe();
  }, [user?.congregationId, socialSubTab]);

  /* ── restriction week outcomes ── */
  const applyRestrictionWeekOutcome = useCallback(
    async (kept: boolean) => {
      const next = restrictions.map((r) => {
        if (!r.enabled || r.lastWeekId === weekId) return r;
        if (!kept) return { ...r, currentStreak: 0, lastWeekId: weekId };
        const nextC = r.currentStreak + 1;
        return { ...r, currentStreak: nextC, longestStreak: Math.max(r.longestStreak, nextC), lastWeekId: weekId };
      });
      await saveRestrictions(next);
    },
    [restrictions, saveRestrictions, weekId]
  );

  /* ── auth callbacks ── */
  const runAuthAction = useCallback(async (action: () => Promise<UserProfile>) => {
    setAuthError(null);
    setActionLoading(true);
    try {
      const profile = await action();
      setUser(profile);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to sign in."));
    } finally {
      setActionLoading(false);
    }
  }, []);

  const onPressContinueApple = useCallback(() => runAuthAction(signInWithApple), [runAuthAction]);
  const onPressContinueGoogle = useCallback(() => runAuthAction(signInWithGoogle), [runAuthAction]);

  const onPressEmailSignIn = useCallback(async () => {
    setAuthError(null);
    setActionLoading(true);
    try {
      const profile = await signInWithEmailPassword({ email: authEmail, password: authPassword });
      setUser(profile);
      if (isEmailProvider() && !isCurrentUserEmailVerified()) setPendingEmailVerification(true);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to sign in."));
    } finally {
      setActionLoading(false);
    }
  }, [authEmail, authPassword]);

  const onPressEmailRegister = useCallback(async () => {
    const name = signupName.trim();
    const gender = signupGender;
    const email = signupEmail.trim();
    if (!name) { setAuthError("Please enter your name."); return; }
    if (!gender) { setAuthError("Please select your gender."); return; }
    if (!email) { setAuthError("Please enter your email."); return; }
    if (!signupPassword) { setAuthError("Please enter a password."); return; }
    if (signupPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    if (signupPassword !== signupConfirmPassword) { setAuthError("Passwords do not match."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      const profile = await registerWithEmailPassword({ email, password: signupPassword });
      setUser({ ...profile, displayName: name, gender });
      setPendingSignupData({ name, gender });
      await sendVerification();
      setResendCooldown(60);
      setPendingEmailVerification(true);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to create account."));
    } finally {
      setActionLoading(false);
    }
  }, [signupConfirmPassword, signupEmail, signupGender, signupName, signupPassword]);

  const onPressSendPhoneCode = useCallback(async () => {
    setAuthError(null);
    setActionLoading(true);
    try {
      const confirmation = await startPhoneSignIn(authPhone);
      setPhoneConfirmation(confirmation);
      Alert.alert("Code sent", "Enter the verification code you received.");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to send verification code."));
    } finally {
      setActionLoading(false);
    }
  }, [authPhone]);

  const onPressVerifyPhoneCode = useCallback(async () => {
    if (!phoneConfirmation) { setAuthError("Please request a verification code first."); return; }
    await runAuthAction(() => confirmPhoneSignIn({ confirmation: phoneConfirmation, code: authPhoneCode }));
  }, [authPhoneCode, phoneConfirmation, runAuthAction]);

  const onPressSignupSendPhoneCode = useCallback(async () => {
    const name = signupName.trim();
    if (!name) { setAuthError("Please enter your name."); return; }
    if (!signupGender) { setAuthError("Please select your gender."); return; }
    if (!signupPhone.trim()) { setAuthError("Please enter your phone number."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      const confirmation = await startPhoneSignIn(signupPhone);
      setSignupPhoneConfirmation(confirmation);
      Alert.alert("Code sent", "Enter the verification code you received.");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to send verification code."));
    } finally {
      setActionLoading(false);
    }
  }, [signupGender, signupName, signupPhone]);

  const onPressSignupVerifyPhoneCode = useCallback(async () => {
    if (!signupPhoneConfirmation) { setAuthError("Please request a verification code first."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      await confirmPhoneSignUp({ confirmation: signupPhoneConfirmation, code: signupPhoneCode });
      const profile = await createProfileAfterVerification({ displayName: signupName.trim(), gender: signupGender });
      setUser(profile);
      setSignupPhoneConfirmation(null);
      setSignupPhoneCode("");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to verify code."));
    } finally {
      setActionLoading(false);
    }
  }, [signupGender, signupName, signupPhoneCode, signupPhoneConfirmation]);

  const onPressSignOut = useCallback(async () => {
    setActionLoading(true);
    try {
      if (pendingEmailVerification && isEmailProvider() && !isCurrentUserEmailVerified()) await deleteCurrentUser();
      else await signOut();
      setUser(null);
      setPendingEmailVerification(false);
      setPendingSignupData(null);
    } finally {
      setActionLoading(false);
    }
  }, [pendingEmailVerification]);

  const onPressResendVerification = useCallback(async () => {
    setAuthError(null);
    setActionLoading(true);
    try {
      await sendVerification();
      setResendCooldown(60);
      Alert.alert("Email sent", "A new verification email has been sent.");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to resend verification email."));
    } finally {
      setActionLoading(false);
    }
  }, []);

  const onPressCheckVerification = useCallback(async () => {
    setAuthError(null);
    setVerificationChecking(true);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        if (pendingSignupData) {
          const profile = await createProfileAfterVerification({ displayName: pendingSignupData.name, gender: pendingSignupData.gender });
          setUser(profile);
          setPendingSignupData(null);
        }
        setPendingEmailVerification(false);
      } else {
        setAuthError("Email not yet verified. Please check your inbox.");
      }
    } catch (error) {
      setAuthError(errorMessage(error, "Could not check verification status."));
    } finally {
      setVerificationChecking(false);
    }
  }, [pendingSignupData]);

  const onPressForgotPassword = useCallback(async () => {
    setAuthError(null);
    setActionLoading(true);
    try {
      await resetPassword(resetEmailValue || authEmail);
      setResetSent(true);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to send password reset email."));
    } finally {
      setActionLoading(false);
    }
  }, [authEmail, resetEmailValue]);

  const switchAuthMode = useCallback((mode: "choose" | "login" | "signup") => {
    setAuthError(null);
    setAuthMode(mode);
  }, []);

  /* ── shabbat mode callbacks ── */
  const onToggleMode = useCallback(async () => {
    if (!user) return;
    if (!isModeActive && !isShabbatNow) {
      Alert.alert("Shabbat mode", "Shabbat mode can only be activated during Shabbat.");
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
  }, [applyRestrictionWeekOutcome, endMode, isModeActive, isShabbatNow, startMode, user, weekId]);

  const onBreakShabbatNow = useCallback(async () => {
    if (!user) return;
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

  /* ── profile callbacks ── */
  const onSaveProfile = useCallback(async () => {
    if (!user) return;
    const nextName = profileName.trim();
    const nextGender = profileGender;
    if (!nextName || !nextGender) { Alert.alert("Profile", "Name and gender are required."); return; }
    setActionLoading(true);
    try {
      if (user.uid.startsWith("dev-local-")) {
        setUser((prev) => prev ? { ...prev, displayName: nextName, gender: nextGender } : prev);
        return;
      }
      try {
        const updated = await withTimeout(updateUserProfile(user.uid, { displayName: nextName, gender: nextGender }), 6000, "Profile save timed out.");
        setUser(updated);
      } catch {
        setUser((prev) => prev ? { ...prev, displayName: nextName, gender: nextGender } : prev);
      }
    } finally {
      setActionLoading(false);
    }
  }, [profileGender, profileName, user]);

  /* ── reminder callbacks ── */
  const onToggleMorningReminder = useCallback(async () => {
    if (!user || !shabbatTimes) return;
    const next = !user.wantsMorningReminders;
    setActionLoading(true);
    try {
      if (next) {
        await scheduleNextReminder({ type: ReminderType.TEFILLIN, enabled: true, time: user.wakeUpTime ?? "07:00", title: "Tefillin reminder", body: "Time to wrap tefillin!" }, shabbatTimes);
      } else {
        await cancelReminder(ReminderType.TEFILLIN);
      }
      const updated = await updateUserProfile(user.uid, { wantsMorningReminders: next });
      setUser(updated);
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [shabbatTimes, user]);

  const onToggleShabbatReminder = useCallback(async () => {
    if (!user || !shabbatTimes) return;
    const next = !user.wantsShabbatReminders;
    setActionLoading(true);
    try {
      if (next) {
        const reminderDate = new Date(shabbatTimes.shabbatStart.getTime() - 15 * 60000);
        await scheduleNextReminder({ type: ReminderType.SHABBAT_PREP, enabled: true, time: formatTime24(reminderDate), title: "Shabbat starts soon", body: "Shabbat starts in about 15 minutes." }, shabbatTimes);
      } else {
        await cancelReminder(ReminderType.SHABBAT_PREP);
      }
      const updated = await updateUserProfile(user.uid, { wantsShabbatReminders: next });
      setUser(updated);
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [shabbatTimes, user]);

  const onToggleModehAni = useCallback(async () => {
    if (!user) return;
    const next = !user.wantsModehAniReminder;
    setActionLoading(true);
    try {
      const updated = await updateUserProfile(user.uid, { wantsModehAniReminder: next });
      setUser(updated);
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const onToggleShema = useCallback(async () => {
    if (!user) return;
    const next = !user.wantsShemaReminder;
    setActionLoading(true);
    try {
      const updated = await updateUserProfile(user.uid, { wantsShemaReminder: next });
      setUser(updated);
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const onSetWakeTime = useCallback(async (time: string) => {
    if (!user) return;
    try {
      const updated = await updateUserProfile(user.uid, { wakeUpTime: time });
      setUser(updated);
    } catch { /* keep going */ }
  }, [user]);

  const onSetBedTime = useCallback(async (time: string) => {
    if (!user) return;
    try {
      const updated = await updateUserProfile(user.uid, { bedTime: time });
      setUser(updated);
    } catch { /* keep going */ }
  }, [user]);

  /* ── intent callbacks ── */
  const onSubmitIntent = useCallback(async () => {
    if (!user) return;
    const text = intentDraft.trim();
    if (!text) { Alert.alert("Intent required", "Please write your intention for this week."); return; }
    setActionLoading(true);
    try {
      const updated = await updateUserProfile(user.uid, { shabbatIntentText: text });
      setUser(updated);
      await saveShabbatUiState({ ...shabbatUiState, lastIntentPromptWeekId: weekId });
      setIntentModalVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [intentDraft, saveShabbatUiState, shabbatUiState, user, weekId]);

  const onOptOutThisWeek = useCallback(async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const updated = await recordBrokenShabbatWeek(user.uid, weekId);
      setUser(updated);
      await applyRestrictionWeekOutcome(false);
      await saveShabbatUiState({ ...shabbatUiState, optedOutWeekId: weekId, lastIntentPromptWeekId: weekId });
      setIntentModalVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [applyRestrictionWeekOutcome, saveShabbatUiState, shabbatUiState, user, weekId]);

  /* ── congregation callbacks ── */
  const refreshCongregationData = useCallback(async () => {
    if (!user?.congregationId) { setCurrentCongregation(null); setCongregationMembers([]); setPendingMembers([]); return; }
    const congregation = await getCongregationById(user.congregationId);
    if (!congregation) { setCurrentCongregation(null); setCongregationMembers([]); setPendingMembers([]); return; }
    setCurrentCongregation(congregation);
    setCurrentCongregationName(congregation.name);
    const members = await listCongregationMembers(user.congregationId);
    setCongregationMembers(members);
    const pending = await Promise.all(congregation.pendingUids.map((uid) => getUserProfile(uid)));
    setPendingMembers(pending.filter((p): p is UserProfile => Boolean(p)));
  }, [user?.congregationId]);

  const onJoinCongregation = useCallback(async (congregationId: string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      const result = await joinCongregationAsUser(congregationId, user.uid);
      if (result === "JOINED") {
        const profile = await getUserProfile(user.uid);
        if (profile) setUser(profile);
        await refreshCongregationData();
      } else {
        Alert.alert("Request sent", "The leader needs to approve your request.");
      }
      await completeCongregationOnboarding(user.uid);
      setJoinCongregationVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [refreshCongregationData, user]);

  const onLeaveCongregation = useCallback(async () => {
    if (!user?.congregationId) return;
    setActionLoading(true);
    try {
      await leaveCongregationAsUser(user.congregationId, user.uid);
      const profile = await getUserProfile(user.uid);
      if (profile) setUser(profile);
      setCurrentCongregation(null);
      setCongregationMembers([]);
      setPendingMembers([]);
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const onCreateCongregation = useCallback(async () => {
    if (!user || !currentLocation) { Alert.alert("Location required", "Allow location to create a congregation."); return; }
    const name = newCongregationName.trim();
    if (!name) { Alert.alert("Missing info", "Please enter a congregation name."); return; }
    const cityValue = cleanCity(currentLocation.city);
    setActionLoading(true);
    try {
      const congregation = await createCongregation({ name, city: cityValue, latitude: currentLocation.latitude, longitude: currentLocation.longitude, timezone: currentLocation.timezone, creatorUid: user.uid });
      const profile = await setUserCongregation(user.uid, congregation.id);
      setUser(profile);
      setNewCongregationName("");
      await loadLocationAndCongregations();
      await refreshCongregationData();
      setJoinCongregationVisible(false);
    } catch (error) {
      Alert.alert("Create congregation", errorMessage(error, "Failed to create."));
    } finally {
      setActionLoading(false);
    }
  }, [currentLocation, loadLocationAndCongregations, newCongregationName, refreshCongregationData, user]);

  const onChangeJoinPolicy = useCallback(async (policy: "OPEN" | "REQUEST" | "CLOSED") => {
    if (!user || !currentCongregation) return;
    setActionLoading(true);
    try {
      await setCongregationJoinPolicy({ congregationId: currentCongregation.id, leaderUid: user.uid, policy });
      await refreshCongregationData();
    } catch (error) {
      Alert.alert("Join policy", errorMessage(error, "Failed to update policy."));
    } finally {
      setActionLoading(false);
    }
  }, [currentCongregation, refreshCongregationData, user]);

  const onApproveRequest = useCallback(async (targetUid: string) => {
    if (!user || !currentCongregation) return;
    setActionLoading(true);
    try {
      await approveJoinRequest({ congregationId: currentCongregation.id, leaderUid: user.uid, targetUid });
      await refreshCongregationData();
    } finally { setActionLoading(false); }
  }, [currentCongregation, refreshCongregationData, user]);

  const onRejectMemberRequest = useCallback(async (targetUid: string) => {
    if (!user || !currentCongregation) return;
    setActionLoading(true);
    try {
      await rejectJoinRequest({ congregationId: currentCongregation.id, leaderUid: user.uid, targetUid });
      await refreshCongregationData();
    } finally { setActionLoading(false); }
  }, [currentCongregation, refreshCongregationData, user]);

  const onKickMember = useCallback(async (targetUid: string) => {
    if (!user || !currentCongregation) return;
    setActionLoading(true);
    try {
      await kickMember({ congregationId: currentCongregation.id, leaderUid: user.uid, targetUid });
      await refreshCongregationData();
    } finally { setActionLoading(false); }
  }, [currentCongregation, refreshCongregationData, user]);

  /* ── city search for congregation ── */
  const onCitySearchChange = useCallback((text: string) => {
    setCongregationCitySearch(text);
    if (citySearchTimer.current) clearTimeout(citySearchTimer.current);
    if (text.trim().length < 2) { setCitySuggestions([]); return; }
    citySearchTimer.current = setTimeout(async () => {
      const results = await geocodeCitySuggestions(text, 5);
      setCitySuggestions(results);
    }, 400);
  }, []);

  const searchCongregationsByCity = useCallback(async (geo: GeocodingResult) => {
    setNearbyLoading(true);
    setNearbyError(null);
    setCitySuggestions([]);
    try {
      const fakeLocation: LocationResult = {
        city: geo.displayName.split(",")[0]?.trim() ?? geo.displayName,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: currentLocation?.timezone ?? "UTC",
        source: "manual",
        fetchedAt: new Date(),
      };
      const nearby = await listNearbyCongregations(fakeLocation, 8, 50);
      setNearbyCongregations(nearby);
    } catch (error) {
      setNearbyError(errorMessage(error, "Search failed."));
    } finally {
      setNearbyLoading(false);
    }
  }, [currentLocation?.timezone]);

  /* ── friend callbacks ── */
  const onFriendSearchChange = useCallback((text: string) => {
    setFriendSearchQuery(text);
    if (friendSearchTimer.current) clearTimeout(friendSearchTimer.current);
    if (text.trim().length < 2) { setFriendSearchResults([]); return; }
    friendSearchTimer.current = setTimeout(async () => {
      if (!user) return;
      setFriendSearching(true);
      try {
        const results = await searchUsersByName(text, user.uid);
        setFriendSearchResults(results);
      } finally {
        setFriendSearching(false);
      }
    }, 500);
  }, [user]);

  const onSendFriendRequest = useCallback(async (toUid: string) => {
    if (!user) return;
    try {
      await sendFriendRequest(user.uid, toUid);
      Alert.alert("Request sent!", "They'll see your friend request.");
      setFriendSearchResults((prev) => prev.filter((p) => p.uid !== toUid));
    } catch (error) {
      Alert.alert("Friend request", errorMessage(error, "Could not send request."));
    }
  }, [user]);

  const onAcceptFriendRequest = useCallback(async (friendUid: string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      await acceptFriendRequest(user.uid, friendUid);
      const updated = await getUserProfile(user.uid);
      if (updated) setUser(updated);
    } finally { setActionLoading(false); }
  }, [user]);

  const onRejectFriendRequest = useCallback(async (friendUid: string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      await rejectFriendRequest(user.uid, friendUid);
      const updated = await getUserProfile(user.uid);
      if (updated) setUser(updated);
    } finally { setActionLoading(false); }
  }, [user]);

  /* ── chat callbacks ── */
  const onSendChat = useCallback(async () => {
    if (!user?.congregationId || !chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    Keyboard.dismiss();
    try {
      await sendCongregationMessage(user.congregationId, user.uid, user.displayName ?? "Anonymous", text);
    } catch (error) {
      Alert.alert("Chat", errorMessage(error, "Failed to send message."));
    }
  }, [chatInput, user]);

  /* ── time display ── */
  const timesDisplay = useMemo(() => {
    if (timesLoading) return "Loading...";
    if (timesError) return timesError.message;
    if (!shabbatTimes) return "No times loaded";
    return `${formatDay(shabbatTimes.shabbatStart)} ${formatTime(shabbatTimes.shabbatStart)} – ${formatDay(shabbatTimes.shabbatEnd)} ${formatTime(shabbatTimes.shabbatEnd)}`;
  }, [shabbatTimes, timesError, timesLoading]);

  /* ═══════════════════════════════════════════════════════════ */
  /*                     RENDER: HOME TAB                       */
  /* ═══════════════════════════════════════════════════════════ */

  const renderHomeTab = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      {/* Greeting */}
      <Text style={s.greeting}>Shabbat Shalom, {user?.displayName?.split(" ")[0] ?? "Friend"}</Text>
      <Text style={s.locationText}>{homeCity}</Text>

      {/* Streaks */}
      <View style={s.streakRow}>
        <View style={[s.streakCard, { backgroundColor: C.streakBg }]}>
          <Text style={s.streakEmoji}>🔥</Text>
          <Text style={s.streakNumber}>{user?.currentStreak ?? 0}</Text>
          <Text style={s.streakLabel}>Shabbat Streak</Text>
        </View>
        <View style={[s.streakCard, { backgroundColor: C.primaryLight }]}>
          <Text style={s.streakEmoji}>✡️</Text>
          <Text style={[s.streakNumber, { color: C.primary }]}>{user?.tefillinCurrentStreak ?? 0}</Text>
          <Text style={[s.streakLabel, { color: C.primary }]}>Tefillin Streak</Text>
        </View>
      </View>

      {/* Shabbat Times */}
      <View style={s.sectionCard}>
        <Text style={s.sectionIcon}>🕯️</Text>
        <Text style={s.sectionTitle}>This Shabbat</Text>
        <Text style={s.sectionValue}>{timesDisplay}</Text>
        {isShabbatNow && <View style={s.liveBadge}><Text style={s.liveBadgeText}>SHABBAT NOW</Text></View>}
      </View>

      {/* Shabbat Block Level */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Shabbat Mode</Text>
        <Text style={s.sectionDesc}>Choose your level of observance</Text>
        <View style={s.blockGrid}>
          {(["full", "medium", "custom", "none"] as BlockLevel[]).map((level) => {
            const info = BLOCK_INFO[level];
            const active = blockLevel === level;
            return (
              <Pressable
                key={level}
                style={[s.blockOption, active && s.blockOptionActive]}
                onPress={() => saveBlockLevel(level)}
              >
                <Text style={s.blockEmoji}>{info.emoji}</Text>
                <Text style={[s.blockTitle, active && s.blockTitleActive]}>{info.title}</Text>
                <Text style={[s.blockDesc, active && s.blockDescActive]} numberOfLines={2}>{info.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {blockLevel === "custom" && (
          <View style={s.customBlockSection}>
            <Text style={s.customBlockTitle}>Customize Blocking</Text>
            {[
              { key: "social" as const, label: "Social Media" },
              { key: "games" as const, label: "Games" },
              { key: "streaming" as const, label: "Streaming" },
            ].map((item) => (
              <View key={item.key} style={s.toggleRow}>
                <Text style={s.toggleLabel}>{item.label}</Text>
                <Switch
                  value={customBlocks[item.key]}
                  onValueChange={(val) => saveCustomBlocks({ ...customBlocks, [item.key]: val })}
                  trackColor={{ false: C.border, true: C.primaryLight }}
                  thumbColor={customBlocks[item.key] ? C.primary : "#f4f4f5"}
                />
              </View>
            ))}
          </View>
        )}

        {/* Mode Toggle */}
        <View style={[s.toggleRow, { marginTop: 16 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>{isModeActive ? "Shabbat Mode Active" : "Activate Shabbat Mode"}</Text>
            {!isShabbatNow && !isModeActive && <Text style={s.toggleHint}>Available when Shabbat begins</Text>}
          </View>
          <Switch
            value={isModeActive}
            onValueChange={onToggleMode}
            disabled={!isShabbatNow && !isModeActive}
            trackColor={{ false: C.border, true: C.successLight }}
            thumbColor={isModeActive ? C.success : "#f4f4f5"}
          />
        </View>

        {isModeActive && (
          <Pressable style={s.dangerBtn} onPress={onBreakShabbatNow} disabled={actionLoading}>
            <Text style={s.dangerBtnText}>Break Shabbat</Text>
          </Pressable>
        )}
      </View>

      {/* Intention */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Your Shabbat Intention</Text>
        <Text style={s.sectionDesc}>Write why you're keeping Shabbat this week. This will remind you if you try to break it.</Text>
        <TextInput
          multiline
          value={user?.shabbatIntentText ?? ""}
          onChangeText={(text) => {
            setIntentDraft(text);
            setUser((prev) => prev ? { ...prev, shabbatIntentText: text } : prev);
          }}
          style={s.intentInput}
          placeholder="I am keeping Shabbat because..."
          placeholderTextColor={C.textLight}
        />
        {intentDraft.trim() !== (user?.shabbatIntentText ?? "") && intentDraft.trim() && (
          <Pressable style={s.primaryBtn} onPress={async () => {
            if (!user) return;
            const updated = await updateUserProfile(user.uid, { shabbatIntentText: intentDraft.trim() });
            setUser(updated);
            Alert.alert("Saved", "Your intention has been saved.");
          }}>
            <Text style={s.primaryBtnText}>Save Intention</Text>
          </Pressable>
        )}
      </View>

      {/* Daily Practice Reminders */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Daily Practice</Text>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>🕐 Tefillin Reminder</Text>
            <Text style={s.toggleHint}>Morning notification to wrap tefillin</Text>
          </View>
          <Switch
            value={Boolean(user?.wantsMorningReminders)}
            onValueChange={onToggleMorningReminder}
            trackColor={{ false: C.border, true: C.primaryLight }}
            thumbColor={user?.wantsMorningReminders ? C.primary : "#f4f4f5"}
          />
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>🌅 Modeh Ani</Text>
            <Text style={s.toggleHint}>Say Modeh Ani first thing each morning</Text>
          </View>
          <Switch
            value={Boolean(user?.wantsModehAniReminder)}
            onValueChange={onToggleModehAni}
            trackColor={{ false: C.border, true: C.primaryLight }}
            thumbColor={user?.wantsModehAniReminder ? C.primary : "#f4f4f5"}
          />
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>🌙 Shema Before Bed</Text>
            <Text style={s.toggleHint}>Say Shema before going to sleep</Text>
          </View>
          <Switch
            value={Boolean(user?.wantsShemaReminder)}
            onValueChange={onToggleShema}
            trackColor={{ false: C.border, true: C.primaryLight }}
            thumbColor={user?.wantsShemaReminder ? C.primary : "#f4f4f5"}
          />
        </View>

        {/* Wake / Bed Times */}
        {(user?.wantsMorningReminders || user?.wantsModehAniReminder) && (
          <View style={s.timeSection}>
            <Text style={s.timeSectionTitle}>Wake Up Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePills}>
              {WAKE_TIMES.map((t) => (
                <Pressable key={t} style={[s.timePill, user?.wakeUpTime === t && s.timePillActive]} onPress={() => onSetWakeTime(t)}>
                  <Text style={[s.timePillText, user?.wakeUpTime === t && s.timePillTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {user?.wantsShemaReminder && (
          <View style={s.timeSection}>
            <Text style={s.timeSectionTitle}>Bed Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePills}>
              {BED_TIMES.map((t) => (
                <Pressable key={t} style={[s.timePill, user?.bedTime === t && s.timePillActive]} onPress={() => onSetBedTime(t)}>
                  <Text style={[s.timePillText, user?.bedTime === t && s.timePillTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*                    RENDER: SOCIAL TAB                      */
  /* ═══════════════════════════════════════════════════════════ */

  const renderSocialTab = () => (
    <View style={{ flex: 1 }}>
      {/* Congregation Banner */}
      <View style={s.congBanner}>
        {user?.congregationId && currentCongregation ? (
          <>
            <Text style={s.congBannerName}>{currentCongregation.name}</Text>
            <Text style={s.congBannerDetail}>{currentCongregation.city} · {congregationMembers.length} members</Text>
          </>
        ) : (
          <>
            <Text style={s.congBannerName}>No Congregation</Text>
            <Text style={s.congBannerDetail}>Join or create one to connect</Text>
          </>
        )}
        <View style={s.congBannerActions}>
          {user?.congregationId ? (
            <>
              <Pressable style={s.congBannerBtn} onPress={() => setSocialSubTab("chat")}>
                <Text style={s.congBannerBtnText}>💬 Chat</Text>
              </Pressable>
              <Pressable style={s.congBannerBtn} onPress={() => setSocialSubTab("friends")}>
                <Text style={s.congBannerBtnText}>👥 Members</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={s.congBannerBtn} onPress={() => setJoinCongregationVisible(true)}>
              <Text style={s.congBannerBtnText}>Join / Create</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Social Sub-tabs */}
      <View style={s.subTabRow}>
        {([
          { key: "friends" as SocialSubTab, label: "Leaderboard" },
          { key: "chat" as SocialSubTab, label: "Chat" },
          { key: "buddies" as SocialSubTab, label: "Buddies" },
        ]).map((tab) => (
          <Pressable
            key={tab.key}
            style={[s.subTab, socialSubTab === tab.key && s.subTabActive]}
            onPress={() => setSocialSubTab(tab.key)}
          >
            <Text style={[s.subTabText, socialSubTab === tab.key && s.subTabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Sub-tab Content */}
      {socialSubTab === "friends" && (
        <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
          {/* Pending friend requests */}
          {pendingRequests.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Friend Requests</Text>
              {pendingRequests.map((req) => (
                <View key={req.uid} style={s.friendRow}>
                  <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(req.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.friendName}>{req.displayName ?? "Unknown"}</Text>
                  </View>
                  <Pressable style={s.acceptBtn} onPress={() => onAcceptFriendRequest(req.uid)}><Text style={s.acceptBtnText}>Accept</Text></Pressable>
                  <Pressable style={s.rejectBtn} onPress={() => onRejectFriendRequest(req.uid)}><Text style={s.rejectBtnText}>Decline</Text></Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Friends Leaderboard */}
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Friends</Text>
            {friends.length === 0 ? (
              <Text style={s.emptyText}>Add friends to see them here!</Text>
            ) : (
              friends.map((friend, idx) => (
                <LeaderboardRow key={friend.uid} profile={friend} rank={idx + 1} />
              ))
            )}
          </View>

          {/* Congregation Members */}
          {congregationMembers.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>{currentCongregation?.name ?? "Congregation"}</Text>
              {congregationMembers
                .sort((a, b) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0))
                .map((member, idx) => (
                  <LeaderboardRow key={member.uid} profile={member} rank={idx + 1} isCurrentUser={member.uid === user?.uid} />
                ))}
            </View>
          )}

          {/* Leader Controls */}
          {currentCongregation?.leaderUid === user?.uid && (
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Leader Controls</Text>
              <Text style={s.sectionDesc}>Join policy: {currentCongregation?.joinPolicy}</Text>
              <View style={s.policyRow}>
                {(["OPEN", "REQUEST", "CLOSED"] as const).map((p) => (
                  <Pressable key={p} style={[s.policyPill, currentCongregation?.joinPolicy === p && s.policyPillActive]} onPress={() => onChangeJoinPolicy(p)}>
                    <Text style={[s.policyPillText, currentCongregation?.joinPolicy === p && s.policyPillTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
              {pendingMembers.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 12 }]}>Pending Requests</Text>
                  {pendingMembers.map((m) => (
                    <View key={m.uid} style={s.friendRow}>
                      <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(m.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
                      <Text style={[s.friendName, { flex: 1 }]}>{m.displayName ?? "Unknown"}</Text>
                      <Pressable style={s.acceptBtn} onPress={() => onApproveRequest(m.uid)}><Text style={s.acceptBtnText}>Approve</Text></Pressable>
                      <Pressable style={s.rejectBtn} onPress={() => onRejectMemberRequest(m.uid)}><Text style={s.rejectBtnText}>Reject</Text></Pressable>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {/* Add Friend + Congregation Actions */}
          <View style={s.socialActions}>
            <Pressable style={s.primaryBtn} onPress={() => { setFriendSearchQuery(""); setFriendSearchResults([]); setAddFriendVisible(true); }}>
              <Text style={s.primaryBtnText}>+ Add Friends</Text>
            </Pressable>
            {user?.congregationId && (
              <Pressable style={s.outlineBtn} onPress={() => Alert.alert("Leave Congregation", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Leave", style: "destructive", onPress: onLeaveCongregation }])}>
                <Text style={s.outlineBtnText}>Leave Congregation</Text>
              </Pressable>
            )}
            {!user?.congregationId && (
              <Pressable style={s.outlineBtn} onPress={() => setJoinCongregationVisible(true)}>
                <Text style={s.outlineBtnText}>Join / Create Congregation</Text>
              </Pressable>
            )}
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {socialSubTab === "chat" && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={120}>
          {!user?.congregationId ? (
            <View style={s.emptyCentered}>
              <Text style={s.emptyText}>Join a congregation to start chatting</Text>
              <Pressable style={[s.primaryBtn, { marginTop: 16 }]} onPress={() => setJoinCongregationVisible(true)}>
                <Text style={s.primaryBtnText}>Join Congregation</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.chatList}
                renderItem={({ item }) => (
                  <View style={[s.chatBubble, item.senderUid === user?.uid && s.chatBubbleMine]}>
                    {item.senderUid !== user?.uid && <Text style={s.chatSender}>{item.senderName}</Text>}
                    <Text style={[s.chatText, item.senderUid === user?.uid && s.chatTextMine]}>{item.text}</Text>
                  </View>
                )}
              />
              <View style={s.chatInputRow}>
                <TextInput
                  style={s.chatTextInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Type a message..."
                  placeholderTextColor={C.textLight}
                  returnKeyType="send"
                  onSubmitEditing={onSendChat}
                />
                <Pressable style={s.chatSendBtn} onPress={onSendChat}>
                  <Text style={s.chatSendBtnText}>Send</Text>
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}

      {socialSubTab === "buddies" && (
        <ScrollView contentContainerStyle={s.tabContent}>
          <View style={s.sectionCard}>
            <Text style={s.sectionIcon}>🤝</Text>
            <Text style={s.sectionTitle}>Tefillin Buddies</Text>
            <Text style={s.sectionDesc}>
              Pair up with a friend and send each other a photo of you wrapping tefillin daily. Keep the streak going together — like Snapchat streaks but for your neshama!
            </Text>
            <View style={[s.highlightBox, { marginTop: 16 }]}>
              <Text style={s.highlightText}>📸 Photo sharing coming soon! For now, use the congregation chat to share your tefillin moments with your community.</Text>
            </View>
            <Pressable style={[s.primaryBtn, { marginTop: 16 }]} onPress={() => setSocialSubTab("chat")}>
              <Text style={s.primaryBtnText}>Go to Chat</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*                   RENDER: PARASHA TAB                      */
  /* ═══════════════════════════════════════════════════════════ */

  const renderParashaTab = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={s.parashaHeader}>This Week's Torah Portion</Text>
      <View style={s.parashaCard}>
        <Text style={s.parashaIcon}>📖</Text>
        <Text style={s.parashaName}>{shabbatTimes?.parsha ?? "Loading..."}</Text>
        {parashaInfo && (
          <>
            <View style={s.parashaBookBadge}>
              <Text style={s.parashaBookText}>{parashaInfo.book}</Text>
            </View>
            <Text style={s.parashaSummary}>{parashaInfo.summary}</Text>
          </>
        )}
        {!parashaInfo && shabbatTimes?.parsha && (
          <Text style={s.parashaSummary}>Explore this week's Torah portion to discover timeless wisdom and inspiration for your week ahead.</Text>
        )}
      </View>

      <Pressable style={s.primaryBtn} onPress={() => Linking.openURL(getChabadParashaUrl())}>
        <Text style={s.primaryBtnText}>📚 Learn More on Chabad.org</Text>
      </Pressable>

      <View style={[s.sectionCard, { marginTop: 16 }]}>
        <Text style={s.sectionIcon}>🎬</Text>
        <Text style={s.sectionTitle}>Weekly Video</Text>
        <Text style={s.sectionDesc}>Ask your rabbi to record a short weekly video about the parasha. It could be linked here for your community!</Text>
        <View style={s.highlightBox}>
          <Text style={s.highlightText}>Coming soon — connect with your rabbi to bring the parasha to life with a short video each week.</Text>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*                      AUTH SCREENS                          */
  /* ═══════════════════════════════════════════════════════════ */

  if (authLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={[s.sectionDesc, { marginTop: 16 }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
          {authMode === "choose" && (
            <>
              <View style={s.authLogoArea}>
                <Text style={s.authLogo}>✡️</Text>
                <Text style={s.authTitle}>Shabbat Shalom</Text>
                <Text style={s.authSubtitle}>Keep Shabbat with intention</Text>
              </View>
              <View style={s.authForm}>
                <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={() => switchAuthMode("login")} disabled={actionLoading}>
                  <Text style={s.primaryBtnText}>Log In</Text>
                </Pressable>
                <Pressable style={[s.outlineBtn, s.fullWidth, actionLoading && s.disabled]} onPress={() => switchAuthMode("signup")} disabled={actionLoading}>
                  <Text style={s.outlineBtnText}>Sign Up</Text>
                </Pressable>
                <View style={s.authDivider}><View style={s.authDividerLine} /><Text style={s.authDividerText}>or continue with</Text><View style={s.authDividerLine} /></View>
                <View style={s.authSocialRow}>
                  <Pressable style={[s.authSocialBtn, actionLoading && s.disabled]} onPress={onPressContinueApple} disabled={actionLoading}><Text style={s.authSocialBtnText}> Apple</Text></Pressable>
                  <Pressable style={[s.authSocialBtn, actionLoading && s.disabled]} onPress={onPressContinueGoogle} disabled={actionLoading}><Text style={s.authSocialBtnText}> Google</Text></Pressable>
                </View>
              </View>
              {authError ? <Text style={s.errorText}>{authError}</Text> : null}
            </>
          )}

          {authMode === "login" && (
            <>
              <Pressable style={s.authBack} onPress={() => switchAuthMode("choose")}><Text style={s.authBackText}>← Back</Text></Pressable>
              <View style={s.authLogoArea}><Text style={s.authTitle}>Welcome back</Text><Text style={s.authSubtitle}>Sign in to your account</Text></View>
              <View style={s.authForm}>
                <TextInput placeholder="Email" value={authEmail} onChangeText={setAuthEmail} style={s.authInput} placeholderTextColor={C.textLight} autoCapitalize="none" keyboardType="email-address" editable={!actionLoading} />
                <View style={s.passwordRow}>
                  <TextInput placeholder="Password" value={authPassword} onChangeText={setAuthPassword} style={s.passwordInput} placeholderTextColor={C.textLight} secureTextEntry={!showLoginPassword} editable={!actionLoading} />
                  <Pressable style={s.passwordToggle} onPress={() => setShowLoginPassword((v) => !v)}><Text style={s.passwordToggleText}>{showLoginPassword ? "Hide" : "Show"}</Text></Pressable>
                </View>
                <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onPressEmailSignIn} disabled={actionLoading}>
                  {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Log In</Text>}
                </Pressable>
                <Pressable style={s.authLink} onPress={() => { setResetEmailValue(authEmail); setResetSent(false); setAuthError(null); setForgotPasswordVisible(true); }}><Text style={s.authLinkText}>Forgot password?</Text></Pressable>
                <View style={s.authDivider}><View style={s.authDividerLine} /><Text style={s.authDividerText}>or sign in with phone</Text><View style={s.authDividerLine} /></View>
                <TextInput placeholder="Phone (e.g. +15551234567)" value={authPhone} onChangeText={setAuthPhone} style={s.authInput} placeholderTextColor={C.textLight} keyboardType="phone-pad" editable={!actionLoading} />
                <Pressable style={[s.outlineBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onPressSendPhoneCode} disabled={actionLoading}><Text style={s.outlineBtnText}>Send Phone Code</Text></Pressable>
                {phoneConfirmation && (
                  <>
                    <TextInput placeholder="Verification code" value={authPhoneCode} onChangeText={setAuthPhoneCode} style={s.authInput} placeholderTextColor={C.textLight} keyboardType="number-pad" editable={!actionLoading} />
                    <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onPressVerifyPhoneCode} disabled={actionLoading}><Text style={s.primaryBtnText}>Verify Code</Text></Pressable>
                  </>
                )}
              </View>
              {authError ? <Text style={s.errorText}>{authError}</Text> : null}
              <View style={s.authFooter}><Text style={s.authFooterText}>Don't have an account? </Text><Pressable onPress={() => switchAuthMode("signup")}><Text style={s.authFooterLink}>Sign Up</Text></Pressable></View>
            </>
          )}

          {authMode === "signup" && (
            <>
              <Pressable style={s.authBack} onPress={() => switchAuthMode("choose")}><Text style={s.authBackText}>← Back</Text></Pressable>
              <View style={s.authLogoArea}><Text style={s.authTitle}>Create account</Text><Text style={s.authSubtitle}>Join the community</Text></View>
              <View style={s.authForm}>
                <TextInput placeholder="Full name" value={signupName} onChangeText={setSignupName} style={s.authInput} placeholderTextColor={C.textLight} editable={!actionLoading} />
                <GenderPicker value={signupGender} onChange={setSignupGender} />
                <View style={s.authMethodToggle}>
                  <Pressable style={[s.authMethodTab, signupMethod === "email" && s.authMethodTabActive]} onPress={() => { setSignupMethod("email"); setAuthError(null); }}><Text style={[s.authMethodTabText, signupMethod === "email" && s.authMethodTabTextActive]}>Email</Text></Pressable>
                  <Pressable style={[s.authMethodTab, signupMethod === "phone" && s.authMethodTabActive]} onPress={() => { setSignupMethod("phone"); setAuthError(null); }}><Text style={[s.authMethodTabText, signupMethod === "phone" && s.authMethodTabTextActive]}>Phone</Text></Pressable>
                </View>
                {signupMethod === "email" && (
                  <>
                    <TextInput placeholder="Email" value={signupEmail} onChangeText={setSignupEmail} style={s.authInput} placeholderTextColor={C.textLight} autoCapitalize="none" keyboardType="email-address" editable={!actionLoading} />
                    <View style={s.passwordRow}><TextInput placeholder="Password" value={signupPassword} onChangeText={setSignupPassword} style={s.passwordInput} placeholderTextColor={C.textLight} secureTextEntry={!showSignupPassword} editable={!actionLoading} /><Pressable style={s.passwordToggle} onPress={() => setShowSignupPassword((v) => !v)}><Text style={s.passwordToggleText}>{showSignupPassword ? "Hide" : "Show"}</Text></Pressable></View>
                    <View style={s.passwordRow}><TextInput placeholder="Confirm password" value={signupConfirmPassword} onChangeText={setSignupConfirmPassword} style={s.passwordInput} placeholderTextColor={C.textLight} secureTextEntry={!showSignupConfirm} editable={!actionLoading} /><Pressable style={s.passwordToggle} onPress={() => setShowSignupConfirm((v) => !v)}><Text style={s.passwordToggleText}>{showSignupConfirm ? "Hide" : "Show"}</Text></Pressable></View>
                    <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onPressEmailRegister} disabled={actionLoading}>{actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Create Account</Text>}</Pressable>
                  </>
                )}
                {signupMethod === "phone" && (
                  <>
                    <TextInput placeholder="Phone (e.g. +15551234567)" value={signupPhone} onChangeText={setSignupPhone} style={s.authInput} placeholderTextColor={C.textLight} keyboardType="phone-pad" editable={!actionLoading} />
                    {!signupPhoneConfirmation ? (
                      <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onPressSignupSendPhoneCode} disabled={actionLoading}>{actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Send Verification Code</Text>}</Pressable>
                    ) : (
                      <>
                        <TextInput placeholder="Verification code" value={signupPhoneCode} onChangeText={setSignupPhoneCode} style={s.authInput} placeholderTextColor={C.textLight} keyboardType="number-pad" editable={!actionLoading} />
                        <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onPressSignupVerifyPhoneCode} disabled={actionLoading}>{actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Verify and Create Account</Text>}</Pressable>
                        <Pressable style={s.authLink} onPress={() => { setSignupPhoneConfirmation(null); setSignupPhoneCode(""); }}><Text style={s.authLinkText}>Change phone number</Text></Pressable>
                      </>
                    )}
                  </>
                )}
              </View>
              {authError ? <Text style={s.errorText}>{authError}</Text> : null}
              <View style={s.authFooter}><Text style={s.authFooterText}>Already have an account? </Text><Pressable onPress={() => switchAuthMode("login")}><Text style={s.authFooterLink}>Log In</Text></Pressable></View>
            </>
          )}
        </ScrollView>

        {/* Forgot Password Modal */}
        <Modal visible={forgotPasswordVisible} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Reset password</Text>
              {resetSent ? (
                <>
                  <Text style={s.sectionDesc}>A reset link has been sent to {resetEmailValue || authEmail}. Check your inbox.</Text>
                  <Pressable style={s.primaryBtn} onPress={() => { setForgotPasswordVisible(false); setResetSent(false); }}><Text style={s.primaryBtnText}>Done</Text></Pressable>
                </>
              ) : (
                <>
                  <Text style={s.sectionDesc}>Enter your email and we'll send you a reset link.</Text>
                  <TextInput placeholder="Email" value={resetEmailValue} onChangeText={setResetEmailValue} style={s.authInput} placeholderTextColor={C.textLight} autoCapitalize="none" keyboardType="email-address" editable={!actionLoading} />
                  <Pressable style={[s.primaryBtn, actionLoading && s.disabled]} onPress={onPressForgotPassword} disabled={actionLoading}>{actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Send reset link</Text>}</Pressable>
                  <Pressable style={s.ghostBtn} onPress={() => { setForgotPasswordVisible(false); setAuthError(null); }}><Text style={s.ghostBtnText}>Cancel</Text></Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (pendingEmailVerification) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <Text style={s.authTitle}>Verify your email</Text>
          <Text style={[s.sectionDesc, { textAlign: "center", marginTop: 12 }]}>
            We sent a verification link to {user.email ?? "your email"}. Open the link then tap below.
          </Text>
          <Pressable style={[s.primaryBtn, s.fullWidth, (verificationChecking || actionLoading) && s.disabled]} onPress={onPressCheckVerification} disabled={verificationChecking || actionLoading}>
            {verificationChecking ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>I've verified my email</Text>}
          </Pressable>
          <Pressable style={[s.outlineBtn, s.fullWidth, (actionLoading || resendCooldown > 0) && s.disabled]} onPress={onPressResendVerification} disabled={actionLoading || resendCooldown > 0}>
            <Text style={s.outlineBtnText}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}</Text>
          </Pressable>
          <Pressable style={s.ghostBtn} onPress={onPressSignOut}><Text style={s.ghostBtnText}>Sign out</Text></Pressable>
          {authError ? <Text style={s.errorText}>{authError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  const needsProfileSetup = !user.displayName?.trim() || !user.gender?.trim();
  if (needsProfileSetup) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <Text style={s.authTitle}>Welcome!</Text>
          <Text style={s.sectionDesc}>Set up your profile to get started.</Text>
          <TextInput placeholder="Name" value={profileName} onChangeText={setProfileName} style={[s.authInput, s.fullWidth]} placeholderTextColor={C.textLight} />
          <GenderPicker value={profileGender} onChange={setProfileGender} />
          <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onSaveProfile} disabled={actionLoading}>
            <Text style={s.primaryBtnText}>Save and continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*                      MAIN RETURN                           */
  /* ═══════════════════════════════════════════════════════════ */

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>
          {activeTab === "home" ? "Home" : activeTab === "social" ? "Social" : "Torah"}
        </Text>
        <Pressable style={s.settingsBtn} onPress={() => setSettingsVisible(true)}>
          <Text style={s.settingsBtnText}>⚙️</Text>
        </Pressable>
      </View>

      {/* Body */}
      <Animated.View style={[s.body, { opacity: tabContentAnim, transform: [{ translateY: tabContentAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "social" && renderSocialTab()}
        {activeTab === "parasha" && renderParashaTab()}
      </Animated.View>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        <TabItem icon="🏠" label="Home" active={activeTab === "home"} onPress={() => setActiveTab("home")} />
        <TabItem icon="👥" label="Social" active={activeTab === "social"} onPress={() => setActiveTab("social")} />
        <TabItem icon="📖" label="Torah" active={activeTab === "parasha"} onPress={() => setActiveTab("parasha")} />
      </View>

      {/* ── Modals ── */}

      {/* Intent Modal */}
      <Modal visible={intentModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Shabbat is starting ✨</Text>
            <Text style={s.sectionDesc}>Write your intention for keeping Shabbat this week. This will remind you if you try to break it.</Text>
            <TextInput multiline value={intentDraft} onChangeText={setIntentDraft} style={s.intentInput} placeholder="I am keeping Shabbat because..." placeholderTextColor={C.textLight} />
            <Pressable style={s.primaryBtn} onPress={onSubmitIntent}><Text style={s.primaryBtnText}>Save intention</Text></Pressable>
            <Pressable style={s.dangerBtn} onPress={onOptOutThisWeek}><Text style={s.dangerBtnText}>Not keeping this week</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Settings</Text>

              <Text style={[s.sectionTitle, { marginTop: 16 }]}>Profile</Text>
              <TextInput placeholder="Name" value={profileName} onChangeText={setProfileName} style={s.authInput} placeholderTextColor={C.textLight} />
              <GenderPicker value={profileGender} onChange={setProfileGender} />
              <Pressable style={s.outlineBtn} onPress={async () => {
                await onSaveProfile();
                Alert.alert("Saved", "Profile updated.");
              }}>
                <Text style={s.outlineBtnText}>Save Profile</Text>
              </Pressable>

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Shabbat Reminder</Text>
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>15 min before Shabbat</Text>
                <Switch value={Boolean(user?.wantsShabbatReminders)} onValueChange={onToggleShabbatReminder} trackColor={{ false: C.border, true: C.primaryLight }} thumbColor={user?.wantsShabbatReminders ? C.primary : "#f4f4f5"} />
              </View>

              <Pressable style={[s.dangerBtn, { marginTop: 24 }]} onPress={() => { setSettingsVisible(false); onPressSignOut(); }}>
                <Text style={s.dangerBtnText}>Sign Out</Text>
              </Pressable>
            </ScrollView>

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => setSettingsVisible(false)}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={addFriendVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <Text style={s.modalTitle}>Add Friends</Text>

            <View style={[s.highlightBox, { marginBottom: 12 }]}>
              <Text style={s.highlightText}>Your Friend Code: {user.uid.slice(0, 8).toUpperCase()}</Text>
              <Text style={[s.sectionDesc, { marginTop: 4, fontSize: 11 }]}>Share this code with friends so they can find you. QR code coming soon!</Text>
            </View>

            <TextInput
              placeholder="Search by name..."
              value={friendSearchQuery}
              onChangeText={onFriendSearchChange}
              style={s.authInput}
              placeholderTextColor={C.textLight}
              autoCapitalize="none"
            />

            {friendSearching && <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />}

            <ScrollView style={{ maxHeight: 300, marginTop: 8 }}>
              {friendSearchResults.map((result) => {
                const alreadyFriend = user.friendUids.includes(result.uid);
                const alreadyPending = result.pendingFriendUids?.includes(user.uid);
                return (
                  <View key={result.uid} style={s.friendRow}>
                    <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(result.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{result.displayName ?? "Unknown"}</Text>
                    </View>
                    {alreadyFriend ? (
                      <Text style={[s.sectionDesc, { marginTop: 0 }]}>Friends ✓</Text>
                    ) : alreadyPending ? (
                      <Text style={[s.sectionDesc, { marginTop: 0 }]}>Sent</Text>
                    ) : (
                      <Pressable style={s.acceptBtn} onPress={() => onSendFriendRequest(result.uid)}><Text style={s.acceptBtnText}>Add</Text></Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => setAddFriendVisible(false)}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Join/Create Congregation Modal */}
      <Modal visible={joinCongregationVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "85%" }]}>
            <Text style={s.modalTitle}>Congregation</Text>

            {/* Search */}
            <TextInput placeholder="Search by city..." value={congregationCitySearch} onChangeText={onCitySearchChange} style={s.authInput} placeholderTextColor={C.textLight} />

            {citySuggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                {citySuggestions.map((sug, idx) => (
                  <Pressable key={`${sug.latitude}-${sug.longitude}-${idx}`} style={s.suggestionItem} onPress={() => { setCongregationCitySearch(sug.displayName.split(",")[0]?.trim() ?? sug.displayName); searchCongregationsByCity(sug); }}>
                    <Text style={s.sectionDesc} numberOfLines={1}>{sug.displayName}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {nearbyLoading && <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />}
            {nearbyError && <Text style={s.errorText}>{nearbyError}</Text>}

            <ScrollView style={{ maxHeight: 240, marginTop: 8 }}>
              {nearbyCongregations.map((cong) => (
                <Pressable key={cong.id} style={s.congListItem} onPress={() => onJoinCongregation(cong.id)}>
                  <Text style={s.congListName}>{cong.name}</Text>
                  <Text style={s.congListCity}>{cong.city}</Text>
                </Pressable>
              ))}
              {nearbyCongregations.length === 0 && !nearbyLoading && (
                <Text style={[s.emptyText, { marginTop: 12 }]}>No congregations found nearby. Create one below!</Text>
              )}
            </ScrollView>

            {/* Create */}
            <View style={s.createCongSection}>
              <Text style={s.sectionTitle}>Create New</Text>
              <TextInput placeholder="Congregation name" value={newCongregationName} onChangeText={setNewCongregationName} style={s.authInput} placeholderTextColor={C.textLight} />
              <Text style={[s.sectionDesc, { marginTop: 4 }]}>City: {cleanCity(currentLocation?.city)}</Text>
              <Pressable style={[s.primaryBtn, actionLoading && s.disabled]} onPress={onCreateCongregation} disabled={actionLoading}>
                <Text style={s.primaryBtnText}>Create and Join</Text>
              </Pressable>
            </View>

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => setJoinCongregationVisible(false)}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── sub-components ────────────────────────────────────────── */

function TabItem({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tabItem, active && s.tabItemActive]} onPress={onPress}>
      <Text style={s.tabIcon}>{icon}</Text>
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function GenderPicker({ value, onChange }: { value: GenderOption | ""; onChange: (next: GenderOption) => void }) {
  return (
    <View style={s.genderWrap}>
      <View style={s.genderRow}>
        {GENDER_OPTIONS.map((opt) => {
          const active = value === opt;
          return (
            <Pressable key={opt} style={[s.genderChip, active && s.genderChipActive]} onPress={() => onChange(opt)}>
              <Text style={[s.genderChipText, active && s.genderChipTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LeaderboardRow({ profile, rank, isCurrentUser }: { profile: UserProfile; rank: number; isCurrentUser?: boolean }) {
  return (
    <View style={[s.leaderRow, isCurrentUser && s.leaderRowHighlight]}>
      <Text style={s.leaderRank}>{rank}</Text>
      <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(profile.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.friendName}>{profile.displayName ?? "Unknown"}{isCurrentUser ? " (You)" : ""}</Text>
        <Text style={s.friendCong}>{profile.congregationId ? "In a congregation" : "No congregation"}</Text>
      </View>
      <View style={s.streakBadges}>
        <View style={s.streakBadge}><Text style={s.streakBadgeText}>🔥 {profile.currentStreak ?? 0}</Text></View>
        <View style={[s.streakBadge, { backgroundColor: C.primaryLight }]}><Text style={[s.streakBadgeText, { color: C.primary }]}>✡️ {profile.tefillinCurrentStreak ?? 0}</Text></View>
      </View>
    </View>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  body: { flex: 1 },
  fullWidth: { width: "100%" },
  disabled: { opacity: 0.5 },

  /* header */
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg },
  headerTitle: { fontSize: 26, fontWeight: "800", color: C.text },
  settingsBtn: { padding: 8 },
  settingsBtnText: { fontSize: 22 },

  /* tab bar */
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg, paddingBottom: 4, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 16 },
  tabItemActive: {},
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: C.textLight, marginTop: 2 },
  tabLabelActive: { color: C.primary, fontWeight: "800" },

  /* tab content */
  tabContent: { paddingHorizontal: 16, paddingBottom: 16 },

  /* home greeting */
  greeting: { fontSize: 24, fontWeight: "800", color: C.text, marginTop: 8 },
  locationText: { fontSize: 14, color: C.textSecondary, marginTop: 2, marginBottom: 16 },

  /* streaks */
  streakRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  streakCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: "center" },
  streakEmoji: { fontSize: 28 },
  streakNumber: { fontSize: 32, fontWeight: "900", color: C.streak, marginTop: 4 },
  streakLabel: { fontSize: 12, fontWeight: "700", color: "#92400E", marginTop: 2 },

  /* section cards */
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionIcon: { fontSize: 28, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  sectionValue: { fontSize: 15, color: C.textSecondary, marginTop: 4 },
  sectionDesc: { fontSize: 13, color: C.textSecondary, marginTop: 6, lineHeight: 18 },

  /* live badge */
  liveBadge: { backgroundColor: C.success, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start", marginTop: 8 },
  liveBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  /* block level */
  blockGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  blockOption: { width: "47%", borderRadius: 16, borderWidth: 2, borderColor: C.border, padding: 12, alignItems: "center" },
  blockOptionActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  blockEmoji: { fontSize: 24 },
  blockTitle: { fontSize: 13, fontWeight: "800", color: C.text, marginTop: 4 },
  blockTitleActive: { color: C.primaryDark },
  blockDesc: { fontSize: 10, color: C.textSecondary, textAlign: "center", marginTop: 2 },
  blockDescActive: { color: C.primaryDark },

  customBlockSection: { marginTop: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12 },
  customBlockTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 4 },

  /* toggle rows */
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: C.text },
  toggleHint: { fontSize: 11, color: C.textLight, marginTop: 1 },

  /* time pickers */
  timeSection: { marginTop: 12 },
  timeSectionTitle: { fontSize: 13, fontWeight: "700", color: C.textSecondary, marginBottom: 8 },
  timePills: { gap: 8 },
  timePill: { borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bg },
  timePillActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  timePillText: { fontSize: 13, fontWeight: "600", color: C.textSecondary },
  timePillTextActive: { color: C.primaryDark, fontWeight: "700" },

  /* buttons */
  primaryBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  primaryBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  outlineBtn: { borderWidth: 2, borderColor: C.primary, borderRadius: 16, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  outlineBtnText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  dangerBtn: { backgroundColor: C.dangerLight, borderRadius: 16, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  dangerBtnText: { color: C.danger, fontSize: 14, fontWeight: "700" },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  ghostBtnText: { color: C.primary, fontWeight: "700", fontSize: 14 },

  /* intent */
  intentInput: { marginTop: 10, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.surface, color: C.text, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80, textAlignVertical: "top", fontSize: 14 },

  /* highlight box */
  highlightBox: { backgroundColor: C.primaryLight, borderRadius: 14, padding: 14, marginTop: 8 },
  highlightText: { fontSize: 13, color: C.primaryDark, lineHeight: 18 },

  /* congregation banner */
  congBanner: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 16, marginHorizontal: 16, borderRadius: 20, marginTop: 8 },
  congBannerName: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  congBannerDetail: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  congBannerActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  congBannerBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  congBannerBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  /* sub-tabs */
  subTabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  subTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface },
  subTabActive: { backgroundColor: C.primary },
  subTabText: { fontSize: 13, fontWeight: "700", color: C.textSecondary },
  subTabTextActive: { color: "#FFF" },

  /* friend / leaderboard rows */
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  friendAvatarText: { fontSize: 16, fontWeight: "800", color: C.primary },
  friendName: { fontSize: 15, fontWeight: "700", color: C.text },
  friendCong: { fontSize: 11, color: C.textLight, marginTop: 1 },

  leaderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  leaderRowHighlight: { backgroundColor: C.primaryLight, marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 12 },
  leaderRank: { fontSize: 16, fontWeight: "800", color: C.textLight, width: 24, textAlign: "center" },

  streakBadges: { flexDirection: "row", gap: 6 },
  streakBadge: { backgroundColor: C.streakBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  streakBadgeText: { fontSize: 12, fontWeight: "700", color: "#92400E" },

  acceptBtn: { backgroundColor: C.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: C.primary, fontWeight: "700", fontSize: 12 },
  rejectBtn: { backgroundColor: C.dangerLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  rejectBtnText: { color: C.danger, fontWeight: "700", fontSize: 12 },

  socialActions: { marginTop: 8, gap: 8 },
  emptyText: { fontSize: 14, color: C.textLight, textAlign: "center", paddingVertical: 20 },
  emptyCentered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },

  /* chat */
  chatList: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 1, justifyContent: "flex-end" },
  chatBubble: { backgroundColor: C.surface, borderRadius: 16, padding: 10, marginBottom: 8, alignSelf: "flex-start", maxWidth: "80%" },
  chatBubbleMine: { backgroundColor: C.primaryLight, alignSelf: "flex-end" },
  chatSender: { fontSize: 11, fontWeight: "700", color: C.primary, marginBottom: 2 },
  chatText: { fontSize: 14, color: C.text },
  chatTextMine: { color: C.primaryDark },
  chatInputRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, gap: 8, backgroundColor: C.bg },
  chatTextInput: { flex: 1, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.text },
  chatSendBtn: { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 20, justifyContent: "center" },
  chatSendBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  /* parasha */
  parashaHeader: { fontSize: 16, fontWeight: "700", color: C.textSecondary, marginTop: 8, marginBottom: 8 },
  parashaCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  parashaIcon: { fontSize: 48, marginBottom: 8 },
  parashaName: { fontSize: 22, fontWeight: "900", color: C.text, textAlign: "center" },
  parashaBookBadge: { backgroundColor: C.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  parashaBookText: { fontSize: 12, fontWeight: "700", color: C.primary },
  parashaSummary: { fontSize: 15, color: C.textSecondary, lineHeight: 22, marginTop: 16, textAlign: "center" },

  /* policy */
  policyRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  policyPill: { borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.bg },
  policyPillActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  policyPillText: { fontSize: 12, fontWeight: "700", color: C.textSecondary },
  policyPillTextActive: { color: C.primary },

  /* congregation modal list */
  congListItem: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  congListName: { fontSize: 15, fontWeight: "700", color: C.text },
  congListCity: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  createCongSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 },
  suggestionsBox: { borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface, marginTop: 4 },
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },

  /* modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", paddingHorizontal: 16 },
  modalCard: { backgroundColor: C.bg, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: C.text },

  /* auth */
  authScroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  authLogoArea: { alignItems: "center", marginBottom: 32 },
  authLogo: { fontSize: 48, marginBottom: 8 },
  authTitle: { fontSize: 28, fontWeight: "900", color: C.primaryDark, letterSpacing: 0.3 },
  authSubtitle: { marginTop: 8, fontSize: 15, color: C.textSecondary },
  authForm: { width: "100%", alignItems: "center", gap: 10 },
  authInput: { width: "100%", borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface, color: C.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  passwordRow: { width: "100%", flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface },
  passwordInput: { flex: 1, color: C.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  passwordToggle: { paddingHorizontal: 14, paddingVertical: 14 },
  passwordToggleText: { color: C.primary, fontWeight: "700", fontSize: 13 },
  authMethodToggle: { flexDirection: "row", width: "100%", borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: "hidden" },
  authMethodTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  authMethodTabActive: { backgroundColor: C.primary },
  authMethodTabText: { color: C.text, fontWeight: "600", fontSize: 14 },
  authMethodTabTextActive: { color: "#FFF", fontWeight: "700" },
  authDivider: { flexDirection: "row", alignItems: "center", width: "100%", marginVertical: 8 },
  authDividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  authDividerText: { marginHorizontal: 12, color: C.textLight, fontSize: 12 },
  authSocialRow: { flexDirection: "row", gap: 12, width: "100%" },
  authSocialBtn: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  authSocialBtnText: { color: C.text, fontWeight: "700", fontSize: 14 },
  authBack: { alignSelf: "flex-start", marginBottom: 12, paddingVertical: 4 },
  authBackText: { color: C.primary, fontWeight: "700", fontSize: 15 },
  authLink: { alignSelf: "flex-end", paddingVertical: 2 },
  authLinkText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  authFooter: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  authFooterText: { color: C.textSecondary, fontSize: 14 },
  authFooterLink: { color: C.primary, fontSize: 14, fontWeight: "700" },

  /* error */
  errorText: { marginTop: 8, color: C.danger, textAlign: "center", fontSize: 13 },

  /* gender picker */
  genderWrap: { width: "100%", marginTop: 4 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderChip: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingVertical: 12, alignItems: "center" },
  genderChipActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  genderChipText: { color: C.text, fontWeight: "600", fontSize: 14 },
  genderChipTextActive: { color: C.primaryDark, fontWeight: "700" },
});
