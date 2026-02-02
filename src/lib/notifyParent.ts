import { APP_KEY } from "../app.meta";
import { postWebhook } from "./webhook";

type ParentNotificationPayload = {
  userId: string;
  eventType: string;
  title: string;
  url: string;
};

export const notifyParent = async (payload: ParentNotificationPayload): Promise<void> => {
  try {
    const url = import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_URL ?? null;
    const secret = import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_SECRET;

    const body = {
      appId: APP_KEY,
      userId: payload.userId,
      eventType: payload.eventType,
      title: payload.title,
      url: payload.url,
    };

    await postWebhook({
      url,
      secret,
      payload: body,
      appKey: APP_KEY,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("notifyParent failed", error);
    }
  }
};
