import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {setGlobalOptions} from "firebase-functions/v2";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

initializeApp();

setGlobalOptions({maxInstances: 10, region: "us-central1"});

type ChatMessage = {
  senderUid?: string;
  senderName?: string;
  text?: string | null;
  imageUrl?: string | null;
  type?: "text" | "image";
};

type UserNotificationProfile = {
  fcmToken?: string | null;
  wantsChatNotifications?: boolean;
};

const db = getFirestore();
const messaging = getMessaging();

const sanitizeDataValue = (value: string): string =>
  value.replace(/[^\x20-\x7E]/g, "").slice(0, 500);

const messagePreview = (message: ChatMessage): string => {
  if (message.type === "image" || message.imageUrl) {
    return "sent a photo";
  }

  const text = message.text?.trim();
  if (!text) {
    return "sent a message";
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const loadEnabledRecipients = async (
  recipientUids: string[]
): Promise<{tokens: string[]; tokenToUid: Map<string, string>}> => {
  const uniqueUids = [...new Set(recipientUids)].filter(Boolean);
  const tokenToUid = new Map<string, string>();

  await Promise.all(
    uniqueUids.map(async (uid) => {
      const snapshot = await db.doc(`users/${uid}`).get();
      if (!snapshot.exists) return;

      const data = snapshot.data() as UserNotificationProfile;
      if (data.wantsChatNotifications === false) return;
      if (!data.fcmToken) return;

      tokenToUid.set(data.fcmToken, uid);
    })
  );

  return {tokens: [...tokenToUid.keys()], tokenToUid};
};

const clearInvalidTokens = async (
  responses: Awaited<
    ReturnType<typeof messaging.sendEachForMulticast>
  >["responses"],
  tokens: string[],
  tokenToUid: Map<string, string>
): Promise<void> => {
  await Promise.all(
    responses.map(async (response, index) => {
      if (response.success) return;

      const code = response.error?.code;
      if (
        code !== "messaging/registration-token-not-registered" &&
        code !== "messaging/invalid-registration-token"
      ) {
        return;
      }

      const token = tokens[index];
      const uid = token ? tokenToUid.get(token) : undefined;
      if (!uid) return;

      await db.doc(`users/${uid}`).update({fcmToken: null});
    })
  );
};

const sendChatPush = async ({
  recipientUids,
  message,
  title,
  data,
}: {
  recipientUids: string[];
  message: ChatMessage;
  title: string;
  data: Record<string, string>;
}): Promise<void> => {
  const senderUid = message.senderUid;
  const filteredRecipients = recipientUids.filter((uid) => uid !== senderUid);
  const {tokens, tokenToUid} = await loadEnabledRecipients(filteredRecipients);

  if (tokens.length === 0) {
    logger.info("No chat push recipients with FCM tokens.", {title});
    return;
  }

  const senderName = message.senderName?.trim() || "Someone";
  const body = `${senderName}: ${messagePreview(message)}`;
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {title, body},
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        sanitizeDataValue(value),
      ])
    ),
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  });

  await clearInvalidTokens(response.responses, tokens, tokenToUid);
  logger.info("Sent chat push notifications.", {
    title,
    successCount: response.successCount,
    failureCount: response.failureCount,
  });
};

export const sendBuddyChatPush = onDocumentCreated(
  "buddyChats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data() as ChatMessage | undefined;
    if (!message?.senderUid) return;

    const chatId = event.params.chatId;
    const chatSnapshot = await db.doc(`buddyChats/${chatId}`).get();
    if (!chatSnapshot.exists) return;

    const chat = chatSnapshot.data() as {
      memberUids?: string[];
      name?: string | null;
      kind?: string | null;
    };
    const memberUids = Array.isArray(chat.memberUids) ? chat.memberUids : [];

    await sendChatPush({
      recipientUids: memberUids,
      message,
      title: chat.name || (chat.kind === "candles" ? "Candle buddy chat" : "Tefillin buddy chat"),
      data: {
        type: "buddyChat",
        chatId,
        messageId: event.params.messageId,
      },
    });
  }
);

export const sendCongregationChatPush = onDocumentCreated(
  "congregations/{congregationId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data() as ChatMessage | undefined;
    if (!message?.senderUid) return;

    const congregationId = event.params.congregationId;
    const congregationSnapshot = await db
      .doc(`congregations/${congregationId}`)
      .get();
    if (!congregationSnapshot.exists) return;

    const congregation = congregationSnapshot.data() as {
      memberUids?: string[];
      name?: string;
    };
    const memberUids = Array.isArray(congregation.memberUids) ?
      congregation.memberUids :
      [];

    await sendChatPush({
      recipientUids: memberUids,
      message,
      title: congregation.name || "Congregation chat",
      data: {
        type: "congregationChat",
        congregationId,
        messageId: event.params.messageId,
      },
    });
  }
);

export const sendDirectMessagePush = onDocumentCreated(
  "directMessages/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data() as ChatMessage | undefined;
    if (!message?.senderUid) return;

    const chatId = event.params.chatId;
    const memberUids = chatId.split("_").filter(Boolean);
    if (memberUids.length < 2) return;

    await sendChatPush({
      recipientUids: memberUids,
      message,
      title: "Direct message",
      data: {
        type: "directMessage",
        chatId,
        senderUid: message.senderUid,
        messageId: event.params.messageId,
      },
    });
  }
);
