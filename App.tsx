import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  Vibration,
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
  deleteUserProfile,
  recordTefillinDay,
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
  scheduleExactReminder,
  scheduleNextReminder,
} from "./src/reminders/reminderScheduler";
import { ReminderType } from "./src/reminders/reminderTypes";
import {
  clearIntentFlowHandler,
  IntentFlowResult,
  setIntentFlowHandler,
} from "./src/shabbatMode/shabbatIntentFlow";
import { cancelScheduledShabbatMode, scheduleShabbatMode } from "./src/shabbatMode/shabbatModeScheduler";
import { getCurrentState, getCurrentWeekId } from "./src/shabbatMode/shabbatModeState";
import { ShabbatModeStatus } from "./src/shabbatMode/shabbatModeTypes";
import {
  checkEmailVerified,
  confirmPhoneSignIn,
  confirmPhoneSignUp,
  createProfileAfterVerification,
  deleteCurrentUser,
  isAppleProvider,
  isCurrentUserEmailVerified,
  isEmailProvider,
  getAuthUserDisplayName,
  resolveProfileDisplayName,
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
  rejectJoinRequest,
  searchCongregations,
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
import { getParashaInfo, getRabbiGordonParashaUrl } from "./src/parasha/parashaData";
import {
  sendCongregationMessage,
  subscribeToCongregationMessages,
  subscribeToLatestCongregationMessage,
  type CongregationMessage,
} from "./src/congregation/congregationMessages";
import {
  sendDirectMessage,
  subscribeToDirectMessages,
  subscribeToLatestDirectMessage,
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
  unsaveMessageFromChat,
  purgeExpiredMessages,
} from "./src/friends/buddyChatService";
import { BuddyChat, BuddyMessage } from "./src/friends/buddyChatTypes";
import { getCachedZmanim, getSunWindowMessage, isWithinSunWindow } from "./src/friends/zmanimService";
import { evaluateAllStreaks } from "./src/friends/streakEvaluator";
import {
  WEEKLY_VIDEO_UPLOADER_EMAIL,
  canUploadWeeklyVideo,
  deleteWeeklyVideo,
  getWeeklyVideo,
  uploadWeeklyVideo,
} from "./src/videos/weeklyVideoService";
import { WeeklyVideo } from "./src/videos/weeklyVideoTypes";
import {
  clearChatPushToken,
  registerForChatPushNotifications,
  subscribeToChatPushTokenRefresh,
} from "./src/notifications/pushRegistration";
import {
  cancelScheduledScreenTimeBlock,
  enablePersonalBlocking,
  enableFullAppBlocking,
  disableAllBlocking,
  getFamilyActivitySelectionSummary,
  presentFamilyActivityPicker,
  requestScreenTimePermission,
  scheduleScreenTimeBlock,
  setScreenTimeBlockMode,
  setScreenTimeShieldReason,
} from "./src/ios/screenTimeService";
import { requestNotificationPermission } from "./src/ios/notificationsService";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";

/* ─── theme ──────────────────────────────────────────────────── */

const WEEKLY_VIDEO_FEATURE_ENABLED = false;
const DEFAULT_SHABBAT_INTENTION = "To connect with Hashem";
const DUMMY_APP_STORE_LINK = "https://apps.apple.com/app/kesher-social/id0000000000";

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

type TabKey = "parasha" | "block" | "home" | "social" | "buddies";
type UserSex = "male" | "female" | "";
type SocialSubTab = "friends" | "chat" | "dm" | "buddyChat" | "groupCreate";
type BlockLevel = "full" | "custom" | "none";
type PhoneCountry = {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
};
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
const INTENT_HISTORY_KEY = "intentHistory:v1";
const TEFILLIN_DATE_KEY_PREFIX = "tefillinConfirmedDay:v2:";
const TEFILLIN_IGNORE_KEY_PREFIX = "tefillinPromptIgnoredDay:v2:";
const TEFILLIN_HANDLED_DAY_KEY_PREFIX = "tefillinPromptHandledDay:v1:";
const DIRECT_CHAT_READ_KEY_PREFIX = "directChatRead:v1:";
const CONGREGATION_CHAT_READ_KEY_PREFIX = "congregationChatRead:v1:";
const HOLIDAY_OPTIN_KEY = "holidayOptIn:v1";
const PERSONAL_BLOCK_ENDS_AT_KEY = "personalBlockEndsAt:v1";
const PERSONAL_BLOCK_SUCCESS_COUNT_KEY = "personalBlockSuccessCount:v1";
const PERSONAL_BLOCK_BROKEN_COUNT_KEY = "personalBlockBrokenCount:v1";
const MODEH_ANI_DONE_PREFIX = "modehAniDone:v1:";
const SHEMA_DONE_PREFIX = "shemaDone:v1:";
// How long (in minutes) after a prayer's scheduled time the in-app blocking
// overlay stays "due". Bounding this keeps a morning prayer from surfacing in
// the evening (and vice-versa), so toggling one prayer can't trigger the other.
const MODEH_ANI_WINDOW_MIN = 240; // morning: 4 hours after wake-up
const SHEMA_WINDOW_MIN = 300; // night: 5 hours after (bed time − 15 min)
const FOCUS_DIAL_MAX_MINUTES = 180;
const FOCUS_DIAL_STEP_MINUTES = 5;
const FOCUS_DIAL_SIZE = 230;
const FOCUS_DIAL_KNOB_SIZE = 30;
const FOCUS_DIAL_RADIUS = FOCUS_DIAL_SIZE / 2 - 9;

const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "US", name: "United States", dialCode: "+1", flag: "US" },
  { iso: "CA", name: "Canada", dialCode: "+1", flag: "CA" },
  { iso: "IL", name: "Israel", dialCode: "+972", flag: "IL" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44", flag: "GB" },
  { iso: "FR", name: "France", dialCode: "+33", flag: "FR" },
  { iso: "AU", name: "Australia", dialCode: "+61", flag: "AU" },
  { iso: "MX", name: "Mexico", dialCode: "+52", flag: "MX" },
  { iso: "BR", name: "Brazil", dialCode: "+55", flag: "BR" },
  { iso: "AR", name: "Argentina", dialCode: "+54", flag: "AR" },
  { iso: "ZA", name: "South Africa", dialCode: "+27", flag: "ZA" },
  { iso: "DE", name: "Germany", dialCode: "+49", flag: "DE" },
  { iso: "ES", name: "Spain", dialCode: "+34", flag: "ES" },
  { iso: "IT", name: "Italy", dialCode: "+39", flag: "IT" },
  { iso: "NL", name: "Netherlands", dialCode: "+31", flag: "NL" },
];

const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

const formatPhoneForFirebase = (country: PhoneCountry, localPhone: string): string => {
  const trimmed = localPhone.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.replace(/[^\d]/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  return `${country.dialCode}${digits}`;
};


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

const PRIVACY_POLICY_LAST_UPDATED = "May 27, 2026";
const PRIVACY_POLICY_SECTIONS: { title: string; body: string }[] = [
  {
    title: "Information We Collect",
    body:
      "Kesher may collect account information such as your name, email address, sign-in provider, profile settings, reminders, streaks, congregation membership, friend connections, chat messages, tefillin buddy activity, photos you choose to send, approximate location, timezone, and push notification token.",
  },
  {
    title: "How We Use Information",
    body:
      "We use this information to run the app, authenticate your account, calculate Shabbat and tefillin times, manage reminders and Screen Time blocking, support friend and congregation features, sync chats, send notifications you enable, and maintain app safety and reliability.",
  },
  {
    title: "Third-Party Services",
    body:
      "Kesher uses Firebase for authentication, database, storage, and notifications; Apple and Google for sign-in and platform services; HebCal for zmanim calculations; and OpenStreetMap Nominatim for city search. These services may process data according to their own privacy policies.",
  },
  {
    title: "Your Choices",
    body:
      "You can control location, camera, photos, notifications, and Screen Time permissions in your device settings. In Kesher, you can adjust privacy settings, disable chat notifications, hide streaks, and delete your account from Settings.",
  },
  {
    title: "Data Retention",
    body:
      "We keep account and app data while your account is active or as needed to provide the service. Deleting your account removes your profile from the app database, but some messages, backups, logs, or data already shared with others may remain for a limited time or as required by law.",
  },
];

const PRAYER_TEXTS = {
  modehAni: {
    hebrew: "מוֹדֶה אֲנִי לְפָנֶיךָ מֶלֶךְ חַי וְקַיָּם, שֶׁהֶחֱזַרְתָּ בִּי נִשְׁמָתִי בְּחֶמְלָה, רַבָּה אֱמוּנָתֶךָ.",
    transliteration:
      "Modeh ani lefanecha, Melech chai v'kayam, shehechezarta bi nishmati b'chemlah, rabbah emunatecha.",
    english: "I gratefully thank You, living and eternal King, for You have returned my soul within me with compassion — abundant is Your faithfulness.",
  },
  shema: {
    hebrew: "שְׁמַע יִשְׂרָאֵל יְהוָה אֱלֹהֵינוּ יְהוָה אֶחָד.\nבָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד.",
    transliteration:
      "Shema Yisrael, Adonai Eloheinu, Adonai Echad.\nBaruch shem kevod malchuto l'olam va'ed.",
    english: "Hear, O Israel: The Lord is our God, the Lord is One.\nBlessed is the name of His glorious kingdom forever and ever.",
  },
  veahavta: {
    hebrew:
      "וְאָהַבְתָּ אֵת יְהוָה אֱלֹהֶיךָ, בְּכָל לְבָבְךָ וּבְכָל נַפְשְׁךָ וּבְכָל מְאֹדֶךָ.\nוְהָיוּ הַדְּבָרִים הָאֵלֶּה אֲשֶׁר אָנֹכִי מְצַוְּךָ הַיּוֹם עַל לְבָבֶךָ.",
    transliteration:
      "V'ahavta et Adonai Elohecha, b'chol l'vavcha uv'chol nafsh'cha uv'chol m'odecha.\nV'hayu had'varim ha'eileh asher anochi m'tzav'cha hayom al l'vavecha.",
    english:
      "You shall love the Lord your God with all your heart, with all your soul, and with all your might.\nThese words that I command you today shall be upon your heart.",
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

// Shown full-screen while a personal focus block is active. A calm, randomly
// chosen reminder about patience and self-mastery.
const FOCUS_QUOTES: string[] = [
  "Patience is a tree whose root is bitter, but its fruit is very sweet.",
  "Who is mighty? One who conquers their own impulse. — Pirkei Avot 4:1",
  "The reward is according to the effort. — Pirkei Avot 5:23",
  "Stillness is not doing nothing. It is letting the noise settle so you can hear what matters.",
  "Every moment you wait is a moment you choose yourself over the urge.",
  "A small act of restraint today builds a stronger you tomorrow.",
  "Be strong as a leopard, light as an eagle, swift as a deer to do the will of Heaven. — Pirkei Avot 5:20",
  "The river cuts through rock not because of its power, but its persistence.",
  "Silence the noise, and your own thoughts become a teacher.",
  "You are not missing out. You are choosing in.",
  "Discipline is choosing between what you want now and what you want most.",
  "The phone can wait. This moment cannot be lived twice.",
];

const defaultRestrictions: RestrictionSetting[] = [];

const defaultShabbatUiState: ShabbatUiState = {
  lastIntentPromptWeekId: null,
  optedOutWeekId: null,
  firstRestrictionPromptWeekId: null,
};

const BLOCK_INFO: Record<BlockLevel, { title: string; desc: string }> = {
  full: { title: "Full Block", desc: "Block all apps during Shabbat." },
  custom: { title: "Custom Block", desc: "Block selected apps." },
  none: { title: "No Block", desc: "No apps blocked." },
};

/* ─── helpers ────────────────────────────────────────────────── */

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const nextLocalDateForTime = (time: string, skipToday = false): Date => {
  const [hStr, mStr] = to24h(time).split(":");
  const now = new Date();
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Number(hStr),
    Number(mStr),
    0,
    0
  );

  if (skipToday || candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
};

const endOfLocalDay = (date: Date): Date =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    0
  );

const minutesFromHHMM = (time: string): number => {
  const [hStr, mStr] = to24h(time).split(":");
  return Number(hStr) * 60 + Number(mStr);
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
const localDateStr = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const tefillinDateKey = (uid: string): string => `${TEFILLIN_DATE_KEY_PREFIX}${uid}`;
const tefillinIgnoreKey = (uid: string): string => `${TEFILLIN_IGNORE_KEY_PREFIX}${uid}`;
const tefillinHandledDayKey = (uid: string): string => `${TEFILLIN_HANDLED_DAY_KEY_PREFIX}${uid}`;
const directChatReadKey = (uid: string, friendUid: string): string =>
  `${DIRECT_CHAT_READ_KEY_PREFIX}${uid}:${[uid, friendUid].sort().join("_")}`;
const congregationChatReadKey = (uid: string, congregationId: string): string =>
  `${CONGREGATION_CHAT_READ_KEY_PREFIX}${uid}:${congregationId}`;

const formatCountdown = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const haptic = (duration = 8): void => {
  Vibration.vibrate(duration);
};

const renderFocusDialTicks = (
  progress: number,
  size = FOCUS_DIAL_SIZE,
  radius = FOCUS_DIAL_RADIUS
) => {
  const total = 72;
  const clamped = Math.max(0, Math.min(1, progress));
  return Array.from({ length: total }).map((_, index) => {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const degrees = (angle + Math.PI / 2) * (180 / Math.PI);
    const isMajor = index % 6 === 0;
    const isActive = index / total <= clamped;
    const width = isMajor ? 3 : 2;
    const height = isMajor ? 16 : 10;
    return (
      <View
        key={`focus-tick-${index}`}
        style={{
          position: "absolute",
          left: size / 2 + Math.cos(angle) * radius - width / 2,
          top: size / 2 + Math.sin(angle) * radius - height / 2,
          width,
          height,
          borderRadius: width,
          backgroundColor: isActive ? C.primary : "#DBEAFE",
          transform: [{ rotate: `${degrees}deg` }],
        }}
      />
    );
  });
};

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

/* ─── splash ──────────────────────────────────────────────────── */

function AppSplash({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");
  const translateX = useRef(new Animated.Value(-width / 2 - 60)).current;
  const translateY = useRef(new Animated.Value(-height / 2 - 60)).current;
  const scale = useRef(new Animated.Value(0.35)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelShift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Bounce in from the top-left corner to the center.
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6, tension: 55 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 6, tension: 55 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 55 }),
      ]),
      // 2. Spin + pulse flourish while the wordmark fades up.
      Animated.parallel([
        Animated.timing(rotate, { toValue: 1, duration: 680, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.22, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 340, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(labelOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(labelShift, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(280),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onDone());
    // Run the intro animation exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={[s.splashContainer, { opacity: overlayOpacity }]}>
      <StatusBar barStyle="dark-content" />
      <Animated.View
        style={[
          s.splashStarCircle,
          { transform: [{ translateX }, { translateY }, { scale }, { rotate: spin }] },
        ]}
      >
        <Text style={s.splashStar}>✡︎</Text>
      </Animated.View>
      <Animated.Text
        style={[s.splashWordmark, { opacity: labelOpacity, transform: [{ translateY: labelShift }] }]}
      >
        Shabbat Shalom
      </Animated.Text>
    </Animated.View>
  );
}

function AppCover() {
  return (
    <View style={s.appCover}>
      <View style={s.splashStarCircle}>
        <Text style={s.splashStar}>✡︎</Text>
      </View>
      <Text style={s.appCoverWordmark}>Shabbat Shalom</Text>
      <Text style={s.appCoverSubtitle}>Keep Shabbat with intention</Text>
    </View>
  );
}

/* ─── app ─────────────────────────────────────────────────────── */

export default function App() {
  /* ── splash ── */
  const [showSplash, setShowSplash] = useState(true);

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
  const [authPhoneCountry, setAuthPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [signupPhoneCountry, setSignupPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [phoneCountryPickerFor, setPhoneCountryPickerFor] = useState<"login" | "signup" | null>(null);
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [signupName, setSignupName] = useState("");
  const [signupSex, setSignupSex] = useState<UserSex>("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPhoneCode, setSignupPhoneCode] = useState("");
  const [signupPhoneConfirmation, setSignupPhoneConfirmation] = useState<PhoneAuthConfirmation | null>(null);
  const [pendingEmailVerification, setPendingEmailVerification] = useState(false);
  const [pendingSignupData, setPendingSignupData] = useState<{ name: string; sex: UserSex } | null>(null);
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
  const [profileSex, setProfileSex] = useState<UserSex>("");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [privacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);

  /* ── shabbat / restrictions ── */
  const [restrictions, setRestrictions] = useState<RestrictionSetting[]>(defaultRestrictions);
  const [shabbatUiState, setShabbatUiState] = useState<ShabbatUiState>(defaultShabbatUiState);
  const [blockLevel, setBlockLevel] = useState<BlockLevel>("none");
  const [customSelectionCount, setCustomSelectionCount] = useState(0);
  const [personalBlockSelectionCount, setPersonalBlockSelectionCount] = useState(0);
  const [personalBlockMinutes, setPersonalBlockMinutes] = useState(30);
  const [personalBlockEndsAt, setPersonalBlockEndsAt] = useState<Date | null>(null);
  const [personalBlockSuccessCount, setPersonalBlockSuccessCount] = useState(0);
  const [personalBlockBrokenCount, setPersonalBlockBrokenCount] = useState(0);
  const [focusClockTick, setFocusClockTick] = useState(0);
  const [focusDialDragging, setFocusDialDragging] = useState(false);
  const [focusQuote, setFocusQuote] = useState<string>("");
  // Cooling-off period (seconds) before a focus block is actually lifted, so a
  // user can change their mind and re-block during the countdown.
  const [focusUnblockCountdown, setFocusUnblockCountdown] = useState<number | null>(null);
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

  /* ── vertical time picker (wake / bed) ── */
  const [timePickerKind, setTimePickerKind] = useState<"wake" | "bed" | null>(null);

  /* ── prayer blocking overlay (blocks apps until user acknowledges) ──
     This is the single Modeh Ani / Shema flow. It only triggers at the
     wake/bed time the user picked, and only once per day (per prayer). */
  const [prayerBlockingType, setPrayerBlockingType] = useState<"modehAni" | "shema" | null>(null);
  const [showPrayerTransliteration, setShowPrayerTransliteration] = useState(false);
  const [shemaPrayerPage, setShemaPrayerPage] = useState<0 | 1>(0);

  /* ── break shabbat confirmation ── */
  const [showBreakConfirm, setShowBreakConfirm] = useState(false);
  const [shabbatBrokenLocally, setShabbatBrokenLocally] = useState(false);

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
  const citySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [createCongregationVisible, setCreateCongregationVisible] = useState(false);

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
  const [hasUnreadCongregationChat, setHasUnreadCongregationChat] = useState(false);

  /* ── direct messages ── */
  const [chattingWith, setChattingWith] = useState<UserProfile | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [unreadDmUids, setUnreadDmUids] = useState<Record<string, boolean>>({});

  /* ── tefillin buddies ── */
  const [showBuddyInfo, setShowBuddyInfo] = useState(false);
  const [buddyActionLoading, setBuddyActionLoading] = useState(false);

  /* ── buddy chat ── */
  const [buddyChats, setBuddyChats] = useState<BuddyChat[]>([]);
  const [activeBuddyChat, setActiveBuddyChat] = useState<BuddyChat | null>(null);
  const [buddyChatMessages, setBuddyChatMessages] = useState<BuddyMessage[]>([]);
  const [buddyChatInput, setBuddyChatInput] = useState("");
  const [buddyChatImageLoading, setBuddyChatImageLoading] = useState(false);
  const [viewingBuddyImage, setViewingBuddyImage] = useState<BuddyMessage | null>(null);
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

  /* ── weekly video ── */
  const [weeklyVideo, setWeeklyVideo] = useState<WeeklyVideo | null>(null);
  const [weeklyVideoLoading, setWeeklyVideoLoading] = useState(false);

  /* ── streak evaluation guard (once per app session) ── */
  const streakEvalDone = useRef(false);
  const buddyChatListRef = useRef<FlatList<BuddyMessage> | null>(null);
  const buddyChatShouldSnapRef = useRef(false);
  const focusDialRef = useRef<View | null>(null);
  const lastIntentSyncKeyRef = useRef<string | null>(null);
  const manualTefillinPromptOpenRef = useRef(false);
  const tefillinDeclinedSessionRef = useRef<Record<string, boolean>>({});

  /* ── animation ── */
  const tabContentAnim = useRef(new Animated.Value(1)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;
  const prevTabIndexRef = useRef<number | null>(null);
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

  const isWeeklyVideoUploader = useMemo(() => {
    if (!user) return false;
    return canUploadWeeklyVideo(user.email);
  }, [user]);

  const currentWeekDate = useMemo(() => {
    return shabbatTimes?.shabbatStart?.toISOString().slice(0, 10) ?? todayDateStr();
  }, [shabbatTimes]);
  const currentWeekIntent = intentHistory[currentWeekDate] ?? null;

  const isShabbatNow = useMemo(() => {
    if (!shabbatTimes) return false;
    const now = Date.now();
    return now >= shabbatTimes.shabbatStart.getTime() && now < shabbatTimes.shabbatEnd.getTime();
  }, [shabbatTimes]);

  // Tefillin is not worn on Shabbat (Saturday). Treat the whole local Saturday
  // as a rest day so streaks take a gap and photos/streak updates are disabled.
  const isSaturdayToday = useMemo(() => new Date().getDay() === 6, [appForegroundTick]);
  const isTefillinRestDay = isShabbatNow || isSaturdayToday;

  const homeCity = useMemo(() => {
    if (city !== "Unknown city") return cleanCity(city);
    return cleanCity(shabbatTimes?.cityName);
  }, [city, shabbatTimes?.cityName]);

  const parashaInfo = useMemo(() => {
    if (!shabbatTimes?.parsha) return null;
    return getParashaInfo(shabbatTimes.parsha);
  }, [shabbatTimes?.parsha]);

  const upcomingHolidays = useMemo(() => {
    const now = Date.now();
    return (shabbatTimes?.holidays ?? []).filter((holiday) => {
      const relevantUntil = holiday.havdalah ?? holiday.candleLighting;
      return relevantUntil !== null && relevantUntil.getTime() >= now;
    });
  }, [appForegroundTick, shabbatTimes?.holidays]);

  const effectiveBlockLevel = useMemo((): BlockLevel => {
    return blockLevel;
  }, [blockLevel]);

  const isStreakEligible = effectiveBlockLevel !== "none";
  const shabbatBlockIsActive = isShabbatNow && blockLevel !== "none" && savedIntentText.trim().length > 0 && !shabbatBrokenLocally;
  const focusNowMs = useMemo(() => Date.now(), [focusClockTick]);
  const personalBlockRemainingMs = personalBlockEndsAt ? personalBlockEndsAt.getTime() - focusNowMs : 0;
  const personalBlockIsActive = personalBlockRemainingMs > 0;
  const focusDialProgress = personalBlockMinutes / FOCUS_DIAL_MAX_MINUTES;
  const focusDialAngle = focusDialProgress * Math.PI * 2 - Math.PI / 2;
  const focusDialKnobStyle = {
    left: FOCUS_DIAL_SIZE / 2 + Math.cos(focusDialAngle) * FOCUS_DIAL_RADIUS - FOCUS_DIAL_KNOB_SIZE / 2,
    top: FOCUS_DIAL_SIZE / 2 + Math.sin(focusDialAngle) * FOCUS_DIAL_RADIUS - FOCUS_DIAL_KNOB_SIZE / 2,
  };
  const tefillinBuddyUids = useMemo(() => user?.tefillinBuddyUids ?? [], [user?.tefillinBuddyUids]);
  const hasTefillinBuddies = tefillinBuddyUids.length > 0;
  const isFemaleUser = user?.gender === "female";
  const visibleTabs = useMemo<TabKey[]>(
    () => (isFemaleUser ? ["parasha", "block", "home", "social"] : ["parasha", "block", "home", "social", "buddies"]),
    [isFemaleUser]
  );

  // The user's individual tefillin streak — tracked per-person based on whether
  // they themselves wrapped each day, independent of any buddy's streak.
  const displayTefillinStreak = user?.tefillinCurrentStreak ?? 0;

  const buddyChatSavedPeekOnly = useMemo(() => {
    if (!user || buddyChatMessages.length === 0) return false;
    return buddyChatMessages.every((message) => message.savedByUids?.includes(user.uid));
  }, [buddyChatMessages, user]);

  const buddyChatPeekHeight = useMemo(() => {
    if (!buddyChatSavedPeekOnly) return 0;
    return Math.max(buddyChatViewportHeight, 180);
  }, [buddyChatSavedPeekOnly, buddyChatViewportHeight]);
  const displayedChatMessages = useMemo(
    () => [...chatMessages].reverse(),
    [chatMessages]
  );
  const displayedDmMessages = useMemo(
    () => [...dmMessages].reverse(),
    [dmMessages]
  );
  const hasUnreadDirectMessages = useMemo(
    () => Object.values(unreadDmUids).some(Boolean),
    [unreadDmUids]
  );
  const hasUnreadSocialMessages = hasUnreadCongregationChat || hasUnreadDirectMessages;

  const markDirectChatRead = useCallback((friendUid: string, readAtMs = Date.now()) => {
    if (!user?.uid) return;
    setUnreadDmUids((prev) => {
      if (!prev[friendUid]) return prev;
      const next = { ...prev };
      delete next[friendUid];
      return next;
    });
    AsyncStorage.setItem(directChatReadKey(user.uid, friendUid), String(readAtMs)).catch(() => {});
  }, [user?.uid]);

  const markCongregationChatRead = useCallback((readAtMs = Date.now()) => {
    if (!user?.uid || !user.congregationId) return;
    setHasUnreadCongregationChat(false);
    AsyncStorage.setItem(congregationChatReadKey(user.uid, user.congregationId), String(readAtMs)).catch(() => {});
  }, [user?.congregationId, user?.uid]);

  const updateFocusMinutesFromPoint = useCallback((x: number, y: number, originX = 0, originY = 0) => {
    const center = FOCUS_DIAL_SIZE / 2;
    const dx = x - originX - center;
    const dy = y - originY - center;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const rawMinutes = Math.max(FOCUS_DIAL_STEP_MINUTES, Math.round((angle / (Math.PI * 2)) * FOCUS_DIAL_MAX_MINUTES));
    const stepped = Math.max(
      FOCUS_DIAL_STEP_MINUTES,
      Math.min(FOCUS_DIAL_MAX_MINUTES, Math.round(rawMinutes / FOCUS_DIAL_STEP_MINUTES) * FOCUS_DIAL_STEP_MINUTES)
    );
    setPersonalBlockMinutes(stepped);
  }, []);

  const updateFocusMinutesFromGesture = useCallback((pageX: number, pageY: number) => {
    focusDialRef.current?.measureInWindow((x, y) => {
      updateFocusMinutesFromPoint(pageX, pageY, x, y);
    });
  }, [updateFocusMinutesFromPoint]);

  const goToAdjacentTab = useCallback((direction: "next" | "prev") => {
    const currentIndex = visibleTabs.indexOf(activeTab);
    if (currentIndex === -1) return;
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const nextTab = visibleTabs[nextIndex];
    if (!nextTab) return;
    if (nextTab === "social") setSocialSubTab("friends");
    if (nextTab === "buddies") setSocialSubTab("friends");
    setActiveTab(nextTab);
  }, [activeTab, visibleTabs]);

  const tabSwipePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
      Math.abs(gestureState.dx) > 28 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
    onPanResponderRelease: (_event, gestureState) => {
      // Commit on a clear horizontal drag OR a quick flick.
      const committed = Math.abs(gestureState.dx) > 70 || Math.abs(gestureState.vx) > 0.35;
      if (!committed) return;
      if (gestureState.dx < 0) goToAdjacentTab("next");
      else goToAdjacentTab("prev");
    },
  }), [goToAdjacentTab]);

  const focusDialPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onShouldBlockNativeResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      setFocusDialDragging(true);
      updateFocusMinutesFromGesture(event.nativeEvent.pageX, event.nativeEvent.pageY);
    },
    onPanResponderMove: (event) => {
      updateFocusMinutesFromGesture(event.nativeEvent.pageX, event.nativeEvent.pageY);
    },
    onPanResponderRelease: () => {
      setFocusDialDragging(false);
    },
    onPanResponderTerminate: () => {
      setFocusDialDragging(false);
    },
  }), [updateFocusMinutesFromGesture]);

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
      manualTefillinPromptOpenRef.current = false;
      setSoloTefillinPromptVisible(false);
      return;
    }
    if (isFemaleUser) {
      setTefillinConfirmedToday(false);
      manualTefillinPromptOpenRef.current = false;
      setSoloTefillinPromptVisible(false);
      return;
    }
    if (hasTefillinBuddies) {
      setTefillinConfirmedToday(false);
      if (!manualTefillinPromptOpenRef.current) {
        setSoloTefillinPromptVisible(false);
      }
      return;
    }
    // Tefillin is not worn on Shabbat (Saturday). Suppress the prompt entirely.
    if (new Date().getDay() === 6) {
      setTefillinConfirmedToday(false);
      manualTefillinPromptOpenRef.current = false;
      setSoloTefillinPromptVisible(false);
      return;
    }
    const promptDay = await getSoloTefillinPromptDay();
    const today = localDateStr();
    const [answeredDay, ignoredDay, handledDay] = await Promise.all([
      AsyncStorage.getItem(tefillinDateKey(user.uid)),
      AsyncStorage.getItem(tefillinIgnoreKey(user.uid)),
      AsyncStorage.getItem(tefillinHandledDayKey(user.uid)),
    ]);
    const confirmed = answeredDay === promptDay;
    setTefillinConfirmedToday(confirmed);
    const alreadyHandledToday = handledDay === today;
    const ignoredToday = ignoredDay === today;
    const declinedThisSession = tefillinDeclinedSessionRef.current[user.uid] === true;
    if (!manualTefillinPromptOpenRef.current) {
      setSoloTefillinPromptVisible(!confirmed && !alreadyHandledToday && !ignoredToday && !declinedThisSession);
    }
  }, [getSoloTefillinPromptDay, hasTefillinBuddies, isFemaleUser, user]);

  const schedulePrayerScreenTimeBlocks = useCallback(async (profile: UserProfile) => {
    const todayKey = todayDateStr();

    if (profile.wantsModehAniReminder && profile.wakeUpTime) {
      const doneToday = await AsyncStorage.getItem(`${MODEH_ANI_DONE_PREFIX}${todayKey}`);
      const startDate = nextLocalDateForTime(profile.wakeUpTime, doneToday === "true");
      await scheduleScreenTimeBlock("modehAni", startDate, endOfLocalDay(startDate));
    } else {
      await cancelScheduledScreenTimeBlock("modehAni");
    }

    if (profile.wantsShemaReminder && profile.bedTime) {
      const doneToday = await AsyncStorage.getItem(`${SHEMA_DONE_PREFIX}${todayKey}`);
      const shemaBlockTime = addMinutesToTimeStr(profile.bedTime, -15);
      const startDate = nextLocalDateForTime(shemaBlockTime, doneToday === "true");
      await scheduleScreenTimeBlock("shema", startDate, endOfLocalDay(startDate));
    } else {
      await cancelScheduledScreenTimeBlock("shema");
    }
  }, []);

  /* ── prayer blocking (Modeh Ani / Shema block apps until read) ──
     Behaves like a Screen Time block: only triggers if the user enabled
     the toggle AND set a wake/bed time AND that time has arrived today.
     Once dismissed, a per-day flag suppresses it for the rest of the day. */
  const checkPrayerBlocking = useCallback(async () => {
    if (!user) return;

    // If Shabbat mode is currently active it already blocks all apps —
    // don't layer the prayer blocker on top (and don't risk toggling
    // the shared screen-time blocker out from under it).
    const shabbatActive = getCurrentState().status === ShabbatModeStatus.ACTIVE || shabbatBlockIsActive;
    if (shabbatActive) {
      setPrayerBlockingType(null);
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayKey = todayDateStr();
    // Minutes elapsed since a scheduled time, wrapping across midnight so a
    // late-night prayer that crosses 00:00 is still measured correctly.
    const minutesSince = (dueMinutes: number): number => {
      let diff = currentMinutes - dueMinutes;
      if (diff < 0) diff += 1440;
      return diff;
    };
    const duePrayers: { type: "modehAni" | "shema"; elapsed: number }[] = [];

    if (user.wantsModehAniReminder && user.wakeUpTime) {
      const wakeMinutes = minutesFromHHMM(user.wakeUpTime);
      const doneKey = `${MODEH_ANI_DONE_PREFIX}${todayKey}`;
      const done = await AsyncStorage.getItem(doneKey);
      const elapsed = minutesSince(wakeMinutes);
      if (!done && elapsed <= MODEH_ANI_WINDOW_MIN) {
        duePrayers.push({ type: "modehAni", elapsed });
      }
    }

    if (user.wantsShemaReminder && user.bedTime) {
      const bedMinutes = minutesFromHHMM(addMinutesToTimeStr(user.bedTime, -15));
      const doneKey = `${SHEMA_DONE_PREFIX}${todayKey}`;
      const done = await AsyncStorage.getItem(doneKey);
      const elapsed = minutesSince(bedMinutes);
      if (!done && elapsed <= SHEMA_WINDOW_MIN) {
        duePrayers.push({ type: "shema", elapsed });
      }
    }

    if (duePrayers.length > 0) {
      // If (rarely) both are active, show the one whose time arrived most
      // recently so we never surface a stale prayer over the current one.
      const nextPrayer = duePrayers.sort((a, b) => a.elapsed - b.elapsed)[0];
      setPrayerBlockingType(nextPrayer.type);
      setScreenTimeShieldReason(nextPrayer.type).catch(() => {});
      enableFullAppBlocking().catch(() => {});
      return;
    }

    setPrayerBlockingType(null);
  }, [shabbatBlockIsActive, user]);

  const onDismissPrayerBlocking = useCallback(async () => {
    const todayKey = todayDateStr();
    const dismissedType = prayerBlockingType;
    if (prayerBlockingType === "modehAni") {
      await AsyncStorage.setItem(`${MODEH_ANI_DONE_PREFIX}${todayKey}`, "true");
    } else if (prayerBlockingType === "shema") {
      await AsyncStorage.setItem(`${SHEMA_DONE_PREFIX}${todayKey}`, "true");
    }
    setPrayerBlockingType(null);
    if (dismissedType) {
      await cancelScheduledScreenTimeBlock(dismissedType);
    }
    // Only release the screen-time block if Shabbat mode isn't keeping it on.
    if (getCurrentState().status !== ShabbatModeStatus.ACTIVE) {
      disableAllBlocking().catch(() => {});
    }
    if (user) {
      schedulePrayerScreenTimeBlocks(user).catch(() => {});
    }
  }, [prayerBlockingType, schedulePrayerScreenTimeBlocks, user]);

  useEffect(() => {
    checkPrayerBlocking().catch(() => {});
  }, [appForegroundTick, checkPrayerBlocking]);

  useEffect(() => {
    if (prayerBlockingType === "shema") {
      setShemaPrayerPage(0);
    }
  }, [prayerBlockingType]);

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
    if (level !== "none" && !intentHistory[currentWeekDate]?.trim()) {
      Alert.alert(
        "Intention Required",
        "Save your weekly Shabbat intention before turning on blocking."
      );
      return;
    }

    if (level === "custom") {
      if (customSelectionCount < 1) {
        const result = await presentFamilyActivityPicker("custom", "Pick Apps To Block");
        if (result.cancelled || result.count < 1) {
          Alert.alert(
            "Selection Required",
            "Pick at least one app, category, or website before using this block level."
          );
          return;
        }
        setCustomSelectionCount(result.count);
      }
    }

    setBlockLevel(level);
    await AsyncStorage.setItem(BLOCK_LEVEL_KEY, level);
    await setScreenTimeBlockMode(level);
  }, [currentWeekDate, customSelectionCount, intentHistory]);

  const onCustomizeShabbatBlock = useCallback(async () => {
    try {
      const result = await presentFamilyActivityPicker("custom", "Choose Apps for Shabbat");
      if (result.cancelled) return;
      if (result.count <= 0) {
        Alert.alert(
          "Selection Required",
          "Pick at least one app, category, or website before using Custom Block."
        );
        return;
      }
      setCustomSelectionCount(result.count);
      if (blockLevel === "custom") {
        await setScreenTimeBlockMode("custom");
      }
    } catch (error) {
      Alert.alert("Custom Block", errorMessage(error, "Could not open app picker."));
    }
  }, [blockLevel]);

  const onSetupPersonalBlock = useCallback(async () => {
    try {
      const result = await presentFamilyActivityPicker("personal", "Choose Apps to Block");
      if (!result.cancelled) {
        setPersonalBlockSelectionCount(result.count);
        if (personalBlockEndsAt && personalBlockEndsAt.getTime() > Date.now() && result.count > 0) {
          await setScreenTimeShieldReason("personal");
          await enablePersonalBlocking();
        }
      }
    } catch (error) {
      Alert.alert("Block Setup", errorMessage(error, "Could not open app picker."));
    }
  }, [personalBlockEndsAt]);

  const onStartPersonalBlock = useCallback(async () => {
    if (shabbatBlockIsActive) {
      Alert.alert("Shabbat Block Active", "You cannot start another block while Shabbat blocking is active.");
      return;
    }

    try {
      let count = personalBlockSelectionCount;
      if (count <= 0) {
        const result = await presentFamilyActivityPicker("personal", "Choose Apps to Block");
        if (result.cancelled || result.count <= 0) {
          Alert.alert("Selection Required", "Pick at least one app, category, or website to block.");
          return;
        }
        count = result.count;
        setPersonalBlockSelectionCount(result.count);
      }

      const parsedMinutes = Math.max(FOCUS_DIAL_STEP_MINUTES, Math.min(FOCUS_DIAL_MAX_MINUTES, personalBlockMinutes));
      setPersonalBlockMinutes(parsedMinutes);
      const endDate = new Date(Date.now() + parsedMinutes * 60000);
      await setScreenTimeShieldReason("personal");
      await enablePersonalBlocking();
      await scheduleScreenTimeBlock("personal", new Date(Date.now() + 1000), endDate);
      setPersonalBlockEndsAt(endDate);
      setFocusQuote(FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)] ?? FOCUS_QUOTES[0]);
      setFocusUnblockCountdown(null);
      await AsyncStorage.setItem(PERSONAL_BLOCK_ENDS_AT_KEY, endDate.toISOString());
    } catch (error) {
      Alert.alert("Block", errorMessage(error, "Could not start block."));
    }
  }, [personalBlockMinutes, personalBlockSelectionCount, shabbatBlockIsActive]);

  const onStopPersonalBlock = useCallback(async () => {
    try {
      await cancelScheduledScreenTimeBlock("personal");
      if (!shabbatBlockIsActive) {
        await disableAllBlocking();
      }
      haptic(35);
      const nextBroken = personalBlockBrokenCount + 1;
      setPersonalBlockBrokenCount(nextBroken);
      setPersonalBlockEndsAt(null);
      await AsyncStorage.setItem(PERSONAL_BLOCK_BROKEN_COUNT_KEY, String(nextBroken));
      await AsyncStorage.removeItem(PERSONAL_BLOCK_ENDS_AT_KEY);
    } catch (error) {
      Alert.alert("Block", errorMessage(error, "Could not stop block."));
    }
  }, [personalBlockBrokenCount, shabbatBlockIsActive]);

  const onConfirmBreakFocus = useCallback(() => {
    Alert.alert(
      "Break Focus?",
      "Are you sure you want to break this focus block?",
      [
        { text: "Keep Focus", style: "cancel" },
        { text: "Break Focus", style: "destructive", onPress: onStopPersonalBlock },
      ]
    );
  }, [onStopPersonalBlock]);

  // Begin the 20-second cooling-off period before apps actually unblock. Apps
  // stay blocked during the countdown, and the user can re-block to cancel.
  const beginFocusUnblock = useCallback(() => {
    haptic(12);
    setFocusUnblockCountdown(20);
  }, []);

  const cancelFocusUnblock = useCallback(() => {
    haptic(8);
    setFocusUnblockCountdown(null);
  }, []);

  useEffect(() => {
    if (focusUnblockCountdown === null) return;
    if (focusUnblockCountdown <= 0) {
      setFocusUnblockCountdown(null);
      onStopPersonalBlock();
      return;
    }
    const timer = setTimeout(() => {
      setFocusUnblockCountdown((current) => (current === null ? null : current - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [focusUnblockCountdown, onStopPersonalBlock]);

  // Reset the cooldown whenever a block ends; ensure a quote is set when a block
  // is active (covers blocks restored from storage after an app relaunch).
  useEffect(() => {
    if (personalBlockIsActive) {
      setFocusQuote((q) => q || (FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)] ?? FOCUS_QUOTES[0]));
    } else {
      setFocusUnblockCountdown(null);
    }
  }, [personalBlockIsActive]);

  const saveIntentHistoryEntry = useCallback(async (weekDate: string, text: string) => {
    if (!user) return;
    setIntentHistory((prev) => ({ ...prev, [weekDate]: text }));
    await saveIntentEntry(user.uid, weekDate, text);
  }, [user]);

  /* ── effects ── */
  useEffect(() => {
    const loadLocal = async () => {
      const [
        rawR,
        rawU,
        rawB,
        rawHO,
        rawPersonalBlockEnd,
        rawPersonalSuccessCount,
        rawPersonalBrokenCount,
      ] = await Promise.all([
        AsyncStorage.getItem(RESTRICTIONS_KEY),
        AsyncStorage.getItem(SHABBAT_UI_STATE_KEY),
        AsyncStorage.getItem(BLOCK_LEVEL_KEY),
        AsyncStorage.getItem(HOLIDAY_OPTIN_KEY),
        AsyncStorage.getItem(PERSONAL_BLOCK_ENDS_AT_KEY),
        AsyncStorage.getItem(PERSONAL_BLOCK_SUCCESS_COUNT_KEY),
        AsyncStorage.getItem(PERSONAL_BLOCK_BROKEN_COUNT_KEY),
      ]);
      if (rawR) { try { setRestrictions(JSON.parse(rawR)); } catch { /* use defaults */ } }
      if (rawU) { try { setShabbatUiState(JSON.parse(rawU)); } catch { /* use defaults */ } }
      if (rawB && ["full", "custom", "none"].includes(rawB)) {
        setBlockLevel(rawB as BlockLevel);
        setScreenTimeBlockMode(rawB as BlockLevel).catch(() => {});
      }
      if (rawB === "medium") {
        setBlockLevel("none");
        AsyncStorage.setItem(BLOCK_LEVEL_KEY, "none").catch(() => {});
        setScreenTimeBlockMode("none").catch(() => {});
      }
      if (rawHO === "true") setHolidayOptIn(true);
      let successCount = Number(rawPersonalSuccessCount) || 0;
      if (rawPersonalBlockEnd) {
        const endDate = new Date(rawPersonalBlockEnd);
        if (!Number.isNaN(endDate.getTime()) && endDate.getTime() > Date.now()) {
          setPersonalBlockEndsAt(endDate);
        } else {
          successCount += 1;
          AsyncStorage.setItem(PERSONAL_BLOCK_SUCCESS_COUNT_KEY, String(successCount)).catch(() => {});
          AsyncStorage.removeItem(PERSONAL_BLOCK_ENDS_AT_KEY).catch(() => {});
          disableAllBlocking().catch(() => {});
        }
      }
      setPersonalBlockSuccessCount(successCount);
      setPersonalBlockBrokenCount(Number(rawPersonalBrokenCount) || 0);
      AsyncStorage.removeItem("tefillinBuddies:v1").catch(() => {});
      AsyncStorage.removeItem("customAppBlocks:v1").catch(() => {});
    };
    loadLocal().catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      getFamilyActivitySelectionSummary("custom"),
      getFamilyActivitySelectionSummary("personal"),
    ])
      .then(([custom, personal]) => {
        setCustomSelectionCount(custom.count);
        setPersonalBlockSelectionCount(personal.count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setAppForegroundTick((tick) => tick + 1);
        setFocusClockTick((tick) => tick + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!personalBlockEndsAt) return;
    const tick = () => {
      setFocusClockTick((current) => current + 1);
      if (personalBlockEndsAt.getTime() <= Date.now()) {
        setPersonalBlockSuccessCount((current) => {
          const next = current + 1;
          AsyncStorage.setItem(PERSONAL_BLOCK_SUCCESS_COUNT_KEY, String(next)).catch(() => {});
          return next;
        });
        disableAllBlocking().catch(() => {});
        setPersonalBlockEndsAt(null);
        AsyncStorage.removeItem(PERSONAL_BLOCK_ENDS_AT_KEY).catch(() => {});
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [personalBlockEndsAt]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setAuthLoading(false);
      if (profile) {
        setProfileName(profile.displayName ?? "");
        setProfileSex(profile.gender === "female" ? "female" : profile.gender === "male" ? "male" : "");
        if (isEmailProvider() && !isCurrentUserEmailVerified() && !canUploadWeeklyVideo(profile.email)) {
          setPendingEmailVerification(true);
        }
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
        setProfileSex("");
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
    if (!user || user.wantsChatNotifications === false) return;
    let mounted = true;
    registerForChatPushNotifications(user)
      .then((updated) => {
        if (mounted && updated) setUser(updated);
      })
      .catch(() => {});
    const unsubscribe = subscribeToChatPushTokenRefresh(user, (updated) => {
      if (mounted) setUser(updated);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [user]);

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
    if (isFemaleUser && activeTab === "buddies") {
      setActiveTab("home");
      setSocialSubTab("friends");
    }
    if (isFemaleUser) {
      manualTefillinPromptOpenRef.current = false;
      setSoloTefillinPromptVisible(false);
    }
  }, [activeTab, isFemaleUser]);

  useEffect(() => {
    const idx = visibleTabs.indexOf(activeTab);
    const prevIdx = prevTabIndexRef.current;
    prevTabIndexRef.current = idx;
    // Slide the new page in from the direction of travel: moving to a later tab
    // enters from the right, an earlier tab from the left.
    const direction = prevIdx === null || idx === prevIdx ? 0 : idx > prevIdx ? 1 : -1;
    tabSlideAnim.setValue(direction * 48);
    tabContentAnim.setValue(0);
    Animated.parallel([
      Animated.timing(tabContentAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(tabSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }),
    ]).start();
  }, [activeTab, tabContentAnim, tabSlideAnim, visibleTabs]);

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
    const sourceText = currentWeekIntent ?? user.shabbatIntentText ?? DEFAULT_SHABBAT_INTENTION;
    const sourceType = currentWeekIntent ? "history" : user.shabbatIntentText ? "profile" : "default";
    const syncKey = `${user.uid}:${currentWeekDate}:${sourceType}:${sourceText}`;
    if (lastIntentSyncKeyRef.current === syncKey) return;

    lastIntentSyncKeyRef.current = syncKey;
    setIntentDraft(sourceText);
    setSavedIntentText(currentWeekIntent ?? sourceText);
  }, [currentWeekDate, currentWeekIntent, user?.shabbatIntentText, user?.uid]);

  /* ── load location & congregations ── */
  const loadLocationAndCongregations = useCallback(async () => {
    if (!user) return;
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

    } catch (error) {
      console.warn(errorMessage(error, "Could not load location."));
    }
  }, [user?.latitude, user?.longitude, user?.uid]);

  useEffect(() => {
    if (!user) return;
    loadLocationAndCongregations().catch(() => {});
  }, [loadLocationAndCongregations, user?.uid]);

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
    const hasWeeklyIntention = Boolean((intentHistory[currentWeekDate] ?? user.shabbatIntentText ?? DEFAULT_SHABBAT_INTENTION).trim());
    if (blockLevel !== "none" && hasWeeklyIntention) {
      scheduleShabbatMode(shabbatTimes).catch(() => {});
      return;
    }
    cancelScheduledShabbatMode().catch(() => {});
  }, [blockLevel, currentWeekDate, intentHistory, shabbatTimes, user]);

  useEffect(() => {
    if (!user) return;
    schedulePrayerScreenTimeBlocks(user).catch(() => {});
  }, [schedulePrayerScreenTimeBlocks, user]);

  useEffect(() => {
    if (!WEEKLY_VIDEO_FEATURE_ENABLED) {
      setWeeklyVideo(null);
      return;
    }
    if (!user) {
      setWeeklyVideo(null);
      return;
    }
    getWeeklyVideo(weekId)
      .then(setWeeklyVideo)
      .catch(() => setWeeklyVideo(null));
  }, [user, weekId]);

  useEffect(() => {
    if (!user || !shabbatTimes) return;

    if (!isFemaleUser && user.wantsMorningReminders) {
      const tefillinTime = addMinutesToTimeStr(user.wakeUpTime ?? "07:00", 15);
      scheduleNextReminder({
        type: ReminderType.TEFILLIN,
        enabled: true,
        time: tefillinTime,
        title: "Tefillin reminder",
        body: "Time to wrap tefillin!",
        skipWeekdays: [6],
      }, shabbatTimes).catch(() => {});
    }

    if (user.wantsShabbatReminders) {
      const prepDate = new Date(shabbatTimes.shabbatStart.getTime() - 15 * 60000);
      scheduleExactReminder({
        type: ReminderType.SHABBAT_PREP,
        enabled: true,
        title: isFemaleUser ? "Candle lighting soon" : "Shabbat starts soon",
        body: isFemaleUser ? "Candle lighting is in about 15 minutes." : "Shabbat starts in about 15 minutes.",
      }, prepDate).catch(() => {});
      scheduleExactReminder({
        type: ReminderType.SHABBAT_END,
        enabled: true,
        title: "Shabbat has ended",
        body: "Shavua tov. Shabbat has ended.",
      }, shabbatTimes.shabbatEnd).catch(() => {});
    }
  }, [isFemaleUser, shabbatTimes, user]);

  useEffect(() => {
    if (!isShabbatNow || !user) return;
    const hasPrompted = shabbatUiState.lastIntentPromptWeekId === weekId;
    const optedOut = shabbatUiState.optedOutWeekId === weekId;
    if (!hasPrompted && !optedOut && !intentModalVisible) {
      setIntentDraft(currentWeekIntent ?? user.shabbatIntentText ?? DEFAULT_SHABBAT_INTENTION);
      setIntentModalVisible(true);
    }
  }, [
    currentWeekIntent,
    intentModalVisible,
    isShabbatNow,
    shabbatUiState.lastIntentPromptWeekId,
    shabbatUiState.optedOutWeekId,
    user?.shabbatIntentText,
    user?.uid,
    weekId,
  ]);

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
    if (!user?.uid || !chattingWith?.uid || socialSubTab !== "dm") return;
    setDmMessages([]);
    const unsubscribe = subscribeToDirectMessages(user.uid, chattingWith.uid, setDmMessages);
    return () => unsubscribe();
  }, [user?.uid, chattingWith?.uid, socialSubTab]);

  useEffect(() => {
    if (!user?.uid || !user.congregationId) {
      setHasUnreadCongregationChat(false);
      return;
    }

    let mounted = true;
    const unsubscribe = subscribeToLatestCongregationMessage(user.congregationId, async (message) => {
      if (!mounted || !message || message.senderUid === user.uid) return;
      if (socialSubTab === "chat") {
        markCongregationChatRead(message.createdAt.getTime());
        return;
      }
      const lastReadMs = Number(
        (await AsyncStorage.getItem(congregationChatReadKey(user.uid, user.congregationId ?? ""))) ?? "0"
      );
      if (message.createdAt.getTime() > lastReadMs) {
        setHasUnreadCongregationChat(true);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [markCongregationChatRead, socialSubTab, user?.congregationId, user?.uid]);

  useEffect(() => {
    if (!user?.uid || friends.length === 0) {
      setUnreadDmUids({});
      return;
    }

    let mounted = true;
    const friendUids = new Set(friends.map((friend) => friend.uid));
    setUnreadDmUids((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([uid]) => friendUids.has(uid)))
    );

    const unsubscribes = friends.map((friend) =>
      subscribeToLatestDirectMessage(user.uid, friend.uid, async (message) => {
        if (!mounted || !message || message.senderUid === user.uid) return;
        const isOpen = socialSubTab === "dm" && chattingWith?.uid === friend.uid;
        if (isOpen) {
          markDirectChatRead(friend.uid, message.createdAt.getTime());
          return;
        }
        const lastReadMs = Number(
          (await AsyncStorage.getItem(directChatReadKey(user.uid, friend.uid))) ?? "0"
        );
        if (message.createdAt.getTime() > lastReadMs) {
          setUnreadDmUids((prev) => (prev[friend.uid] ? prev : { ...prev, [friend.uid]: true }));
        }
      })
    );

    return () => {
      mounted = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [chattingWith?.uid, friends, markDirectChatRead, socialSubTab, user?.uid]);

  useEffect(() => {
    if (socialSubTab !== "chat" || chatMessages.length === 0) return;
    const latest = chatMessages[chatMessages.length - 1];
    if (latest) {
      markCongregationChatRead(latest.createdAt.getTime());
    }
  }, [chatMessages, markCongregationChatRead, socialSubTab]);

  useEffect(() => {
    if (socialSubTab !== "dm" || !chattingWith?.uid || dmMessages.length === 0) return;
    const latest = dmMessages[dmMessages.length - 1];
    if (latest) {
      markDirectChatRead(chattingWith.uid, latest.createdAt.getTime());
    }
  }, [chattingWith?.uid, dmMessages, markDirectChatRead, socialSubTab]);

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

  /* ── streak evaluation (runs on mount and on app foreground) ── */
  useEffect(() => {
    if (!user || user.buddyChatIds.length === 0) return;
    const runEval = () => {
      evaluateAllStreaks(user.uid)
        .then(() => {
          getUserBuddyChats(user.uid).then(setBuddyChats).catch(() => {});
          getUserProfile(user.uid).then((updated) => {
            if (updated) setUser(updated);
          }).catch(() => {});
        })
        .catch(() => {});
    };
    if (!streakEvalDone.current) {
      streakEvalDone.current = true;
      runEval();
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runEval();
    });
    return () => sub.remove();
  }, [user?.uid, user?.buddyChatIds.length]);

  /* ── buddy chat message subscription ── */
  // Depend on chat id (not the chat object) so this effect doesn't re-run
  // every time the parent buddyChats snapshot updates lastActivityAt and
  // produces a new object reference. Re-running the effect would clear the
  // current message list for one frame, briefly showing the empty state.
  useEffect(() => {
    const chatId = activeBuddyChat?.id;
    if (!chatId || socialSubTab !== "buddyChat") return;
    setBuddyChatMessages([]);
    const unsubscribe = subscribeToBuddyMessages(chatId, setBuddyChatMessages);
    return () => unsubscribe();
  }, [activeBuddyChat?.id, socialSubTab]);

  useEffect(() => {
    if (socialSubTab === "buddyChat" && activeBuddyChat) {
      queueBuddyChatSnapToBottom();
    }
  }, [activeBuddyChat?.id, socialSubTab, queueBuddyChatSnapToBottom]);

  /* ── check sun window when entering buddy chat + on app foreground ── */
  useEffect(() => {
    if (socialSubTab !== "buddyChat" || !activeBuddyChat || !currentLocation) {
      setSunBlockedMessage(null);
      return;
    }
    const checkSun = () => {
      getSunWindowMessage(currentLocation.latitude, currentLocation.longitude, currentLocation.timezone)
        .then(setSunBlockedMessage)
        .catch(() => setSunBlockedMessage(null));
    };
    checkSun();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkSun();
    });
    return () => sub.remove();
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
      if (isEmailProvider() && !isCurrentUserEmailVerified() && !canUploadWeeklyVideo(profile.email)) {
        setPendingEmailVerification(true);
      }
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
    if (!signupSex) { setAuthError("Please select male or female."); return; }
    if (!email) { setAuthError("Please enter your email."); return; }
    if (!signupPassword) { setAuthError("Please enter a password."); return; }
    if (signupPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    if (signupPassword !== signupConfirmPassword) { setAuthError("Passwords do not match."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      await registerWithEmailPassword({ email, password: signupPassword, displayName: name, gender: signupSex });
      const profile = await createProfileAfterVerification({ displayName: name, gender: signupSex });
      setUser(profile);
      setPendingSignupData(null);
      await sendVerification();
      setResendCooldown(25);
      setPendingEmailVerification(true);
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to create account."));
    } finally {
      setActionLoading(false);
    }
  }, [signupConfirmPassword, signupEmail, signupName, signupPassword, signupSex]);

  const onPressSendPhoneCode = useCallback(async () => {
    const formattedPhone = formatPhoneForFirebase(authPhoneCountry, authPhone);
    setAuthError(null);
    if (!formattedPhone || formattedPhone === authPhoneCountry.dialCode) {
      setAuthError("Please enter your phone number.");
      return;
    }
    setActionLoading(true);
    try {
      const confirmation = await startPhoneSignIn(formattedPhone);
      setPhoneConfirmation(confirmation);
      Alert.alert("Code sent", "Enter the verification code you received.");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to send verification code."));
    } finally {
      setActionLoading(false);
    }
  }, [authPhone, authPhoneCountry]);

  const onPressVerifyPhoneCode = useCallback(async () => {
    if (!phoneConfirmation) { setAuthError("Please request a verification code first."); return; }
    await runAuthAction(() => confirmPhoneSignIn({ confirmation: phoneConfirmation, code: authPhoneCode }));
  }, [authPhoneCode, phoneConfirmation, runAuthAction]);

  const onPressSignupSendPhoneCode = useCallback(async () => {
    const name = signupName.trim();
    const formattedPhone = formatPhoneForFirebase(signupPhoneCountry, signupPhone);
    if (!name) { setAuthError("Please enter your name."); return; }
    if (!signupSex) { setAuthError("Please select male or female."); return; }
    if (!formattedPhone || formattedPhone === signupPhoneCountry.dialCode) { setAuthError("Please enter your phone number."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      const confirmation = await startPhoneSignIn(formattedPhone);
      setSignupPhoneConfirmation(confirmation);
      Alert.alert("Code sent", "Enter the verification code you received.");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to send verification code."));
    } finally {
      setActionLoading(false);
    }
  }, [signupName, signupPhone, signupPhoneCountry, signupSex]);

  const onPressSignupVerifyPhoneCode = useCallback(async () => {
    if (!signupPhoneConfirmation) { setAuthError("Please request a verification code first."); return; }
    setAuthError(null);
    setActionLoading(true);
    try {
      const profile = await confirmPhoneSignUp({
        confirmation: signupPhoneConfirmation,
        code: signupPhoneCode,
        displayName: signupName.trim(),
        gender: signupSex,
      });
      setUser(profile);
      setSignupPhoneConfirmation(null);
      setSignupPhoneCode("");
    } catch (error) {
      setAuthError(errorMessage(error, "Failed to verify code."));
    } finally {
      setActionLoading(false);
    }
  }, [signupName, signupPhoneCode, signupPhoneConfirmation, signupSex]);

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

  const onOpenPrivacyPolicy = useCallback(() => {
    setSettingsVisible(false);
    setTimeout(() => {
      setPrivacyPolicyVisible(true);
    }, 250);
  }, []);

  const onDeleteAccount = useCallback(() => {
    if (!user) return;
    Alert.alert(
      "Delete Account",
      "This permanently deletes your Kesher account on this device and removes your profile. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              if (user.congregationId) {
                await leaveCongregationAsUser(user.congregationId, user.uid).catch(() => {});
              }
              await deleteUserProfile(user.uid).catch(() => {});
              await deleteCurrentUser();
              setUser(null);
              setSettingsVisible(false);
            } catch (error) {
              Alert.alert(
                "Delete Account",
                errorMessage(
                  error,
                  "Could not delete account. Sign out, sign back in, then try again."
                )
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [user]);

  const onPressResendVerification = useCallback(async () => {
    setAuthError(null);
    setActionLoading(true);
    try {
      await sendVerification();
      setResendCooldown(25);
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
          const profile = await createProfileAfterVerification({ displayName: pendingSignupData.name, gender: pendingSignupData.sex });
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

  const onMinimalShabbatBreak = useCallback(() => {
    if (!user) return;
    Alert.alert(
      "Break Shabbat?",
      `Why you are keeping Shabbat:\n\n${savedIntentText || DEFAULT_SHABBAT_INTENTION}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Break Shabbat",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await disableAllBlocking();
              const profile = await recordBrokenShabbatWeek(user.uid, weekId);
              setUser(profile);
              setShabbatBrokenLocally(true);
              await applyRestrictionWeekOutcome(false);
            } catch (error) {
              Alert.alert("Break Shabbat", errorMessage(error, "Unknown error."));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [applyRestrictionWeekOutcome, savedIntentText, user, weekId]);

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
    const appleSignedIn = isAppleProvider();
    const nextName = resolveProfileDisplayName({
      profileDisplayName: user.displayName,
      inputDisplayName: profileName,
      authDisplayName: getAuthUserDisplayName(),
      email: user.email,
    });
    if (!appleSignedIn && !profileName.trim() && !user.displayName?.trim()) {
      Alert.alert("Profile", "Name is required.");
      return;
    }
    if (!profileSex) { Alert.alert("Profile", "Select male or female."); return; }
    setActionLoading(true);
    try {
      if (profileSex === "female") {
        await cancelReminder(ReminderType.TEFILLIN);
      }
      if (user.uid.startsWith("dev-local-")) {
        setUser((prev) => prev ? {
          ...prev,
          displayName: nextName,
          gender: profileSex,
          wantsMorningReminders: profileSex === "female" ? false : prev.wantsMorningReminders,
        } : prev);
        return;
      }
      try {
        const updated = await withTimeout(updateUserProfile(user.uid, {
          displayName: nextName,
          gender: profileSex,
          ...(profileSex === "female" ? { wantsMorningReminders: false } : {}),
        }), 6000, "Profile save timed out.");
        setUser(updated);
      } catch {
        setUser((prev) => prev ? { ...prev, displayName: nextName, gender: profileSex } : prev);
      }
    } finally {
      setActionLoading(false);
    }
  }, [profileName, profileSex, user]);

  const ensureNotificationPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    if (granted) return true;
    Alert.alert(
      "Turn On Notifications",
      "Kesher needs notification permission for reminders. You can enable it in Settings.",
      [
        { text: "Not Now", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }, []);

  const requestScreenTimeWithPrompt = useCallback(async (): Promise<boolean> => {
    const shouldContinue = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Kesher Would Like to Access Screen Time",
        "Kesher uses Screen Time only for the app blocking features you choose to turn on.",
        [
          { text: "Don't Allow", style: "cancel", onPress: () => resolve(false) },
          { text: "Continue", style: "default", onPress: () => resolve(true) },
        ]
      );
    });
    if (!shouldContinue) return false;
    return requestScreenTimePermission();
  }, []);

  /* ── reminder callbacks ── */
  const onToggleMorningReminder = useCallback(async () => {
    if (!user || !shabbatTimes) return;
    if (isFemaleUser) return;
    const next = !user.wantsMorningReminders;
    setActionLoading(true);
    try {
      if (next) {
        const notificationsGranted = await ensureNotificationPermission();
        if (!notificationsGranted) return;
        const tefillinTime = addMinutesToTimeStr(user.wakeUpTime ?? "07:00", 15);
        await scheduleNextReminder({ type: ReminderType.TEFILLIN, enabled: true, time: tefillinTime, title: "Tefillin reminder", body: "Time to wrap tefillin!", skipWeekdays: [6] }, shabbatTimes);
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
  }, [ensureNotificationPermission, isFemaleUser, shabbatTimes, user]);

  const onToggleShabbatReminder = useCallback(async () => {
    if (!user || !shabbatTimes) return;
    const next = !user.wantsShabbatReminders;
    setActionLoading(true);
    try {
      if (next) {
        const notificationsGranted = await ensureNotificationPermission();
        if (!notificationsGranted) return;
        const reminderDate = new Date(shabbatTimes.shabbatStart.getTime() - 15 * 60000);
        await scheduleExactReminder({ type: ReminderType.SHABBAT_PREP, enabled: true, title: isFemaleUser ? "Candle lighting soon" : "Shabbat starts soon", body: isFemaleUser ? "Candle lighting is in about 15 minutes." : "Shabbat starts in about 15 minutes." }, reminderDate);
        await scheduleExactReminder({ type: ReminderType.SHABBAT_END, enabled: true, title: "Shabbat has ended", body: "Shavua tov. Shabbat has ended." }, shabbatTimes.shabbatEnd);
      } else {
        await cancelReminder(ReminderType.SHABBAT_PREP);
        await cancelReminder(ReminderType.SHABBAT_END);
      }
      const updated = await updateUserProfile(user.uid, { wantsShabbatReminders: next });
      setUser(updated);
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [ensureNotificationPermission, isFemaleUser, shabbatTimes, user]);

  const onToggleChatNotifications = useCallback(async () => {
    if (!user) return;
    const next = user.wantsChatNotifications === false;
    setActionLoading(true);
    try {
      if (!next) {
        await clearChatPushToken(user);
        const updated = await updateUserProfile(user.uid, {
          wantsChatNotifications: false,
          fcmToken: null,
        });
        setUser(updated);
        return;
      }

      const enabled = await updateUserProfile(user.uid, {
        wantsChatNotifications: true,
      });
      const updated = await registerForChatPushNotifications(enabled);
      setUser(updated ?? enabled);
    } catch (error) {
      Alert.alert(
        "Notifications",
        errorMessage(error, "Failed to update chat notifications.")
      );
    } finally {
      setActionLoading(false);
    }
  }, [user]);

  const onToggleModehAni = useCallback(async () => {
    if (!user) return;
    const next = !user.wantsModehAniReminder;
    setActionLoading(true);
    try {
      if (next) {
        const notificationsGranted = await ensureNotificationPermission();
        if (!notificationsGranted) return;
        const granted = await requestScreenTimeWithPrompt();
        if (!granted) {
          Alert.alert(
            "Screen Time Required",
            "Allow Screen Time access to block all apps for Modeh Ani."
          );
          return;
        }
        await AsyncStorage.removeItem(`${MODEH_ANI_DONE_PREFIX}${todayDateStr()}`);
      }
      if (!next) {
        await cancelReminder(ReminderType.MODEH_ANI);
        await cancelScheduledScreenTimeBlock("modehAni");
      }
      const updated = await updateUserProfile(user.uid, { wantsModehAniReminder: next });
      setUser(updated);
      if (next) {
        await schedulePrayerScreenTimeBlocks(updated);
        checkPrayerBlocking().catch(() => {});
      }
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [checkPrayerBlocking, ensureNotificationPermission, requestScreenTimeWithPrompt, schedulePrayerScreenTimeBlocks, user]);

  const onToggleShema = useCallback(async () => {
    if (!user) return;
    const next = !user.wantsShemaReminder;
    setActionLoading(true);
    try {
      if (next) {
        const notificationsGranted = await ensureNotificationPermission();
        if (!notificationsGranted) return;
        const granted = await requestScreenTimeWithPrompt();
        if (!granted) {
          Alert.alert(
            "Screen Time Required",
            "Allow Screen Time access to block all apps for Shema."
          );
          return;
        }
        await AsyncStorage.removeItem(`${SHEMA_DONE_PREFIX}${todayDateStr()}`);
      }
      if (!next) {
        await cancelReminder(ReminderType.SHEMA);
        await cancelScheduledScreenTimeBlock("shema");
      }
      const updated = await updateUserProfile(user.uid, { wantsShemaReminder: next });
      setUser(updated);
      if (next) {
        await schedulePrayerScreenTimeBlocks(updated);
        checkPrayerBlocking().catch(() => {});
      }
    } catch (error) {
      Alert.alert("Reminder", errorMessage(error, "Failed to update."));
    } finally {
      setActionLoading(false);
    }
  }, [checkPrayerBlocking, ensureNotificationPermission, requestScreenTimeWithPrompt, schedulePrayerScreenTimeBlocks, user]);

  const onSetWakeTime = useCallback(async (time: string) => {
    if (!user) return;
    try {
      await AsyncStorage.removeItem(`${MODEH_ANI_DONE_PREFIX}${todayDateStr()}`);
      const updated = await updateUserProfile(user.uid, { wakeUpTime: time });
      setUser(updated);
      if (!isFemaleUser && shabbatTimes && updated.wantsMorningReminders) {
        const tefillinTime = addMinutesToTimeStr(time, 15);
        await scheduleNextReminder({ type: ReminderType.TEFILLIN, enabled: true, time: tefillinTime, title: "Tefillin reminder", body: "Time to wrap tefillin!", skipWeekdays: [6] }, shabbatTimes);
      }
      if (updated.wantsModehAniReminder) {
        await schedulePrayerScreenTimeBlocks(updated);
        checkPrayerBlocking().catch(() => {});
      }
    } catch { /* keep going */ }
  }, [checkPrayerBlocking, isFemaleUser, schedulePrayerScreenTimeBlocks, shabbatTimes, user]);

  const onSetBedTime = useCallback(async (time: string) => {
    if (!user) return;
    try {
      await AsyncStorage.removeItem(`${SHEMA_DONE_PREFIX}${todayDateStr()}`);
      const updated = await updateUserProfile(user.uid, { bedTime: time });
      setUser(updated);
      if (updated.wantsShemaReminder) {
        await schedulePrayerScreenTimeBlocks(updated);
        checkPrayerBlocking().catch(() => {});
      }
    } catch { /* keep going */ }
  }, [checkPrayerBlocking, schedulePrayerScreenTimeBlocks, user]);

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
    const today = localDateStr();
    setTefillinConfirmedToday(true);
    manualTefillinPromptOpenRef.current = false;
    setSoloTefillinPromptVisible(false);
    await Promise.all([
      AsyncStorage.setItem(tefillinDateKey(user.uid), promptDay),
      AsyncStorage.setItem(tefillinHandledDayKey(user.uid), today),
      AsyncStorage.removeItem(tefillinIgnoreKey(user.uid)),
    ]);
    try {
      const updated = await recordTefillinDay(user.uid, promptDay);
      if (updated) setUser(updated);
    } catch { /* keep going */ }
  }, [getSoloTefillinPromptDay, user]);

  // Manually re-open the "did you wrap tefillin today?" prompt — e.g. when the
  // user taps their tefillin streak. Works whether or not they have buddies.
  const openTefillinPrompt = useCallback(() => {
    if (!user || isFemaleUser) return;
    if (isSaturdayToday) {
      Alert.alert(
        "Tefillin",
        "Tefillin is not worn on Shabbat (Saturday), so today is a gap day — your streak is safe."
      );
      return;
    }
    tefillinDeclinedSessionRef.current[user.uid] = false;
    manualTefillinPromptOpenRef.current = true;
    setSoloTefillinPromptVisible(true);
  }, [isFemaleUser, isSaturdayToday, user]);

  const onDeclineTefillinPrompt = useCallback(() => {
    manualTefillinPromptOpenRef.current = false;
    if (user) {
      tefillinDeclinedSessionRef.current[user.uid] = true;
    }
    setSoloTefillinPromptVisible(false);
  }, [user]);

  const onIgnoreTefillinPrompt = useCallback(async () => {
    if (!user) return;
    manualTefillinPromptOpenRef.current = false;
    setSoloTefillinPromptVisible(false);
    const today = localDateStr();
    await Promise.all([
      AsyncStorage.setItem(tefillinIgnoreKey(user.uid), today),
      AsyncStorage.setItem(tefillinHandledDayKey(user.uid), today),
    ]);
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
      setCreateCongregationVisible(false);
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

  /* ── congregation name search for joining ── */
  const onCitySearchChange = useCallback((text: string) => {
    setCongregationCitySearch(text);
    if (citySearchTimer.current) clearTimeout(citySearchTimer.current);
    if (text.trim().length < 2) {
      setNearbyCongregations([]);
      return;
    }
    citySearchTimer.current = setTimeout(async () => {
      try {
        setNearbyLoading(true);
        setNearbyError(null);
        const results = await searchCongregations(text.trim());
        setNearbyCongregations(results.map((c) => ({ ...c, distanceMiles: 0 })));
      } catch (error) {
        setNearbyError(errorMessage(error, "Congregation search failed."));
      } finally {
        setNearbyLoading(false);
      }
    }, 400);
  }, []);

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

  const onInviteFriends = useCallback(async () => {
    if (!user) return;
    const code = user.friendCode ?? user.uid.slice(0, 8).toUpperCase();
    const firstName = user.displayName?.split(" ")[0] || "me";
    const message = `Join ${firstName} on Kesher Social. Use friend code ${code} to add them after you sign up: ${DUMMY_APP_STORE_LINK}`;
    try {
      await Share.share({ message, url: DUMMY_APP_STORE_LINK });
    } catch {
      Alert.alert("Invite Friends", message);
    }
  }, [user]);
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
      const updated = await getUserProfile(user.uid);
      if (updated) setUser(updated);
      Alert.alert("Friend Request", "Friend request updated.");
      setFriendCodeResult(null);
      setFriendCodeQuery("");
    } catch (error) {
      Alert.alert("Friend request", errorMessage(error, "Could not send request."));
    }
  }, [user]);

  const friendActionState = useCallback((profile: UserProfile): "self" | "friend" | "pending" | "open" | "request" | "closed" => {
    if (!user || profile.uid === user.uid) return "self";
    if (user.friendUids.includes(profile.uid)) return "friend";
    if (profile.pendingFriendUids?.includes(user.uid)) return "pending";
    return profile.friendRequestStatus ?? "request";
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
  const openCongregationChat = useCallback(() => {
    markCongregationChatRead();
    setSocialSubTab("chat");
  }, [markCongregationChatRead]);

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
    setActiveTab("social");
    setChattingWith(friend);
    setDmInput("");
    markDirectChatRead(friend.uid);
    setSocialSubTab("dm");
  }, [markDirectChatRead]);

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

  const renderCongregationMessage = useCallback(
    ({ item }: { item: CongregationMessage }) => {
      const isMine = item.senderUid === user?.uid;
      return (
        <View style={[s.chatBubble, isMine && s.chatBubbleMine]}>
          {!isMine && <Text style={s.chatSender}>{item.senderName}</Text>}
          <Text style={[s.chatText, isMine && s.chatTextMine]}>{item.text}</Text>
        </View>
      );
    },
    [user?.uid]
  );

  const renderDirectMessage = useCallback(
    ({ item }: { item: DirectMessage }) => {
      const isMine = item.senderUid === user?.uid;
      return (
        <View style={[s.chatBubble, isMine && s.chatBubbleMine]}>
          <Text style={[s.chatText, isMine && s.chatTextMine]}>{item.text}</Text>
        </View>
      );
    },
    [user?.uid]
  );

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
      setActiveTab("buddies");
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

  const restDayPhotoMessage = useCallback(() => {
    return isSaturdayToday && !isShabbatNow
      ? "Tefillin is not worn on Shabbat (Saturday), so photos are disabled today. Your streak takes a gap day — you won't lose it."
      : "Tefillin photos are disabled on Shabbat.";
  }, [isSaturdayToday, isShabbatNow]);

  // Confirms the sun is up so a photo can count toward the streak. Returns true
  // when it's safe to proceed (or when the check can't run).
  const ensureSunWindowForPhoto = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const lat = currentLocation?.latitude ?? user.latitude;
    const lon = currentLocation?.longitude ?? user.longitude;
    const tzid = currentLocation?.timezone ?? user.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (lat == null || lon == null) return true;
    try {
      const visible = await isWithinSunWindow(lat, lon, tzid);
      if (!visible) {
        const message = "The sun is not visible — tefillin photos can only be sent between sunrise and sunset";
        setSunBlockedMessage(message);
        Alert.alert("Tefillin Photo", message);
        return false;
      }
      setSunBlockedMessage(null);
      return true;
    } catch {
      // If the live check fails, don't block a real camera photo on a stale banner.
      setSunBlockedMessage(null);
      return true;
    }
  }, [currentLocation, user]);

  const uploadAndSendBuddyPhoto = useCallback(async (chat: BuddyChat, imageUri: string, fromCamera: boolean) => {
    if (!user) return;
    if (fromCamera && isTefillinRestDay) {
      Alert.alert("Tefillin Photo", restDayPhotoMessage());
      return;
    }
    setBuddyChatImageLoading(true);
    if (chat.id === activeBuddyChat?.id) queueBuddyChatSnapToBottom();
    try {
      const downloadUrl = await uploadBuddyImage(chat.id, user.uid, imageUri);
      await sendBuddyMessage(
        chat.id,
        user.uid,
        user.displayName ?? "Anonymous",
        "image",
        downloadUrl,
        currentLocation?.latitude ?? user.latitude,
        currentLocation?.longitude ?? user.longitude,
        currentLocation?.timezone ?? user.timeZone,
        fromCamera
      );
      if (fromCamera) {
        // Advance the user's individual tefillin streak for today, and mark the
        // solo prompt handled so it won't nag after a real photo.
        const today = localDateStr();
        recordTefillinDay(user.uid, today)
          .then((updated) => { if (updated) setUser(updated); })
          .catch(() => {});
        AsyncStorage.setItem(tefillinDateKey(user.uid), today).catch(() => {});
        AsyncStorage.setItem(tefillinHandledDayKey(user.uid), today).catch(() => {});
        setSoloTefillinPromptVisible(false);
        // Re-evaluate the shared buddy-chat streaks (mutual completion).
        evaluateAllStreaks(user.uid)
          .then(() => {
            getUserBuddyChats(user.uid).then(setBuddyChats).catch(() => {});
          })
          .catch(() => {});
      }
    } catch (error) {
      Alert.alert("Tefillin Photo", errorMessage(error, "Failed to send image."));
    } finally {
      setBuddyChatImageLoading(false);
    }
  }, [activeBuddyChat?.id, currentLocation, isTefillinRestDay, queueBuddyChatSnapToBottom, restDayPhotoMessage, user]);

  const handleBuddyImageSend = useCallback(async (imageUri: string, fromCamera: boolean) => {
    if (!activeBuddyChat) return;
    await uploadAndSendBuddyPhoto(activeBuddyChat, imageUri, fromCamera);
  }, [activeBuddyChat, uploadAndSendBuddyPhoto]);

  const onBuddyChatCamera = useCallback(async () => {
    if (!user || !activeBuddyChat) return;
    if (isTefillinRestDay) {
      Alert.alert("Tefillin Photo", restDayPhotoMessage());
      return;
    }
    if (!(await ensureSunWindowForPhoto())) return;
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
  }, [activeBuddyChat, ensureSunWindowForPhoto, isTefillinRestDay, restDayPhotoMessage, user]);

  // Take a tefillin photo directly from a buddy/group row without first opening
  // the chat thread. Sends the photo, updates the streak, and stays in place.
  const captureTefillinPhoto = useCallback(async (chat: BuddyChat) => {
    if (!user) return;
    if (isTefillinRestDay) {
      Alert.alert("Tefillin Photo", restDayPhotoMessage());
      return;
    }
    if (!(await ensureSunWindowForPhoto())) return;
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
      await uploadAndSendBuddyPhoto(chat, result.assets[0].uri, true);
      haptic(12);
      Alert.alert(
        "Tefillin Photo Sent",
        `Your tefillin photo was sent${chat.type === "group" ? ` to ${chat.name ?? "your group"}` : ""}. Your streak is updated.`
      );
    } catch {
      Alert.alert("Camera", "Camera is not available on this device.");
    }
  }, [ensureSunWindowForPhoto, isTefillinRestDay, restDayPhotoMessage, uploadAndSendBuddyPhoto, user]);

  const onBuddyChatGallery = useCallback(async () => {
    if (!user || !activeBuddyChat) return;
    if (isTefillinRestDay) {
      Alert.alert("Tefillin Photo", restDayPhotoMessage());
      return;
    }
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
  }, [activeBuddyChat, isTefillinRestDay, restDayPhotoMessage, user]);

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
      setBuddyChatMessages((prev) =>
        prev.map((item) =>
          item.id === msg.id
            ? { ...item, savedByUids: [...new Set([...(item.savedByUids ?? []), user.uid])] }
            : item
        )
      );
    } catch {
      Alert.alert("Error", "Could not save message.");
    }
  }, [activeBuddyChat, user]);

  const onToggleMessageSavedInChat = useCallback(async (msg: BuddyMessage) => {
    if (!activeBuddyChat || !user) return;
    const isSaved = msg.savedByUids?.includes(user.uid);
    try {
      if (isSaved) {
        await unsaveMessageFromChat(activeBuddyChat.id, msg.id, user.uid);
      } else {
        await saveMessageToChat(activeBuddyChat.id, msg.id, user.uid);
      }
      setBuddyChatMessages((prev) =>
        prev.map((item) => {
          if (item.id !== msg.id) return item;
          const savedByUids = isSaved
            ? (item.savedByUids ?? []).filter((uid) => uid !== user.uid)
            : [...new Set([...(item.savedByUids ?? []), user.uid])];
          return { ...item, savedByUids };
        })
      );
      setViewingBuddyImage((prev) => {
        if (!prev || prev.id !== msg.id) return prev;
        const savedByUids = isSaved
          ? (prev.savedByUids ?? []).filter((uid) => uid !== user.uid)
          : [...new Set([...(prev.savedByUids ?? []), user.uid])];
        return { ...prev, savedByUids };
      });
      if (isSaved) {
        purgeExpiredMessages(activeBuddyChat.id).catch(() => {});
      }
    } catch {
      Alert.alert("Saved Image", isSaved ? "Could not unsave image." : "Could not save image.");
    }
  }, [activeBuddyChat, user]);

  const onPickWeeklyVideo = useCallback(async () => {
    if (!user) return;
    if (!isWeeklyVideoUploader) {
      Alert.alert("Weekly Video", `Only ${WEEKLY_VIDEO_UPLOADER_EMAIL} can upload weekly videos.`);
      return;
    }
    setWeeklyVideoLoading(true);
    try {
      const result = await launchImageLibrary({
        mediaType: "video",
        selectionLimit: 1,
      });
      const asset = result.assets?.[0];
      const uri = asset?.uri;
      if (result.didCancel || !asset || !uri) return;

      const uploaded = await uploadWeeklyVideo({
        uploaderUid: user.uid,
        uploaderEmail: user.email,
        weekId,
        uri,
        fileName: asset.fileName ?? `weekly-${weekId}.mp4`,
        contentType: asset.type ?? "video/mp4",
        durationSeconds:
          typeof asset.duration === "number" ? Math.round(asset.duration) : null,
        visibility: "private",
        type: "reflection",
      });
      setWeeklyVideo(uploaded);
    } catch (error) {
      Alert.alert("Weekly Video", errorMessage(error, "Could not upload video."));
    } finally {
      setWeeklyVideoLoading(false);
    }
  }, [isWeeklyVideoUploader, user, weekId]);

  const onDeleteWeeklyVideo = useCallback(() => {
    if (!user || !weeklyVideo || !isWeeklyVideoUploader) return;
    Alert.alert(
      "Delete Weekly Video?",
      "This removes the video from Firebase Storage for this week.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setWeeklyVideoLoading(true);
            try {
              await deleteWeeklyVideo(weekId);
              setWeeklyVideo(null);
            } catch (error) {
              Alert.alert("Weekly Video", errorMessage(error, "Could not delete video."));
            } finally {
              setWeeklyVideoLoading(false);
            }
          },
        },
      ]
    );
  }, [isWeeklyVideoUploader, user, weekId, weeklyVideo]);

  /* ── group buddy chat callbacks ── */
  const openGroupChat = useCallback((chat: BuddyChat) => {
    queueBuddyChatSnapToBottom();
    setActiveBuddyChat(chat);
    setChattingWith(null);
    setBuddyChatInput("");
    setActiveTab("buddies");
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

  const latestIncomingBuddyImageFor = useCallback(
    (friendUid: string): string | null => {
      const chat = allBuddyChatsOrdered.find(
        (candidate) =>
          candidate.type === "pair" &&
          candidate.memberUids.includes(friendUid) &&
          candidate.lastImageSenderUid === friendUid &&
          !!candidate.lastImageUrl
      );
      return chat?.lastImageUrl ?? null;
    },
    [allBuddyChatsOrdered]
  );

  /* ── time display ── */
  const timesDisplay = useMemo(() => {
    if (timesLoading) return "Loading...";
    if (timesError) return timesError.message;
    if (!shabbatTimes) return "No times loaded";
    return `Fri ${formatTime(shabbatTimes.shabbatStart)} – Sat ${formatTime(shabbatTimes.shabbatEnd)}`;
  }, [shabbatTimes, timesError, timesLoading]);

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
        {!isFemaleUser && (
          <Pressable style={[s.streakCard, { backgroundColor: C.primaryLight }]} onPress={openTefillinPrompt}>
            <Text style={[s.streakNumber, { color: C.primary }]}>{displayTefillinStreak}</Text>
            <Text style={[s.streakLabel, { color: C.primary }]}>Tefillin Streak</Text>
            <Text style={{ fontSize: 10, color: C.primary, marginTop: 2, fontWeight: "600" }}>Tap to log today</Text>
          </Pressable>
        )}
      </View>

      {WEEKLY_VIDEO_FEATURE_ENABLED && isWeeklyVideoUploader && (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Weekly Video</Text>
          <Text style={s.sectionDesc}>
            Kesher's weekly video for this Shabbat week. Only {WEEKLY_VIDEO_UPLOADER_EMAIL} can upload or replace it.
          </Text>
          <Text style={s.toggleHint}>Week: {weekId}</Text>
          {weeklyVideo ? (
            <View style={s.weeklyVideoCard}>
              <Text style={s.weeklyVideoTitle}>{weeklyVideo.fileName ?? "Weekly video"}</Text>
              <Text style={s.sectionDesc}>
                {weeklyVideo.durationSeconds
                  ? `${Math.round(weeklyVideo.durationSeconds)} seconds`
                  : "Video saved"} · Kesher weekly video
              </Text>
              <View style={s.weeklyVideoActions}>
                <Pressable style={[s.outlineBtn, { flex: 1 }]} onPress={() => Linking.openURL(weeklyVideo.downloadUrl)}>
                  <Text style={s.outlineBtnText}>View</Text>
                </Pressable>
                <Pressable style={[s.outlineBtn, { flex: 1 }]} onPress={onPickWeeklyVideo} disabled={weeklyVideoLoading}>
                  <Text style={s.outlineBtnText}>Replace</Text>
                </Pressable>
                <Pressable style={[s.dangerBtn, { flex: 1 }]} onPress={onDeleteWeeklyVideo} disabled={weeklyVideoLoading}>
                  <Text style={s.dangerBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={[s.primaryBtn, weeklyVideoLoading && s.disabled]} onPress={onPickWeeklyVideo} disabled={weeklyVideoLoading}>
              {weeklyVideoLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryBtnText}>Upload Weekly Video</Text>}
            </Pressable>
          )}
        </View>
      )}

      {/* Shabbat Block Level */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Shabbat Mode</Text>
        <Text style={s.sectionDesc}>Choose your level of observance. Custom opens Apple's Screen Time picker if setup is needed.</Text>
        <View style={s.blockGrid}>
          {(["full", "custom", "none"] as BlockLevel[]).map((level) => {
            const info = BLOCK_INFO[level];
            const active = blockLevel === level;
            const selectedCount = level === "custom" ? customSelectionCount : null;
            return (
              <Pressable
                key={level}
                style={[s.blockOption, active && s.blockOptionActive]}
                onPress={() => saveBlockLevel(level)}
              >
                <Text style={[s.blockTitle, active && s.blockTitleActive]}>{info.title}</Text>
                <Text style={[s.blockDesc, active && s.blockDescActive]}>{info.desc}</Text>
                {selectedCount !== null && (
                  <Text style={[s.blockDesc, active && s.blockDescActive, { marginTop: 6 }]}>
                    {selectedCount > 0 ? `${selectedCount} selected` : "Setup required"}
                  </Text>
                )}
              </Pressable>
            );
          })}
          <View style={[s.blockOption, s.blockOptionPlaceholder]} />
        </View>

        {blockLevel === "custom" && (
          <Pressable style={s.outlineBtn} onPress={onCustomizeShabbatBlock}>
            <Text style={s.outlineBtnText}>
              Customize Shabbat Block{customSelectionCount > 0 ? ` (${customSelectionCount} selected)` : ""}
            </Text>
          </Pressable>
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

        {isFemaleUser ? (
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>Candle Lighting Reminder</Text>
              <Text style={s.toggleHint}>Notification 15 minutes before Shabbat begins</Text>
            </View>
            <Switch
              value={Boolean(user?.wantsShabbatReminders)}
              onValueChange={onToggleShabbatReminder}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={user?.wantsShabbatReminders ? "#FFFFFF" : "#f4f4f5"}
              ios_backgroundColor={C.border}
            />
          </View>
        ) : (
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
        )}
        {/* Modeh Ani */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.toggleLabel}>Modeh Ani</Text>
              <Pressable onPress={() => setShowDailyInfo("modehAni")} hitSlop={12}>
                <View style={s.infoIcon}><Text style={s.infoIconText}>i</Text></View>
              </Pressable>
            </View>
            <Text style={s.toggleHint}>Blocks your apps at wake-up until you read the prayer</Text>
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
        {((!isFemaleUser && user?.wantsMorningReminders) || user?.wantsModehAniReminder) && (
          <View style={s.inlineTimeSection}>
            <Text style={s.timeSectionTitle}>Wake Up Time</Text>
            <Text style={s.toggleHint}>
              {user?.wantsModehAniReminder && !isFemaleUser && user?.wantsMorningReminders
                ? "Modeh Ani prayer overlay at this time, tefillin notification 15 min later"
                : user?.wantsModehAniReminder
                  ? "Modeh Ani prayer overlay at this time"
                  : "Tefillin notification 15 min after this time"}
            </Text>
            <Pressable style={s.timeSelectRow} onPress={() => setTimePickerKind("wake")}>
              <Text style={[s.timeSelectValue, !user?.wakeUpTime && { color: C.textLight }]}>{user?.wakeUpTime ?? "Set wake-up time"}</Text>
              <Text style={s.timeSelectChevron}>⌄</Text>
            </Pressable>
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
            <Text style={s.toggleHint}>Blocks your apps 15 minutes before bedtime until you read the prayer</Text>
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
            <Pressable style={s.timeSelectRow} onPress={() => setTimePickerKind("bed")}>
              <Text style={[s.timeSelectValue, !user?.bedTime && { color: C.textLight }]}>{user?.bedTime ?? "Set bed time"}</Text>
              <Text style={s.timeSelectChevron}>⌄</Text>
            </Pressable>
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
      {upcomingHolidays.length > 0 && (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Upcoming Holidays</Text>
          <Text style={s.sectionDesc}>These holidays also have restrictions on phone use, similar to Shabbat. Participation is optional and does not affect your Shabbat streak.</Text>
          {upcomingHolidays.map((holiday, idx) => (
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

      {/* Shabbat Times */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>This Shabbat</Text>
        <Text style={s.sectionValue}>{timesDisplay}</Text>
        <Pressable onPress={() => Linking.openURL("https://www.hebcal.com/")}>
          <Text style={s.attributionText}>Times and zmanim provided by Hebcal.com</Text>
        </Pressable>
        {isShabbatNow && <View style={s.liveBadge}><Text style={s.liveBadgeText}>SHABBAT NOW</Text></View>}
        {!isStreakEligible && (
          <Text style={{ fontSize: 11, color: C.textLight, marginTop: 6 }}>
            Select a block mode above to keep your streak alive each Shabbat.
          </Text>
        )}
      </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderBlockTab = () => (
    <ScrollView
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!focusDialDragging}
    >
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Custom Block</Text>
        <Text style={s.sectionDesc}>
          Start a separate app block for your own focus time. This does not affect Shabbat, prayer, or tefillin streaks.
        </Text>
        {shabbatBlockIsActive ? (
          <View style={s.highlightBox}>
            <Text style={s.highlightText}>Shabbat blocking is active, so no other blocks can be started right now.</Text>
          </View>
        ) : (
          <>
            <View ref={focusDialRef} style={s.focusTimerDial} {...focusDialPanResponder.panHandlers}>
              {renderFocusDialTicks(focusDialProgress)}
              <View style={[s.focusTimerKnob, focusDialKnobStyle]} />
              <Text style={s.focusTimerText}>{formatCountdown(personalBlockMinutes * 60000)}</Text>
              <Text style={s.focusTimerLabel}>Drag to Set Focus</Text>
            </View>
            <Text style={[s.sectionDesc, { textAlign: "center", marginTop: 8 }]}>Up to 3 hours</Text>
            <Text style={[s.toggleLabel, { marginTop: 14 }]}>Quick Times</Text>
            <View style={s.durationPills}>
              {[15, 30, 60, 120, 180].map((minutes) => (
                <Pressable
                  key={minutes}
                  style={[s.timePill, personalBlockMinutes === minutes && s.timePillActive]}
                  onPress={() => {
                    setPersonalBlockMinutes(minutes);
                  }}
                >
                  <Text style={[s.timePillText, personalBlockMinutes === minutes && s.timePillTextActive]}>
                    {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[s.sectionDesc, { marginTop: 10 }]}>
              {personalBlockSelectionCount > 0
                ? `${personalBlockSelectionCount} apps, categories, or websites selected`
                : "No apps selected yet"}
            </Text>
            <Pressable style={s.outlineBtn} onPress={onSetupPersonalBlock}>
              <Text style={s.outlineBtnText}>Customize Apps</Text>
            </Pressable>
            {personalBlockEndsAt && personalBlockEndsAt.getTime() > Date.now() ? (
              <>
                <Text style={[s.sectionDesc, { textAlign: "center", marginTop: 10 }]}>
                  Active until {formatTime(personalBlockEndsAt)}
                </Text>
                <Pressable style={s.dangerBtn} onPress={onConfirmBreakFocus}>
                  <Text style={s.dangerBtnText}>Stop Block</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={s.primaryBtn} onPress={onStartPersonalBlock}>
                <Text style={s.primaryBtnText}>Start Block</Text>
              </Pressable>
            )}
            <View style={s.focusStatsRow}>
              <View style={s.focusStatCard}>
                <Text style={s.focusStatNumber}>{personalBlockSuccessCount}</Text>
                <Text style={s.focusStatLabel}>Successful</Text>
              </View>
              <View style={s.focusStatCard}>
                <Text style={[s.focusStatNumber, { color: C.danger }]}>{personalBlockBrokenCount}</Text>
                <Text style={s.focusStatLabel}>Broken</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderTefillinBuddiesTab = () => {
    if (socialSubTab === "buddyChat" || socialSubTab === "groupCreate") {
      return renderSocialTab();
    }

    return (
      <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
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

          {isTefillinRestDay && (
            <View style={s.highlightBox}>
              <Text style={s.highlightText}>
                {isShabbatNow
                  ? "It is Shabbat, so tefillin photos are disabled and streaks stay unchanged."
                  : "Tefillin is not worn on Shabbat (Saturday). Photos are disabled today and your streak takes a gap day — you won't lose it."}
              </Text>
            </View>
          )}

          {allBuddyChatsOrdered.length > 0 ? (
            <View style={s.buddyStreakList}>
              {allBuddyChatsOrdered.map((chat) => {
                if (chat.type === "pair") {
                  const buddyUid = chat.memberUids.find((uid) => uid !== user?.uid);
                  const buddy = friends.find((f) => f.uid === buddyUid);
                  if (!buddy) return null;
                  const lastDate = buddy.lastTefillinDate;
                  const isToday = lastDate === todayDateStr();
                  const incomingImageUrl = latestIncomingBuddyImageFor(buddy.uid);
                  return (
                    <Pressable key={chat.id} style={s.buddyStreakRow} onPress={() => openBuddyChat(buddy)}>
                      <Pressable onPress={() => setViewingFriend(buddy)} hitSlop={4}>
                        <View style={[s.buddyAvatarLarge, !isToday && { opacity: 0.7 }]}>
                          {incomingImageUrl ? (
                            <Image source={{ uri: incomingImageUrl }} style={s.buddyAvatarImage} />
                          ) : (
                            <Text style={s.buddyAvatarLargeText}>{(buddy.displayName ?? "?")[0]?.toUpperCase()}</Text>
                          )}
                          {isToday && <View style={s.buddyAvatarDot} />}
                          {incomingImageUrl && <View style={s.buddyIncomingBadge}><Text style={s.buddyIncomingBadgeText}>New</Text></View>}
                        </View>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={s.buddyNameLarge}>{buddy.displayName ?? "Unknown"}</Text>
                        {incomingImageUrl && <Text style={s.buddyIncomingText}>New tefillin photo received</Text>}
                        <Text style={s.buddyStreakText}>{chat.streakCount} day streak</Text>
                      </View>
                      <Pressable
                        style={[s.buddySnapBtn, { backgroundColor: (isTefillinRestDay || buddyChatImageLoading) ? C.border : C.primary }]}
                        onPress={() => captureTefillinPhoto(chat)}
                        disabled={isTefillinRestDay || buddyChatImageLoading}
                      >
                        {buddyChatImageLoading ? <ActivityIndicator color="#FFF" size="small" /> : <CameraIcon size={22} color="#FFF" />}
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
                      style={[s.buddySnapBtn, { backgroundColor: (isTefillinRestDay || buddyChatImageLoading) ? C.border : C.primary }]}
                      onPress={() => captureTefillinPhoto(chat)}
                      disabled={isTefillinRestDay || buddyChatImageLoading}
                    >
                      {buddyChatImageLoading ? <ActivityIndicator color="#FFF" size="small" /> : <CameraIcon size={22} color="#FFF" />}
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
    );
  };

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
                <Pressable style={s.congBannerBtn} onPress={openCongregationChat}>
                  <Text style={s.congBannerBtnText}>Chat</Text>
                  {hasUnreadCongregationChat && <View style={s.chatNotificationDot} />}
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

          {/* Friends Leaderboard */}
          <View style={[s.leaderboardHeader, s.friendLeaderboardHeader]}>
            <Text style={s.leaderboardHeaderText}>Friend Leaderboard</Text>
            <Text style={s.leaderboardHeaderSubtext}>People you added as friends</Text>
          </View>
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
                    showTefillinStreak={!isFemaleUser}
                    showNotification={Boolean(unreadDmUids[friend.uid])}
                  />
                </Pressable>
              ))
            )}
          </View>

          {/* Congregation Members */}
          {congregationMembers.length > 0 && (
            <>
              <View style={[s.leaderboardHeader, s.congregationLeaderboardHeader]}>
                <Text style={s.leaderboardHeaderText}>
                  Congregation Leaderboard
                </Text>
                <Text style={s.leaderboardHeaderSubtext}>{currentCongregation?.name ?? "Your congregation"}</Text>
              </View>
              <View style={s.leaderboardCard}>
                {congregationMembers
                  .sort((a, b) => (b.currentStreak ?? 0) - (a.currentStreak ?? 0))
                  .map((member, idx) => (
                    <LeaderboardRow
                      key={member.uid}
                      profile={member}
                      rank={idx + 1}
                      isCurrentUser={member.uid === user?.uid}
                      congregationName={currentCongregation?.name ?? null}
                      onAvatarPress={() => setViewingFriend(member)}
                    showTefillinStreak={!isFemaleUser}
                    />
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

          {false && (
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
                    const incomingImageUrl = latestIncomingBuddyImageFor(buddy.uid);
                    return (
                      <Pressable key={chat.id} style={s.buddyStreakRow} onPress={() => openBuddyChat(buddy)}>
                        <Pressable onPress={() => setViewingFriend(buddy)} hitSlop={4}>
                          <View style={[s.buddyAvatarLarge, !isToday && { opacity: 0.7 }]}>
                            {incomingImageUrl ? (
                              <Image source={{ uri: incomingImageUrl }} style={s.buddyAvatarImage} />
                            ) : (
                              <Text style={s.buddyAvatarLargeText}>{(buddy.displayName ?? "?")[0]?.toUpperCase()}</Text>
                            )}
                            {isToday && <View style={s.buddyAvatarDot} />}
                            {incomingImageUrl && <View style={s.buddyIncomingBadge}><Text style={s.buddyIncomingBadgeText}>New</Text></View>}
                          </View>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Text style={s.buddyNameLarge}>{buddy.displayName ?? "Unknown"}</Text>
                          {incomingImageUrl && <Text style={s.buddyIncomingText}>New tefillin photo received</Text>}
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
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Chat View (accessed from congregation banner) */}
      {socialSubTab === "chat" && (
        <KeyboardAvoidingView style={s.chatThread} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={120}>
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
                style={s.chatThread}
                inverted
                data={displayedChatMessages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.chatList}
                renderItem={renderCongregationMessage}
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
        <KeyboardAvoidingView style={s.chatThread} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={120}>
          <FlatList
            style={s.chatThread}
            inverted
            data={displayedDmMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.chatList}
            renderItem={renderDirectMessage}
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
          {(sunBlockedMessage || isTefillinRestDay) && (
            <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>🌙</Text>
              <Text style={{ color: "#92400E", fontSize: 13, flex: 1 }}>
                {isShabbatNow
                  ? "Tefillin photos are disabled on Shabbat."
                  : isSaturdayToday
                    ? "Tefillin is not worn on Shabbat (Saturday). Photos are disabled today — your streak takes a gap day."
                    : sunBlockedMessage}
              </Text>
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
                if (item.type === "image" && item.imageUrl) {
                  if (!isMine && !item.opened) {
                    onMarkBuddyMessageOpened(item);
                  }
                  setViewingBuddyImage(item);
                  return;
                }
                if (!isSaved) {
                  onSaveMessageToChat(item);
                }
              };
              const onLongPressImage = () => {
                if (item.type !== "image" || !item.imageUrl) return;
                onToggleMessageSavedInChat(item);
              };
              return (
                <Pressable
                  onPress={onPressMessage}
                  onLongPress={item.type === "image" && item.imageUrl ? onLongPressImage : undefined}
                  style={[s.chatBubble, isMine && s.chatBubbleMine]}
                >
                  {!isMine && <Text style={s.chatSender}>{item.senderName}</Text>}
                  {item.type === "image" && item.imageUrl ? (
                    item.isStreakEligible ? (
                      <View style={s.snapImageFrame}>
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={s.snapImage}
                          resizeMode="cover"
                        />
                        <View style={s.snapBadge}>
                          <Text style={s.snapBadgeText}>Tefillin Snap</Text>
                        </View>
                      </View>
                    ) : (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={{ width: 200, height: 200, borderRadius: 12, marginVertical: 4 }}
                        resizeMode="cover"
                      />
                    )
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
              style={[s.buddyChatIconBtn, { backgroundColor: (sunBlockedMessage || isTefillinRestDay) ? C.border : C.primary }]}
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
              <Text style={s.parashaSummary}>This week's original Torah reflection is loading. For more in-depth learning, explore Rabbi Gordon's weekly explanations.</Text>
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

      <Pressable style={s.primaryBtn} onPress={() => Linking.openURL(getRabbiGordonParashaUrl())}>
        <Text style={s.primaryBtnText}>Learn with Rabbi Gordon</Text>
      </Pressable>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderPhoneNumberInput = (
    country: PhoneCountry,
    pickerFor: "login" | "signup",
    value: string,
    onChangeText: (text: string) => void,
    editable: boolean
  ) => (
    <View style={s.phoneInputRow}>
      <Pressable
        style={s.phoneCountryBtn}
        onPress={() => setPhoneCountryPickerFor(pickerFor)}
        disabled={!editable}
      >
        <Text style={s.phoneCountryFlag}>{country.flag}</Text>
        <Text style={s.phoneCountryCode}>{country.dialCode}</Text>
      </Pressable>
      <TextInput
        placeholder="Phone number"
        value={value}
        onChangeText={onChangeText}
        style={s.phoneLocalInput}
        placeholderTextColor={C.textLight}
        keyboardType="phone-pad"
        editable={editable}
      />
    </View>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /*                      AUTH SCREENS                          */
  /* ═══════════════════════════════════════════════════════════ */

  if (showSplash) {
    return <AppSplash onDone={() => setShowSplash(false)} />;
  }

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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <ScrollView
            contentContainerStyle={s.authScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
          >
            {authMode === "choose" && (
            <>
              <AppCover />
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
                {renderPhoneNumberInput(authPhoneCountry, "login", authPhone, setAuthPhone, !actionLoading)}
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
                <View style={s.authProfileIntro}>
                  <Text style={s.authProfileKicker}>Your profile</Text>
                  <Text style={s.authProfileTitle}>Tell us a little about you</Text>
                  <Text style={s.authProfileSubtitle}>This helps Kesher personalize prayer and tefillin features.</Text>
                </View>
                <TextInput placeholder="Full name" value={signupName} onChangeText={setSignupName} style={s.authInput} placeholderTextColor={C.textLight} editable={!actionLoading} />
                <Text style={s.authFieldLabel}>Sex</Text>
                <View style={s.sexOptionGrid}>
                  {(["male", "female"] as const).map((sex) => (
                    <Pressable
                      key={sex}
                      style={[s.sexOptionCard, signupSex === sex && s.sexOptionCardActive]}
                      onPress={() => { setSignupSex(sex); setAuthError(null); }}
                    >
                      <Text style={s.sexOptionIcon}>{sex === "male" ? "T" : "S"}</Text>
                      <Text style={[s.sexOptionTitle, signupSex === sex && s.sexOptionTitleActive]}>
                        {sex === "male" ? "Male" : "Female"}
                      </Text>
                      <Text style={[s.sexOptionHint, signupSex === sex && s.sexOptionHintActive]}>
                        {sex === "male" ? "Includes tefillin tools" : "Hides tefillin prompts"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                    {renderPhoneNumberInput(signupPhoneCountry, "signup", signupPhone, setSignupPhone, !actionLoading)}
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
        </KeyboardAvoidingView>

        {/* Phone Country Picker */}
        <Modal visible={phoneCountryPickerFor !== null} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, { maxHeight: "75%" }]}>
              <Text style={s.modalTitle}>Select country</Text>
              <Text style={[s.sectionDesc, { marginTop: 8 }]}>
                We'll add the country code automatically before sending the verification code.
              </Text>
              <ScrollView style={s.phoneCountryList} showsVerticalScrollIndicator={false}>
                {PHONE_COUNTRIES.map((country) => {
                  const selected =
                    phoneCountryPickerFor === "login"
                      ? authPhoneCountry.iso === country.iso
                      : signupPhoneCountry.iso === country.iso;
                  return (
                    <Pressable
                      key={`${country.iso}-${country.dialCode}`}
                      style={[s.phoneCountryOption, selected && s.phoneCountryOptionActive]}
                      onPress={() => {
                        if (phoneCountryPickerFor === "login") {
                          setAuthPhoneCountry(country);
                          setPhoneConfirmation(null);
                          setAuthPhoneCode("");
                        } else {
                          setSignupPhoneCountry(country);
                          setSignupPhoneConfirmation(null);
                          setSignupPhoneCode("");
                        }
                        setPhoneCountryPickerFor(null);
                      }}
                    >
                      <View>
                        <Text style={s.phoneCountryOptionName}>{country.flag} {country.name}</Text>
                        <Text style={s.phoneCountryOptionCode}>{country.dialCode}</Text>
                      </View>
                      {selected && <Text style={s.phoneCountrySelectedMark}>Selected</Text>}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable style={s.ghostBtn} onPress={() => setPhoneCountryPickerFor(null)}>
                <Text style={s.ghostBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

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
            We sent a Kesher Social verification link to {user.email ?? "your email"}. Open it, then come back and tap below.
          </Text>
          <Text style={[s.toggleHint, { textAlign: "center", marginTop: 8 }]}>
            If you do not see it, check Spam or Promotions and mark it as not spam.
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

  const appleSignedIn = isAppleProvider();
  const needsGenderSetup = user.gender !== "male" && user.gender !== "female";
  const needsNameSetup = !user.displayName?.trim() && !appleSignedIn;
  const needsProfileSetup = needsGenderSetup || needsNameSetup;
  const resolvedAppleDisplayName = resolveProfileDisplayName({
    profileDisplayName: user.displayName,
    inputDisplayName: profileName,
    authDisplayName: getAuthUserDisplayName(),
    email: user.email,
  });
  if (needsProfileSetup) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={[s.centered, { paddingHorizontal: 24 }]}>
          <View style={s.profileSetupCard}>
            <View style={s.authProfileIntro}>
              <Text style={s.authProfileKicker}>Welcome to Kesher</Text>
              <Text style={s.authProfileTitle}>
                {appleSignedIn ? `Shalom, ${resolvedAppleDisplayName.split(" ")[0]}` : "Set up your profile"}
              </Text>
              <Text style={s.authProfileSubtitle}>
                {appleSignedIn
                  ? "Choose the experience that fits you. We won't ask for your Apple name or email again."
                  : "A few details let us show the right reminders and daily tools."}
              </Text>
            </View>
            {!appleSignedIn && needsNameSetup && (
              <TextInput placeholder="Name" value={profileName} onChangeText={setProfileName} style={[s.authInput, s.fullWidth]} placeholderTextColor={C.textLight} />
            )}
            <Text style={s.authFieldLabel}>Sex</Text>
            <View style={s.sexOptionGrid}>
              {(["male", "female"] as const).map((sex) => (
                <Pressable
                  key={sex}
                  style={[s.sexOptionCard, profileSex === sex && s.sexOptionCardActive]}
                  onPress={() => setProfileSex(sex)}
                >
                  <Text style={s.sexOptionIcon}>{sex === "male" ? "T" : "S"}</Text>
                  <Text style={[s.sexOptionTitle, profileSex === sex && s.sexOptionTitleActive]}>
                    {sex === "male" ? "Male" : "Female"}
                  </Text>
                  <Text style={[s.sexOptionHint, profileSex === sex && s.sexOptionHintActive]}>
                    {sex === "male" ? "Includes tefillin tools" : "Hides tefillin prompts"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[s.primaryBtn, s.fullWidth, actionLoading && s.disabled]} onPress={onSaveProfile} disabled={actionLoading}>
              <Text style={s.primaryBtnText}>Save and continue</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (shabbatBlockIsActive) {
    return (
      <SafeAreaView style={s.shabbatOnlyScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={s.shabbatOnlyContent}>
          <Text style={s.shabbatOnlyTitle}>Shabbat</Text>
          <Text style={s.shabbatOnlyTime}>
            Shabbat ends at {shabbatTimes ? formatTime(shabbatTimes.shabbatEnd) : "..."}
          </Text>
          <Text style={s.shabbatOnlyMessage}>
            It is Shabbat. Kesher is keeping the rest of your phone quiet. Open Kesher only if you want to break Shabbat.
          </Text>
          <Text style={s.shabbatOnlyIntent}>Why you are keeping Shabbat: {savedIntentText || DEFAULT_SHABBAT_INTENTION}</Text>
        </View>
        <View style={s.shabbatOnlyActions}>
          <Pressable
            style={[s.dangerBtn, actionLoading && s.disabled]}
            onPress={onMinimalShabbatBreak}
            disabled={actionLoading}
          >
            <Text style={s.dangerBtnText}>Break Shabbat</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (personalBlockIsActive) {
    const unblocking = focusUnblockCountdown !== null;
    return (
      <SafeAreaView style={s.focusOnlyScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={s.focusOnlyContent}>
          <View style={s.focusOnlyDial}>
            {renderFocusDialTicks(
              personalBlockRemainingMs / Math.max(1, personalBlockMinutes * 60000),
              250,
              112
            )}
            <Text style={s.focusOnlyTime}>{formatCountdown(personalBlockRemainingMs)}</Text>
          </View>
          {focusQuote ? (
            <View style={s.focusQuoteCard}>
              <Text style={s.focusQuoteText}>{focusQuote}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.focusOnlyActions}>
          {unblocking ? (
            <>
              <Text style={s.focusUnblockNotice}>
                Unblocking in {focusUnblockCountdown}s. Take a breath — you can stay focused.
              </Text>
              <Pressable style={s.primaryBtn} onPress={cancelFocusUnblock}>
                <Text style={s.primaryBtnText}>Keep Me Focused</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[s.dangerBtn, actionLoading && s.disabled]}
              onPress={beginFocusUnblock}
              disabled={actionLoading}
            >
              <Text style={s.dangerBtnText}>Break Focus</Text>
            </Pressable>
          )}
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
          {activeTab === "home"
            ? "Home"
            : activeTab === "block"
              ? "Block"
              : activeTab === "social"
                ? "Social"
                : activeTab === "buddies"
                  ? "Tefillin Buddies"
                  : "Torah"}
        </Text>
        <Pressable style={s.profileBtn} onPress={() => setSettingsVisible(true)}>
          <View style={s.profileBtnCircle}>
            <Text style={s.profileBtnText}>{(user?.displayName ?? "?")[0]?.toUpperCase()}</Text>
            {(user?.pendingFriendUids?.length ?? 0) > 0 && <View style={s.profileBadge} />}
          </View>
        </Pressable>
      </View>

      {/* Body */}
      <Animated.View
        style={[s.body, { opacity: tabContentAnim, transform: [{ translateX: tabSlideAnim }] }]}
        {...tabSwipePanResponder.panHandlers}
      >
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "block" && renderBlockTab()}
        {activeTab === "social" && renderSocialTab()}
        {!isFemaleUser && activeTab === "buddies" && renderTefillinBuddiesTab()}
        {activeTab === "parasha" && renderParashaTab()}
      </Animated.View>

      {/* Tab Bar — Torah / Home / Social */}
      <View style={s.tabBar}>
        <TabItem label="Torah" active={activeTab === "parasha"} onPress={() => setActiveTab("parasha")} />
        <TabItem label="Block" active={activeTab === "block"} onPress={() => setActiveTab("block")} />
        <TabItem label="Home" active={activeTab === "home"} onPress={() => setActiveTab("home")} />
        <TabItem label="Social" active={activeTab === "social"} showBadge={hasUnreadSocialMessages} onPress={() => { setSocialSubTab("friends"); setActiveTab("social"); }} />
        {!isFemaleUser && (
          <TabItem label="Buddies" active={activeTab === "buddies"} onPress={() => { setSocialSubTab("friends"); setActiveTab("buddies"); }} />
        )}
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

      {/* Vertical "liquid glass" time picker */}
      <WheelTimePicker
        visible={timePickerKind !== null}
        title={timePickerKind === "bed" ? "Bed Time" : "Wake-Up Time"}
        options={timePickerKind === "bed" ? BED_TIMES : WAKE_TIMES}
        value={timePickerKind === "bed" ? (user?.bedTime ?? null) : (user?.wakeUpTime ?? null)}
        onSelect={(t) => {
          if (timePickerKind === "bed") onSetBedTime(t);
          else onSetWakeTime(t);
        }}
        onClose={() => setTimePickerKind(null)}
      />

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
              Answer yes to keep your tefillin streak going. No will ask again next time you open the app. Ignore turns this question off for today.
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
                  {(() => {
                    const incomingImageUrl = latestIncomingBuddyImageFor(viewingFriend.uid);
                    return (
                      <>
                        <View style={[s.buddyAvatarLarge, { width: 64, height: 64, borderRadius: 32 }]}>
                          {incomingImageUrl ? (
                            <Image source={{ uri: incomingImageUrl }} style={[s.buddyAvatarImage, { width: 64, height: 64, borderRadius: 32 }]} />
                          ) : (
                            <Text style={[s.buddyAvatarLargeText, { fontSize: 26 }]}>{(viewingFriend.displayName ?? "?")[0]?.toUpperCase()}</Text>
                          )}
                        </View>
                        {incomingImageUrl && (
                          <View style={s.friendIncomingPhotoCard}>
                            <Image source={{ uri: incomingImageUrl }} style={s.friendIncomingPhoto} />
                            <Text style={s.friendIncomingPhotoText}>Latest tefillin photo from {viewingFriend.displayName ?? "your friend"}</Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
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
                    {!isFemaleUser && (
                      <View style={[s.streakCard, { backgroundColor: C.primaryLight, flex: 1 }]}>
                        <Text style={[s.streakNumber, { color: C.primary }]}>{viewingFriend.tefillinCurrentStreak ?? 0}</Text>
                        <Text style={[s.streakLabel, { color: C.primary }]}>Tefillin</Text>
                      </View>
                    )}
                  </View>
                )}
                {viewingFriend.streakVisibility === "private" && (
                  <View style={{ alignItems: "center", paddingVertical: 12, backgroundColor: C.surface, borderRadius: 16, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: C.textLight }}>Streaks are private</Text>
                  </View>
                )}

                <View style={{ gap: 10, marginTop: 20 }}>
                  {(() => {
                    const actionState = friendActionState(viewingFriend);
                    const isFriend = actionState === "friend";
                    return (
                      <>
                        {isFriend && (
                          <Pressable
                            style={s.primaryBtn}
                            onPress={() => {
                              const f = viewingFriend;
                              setViewingFriend(null);
                              if (!isFemaleUser && tefillinBuddyUids.includes(f.uid)) {
                                openBuddyChat(f);
                              } else {
                                openDmWith(f);
                              }
                            }}
                          >
                            <Text style={s.primaryBtnText}>Message</Text>
                          </Pressable>
                        )}
                        {actionState === "open" || actionState === "request" ? (
                          <Pressable
                            style={s.primaryBtn}
                            onPress={() => onSendFriendRequest(viewingFriend.uid)}
                            disabled={actionLoading}
                          >
                            <Text style={s.primaryBtnText}>
                              {actionState === "open" ? "Add Friend" : "Send Friend Request"}
                            </Text>
                          </Pressable>
                        ) : actionState === "pending" ? (
                          <View style={s.highlightBox}>
                            <Text style={s.highlightText}>Friend request sent</Text>
                          </View>
                        ) : actionState === "closed" ? (
                          <View style={s.highlightBox}>
                            <Text style={s.highlightText}>This user is not accepting friend requests at the moment.</Text>
                          </View>
                        ) : null}
                        {isFriend && (
                          <>
                            {!isFemaleUser && (
                              tefillinBuddyUids.includes(viewingFriend.uid) ? (
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
                              )
                            )}
                            <Pressable
                              style={[s.primaryBtn, { backgroundColor: C.dangerLight }]}
                              onPress={() => onUnfriend(viewingFriend.uid)}
                              disabled={actionLoading}
                            >
                              <Text style={[s.primaryBtnText, { color: C.danger }]}>Remove Friend</Text>
                            </Pressable>
                          </>
                        )}
                      </>
                    );
                  })()}
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
                  <Pressable key={member.uid} style={[s.buddyAddRow, { paddingVertical: 10 }]} onPress={() => !isMe && setViewingFriend(member)}>
                    <View style={s.friendAvatar}>
                      <Text style={s.friendAvatarText}>{(member.displayName ?? "?")[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{member.displayName ?? "Unknown"}</Text>
                    </View>
                    {!isMe && (
                      <Pressable
                        style={[s.rejectBtn, { paddingHorizontal: 8, paddingVertical: 4 }]}
                        onPress={() => onRemoveMemberFromGroup(member.uid)}
                      >
                        <Text style={[s.rejectBtnText, { fontSize: 11 }]}>Remove</Text>
                      </Pressable>
                    )}
                  </Pressable>
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

      {/* Buddy Image Viewer */}
      <Modal visible={viewingBuddyImage !== null} animationType="fade" transparent>
        <View style={s.imageViewerOverlay}>
          {viewingBuddyImage?.imageUrl && (
            <Pressable style={s.imageViewerCloseArea} onPress={() => setViewingBuddyImage(null)}>
              <ScrollView
                style={s.imageViewerScroll}
                contentContainerStyle={s.imageViewerScrollContent}
                maximumZoomScale={4}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image source={{ uri: viewingBuddyImage.imageUrl }} style={s.imageViewerImage} resizeMode="contain" />
              </ScrollView>
            </Pressable>
          )}
        </View>
      </Modal>

      {/* Prayer Blocking Overlay — blocks all app usage until user reads the prayer */}
      <Modal visible={prayerBlockingType !== null} animationType="fade">
        <View style={s.prayerBlockingContainer}>
          <StatusBar barStyle="light-content" />
          <View style={s.prayerTextModeSwitch}>
            <View>
              <Text style={s.prayerTextModeTitle}>Prayer Text</Text>
              <Text style={s.prayerTextModeSubtitle}>
                {showPrayerTransliteration ? "Showing English transliteration" : "Showing Hebrew"}
              </Text>
            </View>
            <View style={s.prayerTextModeControl}>
              <Text style={s.prayerTextModePill}>Hebrew</Text>
              <Switch
                value={showPrayerTransliteration}
                onValueChange={setShowPrayerTransliteration}
                trackColor={{ false: "rgba(255,255,255,0.32)", true: C.primary }}
                thumbColor="#FFFFFF"
              />
              <Text style={s.prayerTextModePill}>Translit.</Text>
            </View>
          </View>
          <ScrollView
            style={s.prayerBlockingScroll}
            contentContainerStyle={s.prayerBlockingScrollContent}
            showsVerticalScrollIndicator={false}
          >
          {prayerBlockingType === "modehAni" && (
            <>
              <Text style={s.prayerBlockingLabel}>Good Morning</Text>
              <Text style={s.prayerBlockingTitle}>Modeh Ani</Text>
              <Text style={s.prayerBlockingInstruction}>Open Kesher and recite the Modeh Ani.</Text>
              <Text style={showPrayerTransliteration ? s.prayerBlockingTransliteration : s.prayerBlockingHebrew}>
                {showPrayerTransliteration ? PRAYER_TEXTS.modehAni.transliteration : PRAYER_TEXTS.modehAni.hebrew}
              </Text>
              <Text style={s.prayerBlockingEnglish}>{PRAYER_TEXTS.modehAni.english}</Text>
            </>
          )}
          {prayerBlockingType === "shema" && (
            <>
              <Text style={s.prayerBlockingLabel}>Good Night</Text>
              <Text style={s.prayerBlockingTitle}>{shemaPrayerPage === 0 ? "Shema" : "Ve'ahavta"}</Text>
              <Text style={s.prayerBlockingInstruction}>
                {shemaPrayerPage === 0
                  ? "Open Kesher and recite the Shema."
                  : "Continue with Ve'ahavta before completing the block."}
              </Text>
              <Text style={showPrayerTransliteration ? s.prayerBlockingTransliteration : s.prayerBlockingHebrew}>
                {shemaPrayerPage === 0
                  ? showPrayerTransliteration
                    ? PRAYER_TEXTS.shema.transliteration
                    : PRAYER_TEXTS.shema.hebrew
                  : showPrayerTransliteration
                    ? PRAYER_TEXTS.veahavta.transliteration
                    : PRAYER_TEXTS.veahavta.hebrew}
              </Text>
              <Text style={s.prayerBlockingEnglish}>
                {shemaPrayerPage === 0 ? PRAYER_TEXTS.shema.english : PRAYER_TEXTS.veahavta.english}
              </Text>
            </>
          )}
          </ScrollView>
          {prayerBlockingType === "shema" && shemaPrayerPage === 0 ? (
            <Pressable style={s.prayerBlockingBtn} onPress={() => setShemaPrayerPage(1)}>
              <Text style={s.prayerBlockingBtnText}>Next: Ve'ahavta</Text>
            </Pressable>
          ) : (
            <Pressable style={s.prayerBlockingBtn} onPress={onDismissPrayerBlocking}>
              <Text style={s.prayerBlockingBtnText}>I have read this</Text>
            </Pressable>
          )}
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
              <Text style={s.authFieldLabel}>Sex</Text>
              <View style={s.policyRow}>
                {(["male", "female"] as const).map((sex) => (
                  <Pressable
                    key={sex}
                    style={[s.policyPill, profileSex === sex && s.policyPillActive]}
                    onPress={() => setProfileSex(sex)}
                  >
                    <Text style={[s.policyPillText, profileSex === sex && s.policyPillTextActive]}>
                      {sex === "male" ? "Male" : "Female"}
                    </Text>
                  </Pressable>
                ))}
              </View>
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

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>{isFemaleUser ? "Candle Lighting Reminder" : "Shabbat Reminder"}</Text>
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>{isFemaleUser ? "15 min before candle lighting" : "15 min before Shabbat"}</Text>
                <Switch value={Boolean(user?.wantsShabbatReminders)} onValueChange={onToggleShabbatReminder} trackColor={{ false: C.border, true: C.primary }} thumbColor={user?.wantsShabbatReminders ? "#FFFFFF" : "#f4f4f5"} ios_backgroundColor={C.border} />
              </View>

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Chat Notifications</Text>
              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleLabel}>Buddy + congregation chats</Text>
                  <Text style={s.toggleHint}>Turn push alerts for chat messages on or off</Text>
                </View>
                <Switch
                  value={user?.wantsChatNotifications !== false}
                  onValueChange={onToggleChatNotifications}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor={user?.wantsChatNotifications !== false ? "#FFFFFF" : "#f4f4f5"}
                  ios_backgroundColor={C.border}
                />
              </View>

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Privacy</Text>
              <Text style={s.sectionDesc}>Review how Kesher handles account, location, chat, reminder, and Screen Time data.</Text>
              <Pressable style={s.outlineBtn} onPress={onOpenPrivacyPolicy}>
                <Text style={s.outlineBtnText}>View Privacy Policy</Text>
              </Pressable>
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

              <Text style={[s.sectionTitle, { marginTop: 20 }]}>Friend Requests</Text>
              <Text style={s.sectionDesc}>Choose how people who can see your profile may add you.</Text>
              <View style={s.policyRow}>
                {(["open", "request", "closed"] as const).map((status) => (
                  <Pressable
                    key={status}
                    style={[s.policyPill, (user?.friendRequestStatus ?? "request") === status && s.policyPillActive]}
                    onPress={async () => {
                      if (!user) return;
                      const updated = await updateUserProfile(user.uid, { friendRequestStatus: status });
                      setUser(updated);
                    }}
                  >
                    <Text style={[s.policyPillText, (user?.friendRequestStatus ?? "request") === status && s.policyPillTextActive]}>
                      {status === "open" ? "Open" : status === "request" ? "Request" : "Closed"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {pendingRequests.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  {pendingRequests.map((req) => (
                    <View key={req.uid} style={s.friendRow}>
                      <Pressable onPress={() => setViewingFriend(req)}>
                        <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(req.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={s.friendName}>{req.displayName ?? "Unknown"}</Text>
                      </View>
                      <Pressable style={s.acceptBtn} onPress={() => onAcceptFriendRequest(req.uid)}><Text style={s.acceptBtnText}>Accept</Text></Pressable>
                      <Pressable style={s.rejectBtn} onPress={() => onRejectFriendRequest(req.uid)}><Text style={s.rejectBtnText}>Decline</Text></Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable style={[s.dangerBtn, { marginTop: 24 }]} onPress={() => { setSettingsVisible(false); onPressSignOut(); }}>
                <Text style={s.dangerBtnText}>Sign Out</Text>
              </Pressable>
              <Pressable style={[s.dangerBtn, { marginTop: 10, backgroundColor: "#FECACA" }]} onPress={onDeleteAccount} disabled={actionLoading}>
                <Text style={s.dangerBtnText}>Delete Account</Text>
              </Pressable>
            </ScrollView>

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => setSettingsVisible(false)}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={privacyPolicyVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: "80%" }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Privacy Policy</Text>
              <Text style={s.sectionDesc}>Last updated: {PRIVACY_POLICY_LAST_UPDATED}</Text>
              <Text style={[s.sectionDesc, { marginTop: 12 }]}>
                This summary explains how Kesher handles account, location, chat, photo, reminder, notification, and Screen Time data.
              </Text>
              {PRIVACY_POLICY_SECTIONS.map((section) => (
                <View key={section.title} style={{ marginTop: 16 }}>
                  <Text style={s.sectionTitle}>{section.title}</Text>
                  <Text style={s.sectionDesc}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => setPrivacyPolicyVisible(false)}>
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
                <Pressable key={m.uid} style={s.friendRow} onPress={() => m.uid !== user?.uid && setViewingFriend(m)}>
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
                </Pressable>
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
              <Pressable style={[s.primaryBtn, { marginTop: 12 }]} onPress={onInviteFriends}>
                <Text style={s.primaryBtnText}>Invite Friends</Text>
              </Pressable>
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
              const requestState = friendActionState(friendCodeResult);
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
                    {requestState === "friend" ? (
                      <View style={[s.acceptBtn, { paddingHorizontal: 20, paddingVertical: 8 }]}>
                        <Text style={[s.acceptBtnText, { fontSize: 14 }]}>Already Friends</Text>
                      </View>
                    ) : requestState === "pending" ? (
                      <View style={[s.acceptBtn, { paddingHorizontal: 20, paddingVertical: 8 }]}>
                        <Text style={[s.acceptBtnText, { fontSize: 14 }]}>Request Sent</Text>
                      </View>
                    ) : requestState === "closed" ? (
                      <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: "center" }}>
                        This user is not accepting friend requests at the moment.
                      </Text>
                    ) : (
                      <Pressable style={[s.primaryBtn, { paddingHorizontal: 24 }]} onPress={() => onSendFriendRequest(friendCodeResult.uid)}>
                        <Text style={s.primaryBtnText}>{requestState === "open" ? "Add Friend" : "Send Friend Request"}</Text>
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
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={24}
        >
          <View style={[s.modalCard, { maxHeight: "85%" }]}>
            <Text style={s.modalTitle}>Congregation</Text>

            {!createCongregationVisible ? (
              <>
                <TextInput placeholder="Search congregation name..." value={congregationCitySearch} onChangeText={onCitySearchChange} style={s.authInput} placeholderTextColor={C.textLight} />

                {nearbyLoading && <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />}
                {nearbyError && <Text style={s.errorText}>{nearbyError}</Text>}

                <ScrollView style={{ maxHeight: 260, marginTop: 8 }} keyboardShouldPersistTaps="handled">
                  {nearbyCongregations.map((cong) => (
                    <Pressable key={cong.id} style={s.congListItem} onPress={() => onJoinCongregation(cong.id)}>
                      <Text style={s.congListName}>{cong.name}</Text>
                      <Text style={s.congListCity}>
                        {cong.city} · {cong.memberUids.length} members · {cong.joinPolicy.toLowerCase()}
                      </Text>
                    </Pressable>
                  ))}
                  {congregationCitySearch.trim().length >= 2 && nearbyCongregations.length === 0 && !nearbyLoading && (
                    <Text style={[s.emptyText, { marginTop: 12 }]}>No created congregations found.</Text>
                  )}
                </ScrollView>

                <Pressable style={s.outlineBtn} onPress={() => setCreateCongregationVisible(true)}>
                  <Text style={s.outlineBtnText}>Create New Congregation</Text>
                </Pressable>
              </>
            ) : (
              <ScrollView style={{ maxHeight: 430 }} keyboardShouldPersistTaps="handled">
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
                  <Pressable style={s.ghostBtn} onPress={() => setCreateCongregationVisible(false)}>
                    <Text style={s.ghostBtnText}>Back to Search</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}

            <Pressable style={[s.ghostBtn, { alignSelf: "center", marginTop: 12 }]} onPress={() => { setCreateCongregationVisible(false); setJoinCongregationVisible(false); }}>
              <Text style={s.ghostBtnText}>Close</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── sub-components ────────────────────────────────────────── */

function TabItem({ label, active, onPress, showBadge = false }: { label: string; active: boolean; onPress: () => void; showBadge?: boolean }) {
  return (
    <Pressable
      style={[s.tabItem, active && s.tabItemActive]}
      onPress={() => {
        if (!active) onPress();
      }}
      android_disableSound
    >
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
      {showBadge && <View style={s.tabNotificationDot} />}
    </Pressable>
  );
}

const WHEEL_ITEM_HEIGHT = 46;
const WHEEL_VISIBLE_ROWS = 5;

/**
 * A vertical, snapping time wheel presented in a frosted "liquid glass" sheet,
 * echoing the native iOS picker. Tap a row or scroll to a value, then confirm.
 */
function WheelTimePicker({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  value: string | null;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<ScrollView | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const idx = Math.max(0, options.indexOf(value ?? options[0] ?? ""));
    setSelectedIndex(idx);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: idx * WHEEL_ITEM_HEIGHT, animated: false });
    });
  }, [visible, value, options]);

  const onMomentumEnd = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    const idx = Math.round(y / WHEEL_ITEM_HEIGHT);
    setSelectedIndex(Math.max(0, Math.min(options.length - 1, idx)));
  };

  const padRows = Math.floor(WHEEL_VISIBLE_ROWS / 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.glassOverlay} onPress={onClose}>
        <Pressable style={s.glassCard} onPress={() => {}}>
          <View style={s.glassHandle} />
          <Text style={s.glassTitle}>{title}</Text>
          <View style={{ height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS }}>
            <View style={[s.glassSelectionBand, { top: WHEEL_ITEM_HEIGHT * padRows, height: WHEEL_ITEM_HEIGHT }]} pointerEvents="none" />
            <ScrollView
              ref={listRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={WHEEL_ITEM_HEIGHT}
              decelerationRate="fast"
              onMomentumScrollEnd={onMomentumEnd}
              contentContainerStyle={{ paddingVertical: WHEEL_ITEM_HEIGHT * padRows }}
            >
              {options.map((opt, i) => {
                const active = i === selectedIndex;
                return (
                  <Pressable
                    key={opt}
                    style={{ height: WHEEL_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}
                    onPress={() => {
                      setSelectedIndex(i);
                      listRef.current?.scrollTo({ y: i * WHEEL_ITEM_HEIGHT, animated: true });
                    }}
                  >
                    <Text style={[s.glassItem, active && s.glassItemActive]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <Pressable
            style={s.glassConfirmBtn}
            onPress={() => {
              const chosen = options[selectedIndex];
              if (chosen) onSelect(chosen);
              onClose();
            }}
          >
            <Text style={s.glassConfirmText}>Set {options[selectedIndex] ?? ""}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LeaderboardRow({
  profile,
  rank,
  isCurrentUser,
  congregationName,
  onAvatarPress,
  showTefillinStreak = true,
  showNotification = false,
}: {
  profile: UserProfile;
  rank: number;
  isCurrentUser?: boolean;
  congregationName?: string | null;
  onAvatarPress?: () => void;
  showTefillinStreak?: boolean;
  showNotification?: boolean;
}) {
  const hideStreak = !isCurrentUser && profile.streakVisibility === "private";
  return (
    <View style={[s.leaderRow, isCurrentUser && s.leaderRowHighlight]}>
      <Text style={s.leaderRank}>{rank}</Text>
      <Pressable onPress={onAvatarPress} hitSlop={4}>
        <View style={s.friendAvatar}><Text style={s.friendAvatarText}>{(profile.displayName ?? "?")[0]?.toUpperCase()}</Text></View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={s.friendNameRow}>
          <Text style={s.friendName}>{profile.displayName ?? "Unknown"}</Text>
          {showNotification && (
            <View style={s.messagePill}>
              <Text style={s.messagePillText}>New</Text>
            </View>
          )}
        </View>
        <Text style={s.friendCong}>{congregationName ?? (profile.congregationId ? "In a congregation" : "")}</Text>
      </View>
      {hideStreak ? (
        <Text style={{ fontSize: 11, color: C.textLight }}>Private</Text>
      ) : (
        <View style={s.streakBadges}>
          <View style={s.streakBadge}><Text style={s.streakBadgeText}>{profile.currentStreak ?? 0}</Text></View>
          {showTefillinStreak && (
            <View style={s.tefillinStreakBadge}><Text style={s.tefillinStreakBadgeText}>{profile.tefillinCurrentStreak ?? 0}</Text></View>
          )}
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
  shabbatOnlyScreen: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 24, paddingVertical: 24 },
  shabbatOnlyContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  shabbatOnlyTitle: { fontSize: 34, fontWeight: "900", color: C.text, marginBottom: 10 },
  shabbatOnlyTime: { fontSize: 18, fontWeight: "700", color: C.textSecondary, textAlign: "center" },
  shabbatOnlyMessage: { fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22, marginTop: 18 },
  shabbatOnlyIntent: { fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22, marginTop: 24 },
  shabbatOnlyActions: { paddingBottom: 18 },
  focusOnlyScreen: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 24, paddingVertical: 24 },
  focusOnlyContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  focusOnlyDial: { width: 250, height: 250, borderRadius: 125, alignItems: "center", justifyContent: "center" },
  focusOnlyTime: { fontSize: 36, fontWeight: "900", color: C.text },
  focusOnlyActions: { paddingBottom: 18 },
  focusQuoteCard: { marginTop: 36, marginHorizontal: 8, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 20 },
  focusQuoteText: { fontSize: 17, lineHeight: 26, color: C.text, textAlign: "center", fontStyle: "italic", fontWeight: "600" },
  focusUnblockNotice: { fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 12, paddingHorizontal: 8 },
  splashContainer: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  splashStarCircle: { width: 128, height: 128, borderRadius: 64, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  splashStar: { fontSize: 68, color: C.primary, textAlign: "center" },
  splashWordmark: { position: "absolute", bottom: "26%", fontSize: 30, fontWeight: "900", color: C.primaryDark, letterSpacing: 0.5 },
  appCover: { width: "100%", alignItems: "center", justifyContent: "center", marginBottom: 26 },
  appCoverWordmark: { marginTop: 18, fontSize: 30, fontWeight: "900", color: C.primaryDark, letterSpacing: 0.5 },
  appCoverSubtitle: { marginTop: 8, fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 21 },

  /* header */
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: C.bg },
  headerTitle: { fontSize: 26, fontWeight: "800", color: C.text },
  settingsBtn: { padding: 8 },
  settingsBtnText: { fontSize: 22 },
  profileBtn: { padding: 4 },
  profileBtnCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  profileBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  profileBadge: { position: "absolute", top: -2, right: -2, width: 11, height: 11, borderRadius: 6, backgroundColor: C.danger, borderWidth: 2, borderColor: C.bg },

  /* tab bar */
  tabBar: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  tabItemActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  tabNotificationDot: { position: "absolute", top: 7, right: 14, width: 9, height: 9, borderRadius: 5, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.card },
  tabLabel: { fontSize: 13, fontWeight: "700", color: C.textLight },
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
  attributionText: { fontSize: 11, color: C.primary, fontWeight: "700", marginTop: 6 },
  weeklyVideoCard: { backgroundColor: C.surface, borderRadius: 16, padding: 12, marginTop: 12 },
  weeklyVideoTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  weeklyVideoActions: { flexDirection: "row", gap: 8, marginTop: 10 },

  /* live badge */
  liveBadge: { backgroundColor: C.success, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start", marginTop: 8 },
  liveBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  /* block level */
  blockGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  blockOption: { width: "47%", borderRadius: 16, borderWidth: 2, borderColor: C.border, padding: 12, alignItems: "center" },
  blockOptionPlaceholder: { opacity: 0.35 },
  blockOptionActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  blockTitle: { fontSize: 13, fontWeight: "800", color: C.text, textAlign: "center" },
  blockTitleActive: { color: C.primaryDark },
  blockDesc: { fontSize: 10, color: C.textSecondary, textAlign: "center", marginTop: 4 },
  blockDescActive: { color: C.primaryDark },
  focusTimerDial: { alignSelf: "center", width: FOCUS_DIAL_SIZE, height: FOCUS_DIAL_SIZE, borderRadius: FOCUS_DIAL_SIZE / 2, alignItems: "center", justifyContent: "center", marginTop: 18, marginBottom: 8 },
  focusTimerKnob: { position: "absolute", width: FOCUS_DIAL_KNOB_SIZE, height: FOCUS_DIAL_KNOB_SIZE, borderRadius: FOCUS_DIAL_KNOB_SIZE / 2, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: C.primary, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 2 },
  focusTimerText: { fontSize: 32, fontWeight: "900", color: C.text },
  focusTimerLabel: { fontSize: 12, fontWeight: "800", color: C.textLight, marginTop: 6, textTransform: "uppercase", letterSpacing: 1 },
  focusStatsRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  focusStatCard: { flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 14, alignItems: "center" },
  focusStatNumber: { fontSize: 26, fontWeight: "900", color: C.primary },
  focusStatLabel: { fontSize: 12, fontWeight: "700", color: C.textSecondary, marginTop: 2 },

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
  durationPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  timePill: { borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.bg },
  timePillActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  timePillText: { fontSize: 12, fontWeight: "600", color: C.textSecondary },
  timePillTextActive: { color: C.primaryDark, fontWeight: "700" },

  /* time select row (opens vertical picker) */
  timeSelectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 12, marginTop: 4 },
  timeSelectValue: { fontSize: 17, fontWeight: "700", color: C.primaryDark },
  timeSelectChevron: { fontSize: 20, color: C.textLight, fontWeight: "800", marginTop: -6 },

  /* "liquid glass" vertical time picker */
  glassOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  glassHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(100,116,139,0.4)", marginBottom: 10 },
  glassTitle: { fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 6 },
  glassSelectionBand: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(37,99,235,0.10)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(37,99,235,0.25)" },
  glassItem: { fontSize: 18, fontWeight: "600", color: C.textLight },
  glassItemActive: { fontSize: 22, fontWeight: "900", color: C.primaryDark },
  glassConfirmBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  glassConfirmText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

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

  /* prayer overlay (manual preview in modal) */
  prayerHebrew: { fontSize: 20, fontWeight: "600", color: C.text, textAlign: "center", marginTop: 20, lineHeight: 32 },
  prayerEnglish: { fontSize: 14, color: C.textSecondary, textAlign: "center", marginTop: 16, lineHeight: 22, fontStyle: "italic" },

  /* prayer blocking overlay (full-screen blocker) */
  prayerBlockingContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 72,
    paddingBottom: 34,
  },
  prayerTextModeSwitch: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  prayerTextModeTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  prayerTextModeSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.62)",
    marginTop: 2,
  },
  prayerTextModeControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prayerTextModePill: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.78)",
  },
  prayerBlockingScroll: {
    width: "100%",
    flex: 1,
  },
  prayerBlockingScrollContent: {
    alignItems: "center",
    paddingBottom: 8,
  },
  prayerBlockingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  prayerBlockingTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  prayerBlockingInstruction: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
  },
  prayerBlockingHebrew: {
    fontSize: 22,
    fontWeight: "600",
    color: "#e8d5b7",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 24,
  },
  prayerBlockingTransliteration: {
    fontSize: 21,
    fontWeight: "700",
    color: "#e8d5b7",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 24,
  },
  prayerBlockingEnglish: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 24,
    fontStyle: "italic",
    marginBottom: 40,
  },
  prayerBlockingBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  prayerBlockingBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

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
  chatNotificationDot: { position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.primary },
  congIconBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 8, justifyContent: "center", alignItems: "center" },

  /* leaderboard */
  leaderboardHeader: { backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  leaderboardHeaderText: { fontSize: 14, fontWeight: "800", color: C.textSecondary, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  leaderboardHeaderSubtext: { fontSize: 12, fontWeight: "600", color: C.textLight, textAlign: "center", marginTop: 3 },
  friendLeaderboardHeader: { backgroundColor: C.primaryLight },
  congregationLeaderboardHeader: { backgroundColor: C.streakBg },
  leaderboardCard: { backgroundColor: C.card, borderRadius: 20, padding: 12, marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

  

  /* friend / leaderboard rows */
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  friendAvatarText: { fontSize: 16, fontWeight: "800", color: C.primary },
  friendNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  friendName: { fontSize: 15, fontWeight: "700", color: C.text },
  friendCong: { fontSize: 11, color: C.textLight, marginTop: 1 },
  messagePill: { backgroundColor: C.dangerLight, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  messagePillText: { color: C.danger, fontSize: 10, fontWeight: "800" },

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
  chatList: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 1 },
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
  snapImageFrame: { width: 200, height: 240, borderRadius: 20, overflow: "hidden", marginVertical: 4, backgroundColor: C.text, borderWidth: 3, borderColor: C.primary },
  snapImage: { width: "100%", height: "100%" },
  snapBadge: { position: "absolute", left: 10, bottom: 10, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  snapBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", alignItems: "center", justifyContent: "center" },
  imageViewerCloseArea: { flex: 1, alignSelf: "stretch" },
  imageViewerScroll: { flex: 1 },
  imageViewerScrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  imageViewerImage: { width: 260, height: 520 },

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
  authScroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 140, backgroundColor: C.bg },
  authLogoArea: { alignItems: "center", marginBottom: 24 },
  authLogo: { fontSize: 46, marginBottom: 10, width: 76, height: 76, borderRadius: 38, textAlign: "center", lineHeight: 76, backgroundColor: C.primaryLight },
  authTitle: { fontSize: 32, fontWeight: "900", color: C.primaryDark, letterSpacing: 0.3, textAlign: "center" },
  authSubtitle: { marginTop: 8, fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 21 },
  authForm: { width: "100%", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 28, padding: 18, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  authProfileIntro: { width: "100%", backgroundColor: C.primaryLight, borderRadius: 22, padding: 16, marginBottom: 4 },
  authProfileKicker: { fontSize: 11, fontWeight: "900", color: C.primary, letterSpacing: 0.9, textTransform: "uppercase" },
  authProfileTitle: { fontSize: 20, fontWeight: "900", color: C.primaryDark, marginTop: 6 },
  authProfileSubtitle: { fontSize: 13, color: C.textSecondary, lineHeight: 19, marginTop: 4 },
  profileSetupCard: { width: "100%", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 30, padding: 20, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 5 },
  authFieldLabel: { alignSelf: "flex-start", fontSize: 12, fontWeight: "800", color: C.textSecondary, marginTop: 2, marginBottom: -4, textTransform: "uppercase", letterSpacing: 0.6 },
  authInput: { width: "100%", borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: "#FFFFFF", color: C.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  phoneInputRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  phoneCountryBtn: { minWidth: 92, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 14 },
  phoneCountryFlag: { fontSize: 12, fontWeight: "900", color: C.primary },
  phoneCountryCode: { fontSize: 14, fontWeight: "900", color: C.text },
  phoneLocalInput: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: "#FFFFFF", color: C.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  phoneCountryList: { marginTop: 12, maxHeight: 360 },
  phoneCountryOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginBottom: 8 },
  phoneCountryOptionActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  phoneCountryOptionName: { fontSize: 15, fontWeight: "800", color: C.text },
  phoneCountryOptionCode: { fontSize: 12, fontWeight: "700", color: C.textSecondary, marginTop: 2 },
  phoneCountrySelectedMark: { fontSize: 11, fontWeight: "900", color: C.primary },
  passwordRow: { width: "100%", flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface },
  passwordInput: { flex: 1, color: C.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  passwordToggle: { paddingHorizontal: 14, paddingVertical: 14 },
  passwordToggleText: { color: C.primary, fontWeight: "700", fontSize: 13 },
  authMethodToggle: { flexDirection: "row", width: "100%", borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: "hidden" },
  authMethodTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  authMethodTabActive: { backgroundColor: C.primary },
  authMethodTabText: { color: C.text, fontWeight: "600", fontSize: 14 },
  authMethodTabTextActive: { color: "#FFF", fontWeight: "700" },
  sexOptionGrid: { flexDirection: "row", width: "100%", gap: 10 },
  sexOptionCard: { flex: 1, minHeight: 118, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 14, justifyContent: "center" },
  sexOptionCardActive: { borderColor: C.primary, backgroundColor: C.primary },
  sexOptionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 34, color: C.primary, fontSize: 16, fontWeight: "900", marginBottom: 10 },
  sexOptionTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  sexOptionTitleActive: { color: "#FFF" },
  sexOptionHint: { fontSize: 11, color: C.textSecondary, lineHeight: 15, marginTop: 4 },
  sexOptionHintActive: { color: "rgba(255,255,255,0.82)" },
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
  buddyAvatarImage: { width: 50, height: 50, borderRadius: 25 },
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
  buddyIncomingBadge: { position: "absolute", left: -2, bottom: -4, backgroundColor: C.primary, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: C.card },
  buddyIncomingBadgeText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  buddyNameLarge: { fontSize: 16, fontWeight: "700", color: C.text },
  buddyIncomingText: { fontSize: 12, fontWeight: "700", color: C.primary, marginTop: 2 },
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
  friendIncomingPhotoCard: { width: "100%", marginTop: 12, backgroundColor: C.surface, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: C.border },
  friendIncomingPhoto: { width: "100%", height: 180, borderRadius: 14, backgroundColor: C.border },
  friendIncomingPhotoText: { fontSize: 12, color: C.textSecondary, fontWeight: "700", marginTop: 8, textAlign: "center" },
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
