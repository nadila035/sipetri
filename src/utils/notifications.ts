import type {
  AppNotification,
  HistoryRecord,
  NotificationCategory,
  NotificationPriority,
  NotificationRecipient,
  NotificationTargetScope,
} from "../types/index.ts"
import {
  parseSentAtTimestamp,
  reportingCoverage,
  reportingUnits,
  resolveOrganization,
} from "./organizations.ts"
import {
  deadlineCutoff,
  formatJakartaDate,
  formatPeriodStatusTag,
  formatPeriodWindow,
  getDeadlineCardModel,
  getPeriodState,
  todayJakartaDateString,
  type Period,
} from "./workflow.ts"

const MAX_STORED_NOTIFICATIONS = 80
const DEADLINE_REMINDER_DAYS = 3

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  admin_reminder: "Pengingat Admin PRP",
  revision_requested: "Laporan perlu revisi",
  document_approved: "Laporan disetujui",
  period_opened: "Periode dibuka",
  period_updated: "Jadwal diperbarui",
  period_locked: "Periode dikunci",
  year_added: "Tahun pelaporan baru",
  default_period_changed: "Periode beranda diperbarui",
  document_submitted: "Dokumen baru masuk",
  revision_resubmitted: "Perbaikan revisi dikirim ulang",
  deadline_reminder: "Pengingat tenggat",
}

export type AdminReminderTemplate = {
  id: string
  label: string
  priority: NotificationPriority
  targetScope: NotificationTargetScope
  targetMenu: string
  title: string
  message: string
}

export const ADMIN_REMINDER_TEMPLATES: AdminReminderTemplate[] = [
  {
    id: "submit-triwulan",
    label: "Input Laporan Triwulan",
    priority: "urgent",
    targetScope: "missing_report",
    targetMenu: "Isi Laporan Triwulan",
    title: "Segera Lengkapi & Kirim Laporan Triwulan",
    message:
      "Mohon unit yang belum melapor segera mengisi realisasi program kerja, kendala, dan bukti dukung untuk periode berjalan sebelum batas waktu.",
  },
  {
    id: "submit-sasaran",
    label: "Susun Sasaran Kinerja",
    priority: "important",
    targetScope: "all",
    targetMenu: "Isi Sasaran Kinerja",
    title: "Pengingat Penyusunan Sasaran Kinerja Tahunan",
    message:
      "Mohon seluruh unit menyusun dan mengirim target program kerja serta sasaran kinerja tahunan sebagai acuan pelaporan triwulan.",
  },
  {
    id: "fix-revision",
    label: "Perbaikan Revisi",
    priority: "urgent",
    targetScope: "revision_only",
    targetMenu: "Riwayat",
    title: "Segera Perbaiki Dokumen Berstatus Revisi",
    message:
      "Terdapat catatan verifikasi Admin PRP pada dokumen Anda. Buka menu Riwayat untuk memperbaiki dan mengirim ulang dokumen.",
  },
  {
    id: "complete-evidence",
    label: "Lengkapi Bukti Dukung",
    priority: "important",
    targetScope: "all",
    targetMenu: "Isi Laporan Triwulan",
    title: "Kelengkapan Kendala & Bukti Dukung",
    message:
      "Pastikan sasaran dengan realisasi di bawah 100% telah melampirkan tautan bukti dukung, kendala, dan rencana penyelesaian.",
  },
]

export type DisplayNotification = {
  notification: AppNotification
  isRead: boolean
  isSyntheticReminder?: boolean
  legacyReadKey?: string
}

export function formatRecordUnitLabel(record: Pick<HistoryRecord, "unit" | "parentUnit" | "subUnit">): string {
  const org = resolveOrganization(record)
  if (org) return `${org.parentUnit} · ${org.subUnit}`
  return record.subUnit || record.unit || "-"
}

export function createAppNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "read"> & {
    id?: string
    createdAt?: string
    read?: boolean
  },
): AppNotification {
  return {
    id: input.id ?? `notif-${crypto.randomUUID()}`,
    recipient: input.recipient,
    category: input.category,
    title: input.title.trim(),
    message: input.message.trim(),
    actor: input.actor.trim() || "Sistem",
    createdAt: input.createdAt ?? new Date().toISOString(),
    targetMenu: input.targetMenu,
    ...(input.recordId ? { recordId: input.recordId } : {}),
    ...(input.openRevision ? { openRevision: true } : {}),
    ...(input.unitLabel ? { unitLabel: input.unitLabel } : {}),
    ...(input.periodLabel ? { periodLabel: input.periodLabel } : {}),
    ...(input.targetUnit?.trim() ? { targetUnit: input.targetUnit.trim() } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.targetScope ? { targetScope: input.targetScope } : {}),
    ...(input.targetUnits && input.targetUnits.length > 0
      ? { targetUnits: [...input.targetUnits] }
      : {}),
    ...(typeof input.active === "boolean" ? { active: input.active } : {}),
    ...(input.expiresAt?.trim() ? { expiresAt: input.expiresAt.trim() } : {}),
    ...(input.acknowledgedAt ? { acknowledgedAt: input.acknowledgedAt } : {}),
    ...(input.acknowledgedBy ? { acknowledgedBy: input.acknowledgedBy } : {}),
    read: Boolean(input.read),
  }
}

export function appendNotifications(
  existing: AppNotification[] | undefined,
  incoming: AppNotification | AppNotification[],
  maxItems = MAX_STORED_NOTIFICATIONS,
): AppNotification[] {
  const additions = Array.isArray(incoming) ? incoming : [incoming]
  if (additions.length === 0) return existing ?? []
  const merged = [...additions, ...(existing ?? [])]
  const seen = new Set<string>()
  const deduped: AppNotification[] = []
  for (const item of merged) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    deduped.push(item)
  }
  if (deduped.length <= maxItems) return deduped

  const keptIds = new Set<string>()
  for (const item of deduped) {
    if (
      item.category === "admin_reminder" &&
      !item.read &&
      isAdminReminderActive(item)
    ) {
      keptIds.add(item.id)
      if (keptIds.size >= maxItems) break
    }
  }
  for (const item of deduped) {
    if (keptIds.size >= maxItems) break
    keptIds.add(item.id)
  }
  return deduped.filter((item) => keptIds.has(item.id))
}

export function markStoredNotificationsRead(
  list: AppNotification[] | undefined,
  recipient: NotificationRecipient,
  ids: string[] | "all",
): AppNotification[] {
  const targetSet = ids === "all" ? null : new Set(ids)
  return (list ?? []).map((item) => {
    if (item.recipient !== recipient) return item
    if (targetSet === null || targetSet.has(item.id)) {
      return item.read ? item : { ...item, read: true }
    }
    return item
  })
}

export function acknowledgeStoredNotifications(
  list: AppNotification[] | undefined,
  recipient: NotificationRecipient,
  ids: string[] | "all",
  acknowledgedBy = "Staf Unit",
  acknowledgedAt = new Date().toISOString(),
): AppNotification[] {
  const targetSet = ids === "all" ? null : new Set(ids)
  return (list ?? []).map((item) => {
    if (item.recipient !== recipient) return item
    if (targetSet !== null && !targetSet.has(item.id)) return item
    if (item.read && item.acknowledgedAt) return item
    return {
      ...item,
      read: true,
      acknowledgedAt: item.acknowledgedAt ?? acknowledgedAt,
      acknowledgedBy: item.acknowledgedBy ?? (acknowledgedBy.trim() || "Staf Unit"),
    }
  })
}

export function resolveTargetUnitsForScope({
  scope,
  records,
  year,
  quarter,
  specificUnits = [],
}: {
  scope: NotificationTargetScope
  records: HistoryRecord[]
  year: string
  quarter: string
  specificUnits?: string[]
}): string[] {
  if (scope === "all") {
    return reportingUnits.map((u) => u.subUnit)
  }
  if (scope === "missing_report") {
    return reportingCoverage(records, year, quarter)
      .rows.filter((row) => !row.record)
      .map((row) => row.subUnit)
  }
  if (scope === "revision_only") {
    const seen = new Set<string>()
    for (const record of records) {
      if (record.status !== "Revisi") continue
      const unitCode =
        resolveOrganization(record)?.subUnit || record.subUnit || record.unit
      if (unitCode?.trim()) {
        seen.add(unitCode.trim())
      }
    }
    return Array.from(seen)
  }
  return Array.from(
    new Set(specificUnits.map((item) => item.trim()).filter(Boolean)),
  )
}

export function formatReminderTargetSummary(
  targetScope: NotificationTargetScope | undefined,
  targetUnits: string[] | undefined,
): string {
  const units = targetUnits ?? []
  if (targetScope === "missing_report") {
    return units.length > 0
      ? `Unit Belum Melapor (${units.length} unit)`
      : "Unit Belum Melapor (0 unit)"
  }
  if (targetScope === "revision_only") {
    return units.length > 0
      ? `Unit Status Revisi (${units.length} unit)`
      : "Unit Status Revisi (0 unit)"
  }
  if (targetScope === "specific_units") {
    if (units.length === 0) return "Unit Tertentu"
    if (units.length <= 3) return units.join(", ")
    return `${units.slice(0, 2).join(", ")} +${units.length - 2} unit`
  }
  return `Seluruh Unit (${reportingUnits.length} unit)`
}

export function createAdminReminderNotification(input: {
  title: string
  message: string
  actor?: string
  priority?: NotificationPriority
  targetScope?: NotificationTargetScope
  targetUnits?: string[]
  targetMenu?: string
  periodLabel?: string
  expiresAt?: string
  createdAt?: string
  id?: string
}): { ok: true; notification: AppNotification } | { ok: false; error: string } {
  const title = input.title.trim()
  const message = input.message.trim()
  const targetScope = input.targetScope ?? "all"
  const priority = input.priority ?? "normal"
  const targetUnits = Array.from(
    new Set((input.targetUnits ?? []).map((u) => u.trim()).filter(Boolean)),
  )
  const expiresAt = input.expiresAt?.trim() ?? ""

  if (!title) {
    return { ok: false, error: "Judul pengingat wajib diisi." }
  }
  if (!message) {
    return { ok: false, error: "Isi pesan pengingat wajib diisi." }
  }
  if (targetScope === "specific_units" && targetUnits.length === 0) {
    return {
      ok: false,
      error: "Pilih minimal satu unit tujuan untuk pengingat khusus.",
    }
  }
  if (expiresAt && !Number.isFinite(deadlineCutoff(expiresAt))) {
    return {
      ok: false,
      error: "Tanggal batas berlaku pengingat tidak valid.",
    }
  }

  const unitLabel = formatReminderTargetSummary(targetScope, targetUnits)

  return {
    ok: true,
    notification: createAppNotification({
      id: input.id,
      recipient: "staff",
      category: "admin_reminder",
      title,
      message,
      actor: input.actor?.trim() || "Admin PRP",
      createdAt: input.createdAt,
      targetMenu: input.targetMenu?.trim() || "Dashboard",
      periodLabel: input.periodLabel?.trim() || undefined,
      unitLabel,
      targetUnit: targetUnits.length === 1 ? targetUnits[0] : undefined,
      priority,
      targetScope,
      targetUnits,
      active: true,
      expiresAt: expiresAt || undefined,
      read: false,
    }),
  }
}

export function isAdminReminderActive(
  notification: AppNotification,
  nowMs = Date.now(),
): boolean {
  if (notification.category !== "admin_reminder") return false
  if (notification.active === false) return false
  if (notification.expiresAt?.trim()) {
    const cutoff = deadlineCutoff(notification.expiresAt.trim())
    if (!Number.isFinite(cutoff) || nowMs > cutoff) return false
  }
  return true
}

export function setAdminReminderActive(
  list: AppNotification[] | undefined,
  id: string,
  active: boolean,
): AppNotification[] {
  return (list ?? []).map((item) =>
    item.id === id && item.category === "admin_reminder"
      ? { ...item, active }
      : item,
  )
}

export function deleteAdminReminder(
  list: AppNotification[] | undefined,
  id: string,
): AppNotification[] {
  return (list ?? []).filter(
    (item) => !(item.id === id && item.category === "admin_reminder"),
  )
}

export function collectActiveStaffReminders({
  storedNotifications,
  nowMs = Date.now(),
}: {
  storedNotifications?: AppNotification[]
  nowMs?: number
}): AppNotification[] {
  const priorityRank = (priority?: NotificationPriority) =>
    priority === "urgent" ? 2 : priority === "important" ? 1 : 0

  return (storedNotifications ?? [])
    .filter(
      (item) =>
        item.recipient === "staff" &&
        !item.read &&
        priorityRank(item.priority) > 0 &&
        isAdminReminderActive(item, nowMs),
    )
    .sort((a, b) => {
      const rankDiff = priorityRank(b.priority) - priorityRank(a.priority)
      if (rankDiff !== 0) return rankDiff
      return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    })
}

export function buildPeriodNotification({
  previousPeriod,
  nextPeriod,
  slotLabel,
  year,
  isAnnual,
  actor = "Admin PRP",
  createdAt,
}: {
  previousPeriod?: Period
  nextPeriod: Period
  slotLabel: string
  year: string
  isAnnual: boolean
  actor?: string
  createdAt?: string
}): AppNotification | null {
  const prevStart = previousPeriod?.startDate?.trim() ?? ""
  const prevDeadline = previousPeriod?.deadline?.trim() ?? ""
  const prevOpen = Boolean(previousPeriod?.open)
  const nextStart = nextPeriod.startDate?.trim() ?? ""
  const nextDeadline = nextPeriod.deadline.trim()
  const nextOpen = Boolean(nextPeriod.open)

  if (
    prevStart === nextStart &&
    prevDeadline === nextDeadline &&
    prevOpen === nextOpen
  ) {
    return null
  }

  const prevState = getPeriodState(previousPeriod)
  const nextState = getPeriodState(nextPeriod)
  const targetMenu = isAnnual ? "Isi Sasaran Kinerja" : "Isi Laporan Triwulan"
  const periodLabel = isAnnual ? `Tahun ${year}` : `${slotLabel} · ${year}`
  const windowLabel = formatPeriodWindow(nextPeriod)

  let category: NotificationCategory = "period_updated"
  const title = `${slotLabel} (${year})`
  let message = `Status: ${formatPeriodStatusTag(nextState.status)} (${windowLabel}).`

  if (!nextOpen) {
    category = "period_locked"
    message =
      "Pengumpulan dokumen baru untuk periode ini ditutup. Perbaikan revisi mengikuti ketentuan masa pengumpulan."
  } else if (!prevOpen && nextOpen) {
    category = "period_opened"
    message = `Periode kini berstatus ${formatPeriodStatusTag(nextState.status)} (${windowLabel}).`
  } else if (!prevState.canSubmit && nextState.canSubmit) {
    category = "period_opened"
    message = `Pengumpulan dibuka kembali oleh Admin (${windowLabel}).`
  } else if (prevDeadline !== nextDeadline && nextDeadline) {
    category =
      prevDeadline && nextDeadline > prevDeadline
        ? "period_opened"
        : "period_updated"
    const formattedDeadline = formatJakartaDate(nextDeadline)
    message = prevDeadline
      ? nextDeadline > prevDeadline
        ? `Tenggat diperpanjang dari ${formatJakartaDate(prevDeadline)} menjadi ${formattedDeadline} (23:59 WIB).`
        : `Batas akhir diubah dari ${formatJakartaDate(prevDeadline)} menjadi ${formattedDeadline} (23:59 WIB).`
      : `Batas akhir ditetapkan hingga ${formattedDeadline} (23:59 WIB).`
  }

  return createAppNotification({
    recipient: "staff",
    category,
    title,
    message,
    actor,
    createdAt,
    targetMenu,
    periodLabel,
  })
}

export function buildDeadlineReminderNotifications({
  periods,
  records,
  year,
  quarter,
  nowMs = Date.now(),
}: {
  periods: Record<string, Period>
  records: HistoryRecord[]
  year: string
  quarter: string
  nowMs?: number
}): AppNotification[] {
  const candidates = [
    {
      key: `${year}-annual`,
      periodLabel: `Tahun ${year}`,
      docTitle: `Sasaran Kinerja Tahun ${year}`,
      targetMenu: "Isi Sasaran Kinerja",
      hasSubmitted: records.some(
        (r) =>
          r.type === "Sasaran Kinerja" &&
          r.period === `Tahun ${year}` &&
          r.status !== "Draf",
      ),
    },
    {
      key: `${year}-${quarter}`,
      periodLabel: `Triwulan ${quarter} · ${year}`,
      docTitle: `Laporan Triwulan ${quarter} (${year})`,
      targetMenu: "Isi Laporan Triwulan",
      hasSubmitted: records.some(
        (r) =>
          r.type === "Laporan Triwulan" &&
          r.period === `Triwulan ${quarter} · ${year}` &&
          r.status !== "Draf",
      ),
    },
  ]

  const reminders: AppNotification[] = []

  for (const item of candidates) {
    if (item.hasSubmitted) continue
    const period = periods[item.key]
    const state = getPeriodState(period, nowMs)
    if (state.status !== "open" || !period?.deadline?.trim()) continue
    const model = getDeadlineCardModel(period, nowMs)
    const daysRemaining =
      model.countdownHighlight === "Hari ini"
        ? 0
        : Number.parseInt(model.countdownHighlight, 10)
    if (!Number.isFinite(daysRemaining) || daysRemaining < 0 || daysRemaining > DEADLINE_REMINDER_DAYS) {
      continue
    }

    const urgency =
      daysRemaining === 0
        ? "hari ini (23:59 WIB)"
        : `${daysRemaining} hari lagi (${model.headline})`

    const reminderAnchor = `${todayJakartaDateString(nowMs)}T00:00:00.000+07:00`

    reminders.push({
      id: `reminder-${item.key}-${period.deadline}`,
      recipient: "staff",
      category: "deadline_reminder",
      title: item.docTitle,
      message: `Batas pengiriman tinggal ${urgency} dan belum ada dokumen terkirim untuk periode ini.`,
      actor: "Pengingat Jadwal",
      createdAt: reminderAnchor,
      targetMenu: item.targetMenu,
      periodLabel: item.periodLabel,
      read: false,
    })
  }

  return reminders
}

function getNotificationSortTimestamp(
  notification: AppNotification,
  fallbackRecord?: HistoryRecord,
): number {
  const parsedIso = Date.parse(notification.createdAt)
  if (Number.isFinite(parsedIso)) return parsedIso
  if (fallbackRecord) {
    return parseSentAtTimestamp(fallbackRecord.sentAt)
  }
  return 0
}

export function collectRecipientNotifications({
  recipient,
  storedNotifications,
  records,
  periods,
  year,
  quarter,
  sessionSubUnit: _sessionSubUnit,
  legacyReadKeys = [],
  nowMs = Date.now(),
}: {
  recipient: NotificationRecipient
  storedNotifications?: AppNotification[]
  records: HistoryRecord[]
  periods: Record<string, Period>
  year: string
  quarter: string
  sessionSubUnit?: string
  legacyReadKeys?: string[]
  nowMs?: number
}): DisplayNotification[] {
  const legacySet = new Set(legacyReadKeys)
  const recordById = new Map(records.map((r) => [r.id, r]))
  const explicitForRecipient = (storedNotifications ?? []).filter(
    (item) =>
      item.recipient === recipient &&
      (recipient !== "staff" ||
        item.category !== "admin_reminder" ||
        isAdminReminderActive(item, nowMs)),
  )

  const coveredRecordStatuses = new Set<string>()
  for (const item of explicitForRecipient) {
    if (!item.recordId) continue
    if (item.category === "revision_requested") {
      coveredRecordStatuses.add(`${item.recordId}:Revisi`)
    } else if (item.category === "document_approved") {
      coveredRecordStatuses.add(`${item.recordId}:Disetujui`)
    } else if (
      item.category === "document_submitted" ||
      item.category === "revision_resubmitted"
    ) {
      coveredRecordStatuses.add(`${item.recordId}:Menunggu`)
    }
  }

  const results: Array<DisplayNotification & { sortTs: number }> = []

  for (const item of explicitForRecipient) {
    const rec = item.recordId ? recordById.get(item.recordId) : undefined
    const isRead = Boolean(item.read) || legacySet.has(item.id)
    results.push({
      notification: { ...item, read: isRead },
      isRead,
      sortTs: getNotificationSortTimestamp(item, rec),
    })
  }

  if (recipient === "staff") {
    for (const record of records) {
      if (record.status !== "Revisi" && record.status !== "Disetujui") continue
      if (coveredRecordStatuses.has(`${record.id}:${record.status}`)) continue
      const legacyKey = JSON.stringify([
        record.id,
        record.status,
        record.sentAt,
        record.items,
      ])
      const latestReview = record.reviews?.[record.reviews.length - 1]
      const revisionCount = record.items.filter((i) => i.needsRevision || i.note).length
      const category: NotificationCategory =
        record.status === "Revisi" ? "revision_requested" : "document_approved"
      const notification: AppNotification = {
        id: `legacy-staff-${record.id}-${record.status}`,
        recipient: "staff",
        category,
        title: record.title,
        message:
          record.status === "Revisi"
            ? revisionCount > 0
              ? `${revisionCount} catatan indikator perlu diperbaiki`
              : "Periksa catatan indikator dari Admin PRP"
            : `${formatRecordUnitLabel(record)} · ${record.period} selesai diverifikasi`,
        actor: latestReview?.actor || "Admin PRP",
        createdAt: latestReview?.at || record.sentAt,
        targetMenu: "Riwayat",
        recordId: record.id,
        openRevision: record.status === "Revisi",
        targetUnit: resolveOrganization(record)?.subUnit || record.subUnit || record.unit,
        unitLabel: formatRecordUnitLabel(record),
        periodLabel: record.period,
        read: legacySet.has(legacyKey),
      }
      results.push({
        notification,
        isRead: legacySet.has(legacyKey),
        legacyReadKey: legacyKey,
        sortTs: getNotificationSortTimestamp(notification, record),
      })
    }

    const reminders = buildDeadlineReminderNotifications({
      periods,
      records,
      year,
      quarter,
      nowMs,
    })
    for (const reminder of reminders) {
      const read = legacySet.has(reminder.id)
      results.push({
        notification: { ...reminder, read },
        isRead: read,
        isSyntheticReminder: true,
        legacyReadKey: reminder.id,
        sortTs: getNotificationSortTimestamp(reminder),
      })
    }
  } else {
    for (const record of records) {
      if (record.status !== "Menunggu") continue
      if (coveredRecordStatuses.has(`${record.id}:Menunggu`)) continue
      const legacyKey = JSON.stringify([record.id, record.sentAt])
      const hasPriorReview = (record.reviews ?? []).some(
        (rev) => rev.action === "Revisi",
      )
      const unitLabel = formatRecordUnitLabel(record)
      const notification: AppNotification = {
        id: `legacy-admin-${record.id}`,
        recipient: "admin",
        category: hasPriorReview ? "revision_resubmitted" : "document_submitted",
        title: record.title,
        message: hasPriorReview
          ? `${unitLabel} · ${record.period} siap diperiksa kembali`
          : `${unitLabel} · ${record.period} menunggu verifikasi`,
        actor: record.author || "Staf Unit",
        createdAt: record.sentAt,
        targetMenu:
          record.type === "Sasaran Kinerja"
            ? "Verifikasi Sasaran Kinerja"
            : "Verifikasi Laporan Triwulan",
        recordId: record.id,
        unitLabel,
        periodLabel: record.period,
        read: legacySet.has(legacyKey),
      }
      results.push({
        notification,
        isRead: legacySet.has(legacyKey),
        legacyReadKey: legacyKey,
        sortTs: parseSentAtTimestamp(record.sentAt),
      })
    }
  }

  return results
    .sort((a, b) => b.sortTs - a.sortTs)
    .map(({ sortTs: _sortTs, ...rest }) => rest)
}

export function formatNotificationTimeLabel(value: string): string {
  if (!value) return ""
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return value
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(ms))
}
