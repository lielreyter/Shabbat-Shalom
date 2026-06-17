import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { FaithTradition } from "../types/UserProfile";

const APP_ICON_FAITH_KEY = "kesher:appIconFaith:v3";
let lastRequestedIcon: string | null | undefined;
let iconSyncPromise: Promise<void> | null = null;

type AppIconModule = {
  setIcon: (iconName: string | null) => Promise<void>;
  getCurrentIcon: () => Promise<string | null>;
};

const getAppIconModule = (): AppIconModule | null => {
  const module = NativeModules.AppIconService as AppIconModule | undefined;
  if (!module?.setIcon || !module?.getCurrentIcon) return null;
  return module;
};

const iconNameForFaith = (faith: FaithTradition | null): string | null => {
  if (faith === "jewish") return "AppIconJewish";
  if (faith === "christian") return "AppIconChristian";
  return null;
};

const cacheKeyForFaith = (faith: FaithTradition | null): string =>
  faith ?? "neutral";

const readCurrentIcon = async (module: AppIconModule): Promise<string | null | undefined> => {
  try {
    const current = await module.getCurrentIcon();
    return current ?? null;
  } catch {
    return undefined;
  }
};

const resetToPrimaryIcon = async (module: AppIconModule): Promise<void> => {
  try {
    await module.setIcon(null);
  } catch {
    // Ignore — primary icon should still be bundled even if reset fails.
  }
};

/** Apply the correct home-screen icon for the user's faith path. */
export const syncAppIcon = async (faith: FaithTradition | null): Promise<void> => {
  if (Platform.OS !== "ios") return;

  const module = getAppIconModule();
  if (!module) return;

  const desired = iconNameForFaith(faith);
  if (lastRequestedIcon === desired && iconSyncPromise) {
    return iconSyncPromise;
  }

  lastRequestedIcon = desired;
  iconSyncPromise = (async () => {
  const current = await readCurrentIcon(module);
  if (current !== undefined && current === desired) {
    await AsyncStorage.setItem(APP_ICON_FAITH_KEY, cacheKeyForFaith(faith));
    return;
  }

  try {
    await module.setIcon(desired);
    await AsyncStorage.setItem(APP_ICON_FAITH_KEY, cacheKeyForFaith(faith));
  } catch (error) {
    await resetToPrimaryIcon(module);
    lastRequestedIcon = undefined;
    throw error;
  }
  })().finally(() => {
    iconSyncPromise = null;
  });

  return iconSyncPromise;
};

export const setAppIconForFaith = syncAppIcon;
export const ensureAppIconCache = syncAppIcon;
