import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
  checkAndBreakStaleStreaks,
  completeCongregationOnboarding,
  recordBrokenShabbatWeek,
  recordKeptShabbatWeek,
  setUserCongregation,
  updateUserProfile,
  saveIntentEntry,
  getIntentHistory,
} from "./src/firebase/firestore";
import { useShabbatTimes } from "./src/hooks/useShabbatTimes";
import { useShabbatMode } from "./src/hooks/useShabbatMode";
import { getCurrentLocation } from "./src/location/locationService";
import {
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
  searchCongregationsByCity as searchCongregationsByCityName,
  setCongregationJoinPolicy,
  transferLeadership,
} from "./src/congregation/congregationService";
import {
  Congregation,
  NearbyCongregation,
} from "./src/congregation/congregationTypes";
import {
  searchByFriendCode,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriendProfiles,
} from "./src/friends/friendsService";
import {
  addTefillinBuddy,
  removeTefillinBuddy,
  getTefillinBuddyProfiles,
} from "./src/friends/buddyService";
import { getParashaInfo, getChabadParashaUrl } from "./src/parasha/parashaData";
import {
  sendCongregationMessage,
  subscribeToCongregationMessages,
  type CongregationMessage,
} from "./src/congregation/congregationMessages";
import {
  sendDirectMessage,
  subscribeToDirectMessages,
  type DirectMessage,
} from "./src/friends/directMessages";
import {
  getUserBuddyChats,
  subscribeToUserBuddyChats,
  sendBuddyMessage,
  subscribeToBuddyMessages,
  uploadBuddyImage,
  markMessageOpened,
  createBuddyChat,
  addGroupMember,
  removeGroupMember,
  getTodayStreakStatus,
  saveMessageToChat,
  purgeExpiredMessages,
} from "./src/friends/buddyChatService";
import { BuddyChat, BuddyMessage } from "./src/friends/buddyChatTypes";
import { getCachedZmanim, getSunWindowMessage } from "./src/friends/zmanimService";
import { evaluateAllStreaks } from "./src/friends/streakEvaluator";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";

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

/* ─── camera icon component ────────────────────────────────── */

function CameraIcon({ size = 22, color = "#FFF" }: { size?: number; color?: string }) {
  const body = size;
  const bodyH = body * 0.68;
  const lens = body * 0.34;
  const topW = body * 0.36;
  const topH = body * 0.18;
  const bw = Math.max(1.5, size * 0.09);
  return (
    <View style={{ width: body, height: body, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", top: bodyH * 0.08, width: topW, height: topH, borderWidth: bw, borderColor: color, borderRadius: bw * 2, backgroundColor: "transparent" }} />
      <View style={{ width: body, height: bodyH, borderWidth: bw, borderColor: color, borderRadius: body * 0.2, backgroundColor: "transparent", alignItems: "center", justifyContent: "center", marginTop: topH * 0.6 }}>
        <View style={{ width: lens, height: lens, borderWidth: bw, borderColor: color, borderRadius: lens / 2, backgroundColor: "transparent" }} />
      </View>
    </View>
  );
}

/* ─── types ──────────────────────────────────────────────────── */

type TabKey = "home" | "social" | "parasha";
type SocialSubTab = "friends" | "chat" | "dm" | "buddyChat" | "groupCreate";
type BlockLevel = "full" | "medium" | "custom" | "none";
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

type CommonApp = {
  id: string;
  name: string;
  category: string;
};

/* ─── constants ──────────────────────────────────────────────── */

const RESTRICTIONS_KEY = "restrictions:v1";
const SHABBAT_UI_STATE_KEY = "shabbatUiState:v1";
const BLOCK_LEVEL_KEY = "blockLevel:v1";
const CUSTOM_APP_BLOCKS_KEY = "customAppBlocks:v1";
const INTENT_HISTORY_KEY = "intentHistory:v1";
const TEFILLIN_DATE_KEY_PREFIX = "tefillinConfirmedDay:v2:";
const TEFILLIN_IGNORE_KEY_PREFIX = "tefillinPromptIgnored:v1:";
const HOLIDAY_OPTIN_KEY = "holidayOptIn:v1";


const generateTimes = (startH: number, endH: number): string[] => {
  const times: string[] = [];
  for (let h = startH; h <= endH; h++) {
    for (let m = 0; m < 60; m += 5) {
      const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ap = h >= 12 && h < 24 ? "PM" : "AM";
      times.push(`${hr}:${m.toString().padStart(2, "0")} ${ap}`);
    }
  }
  return times;
};

const WAKE_TIMES = generateTimes(4, 11);
const BED_TIMES = generateTimes(19, 24);

const COMMON_APPS: CommonApp[] = [
  { id: "instagram", name: "Instagram", category: "Social" },
  { id: "tiktok", name: "TikTok", category: "Social" },
  { id: "snapchat", name: "Snapchat", category: "Social" },
  { id: "facebook", name: "Facebook", category: "Social" },
  { id: "twitter", name: "X (Twitter)", category: "Social" },
  { id: "reddit", name: "Reddit", category: "Social" },
  { id: "threads", name: "Threads", category: "Social" },
  { id: "bereal", name: "BeReal", category: "Social" },
  { id: "youtube", name: "YouTube", category: "Streaming" },
  { id: "netflix", name: "Netflix", category: "Streaming" },
  { id: "hulu", name: "Hulu", category: "Streaming" },
  { id: "spotify", name: "Spotify", category: "Streaming" },
  { id: "hbomax", name: "Max (HBO)", category: "Streaming" },
  { id: "disney", name: "Disney+", category: "Streaming" },
  { id: "twitch", name: "Twitch", category: "Streaming" },
  { id: "appletv", name: "Apple TV+", category: "Streaming" },
  { id: "roblox", name: "Roblox", category: "Games" },
  { id: "minecraft", name: "Minecraft", category: "Games" },
  { id: "candycrush", name: "Candy Crush", category: "Games" },
  { id: "clashroyale", name: "Clash Royale", category: "Games" },
  { id: "clashofclans", name: "Clash of Clans", category: "Games" },
  { id: "brawlstars", name: "Brawl Stars", category: "Games" },
  { id: "fortnite", name: "Fortnite", category: "Games" },
  { id: "whatsapp", name: "WhatsApp", category: "Messaging" },
  { id: "telegram", name: "Telegram", category: "Messaging" },
  { id: "discord", name: "Discord", category: "Messaging" },
  { id: "gmail", name: "Gmail", category: "Productivity" },
  { id: "slack", name: "Slack", category: "Productivity" },
  { id: "safari", name: "Safari", category: "Browser" },
  { id: "chrome", name: "Chrome", category: "Browser" },
  { id: "amazon", name: "Amazon", category: "Shopping" },
  { id: "uber", name: "Uber", category: "Other" },
  { id: "doordash", name: "DoorDash", category: "Other" },
];

const DAILY_INFO: Record<string, { title: string; explanation: string }> = {
  tefillin: {
    title: "Why Wrap Tefillin?",
    explanation:
      "We wrap tefillin to connect our mind and heart to God, symbolizing that our thoughts and emotions should be guided by Him. The act also serves as a daily reminder to live with intention, purpose, and meaning.",
  },
  modehAni: {
    title: "Why Say Modeh Ani?",
    explanation:
      "We say Modeh Ani each morning to thank God for returning our soul to us after sleep. It helps us begin the day with gratitude and awareness of the gift of being alive.",
  },
  shema: {
    title: "Why Say Shema Before Bed?",
    explanation:
      "We say the Shema to declare that we believe in one God and accept unity. It also expresses our commitment to love God with all our heart, soul, and strength.",
  },
};

const PRAYER_TEXTS = {
  modehAni: {
    hebrew: "מוֹדֶה אֲנִי לְפָנֶיךָ מֶלֶךְ חַי וְקַיָּם, שֶׁהֶחֱזַרְתָּ בִּי נִשְׁמָתִי בְּחֶמְלָה, רַבָּה אֱמוּנָתֶךָ.",
    english: "I gratefully thank You, living and eternal King, for You have returned my soul within me with compassion — abundant is Your faithfulness.",
  },
  shema: {
    hebrew: "שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד.\nבָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד.",
    english: "Hear, O Israel: The Lord is our God, the Lord is One.\nBlessed is the name of His glorious kingdom forever and ever.",
  },
};

const RABBI_QUOTES: string[] = [
  "The world stands on three things: Torah, prayer, and acts of kindness. — Pirkei Avot 1:2",
  "Who is rich? One who is happy with what they have. — Pirkei Avot 4:1",
  "In a place where there are no men, strive to be a man. — Pirkei Avot 2:5",
  "If I am not for myself, who will be for me? But if I am only for myself, what am I? — Hillel",
  "The day is short, the work is great. — Pirkei Avot 2:15",
  "Do not judge your fellow until you have reached their place. — Pirkei Avot 2:4",
  "It is not upon you to finish the work, but neither are you free to desist from it. — Pirkei Avot 2:16",
  "Every person has their hour. — Pirkei Avot 4:3",
  "Who is wise? One who learns from every person. — Pirkei Avot 4:1",
  "Pray as if everything depends on God. Act as if everything depends on you. — attributed to the Rebbe",
  "A little bit of light dispels a lot of darkness. — Rebbe Menachem Mendel Schneerson",
  "The Baal Shem Tov taught: your fellow is your mirror. What you see in them reflects what is in you.",
  "Where there is love, there is no question. Where there is a question, there is no love. — Rebbe Menachem Mendel of Kotzk",
  "The purpose of creation is to bring heaven down to earth. — Rebbe Menachem Mendel Schneerson",
  "We are not expected to be perfect. We are expected to try. — Rabbi Jonathan Sacks",
  "Tefillin: binding the mind and heart to God. Keep wrapping, keep connecting.",
  "Deed, not creed, is what matters most. — Rabbi Abraham Joshua Heschel",
  "When you put on tefillin, you are crowning God as King over your thoughts, emotions, and actions.",
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

const BLOCK_INFO: Record<BlockLevel, { title: string; desc: string }> = {
  full: { title: "Full Block", desc: "Block all apps during Shabbat and grow your streak!" },
  medium: { title: "Medium", desc: "Block social media & games. Start reclaiming your Shabbat." },
  custom: { title: "Custom", desc: "Choose exactly which apps to block during Shabbat." },
  none: { title: "No Block", desc: "No apps blocked. Your streak will not grow." },
};

/* ─── helpers ────────────────────────────────────────────────── */

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatTime24 = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

const to24h = (time: string): string => {
  const raw = (time ?? "07:00").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (!match) return "07:00";
  let h = Number(match[1]);
  const m = Number(match[2]);
  const ap = match[3].toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const addMinutesToTimeStr = (time: string, mins: number): string => {
  const normalized = to24h(time);
  const [hStr, mStr] = normalized.split(":");
  const total = Number(hStr) * 60 + Number(mStr) + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
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

const todayDateStr = (): string => new Date().toISOString().slice(0, 10);
const tefillinDateKey = (uid: string): string => `${TEFILLIN_DATE_KEY_PREFIX}${uid}`;
const tefillinIgnoreKey = (uid: string): string => `${TEFILLIN_IGNORE_KEY_PREFIX}${uid}`;

const getPastShabbatDates = (count: number): string[] => {
  const dates: string[] = [];
  const now = new Date();
  let d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d = new Date(d);
    d.setDate(d.getDate() - 7);
  }
  return dates;
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
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPhoneCode, setSignupPhoneCode] = useState("");
  const [signupPhoneConfirmation, setSignupPhoneConfirmation] = useState<PhoneAuthConfirmation | null>(null);
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false);
  const [pendingSignupData, setPendingSignupData] = useState<{ name: string } | null>(null);
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
  const [settingsVisible, setSettingsVisible] = useState(false);

  /* ── shabbat / restrictions ── */
  const [restrictions, setRestrictions] = useState<RestrictionSetting[]>(defaultRestrictions);
  const [shabbatUiState, setShabbatUiState] = useState<ShabbatUiState>(defaultShabbatUiState);
  const [blockLevel, setBlockLevel] = useState<BlockLevel>("none");
  const [customAppBlocks, setCustomAppBlocks] = useState<Record<string, boolean>>({});
  const [intentDraft, setIntentDraft] = useState("");
  const [savedIntentText, setSavedIntentText] = useState("");
  const [intentModalVisible, setIntentModalVisible] = useState(false);

  /* ── intent calendar ── */
  const [intentHistory, setIntentHistory] = useState<Record<string, string>>({});
  const [showIntentCalendar, setShowIntentCalendar] = useState(false);
  const [selectedPastDate, setSelectedPastDate] = useState<string | null>(null);

  /* ── holiday opt-in ── */
  const [holidayOptIn, setHolidayOptIn] = useState(false);

  /* ── tefillin daily ── */
  const [_tefillinConfirmedToday, setTefillinConfirmedToday] = useState(false);
  const [soloTefillinPromptVisible, setSoloTefillinPromptVisible] = useState(false);
  const [appForegroundTick, setAppForegroundTick] = useState(0);

  /* ── daily info ── */
  const [showDailyInfo, setShowDailyInfo] = useState<string | null>(null);

  /* ── prayer overlay ── */
  const [showPrayerOverlay, setShowPrayerOverlay] = useState(false);
  const [prayerOverlayType, setPrayerOverlayType] = useState<"modehAni" | "shema" | null>(null);

  /* ── break shabbat confirmation ── */
  const [showBreakConfirm, setShowBreakConfirm] = useState(false);

  /* ── congregation settings ── */
  const [congregationSettingsVisible, setCongregationSettingsVisible] = useState(false);

  /* ── congregation ── */
  const [nearbyCongregations, setNearbyCongregations] = useState<NearbyCongregation[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [newCongregationName, setNewCongregationName] = useState("");
  const [newCongregationCity, setNewCongregationCity] = useState("");
  const [newCongCitySuggestions, setNewCongCitySuggestions] = useState<GeocodingResult[]>([]);
  const [newCongGeo, setNewCongGeo] = useState<GeocodingResult | null>(null);
  const newCongCityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [friendCodeQuery, setFriendCodeQuery] = useState("");
  const [friendCodeResult, setFriendCodeResult] = useState<UserProfile | null>(null);
  const [friendSearching, setFriendSearching] = useState(false);
  const [friendCodeError, setFriendCodeError] = useState("");

  /* ── chat ── */
  const [chatMessages, setChatMessages] = useState<CongregationMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  /* ── direct messages ── */
  const [chattingWith, setChattingWith] = useState<UserProfile | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState("");

  /* ── tefillin buddies ── */
  const [showBuddyInfo, setShowBuddyInfo] = useState(false);
  const [buddyActionLoading, setBuddyActionLoading] = useState(false);

  /* ── buddy chat ── */
  const [buddyChats, setBuddyChats] = useState<BuddyChat[]>([]);
  const [activeBuddyChat, setActiveBuddyChat] = useState<BuddyChat | null>(null);
  const [buddyChatMessages, setBuddyChatMessages] = useState<BuddyMessage[]>([]);
  const [buddyChatInput, setBuddyChatInput] = useState("");
  const [buddyChatImageLoading, setBuddyChatImageLoading] = useState(false);
  const [sunBlockedMessage, setSunBlockedMessage] = useState<string | null>(null);
  const [showBuddyQuotes, setShowBuddyQuotes] = useState(false);
  const [buddyChatViewportHeight, setBuddyChatViewportHeight] = useState(0);

  /* ── group buddy chat ── */
  const [groupCreateSelectedUids, setGroupCreateSelectedUids] = useState<string[]>([]);
  const [groupCreateName, setGroupCreateName] = useState("");
  const [groupCreateLoading, setGroupCreateLoading] = useState(false);
  const [groupDailyStatus, setGroupDailyStatus] = useState<{ sent: string[]; notSent: string[] } | null>(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);

  /* ── friend congregation name cache ── */
  const [friendCongregationNames, setFriendCongregationNames] = useState<Record<string, string>>({});

  /* ── friend profile modal ── */
  const [viewingFriend, setViewingFriend] = useState<UserProfile | null>(null);

  /* ── streak evaluation guard (once per app session) ── */
  const streakEvalDone = useRef(false);
  const buddyChatListRef = useRef<FlatList<BuddyMessage> | null>(null);
  const buddyChatShouldSnapRef = useRef(false);

  /* ── animation ── */
  const tabContentAnim = useRef(new Animated.Value(1)).current;
  const breakResolveRef = useRef<((result: "ABORT" | "PROCEED") => void) | null>(null);

  /* ── hooks ── */
  const { shabbatTimes, loading: timesLoading, error: timesError, refresh: refreshTimes } = useShabbatTimes();
  const { status: modeStatus, isActive: isModeActive, start: startMode, end: endMode, breakShabbat } = useShabbatMode();

  const weekId = useMemo(() => {
    const existing = getCurrentWeekId();
    if (existing) return existing;
    if (shabbatTimes) return `week-${shabbatTimes.shabbatStart.toISOString().slice(0, 10)}`;
    return `week-${new Date().toISOString().slice(0, 10)}`;
  }, [shabbatTimes]);

  const currentWeekDate = useMemo(() => {
    return shabbatTimes?.shabbatStart?.toISOString().slice(0, 10) ?? todayDateStr();
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

  const hasCustomAppsBlocked = useMemo(() => {
    return Object.values(customAppBlocks).some((v) => v);
  }, [customAppBlocks]);

  const effectiveBlockLevel = useMemo((): BlockLevel => {
    if (blockLevel === "custom" && !hasCustomAppsBlocked) return "none";
    return blockLevel;
  }, [blockLevel, hasCustomAppsBlocked]);

  const isStreakEligible = effectiveBlockLevel !== "none";
  const tefillinBuddyUids = useMemo(() => user?.tefillinBuddyUids ?? [], [user?.tefillinBuddyUids]);
  const hasTefillinBuddies = tefillinBuddyUids.length > 0;

  const displayTefillinStreak = useMemo(() => {
    if (buddyChats.length > 0) {
      const chatStreaks = buddyChats.map((c) => c.streakCount);
      if (chatStreaks.length > 0) {
        return Math.max(user?.tefillinCurrentStreak ?? 0, ...chatStreaks);
      }
    }
    return user?.tefillinCurrentStreak ?? 0;
  }, [buddyChats, user?.tefillinCurrentStreak]);

  const buddyChatSavedPeekOnly = useMemo(() => {
    if (!user || buddyChatMessages.length === 0) return false;
    return buddyChatMessages.every((message) => message.savedByUids?.includes(user.uid));
  }, [buddyChatMessages, user]);

  const buddyChatPeekHeight = useMemo(() => {
    if (!buddyChatSavedPeekOnly) return 0;
    return Math.max(buddyChatViewportHeight, 180);
  }, [buddyChatSavedPeekOnly, buddyChatViewportHeight]);

  const queueBuddyChatSnapToBottom = useCallback(() => {
    buddyChatShouldSnapRef.current = true;
  }, []);

  const flushBuddyChatSnapToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      buddyChatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const getSoloTefillinPromptDay = useCallback(async (): Promise<string> => {
    const lat = user?.latitude ?? currentLocation?.latitude;
    const lon = user?.longitude ?? currentLocation?.longitude;
    const tzid = user?.timeZone ?? currentLocation?.timezone ?? "UTC";
    if (lat == null || lon == null) {
      return todayDateStr();
    }
    try {
      const { sunrise } = await getCachedZmanim(lat, lon, tzid);
      const now = new Date();
      if (now >= sunrise) {
        return todayDateStr();
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().slice(0, 10);
    } catch {
      return todayDateStr();
    }
  }, [
    currentLocation?.latitude,
    currentLocation?.longitude,
    currentLocation?.timezone,
    user?.latitude,
    user?.longitude,
    user?.timeZone,
  ]);

  const refreshSoloTefillinPrompt = useCallback(async () => {
    if (!user) {
      setTefillinConfirmedToday(false);
      setSoloTefillinPromptVisible(false);
      return;
    }
    if (hasTefillinBuddies) {
      setTefillinConfirmedToday(false);
      setSoloTefillinPromptVisible(false);
      return;
    }
    const promptDay = await getSoloTefillinPromptDay();
    const [answeredDay, ignored] = await Promise.all([
      AsyncStorage.getItem(tefillinDateKey(user.uid)),
      AsyncStorage.getItem(tefillinIgnoreKey(user.uid)),
    ]);
    const confirmed = answeredDay === promptDay;
    setTefillinConfirmedToday(confirmed);
    setSoloTefillinPromptVisible(!confirmed && ignored !== "true");
  }, [getSoloTefillinPromptDay, hasTefillinBuddies, user]);

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

  const saveCustomAppBlocks = useCallback(async (next: Record<string, boolean>) => {
    setCustomAppBlocks(next);
    await AsyncStorage.setItem(CUSTOM_APP_BLOCKS_KEY, JSON.stringify(next));
  }, []);

  const saveIntentHistoryEntry = useCallback(async (weekDate: string, text: string) => {
    if (!user) return;
    setIntentHistory((prev) => ({ ...prev, [weekDate]: text }));
    await saveIntentEntry(user.uid, weekDate, text);
  }, [user]);

  /* ── effects ── */
  useEffect(() => {
    const loadLocal = async () => {
      const [rawR, rawU, rawB, rawCab, rawHO] = await Promise.all([
        AsyncStorage.getItem(RESTRICTIONS_KEY),
        AsyncStorage.getItem(SHABBAT_UI_STATE_KEY),
        AsyncStorage.getItem(BLOCK_LEVEL_KEY),
        AsyncStorage.getItem(CUSTOM_APP_BLOCKS_KEY),
        AsyncStorage.getItem(HOLIDAY_OPTIN_KEY),
      ]);
      if (rawR) { try { setRestrictions(JSON.parse(rawR)); } catch { /* use defaults */ } }
      if (rawU) { try { setShabbatUiState(JSON.parse(rawU)); } catch { /* use defaults */ } }
      if (rawB && ["full", "medium", "custom", "none"].includes(rawB)) setBlockLevel(rawB as BlockLevel);
      if (rawCab) { try { setCustomAppBlocks(JSON.parse(rawCab)); } catch { /* use defaults */ } }
      if (rawHO === "true") setHolidayOptIn(true);
      AsyncStorage.removeItem("tefillinBuddies:v1").catch(() => {});
    };
    loadLocal().catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setAppForegroundTick((tick) => tick + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setAuthLoading(false);
      if (profile) {
        setProfileName(profile.displayName ?? "");
        if (isEmailProvider() && !isCurrentUserEmailVerified()) setPendingEmailVerification(true);
        else setPendingEmailVerification(false);
        checkAndBreakStaleStreaks(profile.uid).then((updated) => {
          if (updated) setUser(updated);
        }).catch(() => {});
        getIntentHistory(profile.uid).then((history) => {
          setIntentHistory(history);
        }).catch(() => {});
      } else {
        setPendingEmailVerification(false);
        setIntentHistory({});
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    checkAndBreakStaleStreaks(user.uid).then((updated) => {
      if (updated) setUser(updated);
    }).catch(() => {});
  }, [appForegroundTick, user]);

  useEffect(() => {
    refreshSoloTefillinPrompt().catch(() => {});
  }, [appForegroundTick, refreshSoloTefillinPrompt]);

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
        breakResolveRef.current = resolve;
        setShowBreakConfirm(true);
      });
    });
    return () => clearIntentFlowHandler();
  }, [user?.shabbatIntentText]);

  useEffect(() => {
    if (!user) return;
    const thisWeekIntent = intentHistory[currentWeekDate];
    if (thisWeekIntent) {
      setSavedIntentText(thisWeekIntent);
      setIntentDraft(thisWeekIntent);
    } else if (user.shabbatIntentText) {
      setIntentDraft(user.shabbatIntentText);
      setSavedIntentText("");
    } else {
      setIntentDraft("");
      setSavedIntentText("");
    }
  }, [user?.uid, currentWeekDate, intentHistory]);

  /* ── load location & congregations ── */
  const loadLocationAndCongregations = useCallback(async () => {
    if (!user) return;
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      if (location.city) {
        setCity(location.city);
        setNewCongregationCity(cleanCity(location.city));
      }

      if (user.latitude == null || user.longitude == null) {
        updateUserProfile(user.uid, {
          latitude: location.latitude,
          longitude: location.longitude,
        }).then((updated) => setUser(updated)).catch(() => {});
      }

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

  /* ── load friend congregation names ── */
  useEffect(() => {
    if (friends.length === 0) return;
    const congIds = [...new Set(friends.map((f) => f.congregationId).filter((id): id is string => Boolean(id)))];
    if (congIds.length === 0) return;
    const fetchNames = async () => {
      const names: Record<string, string> = {};
      await Promise.all(
        congIds.map(async (id) => {
          try {
            const cong = await getCongregationById(id);
            if (cong) names[id] = cong.name;
          } catch {}
        })
      );
      setFriendCongregationNames(names);
    };
    fetchNames();
  }, [friends]);

  /* ── chat subscription ── */
  useEffect(() => {
    if (!user?.congregationId || socialSubTab !== "chat") return;
    const unsubscribe = subscribeToCongregationMessages(user.congregationId, setChatMessages);
    return () => unsubscribe();
  }, [user?.congregationId, socialSubTab]);

  /* ── direct message subscription ── */
  useEffect(() => {
    if (!user || !chattingWith || socialSubTab !== "dm") return;
    setDmMessages([]);
    const unsubscribe = subscribeToDirectMessages(user.uid, chattingWith.uid, setDmMessages);
    return () => unsubscribe();
  }, [user, chattingWith, socialSubTab]);

  /* ── load buddy chats ── */
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserBuddyChats(user.uid, setBuddyChats);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeBuddyChat) return;
    const updated = buddyChats.find((chat) => chat.id === activeBuddyChat.id);
    if (updated && updated !== activeBuddyChat) {
      setActiveBuddyChat(updated);
    }
  }, [activeBuddyChat, buddyChats]);

  /* ── streak evaluation (runs once per app session after auth) ── */
  useEffect(() => {
    if (!user || streakEvalDone.current) return;
    if (user.buddyChatIds.length === 0) return;
    streakEvalDone.current = true;
    evaluateAllStreaks(user.uid)
      .then(() => {
        getUserBuddyChats(user.uid)
          .then(setBuddyChats)
          .catch(() => {});
        getUserProfile(user.uid).then((updated) => {
          if (updated) setUser(updated);
        }).catch(() => {});
      })
      .catch(() => {});
  }, [user]);

  /* ── buddy chat message subscription ── */
  useEffect(() => {
    if (!activeBuddyChat || socialSubTab !== "buddyChat") return;
    setBuddyChatMessages([]);
    const unsubscribe = subscribeToBuddyMessages(activeBuddyChat.id, setBuddyChatMessages);
    return () => unsubscribe();
  }, [activeBuddyChat, socialSubTab]);

  useEffect(() => {
    if (socialSubTab === "buddyChat" && activeBuddyChat) {
      queueBuddyChatSnapToBottom();
    }
  }, [activeBuddyChat?.id, socialSubTab, queueBuddyChatSnapToBottom]);

  /* ── check sun window when entering buddy chat ── */
  useEffect(() => {
    if (socialSubTab !== "buddyChat" || !activeBuddyChat || !currentLocation) {
      setSunBlockedMessage(null);
      return;
    }
    getSunWindowMessage(currentLocation.latitude, currentLocation.longitude, currentLocation.timezone)
      .then(setSunBlockedMessage)
      .catch(() => setSunBlockedMessage(null));
  }, [socialSubTab, activeBuddyChat, currentLocation]);

  /* ── group daily streak status ── */
  useEffect(() => {
    if (socialSubTab !== "buddyChat" || !activeBuddyChat || activeBuddyChat.type !== "group") {
      setGroupDailyStatus(null);
      return;
    }
    getTodayStreakStatus(activeBuddyChat.id, activeBuddyChat.memberUids)
      .then(setGroupDailyStatus)
      .catch(() => setGroupDailyStatus(null));
  }, [socialSubTab, activeBuddyChat, buddyChatMessages]);

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
    const email = signupEmail.trim();
    if (!name) { setAuthError("Please enter your name."); return; }
    if (!email) { setAuthError("Please enter your email."); return; }
    if (!signupPassword) { setAuthError("Please enter a password."); return; }
    if (signupPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    if (signupPassword !== signupConfirmPassword) { setAuthError("Passwords do not match."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      const profile = await registerWithEmailPassword({ email, password: signupPassword });
      setUser({ ...profile, displayName: name });
      setPendingSignupData({ name });
      await sendVerification();
      setResendCooldown(60);
      setPendingEmailVerification(true);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to create account."));
    } finally {
      setActionLoading(false);
    }
  }, [signupConfirmPassword, signupEmail, signupName, signupPassword]);

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
  }, [signupName, signupPhone]);

  const onPressSignupVerifyPhoneCode = useCallback(async () => {
    if (!signupPhoneConfirmation) { setAuthError("Please request a verification code first."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      await confirmPhoneSignUp({ confirmation: signupPhoneConfirmation, code: signupPhoneCode });
      const profile = await createProfileAfterVerification({ displayName: signupName.trim(), gender: "" });
      setUser(profile);
      setSignupPhoneConfirmation(null);
      setSignupPhoneCode("");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to verify code."));
    } finally {
      setActionLoading(false);
    }
  }, [signupName, signupPhoneCode, signupPhoneConfirmation]);

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
          const profile = await createProfileAfterVerification({ displayName: pendingSignupData.name, gender: "" });
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
  const onBreakShabbatNow = useCallback(async () => {
    if (!user) return;
    setShowBreakConfirm(false);
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

  const onCancelBreak = useCallback(() => {
    setShowBreakConfirm(false);
    if (breakResolveRef.current) {
      breakResolveRef.current("ABORT");
      breakResolveRef.current = null;
    }
  }, []);

  const onConfirmBreak = useCallback(() => {
    if (breakResolveRef.current) {
      breakResolveRef.current("PROCEED");
      breakResolveRef.current = null;
    }
    setShowBreakConfirm(false);
  }, []);

  /* ── profile callbacks ── */
  const onSaveProfile = useCallback(async () => {
    if (!user) return;
    const nextName = profileName.trim();
    if (!nextName) { Alert.alert("Profile", "Name is required."); return; }
    setActionLoading(true);
    try {
      if (user.uid.startsWith("dev-local-")) {
        setUser((prev) => prev ? { ...prev, displayName: nextName } : prev);
        return;
      }
      try {
        const updated = await withTimeout(updateUserProfile(user.uid, { displayName: nextName }), 6000, "Profile save timed out.");
        setUser(updated);
      } catch {
        setUser((prev) => prev ? { ...prev, displayName: nextName } : prev);
      }
    } finally {
      setActionLoading(false);
    }
  }, [profileName, user]);

  /* ── reminder callbacks ── */
  const onToggleMorningReminder = useCallback(async () => {
    if (!user || !shabbatTimes) return;
    const next = !user.wantsMorningReminders;
    setActionLoading(true);
    try {
      if (next) {
        const tefillinTime = addMinutesToTimeStr(user.wakeUpTime ?? "07:00", 15);
        await scheduleNextReminder({ type: ReminderType.TEFILLIN, enabled: true, time: tefillinTime, title: "Tefillin reminder", body: "Time to wrap tefillin!" }, shabbatTimes);
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
    if (!user || !shabbatTimes) return;
    const next = !user.wantsModehAniReminder;
    setActionLoading(true);
    try {
      if (next) {
        await scheduleNextReminder({ type: ReminderType.MODEH_ANI, enabled: true, time: to24h(user.wakeUpTime ?? "07:00"), title: "Modeh Ani", body: "Start your day with gratitude — say Modeh Ani." }, shabbatTimes);
      } else {
        await cancelReminder(ReminderType.MODEH_ANI);
      }
      const updated = await updateUserProfile(user.uid, { wantsModehAniReminder: next });
      setUser(updated);
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [shabbatTimes, user]);

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
      if (shabbatTimes) {
        if (updated.wantsModehAniReminder) {
          await scheduleNextReminder({ type: ReminderType.MODEH_ANI, enabled: true, time: to24h(time), title: "Modeh Ani", body: "Start your day with gratitude — say Modeh Ani." }, shabbatTimes);
        }
        if (updated.wantsMorningReminders) {
          const tefillinTime = addMinutesToTimeStr(time, 15);
          await scheduleNextReminder({ type: ReminderType.TEFILLIN, enabled: true, time: tefillinTime, title: "Tefillin reminder", body: "Time to wrap tefillin!" }, shabbatTimes);
        }
      }
    } catch { /* keep going */ }
  }, [shabbatTimes, user]);

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
      setSavedIntentText(text);
      await saveIntentHistoryEntry(currentWeekDate, text);
      await saveShabbatUiState({ ...shabbatUiState, lastIntentPromptWeekId: weekId });
      setIntentModalVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [intentDraft, currentWeekDate, saveIntentHistoryEntry, saveShabbatUiState, shabbatUiState, user, weekId]);

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

  /* ── tefillin confirmation ── */
  const onConfirmTefillin = useCallback(async () => {
    if (!user) return;
    const promptDay = await getSoloTefillinPromptDay();
    setTefillinConfirmedToday(true);
    setSoloTefillinPromptVisible(false);
    await AsyncStorage.setItem(tefillinDateKey(user.uid), promptDay);
    try {
      const fresh = await getUserProfile(user.uid);
      if (!fresh || fresh.lastTefillinDate === promptDay) return;
      const nextStreak = fresh.tefillinCurrentStreak + 1;
      const updated = await updateUserProfile(user.uid, {
        tefillinCurrentStreak: nextStreak,
        tefillinLongestStreak: Math.max(fresh.tefillinLongestStreak, nextStreak),
        lastTefillinDate: promptDay,
      });
      setUser(updated);
    } catch { /* keep going */ }
  }, [getSoloTefillinPromptDay, user]);

  const onDeclineTefillinPrompt = useCallback(() => {
    setSoloTefillinPromptVisible(false);
  }, []);

  const onIgnoreTefillinPrompt = useCallback(async () => {
    if (!user) return;
    setSoloTefillinPromptVisible(false);
    await AsyncStorage.setItem(tefillinIgnoreKey(user.uid), "true");
  }, [user]);

  /* ── holiday opt-in ── */
  const onToggleHolidayOptIn = useCallback(async (val: boolean) => {
    setHolidayOptIn(val);
    await AsyncStorage.setItem(HOLIDAY_OPTIN_KEY, String(val));
  }, []);

  /* ── save intention inline ── */
  const onSaveIntentInline = useCallback(async () => {
    if (!user) return;
    const text = intentDraft.trim();
    if (!text) return;
    const updated = await updateUserProfile(user.uid, { shabbatIntentText: text });
    setUser(updated);
    setSavedIntentText(text);
    await saveIntentHistoryEntry(currentWeekDate, text);
    Alert.alert("Saved", "Your intention has been saved for this week.");
  }, [intentDraft, currentWeekDate, saveIntentHistoryEntry, user]);

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
        const congregation = await getCongregationById(congregationId);
        if (congregation) {
          setCurrentCongregation(congregation);
          setCurrentCongregationName(congregation.name);
          const members = await listCongregationMembers(congregationId);
          setCongregationMembers(members);
          const pending = await Promise.all(congregation.pendingUids.map((uid) => getUserProfile(uid)));
          setPendingMembers(pending.filter((p): p is UserProfile => Boolean(p)));
        }
      } else {
        Alert.alert("Request sent", "The leader needs to approve your request.");
      }
      await completeCongregationOnboarding(user.uid);
      setJoinCongregationVisible(false);
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const onLeaveCongregation = useCallback(async () => {
    if (!user?.congregationId) return;
    setActionLoading(true);
    try {
      await leaveCongregationAsUser(user.congregationId, user.uid);
      const profile = await getUserProfile(user.uid);
      if (profile) setUser(profile);
      setCurrentCongregation(null);
      setCurrentCongregationName(null);
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
    const cityValue = newCongregationCity.trim() || cleanCity(currentLocation.city);
    if (!cityValue || cityValue === "Unknown city") { Alert.alert("Missing info", "Please enter a city name."); return; }
    setActionLoading(true);
    try {
      const lat = newCongGeo?.latitude ?? currentLocation.latitude;
      const lon = newCongGeo?.longitude ?? currentLocation.longitude;
      const congregation = await createCongregation({ name, city: cityValue, latitude: lat, longitude: lon, timezone: currentLocation.timezone, creatorUid: user.uid });
      const profile = await setUserCongregation(user.uid, congregation.id);
      setUser(profile);
      setCurrentCongregation(congregation);
      setCurrentCongregationName(congregation.name);
      const members = await listCongregationMembers(congregation.id);
      setCongregationMembers(members);
      setPendingMembers([]);
      setNewCongregationName("");
      setNewCongregationCity("");
      setNewCongGeo(null);
      setNewCongCitySuggestions([]);
      setJoinCongregationVisible(false);
    } catch (error) {
      const msg = errorMessage(error, "Failed to create.");
      const isDuplicate = msg.toLowerCase().includes("already exists");
      Alert.alert(isDuplicate ? "Congregation Already Exists" : "Create Congregation", msg);
    } finally {
      setActionLoading(false);
    }
  }, [currentLocation, newCongregationCity, newCongregationName, newCongGeo, user]);

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

  const onTransferLeadership = useCallback(async (targetUid: string) => {
    if (!user || !currentCongregation) return;
    const targetMember = congregationMembers.find((m) => m.uid === targetUid);
    Alert.alert(
      "Transfer Leadership",
      `Make ${targetMember?.displayName ?? "this member"} the leader?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: async () => {
            setActionLoading(true);
            try {
              await transferLeadership(currentCongregation.id, user.uid, targetUid);
              await refreshCongregationData();
            } catch (error) {
              Alert.alert("Transfer failed", errorMessage(error, "Could not transfer leadership."));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [congregationMembers, currentCongregation, refreshCongregationData, user]);

  /* ── city search for congregation ── */
  const onCitySearchChange = useCallback((text: string) => {
    setCongregationCitySearch(text);
    if (citySearchTimer.current) clearTimeout(citySearchTimer.current);
    if (text.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }
    citySearchTimer.current = setTimeout(async () => {
      const results = await geocodeCitySuggestions(text, 5);
      setCitySuggestions(results);
      try {
        setNearbyError(null);
        const byName = await searchCongregationsByCityName(text.trim());
        setNearbyCongregations(byName.map((c) => ({ ...c, distanceMiles: 0 })));
      } catch (error) {
        setNearbyError(errorMessage(error, "City search failed."));
      }
    }, 400);
  }, []);

  const searchCongregationsNearGeo = useCallback(async (geo: GeocodingResult) => {
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

  /* ── city autocomplete for "Create New" congregation ── */
  const onNewCongCityChange = useCallback((text: string) => {
    setNewCongregationCity(text);
    setNewCongGeo(null);
    if (newCongCityTimer.current) clearTimeout(newCongCityTimer.current);
    if (text.trim().length < 2) {
      setNewCongCitySuggestions([]);
      return;
    }
    newCongCityTimer.current = setTimeout(async () => {
      const results = await geocodeCitySuggestions(text, 5);
      setNewCongCitySuggestions(results);
    }, 400);
  }, []);

  const onSelectNewCongCity = useCallback((geo: GeocodingResult) => {
    const cityName = geo.displayName.split(",")[0]?.trim() ?? geo.displayName;
    setNewCongregationCity(cityName);
    setNewCongGeo(geo);
    setNewCongCitySuggestions([]);
  }, []);

  /* ── friend callbacks ── */
  const friendCodeSearchRef = useRef(0);
  const onFriendCodeChange = useCallback((text: string) => {
    const upper = text.toUpperCase();
    setFriendCodeQuery(upper);
    if (upper.trim().length < 8) {
      setFriendCodeError("");
      setFriendCodeResult(null);
      return;
    }
  }, []);

  const onFriendCodeSubmit = useCallback(async () => {
    const code = friendCodeQuery.trim().toUpperCase();
    if (code.length < 8 || !user) return;
    const searchId = ++friendCodeSearchRef.current;
    setFriendSearching(true);
    setFriendCodeError("");
    setFriendCodeResult(null);
    try {
      const results = await searchByFriendCode(code, user.uid);
      if (searchId !== friendCodeSearchRef.current) return;
      if (results.length > 0) {
        setFriendCodeResult(results[0]);
      } else {
        setFriendCodeError("No user found with that code.");
      }
    } catch (err) {
      if (searchId !== friendCodeSearchRef.current) return;
      console.error("Friend code search error:", err);
      setFriendCodeError("Something went wrong. Please try again.");
    } finally {
      if (searchId === friendCodeSearchRef.current) {
        setFriendSearching(false);
      }
    }
  }, [friendCodeQuery, user]);

  const onSendFriendRequest = useCallback(async (toUid: string) => {
    if (!user) return;
    try {
      await sendFriendRequest(user.uid, toUid);
      Alert.alert("Request sent!", "They'll see your friend request.");
      setFriendCodeResult(null);
      setFriendCodeQuery("");
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

  const onAddTefillinBuddy = useCallback(async (buddyUid: string) => {
    if (!user) return;
    setBuddyActionLoading(true);
    try {
      await addTefillinBuddy(user.uid, buddyUid);
      const updated = await getUserProfile(user.uid);
      if (updated) setUser(updated);
      const chats = await getUserBuddyChats(user.uid);
      setBuddyChats(chats);
    } catch (error) {
      Alert.alert("Tefillin Buddy", errorMessage(error, "Failed to add buddy."));
    } finally { setBuddyActionLoading(false); }
  }, [user]);

  const onRemoveTefillinBuddy = useCallback(async (buddyUid: string) => {
    if (!user) return;
    setBuddyActionLoading(true);
    try {
      await removeTefillinBuddy(user.uid, buddyUid);
      const updated = await getUserProfile(user.uid);
      if (updated) setUser(updated);
      const chats = await getUserBuddyChats(user.uid);
      setBuddyChats(chats);
    } catch (error) {
      Alert.alert("Tefillin Buddy", errorMessage(error, "Failed to remove buddy."));
    } finally { setBuddyActionLoading(false); }
  }, [user]);

  const onUnfriend = useCallback(async (friendUid: string) => {
    if (!user) return;
    Alert.alert("Remove Friend", "Are you sure you want to remove this friend?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        setActionLoading(true);
        try {
          if (user.tefillinBuddyUids.includes(friendUid)) {
            await removeTefillinBuddy(user.uid, friendUid);
          }
          await removeFriend(user.uid, friendUid);
          const updated = await getUserProfile(user.uid);
          if (updated) setUser(updated);
          const chats = await getUserBuddyChats(user.uid);
          setBuddyChats(chats);
          setViewingFriend(null);
        } catch (error) {
          Alert.alert("Remove Friend", errorMessage(error, "Failed to remove friend."));
        } finally { setActionLoading(false); }
      }},
    ]);
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

  const openDmWith = useCallback((friend: UserProfile) => {
    setChattingWith(friend);
    setDmInput("");
    setSocialSubTab("dm");
  }, []);

  const onSendDm = useCallback(async () => {
    if (!user || !chattingWith || !dmInput.trim()) return;
    const text = dmInput.trim();
    setDmInput("");
    Keyboard.dismiss();
    try {
      await sendDirectMessage(user.uid, chattingWith.uid, user.displayName ?? "Anonymous", text);
    } catch (error) {
      Alert.alert("Message", errorMessage(error, "Failed to send message."));
    }
  }, [dmInput, user, chattingWith]);

  /* ── buddy chat callbacks ── */
  const openBuddyChat = useCallback((buddy: UserProfile) => {
    const chat = buddyChats.find(
      (c) => c.type === "pair" && c.memberUids.includes(buddy.uid)
    );
    if (chat) {
      queueBuddyChatSnapToBottom();
      setActiveBuddyChat(chat);
      setChattingWith(buddy);
      setBuddyChatInput("");
      setSocialSubTab("buddyChat");
      purgeExpiredMessages(chat.id).catch(() => {});
    } else {
      openDmWith(buddy);
    }
  }, [buddyChats, openDmWith, queueBuddyChatSnapToBottom]);

  const onSendBuddyChatText = useCallback(async () => {
    if (!user || !activeBuddyChat || !buddyChatInput.trim()) return;
    const text = buddyChatInput.trim();
    setBuddyChatInput("");
    Keyboard.dismiss();
    queueBuddyChatSnapToBottom();
    try {
      await sendBuddyMessage(
        activeBuddyChat.id,
        user.uid,
        user.displayName ?? "Anonymous",
        "text",
        text
      );
    } catch (error) {
      Alert.alert("Buddy Chat", errorMessage(error, "Failed to send message."));
    }
  }, [buddyChatInput, user, activeBuddyChat, queueBuddyChatSnapToBottom]);

  const onBuddyChatCamera = useCallback(async () => {
    if (!user || !activeBuddyChat) return;
    if (sunBlockedMessage) {
      Alert.alert("Tefillin Photo", sunBlockedMessage);
      return;
    }
    try {
      const result = await launchCamera({
        mediaType: "photo" as const,
        quality: 0.7,
      });
      if (result.errorCode) {
        Alert.alert("Camera", result.errorMessage ?? "Camera is not available on this device.");
        return;
      }
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      await handleBuddyImageSend(result.assets[0].uri, true);
    } catch {
      Alert.alert("Camera", "Camera is not available on this device.");
    }
  }, [user, activeBuddyChat, sunBlockedMessage]);

  const onBuddyChatGallery = useCallback(async () => {
    if (!user || !activeBuddyChat) return;
    try {
      const result = await launchImageLibrary({
        mediaType: "photo" as const,
        quality: 0.7,
      });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      await handleBuddyImageSend(result.assets[0].uri, false);
    } catch {
      Alert.alert("Gallery", "Could not open photo library.");
    }
  }, [user, activeBuddyChat]);

  const onSendBuddyQuote = useCallback(async (quote: string) => {
    if (!user || !activeBuddyChat) return;
    setShowBuddyQuotes(false);
    queueBuddyChatSnapToBottom();
    try {
      await sendBuddyMessage(
        activeBuddyChat.id,
        user.uid,
        user.displayName ?? "Anonymous",
        "text",
        quote
      );
    } catch (error) {
      Alert.alert("Quote", errorMessage(error, "Failed to send quote."));
    }
  }, [user, activeBuddyChat, queueBuddyChatSnapToBottom]);

  const handleBuddyImageSend = useCallback(async (imageUri: string, fromCamera: boolean) => {
    if (!user || !activeBuddyChat) return;
    setBuddyChatImageLoading(true);
    queueBuddyChatSnapToBottom();
    try {
      const downloadUrl = await uploadBuddyImage(activeBuddyChat.id, user.uid, imageUri);
      await sendBuddyMessage(
        activeBuddyChat.id,
        user.uid,
        user.displayName ?? "Anonymous",
        "image",
        downloadUrl,
        user.latitude ?? currentLocation?.latitude,
        user.longitude ?? currentLocation?.longitude,
        user.timeZone,
        fromCamera
      );
    } catch (error) {
      Alert.alert("Tefillin Photo", errorMessage(error, "Failed to send image."));
    } finally {
      setBuddyChatImageLoading(false);
    }
  }, [user, activeBuddyChat, currentLocation, queueBuddyChatSnapToBottom]);

  const onMarkBuddyMessageOpened = useCallback(async (msg: BuddyMessage) => {
    if (!activeBuddyChat || msg.opened || msg.senderUid === user?.uid) return;
    try {
      await markMessageOpened(activeBuddyChat.id, msg.id);
    } catch {
      // non-critical
    }
  }, [activeBuddyChat, user?.uid]);

  const onSaveMessageToChat = useCallback(async (msg: BuddyMessage) => {
    if (!activeBuddyChat || !user) return;
    try {
      await saveMessageToChat(activeBuddyChat.id, msg.id, user.uid);
      Alert.alert("Saved", "Message saved to chat — it won't auto-delete.");
    } catch {
      Alert.alert("Error", "Could not save message.");
    }
  }, [activeBuddyChat, user]);

  const onSaveImageToCameraRoll = useCallback(async (imageUrl: string) => {
    try {
      await CameraRoll.save(imageUrl, { type: "photo" });
      Alert.alert("Saved", "Image saved to your camera roll.");
    } catch {
      Alert.alert("Error", "Could not save image to camera roll. Make sure the app has photo library permissions.");
    }
  }, []);

  /* ── group buddy chat callbacks ── */
  const openGroupChat = useCallback((chat: BuddyChat) => {
    queueBuddyChatSnapToBottom();
    setActiveBuddyChat(chat);
    setChattingWith(null);
    setBuddyChatInput("");
    setSocialSubTab("buddyChat");
    purgeExpiredMessages(chat.id).catch(() => {});
  }, [queueBuddyChatSnapToBottom]);

  const onCreateGroup = useCallback(async () => {
    if (!user || groupCreateSelectedUids.length < 2 || !groupCreateName.trim()) return;
    setGroupCreateLoading(true);
    try {
      const allUids = [user.uid, ...groupCreateSelectedUids];
      await createBuddyChat(allUids, "group", groupCreateName.trim());
      const updated = await getUserProfile(user.uid);
      if (updated) setUser(updated);
      const chats = await getUserBuddyChats(user.uid);
      setBuddyChats(chats);
      setGroupCreateSelectedUids([]);
      setGroupCreateName("");
      setSocialSubTab("friends");
    } catch (error) {
      Alert.alert("Create Group", errorMessage(error, "Failed to create group."));
    } finally {
      setGroupCreateLoading(false);
    }
  }, [user, groupCreateSelectedUids, groupCreateName]);

  const onLeaveGroup = useCallback(async () => {
    if (!user || !activeBuddyChat || activeBuddyChat.type !== "group") return;
    Alert.alert("Leave Group", `Leave "${activeBuddyChat.name ?? "this group"}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: async () => {
        try {
          await removeGroupMember(activeBuddyChat.id, user.uid);
          const updated = await getUserProfile(user.uid);
          if (updated) setUser(updated);
          const chats = await getUserBuddyChats(user.uid);
          setBuddyChats(chats);
          setActiveBuddyChat(null);
          setChattingWith(null);
          setSocialSubTab("friends");
        } catch (error) {
          Alert.alert("Leave Group", errorMessage(error, "Failed to leave group."));
        }
      }},
    ]);
  }, [user, activeBuddyChat]);

  const onAddMemberToGroup = useCallback(async (friendUid: string) => {
    if (!activeBuddyChat || activeBuddyChat.type !== "group") return;
    try {
      await addGroupMember(activeBuddyChat.id, friendUid);
      const chats = await getUserBuddyChats(user!.uid);
      setBuddyChats(chats);
      const updated = chats.find((c) => c.id === activeBuddyChat.id);
      if (updated) setActiveBuddyChat(updated);
    } catch (error) {
      Alert.alert("Add Member", errorMessage(error, "Failed to add member."));
    }
  }, [activeBuddyChat, user]);

  const onRemoveMemberFromGroup = useCallback(async (memberUid: string) => {
    if (!user || !activeBuddyChat || activeBuddyChat.type !== "group") return;
    Alert.alert("Remove Member", "Remove this member from the group?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await removeGroupMember(activeBuddyChat.id, memberUid);
          const chats = await getUserBuddyChats(user.uid);
          setBuddyChats(chats);
          const updated = chats.find((c) => c.id === activeBuddyChat.id);
          if (updated) setActiveBuddyChat(updated);
        } catch (error) {
          Alert.alert("Remove Member", errorMessage(error, "Failed to remove member."));
        }
      }},
    ]);
  }, [user, activeBuddyChat]);

  const groupChatMembers = useMemo(() => {
    if (!activeBuddyChat || activeBuddyChat.type !== "group") return [];
    return activeBuddyChat.memberUids.map((uid) =>
      friends.find((f) => f.uid === uid) ?? (user?.uid === uid ? user : null)
    ).filter((p): p is UserProfile => p !== null);
  }, [activeBuddyChat, friends, user]);

  const groupChats = useMemo(() => {
    return buddyChats.filter((c) => c.type === "group");
  }, [buddyChats]);

  const allBuddyChatsOrdered = useMemo(() => {
    const chatSortKey = (chat: BuddyChat): number =>
      chat.lastActivityAt?.toMillis?.() ?? chat.createdAt.toMillis();
    return [...buddyChats].sort((a, b) => chatSortKey(b) - chatSortKey(a));
  }, [buddyChats]);

  /* ── time display ── */
  const timesDisplay = useMemo(() => {
    if (timesLoading) return "Loading...";
    if (timesError) return timesError.message;
    if (!shabbatTimes) return "No times loaded";
    return `Fri ${formatTime(shabbatTimes.shabbatStart)} – Sat ${formatTime(shabbatTimes.shabbatEnd)}`;
  }, [shabbatTimes, timesError, timesLoading]);

  const appCategories = useMemo(() => {
    const cats: Record<string, CommonApp[]> = {};
    COMMON_APPS.forEach((app) => {
      if (!cats[app.category]) cats[app.category] = [];
      cats[app.category]!.push(app);
    });
    return cats;
  }, []);

  /* ═══════════════════════════════════════════════════════════ */
  /*                     RENDER: HOME TAB                       */
  /* ═══════════════════════════════════════════════════════════ */

  const renderHomeTab = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={110}
    >
      <ScrollView
        contentContainerStyle={s.tabContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
      {/* Greeting */}
      <Text style={s.greeting}>Welcome, {user?.displayName?.split(" ")[0] ?? "Friend"}</Text>

      {/* Streaks */}
      <View style={s.streakRow}>
        <View style={[s.streakCard, { backgroundColor: C.streakBg }]}>
          <Text style={s.streakNumber}>{user?.currentStreak ?? 0}</Text>
          <Text style={s.streakLabel}>Shabbat Streak</Text>
        </View>
        <View style={[s.streakCard, { backgroundColor: C.primaryLight }]}>
          <Text style={[s.streakNumber, { color: C.primary }]}>{displayTefillinStreak}</Text>
          <Text style={[s.streakLabel, { color: C.primary }]}>Tefillin Streak</Text>
        </View>
      </View>

      {hasTefillinBuddies && (
        <View style={[s.tefillinPromptBar, { backgroundColor: C.primaryLight, marginTop: 12 }]}>
          <Text style={[s.tefillinPromptText, { color: C.primary }]}>Your tefillin streak is tracked through your buddies.</Text>
        </View>
      )}

      {!isStreakEligible && blockLevel !== "none" && (
        <View style={[s.highlightBox, { marginBottom: 12, backgroundColor: C.dangerLight }]}>
          <Text style={{ fontSize: 12, color: C.danger, lineHeight: 16 }}>
            Custom mode requires at least 1 app blocked to keep your streak.
          </Text>
        </View>
      )}

      {/* Shabbat Times */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>This Shabbat</Text>
        <Text style={s.sectionValue}>{timesDisplay}</Text>
        {isShabbatNow && <View style={s.liveBadge}><Text style={s.liveBadgeText}>SHABBAT NOW</Text></View>}
        {!isStreakEligible && (
          <Text style={{ fontSize: 11, color: C.textLight, marginTop: 6 }}>
            Select a block mode below to keep your streak alive each Shabbat.
          </Text>
        )}
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
                <Text style={[s.blockTitle, active && s.blockTitleActive]}>{info.title}</Text>
                <Text style={[s.blockDesc, active && s.blockDescActive]} numberOfLines={2}>{info.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {blockLevel === "custom" && (
          <View style={s.customBlockSection}>
            <Text style={s.customBlockTitle}>Select Apps to Block</Text>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {Object.entries(appCategories).map(([category, apps]) => (
                <View key={category}>
                  <Text style={s.appCategoryHeader}>{category}</Text>
                  {apps.map((app) => (
                    <View key={app.id} style={s.appToggleRow}>
                      <Text style={s.appToggleName}>{app.name}</Text>
                      <Switch
                        value={Boolean(customAppBlocks[app.id])}
                        onValueChange={(val) => saveCustomAppBlocks({ ...customAppBlocks, [app.id]: val })}
                        trackColor={{ false: C.border, true: C.primary }}
                        thumbColor={customAppBlocks[app.id] ? "#FFFFFF" : "#f4f4f5"}
                        ios_backgroundColor={C.border}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {isModeActive && (
          <Pressable style={s.dangerBtn} onPress={() => setShowBreakConfirm(true)} disabled={actionLoading}>
            <Text style={s.dangerBtnText}>Break Shabbat</Text>
          </Pressable>
        )}
      </View>

      {/* Daily Practice Reminders */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Daily Practice</Text>

        {/* Tefillin */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.toggleLabel}>Tefillin Reminder</Text>
              <Pressable onPress={() => setShowDailyInfo("tefillin")} hitSlop={12}>
                <View style={s.infoIcon}><Text style={s.infoIconText}>i</Text></View>
              </Pressable>
            </View>
            <Text style={s.toggleHint}>Morning notification to wrap tefillin</Text>
          </View>
          <Switch
            value={Boolean(user?.wantsMorningReminders)}
            onValueChange={onToggleMorningReminder}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor={user?.wantsMorningReminders ? "#FFFFFF" : "#f4f4f5"}
            ios_backgroundColor={C.border}
          />
        </View>
        {/* Modeh Ani */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.toggleLabel}>Modeh Ani</Text>
              <Pressable onPress={() => setShowDailyInfo("modehAni")} hitSlop={12}>
                <View style={s.infoIcon}><Text style={s.infoIconText}>i</Text></View>
              </Pressable>
            </View>
            <Text style={s.toggleHint}>Say Modeh Ani first thing each morning</Text>
          </View>
          <Switch
            value={Boolean(user?.wantsModehAniReminder)}
            onValueChange={onToggleModehAni}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor={user?.wantsModehAniReminder ? "#FFFFFF" : "#f4f4f5"}
            ios_backgroundColor={C.border}
          />
        </View>

        {/* Shared Wake Up Time (shown when either tefillin or modeh ani is on) */}
        {(user?.wantsMorningReminders || user?.wantsModehAniReminder) && (
          <View style={s.inlineTimeSection}>
            <Text style={s.timeSectionTitle}>Wake Up Time</Text>
            <Text style={s.toggleHint}>
              {user?.wantsModehAniReminder && user?.wantsMorningReminders
                ? "Modeh Ani at this time, tefillin 15 min later"
                : user?.wantsModehAniReminder
                  ? "Modeh Ani reminder at this time"
                  : "Tefillin reminder 15 min after this time"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePills}>
              {WAKE_TIMES.map((t) => (
                <Pressable key={t} style={[s.timePill, user?.wakeUpTime === t && s.timePillActive]} onPress={() => onSetWakeTime(t)}>
                  <Text style={[s.timePillText, user?.wakeUpTime === t && s.timePillTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Shema */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.toggleLabel}>Shema Before Bed</Text>
              <Pressable onPress={() => setShowDailyInfo("shema")} hitSlop={12}>
                <View style={s.infoIcon}><Text style={s.infoIconText}>i</Text></View>
              </Pressable>
            </View>
            <Text style={s.toggleHint}>Say Shema before going to sleep</Text>
          </View>
          <Switch
            value={Boolean(user?.wantsShemaReminder)}
            onValueChange={onToggleShema}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor={user?.wantsShemaReminder ? "#FFFFFF" : "#f4f4f5"}
            ios_backgroundColor={C.border}
          />
        </View>
        {user?.wantsShemaReminder && (
          <View style={s.inlineTimeSection}>
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

      {/* Intention */}
      <View style={s.sectionCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={s.sectionTitle}>Your Shabbat Intention</Text>
          <Pressable onPress={() => setShowIntentCalendar(true)} style={s.calendarIconBtn}>
            <View style={s.calendarIconCircle}>
              <Text style={{ fontSize: 20 }}>📅</Text>
            </View>
          </Pressable>
        </View>
        <Text style={s.sectionDesc}>Write why you're keeping Shabbat this week. Resets each week.</Text>
        <TextInput
          multiline
          value={intentDraft}
          onChangeText={setIntentDraft}
          style={s.intentInput}
          placeholder="I am keeping Shabbat because..."
          placeholderTextColor={C.textLight}
          scrollEnabled
          blurOnSubmit={false}
        />
        {intentDraft.trim().length > 0 && intentDraft.trim() !== savedIntentText.trim() && (
          <Pressable style={s.primaryBtn} onPress={onSaveIntentInline}>
            <Text style={s.primaryBtnText}>Save Intention</Text>
          </Pressable>
        )}
        {savedIntentText.trim().length > 0 && intentDraft.trim() === savedIntentText.trim() && (
          <Text style={{ fontSize: 12, color: C.success, marginTop: 6, fontWeight: "600" }}>Intention saved for this week</Text>
        )}
      </View>

      {/* Upcoming Holidays */}
      {shabbatTimes?.holidays && shabbatTimes.holidays.length > 0 && (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Upcoming Holidays</Text>
          <Text style={s.sectionDesc}>These holidays also have restrictions on phone use, similar to Shabbat. Participation is optional and does not affect your Shabbat streak.</Text>
          {shabbatTimes.holidays.map((holiday, idx) => (
            <View key={idx} style={s.holidayItem}>
              <Text style={s.holidayName}>{holiday.name}</Text>
              {holiday.candleLighting && (
                <Text style={s.holidayTime}>
                  {formatDay(holiday.candleLighting)} {formatTime(holiday.candleLighting)}
                  {holiday.havdalah ? ` – ${formatDay(holiday.havdalah)} ${formatTime(holiday.havdalah)}` : ""}
                </Text>
              )}
            </View>
          ))}
          <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>Participate in holiday blocking</Text>
              <Text style={s.toggleHint}>Uses your current Shabbat mode settings</Text>
            </View>
            <Switch
              value={holidayOptIn}
              onValueChange={onToggleHolidayOptIn}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={holidayOptIn ? "#FFFFFF" : "#f4f4f5"}
              ios_backgroundColor={C.border}
            />
          </View>
        </View>
      )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*                    RENDER: SOCIAL TAB                      */
  /* ═══════════════════════════════════════════════════════════ */

  const renderSocialTab = () => (
    <View style={{ flex: 1 }}>
      {/* Congregation Banner — only on friends/chat views, hidden during buddy chat, DM, group create */}
      {socialSubTab !== "buddyChat" && socialSubTab !== "dm" && socialSubTab !== "groupCreate" && (
        <View style={s.congBanner}>
          {user?.congregationId && currentCongregation ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={s.congBannerName}>{currentCongregation.name}</Text>
                <Text style={s.congBannerDetail}>{currentCongregation.city} · {congregationMembers.length} members</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={s.congIconBtn} onPress={() => setCongregationSettingsVisible(true)}>
                  <Text style={{ fontSize: 18 }}>⚙️</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.congBannerName}>No Congregation</Text>
              <Text style={s.congBannerDetail}>Join or create one to connect</Text>
            </>
          )}
          <View style={s.congBannerActions}>
            {user?.congregationId && currentCongregation ? (
              <>
                <Pressable style={s.congBannerBtn} onPress={() => setSocialSubTab("chat")}>
                  <Text style={s.congBannerBtnText}>Chat</Text>
                </Pressable>
                <Pressable style={s.congBannerBtn} onPress={() => setSocialSubTab("friends")}>
                  <Text style={s.congBannerBtnText}>Members</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={s.congBannerBtn} onPress={() => setJoinCongregationVisible(true)}>
                <Text style={s.congBannerBtnText}>Join / Create</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Back to friends from chat / DM / group create view */}
      {socialSubTab === "groupCreate" && (
        <Pressable style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }} onPress={() => setSocialSubTab("friends")}>
          <Text style={{ color: C.primary, fontWeight: "700", fontSize: 15 }}>← Back to Social</Text>
        </Pressable>
      )}
      {socialSubTab === "chat" && (
        <Pressable style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }} onPress={() => setSocialSubTab("friends")}>
          <Text style={{ color: C.primary, fontWeight: "700", fontSize: 15 }}>← Back to Social</Text>
        </Pressable>
      )}
      {socialSubTab === "dm" && chattingWith && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 10 }}>
          <Pressable onPress={() => { setSocialSubTab("friends"); setChattingWith(null); }}>
            <Text style={{ color: C.primary, fontWeight: "700", fontSize: 15 }}>← Back</Text>
          </Pressable>
          <Pressable onPress={() => setViewingFriend(chattingWith)} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <View style={[s.friendAvatar, { width: 32, height: 32, borderRadius: 16 }]}>
              <Text style={[s.friendAvatarText, { fontSize: 13 }]}>{(chattingWith.displayName ?? "?")[0]?.toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{chattingWith.displayName ?? "Unknown"}</Text>
          </Pressable>
        </View>
      )}
      {socialSubTab === "buddyChat" && activeBuddyChat && (activeBuddyChat.type === "group" || chattingWith) && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 10 }}>
          <Pressable onPress={() => { setSocialSubTab("friends"); setActiveBuddyChat(null); setChattingWith(null); setShowGroupMembers(false); }}>
            <Text style={{ color: C.primary, fontWeight: "700", fontSize: 15 }}>← Back</Text>
          </Pressable>
          {activeBuddyChat.type === "group" ? (
            <Pressable onPress={() => setShowGroupMembers(true)} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={{ flexDirection: "row" }}>
                {groupChatMembers.slice(0, 3).map((member, idx) => (
                  <View key={member.uid} style={[s.friendAvatar, { width: 28, height: 28, borderRadius: 14, marginLeft: idx > 0 ? -8 : 0, borderWidth: 2, borderColor: C.card }]}>
                    <Text style={[s.friendAvatarText, { fontSize: 11 }]}>{(member.displayName ?? "?")[0]?.toUpperCase()}</Text>
                  </View>
                ))}
                {groupChatMembers.length > 3 && (
                  <View style={[s.friendAvatar, { width: 28, height: 28, borderRadius: 14, marginLeft: -8, borderWidth: 2, borderColor: C.card, backgroundColor: C.surface }]}>
                    <Text style={[s.friendAvatarText, { fontSize: 10 }]}>+{groupChatMembers.length - 3}</Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }} numberOfLines={1}>{activeBuddyChat.name ?? "Group"}</Text>
                <Text style={{ fontSize: 12, color: C.textLight }}>{activeBuddyChat.streakCount} day streak · {activeBuddyChat.memberUids.length} members</Text>
              </View>
            </Pressable>
          ) : chattingWith ? (
            <Pressable onPress={() => setViewingFriend(chattingWith)} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={[s.friendAvatar, { width: 32, height: 32, borderRadius: 16 }]}>
                <Text style={[s.friendAvatarText, { fontSize: 13 }]}>{(chattingWith.displayName ?? "?")[0]?.toUpperCase()}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{chattingWith.displayName ?? "Unknown"}</Text>
                <Text style={{ fontSize: 12, color: C.textLight }}>{activeBuddyChat.streakCount} day streak</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Main Social View */}
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

          {/* Leaderboard header */}
          <View style={s.leaderboardHeader}>
            <Text style={s.leaderboardHeaderText}>Leaderboard</Text>
          </View>

          {/* Friends Leaderboard */}
          <View style={s.leaderboardCard}>
            {friends.length === 0 ? (
              <Text style={s.emptyText}>Add friends to see the leaderboard!</Text>
            ) : (
              friends.map((friend, idx) => (
                <Pressable key={friend.uid} onPress={() => openDmWith(friend)}>
                  <LeaderboardRow
                    profile={friend}
                    rank={idx + 1}
                    congregationName={friend.congregationId ? (friendCongregationNames[friend.congregationId] ?? null) : null}
                    onAvatarPress={() => setViewingFriend(friend)}
                  />
                </Pressable>
              ))
            )}
          </View>

          {/* Congregation Members */}
          {congregationMembers.length > 0 && (
            <>
              <View style={s.leaderboardHeader}>
                <Text style={s.leaderboardHeaderText}>{currentCongregation?.name ?? "Congregation"}</Text>
              </View>
              <View style={s.leaderboardCard}>
                {congregationMembers
                  .sort((a, b) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0))
                  .map((member, idx) => (
                    <LeaderboardRow key={member.uid} profile={member} rank={idx + 1} isCurrentUser={member.uid === user?.uid} congregationName={currentCongregation?.name ?? null} />
                  ))}
              </View>
            </>
          )}

          {/* Add Friend */}
          <View style={s.socialActions}>
            <Pressable style={s.primaryBtn} onPress={() => { setFriendCodeQuery(""); setFriendCodeResult(null); setFriendCodeError(""); setAddFriendVisible(true); }}>
              <Text style={s.primaryBtnText}>+ Add Friends</Text>
            </Pressable>
            {!user?.congregationId && (
              <Pressable style={s.outlineBtn} onPress={() => setJoinCongregationVisible(true)}>
                <Text style={s.outlineBtnText}>Join / Create Congregation</Text>
              </Pressable>
            )}
          </View>

          {/* ── Tefillin Buddies Section (unified pair + group) ── */}
          <View style={s.buddiesSection}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={s.buddiesSectionTitle}>Tefillin Buddies</Text>
                <Pressable onPress={() => setShowBuddyInfo(true)} hitSlop={12}>
                  <View style={s.infoIcon}><Text style={s.infoIconText}>i</Text></View>
                </Pressable>
              </View>
              {friends.length >= 2 && (
                <Pressable
                  style={[s.buddySnapBtn, { backgroundColor: C.primary }]}
                  onPress={() => {
                    setGroupCreateSelectedUids([]);
                    setGroupCreateName("");
                    setSocialSubTab("groupCreate");
                  }}
                >
                  <Text style={[s.buddySnapBtnText, { color: "#FFF" }]}>+ Group</Text>
                </Pressable>
              )}
            </View>

            {allBuddyChatsOrdered.length > 0 ? (
              <View style={s.buddyStreakList}>
                {allBuddyChatsOrdered.map((chat) => {
                  if (chat.type === "pair") {
                    const buddyUid = chat.memberUids.find((uid) => uid !== user?.uid);
                    const buddy = friends.find((f) => f.uid === buddyUid);
                    if (!buddy) return null;
                    const lastDate = buddy.lastTefillinDate;
                    const isToday = lastDate === todayDateStr();
                    return (
                      <Pressable key={chat.id} style={s.buddyStreakRow} onPress={() => openBuddyChat(buddy)}>
                        <Pressable onPress={() => setViewingFriend(buddy)} hitSlop={4}>
                          <View style={[s.buddyAvatarLarge, !isToday && { opacity: 0.7 }]}>
                            <Text style={s.buddyAvatarLargeText}>{(buddy.displayName ?? "?")[0]?.toUpperCase()}</Text>
                            {isToday && <View style={s.buddyAvatarDot} />}
                          </View>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Text style={s.buddyNameLarge}>{buddy.displayName ?? "Unknown"}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={s.buddyStreakText}>{chat.streakCount} day streak</Text>
                            {!isToday && <Text style={{ fontSize: 14 }}>⏳</Text>}
                          </View>
                        </View>
                        <Pressable
                          style={[s.buddySnapBtn, !isToday && { backgroundColor: C.primary }]}
                          onPress={() => openBuddyChat(buddy)}
                        >
                          {isToday ? (
                            <Text style={s.buddySnapBtnText}>Wrapped</Text>
                          ) : (
                            <CameraIcon size={22} color="#FFF" />
                          )}
                        </Pressable>
                      </Pressable>
                    );
                  }
                  const memberNames = chat.memberUids
                    .filter((uid) => uid !== user?.uid)
                    .map((uid) => friends.find((f) => f.uid === uid)?.displayName ?? "Unknown")
                    .join(", ");
                  return (
                    <Pressable key={chat.id} style={s.buddyStreakRow} onPress={() => openGroupChat(chat)}>
                      <View style={[s.buddyAvatarLarge, { backgroundColor: C.streakBg }]}>
                        <Text style={[s.buddyAvatarLargeText, { color: C.streak }]}>{chat.memberUids.length}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.buddyNameLarge}>{chat.name ?? "Group"}</Text>
                        <Text style={{ fontSize: 12, color: C.textSecondary }} numberOfLines={1}>{memberNames}</Text>
                        <Text style={s.buddyStreakText}>{chat.streakCount} day streak</Text>
                      </View>
                      <Pressable
                        style={[s.buddySnapBtn, { backgroundColor: C.primary }]}
                        onPress={() => openGroupChat(chat)}
                      >
                        <CameraIcon size={22} color="#FFF" />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={s.buddyEmptyState}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🤝</Text>
                <Text style={s.buddyEmptyTitle}>No buddies yet</Text>
                <Text style={s.buddyEmptyDesc}>Add a friend as a Tefillin Buddy below to start your streak together.</Text>
              </View>
            )}

            {/* Add Buddy from Friends */}
            {friends.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.buddyAddHeader}>Add a Tefillin Buddy</Text>
                {friends.filter((f) => !tefillinBuddyUids.includes(f.uid)).map((friend) => (
                  <View key={friend.uid} style={s.buddyAddRow}>
                    <Pressable onPress={() => setViewingFriend(friend)} hitSlop={4}>
                      <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(friend.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
                    </Pressable>
                    <Pressable style={{ flex: 1 }} onPress={() => openDmWith(friend)}>
                      <Text style={s.friendName}>{friend.displayName ?? "Unknown"}</Text>
                    </Pressable>
                    <Pressable style={s.acceptBtn} onPress={() => onAddTefillinBuddy(friend.uid)} disabled={buddyActionLoading}>
                      <Text style={s.acceptBtnText}>+ Add</Text>
                    </Pressable>
                  </View>
                ))}
                {friends.filter((f) => !tefillinBuddyUids.includes(f.uid)).length === 0 && (
                  <Text style={[s.emptyText, { paddingVertical: 8 }]}>All your friends are already buddies!</Text>
                )}
              </View>
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Chat View (accessed from congregation banner) */}
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

      {/* Direct Message View */}
      {socialSubTab === "dm" && chattingWith && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={120}>
          <FlatList
            data={dmMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.chatList}
            renderItem={({ item }) => (
              <View style={[s.chatBubble, item.senderUid === user?.uid && s.chatBubbleMine]}>
                <Text style={[s.chatText, item.senderUid === user?.uid && s.chatTextMine]}>{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
                <Text style={s.emptyText}>No messages yet. Say hi!</Text>
              </View>
            }
          />
          <View style={s.chatInputRow}>
            <TextInput
              style={s.chatTextInput}
              value={dmInput}
              onChangeText={setDmInput}
              placeholder={`Message ${chattingWith.displayName ?? ""}...`}
              placeholderTextColor={C.textLight}
              returnKeyType="send"
              onSubmitEditing={onSendDm}
            />
            <Pressable style={s.chatSendBtn} onPress={onSendDm}>
              <Text style={s.chatSendBtnText}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Buddy Chat View (pair + group) */}
      {socialSubTab === "buddyChat" && activeBuddyChat && (activeBuddyChat.type === "group" || chattingWith) && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={120}>
          {sunBlockedMessage && (
            <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>🌙</Text>
              <Text style={{ color: "#92400E", fontSize: 13, flex: 1 }}>{sunBlockedMessage}</Text>
            </View>
          )}
          {activeBuddyChat.type === "group" && groupDailyStatus && (
            <View style={{ backgroundColor: C.primaryLight, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.primary, marginBottom: 4 }}>Today's Progress</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {activeBuddyChat.memberUids.map((uid) => {
                  const member = groupChatMembers.find((m) => m.uid === uid);
                  const hasSent = groupDailyStatus.sent.includes(uid);
                  const name = member?.displayName ?? "Unknown";
                  return (
                    <View key={uid} style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: hasSent ? C.successLight : C.surface,
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
                    }}>
                      <Text style={{ fontSize: 11 }}>{hasSent ? "✓" : "○"}</Text>
                      <Text style={{ fontSize: 12, color: hasSent ? C.success : C.textSecondary, fontWeight: "600" }}>{name.split(" ")[0]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          <FlatList
            ref={buddyChatListRef}
            style={[s.chatThread, buddyChatSavedPeekOnly && s.chatThreadPeek]}
            data={buddyChatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              s.buddyChatList,
              buddyChatMessages.length === 0 && s.buddyChatListEmpty,
            ]}
            onLayout={(event) => setBuddyChatViewportHeight(event.nativeEvent.layout.height)}
            onContentSizeChange={() => {
              if (!buddyChatShouldSnapRef.current) return;
              buddyChatShouldSnapRef.current = false;
              flushBuddyChatSnapToBottom(false);
            }}
            renderItem={({ item }) => {
              const isMine = item.senderUid === user?.uid;
              const isSaved = user ? item.savedByUids?.includes(user.uid) : false;
              const onPressMessage = () => {
                if (!isMine && item.type === "image" && !item.opened) {
                  onMarkBuddyMessageOpened(item);
                }
                if (!isSaved) {
                  onSaveMessageToChat(item);
                }
              };
              const onLongPressImage = () => {
                if (item.type !== "image" || !item.imageUrl) return;
                const imageUrl = item.imageUrl;
                Alert.alert("Image Options", undefined, [
                  { text: "Save to Camera Roll", onPress: () => onSaveImageToCameraRoll(imageUrl) },
                  { text: "Cancel", style: "cancel" },
                ]);
              };
              return (
                <Pressable
                  onPress={onPressMessage}
                  onLongPress={item.type === "image" && item.imageUrl ? onLongPressImage : undefined}
                  style={[s.chatBubble, isMine && s.chatBubbleMine]}
                >
                  {!isMine && <Text style={s.chatSender}>{item.senderName}</Text>}
                  {item.type === "image" && item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 200, height: 200, borderRadius: 12, marginVertical: 4 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[s.chatText, isMine && s.chatTextMine]}>{item.text}</Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    {!isMine && item.type === "image" && (
                      <Text style={{ fontSize: 10, color: C.textLight }}>
                        {item.opened ? "Opened" : "Tap to open"}
                      </Text>
                    )}
                    {isSaved && (
                      <Text style={{ fontSize: 10, color: C.primary }}>Saved</Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <CameraIcon size={48} color={C.textLight} />
                <Text style={s.emptyText}>Send a tefillin photo to start your streak!</Text>
              </View>
            }
            ListFooterComponent={
              buddyChatSavedPeekOnly ? (
                <View style={[s.buddyChatPeekSpacer, { height: buddyChatPeekHeight }]}>
                  <Text style={s.buddyChatPeekLabel}>Scroll up to view saved chats</Text>
                </View>
              ) : null
            }
          />
          <View style={s.chatInputRow}>
            <Pressable
              style={[s.buddyChatIconBtn, { backgroundColor: sunBlockedMessage ? C.border : C.primary }]}
              onPress={onBuddyChatCamera}
              disabled={buddyChatImageLoading}
            >
              {buddyChatImageLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <CameraIcon size={22} color="#FFF" />
              )}
            </Pressable>
            <TextInput
              style={[s.chatTextInput, { flex: 1 }]}
              value={buddyChatInput}
              onChangeText={setBuddyChatInput}
              placeholder={`Message ${activeBuddyChat.type === "group" ? (activeBuddyChat.name ?? "group") : (chattingWith?.displayName ?? "")}...`}
              placeholderTextColor={C.textLight}
              returnKeyType="send"
              onSubmitEditing={onSendBuddyChatText}
            />
            <Pressable
              style={[s.buddyChatIconBtn, { backgroundColor: C.surface }]}
              onPress={onBuddyChatGallery}
              disabled={buddyChatImageLoading}
            >
              <Text style={{ fontSize: 18 }}>🖼</Text>
            </Pressable>
            <Pressable
              style={[s.buddyChatIconBtn, { backgroundColor: C.surface }]}
              onPress={() => setShowBuddyQuotes(true)}
            >
              <Text style={{ fontSize: 18 }}>❝</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Group Create View */}
      {socialSubTab === "groupCreate" && (
        <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.buddiesSectionTitle, { marginBottom: 16 }]}>Create Group Chat</Text>

          <View style={[s.sectionCard, { marginBottom: 16 }]}>
            <Text style={s.buddyAddHeader}>Group Name</Text>
            <TextInput
              style={[s.chatTextInput, { marginTop: 4 }]}
              value={groupCreateName}
              onChangeText={setGroupCreateName}
              placeholder="e.g., Morning Crew"
              placeholderTextColor={C.textLight}
            />
          </View>

          <View style={s.sectionCard}>
            <Text style={s.buddyAddHeader}>Select Friends ({groupCreateSelectedUids.length} selected, min 2)</Text>
            {friends.map((friend) => {
              const isSelected = groupCreateSelectedUids.includes(friend.uid);
              return (
                <Pressable
                  key={friend.uid}
                  style={[s.buddyAddRow, isSelected && { backgroundColor: C.primaryLight }]}
                  onPress={() => {
                    setGroupCreateSelectedUids((prev) =>
                      isSelected ? prev.filter((uid) => uid !== friend.uid) : [...prev, friend.uid]
                    );
                  }}
                >
                  <View style={[s.friendAvatar, isSelected && { backgroundColor: C.primary }]}>
                    <Text style={[s.friendAvatarText, isSelected && { color: "#FFF" }]}>{(friend.displayName ?? "?")[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[s.friendName, { flex: 1 }]}>{friend.displayName ?? "Unknown"}</Text>
                  <Text style={{ fontSize: 20, color: isSelected ? C.primary : C.border }}>{isSelected ? "✓" : "○"}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 10, marginTop: 16 }}>
            <Pressable
              style={[s.primaryBtn, (groupCreateSelectedUids.length < 2 || !groupCreateName.trim() || groupCreateLoading) && s.disabled]}
              onPress={onCreateGroup}
              disabled={groupCreateSelectedUids.length < 2 || !groupCreateName.trim() || groupCreateLoading}
            >
              <Text style={s.primaryBtnText}>{groupCreateLoading ? "Creating..." : "Create Group"}</Text>
            </Pressable>
            <Pressable style={s.outlineBtn} onPress={() => setSocialSubTab("friends")}>
              <Text style={s.outlineBtnText}>Cancel</Text>
            </Pressable>
          </View>

          <View style={{ height: 24 }} />
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
        {timesLoading && !shabbatTimes ? (
          <>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={[s.sectionDesc, { marginTop: 12 }]}>Loading this week's portion...</Text>
            <Pressable style={[s.outlineBtn, { marginTop: 12 }]} onPress={refreshTimes}>
              <Text style={s.outlineBtnText}>Retry</Text>
            </Pressable>
          </>
        ) : shabbatTimes?.parsha ? (
          <>
            <Text style={s.parashaName}>{shabbatTimes.parsha}</Text>
            {parashaInfo && (
              <>
                <View style={s.parashaBookBadge}>
                  <Text style={s.parashaBookText}>{parashaInfo.book}</Text>
                </View>
                <Text style={s.parashaSummary}>{parashaInfo.summary}</Text>
              </>
            )}
            {!parashaInfo && (
              <Text style={s.parashaSummary}>Explore this week's Torah portion to discover timeless wisdom and inspiration for your week ahead.</Text>
            )}
          </>
        ) : (
          <>
            <Text style={s.parashaName}>Torah Portion</Text>
            <Text style={s.parashaSummary}>
              {timesError ? "Could not load — check your internet connection and location permissions." : "Could not load this week's portion."}
            </Text>
            <Pressable style={[s.primaryBtn, { marginTop: 8 }]} onPress={refreshTimes}>
              <Text style={s.primaryBtnText}>Try Again</Text>
            </Pressable>
          </>
        )}
      </View>

      <Pressable style={s.primaryBtn} onPress={() => Linking.openURL(getChabadParashaUrl())}>
        <Text style={s.primaryBtnText}>Learn More on Chabad.org</Text>
      </Pressable>

      <View style={[s.sectionCard, { marginTop: 16 }]}>
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

  const needsProfileSetup = !user.displayName?.trim();
  if (needsProfileSetup) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.centered}>
          <Text style={s.authTitle}>Welcome!</Text>
          <Text style={s.sectionDesc}>Set up your profile to get started.</Text>
          <TextInput placeholder="Name" value={profileName} onChangeText={setProfileName} style={[s.authInput, s.fullWidth]} placeholderTextColor={C.textLight} />
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
        <Pressable style={s.profileBtn} onPress={() => setSettingsVisible(true)}>
          <View style={s.profileBtnCircle}>
            <Text style={s.profileBtnText}>{(user?.displayName ?? "?")[0]?.toUpperCase()}</Text>
          </View>
        </Pressable>
      </View>

      {/* Body */}
      <Animated.View style={[s.body, { opacity: tabContentAnim, transform: [{ translateY: tabContentAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "social" && renderSocialTab()}
        {activeTab === "parasha" && renderParashaTab()}
      </Animated.View>

      {/* Tab Bar — Torah / Home / Social */}
      <View style={s.tabBar}>
        <TabItem label="Torah" active={activeTab === "parasha"} onPress={() => setActiveTab("parasha")} />
        <TabItem label="Home" active={activeTab === "home"} onPress={() => setActiveTab("home")} />
        <TabItem label="Social" active={activeTab === "social"} onPress={() => setActiveTab("social")} />
      </View>

      {/* ── Modals ── */}

      {/* Intent Modal */}
      <Modal visible={intentModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Shabbat is starting</Text>
            <Text style={s.sectionDesc}>Write your intention for keeping Shabbat this week. This will remind you if you try to break it.</Text>
            <TextInput
              multiline
              value={intentDraft}
              onChangeText={setIntentDraft}
              style={s.intentInput}
              placeholder="I am keeping Shabbat because..."
              placeholderTextColor={C.textLight}
              scrollEnabled
              blurOnSubmit={false}
            />
            <Pressable style={s.primaryBtn} onPress={onSubmitIntent}><Text style={s.primaryBtnText}>Save intention</Text></Pressable>
            <Pressable style={s.dangerBtn} onPress={onOptOutThisWeek}><Text style={s.dangerBtnText}>Not keeping this week</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Break Shabbat Confirmation Modal */}
      <Modal visible={showBreakConfirm} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Are you sure?</Text>
            {user?.shabbatIntentText ? (
              <View style={[s.highlightBox, { marginTop: 12 }]}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.primaryDark, marginBottom: 6 }}>Your Shabbat Intention:</Text>
                <Text style={{ fontSize: 14, color: C.primaryDark, fontStyle: "italic", lineHeight: 20 }}>"{user.shabbatIntentText}"</Text>
              </View>
            ) : null}
            <Text style={[s.sectionDesc, { marginTop: 12 }]}>Opening this app will break Shabbat. Your streak will reset to 0. Are you sure you want to do this?</Text>
            <Pressable style={[s.primaryBtn, { marginTop: 16 }]} onPress={onCancelBreak}>
              <Text style={s.primaryBtnText}>Go Back to Shabbat</Text>
            </Pressable>
            <Pressable style={s.dangerBtn} onPress={onConfirmBreak}>
              <Text style={s.dangerBtnText}>Break Shabbat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Intent Calendar Modal */}
      <Modal visible={showIntentCalendar} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <Text style={s.modalTitle}>Shabbat Intentions</Text>
            <Text style={s.sectionDesc}>Your saved weekly intentions.</Text>
            <ScrollView style={{ maxHeight: 400, marginTop: 12 }}>
              {Object.entries(intentHistory)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, intent]) => {
                  const d = new Date(date + "T12:00:00");
                  const label = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  const isCurrentWeek = date === currentWeekDate;
                  return (
                    <Pressable
                      key={date}
                      style={[s.calendarDateItem, selectedPastDate === date && s.calendarDateItemActive]}
                      onPress={() => setSelectedPastDate(selectedPastDate === date ? null : date)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[s.calendarDateText, selectedPastDate === date && { color: C.primaryDark }]}>{label}</Text>
                        {isCurrentWeek && (
                          <View style={{ backgroundColor: C.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, color: "#FFF", fontWeight: "700" }}>This Week</Text>
                          </View>
                        )}
                      </View>
                      {selectedPastDate === date && (
                        <Text style={s.calendarIntentText}>"{intent}"</Text>
                      )}
                    </Pressable>
                  );
                })}
              {Object.keys(intentHistory).length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 30 }}>
                  <Text style={s.emptyText}>No intentions saved yet. Save your first one from the Home tab.</Text>
                </View>
              )}
            </ScrollView>
            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => { setShowIntentCalendar(false); setSelectedPastDate(null); }}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Daily Info Modal */}
      <Modal visible={showDailyInfo !== null} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {showDailyInfo && DAILY_INFO[showDailyInfo] && (
              <>
                <Text style={s.modalTitle}>{DAILY_INFO[showDailyInfo]!.title}</Text>
                <Text style={[s.sectionDesc, { marginTop: 12, fontSize: 14, lineHeight: 22 }]}>{DAILY_INFO[showDailyInfo]!.explanation}</Text>
              </>
            )}
            <Pressable style={[s.primaryBtn, { marginTop: 16 }]} onPress={() => setShowDailyInfo(null)}>
              <Text style={s.primaryBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Tefillin Buddies Info Modal */}
      <Modal visible={showBuddyInfo} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Tefillin Buddies</Text>
            <Text style={[s.sectionDesc, { marginTop: 12, fontSize: 14, lineHeight: 22 }]}>
              Tefillin buddies is a way to better hold yourself accountable to wrapping tefillin by sharing this commitment with your friends. Everyday you will need to send a photo to your friends of you wrapping tefillin to keep your streak alive, and they must do the same to you.
            </Text>
            <Pressable style={[s.primaryBtn, { marginTop: 16 }]} onPress={() => setShowBuddyInfo(false)}>
              <Text style={s.primaryBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={soloTefillinPromptVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Have you wrapped tefillin today?</Text>
            <Text style={[s.sectionDesc, { marginTop: 12 }]}>
              Answer yes to keep your solo tefillin streak going. Ignore turns this question off.
            </Text>
            <Pressable style={[s.primaryBtn, { marginTop: 16 }]} onPress={onConfirmTefillin}>
              <Text style={s.primaryBtnText}>Yes</Text>
            </Pressable>
            <Pressable style={s.outlineBtn} onPress={onDeclineTefillinPrompt}>
              <Text style={s.outlineBtnText}>No</Text>
            </Pressable>
            <Pressable style={s.ghostBtn} onPress={onIgnoreTefillinPrompt}>
              <Text style={s.ghostBtnText}>Ignore</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Rabbi Quotes Modal */}
      <Modal visible={showBuddyQuotes} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "70%" }]}>
            <Text style={s.modalTitle}>Send a Quote</Text>
            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {RABBI_QUOTES.map((quote, idx) => (
                <Pressable
                  key={idx}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
                  onPress={() => onSendBuddyQuote(quote)}
                >
                  <Text style={{ fontSize: 14, lineHeight: 20, color: C.text }}>{quote}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[s.outlineBtn, { marginTop: 12 }]} onPress={() => setShowBuddyQuotes(false)}>
              <Text style={s.outlineBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Friend Profile Modal */}
      <Modal visible={viewingFriend !== null} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "70%" }]}>
            {viewingFriend && (
              <>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={[s.buddyAvatarLarge, { width: 64, height: 64, borderRadius: 32 }]}>
                    <Text style={[s.buddyAvatarLargeText, { fontSize: 26 }]}>{(viewingFriend.displayName ?? "?")[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[s.modalTitle, { marginTop: 12, textAlign: "center" }]}>{viewingFriend.displayName ?? "Unknown"}</Text>
                  {viewingFriend.congregationId && (
                    <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
                      {friendCongregationNames[viewingFriend.congregationId] ?? "In a congregation"}
                    </Text>
                  )}
                </View>

                {viewingFriend.streakVisibility !== "private" && (
                  <View style={s.streakRow}>
                    <View style={[s.streakCard, { backgroundColor: C.streakBg, flex: 1 }]}>
                      <Text style={s.streakNumber}>{viewingFriend.currentStreak ?? 0}</Text>
                      <Text style={s.streakLabel}>Shabbat</Text>
                    </View>
                    <View style={[s.streakCard, { backgroundColor: C.primaryLight, flex: 1 }]}>
                      <Text style={[s.streakNumber, { color: C.primary }]}>{viewingFriend.tefillinCurrentStreak ?? 0}</Text>
                      <Text style={[s.streakLabel, { color: C.primary }]}>Tefillin</Text>
                    </View>
                  </View>
                )}
                {viewingFriend.streakVisibility === "private" && (
                  <View style={{ alignItems: "center", paddingVertical: 12, backgroundColor: C.surface, borderRadius: 16, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: C.textLight }}>Streaks are private</Text>
                  </View>
                )}

                <View style={{ gap: 10, marginTop: 20 }}>
                  <Pressable
                    style={s.primaryBtn}
                    onPress={() => {
                      const f = viewingFriend;
                      setViewingFriend(null);
                      if (tefillinBuddyUids.includes(f.uid)) {
                        openBuddyChat(f);
                      } else {
                        openDmWith(f);
                      }
                    }}
                  >
                    <Text style={s.primaryBtnText}>Message</Text>
                  </Pressable>
                  {tefillinBuddyUids.includes(viewingFriend.uid) ? (
                    <Pressable
                      style={[s.primaryBtn, { backgroundColor: C.dangerLight }]}
                      onPress={() => { onRemoveTefillinBuddy(viewingFriend.uid); setViewingFriend(null); }}
                      disabled={buddyActionLoading}
                    >
                      <Text style={[s.primaryBtnText, { color: C.danger }]}>Remove Tefillin Buddy</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={s.primaryBtn}
                      onPress={() => { onAddTefillinBuddy(viewingFriend.uid); setViewingFriend(null); }}
                      disabled={buddyActionLoading}
                    >
                      <Text style={s.primaryBtnText}>Add Tefillin Buddy</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[s.primaryBtn, { backgroundColor: C.dangerLight }]}
                    onPress={() => onUnfriend(viewingFriend.uid)}
                    disabled={actionLoading}
                  >
                    <Text style={[s.primaryBtnText, { color: C.danger }]}>Remove Friend</Text>
                  </Pressable>
                </View>

                <Pressable style={[s.outlineBtn, { marginTop: 12 }]} onPress={() => setViewingFriend(null)}>
                  <Text style={s.outlineBtnText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Group Members Modal */}
      <Modal visible={showGroupMembers && activeBuddyChat?.type === "group"} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <Text style={s.modalTitle}>{activeBuddyChat?.name ?? "Group"}</Text>
            <Text style={[s.sectionDesc, { marginBottom: 12 }]}>{activeBuddyChat?.memberUids.length ?? 0} members · {activeBuddyChat?.streakCount ?? 0} day streak</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {groupChatMembers.map((member) => {
                const isMe = member.uid === user?.uid;
                return (
                  <View key={member.uid} style={[s.buddyAddRow, { paddingVertical: 10 }]}>
                    <View style={s.friendAvatar}>
                      <Text style={s.friendAvatarText}>{(member.displayName ?? "?")[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{member.displayName ?? "Unknown"}{isMe ? " (you)" : ""}</Text>
                    </View>
                    {!isMe && (
                      <Pressable
                        style={[s.rejectBtn, { paddingHorizontal: 8, paddingVertical: 4 }]}
                        onPress={() => onRemoveMemberFromGroup(member.uid)}
                      >
                        <Text style={[s.rejectBtnText, { fontSize: 11 }]}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}

              {friends.filter((f) => !activeBuddyChat?.memberUids.includes(f.uid)).length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={s.buddyAddHeader}>Add Members</Text>
                  {friends.filter((f) => !activeBuddyChat?.memberUids.includes(f.uid)).map((friend) => (
                    <View key={friend.uid} style={s.buddyAddRow}>
                      <View style={s.friendAvatar}>
                        <Text style={s.friendAvatarText}>{(friend.displayName ?? "?")[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={[s.friendName, { flex: 1 }]}>{friend.displayName ?? "Unknown"}</Text>
                      <Pressable style={s.acceptBtn} onPress={() => onAddMemberToGroup(friend.uid)}>
                        <Text style={s.acceptBtnText}>+ Add</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={{ gap: 10, marginTop: 16 }}>
              <Pressable
                style={[s.primaryBtn, { backgroundColor: C.dangerLight }]}
                onPress={() => { setShowGroupMembers(false); onLeaveGroup(); }}
              >
                <Text style={[s.primaryBtnText, { color: C.danger }]}>Leave Group</Text>
              </Pressable>
              <Pressable style={s.outlineBtn} onPress={() => setShowGroupMembers(false)}>
                <Text style={s.outlineBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Prayer Overlay Modal */}
      <Modal visible={showPrayerOverlay} transparent animationType="fade">
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
          <View style={[s.modalCard, { alignItems: "center" }]}>
            {prayerOverlayType === "modehAni" && (
              <>
                <Text style={s.modalTitle}>Modeh Ani</Text>
                <Text style={s.prayerHebrew}>{PRAYER_TEXTS.modehAni.hebrew}</Text>
                <Text style={s.prayerEnglish}>{PRAYER_TEXTS.modehAni.english}</Text>
              </>
            )}
            {prayerOverlayType === "shema" && (
              <>
                <Text style={s.modalTitle}>Shema</Text>
                <Text style={s.prayerHebrew}>{PRAYER_TEXTS.shema.hebrew}</Text>
                <Text style={s.prayerEnglish}>{PRAYER_TEXTS.shema.english}</Text>
              </>
            )}
            <Pressable style={[s.primaryBtn, { marginTop: 20, width: "100%" }]} onPress={() => { setShowPrayerOverlay(false); setPrayerOverlayType(null); }}>
              <Text style={s.primaryBtnText}>OK</Text>
            </Pressable>
            <Pressable style={s.ghostBtn} onPress={() => { setShowPrayerOverlay(false); setPrayerOverlayType(null); }}>
              <Text style={s.ghostBtnText}>Dismiss</Text>
            </Pressable>
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
              <Pressable style={s.outlineBtn} onPress={async () => {
                await onSaveProfile();
                Alert.alert("Saved", "Profile updated.");
              }}>
                <Text style={s.outlineBtnText}>Save Profile</Text>
              </Pressable>

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Location</Text>
              <Text style={s.sectionDesc}>{homeCity}</Text>
              {currentLocation && (
                <Text style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                  {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                </Text>
              )}

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Shabbat Reminder</Text>
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>15 min before Shabbat</Text>
                <Switch value={Boolean(user?.wantsShabbatReminders)} onValueChange={onToggleShabbatReminder} trackColor={{ false: C.border, true: C.primary }} thumbColor={user?.wantsShabbatReminders ? "#FFFFFF" : "#f4f4f5"} ios_backgroundColor={C.border} />
              </View>

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Privacy</Text>
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>Hide my streaks</Text>
                  <Text style={s.toggleHint}>Others won't see your streak counts</Text>
                </View>
                <Switch
                  value={user?.streakVisibility === "private"}
                  onValueChange={async (val) => {
                    if (!user) return;
                    const updated = await updateUserProfile(user.uid, { streakVisibility: val ? "private" : "public" });
                    setUser(updated);
                  }}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor={user?.streakVisibility === "private" ? "#FFFFFF" : "#f4f4f5"}
                  ios_backgroundColor={C.border}
                />
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

      {/* Congregation Settings Modal */}
      <Modal visible={congregationSettingsVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>{currentCongregation?.name ?? "Congregation"} Settings</Text>

              <Text style={[s.sectionTitle, { marginTop: 16 }]}>Join Policy</Text>
              <Text style={s.sectionDesc}>Current: {currentCongregation?.joinPolicy ?? "N/A"}</Text>
              {currentCongregation?.leaderUid === user?.uid ? (
                <View style={s.policyRow}>
                  {(["OPEN", "REQUEST", "CLOSED"] as const).map((p) => (
                    <Pressable key={p} style={[s.policyPill, currentCongregation?.joinPolicy === p && s.policyPillActive]} onPress={() => onChangeJoinPolicy(p)}>
                      <Text style={[s.policyPillText, currentCongregation?.joinPolicy === p && s.policyPillTextActive]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>Only the leader can change these settings.</Text>
              )}

              {currentCongregation?.leaderUid === user?.uid && pendingMembers.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 16 }]}>Pending Requests</Text>
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

              <Text style={[s.sectionTitle, { marginTop: 16 }]}>Members ({congregationMembers.length})</Text>
              {congregationMembers.map((m) => (
                <View key={m.uid} style={s.friendRow}>
                  <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(m.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.friendName}>{m.displayName ?? "Unknown"}{m.uid === currentCongregation?.leaderUid ? " ⭐" : ""}</Text>
                  </View>
                  {currentCongregation?.leaderUid === user?.uid && m.uid !== user?.uid && (
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      <Pressable style={s.acceptBtn} onPress={() => onTransferLeadership(m.uid)}>
                        <Text style={s.acceptBtnText}>Lead</Text>
                      </Pressable>
                      <Pressable style={s.rejectBtn} onPress={() => Alert.alert("Remove Member", `Remove ${m.displayName}?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => onKickMember(m.uid) }])}>
                        <Text style={s.rejectBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

              <Pressable style={[s.dangerBtn, { marginTop: 20 }]} onPress={() => { setCongregationSettingsVisible(false); Alert.alert("Leave Congregation", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Leave", style: "destructive", onPress: onLeaveCongregation }]); }}>
                <Text style={s.dangerBtnText}>Leave Congregation</Text>
              </Pressable>
            </ScrollView>

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => setCongregationSettingsVisible(false)}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Friend Modal */}
      <Modal visible={addFriendVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <Text style={s.modalTitle}>Add Friend</Text>

            <View style={[s.highlightBox, { marginBottom: 16 }]}>
              <Text style={[s.highlightText, { fontWeight: "800", fontSize: 14 }]}>Your Friend Code</Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: C.primary, letterSpacing: 2, marginTop: 4 }}>{user.friendCode ?? user.uid.slice(0, 8).toUpperCase()}</Text>
              <Text style={[s.sectionDesc, { marginTop: 4, fontSize: 11 }]}>Share this code with friends so they can add you.</Text>
            </View>

            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 6 }}>Enter a friend's code</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="e.g. A1B2C3D4"
                value={friendCodeQuery}
                onChangeText={onFriendCodeChange}
                style={[s.authInput, { flex: 1 }]}
                placeholderTextColor={C.textLight}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                returnKeyType="search"
                onSubmitEditing={onFriendCodeSubmit}
              />
              <Pressable
                style={[s.primaryBtn, { paddingHorizontal: 16, opacity: friendCodeQuery.trim().length < 8 ? 0.5 : 1 }]}
                onPress={onFriendCodeSubmit}
                disabled={friendCodeQuery.trim().length < 8 || friendSearching}
              >
                {friendSearching ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>Search</Text>
                )}
              </Pressable>
            </View>

            {friendCodeError.length > 0 && (
              <Text style={{ color: C.danger, fontSize: 13, textAlign: "center", marginTop: 12 }}>{friendCodeError}</Text>
            )}

            {friendCodeResult && (() => {
              const alreadyFriend = user.friendUids.includes(friendCodeResult.uid);
              const alreadyPending = friendCodeResult.pendingFriendUids?.includes(user.uid);
              return (
                <View style={{ alignItems: "center", marginTop: 16, padding: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }}>
                  <View style={[s.friendAvatar, { width: 56, height: 56, borderRadius: 28 }]}>
                    <Text style={[s.friendAvatarText, { fontSize: 22 }]}>{(friendCodeResult.displayName ?? "?")[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[s.friendName, { fontSize: 17, marginTop: 8 }]}>{friendCodeResult.displayName ?? "Unknown"}</Text>
                  {friendCodeResult.congregationId && (
                    <Text style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Member of a congregation</Text>
                  )}
                  <View style={{ marginTop: 12 }}>
                    {alreadyFriend ? (
                      <View style={[s.acceptBtn, { paddingHorizontal: 20, paddingVertical: 8 }]}>
                        <Text style={[s.acceptBtnText, { fontSize: 14 }]}>Already Friends</Text>
                      </View>
                    ) : alreadyPending ? (
                      <View style={[s.acceptBtn, { paddingHorizontal: 20, paddingVertical: 8 }]}>
                        <Text style={[s.acceptBtnText, { fontSize: 14 }]}>Request Sent</Text>
                      </View>
                    ) : (
                      <Pressable style={[s.primaryBtn, { paddingHorizontal: 24 }]} onPress={() => onSendFriendRequest(friendCodeResult.uid)}>
                        <Text style={s.primaryBtnText}>Send Friend Request</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })()}

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 16 }]} onPress={() => setAddFriendVisible(false)}>
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

            <TextInput placeholder="Search by city..." value={congregationCitySearch} onChangeText={onCitySearchChange} style={s.authInput} placeholderTextColor={C.textLight} />

            {citySuggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                {citySuggestions.map((sug, idx) => (
                  <Pressable key={`${sug.latitude}-${sug.longitude}-${idx}`} style={s.suggestionItem} onPress={() => { setCongregationCitySearch(sug.displayName.split(",")[0]?.trim() ?? sug.displayName); searchCongregationsNearGeo(sug); }}>
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

            <View style={s.createCongSection}>
              <Text style={s.sectionTitle}>Create New</Text>
              <TextInput placeholder="Congregation name" value={newCongregationName} onChangeText={setNewCongregationName} style={s.authInput} placeholderTextColor={C.textLight} />
              <TextInput
                placeholder="Search city..."
                value={newCongregationCity}
                onChangeText={onNewCongCityChange}
                style={[s.authInput, { marginTop: 8 }]}
                placeholderTextColor={C.textLight}
              />
              {newCongCitySuggestions.length > 0 && (
                <View style={s.suggestionsBox}>
                  {newCongCitySuggestions.map((sug, idx) => (
                    <Pressable key={`newcong-${sug.latitude}-${sug.longitude}-${idx}`} style={s.suggestionItem} onPress={() => onSelectNewCongCity(sug)}>
                      <Text style={s.sectionDesc} numberOfLines={1}>{sug.displayName}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
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

function TabItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.tabItem, active && s.tabItemActive]} onPress={onPress}>
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function LeaderboardRow({ profile, rank, isCurrentUser, congregationName, onAvatarPress }: { profile: UserProfile; rank: number; isCurrentUser?: boolean; congregationName?: string | null; onAvatarPress?: () => void }) {
  const hideStreak = !isCurrentUser && profile.streakVisibility === "private";
  return (
    <View style={[s.leaderRow, isCurrentUser && s.leaderRowHighlight]}>
      <Text style={s.leaderRank}>{rank}</Text>
      <Pressable onPress={onAvatarPress} hitSlop={4}>
        <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(profile.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.friendName}>{profile.displayName ?? "Unknown"}{isCurrentUser ? " (You)" : ""}</Text>
        <Text style={s.friendCong}>{congregationName ?? (profile.congregationId ? "In a congregation" : "")}</Text>
      </View>
      {hideStreak ? (
        <Text style={{ fontSize: 11, color: C.textLight }}>Private</Text>
      ) : (
        <View style={s.streakBadges}>
          <View style={s.streakBadge}><Text style={s.streakBadgeText}>{profile.currentStreak ?? 0}</Text></View>
          <View style={s.tefillinStreakBadge}><Text style={s.tefillinStreakBadgeText}>{profile.tefillinCurrentStreak ?? 0}</Text></View>
        </View>
      )}
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
  profileBtn: { padding: 4 },
  profileBtnCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  profileBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },

  /* tab bar */
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg, paddingBottom: 4, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 16 },
  tabItemActive: {},
  tabLabel: { fontSize: 14, fontWeight: "600", color: C.textLight },
  tabLabelActive: { color: C.primary, fontWeight: "800" },

  /* tab content */
  tabContent: { paddingHorizontal: 16, paddingBottom: 16 },

  /* home greeting */
  greeting: { fontSize: 24, fontWeight: "800", color: C.text, marginTop: 8, marginBottom: 16 },

  /* tefillin prompt */
  tefillinPromptBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.primaryLight, borderRadius: 16, padding: 14, marginBottom: 12 },
  tefillinPromptText: { fontSize: 14, fontWeight: "600", color: C.primaryDark, flex: 1 },
  tefillinPromptBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 },
  tefillinPromptBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  /* streaks */
  streakRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  streakCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: "center" },
  streakNumber: { fontSize: 32, fontWeight: "900", color: C.streak },
  streakLabel: { fontSize: 12, fontWeight: "700", color: "#92400E", marginTop: 4 },

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
  blockTitle: { fontSize: 13, fontWeight: "800", color: C.text, textAlign: "center" },
  blockTitleActive: { color: C.primaryDark },
  blockDesc: { fontSize: 10, color: C.textSecondary, textAlign: "center", marginTop: 4 },
  blockDescActive: { color: C.primaryDark },

  customBlockSection: { marginTop: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12, maxHeight: 320, overflow: "hidden" },
  customBlockTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 8 },
  appCategoryHeader: { fontSize: 12, fontWeight: "800", color: C.textSecondary, marginTop: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  appToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  appToggleName: { fontSize: 14, fontWeight: "600", color: C.text },

  /* toggle rows */
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  toggleLabel: { fontSize: 15, fontWeight: "600", color: C.text },
  toggleHint: { fontSize: 11, color: C.textLight, marginTop: 1 },

  /* info icon */
  infoIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  infoIconText: { fontSize: 13, fontWeight: "800", color: C.primary },

  /* inline time section */
  inlineTimeSection: { paddingLeft: 8, paddingTop: 6, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },

  /* time pickers */
  timeSection: { marginTop: 12 },
  timeSectionTitle: { fontSize: 13, fontWeight: "700", color: C.textSecondary, marginBottom: 8 },
  timePills: { gap: 6 },
  timePill: { borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.bg },
  timePillActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  timePillText: { fontSize: 12, fontWeight: "600", color: C.textSecondary },
  timePillTextActive: { color: C.primaryDark, fontWeight: "700" },

  /* calendar icon */
  calendarIconBtn: { padding: 4 },
  calendarIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  /* intent calendar */
  calendarDateItem: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, borderRadius: 8 },
  calendarDateItemActive: { backgroundColor: C.primaryLight },
  calendarDateText: { fontSize: 15, fontWeight: "600", color: C.text },
  calendarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  calendarIntentText: { fontSize: 13, color: C.primaryDark, marginTop: 8, fontStyle: "italic", lineHeight: 18 },

  /* holiday */
  holidayItem: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  holidayName: { fontSize: 15, fontWeight: "700", color: C.text },
  holidayTime: { fontSize: 13, color: C.textSecondary, marginTop: 2 },

  /* prayer overlay */
  prayerHebrew: { fontSize: 20, fontWeight: "600", color: C.text, textAlign: "center", marginTop: 20, lineHeight: 32 },
  prayerEnglish: { fontSize: 14, color: C.textSecondary, textAlign: "center", marginTop: 16, lineHeight: 22, fontStyle: "italic" },

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
  intentInput: { marginTop: 10, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.surface, color: C.text, paddingHorizontal: 14, paddingVertical: 12, minHeight: 120, textAlignVertical: "top", fontSize: 14, lineHeight: 20 },

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
  congIconBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 8, justifyContent: "center", alignItems: "center" },

  /* leaderboard */
  leaderboardHeader: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  leaderboardHeaderText: { fontSize: 14, fontWeight: "800", color: C.textSecondary, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  leaderboardCard: { backgroundColor: C.card, borderRadius: 20, padding: 12, marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

  

  /* friend / leaderboard rows */
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  friendAvatarText: { fontSize: 16, fontWeight: "800", color: C.primary },
  friendName: { fontSize: 15, fontWeight: "700", color: C.text },
  friendCong: { fontSize: 11, color: C.textLight, marginTop: 1 },

  leaderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  leaderRowHighlight: { backgroundColor: C.primaryLight, marginHorizontal: -12, paddingHorizontal: 12, borderRadius: 12 },
  leaderRank: { fontSize: 16, fontWeight: "800", color: C.textLight, width: 24, textAlign: "center" },

  streakBadges: { flexDirection: "row", gap: 6 },
  streakBadge: { backgroundColor: C.streakBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  streakBadgeText: { fontSize: 13, fontWeight: "700", color: "#92400E" },

  acceptBtn: { backgroundColor: C.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: C.primary, fontWeight: "700", fontSize: 12 },
  rejectBtn: { backgroundColor: C.dangerLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 6 },
  rejectBtnText: { color: C.danger, fontWeight: "700", fontSize: 12 },

  socialActions: { marginTop: 8, gap: 8 },
  emptyText: { fontSize: 14, color: C.textLight, textAlign: "center", paddingVertical: 20 },
  emptyCentered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },

  /* chat */
  chatThread: { flex: 1, backgroundColor: C.bg },
  chatThreadPeek: { backgroundColor: C.surface },
  chatList: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 1, justifyContent: "flex-end" },
  buddyChatList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, flexGrow: 1 },
  buddyChatListEmpty: { justifyContent: "center" },
  buddyChatPeekSpacer: { justifyContent: "flex-end", alignItems: "center", paddingBottom: 12 },
  buddyChatPeekLabel: { fontSize: 12, color: C.textLight, fontWeight: "600" },
  chatBubble: { backgroundColor: C.surface, borderRadius: 16, padding: 10, marginBottom: 8, alignSelf: "flex-start", maxWidth: "80%" },
  chatBubbleMine: { backgroundColor: C.primaryLight, alignSelf: "flex-end" },
  chatSender: { fontSize: 11, fontWeight: "700", color: C.primary, marginBottom: 2 },
  chatText: { fontSize: 14, color: C.text },
  chatTextMine: { color: C.primaryDark },
  chatInputRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, gap: 8, backgroundColor: C.bg },
  chatTextInput: { flex: 1, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.text },
  chatSendBtn: { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 20, justifyContent: "center" },
  buddyChatIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center" as const, justifyContent: "center" as const },
  chatSendBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  /* parasha */
  parashaHeader: { fontSize: 16, fontWeight: "700", color: C.textSecondary, marginTop: 8, marginBottom: 8 },
  parashaCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
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

  /* tefillin streak badge (leaderboard) */
  tefillinStreakBadge: { backgroundColor: C.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tefillinStreakBadgeText: { fontSize: 13, fontWeight: "700", color: C.primary },

  /* tefillin buddies section */
  buddiesSection: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  buddiesSectionTitle: { fontSize: 20, fontWeight: "900", color: C.text },
  buddyStreakList: { marginTop: 12 },
  buddyStreakRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  buddyAvatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  buddyAvatarLargeText: { fontSize: 20, fontWeight: "800", color: C.primary },
  buddyAvatarDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.card,
  },
  buddyNameLarge: { fontSize: 16, fontWeight: "700", color: C.text },
  buddyStreakText: { fontSize: 13, fontWeight: "600", color: C.primary },
  buddySnapBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buddySnapBtnText: { color: C.primary, fontWeight: "700", fontSize: 13 },
  buddyRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  buddyRemoveBtnText: { color: C.textLight, fontWeight: "700", fontSize: 12 },
  buddyEmptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  buddyEmptyTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  buddyEmptyDesc: { fontSize: 13, color: C.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 18, paddingHorizontal: 16 },
  buddyAddHeader: { fontSize: 14, fontWeight: "700", color: C.textSecondary, marginBottom: 8 },
  buddyAddRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
});
