import { useEffect, useMemo, useRef, useState } from "react"
import type { SetStateAction } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  compareQuarters,
  describePeriodLockReason,
  formatDeadlineSummary,
  formatPeriodStatusTag,
  getPeriodState,
  quarterFromMonth,
} from "../utils/workflow"
import { collectReportingYears, useReporting } from "../ReportingContext"
import { DetailModal } from "../components/DetailModal"
import { Icon } from "../components/Icon"
import { PrintPreviewModal } from "../components/PrintPreviewModal"
import {
  SubmitConfirmModal,
  type SubmitConfirmInfo,
} from "../components/SubmitConfirmModal"
import {
  SubmitSuccessModal,
  type SubmitSuccessInfo,
} from "../components/SubmitSuccessModal"
import { useDialog } from "../utils/useDialog"
import { useConfirmableUnsavedChanges } from "../utils/useUnsavedChanges"
import {
  buildTriwulanItems,
  formatUpdatedAtLabel,
  normalizeTriwulanPrograms,
  promoteDraftToSubmitted,
  upsertDraftRecord,
} from "../utils/drafts"
import {
  computeTableMergeSpans,
  formatBulanPelaksanaan,
} from "../utils/format"
import { exportRecordExcel } from "../utils/exportExcel"
import {
  computeLateStatus,
  getUnitAnnualPrerequisiteState,
  recordMatchesUnitCode,
  syncTriwulanFromApprovedAnnual,
} from "../utils/annualSources"
import {
  getSessionLockedOrganization,
  recordBelongsToSession,
} from "../utils/auth"
import { useAuth } from "../AuthContext"
import {
  appendNotifications,
  createAppNotification,
  formatRecordUnitLabel,
} from "../utils/notifications"
import type {
  HistoryRecord,
  NotifyFn,
  TriwulanProgramItem,
  TriwulanSasaranItem,
} from "../types"

type InputLaporanTriwulanProps = {
  notify: NotifyFn
  resumeDraftId?: string | null
  onViewHistory?: () => void
  onOpenSasaranKinerja?: () => void
  onOpenLateMonitoring?: () => void
}

function parseResumePeriod(
  period: string,
  fallbackQuarter: string,
  fallbackYear: string,
) {
  return {
    quarter:
      period.match(/Triwulan\s+(IV|III|II|I)\b/i)?.[1]?.toUpperCase() ??
      fallbackQuarter,
    year: period.match(/\b(\d{4})\b/)?.[1] ?? fallbackYear,
  }
}

type GridFilterMode = "all" | "active" | "late" | "locked"

type FlatTriwulanRow = {
  rowNumber: number
  pIdx: number
  sIdx: number
  programId: string
  sasaranId: string
  strategicGoal: string
  programName: string
  sasaran: TriwulanSasaranItem
  startQuarter: string
  targetQuarter: string
  isFutureScheduled: boolean
  isComplete: boolean
}

type RowModalState = {
  pIdx: number
  sIdx: number
  strategicGoal: string
  programName: string
  target: string
  monthStart: string
  monthEnd: string
  startQuarter: string
  targetQuarter: string
  priorPercentage: number
  carryOverFromQuarter?: string
  isLockedCompleted: boolean
  completedInQuarter?: string
  stage: string
  stageTargetTime: string
  realization: string
  percentage: string
  obstacle: string
  solution: string
  solutionTime: string
  notes: string
  evidence: string
}

export function InputLaporanTriwulan({
  notify,
  resumeDraftId = null,
  onViewHistory,
  onOpenSasaranKinerja,
  onOpenLateMonitoring,
}: InputLaporanTriwulanProps) {
  const { data, setData, storageError, nowMs } = useReporting()
  const { session } = useAuth()
  const lockedOrg = getSessionLockedOrganization(session)
  const unit = lockedOrg.unit
  const subUnit = lockedOrg.subUnit

  const findDraftForPeriod = (targetYear: string, targetQuarter: string) =>
    data.records.find(
      (record) =>
        record.type === "Laporan Triwulan" &&
        record.status === "Draf" &&
        record.period === `Triwulan ${targetQuarter} · ${targetYear}` &&
        recordMatchesUnitCode(record, subUnit),
    )

  const resumeRecord = resumeDraftId
    ? data.records.find(
        (record) =>
          record.id === resumeDraftId &&
          record.type === "Laporan Triwulan" &&
          record.status === "Draf" &&
          recordBelongsToSession(record, session),
      )
    : findDraftForPeriod(data.year, data.quarter)

  const initialPeriod = resumeRecord
    ? parseResumePeriod(resumeRecord.period, data.quarter, data.year)
    : { quarter: data.quarter, year: data.year }

  const [quarter, setQuarterState] = useState<string>(initialPeriod.quarter)
  const [year, setYearState] = useState<string>(initialPeriod.year)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    () => resumeRecord?.id ?? null,
  )
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    () => resumeRecord?.updatedAt ?? "",
  )
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(
    () => resumeRecord?.updatedAt ?? "",
  )

  const prereq = getUnitAnnualPrerequisiteState(data.records, year, subUnit)

  const [programs, setProgramsState] = useState<TriwulanProgramItem[]>(() => {
    const base = resumeRecord?.triwulanPrograms?.length
      ? normalizeTriwulanPrograms(resumeRecord.triwulanPrograms)
      : []
    const initPrereq = getUnitAnnualPrerequisiteState(
      data.records,
      initialPeriod.year,
      subUnit,
    )
    if (initPrereq.approvedRecord) {
      return syncTriwulanFromApprovedAnnual({
        existingPrograms: base,
        approvedRecord: initPrereq.approvedRecord,
        allRecords: data.records,
        year: initialPeriod.year,
        quarter: initialPeriod.quarter,
        unitCode: subUnit,
      })
    }
    return base
  })

  const [gridFilter, setGridFilter] = useState<GridFilterMode>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [modalState, setModalState] = useState<RowModalState | null>(null)
  const [modalError, setModalError] = useState("")
  const [dirtyWithoutDraft, setDirtyWithoutDraft] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printPreviewRecord, setPrintPreviewRecord] =
    useState<HistoryRecord | null>(null)
  const [confirmInfo, setConfirmInfo] = useState<SubmitConfirmInfo | null>(null)
  const [successInfo, setSuccessInfo] = useState<SubmitSuccessInfo | null>(null)

  useDialog(Boolean(modalState), () => {
    setModalState(null)
    setModalError("")
  }, ".triwulan-row-modal-overlay")

  const quarterDescriptions: Record<string, string> = {
    I: "Januari - Maret",
    II: "April - Juni",
    III: "Juli - September",
    IV: "Oktober - Desember",
  }

  const key = `${year}-${quarter}`
  const yearOptions = Array.from(new Set([...collectReportingYears(data), year]))
  const currentPeriod = data.periods[key]
  const periodState = getPeriodState(currentPeriod, nowMs)
  const isPeriodLocked = !periodState.canSubmit
  const isLockedForNewInput = isPeriodLocked && activeDraftId === null
  const lockReason = describePeriodLockReason(
    currentPeriod,
    `Triwulan ${quarter} Tahun ${year}`,
    nowMs,
  )
  const updatedLabel = formatUpdatedAtLabel(lastSavedAt)

  const stateRef = useRef({ programs, quarter, year, activeDraftId })
  stateRef.current = { programs, quarter, year, activeDraftId }

  // Real-time reactive sync whenever Admin approves Sasaran Kinerja or prior quarters update
  useEffect(() => {
    if (!prereq.approvedRecord) return
    setProgramsState((prev) => {
      const synced = syncTriwulanFromApprovedAnnual({
        existingPrograms: prev,
        approvedRecord: prereq.approvedRecord!,
        allRecords: data.records,
        year,
        quarter,
        unitCode: subUnit,
      })
      stateRef.current.programs = synced
      return synced
    })
  }, [prereq.approvedRecord, data.records, year, quarter, subUnit])

  const isValidPercentage = (raw: string, minPct = 0) => {
    const trimmed = raw.trim()
    if (trimmed === "") return false
    const val = Number(trimmed)
    return !Number.isNaN(val) && val >= minPct && val <= 100
  }

  const needsFollowUp = (pctRaw: string) => {
    if (pctRaw.trim() === "") return false
    const val = Number(pctRaw)
    return Number.isNaN(val) || val < 100
  }

  const isRowSasaranComplete = (
    s: TriwulanSasaranItem,
    currentQuarter: string,
  ): boolean => {
    if (s.isLockedCompleted) return true
    const startQ = s.startQuarter || quarterFromMonth(s.monthStart) || "I"
    const isFuture = compareQuarters(startQ, currentQuarter) > 0
    const hasStartedEarly = Boolean(
      s.stage.trim() || s.realization.trim() || (s.percentage.trim() && Number(s.percentage) > 0),
    )
    if (isFuture && !hasStartedEarly) {
      return true
    }
    const minPct = s.priorPercentage ?? 0
    if (!s.stage.trim() || !s.realization.trim()) return false
    if (!isValidPercentage(s.percentage, minPct)) return false
    if (
      needsFollowUp(s.percentage) &&
      (!s.obstacle.trim() || !s.solution.trim() || !s.solutionTime.trim())
    ) {
      return false
    }
    return true
  }

  const computeCompleteness = (
    list: TriwulanProgramItem[],
    currentQuarter = quarter,
  ) => {
    const allSas = list.flatMap((p) => p.sasaranList)
    if (allSas.length === 0) return 0
    const done = allSas.filter((s) =>
      isRowSasaranComplete(s, currentQuarter),
    ).length
    return Math.round((done / allSas.length) * 100)
  }

  const prepareProgramsForRecord = (
    list: TriwulanProgramItem[],
    currentQuarter: string,
  ): TriwulanProgramItem[] =>
    list.map((prog) => ({
      ...prog,
      sasaranList: prog.sasaranList.map((sas) => {
        const startQ = sas.startQuarter || quarterFromMonth(sas.monthStart) || "I"
        const targetQ =
          sas.targetQuarter ||
          quarterFromMonth(sas.monthEnd || sas.monthStart) ||
          startQ
        const isFuture = compareQuarters(startQ, currentQuarter) > 0
        const hasStartedEarly = Boolean(
          sas.stage.trim() ||
            sas.realization.trim() ||
            (sas.percentage.trim() && Number(sas.percentage) > 0),
        )
        if (isFuture && !hasStartedEarly && !sas.isLockedCompleted) {
          return {
            ...sas,
            percentage: sas.percentage.trim() || "0",
            notes:
              sas.notes.trim() ||
              `Jadwal pelaksanaan mulai Triwulan ${startQ}`,
            lateStatus: "Tepat Waktu",
          }
        }
        const pctNum = Number.parseFloat(sas.percentage || "0") || 0
        const lateStatus = computeLateStatus({
          currentQuarter,
          targetQuarter: targetQ,
          percentage: pctNum,
          completedInQuarter: sas.completedInQuarter,
          explicitOverride: sas.adminLateNote ? sas.lateStatus : undefined,
        })
        return {
          ...sas,
          lateStatus,
        }
      }),
    }))

  const buildDraft = (
    draftId: string,
    snapshot: {
      programs: TriwulanProgramItem[]
      quarter: string
      year: string
    },
    nowIso: string,
  ): HistoryRecord => {
    const normalizedPrograms = prepareProgramsForRecord(
      snapshot.programs,
      snapshot.quarter,
    )
    return {
      id: draftId,
      author: session?.displayName || "Staf Unit",
      type: "Laporan Triwulan",
      title: `Laporan Realisasi Triwulan ${snapshot.quarter}`,
      period: `Triwulan ${snapshot.quarter} · ${snapshot.year}`,
      unit: subUnit || unit,
      parentUnit: unit,
      subUnit: subUnit || unit,
      sentAt: "Belum dikirim",
      updatedAt: nowIso,
      status: "Draf",
      progress: computeCompleteness(snapshot.programs, snapshot.quarter),
      items: buildTriwulanItems(normalizedPrograms),
      triwulanPrograms: normalizedPrograms,
    }
  }

  const persistDraftImmediate = (
    nextPrograms: TriwulanProgramItem[],
    targetYear = stateRef.current.year,
    targetQuarter = stateRef.current.quarter,
    toastMessage?: string,
  ) => {
    const nowIso = new Date().toISOString()
    const draftId =
      stateRef.current.activeDraftId ??
      `DRAF-LTR-${targetYear}-${targetQuarter}-${subUnit.toLowerCase()}-${crypto.randomUUID().slice(0, 6)}`
    const draftRecord = buildDraft(
      draftId,
      { programs: nextPrograms, quarter: targetQuarter, year: targetYear },
      nowIso,
    )
    setData((current) => ({
      ...current,
      records: upsertDraftRecord(current.records, draftRecord),
    }))
    stateRef.current.activeDraftId = draftId
    setActiveDraftId(draftId)
    setLastSavedAt(nowIso)
    setLastModifiedAt(nowIso)
    setDirtyWithoutDraft(false)
    if (toastMessage) {
      notify(toastMessage)
    }
  }

  const setPrograms = (update: SetStateAction<TriwulanProgramItem[]>) => {
    const prev = stateRef.current
    const nextPrograms =
      typeof update === "function" ? update(prev.programs) : update
    stateRef.current = { ...prev, programs: nextPrograms }
    setProgramsState(nextPrograms)
    const nowIso = new Date().toISOString()
    setLastModifiedAt(nowIso)
    if (prev.activeDraftId) {
      setLastSavedAt(nowIso)
      setData((current) => ({
        ...current,
        records: upsertDraftRecord(
          current.records,
          buildDraft(
            prev.activeDraftId!,
            {
              programs: nextPrograms,
              quarter: prev.quarter,
              year: prev.year,
            },
            nowIso,
          ),
        ),
      }))
    } else {
      setDirtyWithoutDraft(true)
    }
  }

  const switchPeriod = (nextYear: string, nextQuarter: string) => {
    const existingDraft = findDraftForPeriod(nextYear, nextQuarter)
    const nextPrereq = getUnitAnnualPrerequisiteState(
      data.records,
      nextYear,
      subUnit,
    )
    const basePrograms = existingDraft?.triwulanPrograms?.length
      ? normalizeTriwulanPrograms(existingDraft.triwulanPrograms)
      : []
    const synced = nextPrereq.approvedRecord
      ? syncTriwulanFromApprovedAnnual({
          existingPrograms: basePrograms,
          approvedRecord: nextPrereq.approvedRecord,
          allRecords: data.records,
          year: nextYear,
          quarter: nextQuarter,
          unitCode: subUnit,
        })
      : basePrograms

    setYearState(nextYear)
    setQuarterState(nextQuarter)
    setProgramsState(synced)
    setActiveDraftId(existingDraft?.id ?? null)
    setLastSavedAt(existingDraft?.updatedAt ?? "")
    setLastModifiedAt(existingDraft?.updatedAt ?? "")
    setDirtyWithoutDraft(false)
    setAttempted(false)
    stateRef.current = {
      programs: synced,
      quarter: nextQuarter,
      year: nextYear,
      activeDraftId: existingDraft?.id ?? null,
    }
  }

  useConfirmableUnsavedChanges(
    activeDraftId === null && dirtyWithoutDraft,
    "Perubahan progres triwulan belum disimpan sebagai draf. Tetap tinggalkan halaman?",
  )

  const flatRows = useMemo<FlatTriwulanRow[]>(() => {
    const rows: FlatTriwulanRow[] = []
    let counter = 0
    programs.forEach((prog, pIdx) => {
      prog.sasaranList.forEach((sas, sIdx) => {
        counter += 1
        const startQ =
          sas.startQuarter || quarterFromMonth(sas.monthStart) || "I"
        const targetQ =
          sas.targetQuarter ||
          quarterFromMonth(sas.monthEnd || sas.monthStart) ||
          startQ
        const isFutureScheduled =
          compareQuarters(startQ, quarter) > 0 &&
          !sas.stage.trim() &&
          !sas.realization.trim() &&
          !(sas.percentage.trim() && Number(sas.percentage) > 0)
        rows.push({
          rowNumber: counter,
          pIdx,
          sIdx,
          programId: prog.id,
          sasaranId: sas.id,
          strategicGoal:
            sas.strategicGoal ||
            prog.strategicGoal ||
            sas.annualSource?.strategicGoal ||
            "-",
          programName: prog.program || "-",
          sasaran: sas,
          startQuarter: startQ,
          targetQuarter: targetQ,
          isFutureScheduled,
          isComplete: isRowSasaranComplete(sas, quarter),
        })
      })
    })
    return rows
  }, [programs, quarter])

  const filteredRows = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase()
    return flatRows.filter((row) => {
      if (gridFilter === "active") {
        if (row.sasaran.isLockedCompleted || row.isFutureScheduled) return false
      } else if (gridFilter === "late") {
        if (
          row.sasaran.lateStatus !== "Terlambat" &&
          row.sasaran.lateStatus !== "Pencapaian Terlambat"
        ) {
          return false
        }
      } else if (gridFilter === "locked") {
        if (!row.sasaran.isLockedCompleted) return false
      }

      if (qLower) {
        const hay = [
          row.strategicGoal,
          row.programName,
          row.sasaran.target,
          row.sasaran.stage,
          row.sasaran.realization,
          row.sasaran.obstacle,
        ]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(qLower)) return false
      }
      return true
    })
  }, [flatRows, gridFilter, searchQuery])

  const filteredMergeSpans = useMemo(
    () => computeTableMergeSpans(filteredRows),
    [filteredRows],
  )

  const counts = useMemo(() => {
    const locked = flatRows.filter((r) => r.sasaran.isLockedCompleted).length
    const late = flatRows.filter(
      (r) =>
        r.sasaran.lateStatus === "Terlambat" ||
        r.sasaran.lateStatus === "Pencapaian Terlambat",
    ).length
    const carryOver = flatRows.filter(
      (r) => Boolean(r.sasaran.carryOverFromQuarter) && !r.sasaran.isLockedCompleted,
    ).length
    const active = flatRows.filter(
      (r) => !r.sasaran.isLockedCompleted && !r.isFutureScheduled,
    ).length
    return { locked, late, carryOver, active }
  }, [flatRows])

  const openRowModal = (row: FlatTriwulanRow) => {
    const s = row.sasaran
    setModalError("")
    setModalState({
      pIdx: row.pIdx,
      sIdx: row.sIdx,
      strategicGoal: row.strategicGoal,
      programName: row.programName,
      target: s.target,
      monthStart: s.monthStart,
      monthEnd: s.monthEnd ?? "",
      startQuarter: row.startQuarter,
      targetQuarter: row.targetQuarter,
      priorPercentage: s.priorPercentage ?? 0,
      carryOverFromQuarter: s.carryOverFromQuarter,
      isLockedCompleted: Boolean(s.isLockedCompleted),
      completedInQuarter: s.completedInQuarter,
      stage: s.stage,
      stageTargetTime: s.stageTargetTime ?? "",
      realization: s.realization,
      percentage:
        s.percentage !== ""
          ? s.percentage
          : (s.priorPercentage ?? 0) > 0
            ? String(s.priorPercentage)
            : "",
      obstacle: s.obstacle,
      solution: s.solution,
      solutionTime: s.solutionTime,
      notes: s.notes,
      evidence: s.evidence,
    })
  }

  const applyRowModal = (action: "saveDraft" | "apply" | "nextRow") => {
    if (!modalState) return
    if (modalState.isLockedCompleted) {
      setModalState(null)
      return
    }

    const pctTrimmed = modalState.percentage.trim()
    const minPct = modalState.priorPercentage
    if (pctTrimmed !== "") {
      const pctVal = Number(pctTrimmed)
      if (Number.isNaN(pctVal) || pctVal < 0 || pctVal > 100) {
        setModalError("Persentase realisasi harus berupa angka antara 0 sampai 100.")
        return
      }
      if (pctVal < minPct) {
        setModalError(
          `Realisasi bersifat akumulatif dan tidak boleh turun di bawah capaian sebelumnya (${minPct}%).`,
        )
        return
      }
    }

    if (action !== "saveDraft") {
      if (!modalState.stage.trim()) {
        setModalError("Tahap Pelaksanaan (Uraian) wajib diisi.")
        return
      }
      if (!modalState.realization.trim()) {
        setModalError("Realisasi Pelaksanaan (Uraian) wajib diisi.")
        return
      }
      if (pctTrimmed === "") {
        setModalError("Realisasi Pelaksanaan (%) wajib diisi.")
        return
      }
      if (
        Number(pctTrimmed) < 100 &&
        (!modalState.obstacle.trim() ||
          !modalState.solution.trim() ||
          !modalState.solutionTime.trim())
      ) {
        setModalError(
          "Capaian di bawah 100% wajib melengkapi Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian.",
        )
        return
      }
    }

    const numericPct =
      pctTrimmed !== "" ? Number(pctTrimmed) : modalState.priorPercentage
    const computedLate = computeLateStatus({
      currentQuarter: quarter,
      targetQuarter: modalState.targetQuarter,
      percentage: numericPct,
    })

    const nowIso = new Date().toISOString()
    const nextPrograms = programs.map((prog, pIdx) => {
      if (pIdx !== modalState.pIdx) return prog
      return {
        ...prog,
        sasaranList: prog.sasaranList.map((sas, sIdx) => {
          if (sIdx !== modalState.sIdx) return sas
          return {
            ...sas,
            stage: modalState.stage,
            stageTargetTime: modalState.stageTargetTime,
            realization: modalState.realization,
            percentage: pctTrimmed,
            obstacle: numericPct >= 100 ? "" : modalState.obstacle,
            solution: numericPct >= 100 ? "" : modalState.solution,
            solutionTime: numericPct >= 100 ? "" : modalState.solutionTime,
            notes: modalState.notes,
            evidence: modalState.evidence,
            lateStatus: computedLate,
            draftSavedAt: nowIso,
          }
        }),
      }
    })

    setPrograms(nextPrograms)

    if (action === "saveDraft") {
      persistDraftImmediate(
        nextPrograms,
        year,
        quarter,
        "Draf progres baris berhasil disimpan.",
      )
      setModalState(null)
      setModalError("")
      return
    }

    if (action === "nextRow") {
      persistDraftImmediate(nextPrograms, year, quarter)
      const currentFlatIndex = flatRows.findIndex(
        (r) => r.pIdx === modalState.pIdx && r.sIdx === modalState.sIdx,
      )
      const nextEditable = flatRows
        .slice(currentFlatIndex + 1)
        .find((r) => !r.sasaran.isLockedCompleted)
      if (nextEditable) {
        const updatedSas =
          nextPrograms[nextEditable.pIdx]?.sasaranList[nextEditable.sIdx] ??
          nextEditable.sasaran
        openRowModal({ ...nextEditable, sasaran: updatedSas })
        notify("Baris disimpan ke draf. Melanjutkan ke baris berikutnya.")
        return
      }
      notify("Seluruh baris aktif telah selesai diperbarui dan disimpan ke draf.")
    }

    setModalState(null)
    setModalError("")
  }

  const completeness = computeCompleteness(programs, quarter)

  const saveDraft = () => {
    if (!prereq.canAccessTriwulan) return
    if (isLockedForNewInput) {
      notify(
        `${lockReason} Pilih periode yang sedang dibuka untuk menyimpan laporan.`,
        "error",
      )
      return
    }
    persistDraftImmediate(
      programs,
      year,
      quarter,
      activeDraftId
        ? "Draf laporan triwulan berhasil diperbarui."
        : "Draf laporan triwulan disimpan. Simpan otomatis kini aktif.",
    )
  }

  const requestSubmit = (): boolean => {
    setAttempted(true)
    if (!prereq.canAccessTriwulan) {
      notify(
        `Laporan Triwulan terkunci karena Sasaran Kinerja Tahun ${year} belum disetujui (ACC) Admin PRP.`,
        "error",
      )
      return false
    }
    if (isPeriodLocked) {
      setPreviewOpen(false)
      setPrintPreviewRecord(null)
      notify(
        `${lockReason} Perbaikan revisi tetap dapat dikirim melalui menu Riwayat.`,
        "error",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return false
    }

    const incompleteRows = flatRows.filter((row) => !row.isComplete)
    if (flatRows.length === 0 || incompleteRows.length > 0) {
      setPreviewOpen(false)
      setPrintPreviewRecord(null)
      const firstBad = incompleteRows[0]
      const missingObstacle =
        firstBad &&
        firstBad.sasaran.percentage.trim() !== "" &&
        Number(firstBad.sasaran.percentage) < 100 &&
        (!firstBad.sasaran.obstacle.trim() ||
          !firstBad.sasaran.solution.trim() ||
          !firstBad.sasaran.solutionTime.trim())

      notify(
        missingObstacle
          ? `Baris #${firstBad.rowNumber} memiliki realisasi di bawah 100% sehingga wajib mengisi Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian.`
          : firstBad
            ? `Lengkapi progres pada Baris #${firstBad.rowNumber} (${firstBad.programName}) terlebih dahulu sebelum mengirim laporan.`
            : "Tidak ada program kerja yang dapat dikirim.",
        "error",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return false
    }

    setConfirmInfo({
      title: "Konfirmasi Pengiriman Laporan Triwulan",
      description:
        "Pastikan progres tahapan, persentase realisasi akumulatif, kendala, serta tautan dokumen bukti (evidence) telah akurat.",
      documentTitle: `Laporan Realisasi Triwulan ${quarter}`,
      period: `Triwulan ${quarter} · ${year}`,
      unit: lockedOrg.unitLabel,
      summary: `${programs.length} program kerja · ${flatRows.length} sasaran`,
      cancelLabel: "Cek Kembali",
      confirmLabel: "Ya, Kirim Laporan",
    })
    return true
  }

  const commitSubmit = () => {
    setConfirmInfo(null)
    setPreviewOpen(false)
    setPrintPreviewRecord(null)

    const sentAt = new Date().toLocaleString("id-ID")
    const finalPrograms = prepareProgramsForRecord(programs, quarter)
    const lateNotesMap: Record<string, NonNullable<TriwulanSasaranItem["lateStatus"]>> = {}
    for (const p of finalPrograms) {
      for (const s of p.sasaranList) {
        if (s.lateStatus && s.lateStatus !== "Tepat Waktu") {
          lateNotesMap[s.id] = s.lateStatus
        }
      }
    }

    const submittedRecord: HistoryRecord = {
      id: `LTR-${year}-${quarter}-${subUnit}-${crypto.randomUUID().slice(0, 6)}`,
      author: session?.displayName || "Staf Unit",
      type: "Laporan Triwulan",
      title: `Laporan Realisasi Triwulan ${quarter}`,
      period: `Triwulan ${quarter} · ${year}`,
      unit: subUnit || unit,
      parentUnit: unit,
      subUnit: subUnit || unit,
      sentAt,
      status: "Menunggu",
      progress: 100,
      items: buildTriwulanItems(finalPrograms),
      triwulanPrograms: finalPrograms,
      ...(Object.keys(lateNotesMap).length > 0 ? { lateNotes: lateNotesMap } : {}),
    }

    const unitLabel = formatRecordUnitLabel(submittedRecord)
    const adminNotif = createAppNotification({
      recipient: "admin",
      category: "document_submitted",
      title: submittedRecord.title,
      message: `${unitLabel} · ${submittedRecord.period} menunggu verifikasi.`,
      actor: `${submittedRecord.author || "Staf Unit"} (${unitLabel})`,
      targetMenu: "Verifikasi Laporan Triwulan",
      recordId: submittedRecord.id,
      unitLabel,
      periodLabel: submittedRecord.period,
    })

    setData((current) => ({
      ...current,
      records: promoteDraftToSubmitted(
        current.records,
        activeDraftId,
        submittedRecord,
      ),
      notifications: appendNotifications(current.notifications, adminNotif),
    }))

    setActiveDraftId(null)
    setLastSavedAt("")
    setLastModifiedAt("")
    setDirtyWithoutDraft(false)
    setAttempted(false)
    setSuccessInfo({
      title: "Laporan Triwulan Berhasil Dikirim",
      subtitle:
        "Laporan telah tersimpan dan masuk ke antrean verifikasi Admin PRP.",
      documentTitle: submittedRecord.title,
      period: submittedRecord.period,
      unit: lockedOrg.unitLabel,
      sentAt,
      statusLabel: "Menunggu Verifikasi",
    })
    return true
  }

  const statusClass =
    activeDraftId === null
      ? "report-status is-idle"
      : storageError
        ? "report-status is-error"
        : "report-status"
  const statusText =
    activeDraftId === null
      ? "Belum disimpan"
      : storageError
        ? "Draf belum tersimpan"
        : "Draf tersimpan"

  const previewRecord = previewOpen
    ? buildDraft(
        activeDraftId ?? "PRATINJAU-SEMENTARA",
        { programs, quarter, year },
        lastModifiedAt,
      )
    : null

  return (
    <div className="report-page">
      <div className="report-heading">
        <div>
          <div className="report-kicker">TAHAP 2 · MONITORING BERKALA 3 BULAN</div>
          <div className="report-title">
            Laporan Realisasi Triwulan {quarter} ({year})
          </div>
        </div>
        <div className="draft-save-info">
          <div className={statusClass}>
            <span /> {statusText}
          </div>
          {activeDraftId !== null && (
            <small className="draft-updated-at">
              {storageError ? (
                "Gagal menyimpan ke penyimpanan browser"
              ) : updatedLabel ? (
                <>
                  Terakhir diperbarui:{" "}
                  <time dateTime={lastSavedAt}>{updatedLabel}</time>
                </>
              ) : (
                "Simpan otomatis aktif"
              )}
            </small>
          )}
        </div>
      </div>

      <div className="report-identity">
        <div className="identity-block period-block">
          <div className="identity-icon">
            <Icon name="calendar" size={19} />
          </div>
          <div className="identity-content">
            <div className="identity-title">Periode Laporan Triwulan</div>
            <div className="period-controls">
              <label className="meta-control" htmlFor="triwulan-quarter">
                <span>Triwulan</span>
                <select
                  id="triwulan-quarter"
                  name="quarter"
                  aria-label="Triwulan"
                  value={quarter}
                  onChange={(e) => switchPeriod(year, e.target.value)}
                >
                  {(["I", "II", "III", "IV"] as const).map((q) => {
                    const qState = getPeriodState(
                      data.periods[`${year}-${q}`],
                      nowMs,
                    )
                    const tag = formatPeriodStatusTag(qState.status)
                    return (
                      <option key={q} value={q}>
                        Triwulan {q} ({quarterDescriptions[q]}) [{tag}]
                      </option>
                    )
                  })}
                </select>
              </label>
              <label
                className="meta-control year-control"
                htmlFor="triwulan-year"
              >
                <span>Tahun</span>
                <select
                  id="triwulan-year"
                  name="year"
                  aria-label="Tahun pelaporan"
                  value={year}
                  onChange={(e) => switchPeriod(e.target.value, quarter)}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="selection-hint">
              <Icon name="calendar" size={13} />
              <span>
                Periode aktif:{" "}
                <strong>
                  Triwulan {data.quarter} · {data.year}
                </strong>
              </span>
              {(quarter !== data.quarter || year !== data.year) && (
                <button
                  type="button"
                  className="selection-reset-btn"
                  onClick={() => switchPeriod(data.year, data.quarter)}
                >
                  Gunakan periode aktif
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="identity-block organization-block">
          <div className="identity-icon teal">
            <Icon name="lock" size={18} />
          </div>
          <div className="identity-content">
            <div className="identity-title">
              Unit Organisasi{" "}
              <span className="session-lock-pill">Terkunci Sesi Login</span>
            </div>
            <div className="locked-session-unit-grid">
              <div className="locked-unit-field">
                <span>Unit Utama</span>
                <strong>{unit || "-"}</strong>
              </div>
              <div className="locked-unit-field">
                <span>Sub Unit / Bagian</span>
                <strong>{subUnit || unit || "-"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!prereq.canAccessTriwulan ? (
        <section
          className="panel prerequisite-locked-panel"
          aria-label="Prasyarat Sasaran Kinerja belum terpenuhi"
        >
          <div className="prerequisite-locked-icon" aria-hidden="true">
            <Icon name="lock" size={28} />
          </div>
          <h2>Modul Laporan Triwulan Terkunci (Prasyarat Sasaran Kinerja)</h2>
          <p>
            {prereq.status === "missing"
              ? `Unit ${lockedOrg.unitLabel} belum menginput Sasaran Kinerja Tahun ${year}. Sesuai alur hierarkis sistem, unit wajib mengisi dan merampungkan Sasaran Kinerja terlebih dahulu.`
              : prereq.status === "draft"
                ? `Sasaran Kinerja Tahun ${year} unit ${lockedOrg.unitLabel} masih berstatus Draf dan belum dikirim untuk verifikasi Admin PRP.`
                : prereq.status === "waiting"
                  ? `Sasaran Kinerja Tahun ${year} (${prereq.latestRecord?.id}) sedang menunggu persetujuan (ACC) dari Admin PRP. Begitu disetujui, seluruh sasaran strategis, program kerja, dan target otomatis tertarik ke halaman ini.`
                  : `Sasaran Kinerja Tahun ${year} (${prereq.latestRecord?.id}) dikembalikan dengan status Revisi oleh Admin PRP. Tuntaskan perbaikan revisi agar lembar kerja Triwulan terbuka otomatis.`}
          </p>
          <div className="prerequisite-locked-actions">
            {(prereq.status === "missing" || prereq.status === "draft") &&
              onOpenSasaranKinerja && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={onOpenSasaranKinerja}
                >
                  <Icon name="target" size={16} />
                  <span>
                    {prereq.status === "draft"
                      ? "Lanjutkan Draf Sasaran Kinerja"
                      : "Isi Sasaran Kinerja Sekarang"}
                  </span>
                </button>
              )}
            {onViewHistory && (
              <button
                type="button"
                className="secondary-button"
                onClick={onViewHistory}
              >
                <Icon name="history" size={15} />
                <span>Buka Riwayat Dokumen</span>
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="report-summary">
            <div>
              <span>
                <Icon name="clock" size={15} />
              </span>
              <p>
                Batas pengumpulan
                <strong>{formatDeadlineSummary(currentPeriod, nowMs)}</strong>
              </p>
            </div>
            <div>
              <span>
                <Icon name="chart" size={15} />
              </span>
              <p>
                Kelengkapan laporan
                <strong>{completeness}%</strong>
              </p>
            </div>
            <div className="summary-unit">
              <span>
                <Icon name="check" size={15} />
              </span>
              <p>
                Sumber RKA Disetujui
                <strong>{prereq.approvedRecord?.id ?? "-"}</strong>
              </p>
            </div>
          </div>

          {counts.late > 0 && (
            <div className="carryover-alert-banner" role="status">
              <Icon name="alert" size={18} />
              <div className="carryover-alert-copy">
                <strong>
                  Terdapat {counts.late} sasaran berstatus Terlambat / Carry-Over
                  dari Triwulan sebelumnya
                </strong>
                <span>
                  Item yang belum mencapai 100% pada triwulan targetnya otomatis
                  terbuka kembali untuk dikejar hingga 100% (melanjutkan capaian
                  akumulatif terakhir).
                </span>
              </div>
              {onOpenLateMonitoring && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onOpenLateMonitoring}
                >
                  Monitoring Keterlambatan
                </button>
              )}
            </div>
          )}

          {isPeriodLocked && (
            <div className="period-lock-banner" role="status">
              <Icon name="clock" size={18} />
              <div>
                <strong>
                  {activeDraftId !== null
                    ? "Periode Terkunci untuk Pengiriman Baru"
                    : "Periode Pelaporan Terkunci"}
                </strong>
                <span>
                  {lockReason}{" "}
                  {activeDraftId !== null
                    ? "Draf tersimpan tetap dapat ditinjau, namun pengiriman baru menunggu pembukaan waktu dari Admin PRP."
                    : "Pilih periode lain yang berstatus Dibuka, atau hubungi Admin PRP."}
                </span>
              </div>
            </div>
          )}

          <section className="panel matrix-grid-panel">
            <div className="matrix-grid-toolbar">
              <div className="matrix-grid-toolbar-copy">
                <h2>
                  Lembar Kerja Laporan Triwulan {quarter} · 13 Kolom Resmi
                </h2>
                <p>
                  Data Sasaran Strategis, Program Kerja {year}, Sasaran, dan
                  Bulan Pelaksanaan tersinkronisasi otomatis dari Sasaran
                  Kinerja yang telah disetujui (ACC). Klik baris untuk mengisi
                  progres di pop-up.
                </p>
              </div>
              <div className="matrix-filter-bar">
                <div
                  className="matrix-filter-pills"
                  role="tablist"
                  aria-label="Filter baris laporan triwulan"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={gridFilter === "all"}
                    className={gridFilter === "all" ? "is-active" : ""}
                    onClick={() => setGridFilter("all")}
                  >
                    Semua ({flatRows.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={gridFilter === "active"}
                    className={gridFilter === "active" ? "is-active" : ""}
                    onClick={() => setGridFilter("active")}
                  >
                    Aktif & Carry-Over ({counts.active})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={gridFilter === "late"}
                    className={gridFilter === "late" ? "is-active" : ""}
                    onClick={() => setGridFilter("late")}
                  >
                    Terlambat ({counts.late})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={gridFilter === "locked"}
                    className={gridFilter === "locked" ? "is-active" : ""}
                    onClick={() => setGridFilter("locked")}
                  >
                    Close 100% ({counts.locked})
                  </button>
                </div>
                <label
                  className="matrix-search-input"
                  htmlFor="triwulan-grid-search"
                >
                  <Icon name="search" size={15} />
                  <input
                    id="triwulan-grid-search"
                    name="triwulanGridSearch"
                    type="search"
                    placeholder="Cari sasaran, program, atau kendala..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="official-grid-scroll" data-lenis-prevent>
              <table className="triwulan-grid-table">
                <thead>
                  <tr>
                    <th className="th-blue col-no">No</th>
                    <th className="th-blue col-goal">Sasaran Strategis</th>
                    <th className="th-blue col-program">
                      Program Kerja {year}
                    </th>
                    <th className="th-blue col-sasaran">Sasaran</th>
                    <th className="th-blue col-months">
                      BULAN PELAKSANAAN PROGRAM KERJA
                    </th>
                    <th className="th-blue col-stage">
                      Tahap Pelaksanaan (Uraian)
                    </th>
                    <th className="th-blue col-realization">
                      Realisasi Pelaksanaan (Uraian)
                    </th>
                    <th className="th-blue col-pct">
                      Realisasi Pelaksanaan (%)
                    </th>
                    <th className="th-pink col-obstacle">
                      Kendala (diisi jika program kerja belum terlaksana)
                    </th>
                    <th className="th-pink col-solution">
                      Rencana Penyelesaian Kendala (diisi jika pencapaian
                      program kerja tidak sesuai dengan rencana)
                    </th>
                    <th className="th-pink col-soltime">
                      Waktu Penyelesaian kendala (diisi jika pencapaian program
                      kerja tidak sesuai dengan rencana)
                    </th>
                    <th className="th-green col-notes">KETERANGAN</th>
                    <th className="th-yellow col-evidence">Link Evidence</th>
                    <th className="th-action col-sticky-action">
                      Status & Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="matrix-empty-cell">
                        <div className="matrix-empty-state">
                          <Icon name="search" size={22} />
                          <strong>Tidak ada baris yang cocok dengan filter</strong>
                          <p>
                            Ubah tab filter di atas atau kosongkan kata kunci
                            pencarian untuk menampilkan seluruh program kerja.
                          </p>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setGridFilter("all")
                              setSearchQuery("")
                            }}
                          >
                            Tampilkan Semua Baris
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => {
                      const span = filteredMergeSpans[idx]
                      const s = row.sasaran
                      const isLocked = Boolean(s.isLockedCompleted)
                      const rowInvalid = attempted && !row.isComplete
                      const pctText = s.percentage.trim()
                        ? `${s.percentage.replace("%", "")}%`
                        : row.isFutureScheduled
                          ? "0%"
                          : "Belum diisi"

                      return (
                        <tr
                          key={`${row.programId}-${row.sasaranId}`}
                          className={[
                            "matrix-clickable-row",
                            isLocked && "is-locked-completed",
                            s.lateStatus === "Terlambat" && "is-late-row",
                            s.lateStatus === "Pencapaian Terlambat" &&
                              "is-late-achieved-row",
                            rowInvalid && "is-row-invalid",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => openRowModal(row)}
                        >
                          {span.noSpan > 0 && (
                            <td
                              className="col-no is-merged-cell"
                              rowSpan={span.noSpan}
                            >
                              {span.groupNumber}
                            </td>
                          )}
                          {span.goalSpan > 0 && (
                            <td
                              className="col-goal is-merged-cell"
                              rowSpan={span.goalSpan}
                            >
                              <strong>{row.strategicGoal}</strong>
                            </td>
                          )}
                          {span.programSpan > 0 && (
                            <td
                              className="col-program is-merged-cell"
                              rowSpan={span.programSpan}
                            >
                              <span>{row.programName}</span>
                            </td>
                          )}
                          <td className="col-sasaran">
                            <span>{s.target || "-"}</span>
                          </td>
                          <td className="col-months">
                            <span>
                              {formatBulanPelaksanaan(s.monthStart, s.monthEnd)}
                            </span>
                            <small className="cell-sub-meta">
                              Target TW {row.targetQuarter}
                            </small>
                          </td>
                          <td className="col-stage">
                            <span>
                              {s.stage || (row.isFutureScheduled ? "-" : "Klik untuk isi...")}
                            </span>
                            {s.stageTargetTime && (
                              <small className="cell-sub-meta">
                                Target: {s.stageTargetTime}
                              </small>
                            )}
                          </td>
                          <td className="col-realization">
                            <span>{s.realization || "-"}</span>
                          </td>
                          <td className="col-pct">
                            <strong
                              className={
                                Number(s.percentage) >= 100
                                  ? "pct-pill is-full"
                                  : s.percentage !== ""
                                    ? "pct-pill is-partial"
                                    : "pct-pill is-empty"
                              }
                            >
                              {pctText}
                            </strong>
                            {(s.priorPercentage ?? 0) > 0 && !isLocked && (
                              <small className="cell-sub-meta">
                                Awal: {s.priorPercentage}%
                              </small>
                            )}
                          </td>
                          <td className="col-obstacle">
                            <span>{s.obstacle || "-"}</span>
                          </td>
                          <td className="col-solution">
                            <span>{s.solution || "-"}</span>
                          </td>
                          <td className="col-soltime">
                            <span>{s.solutionTime || "-"}</span>
                          </td>
                          <td className="col-notes">
                            <div className="notes-stack">
                              {s.lateStatus === "Terlambat" && (
                                <span className="late-badge is-overdue">
                                  Terlambat (Target TW {row.targetQuarter})
                                </span>
                              )}
                              {s.lateStatus === "Pencapaian Terlambat" && (
                                <span className="late-badge is-late-done">
                                  Pencapaian Terlambat
                                </span>
                              )}
                              {isLocked && (
                                <span className="late-badge is-closed-100">
                                  Close 100% (TW {s.completedInQuarter})
                                </span>
                              )}
                              <span>
                                {s.notes ||
                                  (row.isFutureScheduled
                                    ? `Mulai TW ${row.startQuarter}`
                                    : "-")}
                              </span>
                            </div>
                          </td>
                          <td
                            className="col-evidence"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.evidence && /^https?:\/\/\S+$/i.test(s.evidence.trim()) ? (
                              <a
                                href={s.evidence.trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="grid-evidence-link"
                              >
                                Buka Dokumen
                              </a>
                            ) : (
                              <span>{s.evidence || "-"}</span>
                            )}
                          </td>
                          <td
                            className="col-sticky-action"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isLocked ? (
                              <button
                                type="button"
                                className="matrix-btn-locked"
                                onClick={() => openRowModal(row)}
                              >
                                <Icon name="lock" size={13} />
                                <span>Close 100%</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={
                                  row.isComplete
                                    ? "matrix-btn-edit"
                                    : "matrix-btn-fill"
                                }
                                disabled={isLockedForNewInput}
                                onClick={() => openRowModal(row)}
                              >
                                {row.isComplete ? "Perbarui" : "Isi Progres"}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="report-actions">
            <span>
              {flatRows.filter((r) => r.isComplete).length}/{flatRows.length}{" "}
              baris siap · Kelengkapan <strong>{completeness}%</strong>
            </span>
            <div>
              <button
                type="button"
                className="secondary-button preview-button"
                disabled={flatRows.length === 0}
                onClick={() => setPreviewOpen(true)}
              >
                <Icon name="eye" size={15} /> Pratinjau
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isLockedForNewInput || flatRows.length === 0}
                onClick={saveDraft}
              >
                Simpan Draf
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isPeriodLocked || flatRows.length === 0}
                onClick={requestSubmit}
              >
                Kirim Laporan <Icon name="send" size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {modalState && (
          <motion.div
            className="submit-success-overlay triwulan-row-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="triwulan-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="triwulan-row-modal is-wide"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="triwulan-row-modal-head">
                <div>
                  <span className="triwulan-modal-kicker">
                    TRIWULAN {quarter} · {year} ·{" "}
                    {lockedOrg.unitLabel.toUpperCase()}
                  </span>
                  <h2 id="triwulan-modal-title">
                    {modalState.isLockedCompleted
                      ? "Detail Program Terkunci (Selesai 100%)"
                      : "Pengisian Progres & Realisasi Program Kerja"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="triwulan-modal-close"
                  aria-label="Tutup jendela pengisian"
                  onClick={() => {
                    setModalState(null)
                    setModalError("")
                  }}
                >
                  ×
                </button>
              </header>

              <div className="triwulan-row-modal-body" data-lenis-prevent>
              <div className="inherited-rka-summary">
                <div>
                  <span>Sasaran Strategis</span>
                  <strong>{modalState.strategicGoal}</strong>
                </div>
                <div>
                  <span>Program Kerja {year}</span>
                  <strong>{modalState.programName}</strong>
                </div>
                <div>
                  <span>Sasaran Kinerja</span>
                  <strong>{modalState.target}</strong>
                </div>
                <div>
                  <span>Jadwal Pelaksanaan</span>
                  <strong>
                    {formatBulanPelaksanaan(
                      modalState.monthStart,
                      modalState.monthEnd,
                    )}{" "}
                    (Target TW {modalState.targetQuarter})
                  </strong>
                </div>
              </div>

              {modalState.isLockedCompleted && (
                <div className="locked-100-callout" role="status">
                  <Icon name="lock" size={18} />
                  <div>
                    <strong>
                      Status Close / Terkunci Otomatis (Tervalidasi 100% di
                      Triwulan {modalState.completedInQuarter})
                    </strong>
                    <span>
                      Program ini sudah mencapai realisasi 100% dan disetujui
                      Admin PRP pada triwulan sebelumnya sehingga bersifat
                      read-only pada periode berikutnya.
                    </span>
                  </div>
                </div>
              )}

              {!modalState.isLockedCompleted &&
                modalState.carryOverFromQuarter && (
                  <div className="carryover-modal-callout" role="status">
                    <Icon name="alert" size={17} />
                    <div>
                      <strong>
                        Carry-Over Akumulatif dari Triwulan{" "}
                        {modalState.carryOverFromQuarter} (Capaian Terakhir:{" "}
                        {modalState.priorPercentage}%)
                      </strong>
                      <span>
                        Lanjutkan pengisian progres mulai dari{" "}
                        {modalState.priorPercentage}% hingga mencapai 100%.
                        {compareQuarters(quarter, modalState.targetQuarter) >
                          0 &&
                          " Karena melewati periode target awal, sistem menandai catatan keterlambatan secara otomatis."}
                      </span>
                    </div>
                  </div>
                )}

              {modalError && (
                <div className="login-error" role="alert">
                  <span aria-hidden="true">!</span>
                  <span>{modalError}</span>
                </div>
              )}

              <div className="modal-form-two-col">
                <label className="modal-form-field" htmlFor="tw-modal-stage">
                  <span>
                    Tahap Pelaksanaan (Uraian) <b>*</b>
                  </span>
                  <textarea
                    id="tw-modal-stage"
                    name="stage"
                    rows={3}
                    readOnly={modalState.isLockedCompleted}
                    placeholder="Uraikan tahapan pelaksanaan kegiatan pada triwulan ini..."
                    value={modalState.stage}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev ? { ...prev, stage: e.target.value } : prev,
                      )
                    }
                  />
                </label>

                <label
                  className="modal-form-field"
                  htmlFor="tw-modal-realization"
                >
                  <span>
                    Realisasi Pelaksanaan (Uraian) <b>*</b>
                  </span>
                  <textarea
                    id="tw-modal-realization"
                    name="realization"
                    rows={3}
                    readOnly={modalState.isLockedCompleted}
                    placeholder="Uraikan hasil capaian konkret yang telah terealisasi..."
                    value={modalState.realization}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev ? { ...prev, realization: e.target.value } : prev,
                      )
                    }
                  />
                </label>
              </div>

              <div className="modal-form-two-col">
                <div className="modal-form-field">
                  <label htmlFor="tw-modal-percentage">
                    <span>
                      Realisasi Pelaksanaan (%) Akumulatif <b>*</b>{" "}
                      {modalState.priorPercentage > 0 && (
                        <small>(Min. {modalState.priorPercentage}%)</small>
                      )}
                    </span>
                  </label>
                  <div className="pct-input-row">
                    <input
                      id="tw-modal-percentage"
                      name="percentage"
                      type="number"
                      min={modalState.priorPercentage}
                      max={100}
                      readOnly={modalState.isLockedCompleted}
                      placeholder={`${modalState.priorPercentage} - 100`}
                      value={modalState.percentage}
                      onChange={(e) =>
                        setModalState((prev) =>
                          prev ? { ...prev, percentage: e.target.value } : prev,
                        )
                      }
                    />
                    {!modalState.isLockedCompleted && (
                      <div className="pct-quick-btns">
                        {[
                          Math.min(100, Math.max(25, modalState.priorPercentage + 15)),
                          Math.min(100, Math.max(50, modalState.priorPercentage + 25)),
                          100,
                        ]
                          .filter((v, i, arr) => arr.indexOf(v) === i && v >= modalState.priorPercentage)
                          .map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                setModalState((prev) =>
                                  prev
                                    ? { ...prev, percentage: String(preset) }
                                    : prev,
                                )
                              }
                            >
                              {preset}%
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <label
                  className="modal-form-field"
                  htmlFor="tw-modal-stage-time"
                >
                  <span>
                    Target Waktu Tahap <small>(Opsional)</small>
                  </span>
                  <input
                    id="tw-modal-stage-time"
                    name="stageTargetTime"
                    type="text"
                    readOnly={modalState.isLockedCompleted}
                    placeholder="Contoh: Minggu ke-3 Agustus 2026"
                    value={modalState.stageTargetTime}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev
                          ? { ...prev, stageTargetTime: e.target.value }
                          : prev,
                      )
                    }
                  />
                </label>
              </div>

              {(modalState.percentage.trim() === "" ||
                Number(modalState.percentage) < 100) &&
                !modalState.isLockedCompleted && (
                  <div className="modal-obstacle-box">
                    <div className="modal-obstacle-head">
                      <strong>
                        Penanganan Kendala (Wajib diisi jika capaian di bawah
                        100%)
                      </strong>
                      <span>
                        Sesuai kolom merah muda pada tabel resmi Laporan
                        Triwulan.
                      </span>
                    </div>
                    <div className="modal-form-three-col">
                      <label
                        className="modal-form-field"
                        htmlFor="tw-modal-obstacle"
                      >
                        <span>
                          Kendala <b>*</b>
                        </span>
                        <textarea
                          id="tw-modal-obstacle"
                          name="obstacle"
                          rows={2}
                          placeholder="Jelaskan kendala penyebab program belum 100%..."
                          value={modalState.obstacle}
                          onChange={(e) =>
                            setModalState((prev) =>
                              prev
                                ? { ...prev, obstacle: e.target.value }
                                : prev,
                            )
                          }
                        />
                      </label>
                      <label
                        className="modal-form-field"
                        htmlFor="tw-modal-solution"
                      >
                        <span>
                          Rencana Penyelesaian Kendala <b>*</b>
                        </span>
                        <textarea
                          id="tw-modal-solution"
                          name="solution"
                          rows={2}
                          placeholder="Langkah tindak lanjut untuk mencapai 100%..."
                          value={modalState.solution}
                          onChange={(e) =>
                            setModalState((prev) =>
                              prev
                                ? { ...prev, solution: e.target.value }
                                : prev,
                            )
                          }
                        />
                      </label>
                      <label
                        className="modal-form-field"
                        htmlFor="tw-modal-soltime"
                      >
                        <span>
                          Waktu Penyelesaian Kendala <b>*</b>
                        </span>
                        <input
                          id="tw-modal-soltime"
                          name="solutionTime"
                          type="text"
                          placeholder="Contoh: Akhir Oktober 2026"
                          value={modalState.solutionTime}
                          onChange={(e) =>
                            setModalState((prev) =>
                              prev
                                ? { ...prev, solutionTime: e.target.value }
                                : prev,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

              <div className="modal-form-two-col">
                <label className="modal-form-field" htmlFor="tw-modal-notes">
                  <span>Keterangan</span>
                  <textarea
                    id="tw-modal-notes"
                    name="notes"
                    rows={2}
                    readOnly={modalState.isLockedCompleted}
                    placeholder="Catatan tambahan pelaksanaan..."
                    value={modalState.notes}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev ? { ...prev, notes: e.target.value } : prev,
                      )
                    }
                  />
                </label>

                <label className="modal-form-field" htmlFor="tw-modal-evidence">
                  <span>Link Evidence (Tautan Bukti Dokumen)</span>
                  <input
                    id="tw-modal-evidence"
                    name="evidence"
                    type="url"
                    readOnly={modalState.isLockedCompleted}
                    placeholder="https://drive.google.com/..."
                    value={modalState.evidence}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev ? { ...prev, evidence: e.target.value } : prev,
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <footer className="triwulan-row-modal-foot">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setModalState(null)
                  setModalError("")
                }}
              >
                {modalState.isLockedCompleted ? "Tutup" : "Batal"}
              </button>
              {!modalState.isLockedCompleted && (
                <div className="triwulan-modal-foot-right">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => applyRowModal("saveDraft")}
                  >
                    Simpan Draf
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => applyRowModal("nextRow")}
                  >
                    Simpan & Baris Berikutnya
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => applyRowModal("apply")}
                  >
                    <Icon name="check" size={15} />
                    <span>Simpan Baris</span>
                  </button>
                </div>
              )}
            </footer>
            </motion.div>
            <button
              type="button"
              className="overlay-close"
              aria-label="Tutup jendela pengisian"
              onClick={() => {
                setModalState(null)
                setModalError("")
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <DetailModal
        record={previewRecord}
        isDraftPreview
        onClose={() => setPreviewOpen(false)}
        onExportExcel={(rec) => notify(exportRecordExcel(rec))}
        onPrintPreview={(rec) => {
          setPreviewOpen(false)
          setPrintPreviewRecord(rec)
        }}
      />
      <PrintPreviewModal
        record={printPreviewRecord}
        onClose={() => setPrintPreviewRecord(null)}
        confirmSubmitLabel="Kirim Laporan"
        confirmSubmitDisabled={isPeriodLocked}
        onConfirmSubmit={requestSubmit}
      />
      <SubmitConfirmModal
        info={confirmInfo}
        onCancel={() => setConfirmInfo(null)}
        onConfirm={commitSubmit}
      />
      <SubmitSuccessModal
        info={successInfo}
        onClose={() => {
          setSuccessInfo(null)
          onViewHistory?.()
        }}
      />
    </div>
  )
}
export default InputLaporanTriwulan
