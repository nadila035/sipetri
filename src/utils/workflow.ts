export type Period = {
  startDate?: string
  deadline: string
  open: boolean
}

export type PeriodStatus =
  | "open"
  | "unscheduled"
  | "upcoming"
  | "expired"
  | "closed"
  | "invalid"

export const deadlineTimezone = "Asia/Jakarta"

export const QUARTER_ORDER = ["I", "II", "III", "IV"] as const
export type QuarterCode = (typeof QUARTER_ORDER)[number]

export function quarterIndex(quarter: string): number {
  const idx = QUARTER_ORDER.indexOf(quarter.trim().toUpperCase() as QuarterCode)
  return idx >= 0 ? idx : 0
}

export function compareQuarters(a: string, b: string): number {
  return quarterIndex(a) - quarterIndex(b)
}

export function quarterFromMonth(yyyyMm?: string): QuarterCode | null {
  if (!yyyyMm) return null
  const match = yyyyMm.trim().match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const month = Number(match[2])
  if (month >= 1 && month <= 3) return "I"
  if (month >= 4 && month <= 6) return "II"
  if (month >= 7 && month <= 9) return "III"
  if (month >= 10 && month <= 12) return "IV"
  return null
}

function parseJakartaDateParts(value: string): {
  year: number
  month: number
  day: number
} | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null
  }
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  }
}

export function startCutoff(startDate: string): number {
  if (!parseJakartaDateParts(startDate)) return NaN
  return Date.parse(`${startDate}T00:00:00.000+07:00`)
}

export function deadlineCutoff(deadline: string): number {
  if (!parseJakartaDateParts(deadline)) return NaN
  return Date.parse(`${deadline}T23:59:59.999+07:00`)
}

export function getPeriodState(
  period?: Period,
  now = Date.now(),
): {
  status: PeriodStatus
  canSubmit: boolean
  startAt: number | null
  deadlineAt: number | null
} {
  if (!period) {
    return {
      status: "unscheduled",
      canSubmit: false,
      startAt: null,
      deadlineAt: null,
    }
  }

  const hasStart = Boolean(period.startDate?.trim())
  const hasDeadline = Boolean(period.deadline?.trim())

  const parsedStart = hasStart ? startCutoff(period.startDate!.trim()) : null
  const parsedDeadline = hasDeadline
    ? deadlineCutoff(period.deadline.trim())
    : null

  if (
    (parsedStart !== null && !Number.isFinite(parsedStart)) ||
    (parsedDeadline !== null && !Number.isFinite(parsedDeadline)) ||
    (parsedStart !== null &&
      parsedDeadline !== null &&
      parsedStart > parsedDeadline)
  ) {
    return {
      status: "invalid",
      canSubmit: false,
      startAt: Number.isFinite(parsedStart) ? parsedStart : null,
      deadlineAt: Number.isFinite(parsedDeadline) ? parsedDeadline : null,
    }
  }

  if (!period.open) {
    return {
      status: "closed",
      canSubmit: false,
      startAt: parsedStart,
      deadlineAt: parsedDeadline,
    }
  }

  if (parsedStart !== null && now < parsedStart) {
    return {
      status: "upcoming",
      canSubmit: false,
      startAt: parsedStart,
      deadlineAt: parsedDeadline,
    }
  }

  if (parsedDeadline !== null && now > parsedDeadline) {
    return {
      status: "expired",
      canSubmit: false,
      startAt: parsedStart,
      deadlineAt: parsedDeadline,
    }
  }

  if (!hasStart && !hasDeadline) {
    return {
      status: "open",
      canSubmit: true,
      startAt: null,
      deadlineAt: null,
    }
  }

  return {
    status: "open",
    canSubmit: true,
    startAt: parsedStart,
    deadlineAt: parsedDeadline,
  }
}

export function canSubmit(period?: Period, now = Date.now()): boolean {
  return getPeriodState(period, now).canSubmit
}

export function resolveRecordPeriodKey(record: {
  type: string
  period: string
}): string | null {
  const yearMatch = record.period.match(/\b(\d{4})\b/)
  if (!yearMatch) return null
  const year = yearMatch[1]
  if (record.type === "Sasaran Kinerja") return `${year}-annual`
  if (record.type === "Laporan Triwulan") {
    const qMatch = record.period.match(/Triwulan\s+(IV|I{1,3})\b/i)
    if (qMatch) return `${year}-${qMatch[1].toUpperCase()}`
  }
  return null
}

export function formatPeriodStatusTag(status: PeriodStatus): string {
  switch (status) {
    case "open":
      return "Dibuka"
    case "upcoming":
      return "Belum Dibuka"
    case "expired":
      return "Lewat Tenggat"
    case "invalid":
      return "Jadwal Invalid"
    default:
      return "Ditutup"
  }
}

export function describePeriodLockReason(
  period?: Period,
  labelPrefix = "Periode ini",
  now = Date.now(),
): string {
  const state = getPeriodState(period, now)
  if (state.status === "upcoming") {
    return `${labelPrefix} baru dibuka mulai ${formatJakartaDate(period?.startDate)}.`
  }
  if (state.status === "expired") {
    return `Batas akhir ${labelPrefix.toLowerCase()} (${formatJakartaDate(period?.deadline)}, 23:59 WIB) telah berakhir.`
  }
  if (state.status === "invalid") {
    return "Rentang tanggal periode belum valid. Hubungi Admin PRP."
  }
  if (state.status === "unscheduled") {
    return `${labelPrefix} belum dibuka oleh Admin PRP.`
  }
  return `${labelPrefix} sedang dikunci/ditutup oleh Admin PRP.`
}

export function canReview(
  status: string,
  action: string,
  notes: Record<string, string>,
): boolean {
  return (
    status === "Menunggu" &&
    (action === "Disetujui" ||
      (action === "Revisi" && Object.values(notes).some((note) => note.trim())))
  )
}

export function formatJakartaDate(dateStr?: string): string {
  if (!dateStr?.trim()) return ""
  const cutoff = deadlineCutoff(dateStr.trim())
  if (!Number.isFinite(cutoff)) return dateStr
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: deadlineTimezone,
  }).format(new Date(cutoff))
}

export function formatPeriodWindow(period?: Period): string {
  if (!period) return "Belum dijadwalkan"
  const start = period.startDate?.trim()
    ? formatJakartaDate(period.startDate)
    : ""
  const end = period.deadline?.trim() ? formatJakartaDate(period.deadline) : ""
  if (start && end) return `${start} s.d. ${end}`
  if (start) return `Mulai ${start}`
  if (end) return `s.d. ${end}, 23:59 WIB`
  return period.open ? "Dibuka (Tanpa Batas Waktu)" : "Belum dijadwalkan"
}

export function formatDeadlineSummary(
  period?: Period,
  now = Date.now(),
): string {
  const state = getPeriodState(period, now)
  const deadlineStr = period?.deadline?.trim() ?? ""
  if (deadlineStr && state.status !== "invalid" && state.deadlineAt !== null) {
    return `${formatJakartaDate(deadlineStr)}${state.canSubmit ? "" : " (Terkunci)"}`
  }
  if (state.status === "open") return "Tanpa batas tanggal"
  if (state.status === "upcoming") {
    const startStr = period?.startDate?.trim() ?? ""
    return startStr && state.startAt !== null
      ? `Dibuka ${formatJakartaDate(startStr)}`
      : "Belum dibuka"
  }
  if (state.status === "invalid") return "Jadwal tidak valid"
  return "Terkunci"
}

export function todayJakartaDateString(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: deadlineTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now))
  const year = parts.find((p) => p.type === "year")?.value ?? "2026"
  const month = parts.find((p) => p.type === "month")?.value ?? "01"
  const day = parts.find((p) => p.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

export function addDaysToDateString(baseDate: string, days: number): string {
  const parts = parseJakartaDateParts(baseDate)
  const anchor = parts
    ? Date.UTC(parts.year, parts.month - 1, parts.day)
    : Date.now()
  const target = new Date(anchor + days * 86_400_000)
  return target.toISOString().slice(0, 10)
}

export type DeadlineCardModel = {
  title: string
  headline: string
  countdownHighlight: string
  countdownSuffix: string
  progressPercent: number
  tone: "open" | "upcoming" | "expired" | "closed"
}

export function getDeadlineCardModel(
  period?: Period,
  now = Date.now(),
): DeadlineCardModel {
  const state = getPeriodState(period, now)
  const todayStr = todayJakartaDateString(now)
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`)
  const startStr = period?.startDate?.trim() ?? ""
  const deadlineStr = period?.deadline?.trim() ?? ""
  const startParts = parseJakartaDateParts(startStr)
  const deadlineParts = parseJakartaDateParts(deadlineStr)
  const startDayMs = startParts
    ? Date.UTC(startParts.year, startParts.month - 1, startParts.day)
    : null
  const deadlineDayMs = deadlineParts
    ? Date.UTC(deadlineParts.year, deadlineParts.month - 1, deadlineParts.day)
    : null
  const daysUntilDeadline =
    deadlineDayMs !== null
      ? Math.round((deadlineDayMs - todayMs) / 86_400_000)
      : null
  const daysUntilStart =
    startDayMs !== null ? Math.round((startDayMs - todayMs) / 86_400_000) : null

  if (state.status === "open") {
    if (deadlineStr && state.deadlineAt !== null && daysUntilDeadline !== null) {
      const progressPercent =
        state.startAt !== null && state.deadlineAt > state.startAt
          ? Math.min(
              96,
              Math.max(
                8,
                Math.round(
                  ((now - state.startAt) / (state.deadlineAt - state.startAt)) *
                    100,
                ),
              ),
            )
          : Math.min(
              96,
              Math.max(
                8,
                Math.round(
                  ((30 - Math.min(30, Math.max(0, daysUntilDeadline))) / 30) *
                    100,
                ),
              ),
            )

      return {
        title: "Batas pengumpulan",
        headline: formatJakartaDate(deadlineStr),
        countdownHighlight:
          daysUntilDeadline > 0 ? String(daysUntilDeadline) : "Hari ini",
        countdownSuffix:
          daysUntilDeadline > 0 ? "hari lagi" : "batas terakhir",
        progressPercent,
        tone: "open",
      }
    }

    return {
      title: "Batas pengumpulan",
      headline: "Terbuka",
      countdownHighlight: "Tanpa batas",
      countdownSuffix: "tanggal (WIB)",
      progressPercent: 100,
      tone: "open",
    }
  }

  if (state.status === "upcoming") {
    return {
      title: "Batas pengumpulan",
      headline:
        deadlineStr && state.deadlineAt !== null
          ? formatJakartaDate(deadlineStr)
          : formatJakartaDate(startStr) || "Belum dibuka",
      countdownHighlight:
        daysUntilStart !== null && daysUntilStart > 0
          ? String(daysUntilStart)
          : "Segera",
      countdownSuffix:
        daysUntilStart !== null && daysUntilStart > 0
          ? "hari lagi dibuka"
          : "dibuka",
      progressPercent: 0,
      tone: "upcoming",
    }
  }

  if (state.status === "expired") {
    const daysPassed =
      daysUntilDeadline !== null ? Math.max(0, Math.abs(daysUntilDeadline)) : 0
    return {
      title: "Batas pengumpulan",
      headline:
        deadlineStr && state.deadlineAt !== null
          ? formatJakartaDate(deadlineStr)
          : "Tenggat berakhir",
      countdownHighlight: daysPassed > 0 ? String(daysPassed) : "Berakhir",
      countdownSuffix: daysPassed > 0 ? "hari lewat tenggat" : "hari ini",
      progressPercent: 100,
      tone: "expired",
    }
  }

  if (state.status === "invalid") {
    return {
      title: "Batas pengumpulan",
      headline: "Jadwal tidak valid",
      countdownHighlight: "",
      countdownSuffix: "Perbaiki rentang di Admin",
      progressPercent: 0,
      tone: "closed",
    }
  }

  return {
    title: "Batas pengumpulan",
    headline:
      deadlineStr && deadlineDayMs !== null
        ? formatJakartaDate(deadlineStr)
        : "Belum dijadwalkan",
    countdownHighlight: "",
    countdownSuffix:
      state.status === "unscheduled"
        ? "Belum dibuka Admin PRP"
        : "Pengiriman ditutup",
    progressPercent: 0,
    tone: "closed",
  }
}
