import type { AppNotification } from "../types"
import { NotificationBell } from "./NotificationBell"

const readKey = "sipetri-read-notifications-v1"

export function StaffNotifications({
  onSelectNotification,
  onOpenHistory,
}: {
  onSelectNotification?: (notification: AppNotification) => void
  onOpenHistory?: () => void
}) {
  return (
    <NotificationBell
      recipient="staff"
      legacyStorageKey={readKey}
      emptyText="Belum ada pembaruan atau hasil verifikasi."
      onSelectNotification={(notification) => {
        if (onSelectNotification) {
          onSelectNotification(notification)
        } else {
          onOpenHistory?.()
        }
      }}
    />
  )
}
