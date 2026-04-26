import messaging from "@react-native-firebase/messaging";
import { updateUserProfile } from "../firebase/firestore";
import { UserProfile } from "../types/UserProfile";

const isPushAuthorized = (status: number): boolean =>
  status === messaging.AuthorizationStatus.AUTHORIZED ||
  status === messaging.AuthorizationStatus.PROVISIONAL;

export const registerForChatPushNotifications = async (
  user: UserProfile
): Promise<UserProfile | null> => {
  if (!user.wantsChatNotifications) {
    return null;
  }

  const status = await messaging().requestPermission();
  if (!isPushAuthorized(status)) {
    return null;
  }

  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  if (!token || token === user.fcmToken) {
    return null;
  }

  return updateUserProfile(user.uid, { fcmToken: token });
};

export const clearChatPushToken = async (
  user: UserProfile
): Promise<UserProfile> => {
  try {
    await messaging().deleteToken();
  } catch {
    // Firestore is the source of truth for whether the backend should send chat pushes.
  }
  return updateUserProfile(user.uid, { fcmToken: null });
};

export const subscribeToChatPushTokenRefresh = (
  user: UserProfile,
  onProfileUpdated: (profile: UserProfile) => void
): (() => void) => {
  return messaging().onTokenRefresh((token) => {
    if (!user.wantsChatNotifications) {
      return;
    }
    updateUserProfile(user.uid, { fcmToken: token })
      .then(onProfileUpdated)
      .catch(() => {});
  });
};
