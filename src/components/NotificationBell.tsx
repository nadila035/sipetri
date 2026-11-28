import { useEffect, useRef, useState } from "react"
import { useAuth } from "../AuthContext"
import { useReporting } from "../ReportingContext"
import type { AppNotification, NotificationRecipient } from "../types"
import { filterRecordsForSession, getUserReadStorageKey } from "../utils/auth"
import {
  acknowledgeStoredNotifications,
  collectRecipientNotifications,
  formatNotificationTimeLabel,
  NOTIFICATION_CATEGORY_LABELS,
  type DisplayNotification,
} from "../utils/notifications"
import { localNotificationTransport } from "../utils/notificationTransport"
import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"

const PREVIEW_LIMIT = 4

function loadStoredStringArray(key: string): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

export function NotificationBell({
  recipient,
  legacyStorageKey,
  emptyText,
  onSelectNotification,
}: {
  recipient: NotificationRecipient
  legacyStorageKey: string
  emptyText: string
  onSelectNotification: (notification: AppNotification) => void
}) {
  const { session } = useAuth()
  const { data, setData } = useReporting()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [allOpen, setAllOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<"Semua" | "Belum dibaca">("Semua")
  const userReadKey = getUserReadStorageKey(session)
  const [readIds, setReadIds] = useState<string[]>(() => [
    ...loadStoredStringArray(userReadKey),
    ...loadStoredStringArray(legacyStorageKey),
  ])
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    setReadIds([
      ...loadStoredStringArray(userReadKey),
      ...loadStoredStringArray(legacyStorageKey),
    ])
  }, [userReadKey, legacyStorageKey])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== userReadKey && event.key !== legacyStorageKey) return
      setReadIds([
        ...loadStoredStringArray(userReadKey),
        ...loadStoredStringArray(legacyStorageKey),
      ])
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [userReadKey, legacyStorageKey])

  useDialog(allOpen, () => setAllOpen(false), ".notification-all-overlay")

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const el = detailsRef.current
      if (!el?.open) return
      if (event.target instanceof Node && !el.contains(event.target)) {
        el.open = false
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const scopedRecords =
    recipient === "staff"
      ? filterRecordsForSession(data.records, session)
      : data.records

  const items = collectRecipientNotifications({
    recipient,
    storedNotifications: data.notifications,
    records: scopedRecords,
    periods: data.periods,
    year: data.year,
    quarter: data.quarter,
    sessionSubUnit: session?.subUnit,
    legacyReadKeys: readIds,
  })

  const unreadCount = items.filter((item) => !item.isRead).length
  const previewItems = items.slice(0, PREVIEW_LIMIT)
  const modalItems =
    filterTab === "Belum dibaca" ? items.filter((item) => !item.isRead) : items

  const markItemsRead = (targets: DisplayNotification[]) => {
    const newKeys = targets.flatMap((t) =>
      [t.notification.id, t.legacyReadKey].filter((k): k is string => Boolean(k)),
    )
    if (newKeys.length === 0) return

    const nextUserRead = [
      ...new Set([...loadStoredStringArray(userReadKey), ...newKeys]),
    ]
    try {
      localStorage.setItem(userReadKey, JSON.stringify(nextUserRead))
      setReadIds([
        ...new Set([...readIds, ...newKeys]),
      ])
      setSaveError(false)
    } catch {
      setSaveError(true)
    }

    const storedIds = targets
      .filter((t) => !t.isSyntheticReminder && !t.legacyReadKey)
      .map((t) => t.notification.id)
    if (storedIds.length > 0) {
      const acknowledgedAt = new Date().toISOString()
      const acknowledgedBy =
        session?.displayName || (recipient === "admin" ? "Admin PRP" : "Staf Unit")
      setData((current) => ({
        ...current,
        notifications: acknowledgeStoredNotifications(
          current.notifications,
          recipient,
          storedIds,
          acknowledgedBy,
          acknowledgedAt,
        ),
      }))
      if (recipient === "staff") {
        localNotificationTransport.publishEvent({
          type: "reminder_acknowledged",
          notificationIds: storedIds,
          acknowledgedAt,
          acknowledgedBy,
        })
      }
    }
  }

  const handleItemClick = (item: DisplayNotification) => {
    if (!item.isRead) {
      markItemsRead([item])
    }
    if (detailsRef.current) {
      detailsRef.current.open = false
    }
    setAllOpen(false)
    onSelectNotification(item.notification)
  }

  const renderNotificationItem = (item: DisplayNotification) => {
    const { notification, isRead } = item
    const baseCategoryLabel =
      NOTIFICATION_CATEGORY_LABELS[notification.category] ?? "Pembaruan"
    const categoryLabel =
      notification.category === "admin_reminder"
        ? notification.priority === "urgent"
          ? "Mendesak · Pengingat Admin"
          : notification.priority === "important"
            ? "Penting · Pengingat Admin"
            : baseCategoryLabel
        : baseCategoryLabel
    const timeLabel = formatNotificationTimeLabel(notification.createdAt)
    const periodIncluded =
      notification.periodLabel &&
      (notification.title.includes(notification.periodLabel) ||
        notification.message.includes(notification.periodLabel))
    const unitIncluded =
      notification.unitLabel &&
      (notification.title.includes(notification.unitLabel) ||
        notification.message.includes(notification.unitLabel))
    const metaParts = [
      !unitIncluded ? notification.unitLabel : "",
      !periodIncluded ? notification.periodLabel : "",
      notification.actor,
      isRead ? "Sudah dibaca" : "Belum dibaca",
    ].filter(Boolean)

    const priorityTone =
      notification.category === "admin_reminder" && notification.priority
        ? ` is-${notification.priority}`
        : ""

    return (
      <button
        type="button"
        className={`staff-notification-item${isRead ? "" : " unread"}${priorityTone}`}
        key={notification.id}
        onClick={() => handleItemClick(item)}
      >
        <div className="notification-item-top">
          <span className="notification-category-text">{categoryLabel}</span>
          {timeLabel && <time>{timeLabel}</time>}
        </div>
        <strong>{notification.title}</strong>
        <span className="notification-item-detail">{notification.message}</span>
        <small>{metaParts.join(" · ")}</small>
      </button>
    )
  }

  return (
    <>
      <details className="staff-notifications" ref={detailsRef}>
        <summary aria-label={`Notifikasi, ${unreadCount} belum dibaca`}>
          <Icon name="bell" size={17} />
          {unreadCount > 0 && (
            <span className="staff-notification-count">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </summary>
        <section
          className="staff-notification-panel"
          aria-label="Daftar notifikasi"
        >
          <div className="staff-notification-heading">
            <strong>Notifikasi</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  markItemsRead(items.filter((item) => !item.isRead))
                }
              >
                Tandai dibaca
              </button>
            )}
          </div>
          {saveError && (
            <p role="alert">
              Status baca belum tersimpan. Penyimpanan browser tidak tersedia.
            </p>
          )}
          <div className="staff-notification-list">
            {previewItems.length === 0 && <p>{emptyText}</p>}
            {previewItems.map(renderNotificationItem)}
          </div>
          {items.length > 0 && (
            <div className="staff-notification-footer">
              <button
                type="button"
                onClick={() => {
                  if (detailsRef.current) detailsRef.current.open = false
                  setFilterTab("Semua")
                  setAllOpen(true)
                }}
              >
                Lihat semua notifikasi
                {items.length > PREVIEW_LIMIT ? ` (${items.length})` : ""}
              </button>
            </div>
          )}
        </section>
      </details>

      {allOpen && (
        <div
          className="notification-all-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-all-title"
        >
          <div className="notification-all-dialog">
            <div className="notification-all-head">
              <div>
                <h2 id="notification-all-title">Semua Notifikasi</h2>
                <p>
                  {unreadCount > 0
                    ? `${unreadCount} notifikasi belum dibaca dari total ${items.length}`
                    : `Total ${items.length} notifikasi`}
                </p>
              </div>
              <div className="notification-all-head-actions">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="notification-all-mark-btn"
                    onClick={() =>
                      markItemsRead(items.filter((item) => !item.isRead))
                    }
                  >
                    Tandai semua dibaca
                  </button>
                )}
                <button
                  type="button"
                  className="notification-all-close"
                  aria-label="Tutup semua notifikasi"
                  onClick={() => setAllOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="notification-all-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "Semua"}
                className={filterTab === "Semua" ? "is-active" : ""}
                onClick={() => setFilterTab("Semua")}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "Belum dibaca"}
                className={filterTab === "Belum dibaca" ? "is-active" : ""}
                onClick={() => setFilterTab("Belum dibaca")}
              >
                Belum dibaca ({unreadCount})
              </button>
            </div>

            <div className="notification-all-body">
              {modalItems.length === 0 ? (
                <p className="notification-all-empty">
                  {filterTab === "Belum dibaca"
                    ? "Semua notifikasi sudah dibaca."
                    : emptyText}
                </p>
              ) : (
                modalItems.map(renderNotificationItem)
              )}
            </div>
          </div>
          <button
            type="button"
            className="overlay-close"
            aria-label="Tutup semua notifikasi"
            onClick={() => setAllOpen(false)}
          />
        </div>
      )}
    </>
  )
}

export default NotificationBell
