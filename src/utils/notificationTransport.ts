import type { AppNotification } from "../types/index.ts"

export const NOTIFICATION_CHANNEL_NAME = "sipetri-notifications-v1"

export type NotificationTransportEvent =
  | {
      type: "reminder_created"
      notification: AppNotification
      sentAt: string
      senderTabId: string
    }
  | {
      type: "reminder_acknowledged"
      notificationIds: string[]
      acknowledgedAt: string
      acknowledgedBy: string
      senderTabId: string
    }
  | {
      type: "reminder_status_changed"
      notificationId: string
      active: boolean
      senderTabId: string
    }

export interface NotificationTransportAdapter {
  readonly mode: "local-browser" | "remote-api"
  publishEvent(
    event:
      | { type: "reminder_created"; notification: AppNotification; sentAt: string }
      | { type: "reminder_acknowledged"; notificationIds: string[]; acknowledgedAt: string; acknowledgedBy: string }
      | { type: "reminder_status_changed"; notificationId: string; active: boolean },
  ): void
  subscribe(listener: (event: NotificationTransportEvent) => void): () => void
}

function getTabInstanceId(): string {
  const globalKey = "__sipetriNotificationTabId"
  const holder = globalThis as Record<string, unknown>
  if (typeof holder[globalKey] === "string") {
    return holder[globalKey] as string
  }
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`
  holder[globalKey] = generated
  return generated
}

export function createBroadcastChannelTransport(
  channelName = NOTIFICATION_CHANNEL_NAME,
): NotificationTransportAdapter {
  const senderTabId = getTabInstanceId()

  const createChannel = (): BroadcastChannel | null => {
    if (typeof BroadcastChannel === "undefined") return null
    try {
      return new BroadcastChannel(channelName)
    } catch {
      return null
    }
  }

  return {
    mode: "local-browser",
    publishEvent(payload) {
      const channel = createChannel()
      if (!channel) return
      try {
        channel.postMessage({ ...payload, senderTabId })
      } catch {
        // Ignore cross-tab channel failures when browser restricts BroadcastChannel.
      } finally {
        channel.close()
      }
    },
    subscribe(listener) {
      const channel = createChannel()
      if (!channel) return () => {}
      const handleMessage = (message: MessageEvent<NotificationTransportEvent>) => {
        const payload = message.data
        if (!payload || payload.senderTabId === senderTabId) return
        listener(payload)
      }
      channel.addEventListener("message", handleMessage)
      return () => {
        channel.removeEventListener("message", handleMessage)
        channel.close()
      }
    },
  }
}

export const localNotificationTransport = createBroadcastChannelTransport()
