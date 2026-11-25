import { useReporting } from "../ReportingContext"
import type { AppNotification } from "../types"
import {
  collectActiveStaffReminders,
  formatNotificationTimeLabel,
} from "../utils/notifications"
import { Icon } from "./Icon"

export function StaffReminderBanner({
  onOpenTarget,
  onAcknowledge,
}: {
  onOpenTarget: (notification: AppNotification) => void
  onAcknowledge: (id: string) => void
}) {
  const { data } = useReporting()
  const activeReminders = collectActiveStaffReminders({
    storedNotifications: data.notifications,
  })

  if (activeReminders.length === 0) return null

  const primary = activeReminders[0]
  const tone =
    primary.priority === "urgent"
      ? "urgent"
      : primary.priority === "important"
        ? "important"
        : "normal"
  const remainingCount = activeReminders.length - 1

  return (
    <section
      className={`staff-reminder-banner is-${tone}`}
      role={tone === "urgent" ? "alert" : "status"}
      aria-label="Pengingat dari Admin PRP"
    >
      <div className="staff-reminder-icon" aria-hidden="true">
        {tone === "urgent" ? "!" : <Icon name="bell" size={18} />}
      </div>
      <div className="staff-reminder-body">
        <div className="staff-reminder-top">
          <span className="staff-reminder-tag">
            {tone === "urgent"
              ? "Pengingat Mendesak"
              : tone === "important"
                ? "Pengingat Penting"
                : "Pengingat Admin"}
          </span>
          <time>{formatNotificationTimeLabel(primary.createdAt)}</time>
        </div>
        <strong className="staff-reminder-title">{primary.title}</strong>
        <p className="staff-reminder-message">{primary.message}</p>
        <div className="staff-reminder-meta">
          {primary.unitLabel && <span>Tujuan: {primary.unitLabel}</span>}
          {primary.periodLabel && <span>Periode: {primary.periodLabel}</span>}
          {remainingCount > 0 && (
            <span>+{remainingCount} pengingat lainnya</span>
          )}
        </div>
      </div>
      <div className="staff-reminder-actions">
        {primary.targetMenu && (
          <button
            type="button"
            className="staff-reminder-open-btn"
            onClick={() => onOpenTarget(primary)}
          >
            Buka {primary.targetMenu}
          </button>
        )}
        <button
          type="button"
          className="staff-reminder-ack-btn"
          onClick={() => onAcknowledge(primary.id)}
        >
          Tandai dibaca
        </button>
      </div>
    </section>
  )
}

export default StaffReminderBanner
