import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  Timestamp,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const DEV_EMAIL = "liel.reyter@gmail.com";
const DEV_PASSWORD = process.env.KESHER_DEV_PASSWORD;
const CONGREGATION_ID = "demo-temple-of-israel";
const TODAY = new Date().toISOString().slice(0, 10);

if (!DEV_PASSWORD) {
  throw new Error("Set KESHER_DEV_PASSWORD before running this script.");
}

const app = initializeApp({
  apiKey: "AIzaSyCfRbaYMGMMoVl1hS6IPspsRshCl4tkgHo",
  authDomain: "shabbat-shalom-8994d.firebaseapp.com",
  projectId: "shabbat-shalom-8994d",
  storageBucket: "shabbat-shalom-8994d.firebasestorage.app",
  messagingSenderId: "330103796558",
  appId: "1:330103796558:ios:24b49bbf6a97b82110a41f",
});

const auth = getAuth(app);
const firestore = getFirestore(app);

const demoUsers = [
  { uid: "demo-ari-cohen", name: "Ari Cohen", shabbat: 14, longest: 18, tefillin: 21, tefillinLongest: 28, buddy: true, buddyStreak: 21 },
  { uid: "demo-noah-levi", name: "Noah Levi", shabbat: 11, longest: 16, tefillin: 17, tefillinLongest: 20, buddy: true, buddyStreak: 17 },
  { uid: "demo-ezra-stein", name: "Ezra Stein", shabbat: 9, longest: 12, tefillin: 12, tefillinLongest: 14, buddy: true, buddyStreak: 12 },
  { uid: "demo-jacob-mizrahi", name: "Jacob Mizrahi", shabbat: 8, longest: 11, tefillin: 10, tefillinLongest: 13, buddy: true, buddyStreak: 10 },
  { uid: "demo-eli-ben-david", name: "Eli Ben-David", shabbat: 7, longest: 10, tefillin: 8, tefillinLongest: 9, buddy: false },
  { uid: "demo-samuel-klein", name: "Samuel Klein", shabbat: 6, longest: 9, tefillin: 6, tefillinLongest: 11, buddy: false },
  { uid: "demo-yonatan-halevi", name: "Yonatan Halevi", shabbat: 5, longest: 8, tefillin: 7, tefillinLongest: 7, buddy: false },
  { uid: "demo-david-rosen", name: "David Rosen", shabbat: 4, longest: 6, tefillin: 5, tefillinLongest: 6, buddy: false },
];

const friendUids = demoUsers.map((user) => user.uid);
const tefillinBuddyUids = demoUsers.filter((user) => user.buddy).map((user) => user.uid);
const buddyChatIds = tefillinBuddyUids.map((uid) => `demo-buddy-chat-${uid.replace(/^demo-/, "")}`);
const memberUids = [];

const userProfile = ({
  uid,
  name,
  email = null,
  shabbat,
  longest,
  tefillin,
  tefillinLongest,
  friendUids: friends,
  tefillinBuddyUids: buddies,
  buddyChatIds: chats,
}) => ({
  uid,
  createdAt: serverTimestamp(),
  lastLoginAt: serverTimestamp(),
  displayName: name,
  displayNameLower: name.toLowerCase(),
  email,
  shabbatIntentText: "This week I am choosing connection over distraction.",
  wantsMorningReminders: true,
  wantsShabbatReminders: true,
  timeZone: "America/New_York",
  platform: "ios",
  gender: null,
  profileImageUrl: null,
  currentStreak: shabbat,
  longestStreak: longest,
  lastStreakWeekId: "demo-current-week",
  congregationId: CONGREGATION_ID,
  congregationOnboardingCompleted: true,
  tefillinCurrentStreak: tefillin,
  tefillinLongestStreak: tefillinLongest,
  lastTefillinDate: TODAY,
  wakeUpTime: "07:00",
  bedTime: "22:30",
  shabbatBlockLevel: "full",
  wantsModehAniReminder: true,
  wantsShemaReminder: true,
  wantsChatNotifications: false,
  intentVisibility: "friends",
  streakVisibility: "public",
  friendCode: uid.slice(0, 8).toUpperCase(),
  friendRequestStatus: "request",
  friendUids: friends,
  pendingFriendUids: [],
  latitude: 40.7128,
  longitude: -74.006,
  tefillinBuddyUids: buddies,
  buddyChatIds: chats,
  fcmToken: null,
});

const seed = async () => {
  const credential = await signInWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD);
  const devUid = credential.user.uid;
  memberUids.push(devUid, ...friendUids);

  await setDoc(
    doc(firestore, "users", devUid),
    userProfile({
      uid: devUid,
      name: "Liel Reyter",
      email: DEV_EMAIL,
      shabbat: 16,
      longest: 24,
      tefillin: 23,
      tefillinLongest: 31,
      friendUids,
      tefillinBuddyUids,
      buddyChatIds,
    }),
    { merge: true }
  );

  for (const demo of demoUsers) {
    await setDoc(
      doc(firestore, "users", demo.uid),
      userProfile({
        uid: demo.uid,
        name: demo.name,
        shabbat: demo.shabbat,
        longest: demo.longest,
        tefillin: demo.tefillin,
        tefillinLongest: demo.tefillinLongest,
        friendUids: [devUid],
        tefillinBuddyUids: demo.buddy ? [devUid] : [],
        buddyChatIds: demo.buddy ? [`demo-buddy-chat-${demo.uid.replace(/^demo-/, "")}`] : [],
      }),
      { merge: true }
    );
  }

  await setDoc(
    doc(firestore, "congregations", CONGREGATION_ID),
    {
      id: CONGREGATION_ID,
      name: "Temple of Israel",
      city: "New York",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
      leaderUid: devUid,
      joinPolicy: "OPEN",
      memberUids,
      pendingUids: [],
      createdAtIso: new Date().toISOString(),
    },
    { merge: true }
  );

  for (const demo of demoUsers.filter((user) => user.buddy)) {
    const chatId = `demo-buddy-chat-${demo.uid.replace(/^demo-/, "")}`;
    await setDoc(
      doc(firestore, "buddyChats", chatId),
      {
        type: "pair",
        name: null,
        memberUids: [devUid, demo.uid],
        createdAt: Timestamp.now(),
        lastActivityAt: Timestamp.now(),
        streakCount: demo.buddyStreak,
        longestStreak: Math.max(demo.buddyStreak, demo.tefillinLongest),
        lastStreakDate: TODAY,
        streakBrokenAt: null,
      },
      { merge: true }
    );

    await setDoc(
      doc(firestore, "buddyChats", chatId, "messages", "demo-message-1"),
      {
        senderUid: demo.uid,
        senderName: demo.name,
        type: "text",
        text: "Wrapped this morning. Your turn!",
        imageUrl: null,
        createdAt: Timestamp.now(),
        opened: true,
        isStreakEligible: false,
        savedByUids: [],
      },
      { merge: true }
    );
  }

  console.log(`Seeded screenshot data for ${DEV_EMAIL} (${devUid})`);
  console.log(`Created ${demoUsers.length} dummy users in Temple of Israel.`);
};

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
