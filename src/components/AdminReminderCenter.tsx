import { useMemo, useState } from "react"
import { useAuth } from "../AuthContext"
import { useReporting } from "../ReportingContext"
import type {
  NotificationPriority,
  NotificationTargetScope,
  NotifyFn,
} from "../types"
import {
  ADMIN_REMINDER_TEMPLATES,
  appendNotifications,
  createAdminReminderNotification,
  deleteAdminReminder,
  formatNotificationTimeLabel,
  isAdminReminderActive,
  resolveTargetUnitsForScope,
  setAdminReminderActive,
} from "../utils/notifications"
import { localNotificationTransport } from "../utils/notificationTransport"
import { unitOptions } from "../utils/organizations"
import { useDialog } from "../utils/useDialog"
import { formatJakartaDate } from "../utils/workflow"
import { Icon } from "./Icon"

export type ReminderPresetRequest = {
  scope: NotificationTargetScope
  seq: number
} | null

export function AdminReminderModal({
  open,
  onClose,
  notify,
  presetRequest,
}: {
  open: boolean
  onClose: () => void
  notify: NotifyFn
  presetRequest?: ReminderPresetRequest
}) {
  const { data, setData } = useReporting()
  const { session } = useAuth()

  const [targetScope, setTargetScope] =
    useState<NotificationTargetScope>("all")
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [unitSearch, setUnitSearch] = useState("")
  const [priority, setPriority] = useState<NotificationPriority>("urgent")
  const [targetMenu, setTargetMenu] = useState("Isi Laporan Triwulan")
  const [expiresAt, setExpiresAt] = useState("")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [appliedTemplateLabel, setAppliedTemplateLabel] = useState("")
  const [formError, setFormError] = useState("")
  const [historyTab, setHistoryTab] = useState<
    "Semua" | "Aktif" | "Diarsipkan"
  >("Semua")
  const [lastPresetSeq, setLastPresetSeq] = useState(0)

  useDialog(open, onClose, ".admin-reminder-overlay")

  if (presetRequest && presetRequest.seq !== lastPresetSeq) {
    setLastPresetSeq(presetRequest.seq)
    setFormError("")
    if (presetRequest.scope === "missing_report") {
      const tpl = ADMIN_REMINDER_TEMPLATES[0]
      setTargetScope("missing_report")
      setPriority(tpl.priority)
      setTargetMenu(tpl.targetMenu)
      setTitle(tpl.title)
      setMessage(tpl.message)
      setAppliedTemplateLabel(tpl.label)
    } else if (presetRequest.scope === "revision_only") {
      const tpl = ADMIN_REMINDER_TEMPLATES[2]
      setTargetScope("revision_only")
      setPriority(tpl.priority)
      setTargetMenu(tpl.targetMenu)
      setTitle(tpl.title)
      setMessage(tpl.message)
      setAppliedTemplateLabel(tpl.label)
    } else {
      setTargetScope(presetRequest.scope)
    }
  }

  const missingUnits = useMemo(
    () =>
      resolveTargetUnitsForScope({
        scope: "missing_report",
        records: data.records,
        year: data.year,
        quarter: data.quarter,
      }),
    [data.records, data.year, data.quarter],
  )

  const revisionUnits = useMemo(
    () =>
      resolveTargetUnitsForScope({
        scope: "revision_only",
        records: data.records,
        year: data.year,
        quarter: data.quarter,
      }),
    [data.records, data.year, data.quarter],
  )

  const resolvedUnits = useMemo(
    () =>
      resolveTargetUnitsForScope({
        scope: targetScope,
        records: data.records,
        year: data.year,
        quarter: data.quarter,
        specificUnits: selectedUnits,
      }),
    [targetScope, data.records, data.year, data.quarter, selectedUnits],
  )

  const filteredUnitGroups = useMemo(() => {
    const q = unitSearch.trim().toLowerCase()
    return Object.entries(unitOptions)
      .map(([parent, children]) => {
        const items = children.length ? children : [parent]
        const matchingItems = q
          ? items.filter(
              (item) =>
                item.toLowerCase().includes(q) ||
                parent.toLowerCase().includes(q),
            )
          : items
        return { parent, items: matchingItems }
      })
      .filter((group) => group.items.length > 0)
  }, [unitSearch])

  const allReminders = useMemo(
    () =>
      (data.notifications ?? []).filter(
        (item) => item.category === "admin_reminder",
      ),
    [data.notifications],
  )

  const activeReminders = useMemo(
    () => allReminders.filter((item) => isAdminReminderActive(item)),
    [allReminders],
  )

  const archivedReminders = useMemo(
    () => allReminders.filter((item) => !isAdminReminderActive(item)),
    [allReminders],
  )

  if (!open) return null

  const displayedReminders =
    historyTab === "Aktif"
      ? activeReminders
      : historyTab === "Diarsipkan"
        ? archivedReminders
        : allReminders

  const applyTemplate = (templateId: string) => {
    const tpl = ADMIN_REMINDER_TEMPLATES.find((item) => item.id === templateId)
    if (!tpl) return
    setTargetScope(tpl.targetScope)
    setPriority(tpl.priority)
    setTargetMenu(tpl.targetMenu)
    setTitle(tpl.title)
    setMessage(tpl.message)
    setAppliedTemplateLabel(tpl.label)
    setFormError("")
  }

  const toggleUnitSelection = (unitCode: string) => {
    setSelectedUnits((current) =>
      current.includes(unitCode)
        ? current.filter((item) => item !== unitCode)
        : [...current, unitCode],
    )
    setFormError("")
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setFormError("")

    const periodLabel =
      targetMenu === "Isi Sasaran Kinerja"
        ? `Tahun ${data.year}`
        : `Triwulan ${data.quarter} · ${data.year}`

    const result = createAdminReminderNotification({
      title,
      message,
      actor: `${session?.displayName || "Admin PRP"} (Admin PRP)`,
      priority,
      targetScope,
      targetUnits: resolvedUnits,
      targetMenu,
      periodLabel,
      expiresAt,
    })

    if (!result.ok) {
      setFormError(result.error)
      return
    }

    setData((current) => ({
      ...current,
      notifications: appendNotifications(
        current.notifications,
        result.notification,
      ),
    }))

    localNotificationTransport.publishEvent({
      type: "reminder_created",
      notification: result.notification,
      sentAt: result.notification.createdAt,
    })

    setTitle("")
    setMessage("")
    setExpiresAt("")
    setAppliedTemplateLabel("")
    notify(`Pengingat terkirim ke ${result.notification.unitLabel || "unit"}.`)
  }

  const handleToggleActive = (id: string, nextActive: boolean) => {
    setData((current) => ({
      ...current,
      notifications: setAdminReminderActive(
        current.notifications,
        id,
        nextActive,
      ),
    }))
    localNotificationTransport.publishEvent({
      type: "reminder_status_changed",
      notificationId: id,
      active: nextActive,
    })
    notify(
      nextActive ? "Pengingat diaktifkan kembali." : "Pengingat diarsipkan.",
    )
  }

  const handleDelete = (id: string, stillActive: boolean) => {
    if (
      stillActive &&
      !window.confirm("Pengingat masih aktif. Hapus dari daftar?")
    ) {
      return
    }
    setData((current) => ({
      ...current,
      notifications: deleteAdminReminder(current.notifications, id),
    }))
    localNotificationTransport.publishEvent({
      type: "reminder_status_changed",
      notificationId: id,
      active: false,
    })
    notify("Pengingat dihapus.")
  }

  const priorityLabel = (value?: NotificationPriority) =>
    value === "urgent"
      ? "Mendesak"
      : value === "important"
        ? "Penting"
        : "Informasi"

  return (
    <div
      className="admin-reminder-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-reminder-modal-title"
    >
      <section className="admin-reminder-dialog">
        <header className="admin-reminder-modal-head">
          <div className="admin-reminder-head-identity">
            <span className="admin-reminder-head-icon" aria-hidden="true">
              <Icon name="broadcast" size={20} />
            </span>
            <div>
              <span className="admin-reminder-head-kicker">
                SIARAN PENGINGAT · ADMIN PRP
              </span>
              <h2 id="admin-reminder-modal-title">
                Kirim Pengingat Realtime ke Unit
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="admin-reminder-close"
            onClick={onClose}
          >
            × Tutup
          </button>
        </header>

        <div className="admin-reminder-modal-body">
          <div className="admin-reminder-templates">
            <span className="admin-reminder-field-kicker">
              Template Cepat (1-Klik)
            </span>
            <div className="admin-reminder-template-list">
              {ADMIN_REMINDER_TEMPLATES.map((tpl) => (
                <button
                  type="button"
                  key={tpl.id}
                  className={`admin-reminder-template-btn${appliedTemplateLabel === tpl.label ? " is-selected" : ""}`}
                  onClick={() => applyTemplate(tpl.id)}
                >
                  <Icon name="plus" size={14} />
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>
            {appliedTemplateLabel && (
              <p className="admin-reminder-template-note" role="status">
                Template "{appliedTemplateLabel}" diterapkan. Sesuaikan pesan
                sebelum mengirim.
              </p>
            )}
          </div>

          <form
            className="admin-reminder-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {formError && (
              <div className="admin-reminder-error" role="alert">
                <span aria-hidden="true">!</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="admin-reminder-row">
              <label htmlFor="reminder-target-scope">
                Tujuan Penerima
                <select
                  id="reminder-target-scope"
                  name="targetScope"
                  value={targetScope}
                  onChange={(e) => {
                    setTargetScope(e.target.value as NotificationTargetScope)
                    setFormError("")
                  }}
                >
                  <option value="all">Semua Unit (42 Unit Pelapor)</option>
                  <option value="missing_report">
                    Unit Belum Melapor TW {data.quarter} · {data.year} (
                    {missingUnits.length} Unit)
                  </option>
                  <option value="revision_only">
                    Unit Status Revisi ({revisionUnits.length} Unit)
                  </option>
                  <option value="specific_units">
                    Pilih Unit Tertentu ({selectedUnits.length} dipilih)
                  </option>
                </select>
              </label>

              <label htmlFor="reminder-priority">
                Tingkat Prioritas
                <select
                  id="reminder-priority"
                  name="priority"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as NotificationPriority)
                  }
                >
                  <option value="urgent">
                    Mendesak (Banner Merah + Notifikasi Instan)
                  </option>
                  <option value="important">
                    Penting (Banner Pengingat + Notifikasi Instan)
                  </option>
                  <option value="normal">
                    Informasi Umum (Lonceng + Notifikasi Instan)
                  </option>
                </select>
              </label>
            </div>

            <div className="admin-reminder-row">
              <label htmlFor="reminder-target-menu">
                Pintasan Menu Tujuan
                <select
                  id="reminder-target-menu"
                  name="targetMenu"
                  value={targetMenu}
                  onChange={(e) => setTargetMenu(e.target.value)}
                >
                  <option value="Isi Laporan Triwulan">
                    Isi Laporan Triwulan
                  </option>
                  <option value="Isi Sasaran Kinerja">
                    Isi Sasaran Kinerja
                  </option>
                  <option value="Riwayat">Riwayat Dokumen</option>
                  <option value="Dashboard">Dashboard Beranda</option>
                </select>
              </label>

              <label htmlFor="reminder-expires-at">
                Berlaku Hingga (Opsional)
                <input
                  id="reminder-expires-at"
                  name="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => {
                    setExpiresAt(e.target.value)
                    setFormError("")
                  }}
                />
              </label>
            </div>

            {targetScope === "specific_units" && (
              <div className="admin-reminder-unit-picker">
                <div className="admin-reminder-unit-head">
                  <strong>
                    Unit Tujuan ({selectedUnits.length}/42 dipilih)
                  </strong>
                  <div className="admin-reminder-unit-actions">
                    <button
                      type="button"
                      className="admin-secondary-btn"
                      onClick={() =>
                        setSelectedUnits(
                          Object.entries(unitOptions).flatMap(
                            ([parent, children]) =>
                              children.length ? children : [parent],
                          ),
                        )
                      }
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-btn"
                      onClick={() => setSelectedUnits([])}
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
                <label
                  htmlFor="reminder-unit-search"
                  className="admin-reminder-unit-search"
                >
                  Cari unit atau bagian
                  <input
                    id="reminder-unit-search"
                    name="unitSearch"
                    type="text"
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="Ketik nama unit (mis. FKET, BPK, LPPM)"
                  />
                </label>
                <div className="admin-reminder-unit-groups">
                  {filteredUnitGroups.map((group) => (
                    <div
                      className="admin-reminder-unit-group"
                      key={group.parent}
                    >
                      <span className="admin-reminder-unit-group-title">
                        {group.parent}
                      </span>
                      <div className="admin-reminder-unit-chips">
                        {group.items.map((unitCode) => {
                          const checked = selectedUnits.includes(unitCode)
                          return (
                            <label
                              key={unitCode}
                              className={`admin-reminder-unit-chip${checked ? " is-checked" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleUnitSelection(unitCode)}
                              />
                              <span>{unitCode}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {filteredUnitGroups.length === 0 && (
                    <p className="admin-reminder-empty-note">
                      Tidak ada unit yang cocok dengan "{unitSearch}".
                    </p>
                  )}
                </div>
              </div>
            )}

            {(targetScope === "missing_report" ||
              targetScope === "revision_only") && (
              <p className="admin-reminder-scope-preview">
                {resolvedUnits.length > 0
                  ? `Target: ${resolvedUnits.length} unit (${resolvedUnits.slice(0, 6).join(", ")}${resolvedUnits.length > 6 ? `, +${resolvedUnits.length - 6} lainnya` : ""})`
                  : "Belum ada unit pada status ini di periode aktif."}
              </p>
            )}

            <label htmlFor="reminder-title">
              Judul Pengingat
              <input
                id="reminder-title"
                name="title"
                type="text"
                maxLength={120}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setFormError("")
                }}
                placeholder={`Contoh: Segera Lengkapi Laporan Triwulan ${data.quarter}`}
                required
              />
            </label>

            <label htmlFor="reminder-message">
              Isi Pesan Pengingat
              <textarea
                id="reminder-message"
                name="message"
                rows={3}
                maxLength={600}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setFormError("")
                }}
                placeholder="Tulis instruksi atau pengingat untuk unit yang dituju..."
                required
              />
            </label>

            <div className="admin-reminder-submit-row">
              <button
                type="submit"
                className="admin-primary admin-reminder-send"
              >
                <Icon name="broadcast" size={16} />
                <span>Kirim Pengingat Realtime</span>
              </button>
            </div>
          </form>

          <section className="admin-reminder-history">
            <div className="admin-reminder-history-head">
              <h3>Daftar Pengingat & Status Baca ({allReminders.length})</h3>
              <div
                className="history-tabs"
                role="tablist"
                aria-label="Filter riwayat pengingat"
              >
                {(
                  [
                    { key: "Semua", count: allReminders.length },
                    { key: "Aktif", count: activeReminders.length },
                    { key: "Diarsipkan", count: archivedReminders.length },
                  ] as const
                ).map((tabItem) => (
                  <button
                    key={tabItem.key}
                    type="button"
                    role="tab"
                    aria-selected={historyTab === tabItem.key}
                    className={historyTab === tabItem.key ? "active" : ""}
                    onClick={() => setHistoryTab(tabItem.key)}
                  >
                    {tabItem.key} ({tabItem.count})
                  </button>
                ))}
              </div>
            </div>

            {displayedReminders.length === 0 ? (
              <p className="admin-reminder-empty-box">
                {historyTab === "Semua"
                  ? "Belum ada pengingat terkirim."
                  : historyTab === "Aktif"
                    ? "Tidak ada pengingat aktif."
                    : "Belum ada pengingat yang diarsipkan."}
              </p>
            ) : (
              <ul className="admin-reminder-list">
                {displayedReminders.map((item) => {
                  const activeNow = isAdminReminderActive(item)
                  const expired =
                    item.active !== false &&
                    Boolean(item.expiresAt) &&
                    !activeNow
                  return (
                    <li
                      key={item.id}
                      className={`admin-reminder-item${activeNow ? " is-active" : " is-archived"}`}
                    >
                      <div className="admin-reminder-item-head">
                        <div className="admin-reminder-badges">
                          <span
                            className={`admin-reminder-badge is-${item.priority || "normal"}`}
                          >
                            {priorityLabel(item.priority)}
                          </span>
                          <span
                            className={`admin-reminder-badge ${activeNow ? "is-active" : "is-archived"}`}
                          >
                            {activeNow
                              ? "Aktif"
                              : expired
                                ? "Kedaluwarsa"
                                : "Diarsipkan"}
                          </span>
                          <span
                            className={`admin-reminder-badge ${item.read ? "is-read" : "is-unread"}`}
                          >
                            {item.read ? "Sudah dibaca" : "Belum dibaca"}
                          </span>
                        </div>
                        <time>
                          {formatNotificationTimeLabel(item.createdAt)}
                        </time>
                      </div>

                      <strong>{item.title}</strong>
                      <p>{item.message}</p>

                      <div className="admin-reminder-meta">
                        <span>Tujuan: {item.unitLabel || "Seluruh Unit"}</span>
                        {item.periodLabel && (
                          <span>Periode: {item.periodLabel}</span>
                        )}
                        <span>Menu: {item.targetMenu}</span>
                        {item.expiresAt && (
                          <span>
                            Berlaku s.d. {formatJakartaDate(item.expiresAt)}
                          </span>
                        )}
                        {item.read && item.acknowledgedAt && (
                          <span>
                            Dibaca{" "}
                            {formatNotificationTimeLabel(item.acknowledgedAt)}
                          </span>
                        )}
                      </div>

                      <div className="admin-reminder-item-actions">
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          onClick={() =>
                            handleToggleActive(item.id, item.active === false)
                          }
                        >
                          {item.active === false
                            ? "Aktifkan Lagi"
                            : "Arsipkan"}
                        </button>
                        <button
                          type="button"
                          className="admin-reminder-delete-btn"
                          onClick={() => handleDelete(item.id, activeNow)}
                        >
                          Hapus
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </section>
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup siaran pengingat"
        onClick={onClose}
      />
    </div>
  )
}

export default AdminReminderModal
