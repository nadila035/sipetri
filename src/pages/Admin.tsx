import { Fragment, useEffect, useRef, useState } from "react"
import {
  unitOptions,
  reportingCoverage,
  matchesOrganization,
  parseSentAtTimestamp,
  resolveOrganization,
} from "../utils/organizations"

import { AnnualSourceSummary } from "../components/AnnualSourceSummary"
import { MonitoringOverview } from "../components/MonitoringOverview"
import { DetailModal } from "../components/DetailModal"

import {
  canReview,
  formatPeriodStatusTag,
  formatPeriodWindow,
  getDeadlineCardModel,
  getPeriodState,
} from "../utils/workflow"
import {
  formatReviewItemLocation,
  getReviewPrograms,
  getSasaranKinerjaReviewCriteria,
} from "../utils/review"
import {
  appendNotifications,
  buildPeriodNotification,
  createAppNotification,
  formatRecordUnitLabel,
} from "../utils/notifications"
import {
  exportArchiveMasterXlsx,
  exportArchiveRecapExcel,
  exportArchiveUnitZip,
} from "../utils/exportExcel"
import { formatBulanPelaksanaan, getTriwulanData } from "../utils/format"
import { useDialog } from "../utils/useDialog"

import {
  confirmNavigation,
  useConfirmableUnsavedChanges,
  useUnsavedChanges,
} from "../utils/useUnsavedChanges"

import { collectReportingYears, useReporting } from "../ReportingContext"
import { useAuth } from "../AuthContext"

import { Icon } from "../components/Icon"

import { PrintPreviewModal } from "../components/PrintPreviewModal"

import type {
  HistoryRecord,
  HistoryStatus,
  HistoryType,
  NotificationTargetScope,
  NotifyFn,
} from "../types"

import "../admin.css"

export const adminMenus = [
  "Dashboard Monitoring",
  "Verifikasi Laporan Triwulan",
  "Verifikasi Sasaran Kinerja",
  "Arsip dan Rekapitulasi",
  "Periode dan Tenggat Waktu",
]

export function Admin({
  active,
  notify,
  openRecordRequest,
  onSelectMenu,
  onOpenBroadcast,
}: {
  active: string
  notify: NotifyFn
  openRecordRequest?: { id: string; seq: number } | null
  onSelectMenu?: (label: string) => void
  onOpenBroadcast?: (scope?: NotificationTargetScope) => void
}) {
  const { data, setData } = useReporting()
  const { session } = useAuth()

  const [query, setQuery] = useState("")

  const [year, setYear] = useState("")

  const [quarter, setQuarter] = useState("")

  const [unit, setUnit] = useState("")

  const [status, setStatus] = useState("")

  const [docTypeTab, setDocTypeTab] = useState<"Semua" | HistoryType>("Semua")

  const [selectedId, setSelectedId] = useState("")

  const [notes, setNotes] = useState<Record<string, string>>({})

  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [reviewReturnTarget, setReviewReturnTarget] = useState<
    "detail" | "page"
  >("page")

  const [preview, setPreview] = useState<HistoryRecord | null>(null)
  const [detailRecord, setDetailRecord] = useState<HistoryRecord | null>(null)
  const [masterExportOpen, setMasterExportOpen] = useState(false)
  const masterExportRef = useRef<HTMLDivElement>(null)

  const [prevActive, setPrevActive] = useState(active)
  if (prevActive !== active) {
    setPrevActive(active)
    setSelectedId("")
    setDetailRecord(null)
    setNotes({})
    setActiveNoteIndex(null)
    setReviewReturnTarget("page")
    setMasterExportOpen(false)
  }

  useEffect(() => {
    if (!masterExportOpen) return
    const handleOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !masterExportRef.current?.contains(event.target)
      ) {
        setMasterExportOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMasterExportOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("keydown", handleKey)
    }
  }, [masterExportOpen])

  const [lastRecordSeq, setLastRecordSeq] = useState(0)
  if (openRecordRequest && openRecordRequest.seq !== lastRecordSeq) {
    setLastRecordSeq(openRecordRequest.seq)
    const targetRecord = data.records.find(
      (r) => r.id === openRecordRequest.id && r.status !== "Draf",
    )
    if (targetRecord) {
      setDetailRecord(null)
      setSelectedId(targetRecord.id)
      setNotes({})
      setActiveNoteIndex(null)
      setReviewReturnTarget("page")
    }
  }

  const allYears = collectReportingYears(data)
  const [newYearInput, setNewYearInput] = useState(() =>
    String(Math.max(...allYears.map(Number), Number(data.year)) + 1),
  )
  const [activeYearInput, setActiveYearInput] = useState(data.year)
  const [activeQuarterInput, setActiveQuarterInput] = useState(data.quarter)

  const [periodYear, setPeriodYear] = useState(data.year)

  type PeriodCardDraft = {
    startDate: string
    deadline: string
    open: boolean
  }

  const slotToDraft = (slot?: {
    startDate?: string
    deadline?: string
    open: boolean
  }): PeriodCardDraft => ({
    startDate: slot?.startDate ?? "",
    deadline: slot?.deadline ?? "",
    open: slot?.open ?? false,
  })

  const draftToPeriodObj = (draft: PeriodCardDraft) => ({
    startDate: draft.startDate,
    deadline: draft.deadline,
    open: draft.open,
  })

  const [periodDrafts, setPeriodDrafts] = useState<
    Record<string, PeriodCardDraft>
  >({})

  const getSlotDraft = (slotKey: string): PeriodCardDraft =>
    periodDrafts[slotKey] ?? slotToDraft(data.periods[slotKey])

  const isSlotDirty = (slotKey: string): boolean => {
    const draft = periodDrafts[slotKey]
    if (!draft) return false
    const saved = data.periods[slotKey] ?? {
      startDate: "",
      deadline: "",
      open: false,
    }
    return (
      draft.startDate !== (saved.startDate ?? "") ||
      draft.deadline !== saved.deadline ||
      draft.open !== saved.open
    )
  }

  const hasDirtyPeriodCards = Object.keys(periodDrafts).some(isSlotDirty)

  const selectPeriodYear = (nextYear: string) => {
    setPeriodDrafts({})
    setPeriodYear(nextYear)
  }

  const submittedRecords = data.records.filter((r) => r.status !== "Draf")

  const activeDetailRecord = detailRecord
    ? (submittedRecords.find((r) => r.id === detailRecord.id) ?? detailRecord)
    : null

  const selected = submittedRecords.find((r) => r.id === selectedId)
  const canEditReview = Boolean(
    selected &&
    selected.status === "Menunggu" &&
    active !== "Arsip dan Rekapitulasi",
  )
  const hasUnsavedReviewNotes =
    Boolean(selectedId) &&
    canEditReview &&
    Object.values(notes).some((note) => note.trim() !== "")

  useUnsavedChanges(hasDirtyPeriodCards)
  useConfirmableUnsavedChanges(
    hasUnsavedReviewNotes,
    "Catatan revisi belum dikirim. Tinggalkan halaman dan buang catatan?",
  )

  const confirmReviewDiscard = () =>
    !hasUnsavedReviewNotes ||
    window.confirm(
      "Catatan revisi belum dikirim. Tutup pemeriksaan dan buang catatan?",
    )

  const reviewPrograms = selected ? getReviewPrograms(selected) : []
  const totalSasaranCount = reviewPrograms.reduce(
    (sum, program) => sum + program.sasaranList.length,
    0,
  )

  const revisionNoteCount = Object.values(notes).filter((note) =>
    note.trim(),
  ).length

  useEffect(() => {
    if (activeNoteIndex !== null) {
      noteTextareaRef.current?.focus()
    }
  }, [activeNoteIndex])

  const resetReviewSelection = () => {
    setSelectedId("")
    setNotes({})
    setActiveNoteIndex(null)
    setReviewReturnTarget("page")
  }

  const closeReview = () => {
    if (!confirmReviewDiscard()) return
    resetReviewSelection()
  }

  const backFromReview = () => {
    if (!confirmReviewDiscard()) return
    if (reviewReturnTarget === "detail" && selected) {
      setDetailRecord(selected)
    }
    resetReviewSelection()
  }

  const openReviewModal = (
    record: HistoryRecord,
    returnTarget: "detail" | "page" = "page",
  ) => {
    if (!confirmReviewDiscard()) return
    setSelectedId(record.id)
    setNotes({})
    setActiveNoteIndex(null)
    setReviewReturnTarget(returnTarget)
  }

  const handleDialogEscape = () => {
    if (activeNoteIndex !== null) {
      setActiveNoteIndex(null)
      return
    }
    closeReview()
  }

  useDialog(!!selected, handleDialogEscape, ".admin-review-overlay")

  const effectiveQuarter =
    active === "Verifikasi Sasaran Kinerja" ? "" : quarter

  const records = submittedRecords.filter((r) => {
    const org = resolveOrganization(r)
    const searchable =
      `${r.title} ${r.id} ${r.unit} ${org?.parentUnit ?? ""} ${org?.subUnit ?? ""} ${r.author ?? ""}`.toLowerCase()
    return (
      (!year || r.period.includes(year)) &&
      (!effectiveQuarter ||
        r.period.startsWith(`Triwulan ${effectiveQuarter} ·`)) &&
      matchesOrganization(r, unit) &&
      (!status || r.status === status) &&
      searchable.includes(query.toLowerCase())
    )
  })

  const queue = records.filter((r) =>
    active === "Verifikasi Sasaran Kinerja"
      ? r.type === "Sasaran Kinerja"
      : active === "Verifikasi Laporan Triwulan"
        ? r.type === "Laporan Triwulan"
        : docTypeTab === "Semua" || r.type === docTypeTab,
  )

  const counts = (["Menunggu", "Disetujui", "Revisi"] as const).map(
    (label) => ({
      label,
      count: records.filter((r) => r.status === label).length,
    }),
  )

  const monitoringYear = year || data.year
  const monitoringQuarter = quarter || data.quarter
  const coverage = reportingCoverage(data.records, monitoringYear, monitoringQuarter, unit)
  const quarterLabels = ["I", "II", "III", "IV"]
  const statusPercentage = (count: number) =>
    Math.round((count / (records.length || 1)) * 100)

  const recentActivities = [...records]
    .sort((a, b) => parseSentAtTimestamp(b.sentAt) - parseSentAtTimestamp(a.sentAt))
    .slice(0, 4)

  const trendQuarterHasStarted = (index: number) =>
    Date.now() >= Date.UTC(Number(monitoringYear), index * 3, 1) - 7 * 3600_000
  const trendPeriods = quarterLabels.flatMap((periodQuarter, index) => {
    const result = reportingCoverage(data.records, monitoringYear, periodQuarter, unit)
    if (!trendQuarterHasStarted(index) && result.submitted === 0) return []
    return [{
      key: periodQuarter,
      quarter: periodQuarter,
      total: result.expected,
      submitted: result.submitted,
      percent: result.percent,
    }]
  })
  const trendBounds = { left: 44, right: 580, top: 18, bottom: 188 }
  const trendCoordinates = trendPeriods.map((point, index) => ({
    ...point,
    x: trendBounds.left +
      (quarterLabels.indexOf(point.quarter) / (quarterLabels.length - 1)) *
      (trendBounds.right - trendBounds.left),
    y:
      trendBounds.bottom -
      (point.percent / 100) * (trendBounds.bottom - trendBounds.top),
  }))
  const trendLinePath = trendCoordinates.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = trendCoordinates[index - 1]
    const middleX = (previous.x + point.x) / 2
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`
  }, "")
  const trendAreaPath = trendCoordinates.length > 1
    ? `${trendLinePath} L ${trendCoordinates[trendCoordinates.length - 1].x} ${trendBounds.bottom} L ${trendCoordinates[0].x} ${trendBounds.bottom} Z`
    : ""
  const trendComparisons = trendPeriods.filter((point) => point.total > 0)
  const trendChange =
    trendComparisons.length >= 2
      ? trendComparisons[trendComparisons.length - 1].percent -
      trendComparisons[trendComparisons.length - 2].percent
      : null
  const formatPercent = (value: number) =>
    `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1,
    }).format(value)}%`

  const periodYearSelection = year || data.year
  const periodQuarterSelection = quarter || data.quarter
  const activePeriod = `${periodYearSelection}-${periodQuarterSelection}`
  const activeDeadline = data.periods[activePeriod] ?? {
    startDate: "",
    deadline: "",
    open: false,
  }
  const deadlineModel = getDeadlineCardModel(activeDeadline)
  const annualPeriod = data.periods[`${periodYearSelection}-annual`] ?? {
    startDate: "",
    deadline: "",
    open: false,
  }
  const annualPeriodState = getPeriodState(annualPeriod)

  const decide = (action: HistoryStatus) => {
    if (!selected || selected.status !== "Menunggu") return

    if (!canReview(selected.status, action, notes))
      return notify(
        "Isi setidaknya satu catatan indikator sebelum meminta revisi.",
        "error",
      )

    if (action === "Revisi" && !Object.values(notes).some((n) => n.trim()))
      return notify(
        "Isi setidaknya satu catatan indikator sebelum meminta revisi.",
        "error",
      )

    const review = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: session?.displayName || "Admin PRP",
      action,
      notes: action === "Revisi" ? notes : {},
    }

    const noteCount = Object.values(review.notes).filter((n) => n.trim()).length
    const unitLabel = formatRecordUnitLabel(selected)
    const targetUnit =
      resolveOrganization(selected)?.subUnit || selected.subUnit || selected.unit
    const staffNotif = createAppNotification({
      recipient: "staff",
      category: action === "Revisi" ? "revision_requested" : "document_approved",
      title: selected.title,
      message:
        action === "Revisi"
          ? noteCount > 0
            ? `${noteCount} catatan indikator perlu diperbaiki`
            : "Periksa catatan indikator dari Admin PRP"
          : `${unitLabel} · ${selected.period} selesai diverifikasi`,
      actor: review.actor,
      createdAt: review.at,
      targetMenu: "Riwayat",
      recordId: selected.id,
      openRevision: action === "Revisi",
      unitLabel,
      periodLabel: selected.period,
      targetUnit,
    })

    setData((current) => ({
      ...current,
      records: current.records.map((r) =>
        r.id !== selected.id || r.status !== "Menunggu"
          ? r
          : {
            ...r,
            status: action,
            reviews: [...(r.reviews ?? []), review],
            items: r.items.map((item, i) => ({
              ...item,
              note: review.notes[String(i)]?.trim() || undefined,
              needsRevision: !!review.notes[String(i)]?.trim(),
            })),
          },
      ),
      notifications: appendNotifications(current.notifications, staffNotif),
    }))

    notify(`${selected.title}: ${action}.`)

    resetReviewSelection()
  }

  const openPeriodSettings = () => {
    if (onSelectMenu) {
      onSelectMenu("Periode dan Tenggat Waktu")
      return
    }
    const menu = document.querySelector<HTMLButtonElement>(
      '.side-nav button[aria-label="Periode dan Tenggat Waktu"]',
    )
    if (!menu) {
      notify("Menu Periode dan Tenggat Waktu tidak tersedia.")
      return
    }
    menu.click()
  }

  const openReminderCenter = (scope: NotificationTargetScope = "all") => {
    if (onOpenBroadcast) {
      onOpenBroadcast(scope)
      return
    }
    notify("Tombol siaran pengingat tersedia di bilah atas.")
  }

  const periodSlots = [
    {
      key: "annual",
      kicker: "TAHUNAN",
      title: "Sasaran Kinerja Tahunan",
      subtitle: "Januari - Desember",
      label: "Sasaran Kinerja Tahunan",
      isAnnual: true,
    },
    {
      key: "I",
      kicker: "TRIWULAN",
      title: "Triwulan I",
      subtitle: "Januari - Maret",
      label: "Triwulan I",
      isAnnual: false,
    },
    {
      key: "II",
      kicker: "TRIWULAN",
      title: "Triwulan II",
      subtitle: "April - Juni",
      label: "Triwulan II",
      isAnnual: false,
    },
    {
      key: "III",
      kicker: "TRIWULAN",
      title: "Triwulan III",
      subtitle: "Juli - September",
      label: "Triwulan III",
      isAnnual: false,
    },
    {
      key: "IV",
      kicker: "TRIWULAN",
      title: "Triwulan IV",
      subtitle: "Oktober - Desember",
      label: "Triwulan IV",
      isAnnual: false,
    },
  ]

  const updateSlotDraft = (
    slotKey: string,
    updater: (prev: PeriodCardDraft) => PeriodCardDraft,
  ) => {
    setPeriodDrafts((current) => {
      const prev = current[slotKey] ?? slotToDraft(data.periods[slotKey])
      return {
        ...current,
        [slotKey]: updater(prev),
      }
    })
  }

  const clearSlotDraft = (slotKey: string) => {
    setPeriodDrafts((current) => {
      if (!(slotKey in current)) return current
      const next = { ...current }
      delete next[slotKey]
      return next
    })
  }

  const handleCardToggleOpen = (
    slotKey: string,
    slotLabel: string,
    openNow: boolean,
  ) => {
    const draft = getSlotDraft(slotKey)
    let nextPeriod: { startDate: string; deadline: string; open: boolean }
    let feedbackMessage: string

    if (!openNow) {
      nextPeriod = {
        startDate: draft.startDate,
        deadline: draft.deadline,
        open: false,
      }
      feedbackMessage = `${slotLabel} (${periodYear}) dikunci untuk seluruh unit.`
    } else {
      const scheduledCandidate = {
        startDate: draft.startDate,
        deadline: draft.deadline,
        open: true,
      }
      const hasScheduleDates = Boolean(
        draft.startDate.trim() || draft.deadline.trim(),
      )
      const canSubmitOnSchedule =
        hasScheduleDates && getPeriodState(scheduledCandidate).canSubmit

      if (canSubmitOnSchedule) {
        nextPeriod = scheduledCandidate
        feedbackMessage = `${slotLabel} (${periodYear}) dibuka sesuai jadwal (${formatPeriodWindow(nextPeriod)}).`
      } else {
        if (
          hasScheduleDates &&
          isSlotDirty(slotKey) &&
          !window.confirm(
            `Draf tanggal pada ${slotLabel} (${periodYear}) berada di luar rentang aktif hari ini. Buka bebas tanpa tanggal dan hapus draf tanggal?`,
          )
        ) {
          return
        }
        nextPeriod = { startDate: "", deadline: "", open: true }
        feedbackMessage = `${slotLabel} (${periodYear}) dibuka bebas tanpa batas tanggal untuk seluruh unit.`
      }
    }

    setData((current) => {
      const periodNotif = buildPeriodNotification({
        previousPeriod: current.periods[slotKey],
        nextPeriod,
        slotLabel,
        year: periodYear,
        isAnnual: slotKey.endsWith("-annual"),
        actor: `${session?.displayName || "Admin PRP"} (Admin PRP)`,
      })
      return {
        ...current,
        periods: {
          ...current.periods,
          [slotKey]: nextPeriod,
        },
        notifications: periodNotif
          ? appendNotifications(current.notifications, periodNotif)
          : current.notifications,
      }
    })
    clearSlotDraft(slotKey)
    notify(feedbackMessage)
  }

  const handleCardDateChange = (
    slotKey: string,
    field: "startDate" | "deadline",
    value: string,
  ) => {
    updateSlotDraft(slotKey, (prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleCardSave = (
    e: React.FormEvent,
    slotKey: string,
    slotLabel: string,
  ) => {
    e.preventDefault()
    if (
      !/^\d{4}$/.test(periodYear) ||
      +periodYear < 2000 ||
      +periodYear > 2100
    ) {
      return notify("Tahun harus antara 2000 dan 2100.", "error")
    }
    const draft = getSlotDraft(slotKey)
    if (
      draft.startDate &&
      draft.deadline &&
      draft.startDate > draft.deadline
    ) {
      return notify(
        "Tanggal mulai tidak boleh lebih akhir daripada tenggat waktu.",
        "error",
      )
    }
    const nextPeriod = draftToPeriodObj(draft)
    const nextState = getPeriodState(nextPeriod)
    setData((current) => {
      const periodNotif = buildPeriodNotification({
        previousPeriod: current.periods[slotKey],
        nextPeriod,
        slotLabel,
        year: periodYear,
        isAnnual: slotKey.endsWith("-annual"),
        actor: `${session?.displayName || "Admin PRP"} (Admin PRP)`,
      })
      return {
        ...current,
        periods: {
          ...current.periods,
          [slotKey]: nextPeriod,
        },
        notifications: periodNotif
          ? appendNotifications(current.notifications, periodNotif)
          : current.notifications,
      }
    })
    clearSlotDraft(slotKey)
    notify(
      `Jadwal ${slotLabel} ${periodYear} tersimpan (${formatPeriodStatusTag(nextState.status)}).`,
    )
  }

  const handleAddNewYear = (e: React.FormEvent) => {
    e.preventDefault()
    const candidate = newYearInput.trim()
    if (
      !/^\d{4}$/.test(candidate) ||
      Number(candidate) < 2020 ||
      Number(candidate) > 2100
    ) {
      return notify("Masukkan tahun 4 digit yang valid (2020-2100).", "error")
    }
    if (allYears.includes(candidate)) {
      if (hasDirtyPeriodCards && !confirmNavigation()) return
      selectPeriodYear(candidate)
      return notify(
        `Tahun ${candidate} sudah tersedia. Menampilkan kartu jadwal tahun ${candidate}.`,
      )
    }
    if (hasDirtyPeriodCards && !confirmNavigation()) return
    setData((current) => {
      const nextPeriods = { ...current.periods }
      for (const slot of ["annual", "I", "II", "III", "IV"]) {
        const slotId = `${candidate}-${slot}`
        if (!nextPeriods[slotId]) {
          nextPeriods[slotId] = { startDate: "", deadline: "", open: false }
        }
      }
      const yearNotif = createAppNotification({
        recipient: "staff",
        category: "year_added",
        title: `Tahun Pelaporan ${candidate}`,
        message: `Sudah ditambahkan oleh Admin PRP; pengiriman mengikuti jadwal tiap periode.`,
        actor: `${session?.displayName || "Admin PRP"} (Admin PRP)`,
        targetMenu: "Dashboard",
        periodLabel: `Tahun ${candidate}`,
      })
      return {
        ...current,
        availableYears: Array.from(
          new Set([...(current.availableYears ?? []), candidate]),
        ).sort((a, b) => Number(b) - Number(a)),
        periods: nextPeriods,
        notifications: appendNotifications(current.notifications, yearNotif),
      }
    })
    selectPeriodYear(candidate)
    const highestYear = Math.max(...allYears.map(Number), Number(candidate))
    setNewYearInput(String(highestYear + 1))
    notify(
      `Tahun pelaporan ${candidate} ditambahkan. Data tahun lain tetap tersimpan; atur akses tiap periode di kartu bawah ini.`,
    )
  }

  const renderPeriodCard = (slot: (typeof periodSlots)[number]) => {
    const slotKey = `${periodYear}-${slot.key}`
    const savedPeriod = data.periods[slotKey] ?? {
      startDate: "",
      deadline: "",
      open: false,
    }
    const savedState = getPeriodState(savedPeriod)
    const draft = getSlotDraft(slotKey)
    const previewObj = draftToPeriodObj(draft)
    const previewState = getPeriodState(previewObj)
    const isDirty = isSlotDirty(slotKey)
    const isLiveOpen = savedState.canSubmit

    const statusLabel =
      previewState.status === "open"
        ? "Akses Dibuka"
        : previewState.status === "closed" ||
          previewState.status === "unscheduled"
          ? "Akses Dikunci"
          : formatPeriodStatusTag(previewState.status)

    return (
      <form
        key={slotKey}
        className={`panel admin-panel admin-slot-card${slot.isAnnual ? " is-annual-card" : ""}${previewState.status === "open" ? " is-active" : ""}${isDirty ? " is-dirty" : ""}`}
        onSubmit={(e) => handleCardSave(e, slotKey, slot.label)}
      >
        <div className="admin-slot-head">
          <div className="admin-slot-identity">
            <span className="admin-slot-kicker">{slot.kicker}</span>
            <div className="admin-slot-heading">
              <strong className="admin-slot-title">{slot.title}</strong>
              <span className="admin-slot-subtitle">{slot.subtitle}</span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isLiveOpen}
            aria-label={
              isLiveOpen
                ? `Kunci akses ${slot.label} ${periodYear}`
                : `Buka akses ${slot.label} ${periodYear}`
            }
            title={
              isLiveOpen
                ? "Klik untuk mengunci periode sekarang"
                : "Klik untuk langsung membuka periode sekarang"
            }
            className={`admin-switch${isLiveOpen ? " is-on" : ""}`}
            onClick={() =>
              handleCardToggleOpen(slotKey, slot.label, !isLiveOpen)
            }
          >
            <span className="admin-switch-thumb" aria-hidden="true" />
          </button>
        </div>

        <div className="admin-slot-body">
          <div className="admin-slot-status-row">
            <span className={`admin-slot-status is-${previewState.status}`}>
              <span className="admin-slot-dot" aria-hidden="true" />
              {statusLabel}
            </span>
            {isDirty && (
              <span className="admin-slot-dirty-tag">Belum disimpan</span>
            )}
          </div>

          <div className="admin-slot-dates">
            <label htmlFor={`period-start-${slotKey}`}>
              <span>
                Mulai Pengisian <small>00:00 WIB</small>
              </span>
              <input
                id={`period-start-${slotKey}`}
                name={`periodStart-${slotKey}`}
                type="date"
                value={draft.startDate}
                onChange={(e) =>
                  handleCardDateChange(slotKey, "startDate", e.target.value)
                }
              />
            </label>
            <label htmlFor={`period-deadline-${slotKey}`}>
              <span>
                Tenggat Waktu <small>23:59 WIB</small>
              </span>
              <input
                id={`period-deadline-${slotKey}`}
                name={`periodDeadline-${slotKey}`}
                type="date"
                value={draft.deadline}
                onChange={(e) =>
                  handleCardDateChange(slotKey, "deadline", e.target.value)
                }
              />
            </label>
          </div>

          {isDirty && (
            <div className="admin-slot-footer">
              <button className="admin-primary" type="submit">
                Simpan Jadwal
              </button>
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => clearSlotDraft(slotKey)}
              >
                Batal
              </button>
              {(draft.startDate || draft.deadline) && (
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={() =>
                    updateSlotDraft(slotKey, (prev) => ({
                      ...prev,
                      startDate: "",
                      deadline: "",
                    }))
                  }
                >
                  Kosongkan
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    )
  }

  const handleSaveActivePeriod = (e: React.FormEvent) => {
    e.preventDefault()
    const targetKey = `${activeYearInput}-${activeQuarterInput}`
    const targetState = getPeriodState(data.periods[targetKey])
    if (
      !targetState.canSubmit &&
      !window.confirm(
        `Periode Triwulan ${activeQuarterInput} ${activeYearInput} saat ini berstatus "${formatPeriodStatusTag(targetState.status)}" (staf belum dapat mengirim laporan baru). Tetap jadikan default beranda staf?`,
      )
    ) {
      return
    }
    setData((current) => {
      const changed =
        current.year !== activeYearInput ||
        current.quarter !== activeQuarterInput
      const activeNotif = changed
        ? createAppNotification({
          recipient: "staff",
          category: "default_period_changed",
          title: `Triwulan ${activeQuarterInput} · Tahun ${activeYearInput}`,
          message: `Periode default beranda staf diarahkan ke jadwal ini.`,
          actor: `${session?.displayName || "Admin PRP"} (Admin PRP)`,
          targetMenu: "Dashboard",
          periodLabel: `Triwulan ${activeQuarterInput} · ${activeYearInput}`,
        })
        : null
      return {
        ...current,
        year: activeYearInput,
        quarter: activeQuarterInput,
        availableYears: Array.from(
          new Set([...(current.availableYears ?? []), activeYearInput]),
        ).sort((a, b) => Number(b) - Number(a)),
        notifications: activeNotif
          ? appendNotifications(current.notifications, activeNotif)
          : current.notifications,
      }
    })
    notify(
      `Periode aktif diperbarui ke Triwulan ${activeQuarterInput} Tahun ${activeYearInput}.`,
    )
  }

  const filters = (
    <div className="admin-filters">
      <label htmlFor="admin-filter-query">
        Cari dokumen
        <input
          id="admin-filter-query"
          name="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Judul, ID, penanggung jawab, atau unit"
        />
      </label>
      <label htmlFor="admin-filter-year">
        Tahun
        <select
          id="admin-filter-year"
          name="year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">Semua tahun</option>
          {allYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {active !== "Verifikasi Sasaran Kinerja" && (
        <label htmlFor="admin-filter-quarter">
          Triwulan
          <select
            id="admin-filter-quarter"
            name="quarter"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          >
            <option value="">Semua periode</option>
            {["I", "II", "III", "IV"].map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </label>
      )}
      <label htmlFor="admin-filter-unit">
        Unit
        <select
          id="admin-filter-unit"
          name="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          <option value="">Semua unit</option>
          {Object.entries(unitOptions).map(([parent, children]) => (
            <optgroup key={parent} label={parent}>
              <option value={parent}>
                {parent}
                {children.length ? " (semua subunit)" : ""}
              </option>
              {children.map((child) => (
                <option key={child} value={child}>
                  {child}
                </option>
              ))}
            </optgroup>
          ))}
          {Array.from(
            new Set(
              submittedRecords
                .filter((r) => !resolveOrganization(r))
                .map((r) => r.unit),
            ),
          )
            .filter((name) => !Object.hasOwn(unitOptions, name))
            .map((name) => (
              <option key={name} value={name}>
                {name} (belum dipetakan)
              </option>
            ))}
        </select>
      </label>
      <label htmlFor="admin-filter-status">
        Status
        <select
          id="admin-filter-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Semua status</option>
          {counts.map((c) => (
            <option key={c.label}>{c.label}</option>
          ))}
        </select>
      </label>
    </div>
  )

  const pageHeaderMeta: Record<
    string,
    { kicker: string; title: string }
  > = {
    "Verifikasi Laporan Triwulan": {
      kicker: "VERIFIKASI DOKUMEN",
      title: "Daftar Laporan Triwulan",
    },
    "Verifikasi Sasaran Kinerja": {
      kicker: "VERIFIKASI DOKUMEN",
      title: "Daftar Sasaran Kinerja",
    },
    "Arsip dan Rekapitulasi": {
      kicker: "ARSIP & REKAPITULASI",
      title: "Daftar Dokumen & Rekap",
    },
    "Periode dan Tenggat Waktu": {
      kicker: "PENGATURAN JADWAL",
      title: `Periode & Tenggat ${periodYear}`,
    },
  }

  const queueCounts = {
    Menunggu: queue.filter((r) => r.status === "Menunggu").length,
    Disetujui: queue.filter((r) => r.status === "Disetujui").length,
    Revisi: queue.filter((r) => r.status === "Revisi").length,
  }

  const staffTargetPeriodState = getPeriodState(
    data.periods[`${activeYearInput}-${activeQuarterInput}`],
  )

  return (
    <>
      <section className="admin-page">
        {active !== "Dashboard Monitoring" && (
          <div className="report-heading">
            <div>
              <div className="report-kicker">
                {pageHeaderMeta[active]?.kicker ?? "ADMINISTRASI"}
              </div>
              <h1 className="report-title">
                {pageHeaderMeta[active]?.title ?? active}
              </h1>
            </div>
            {active === "Arsip dan Rekapitulasi" && (
              <div className="admin-master-export" ref={masterExportRef}>
                <button
                  type="button"
                  className="admin-master-export-trigger"
                  disabled={queue.length === 0}
                  aria-haspopup="menu"
                  aria-expanded={masterExportOpen}
                  onClick={() => setMasterExportOpen((prev) => !prev)}
                >
                  <Icon name="download" size={16} />
                  <span>Unduh Rekap Master</span>
                  <Icon name="chevronDown" size={14} />
                </button>
                {masterExportOpen && queue.length > 0 && (
                  <div
                    className="admin-master-export-menu"
                    role="menu"
                    aria-label="Pilih format unduhan rekap master"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-master-export-item"
                      onClick={() => {
                        setMasterExportOpen(false)
                        notify(
                          exportArchiveMasterXlsx(
                            queue,
                            year,
                            effectiveQuarter,
                          ),
                        )
                      }}
                    >
                      <strong>
                        <span>Rekap Master Excel</span>
                        <span className="sop-ext-pill">.xlsx</span>
                      </strong>
                      <small>
                        Olah data multi-sheet & ringkasan kepatuhan 42 unit
                      </small>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-master-export-item"
                      onClick={() => {
                        setMasterExportOpen(false)
                        notify(
                          exportArchiveUnitZip(queue, year, effectiveQuarter),
                        )
                      }}
                    >
                      <strong>
                        <span>Arsip Paket Unit</span>
                        <span className="sop-ext-pill">.zip</span>
                      </strong>
                      <small>
                        Simpan dokumen terpisah dalam folder per unit kerja
                      </small>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="admin-master-export-item"
                      onClick={() => {
                        setMasterExportOpen(false)
                        notify(
                          exportArchiveRecapExcel(
                            queue,
                            year,
                            effectiveQuarter,
                          ),
                        )
                      }}
                    >
                      <strong>
                        <span>Ringkasan Daftar Dokumen</span>
                        <span className="sop-ext-pill">.csv</span>
                      </strong>
                      <small>
                        Tabel cepat daftar status, waktu kirim, & kelengkapan
                      </small>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {active === "Periode dan Tenggat Waktu" ? (
          <div className="admin-period-stack">
            <div className="admin-period-topbar">
              <section className="panel admin-panel admin-period-panel">
                <div className="admin-period-panel-head">
                  <span
                    className="admin-kpi-icon admin-kpi-icon-blue"
                    aria-hidden="true"
                  >
                    <Icon name="calendar" size={18} />
                  </span>
                  <div>
                    <h2>Tahun Pelaporan</h2>
                    <p>Pilih atau tambahkan tahun jadwal yang dikelola.</p>
                  </div>
                </div>
                <div className="admin-filters">
                  <label htmlFor="admin-period-year">
                    Kelola tahun
                    <select
                      id="admin-period-year"
                      name="periodYear"
                      value={periodYear}
                      onChange={(e) => {
                        if (!hasDirtyPeriodCards || confirmNavigation()) {
                          selectPeriodYear(e.target.value)
                        }
                      }}
                    >
                      {allYears.map((y) => (
                        <option key={y} value={y}>
                          Tahun {y}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <form className="admin-year-form" onSubmit={handleAddNewYear}>
                  <label htmlFor="admin-new-year">
                    Tambah tahun baru (2020-2100)
                    <div className="admin-inline-form">
                      <input
                        id="admin-new-year"
                        name="newYearInput"
                        type="number"
                        min="2020"
                        max="2100"
                        value={newYearInput}
                        onChange={(e) => setNewYearInput(e.target.value)}
                        aria-label="Tahun pelaporan baru"
                      />
                      <button className="admin-secondary-btn" type="submit">
                        + Buat Tahun Baru
                      </button>
                    </div>
                  </label>
                </form>
              </section>

              <section className="panel admin-panel admin-period-panel">
                <div className="admin-period-panel-head">
                  <span
                    className="admin-kpi-icon admin-kpi-icon-green"
                    aria-hidden="true"
                  >
                    <Icon name="clock" size={18} />
                  </span>
                  <div>
                    <h2>Periode Default Beranda Staf</h2>
                    <p>
                      Aktif saat ini:{" "}
                      <strong>
                        Triwulan {data.quarter} · {data.year}
                      </strong>
                      .
                    </p>
                  </div>
                </div>
                <form
                  className="admin-year-form"
                  onSubmit={handleSaveActivePeriod}
                >
                  <div className="admin-filters">
                    <label htmlFor="admin-default-year">
                      Tahun beranda staf
                      <select
                        id="admin-default-year"
                        name="activeYearInput"
                        value={activeYearInput}
                        onChange={(e) => setActiveYearInput(e.target.value)}
                      >
                        {allYears.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor="admin-default-quarter">
                      Triwulan beranda staf
                      <select
                        id="admin-default-quarter"
                        name="activeQuarterInput"
                        value={activeQuarterInput}
                        onChange={(e) => setActiveQuarterInput(e.target.value)}
                      >
                        {["I", "II", "III", "IV"].map((q) => (
                          <option key={q} value={q}>
                            Triwulan {q}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="admin-hint">
                    Status periode pilihan:{" "}
                    <strong>
                      {formatPeriodStatusTag(staffTargetPeriodState.status)}
                    </strong>
                    .
                  </p>
                  <div className="admin-period-form-actions">
                    <button className="admin-primary" type="submit">
                      Terapkan ke Beranda Staf
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <div className="admin-period-section-head">
              <div>
                <h2>Jadwal Periode Tahun {periodYear}</h2>
                <p>Atur akses pengisian dan rentang tanggal tiap periode.</p>
              </div>
            </div>

            <div className="admin-access-callout" role="note">
              <span className="admin-access-callout-icon" aria-hidden="true">
                <Icon name="help" size={17} />
              </span>
              <div>
                <strong>Kontrol akses pengisian</strong>
                <p>
                  Staf hanya dapat mengisi laporan pada periode yang berstatus
                  Dibuka dan sebelum tenggat berakhir.
                </p>
              </div>
            </div>

            {renderPeriodCard(periodSlots[0])}

            <div className="admin-period-card-grid">
              {periodSlots.slice(1).map(renderPeriodCard)}
            </div>
          </div>
        ) : (
          <>
            {active === "Dashboard Monitoring" ? (
              <>
                <section className="welcome admin-welcome">
                  <div className="welcome-copy">
                    <div className="eyebrow">RINGKASAN INSTITUSI</div>
                    <h1 className="welcome-title">
                      Selamat datang, Administrator
                    </h1>
                    <p>Pantau kelengkapan pelaporan dan tenggat seluruh unit.</p>
                    <button type="button" onClick={openPeriodSettings}>
                      Atur periode & tenggat <Icon name="arrow" size={18} />
                    </button>
                  </div>
                  <div className="deadline-card admin-period-card">
                    <div className="deadline-top">
                      <span className="deadline-icon">
                        <Icon name="clock" size={16} />
                      </span>
                      <span>
                        {deadlineModel.title} · TW {periodQuarterSelection}{" "}
                        {periodYearSelection}
                      </span>
                    </div>
                    <strong>{deadlineModel.headline}</strong>
                    <div className="countdown">
                      {deadlineModel.countdownHighlight ? (
                        <>
                          <span>{deadlineModel.countdownHighlight}</span>{" "}
                          {deadlineModel.countdownSuffix}
                        </>
                      ) : (
                        deadlineModel.countdownSuffix
                      )}
                      {" · "}Sasaran {periodYearSelection}:{" "}
                      {formatPeriodStatusTag(annualPeriodState.status)}
                    </div>
                    <div
                      className={`mini-progress${deadlineModel.tone === "expired" ? " is-expired" : ""
                        }`}
                      aria-hidden="true"
                    >
                      <i style={{ width: `${deadlineModel.progressPercent}%` }} />
                    </div>
                  </div>
                </section>
                <div className="admin-filter-card">{filters}</div>
                <section className="panel admin-panel admin-coverage">
                  <h2 className="admin-card-title">Cakupan Pelaporan Unit</h2>
                  <p>
                    Triwulan {monitoringQuarter} · {monitoringYear} · Cakupan{" "}
                    {formatPercent(coverage.percent)}
                  </p>
                  <div className="admin-risk-metrics">
                    <article>
                      <strong>{coverage.expected}</strong>
                      <span>Wajib Lapor</span>
                    </article>
                    <article>
                      <strong>{coverage.submitted}</strong>
                      <span>Sudah Mengirim</span>
                    </article>
                    <article>
                      <strong>{coverage.missing}</strong>
                      <span>Belum Melapor</span>
                    </article>
                    <article>
                      <strong>{coverage.approved}</strong>
                      <span>Pelapor Disetujui</span>
                    </article>
                  </div>
                  {coverage.unmapped > 0 && (
                    <p role="status">
                      {coverage.unmapped} dokumen belum cocok dengan master unit.
                    </p>
                  )}
                </section>
                <div className="admin-kpis">
                  <article className="panel kpi-card admin-kpi-card">
                    <span className="action-icon admin-kpi-icon admin-kpi-icon-blue">
                      <Icon name="report" size={19} />
                    </span>
                    <div className="admin-kpi-copy">
                      <span className="kpi-label admin-kpi-label">
                        Total Dokumen
                      </span>
                      <strong>{records.length}</strong>
                      <small>Sesuai filter</small>
                    </div>
                  </article>
                  {counts.map((c) => (
                    <article
                      className="panel kpi-card admin-kpi-card"
                      key={c.label}
                    >
                      <span
                        className={`action-icon admin-kpi-icon ${c.label === "Menunggu"
                          ? "admin-kpi-icon-amber"
                          : c.label === "Disetujui"
                            ? "admin-kpi-icon-green"
                            : "admin-kpi-icon-red"
                          }`}
                      >
                        {c.label === "Menunggu" ? (
                          <Icon name="clock" size={19} />
                        ) : c.label === "Disetujui" ? (
                          <Icon name="check" size={19} />
                        ) : (
                          <span aria-hidden="true">!</span>
                        )}
                      </span>
                      <div className="admin-kpi-copy">
                        <span className="kpi-label admin-kpi-label">
                          {c.label}
                        </span>
                        <strong>{c.count}</strong>
                        <small
                          className={
                            c.label === "Disetujui"
                              ? "admin-kpi-note-green"
                              : c.label === "Revisi"
                                ? "admin-kpi-note-red"
                                : c.label === "Menunggu"
                                  ? "admin-kpi-note-amber"
                                  : ""
                          }
                        >
                          {c.label === "Menunggu"
                            ? "Menunggu verifikasi"
                            : `${statusPercentage(c.count)}% dari total`}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
                <MonitoringOverview
                  records={data.records}
                  year={monitoringYear}
                  quarter={monitoringQuarter}
                  unit={unit}
                  periods={data.periods}
                  onReview={openReviewModal}
                  onRemindScope={openReminderCenter}
                />
                <div className="admin-insight-grid">
                  <section className="panel admin-panel admin-trend">
                    <div className="admin-section-heading">
                      <div>
                        <h2 className="admin-card-title">
                          Tren Cakupan Pelaporan
                        </h2>
                        <p className="admin-card-subtitle">
                          Tahun {monitoringYear}
                        </p>
                      </div>
                      <span
                        className={`admin-trend-change ${trendChange === null
                          ? "is-neutral"
                          : trendChange >= 0
                            ? "is-positive"
                            : "is-negative"
                          }`}
                      >
                        {trendChange === null
                          ? "Belum cukup periode"
                          : `${trendChange >= 0 ? "+" : "-"
                          }${new Intl.NumberFormat("id-ID", {
                            maximumFractionDigits: 1,
                          }).format(Math.abs(trendChange))} poin persentase`}
                      </span>
                    </div>
                    <div className="admin-trend-scroll">
                      <svg
                        className="admin-trend-svg"
                        viewBox="0 0 640 240"
                        role="img"
                        aria-label="Persentase cakupan pelapor per triwulan"
                      >
                        <defs>
                          <linearGradient
                            id="admin-trend-area"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#2c67d3"
                              stopOpacity="0.24"
                            />
                            <stop
                              offset="100%"
                              stopColor="#2c67d3"
                              stopOpacity="0.02"
                            />
                          </linearGradient>
                        </defs>
                        {[100, 75, 50, 25, 0].map((tick) => {
                          const y =
                            trendBounds.bottom -
                            (tick / 100) *
                            (trendBounds.bottom - trendBounds.top)
                          return (
                            <g key={tick}>
                              <line
                                className="admin-trend-gridline"
                                x1={trendBounds.left}
                                x2={trendBounds.right}
                                y1={y}
                                y2={y}
                              />
                              <text
                                className="admin-trend-y-label"
                                x="4"
                                y={y + 3}
                              >
                                {tick}%
                              </text>
                            </g>
                          )
                        })}
                        {trendAreaPath && (
                          <path
                            d={trendAreaPath}
                            fill="url(#admin-trend-area)"
                          />
                        )}
                        {trendLinePath && (
                          <path
                            className="admin-trend-line"
                            d={trendLinePath}
                          />
                        )}
                        {trendCoordinates.map((point) => (
                          <g key={point.key}>
                            <title>
                              {`TW ${point.quarter}: ${formatPercent(point.percent)} (${point.submitted} pelapor mengirim dari ${point.total} wajib lapor)`}
                            </title>
                            <circle
                              className="admin-trend-point"
                              cx={point.x}
                              cy={point.y}
                              r="5"
                            />
                          </g>
                        ))}
                        {quarterLabels.map((label, index) => {
                          const plotted = trendCoordinates.some(
                            (point) => point.quarter === label,
                          )
                          const x = trendBounds.left +
                            (index / (quarterLabels.length - 1)) *
                            (trendBounds.right - trendBounds.left)
                          return (
                            <text
                              className="admin-trend-x-label"
                              key={label}
                              x={x}
                              y="218"
                            >
                              {!plotted && !trendQuarterHasStarted(index)
                                ? "Belum berjalan"
                                : `TW ${label}`}
                            </text>
                          )
                        })}
                      </svg>
                    </div>
                    {!trendCoordinates.length && (
                      <p className="admin-trend-empty">
                        Belum ada laporan triwulan sesuai filter.
                      </p>
                    )}
                  </section>
                  <section className="panel admin-panel admin-activity">
                    <div className="admin-section-heading">
                      <div>
                        <h2 className="admin-card-title">Dokumen Terbaru</h2>
                        <p className="admin-card-subtitle">
                          Kiriman unit terbaru.
                        </p>
                      </div>
                    </div>
                    {recentActivities.length ? (
                      <ol className="admin-activity-list">
                        {recentActivities.map((record) => {
                          const org = resolveOrganization(record)
                          const unitDisplay = org
                            ? `${org.parentUnit} · ${org.subUnit}`
                            : record.unit
                          return (
                            <li className="admin-recent-row" key={record.id}>
                              <span
                                className={`doc-icon ${record.type === "Laporan Triwulan"
                                  ? "blue"
                                  : "violet"
                                  }`}
                              >
                                <Icon
                                  name={
                                    record.type === "Laporan Triwulan"
                                      ? "report"
                                      : "target"
                                  }
                                  size={17}
                                />
                              </span>
                              <div className="admin-activity-copy">
                                <strong>{record.title}</strong>
                                <p>
                                  {unitDisplay} · {record.period}
                                </p>
                                <time>{record.sentAt}</time>
                              </div>
                              <span
                                className={`status-chip ${record.status.toLowerCase()}`}
                              >
                                {record.status}
                              </span>
                              <button
                                type="button"
                                className="admin-recent-action"
                                onClick={() => openReviewModal(record)}
                              >
                                {record.status === "Menunggu"
                                  ? "Periksa"
                                  : "Detail"}
                              </button>
                            </li>
                          )
                        })}
                      </ol>
                    ) : (
                      <p>Belum ada dokumen sesuai filter.</p>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <>
                <div className="history-stats">
                  <div>
                    <span className="stat-icon all">
                      <Icon name="history" size={19} />
                    </span>
                    <p>
                      Total Dokumen<strong>{queue.length}</strong>
                    </p>
                  </div>
                  <div>
                    <span className="stat-icon waiting">
                      <Icon name="clock" size={19} />
                    </span>
                    <p>
                      Menunggu<strong>{queueCounts.Menunggu}</strong>
                    </p>
                  </div>
                  <div>
                    <span className="stat-icon approved">
                      <Icon name="check" size={19} />
                    </span>
                    <p>
                      Disetujui<strong>{queueCounts.Disetujui}</strong>
                    </p>
                  </div>
                  <div>
                    <span className="stat-icon revision">!</span>
                    <p>
                      Perlu Revisi<strong>{queueCounts.Revisi}</strong>
                    </p>
                  </div>
                </div>

                <section className="panel admin-panel history-panel admin-queue-panel">
                  {active === "Arsip dan Rekapitulasi" && (
                    <div className="history-toolbar admin-archive-toolbar">
                      <div
                        className="history-tabs"
                        role="tablist"
                        aria-label="Jenis dokumen arsip"
                      >
                        {(
                          ["Semua", "Laporan Triwulan", "Sasaran Kinerja"] as const
                        ).map((tabOption) => (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={docTypeTab === tabOption}
                            className={docTypeTab === tabOption ? "active" : ""}
                            key={tabOption}
                            onClick={() => setDocTypeTab(tabOption)}
                          >
                            {tabOption}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="admin-queue-filters">{filters}</div>

                  {queue.length ? (
                    <div className="admin-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Dokumen</th>
                            <th>Unit Pelapor</th>
                            <th>Periode & Dikirim</th>
                            <th>Status</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queue.map((r) => {
                            const org = resolveOrganization(r)
                            const unitLabel = org
                              ? `${org.parentUnit} · ${org.subUnit}`
                              : r.unit
                            return (
                              <tr key={r.id}>
                                <td>
                                  <div className="document-cell">
                                    <span
                                      className={
                                        r.type === "Laporan Triwulan"
                                          ? "doc-icon blue"
                                          : "doc-icon violet"
                                      }
                                    >
                                      <Icon
                                        name={
                                          r.type === "Laporan Triwulan"
                                            ? "report"
                                            : "target"
                                        }
                                        size={18}
                                      />
                                    </span>
                                    <p>
                                      <strong>{r.title}</strong>
                                      <span>
                                        {r.id}
                                        {r.author ? ` · ${r.author}` : ""}
                                      </span>
                                    </p>
                                  </div>
                                </td>
                                <td>
                                  <strong className="admin-unit-main">
                                    {org ? org.subUnit : r.unit}
                                  </strong>
                                  {org && org.parentUnit !== org.subUnit && (
                                    <small className="admin-unit-parent">
                                      {org.parentUnit}
                                    </small>
                                  )}
                                  {!org && (
                                    <small className="admin-unit-parent">
                                      {unitLabel}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <strong>{r.period}</strong>
                                  <small>{r.sentAt}</small>
                                </td>
                                <td>
                                  <span
                                    className={`status-chip ${r.status.toLowerCase()}`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td>
                                  <div className="history-actions admin-table-actions">
                                    {active === "Verifikasi Laporan Triwulan" ||
                                      active === "Verifikasi Sasaran Kinerja" ? (
                                      <button
                                        type="button"
                                        onClick={() => setDetailRecord(r)}
                                      >
                                        Lihat Detail
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className={
                                            active !== "Arsip dan Rekapitulasi" &&
                                              r.status === "Menunggu"
                                              ? "admin-action-primary"
                                              : ""
                                          }
                                          onClick={() => openReviewModal(r)}
                                        >
                                          {active === "Arsip dan Rekapitulasi"
                                            ? "Lihat detail"
                                            : r.status === "Menunggu"
                                              ? "Periksa"
                                              : "Lihat detail"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPreview(r)}
                                        >
                                          Pratinjau
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p role="status">
                      Tidak ada dokumen sesuai filter. Ubah filter atau kirim
                      dokumen dari menu staf.
                    </p>
                  )}
                </section>
              </>
            )}
            {selected &&
              (() => {
                const savedRevisionTotal = selected.items.filter(
                  (item) => item.needsRevision || item.note?.trim(),
                ).length
                const backLabel =
                  reviewReturnTarget === "detail"
                    ? "Kembali ke detail dokumen"
                    : "Kembali ke halaman sebelumnya"
                const activeNoteItem =
                  activeNoteIndex !== null ? selected.items[activeNoteIndex] : undefined

                const getCellState = (
                  itemIndex: number,
                  extraNoteIndexes?: number[],
                ) => {
                  const item = itemIndex >= 0 ? selected.items[itemIndex] : undefined
                  const extraSavedNote = extraNoteIndexes
                    ?.map((idx) => selected.items[idx]?.note?.trim())
                    .find(Boolean)
                  const savedNote = item?.note?.trim() || extraSavedNote || ""
                  const draftNote =
                    itemIndex >= 0 ? (notes[String(itemIndex)] ?? "").trim() : ""
                  const hasSavedRevision = Boolean(item?.needsRevision || savedNote)
                  const isSelectedCell =
                    canEditReview &&
                    itemIndex >= 0 &&
                    Boolean(item) &&
                    activeNoteIndex === itemIndex
                  const isFlagged = canEditReview
                    ? Boolean(draftNote)
                    : hasSavedRevision

                  return {
                    item,
                    savedNote,
                    draftNote,
                    isSelectedCell,
                    isFlagged,
                    tdStateClass: [
                      isFlagged && "is-flagged",
                      isSelectedCell && "is-editing-note",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  }
                }

                const renderReviewCell = (
                  itemIndex: number,
                  displayValue: string,
                  label: string,
                  options?: {
                    isLink?: boolean
                    extraNoteIndexes?: number[]
                    centerText?: boolean
                  },
                ) => {
                  const state = getCellState(itemIndex, options?.extraNoteIndexes)
                  const canComment =
                    canEditReview && itemIndex >= 0 && Boolean(state.item)
                  const trimmedVal = displayValue.trim()
                  const isUrl =
                    Boolean(options?.isLink) && /^https?:\/\/\S+$/i.test(trimmedVal)

                  return (
                    <div
                      className={`admin-review-cell${options?.centerText ? " is-centered" : ""
                        }`}
                    >
                      <div className="admin-review-cell-main">
                        {isUrl ? (
                          <a
                            href={trimmedVal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-evidence-link"
                          >
                            {trimmedVal}
                          </a>
                        ) : (
                          <p>{trimmedVal || "-"}</p>
                        )}
                        {canComment && (
                          <button
                            type="button"
                            className={[
                              "admin-cell-note-btn",
                              state.draftNote && "has-note",
                              state.isSelectedCell && "is-editing",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={
                              state.draftNote
                                ? `Ubah catatan revisi untuk ${label}`
                                : `Tambah catatan revisi untuk ${label}`
                            }
                            title={
                              state.draftNote
                                ? "Ubah catatan revisi"
                                : "Beri catatan revisi"
                            }
                            aria-pressed={state.isSelectedCell}
                            onClick={() =>
                              setActiveNoteIndex((current) =>
                                current === itemIndex ? null : itemIndex,
                              )
                            }
                          >
                            <Icon name="note" size={14} />
                          </button>
                        )}
                      </div>
                      {canEditReview && state.draftNote ? (
                        <button
                          type="button"
                          className="admin-review-cell-note"
                          onClick={() => setActiveNoteIndex(itemIndex)}
                        >
                          <strong>Catatan:</strong>
                          <span>{state.draftNote}</span>
                        </button>
                      ) : canEditReview && state.savedNote ? (
                        <div className="admin-review-cell-prior">
                          <strong>Catatan sebelumnya:</strong>
                          <span>{state.savedNote}</span>
                        </div>
                      ) : !canEditReview && state.savedNote ? (
                        <div className="cell-note admin-review-cell-saved">
                          <strong>Catatan:</strong>
                          <span>{state.savedNote}</span>
                        </div>
                      ) : null}
                    </div>
                  )
                }

                const renderTargetsTable = () => {
                  const criteriaSlots = getSasaranKinerjaReviewCriteria(selected)
                  return (
                    <div className="admin-review-table-wrap target-table-wrap">
                      <table className="detail-target-table admin-review-target-table">
                        <colgroup>
                          <col style={{ width: "50px" }} />
                          <col style={{ width: "21%" }} />
                          <col style={{ width: "50px" }} />
                          <col style={{ width: "23%" }} />
                          <col style={{ width: "25%" }} />
                          <col style={{ width: "15%" }} />
                          <col style={{ width: "16%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th
                              style={{
                                width: "50px",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                              }}
                            >
                              NO
                            </th>
                            <th>STRATEGI</th>
                            <th colSpan={2} style={{ textAlign: "center" }}>
                              PROGRAM KERJA
                            </th>
                            <th>SASARAN</th>
                            <th style={{ textAlign: "center" }}>
                              BULAN PELAKSANAAN PROGRAM KERJA
                            </th>
                            <th>KETERANGAN</th>
                          </tr>
                          <tr className="subhead-number-row">
                            <th style={{ textAlign: "center" }}>1</th>
                            <th style={{ textAlign: "center" }}>2</th>
                            <th style={{ textAlign: "center" }}>3</th>
                            <th style={{ textAlign: "center" }}>4</th>
                            <th style={{ textAlign: "center" }}>5</th>
                            <th style={{ textAlign: "center" }}>6</th>
                            <th style={{ textAlign: "center" }}>7</th>
                          </tr>
                        </thead>
                        <tbody>
                          {criteriaSlots.map((crit, cIdx) => {
                            const critState = getCellState(crit.critItemIdx)
                            const critVal =
                              critState.item?.value ?? crit.name ?? "-"
                            return (
                              <Fragment key={crit.id}>
                                <tr className="criteria-section-row">
                                  <td className="criteria-num-cell">{cIdx + 1}</td>
                                  <td
                                    colSpan={6}
                                    className={[
                                      "criteria-title-cell",
                                      critState.tdStateClass,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    {renderReviewCell(
                                      crit.critItemIdx,
                                      critVal,
                                      `Kriteria ${cIdx + 1}`,
                                    )}
                                  </td>
                                </tr>
                                {crit.stratSlots.map((strat, sIdx) => {
                                  const stratNum = `${cIdx + 1}.${sIdx + 1}`
                                  const stratState = getCellState(
                                    strat.stratItemIdx,
                                  )
                                  const stratVal =
                                    stratState.item?.value ?? strat.name ?? "-"
                                  const totalStratRows = strat.programSlots.reduce(
                                    (acc, p) =>
                                      acc + Math.max(1, p.sasaranSlots.length),
                                    0,
                                  )

                                  return strat.programSlots.map((prog, pIdx) => {
                                    const progNum = `${stratNum}.${pIdx + 1}`
                                    const progState = getCellState(
                                      prog.progItemIdx,
                                    )
                                    const progVal =
                                      progState.item?.value ?? prog.name ?? "-"
                                    const rows = prog.sasaranSlots.length
                                      ? prog.sasaranSlots
                                      : [
                                        {
                                          id: `${prog.id}-empty`,
                                          sasaran: "-",
                                          bulanMulai: "-",
                                          bulanSelesai: "",
                                          keterangan: "-",
                                          sasaranItemIdx: -1,
                                          bulanItemIdx: -1,
                                          keteranganItemIdx: -1,
                                        },
                                      ]
                                    const progRows = rows.length

                                    return rows.map((sas, sasIdx) => {
                                      const isFirstSasOfProg = sasIdx === 0
                                      const isFirstProgOfStrat =
                                        pIdx === 0 && isFirstSasOfProg
                                      const sasState = getCellState(
                                        sas.sasaranItemIdx,
                                      )
                                      const bulanState = getCellState(
                                        sas.bulanItemIdx,
                                      )
                                      const ketState = getCellState(
                                        sas.keteranganItemIdx,
                                      )
                                      const sasVal =
                                        sasState.item?.value ?? sas.sasaran
                                      const bulanVal =
                                        bulanState.item?.value ??
                                        formatBulanPelaksanaan(
                                          sas.bulanMulai,
                                          sas.bulanSelesai,
                                        )
                                      const ketVal =
                                        ketState.item?.value ?? sas.keterangan

                                      return (
                                        <tr key={`${prog.id}-${sas.id}`}>
                                          {isFirstProgOfStrat && (
                                            <>
                                              <td
                                                rowSpan={totalStratRows}
                                                className="admin-review-num-cell"
                                              >
                                                {stratNum}
                                              </td>
                                              <td
                                                rowSpan={totalStratRows}
                                                className={stratState.tdStateClass}
                                              >
                                                {renderReviewCell(
                                                  strat.stratItemIdx,
                                                  stratVal,
                                                  `Strategi ${stratNum}`,
                                                )}
                                              </td>
                                            </>
                                          )}
                                          {isFirstSasOfProg && (
                                            <>
                                              <td
                                                rowSpan={progRows}
                                                className="admin-review-num-cell"
                                              >
                                                {progNum}
                                              </td>
                                              <td
                                                rowSpan={progRows}
                                                className={progState.tdStateClass}
                                              >
                                                {renderReviewCell(
                                                  prog.progItemIdx,
                                                  progVal,
                                                  `Program Kerja ${progNum}`,
                                                )}
                                              </td>
                                            </>
                                          )}
                                          <td className={sasState.tdStateClass}>
                                            {renderReviewCell(
                                              sas.sasaranItemIdx,
                                              sasVal,
                                              `Sasaran ${progNum}.${sasIdx + 1}`,
                                            )}
                                          </td>
                                          <td className={bulanState.tdStateClass}>
                                            {renderReviewCell(
                                              sas.bulanItemIdx,
                                              bulanVal,
                                              `Bulan Pelaksanaan ${progNum}.${sasIdx + 1}`,
                                            )}
                                          </td>
                                          <td className={ketState.tdStateClass}>
                                            {renderReviewCell(
                                              sas.keteranganItemIdx,
                                              ketVal,
                                              `Keterangan ${progNum}.${sasIdx + 1}`,
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })
                                  })
                                })}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }

                const renderTriwulanTable = () => {
                  const triwulanPrograms = getTriwulanData(selected)
                  return (
                    <div className="admin-review-table-wrap target-table-wrap">
                      <table className="detail-triwulan-table admin-review-triwulan-table">
                        <colgroup>
                          <col style={{ width: "46px" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "6%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "9%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th
                              className="sticky-no"
                              style={{
                                width: "46px",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                              }}
                            >
                              NO
                            </th>
                            <th className="sticky-program">PROGRAM KERJA</th>
                            <th>SASARAN</th>
                            <th style={{ textAlign: "center" }}>
                              BULAN PELAKSANAAN PROGRAM KERJA
                            </th>
                            <th>TAHAP PELAKSANAAN (URAIAN)</th>
                            <th>REALISASI PELAKSANAAN (URAIAN)</th>
                            <th style={{ textAlign: "center" }}>
                              REALISASI PELAKSANAAN (%)
                            </th>
                            <th>KENDALA</th>
                            <th>RENCANA PENYELESAIAN KENDALA</th>
                            <th>WAKTU PENYELESAIAN KENDALA</th>
                            <th>KETERANGAN</th>
                            <th>LINK EVIDENCE</th>
                          </tr>
                          <tr className="subhead-number-row">
                            <th className="sticky-no" style={{ textAlign: "center" }}>
                              1
                            </th>
                            <th
                              className="sticky-program"
                              style={{ textAlign: "center" }}
                            >
                              2
                            </th>
                            <th style={{ textAlign: "center" }}>3</th>
                            <th style={{ textAlign: "center" }}>4</th>
                            <th style={{ textAlign: "center" }}>5</th>
                            <th style={{ textAlign: "center" }}>6</th>
                            <th style={{ textAlign: "center" }}>7</th>
                            <th style={{ textAlign: "center" }}>8</th>
                            <th style={{ textAlign: "center" }}>9</th>
                            <th style={{ textAlign: "center" }}>10</th>
                            <th style={{ textAlign: "center" }}>11</th>
                            <th style={{ textAlign: "center" }}>12</th>
                          </tr>
                        </thead>
                        <tbody>
                          {triwulanPrograms.map((prog, pIdx) => {
                            const totalSasRows = Math.max(
                              1,
                              prog.sasaranList.length,
                            )
                            const extraProgramNoteIndexes = prog.sasaranList
                              .slice(1)
                              .map((s) => s.baseIdx)
                            return prog.sasaranList.map((sas, sIdx) => {
                              const isFirstSas = sIdx === 0
                              const baseIdx =
                                sas.baseIdx ?? pIdx * 11 + sIdx * 11
                              const valAt = (offset: number, fallback: string) =>
                                selected.items[baseIdx + offset]?.value ??
                                fallback

                              const progState = getCellState(
                                baseIdx,
                                extraProgramNoteIndexes,
                              )
                              const sasState = getCellState(baseIdx + 1)
                              const monthState = getCellState(baseIdx + 2)
                              const stageState = getCellState(baseIdx + 3)
                              const realState = getCellState(baseIdx + 4)
                              const pctState = getCellState(baseIdx + 5)
                              const obsState = getCellState(baseIdx + 6)
                              const solState = getCellState(baseIdx + 7)
                              const solTimeState = getCellState(baseIdx + 8)
                              const noteState = getCellState(baseIdx + 9)
                              const evState = getCellState(baseIdx + 10)
                              const rawMonth = valAt(2, sas.month)
                              const formattedMonth = /^\d{4}-\d{2}$/.test(
                                rawMonth.trim(),
                              )
                                ? formatBulanPelaksanaan(rawMonth.trim())
                                : rawMonth

                              return (
                                <tr key={`${prog.id}-${sas.id || sIdx}`}>
                                  {isFirstSas && (
                                    <>
                                      <td
                                        rowSpan={totalSasRows}
                                        className="sticky-no admin-review-num-cell"
                                      >
                                        {pIdx + 1}
                                      </td>
                                      <td
                                        rowSpan={totalSasRows}
                                        className={[
                                          "sticky-program",
                                          progState.tdStateClass,
                                        ]
                                          .filter(Boolean)
                                          .join(" ")}
                                      >
                                        {renderReviewCell(
                                          baseIdx,
                                          valAt(0, prog.program),
                                          `Program Kerja #${pIdx + 1}`,
                                          {
                                            extraNoteIndexes:
                                              extraProgramNoteIndexes,
                                          },
                                        )}
                                      </td>
                                    </>
                                  )}
                                  <td className={sasState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 1,
                                      valAt(1, sas.target),
                                      `Sasaran #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td className={monthState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 2,
                                      formattedMonth,
                                      `Bulan Pelaksanaan #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td className={stageState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 3,
                                      valAt(3, sas.stage),
                                      `Tahap Pelaksanaan #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td className={realState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 4,
                                      valAt(4, sas.realization),
                                      `Realisasi Pelaksanaan #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td
                                    className={pctState.tdStateClass}
                                    style={{ fontWeight: 600 }}
                                  >
                                    {renderReviewCell(
                                      baseIdx + 5,
                                      valAt(5, sas.percentage),
                                      `Realisasi (%) #${pIdx + 1}.${sIdx + 1}`,
                                      { centerText: true },
                                    )}
                                  </td>
                                  <td className={obsState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 6,
                                      valAt(6, sas.obstacle),
                                      `Kendala #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td className={solState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 7,
                                      valAt(7, sas.solution),
                                      `Rencana Penyelesaian #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td className={solTimeState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 8,
                                      valAt(8, sas.solutionTime),
                                      `Waktu Penyelesaian #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td className={noteState.tdStateClass}>
                                    {renderReviewCell(
                                      baseIdx + 9,
                                      valAt(9, sas.notes),
                                      `Keterangan #${pIdx + 1}.${sIdx + 1}`,
                                    )}
                                  </td>
                                  <td
                                    className={evState.tdStateClass}
                                    style={{ wordBreak: "break-all" }}
                                  >
                                    {renderReviewCell(
                                      baseIdx + 10,
                                      valAt(10, sas.evidence),
                                      `Link Evidence #${pIdx + 1}.${sIdx + 1}`,
                                      { isLink: true },
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }

                return (
                  <div
                    className="admin-review-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Pemeriksaan ${selected.title}`}
                  >
                    <section className="admin-review-modal is-table-mode">
                      <header className="admin-review-modal-header is-minimal">
                        <button
                          type="button"
                          className="admin-review-back"
                          aria-label={backLabel}
                          title={backLabel}
                          onClick={backFromReview}
                        >
                          <Icon name="arrowLeft" size={19} />
                        </button>
                        <button
                          type="button"
                          className="admin-review-close"
                          aria-label="Tutup pemeriksaan"
                          title="Tutup pemeriksaan"
                          onClick={closeReview}
                        >
                          ✕
                        </button>
                      </header>

                      <div className="admin-review-table-toolbar">
                        <p>
                          {canEditReview
                            ? "Klik ikon catatan kecil pada sel tabel untuk menulis atau mengubah catatan revisi."
                            : "Menampilkan tabel dokumen beserta catatan hasil pemeriksaan."}
                        </p>
                        <div className="admin-review-table-badges">
                          <span>
                            {reviewPrograms.length} program · {totalSasaranCount}{" "}
                            sasaran
                          </span>
                          <span>
                            {selected.type === "Sasaran Kinerja"
                              ? "7 kolom"
                              : "12 kolom"}
                          </span>
                        </div>
                      </div>

                      <div className="admin-review-table-scroll">
                        <AnnualSourceSummary record={selected} />

                        {selected.type === "Sasaran Kinerja"
                          ? renderTargetsTable()
                          : renderTriwulanTable()}

                        <details className="admin-review-history">
                          <summary>Riwayat pemeriksaan</summary>
                          {selected.reviews?.length ? (
                            <ol>
                              {selected.reviews.map((review) => (
                                <li key={review.id}>
                                  {new Date(review.at).toLocaleString("id-ID")} ·{" "}
                                  {review.actor} · {review.action}
                                  <ul>
                                    {Object.entries(review.notes).map(
                                      ([index, note]) => (
                                        <li key={index}>
                                          {formatReviewItemLocation(
                                            selected,
                                            reviewPrograms,
                                            Number(index),
                                          )}
                                          : {note}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p>Belum ada riwayat pemeriksaan tersimpan.</p>
                          )}
                        </details>
                      </div>

                      {canEditReview &&
                        activeNoteIndex !== null &&
                        activeNoteItem && (
                          <div
                            className="admin-review-note-dock"
                            role="region"
                            aria-label="Editor catatan revisi indikator"
                          >
                            <div className="admin-review-note-dock-head">
                              <div className="admin-review-note-dock-info">
                                <strong>
                                  {formatReviewItemLocation(
                                    selected,
                                    reviewPrograms,
                                    activeNoteIndex,
                                  )}
                                </strong>
                                <span>
                                  Isi laporan:{" "}
                                  {(activeNoteItem.label.includes("Bulan") &&
                                    /^\d{4}-\d{2}$/.test(
                                      (activeNoteItem.value ?? "").trim(),
                                    )
                                    ? formatBulanPelaksanaan(
                                      (activeNoteItem.value ?? "").trim(),
                                    )
                                    : activeNoteItem.value?.trim()) ||
                                    "Belum diisi"}
                                </span>
                              </div>
                              <div className="admin-review-note-dock-actions">
                                {Boolean(
                                  notes[String(activeNoteIndex)]?.trim(),
                                ) && (
                                    <button
                                      type="button"
                                      className="admin-review-note-clear"
                                      onClick={() => {
                                        setNotes((current) => {
                                          const next = { ...current }
                                          delete next[String(activeNoteIndex)]
                                          return next
                                        })
                                        setActiveNoteIndex(null)
                                      }}
                                    >
                                      Hapus Catatan
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  className="admin-review-note-done"
                                  onClick={() => setActiveNoteIndex(null)}
                                >
                                  Selesai
                                </button>
                              </div>
                            </div>
                            <textarea
                              ref={noteTextareaRef}
                              id={`admin-review-note-${activeNoteIndex}`}
                              name={`reviewNotes[${activeNoteIndex}]`}
                              rows={2}
                              placeholder="Tuliskan catatan perbaikan untuk indikator ini..."
                              aria-label={`Catatan revisi ${formatReviewItemLocation(selected, reviewPrograms, activeNoteIndex)}`}
                              value={notes[String(activeNoteIndex)] ?? ""}
                              onChange={(e) =>
                                setNotes((current) => ({
                                  ...current,
                                  [String(activeNoteIndex)]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        )}

                      <footer className="admin-review-modal-footer">
                        <p>
                          <strong>{reviewPrograms.length}</strong>
                          <span> program · </span>
                          <strong>{totalSasaranCount}</strong>
                          <span> sasaran · </span>
                          <strong>
                            {canEditReview
                              ? revisionNoteCount
                              : savedRevisionTotal}
                          </strong>
                          <span> catatan revisi</span>
                        </p>
                        {canEditReview && (
                          <div className="admin-review-footer-actions">
                            <button
                              type="button"
                              className="admin-review-revision"
                              onClick={() => decide("Revisi")}
                            >
                              Kirim Revisi ({revisionNoteCount})
                            </button>
                            <button
                              type="button"
                              className="admin-review-approve"
                              onClick={() => decide("Disetujui")}
                            >
                              <Icon name="check" size={16} />
                              <span>Setujui Dokumen</span>
                            </button>
                          </div>
                        )}
                      </footer>
                    </section>
                  </div>
                )
              })()}
          </>
        )}
      </section>
      <DetailModal
        record={activeDetailRecord}
        isAdmin
        canReview
        onClose={() => setDetailRecord(null)}
        onPrintPreview={(rec) => setPreview(rec)}
        onOpenReview={(rec) => {
          setDetailRecord(null)
          openReviewModal(rec, "detail")
        }}
      />
      <PrintPreviewModal record={preview} onClose={() => setPreview(null)} />
    </>
  )
}
