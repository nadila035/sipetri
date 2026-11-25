import type { AppNotification } from "../types"
import { NotificationBell } from "./NotificationBell"

const adminReadKey = "sipetri-admin-read-notifications-v1"

export function AdminNotifications({
  onSelectRecord,
}: {
  onSelectRecord?: (menu: string, recordId: string) => void
}) {
  return (
    <NotificationBell
      recipient="admin"
      legacyStorageKey={adminReadKey}
      emptyText="Belum ada dokumen atau pembaruan masuk."
      onSelectNotification={(notification: AppNotification) => {
        if (notification.recordId) {
          onSelectRecord?.(notification.targetMenu, notification.recordId)
        }
      }}
    />
  )
}

export default AdminNotifications
