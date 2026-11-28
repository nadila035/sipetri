import { useMemo, useRef, useState } from "react"
import type { SetStateAction } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  describePeriodLockReason,
  formatDeadlineSummary,
  formatPeriodStatusTag,
  getPeriodState,
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
  buildSasaranKinerjaItems,
  calculateSasaranKinerjaCompleteness,
  createEmptyCriteria,
  createEmptySasaran,
  extractFlatSasaranRows,
  formatUpdatedAtLabel,
  hasCriteriaContent,
  insertItemAt,
  normalizeCriteriaList,
  promoteDraftToSubmitted,
  rebuildCriteriaFromFlatRows,
  upsertDraftRecord,
  type FlatSasaranInputRow,
} from "../utils/drafts"
import {
  computeTableMergeSpans,
  formatBulanPelaksanaan,
} from "../utils/format"
import { exportRecordExcel } from "../utils/exportExcel"
import {
  getUnitAnnualPrerequisiteState,
  recordMatchesUnitCode,
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
import type { CriteriaItem, HistoryRecord, NotifyFn } from "../types"

type InputSasaranKinerjaProps = {
  notify: NotifyFn
  resumeDraftId?: string | null
  onViewHistory?: () => void
  onOpenTriwulan?: () => void
}

type FlatSasaranRow = FlatSasaranInputRow & {
  rowIndex: number
  rowNumber: number
  isComplete: boolean
}

type ModalEditorState = {
  mode: "create" | "edit" | "addSasaranToProgram"
  groupNumber?: number
  rowIndex?: number
  sasaranId?: string
  strategicGoalId: string
  strategicGoal: string
  programName: string
  sasaranText: string
  bulanMulai: string
  bulanSelesai: string
  keterangan: string
}

export function InputSasaranKinerja({
  notify,
  resumeDraftId = null,
  onViewHistory,
  onOpenTriwulan,
}: InputSasaranKinerjaProps) {
  const { data, setData, storageError, nowMs } = useReporting()
  const { session } = useAuth()
  const lockedOrg = getSessionLockedOrganization(session)
  const unit = lockedOrg.unit
  const subUnit = lockedOrg.subUnit

  const findDraftForYear = (targetYear: string) =>
    data.records.find(
      (record) =>
        record.type === "Sasaran Kinerja" &&
        record.status === "Draf" &&
        record.period === `Tahun ${targetYear}` &&
        recordMatchesUnitCode(record, subUnit),
    )

  const initialResumeRecord = resumeDraftId
    ? data.records.find(
        (record) =>
          record.id === resumeDraftId &&
          record.type === "Sasaran Kinerja" &&
          record.status === "Draf" &&
          recordBelongsToSession(record, session),
      )
    : findDraftForYear(data.year)

  const [draftYear, setDraftYearState] = useState<string>(
    () => initialResumeRecord?.period.match(/\b\d{4}\b/)?.[0] ?? data.year,
  )
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    () => initialResumeRecord?.id ?? null,
  )
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    () => initialResumeRecord?.updatedAt ?? "",
  )
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(
    () => initialResumeRecord?.updatedAt ?? "",
  )
  const [criteria, setCriteriaState] = useState<CriteriaItem[]>(() =>
    initialResumeRecord?.criteriaData?.length
      ? normalizeCriteriaList(initialResumeRecord.criteriaData)
      : [],
  )

  const [modalState, setModalState] = useState<ModalEditorState | null>(null)
  const [modalError, setModalError] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printPreviewRecord, setPrintPreviewRecord] =
    useState<HistoryRecord | null>(null)
  const [confirmInfo, setConfirmInfo] = useState<SubmitConfirmInfo | null>(null)
  const [successInfo, setSuccessInfo] = useState<SubmitSuccessInfo | null>(null)
  const [attempted, setAttempted] = useState(false)

  useDialog(
    Boolean(modalState),
    () => {
      setModalState(null)
      setModalError("")
    },
    ".sasaran-row-modal-overlay",
  )

  const yearOptions = Array.from(
    new Set([...collectReportingYears(data), draftYear]),
  )
  const annualPeriod = data.periods[`${draftYear}-annual`]
  const periodState = getPeriodState(annualPeriod, nowMs)
  const isPeriodLocked = !periodState.canSubmit
  const isLockedForNewInput = isPeriodLocked && activeDraftId === null
  const lockReason = describePeriodLockReason(
    annualPeriod,
    `Sasaran Kinerja Tahun ${draftYear}`,
    nowMs,
  )

  const annualPrereq = getUnitAnnualPrerequisiteState(
    data.records,
    draftYear,
    subUnit,
  )
  const hasSubmittedAnnual =
    annualPrereq.status === "approved" ||
    annualPrereq.status === "waiting" ||
    annualPrereq.status === "revision"

  const strategicGoals = data.strategicGoals ?? []

  const stateRef = useRef({ criteria, draftYear, activeDraftId })
  stateRef.current = { criteria, draftYear, activeDraftId }

  const buildDraft = (
    draftId: string,
    snapshot: {
      criteria: CriteriaItem[]
      draftYear: string
    },
    nowIso: string,
  ): HistoryRecord => {
    const normalized =
      snapshot.criteria.length > 0
        ? snapshot.criteria
        : [createEmptyCriteria()]
    return {
      id: draftId,
      author: session?.displayName || "Staf Unit",
      type: "Sasaran Kinerja",
      title: `Sasaran Kinerja Tahun ${snapshot.draftYear}`,
      period: `Tahun ${snapshot.draftYear}`,
      unit: subUnit || unit,
      parentUnit: unit,
      subUnit: subUnit || unit,
      sentAt: "Belum dikirim",
      updatedAt: nowIso,
      status: "Draf",
      progress:
        snapshot.criteria.length > 0
          ? calculateSasaranKinerjaCompleteness(normalized)
          : 0,
      criteriaData: normalized,
      items: buildSasaranKinerjaItems(normalized),
    }
  }

  const persistDraftImmediate = (
    nextCriteria: CriteriaItem[],
    targetYear = stateRef.current.draftYear,
    explicitToast?: string,
  ) => {
    const nowIso = new Date().toISOString()
    const draftId =
      stateRef.current.activeDraftId ??
      `DRAF-SK-${targetYear}-${subUnit.toLowerCase()}-${crypto.randomUUID().slice(0, 6)}`
    const draftRecord = buildDraft(
      draftId,
      { criteria: nextCriteria, draftYear: targetYear },
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
    if (explicitToast) {
      notify(explicitToast)
    }
  }

  const setCriteria = (update: SetStateAction<CriteriaItem[]>) => {
    const prev = stateRef.current
    const next = typeof update === "function" ? update(prev.criteria) : update
    stateRef.current = { ...prev, criteria: next }
    setCriteriaState(next)
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
            { criteria: next, draftYear: prev.draftYear },
            nowIso,
          ),
        ),
      }))
    }
  }

  const handleChangeYear = (nextYear: string) => {
    const existingDraft = findDraftForYear(nextYear)
    setDraftYearState(nextYear)
    setAttempted(false)
    if (existingDraft) {
      const normalized = existingDraft.criteriaData?.length
        ? normalizeCriteriaList(existingDraft.criteriaData)
        : []
      setActiveDraftId(existingDraft.id)
      setCriteriaState(normalized)
      setLastSavedAt(existingDraft.updatedAt ?? "")
      setLastModifiedAt(existingDraft.updatedAt ?? "")
      stateRef.current = {
        criteria: normalized,
        draftYear: nextYear,
        activeDraftId: existingDraft.id,
      }
    } else {
      setActiveDraftId(null)
      setCriteriaState([])
      setLastSavedAt("")
      setLastModifiedAt("")
      stateRef.current = {
        criteria: [],
        draftYear: nextYear,
        activeDraftId: null,
      }
    }
  }

  useConfirmableUnsavedChanges(
    activeDraftId === null &&
      criteria.length > 0 &&
      hasCriteriaContent(criteria, "", ""),
    "Isian sasaran kinerja belum disimpan sebagai draf. Tetap tinggalkan halaman?",
  )

  const flatRows = useMemo<FlatSasaranRow[]>(() => {
    const rawRows = extractFlatSasaranRows(criteria)
    return rawRows.map((entry, idx) => {
      const validDates =
        Boolean(entry.bulanMulai) &&
        (!entry.bulanSelesai || entry.bulanSelesai >= entry.bulanMulai)
      return {
        ...entry,
        rowIndex: idx,
        rowNumber: idx + 1,
        isComplete: Boolean(
          entry.strategicGoal.trim() &&
            entry.programName.trim() &&
            entry.sasaranText.trim() &&
            validDates,
        ),
      }
    })
  }, [criteria])

  const mergeSpans = useMemo(
    () => computeTableMergeSpans(flatRows),
    [flatRows],
  )

  const existingProgramSuggestions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of flatRows) {
      const clean = r.programName.trim()
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase())
        out.push(clean)
      }
    }
    return out
  }, [flatRows])

  const openCreateModal = () => {
    if (isLockedForNewInput) {
      notify(
        `${lockReason} Pilih tahun periode yang terbuka atau hubungi Admin PRP.`,
        "error",
      )
      return
    }
    setModalError("")
    setModalState({
      mode: "create",
      strategicGoalId: "",
      strategicGoal: "",
      programName: "",
      sasaranText: "",
      bulanMulai: `${draftYear}-01`,
      bulanSelesai: `${draftYear}-12`,
      keterangan: "",
    })
  }

  const openAddSasaranToProgram = (
    row: FlatSasaranRow,
    groupNumber: number,
  ) => {
    const matchedGoal = strategicGoals.find(
      (g) =>
        (row.strategicGoalId && g.id === row.strategicGoalId) ||
        g.name.trim().toLowerCase() === row.strategicGoal.trim().toLowerCase(),
    )
    setModalError("")
    setModalState({
      mode: "addSasaranToProgram",
      groupNumber,
      rowIndex: row.rowIndex,
      strategicGoalId: matchedGoal?.id ?? row.strategicGoalId,
      strategicGoal: matchedGoal?.name ?? row.strategicGoal,
      programName: row.programName,
      sasaranText: "",
      bulanMulai: row.bulanMulai || `${draftYear}-01`,
      bulanSelesai: row.bulanSelesai || `${draftYear}-12`,
      keterangan: "",
    })
  }

  const openEditRowModal = (row: FlatSasaranRow, groupNumber: number) => {
    const matchedGoal = strategicGoals.find(
      (g) =>
        (row.strategicGoalId && g.id === row.strategicGoalId) ||
        g.name.trim().toLowerCase() === row.strategicGoal.trim().toLowerCase(),
    )
    setModalError("")
    setModalState({
      mode: "edit",
      groupNumber,
      rowIndex: row.rowIndex,
      sasaranId: row.sasaranId,
      strategicGoalId: matchedGoal?.id ?? row.strategicGoalId,
      strategicGoal: matchedGoal?.name ?? row.strategicGoal,
      programName: row.programName,
      sasaranText: row.sasaranText,
      bulanMulai: row.bulanMulai,
      bulanSelesai: row.bulanSelesai,
      keterangan: row.keterangan,
    })
  }

  const applyModalChanges = (saveAsPersistentDraft: boolean) => {
    if (!modalState) return
    const goalName = modalState.strategicGoal.trim()
    const progName = modalState.programName.trim()
    const sasText = modalState.sasaranText.trim()
    const bMulai = modalState.bulanMulai.trim()
    const bSelesai = modalState.bulanSelesai.trim()
    const ket = modalState.keterangan.trim()

    if (!saveAsPersistentDraft) {
      if (!goalName) {
        setModalError(
          "Pilih Sasaran Strategis dari daftar pilihan terlebih dahulu.",
        )
        return
      }
      if (!progName) {
        setModalError("Nama Program Kerja wajib diisi.")
        return
      }
      if (!sasText) {
        setModalError("Uraian Sasaran Kinerja wajib diisi.")
        return
      }
      if (!bMulai) {
        setModalError("Bulan mulai pelaksanaan wajib dipilih.")
        return
      }
    }
    if (bMulai && bSelesai && bSelesai < bMulai) {
      setModalError(
        "Bulan selesai tidak boleh lebih awal daripada bulan mulai pelaksanaan.",
      )
      return
    }

    const matchedGoal = strategicGoals.find(
      (g) =>
        (modalState.strategicGoalId && g.id === modalState.strategicGoalId) ||
        g.name.trim().toLowerCase() === goalName.toLowerCase(),
    )
    const resolvedGoalId = matchedGoal?.id ?? modalState.strategicGoalId
    const resolvedGoalName = matchedGoal?.name ?? goalName

    const currentRows = extractFlatSasaranRows(criteria)
    const norm = (val: string) => val.trim().replace(/\s+/g, " ").toLowerCase()
    const goalKey = norm(resolvedGoalName)
    const progKey = norm(progName)

    let nextFlatRows: FlatSasaranInputRow[]

    if (
      modalState.mode === "edit" &&
      typeof modalState.rowIndex === "number" &&
      modalState.rowIndex >= 0 &&
      modalState.rowIndex < currentRows.length
    ) {
      const targetRow = currentRows[modalState.rowIndex]
      const sameGoal = norm(targetRow.strategicGoal) === goalKey
      const sameProg = norm(targetRow.programName) === progKey
      const updatedEntry: FlatSasaranInputRow = {
        criteriaId: sameGoal ? targetRow.criteriaId : undefined,
        strategyId: sameGoal ? targetRow.strategyId : undefined,
        strategicGoalId: resolvedGoalId,
        strategicGoal: resolvedGoalName,
        programId: sameGoal && sameProg ? targetRow.programId : undefined,
        programName: progName,
        sasaranId: modalState.sasaranId || targetRow.sasaranId,
        sasaranText: sasText,
        bulanMulai: bMulai,
        bulanSelesai: bSelesai,
        keterangan: ket,
      }
      nextFlatRows = currentRows.map((item, idx) =>
        idx === modalState.rowIndex ? updatedEntry : item,
      )
    } else if (
      modalState.mode === "addSasaranToProgram" &&
      typeof modalState.rowIndex === "number" &&
      modalState.rowIndex >= 0 &&
      modalState.rowIndex < currentRows.length
    ) {
      const baseRow = currentRows[modalState.rowIndex]
      const sameGoal = norm(baseRow.strategicGoal) === goalKey
      const sameProg = norm(baseRow.programName) === progKey
      const newEntry: FlatSasaranInputRow = {
        criteriaId: sameGoal ? baseRow.criteriaId : undefined,
        strategyId: sameGoal ? baseRow.strategyId : undefined,
        strategicGoalId: resolvedGoalId,
        strategicGoal: resolvedGoalName,
        programId: sameGoal && sameProg ? baseRow.programId : undefined,
        programName: progName,
        sasaranId: createEmptySasaran().id,
        sasaranText: sasText,
        bulanMulai: bMulai,
        bulanSelesai: bSelesai,
        keterangan: ket,
      }
      let insertAt = modalState.rowIndex + 1
      if (sameGoal && sameProg) {
        while (
          insertAt < currentRows.length &&
          norm(currentRows[insertAt].strategicGoal) === goalKey &&
          norm(currentRows[insertAt].programName) === progKey
        ) {
          insertAt += 1
        }
      }
      nextFlatRows = insertItemAt(currentRows, insertAt, newEntry)
    } else {
      const newEntry: FlatSasaranInputRow = {
        strategicGoalId: resolvedGoalId,
        strategicGoal: resolvedGoalName,
        programName: progName,
        sasaranId: createEmptySasaran().id,
        sasaranText: sasText,
        bulanMulai: bMulai,
        bulanSelesai: bSelesai,
        keterangan: ket,
      }

      let insertAt = currentRows.length
      if (goalKey && progKey) {
        let lastMatchingGoalProg = -1
        let lastMatchingGoal = -1
        for (let i = 0; i < currentRows.length; i++) {
          if (norm(currentRows[i].strategicGoal) === goalKey) {
            lastMatchingGoal = i
            if (norm(currentRows[i].programName) === progKey) {
              lastMatchingGoalProg = i
            }
          }
        }
        if (lastMatchingGoalProg >= 0) {
          insertAt = lastMatchingGoalProg + 1
          newEntry.criteriaId = currentRows[lastMatchingGoalProg].criteriaId
          newEntry.strategyId = currentRows[lastMatchingGoalProg].strategyId
          newEntry.programId = currentRows[lastMatchingGoalProg].programId
        } else if (lastMatchingGoal >= 0) {
          insertAt = lastMatchingGoal + 1
          newEntry.criteriaId = currentRows[lastMatchingGoal].criteriaId
          newEntry.strategyId = currentRows[lastMatchingGoal].strategyId
        }
      }

      nextFlatRows = insertItemAt(currentRows, insertAt, newEntry)
    }

    const nextCriteria = rebuildCriteriaFromFlatRows(nextFlatRows)
    setCriteria(nextCriteria)
    if (saveAsPersistentDraft) {
      persistDraftImmediate(
        nextCriteria,
        draftYear,
        "Draf Sasaran Kinerja berhasil disimpan.",
      )
    }
    setModalState(null)
    setModalError("")
  }

  const removeFlatRow = (row: FlatSasaranRow) => {
    const currentRows = extractFlatSasaranRows(criteria)
    const remaining = currentRows.filter((_, idx) => idx !== row.rowIndex)
    setCriteria(rebuildCriteriaFromFlatRows(remaining))
  }

  const completeness =
    flatRows.length > 0
      ? Math.round(
          (flatRows.filter((r) => r.isComplete).length / flatRows.length) * 100,
        )
      : 0

  const incomplete =
    flatRows.length === 0 || flatRows.some((row) => !row.isComplete)

  const saveDraft = () => {
    if (isLockedForNewInput) {
      notify(
        `${lockReason} Pilih tahun periode yang terbuka atau hubungi Admin PRP.`,
        "error",
      )
      return
    }
    persistDraftImmediate(
      criteria,
      draftYear,
      activeDraftId
        ? "Draf Sasaran Kinerja berhasil diperbarui."
        : "Draf Sasaran Kinerja disimpan. Simpan otomatis kini aktif.",
    )
  }

  const requestSubmit = (): boolean => {
    setAttempted(true)
    if (isPeriodLocked) {
      setPreviewOpen(false)
      setPrintPreviewRecord(null)
      notify(
        `${lockReason} Perbaikan revisi tetap dapat dikirim melalui Riwayat.`,
        "error",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return false
    }
    if (incomplete) {
      setPreviewOpen(false)
      setPrintPreviewRecord(null)
      notify(
        flatRows.length === 0
          ? "Tambahkan minimal 1 baris Sasaran Kinerja sebelum mengirim dokumen."
          : "Lengkapi Sasaran Strategis, Program Kerja, Sasaran Kinerja, dan Bulan Pelaksanaan pada seluruh baris sebelum mengirim.",
        "error",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return false
    }

    const uniqueGoals = new Set(
      flatRows.map((r) => r.strategicGoal.trim().toLowerCase()),
    ).size
    const uniquePrograms = new Set(
      flatRows.map(
        (r) =>
          `${r.strategicGoal.trim().toLowerCase()}||${r.programName.trim().toLowerCase()}`,
      ),
    ).size

    setConfirmInfo({
      title: "Konfirmasi Pengiriman Sasaran Kinerja",
      description:
        "Setelah dikirim dan disetujui (ACC) oleh Admin PRP, seluruh Sasaran Strategis, Program Kerja, dan Sasaran Kinerja ini akan otomatis tertarik ke lembar kerja Laporan Triwulan unit Anda.",
      documentTitle: `Sasaran Kinerja Tahun ${draftYear}`,
      period: `Tahun ${draftYear}`,
      unit: lockedOrg.unitLabel,
      summary: `${uniqueGoals} sasaran strategis · ${uniquePrograms} program kerja · ${flatRows.length} sasaran kinerja`,
      cancelLabel: "Cek Kembali",
      confirmLabel: "Ya, Kirim Sasaran",
    })
    return true
  }

  const commitSubmit = () => {
    setConfirmInfo(null)
    setPreviewOpen(false)
    setPrintPreviewRecord(null)

    const sentAt = new Date().toLocaleString("id-ID")
    const submittedRecord: HistoryRecord = {
      id: `SK-${draftYear}-${subUnit}-${crypto.randomUUID().slice(0, 6)}`,
      author: session?.displayName || "Staf Unit",
      type: "Sasaran Kinerja",
      title: `Sasaran Kinerja Tahun ${draftYear}`,
      period: `Tahun ${draftYear}`,
      unit: subUnit || unit,
      parentUnit: unit,
      subUnit: subUnit || unit,
      sentAt,
      status: "Menunggu",
      progress: 100,
      criteriaData: criteria,
      items: buildSasaranKinerjaItems(criteria),
    }

    const unitLabel = formatRecordUnitLabel(submittedRecord)
    const adminNotif = createAppNotification({
      recipient: "admin",
      category: "document_submitted",
      title: submittedRecord.title,
      message: `${unitLabel} · ${submittedRecord.period} menunggu verifikasi dan persetujuan (ACC).`,
      actor: `${submittedRecord.author || "Staf Unit"} (${unitLabel})`,
      targetMenu: "Verifikasi Sasaran Kinerja",
      recordId: submittedRecord.id,
      unitLabel,
      periodLabel: submittedRecord.period,
    })

    setData((current) => ({
      ...current,
      targetDraft: false,
      records: promoteDraftToSubmitted(
        current.records,
        activeDraftId,
        submittedRecord,
      ),
      notifications: appendNotifications(current.notifications, adminNotif),
    }))
    stateRef.current = { criteria: [], draftYear, activeDraftId: null }
    setCriteriaState([])
    setActiveDraftId(null)
    setLastSavedAt("")
    setLastModifiedAt("")
    setAttempted(false)
    setSuccessInfo({
      title: "Sasaran Kinerja Berhasil Dikirim",
      subtitle:
        "Dokumen Sasaran Kinerja telah masuk ke antrean verifikasi Admin PRP. Begitu disetujui (ACC), Laporan Triwulan akan terbuka dan terisi otomatis.",
      documentTitle: submittedRecord.title,
      period: submittedRecord.period,
      unit: lockedOrg.unitLabel,
      sentAt,
      statusLabel: "Menunggu Verifikasi Admin PRP",
    })
    return true
  }

  const updatedLabel = formatUpdatedAtLabel(lastSavedAt)
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
        { criteria, draftYear },
        lastModifiedAt,
      )
    : null

  return (
    <div className="target-page">
      <div className="report-heading">
        <div>
          <div className="report-kicker">TAHAP 1 WAJIB · PERENCANAAN TAHUNAN</div>
          <div className="report-title">Sasaran Kinerja Tahun {draftYear}</div>
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
            <div className="identity-title">Periode Sasaran Tahunan</div>
            <div className="period-controls is-single">
              <label
                className="meta-control year-control"
                htmlFor="sasaran-draft-year"
              >
                <span>Tahun RKA / Sasaran</span>
                <select
                  id="sasaran-draft-year"
                  name="draftYear"
                  aria-label="Tahun sasaran kinerja"
                  value={draftYear}
                  onChange={(e) => handleChangeYear(e.target.value)}
                >
                  {yearOptions.map((y) => {
                    const yState = getPeriodState(
                      data.periods[`${y}-annual`],
                      nowMs,
                    )
                    const tag = formatPeriodStatusTag(yState.status)
                    return (
                      <option key={y} value={y}>
                        Tahun {y} [{tag}]
                      </option>
                    )
                  })}
                </select>
              </label>
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

      <div className="report-summary">
        <div>
          <span>
            <Icon name="clock" size={15} />
          </span>
          <p>
            Batas pengumpulan
            <strong>{formatDeadlineSummary(annualPeriod, nowMs)}</strong>
          </p>
        </div>
        <div>
          <span>
            <Icon name="chart" size={15} />
          </span>
          <p>
            Kelengkapan tabel
            <strong>{completeness}%</strong>
          </p>
        </div>
        <div className="summary-unit">
          <span>
            <Icon name="layers" size={15} />
          </span>
          <p>
            Master Sasaran Strategis
            <strong>{strategicGoals.length} Pilihan Aktif</strong>
          </p>
        </div>
      </div>

      {hasSubmittedAnnual && annualPrereq.latestRecord && (
        <div
          className={`prerequisite-status-banner is-${annualPrereq.status}`}
          role="status"
        >
          <Icon
            name={annualPrereq.status === "approved" ? "check" : "clock"}
            size={18}
          />
          <div className="prerequisite-banner-copy">
            <strong>
              {annualPrereq.status === "approved"
                ? `Sasaran Kinerja Tahun ${draftYear} Telah Disetujui (ACC)`
                : annualPrereq.status === "revision"
                  ? `Sasaran Kinerja Tahun ${draftYear} Perlu Diperbaiki (Revisi)`
                  : `Sasaran Kinerja Tahun ${draftYear} Menunggu Verifikasi Admin PRP`}
            </strong>
            <span>
              {annualPrereq.status === "approved"
                ? "Seluruh program kerja telah disinkronisasi otomatis ke lembar kerja Laporan Triwulan unit Anda."
                : annualPrereq.status === "revision"
                  ? "Buka menu Riwayat untuk memperbaiki sel indikator yang ditandai oleh Admin PRP."
                  : `Dokumen (${annualPrereq.latestRecord.id}) sedang dalam antrean pemeriksaan Admin PRP.`}
            </span>
          </div>
          <div className="prerequisite-banner-actions">
            {annualPrereq.status === "approved" && onOpenTriwulan && (
              <button
                type="button"
                className="primary-button"
                onClick={onOpenTriwulan}
              >
                Buka Laporan Triwulan <Icon name="arrow" size={15} />
              </button>
            )}
            {onViewHistory && (
              <button
                type="button"
                className="secondary-button"
                onClick={onViewHistory}
              >
                Lihat di Riwayat
              </button>
            )}
          </div>
        </div>
      )}

      {isPeriodLocked && (
        <div className="period-lock-banner" role="status">
          <Icon name="clock" size={18} />
          <div>
            <strong>
              {activeDraftId !== null
                ? "Periode Terkunci untuk Pengiriman Baru"
                : "Periode Sasaran Kinerja Terkunci"}
            </strong>
            <span>
              {lockReason}{" "}
              {activeDraftId !== null
                ? "Draf tersimpan masih dapat ditinjau, namun pengiriman baru menunggu pembukaan jadwal Admin PRP."
                : "Pilih tahun periode yang berstatus Dibuka atau hubungi Admin PRP."}
            </span>
          </div>
        </div>
      )}

      <section className="panel matrix-grid-panel">
        <div className="matrix-grid-toolbar">
          <div className="matrix-grid-toolbar-copy">
            <h2>Tabel Sasaran Kinerja Unit (6 Kolom Resmi)</h2>
            <p>
              Pilihan <strong>Sasaran Strategis</strong> dikelola terpusat oleh
              Admin/Renbang. Sel yang memiliki Sasaran Strategis atau Program
              Kerja sama digabung otomatis, namun setiap baris tetap dapat
              diubah mandiri.
            </p>
          </div>
          <div className="matrix-grid-toolbar-actions">
            <button
              type="button"
              className="primary-button"
              disabled={isLockedForNewInput}
              onClick={openCreateModal}
            >
              <Icon name="plus" size={15} />
              <span>Tambah Program / Sasaran</span>
            </button>
          </div>
        </div>

        <div className="official-grid-scroll" data-lenis-prevent>
          <table className="sasaran-green-table">
            <thead>
              <tr>
                <th className="col-no">No</th>
                <th className="col-goal">SASARAN STRATEGIS</th>
                <th className="col-program">PROGRAM KERJA</th>
                <th className="col-sasaran">SASARAN KINERJA</th>
                <th className="col-months">BULAN PELAKSANAAN PROGRAM KERJA</th>
                <th className="col-notes">KETERANGAN</th>
                <th className="col-actions">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="matrix-empty-cell">
                    <div className="matrix-empty-state">
                      <Icon name="target" size={24} />
                      <strong>
                        Belum ada baris Sasaran Kinerja untuk Tahun {draftYear}
                      </strong>
                      <p>
                        Klik tombol <strong>Tambah Program / Sasaran</strong>{" "}
                        untuk memilih Sasaran Strategis dari master Admin/Renbang
                        dan mengisi rencana program kerja tahunan unit{" "}
                        {lockedOrg.unitLabel}.
                      </p>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={isLockedForNewInput}
                        onClick={openCreateModal}
                      >
                        <Icon name="plus" size={15} />
                        <span>Tambah Baris Pertama</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                flatRows.map((row, idx) => {
                  const span = mergeSpans[idx]
                  const rowInvalid = attempted && !row.isComplete
                  return (
                    <tr
                      key={`${row.sasaranId}-${row.rowNumber}`}
                      className={[
                        "matrix-clickable-row",
                        rowInvalid && "is-row-invalid",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => openEditRowModal(row, span.groupNumber)}
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
                          <strong>{row.strategicGoal || "-"}</strong>
                        </td>
                      )}
                      {span.programSpan > 0 && (
                        <td
                          className="col-program is-merged-cell"
                          rowSpan={span.programSpan}
                        >
                          <span>{row.programName || "-"}</span>
                        </td>
                      )}
                      <td className="col-sasaran">
                        <span>{row.sasaranText || "-"}</span>
                      </td>
                      <td className="col-months">
                        <span>
                          {formatBulanPelaksanaan(
                            row.bulanMulai,
                            row.bulanSelesai,
                          )}
                        </span>
                      </td>
                      <td className="col-notes">
                        <span>{row.keterangan || "-"}</span>
                      </td>
                      <td
                        className="col-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="matrix-row-actions">
                          <button
                            type="button"
                            className="matrix-btn-edit"
                            onClick={() =>
                              openEditRowModal(row, span.groupNumber)
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="matrix-btn-sub"
                            title={`Tambah sasaran kinerja pada Program Kerja No. ${span.groupNumber}`}
                            onClick={() =>
                              openAddSasaranToProgram(row, span.groupNumber)
                            }
                          >
                            + Sasaran
                          </button>
                          <button
                            type="button"
                            className="matrix-btn-delete"
                            aria-label={`Hapus sasaran pada nomor ${span.groupNumber}`}
                            onClick={() => removeFlatRow(row)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
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
          {flatRows.length} baris sasaran · Kelengkapan{" "}
          <strong>{completeness}%</strong>
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
            Kirim Sasaran <Icon name="send" size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {modalState && (
          <motion.div
            className="submit-success-overlay sasaran-row-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sasaran-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="triwulan-row-modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <header className="triwulan-row-modal-head">
                <div>
                  <span className="triwulan-modal-kicker">
                    UNIT {lockedOrg.unitLabel.toUpperCase()} · TAHUN {draftYear}
                  </span>
                  <h2 id="sasaran-modal-title">
                    {modalState.mode === "edit"
                      ? `Perbarui Sasaran pada Baris No. ${modalState.groupNumber ?? 1}`
                      : modalState.mode === "addSasaranToProgram"
                        ? `Tambah Sasaran pada Program Kerja (No. ${modalState.groupNumber ?? 1})`
                        : "Tambah Program & Sasaran Kinerja Baru"}
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
                {modalError && (
                  <div className="login-error" role="alert">
                    <span aria-hidden="true">!</span>
                    <span>{modalError}</span>
                  </div>
                )}

                {modalState.mode === "addSasaranToProgram" ? (
                  <div className="locked-program-context-box">
                    <div className="locked-program-context-head">
                      <span className="locked-program-badge">
                        <Icon name="lock" size={13} />
                        <span>
                          Terkunci pada Baris No. {modalState.groupNumber ?? 1}{" "}
                          (Satu Baris Merge Cell)
                        </span>
                      </span>
                      <button
                        type="button"
                        className="switch-new-row-btn"
                        onClick={() =>
                          setModalState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mode: "create",
                                  groupNumber: undefined,
                                  rowIndex: undefined,
                                }
                              : prev,
                          )
                        }
                      >
                        Buat Nomor Baru?
                      </button>
                    </div>
                    <div className="inherited-rka-summary">
                      <div>
                        <span>No. Baris Program</span>
                        <strong>
                          No. {modalState.groupNumber ?? 1} (Menyatu Otomatis)
                        </strong>
                      </div>
                      <div>
                        <span>Program Kerja (Terkunci)</span>
                        <strong>{modalState.programName || "-"}</strong>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span>Sasaran Strategis (Terkunci)</span>
                        <strong>{modalState.strategicGoal || "-"}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {modalState.mode === "edit" && (
                      <div className="modal-row-scope-hint">
                        <Icon name="layers" size={15} />
                        <span>
                          Perubahan Sasaran Strategis atau Program Kerja pada
                          jendela ini hanya berlaku untuk item sasaran ini dan
                          tidak menimpa sasaran lain.
                        </span>
                      </div>
                    )}

                    <label
                      className="modal-form-field"
                      htmlFor="modal-strategic-goal"
                    >
                      <span>
                        Sasaran Strategis <b>*</b>{" "}
                        <small>(Dikelola Admin / Renbang)</small>
                      </span>
                      <select
                        id="modal-strategic-goal"
                        name="strategicGoal"
                        value={modalState.strategicGoal}
                        onChange={(e) => {
                          const selectedName = e.target.value
                          const found = strategicGoals.find(
                            (g) => g.name === selectedName,
                          )
                          setModalState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  strategicGoalId: found?.id ?? "",
                                  strategicGoal: selectedName,
                                }
                              : prev,
                          )
                        }}
                      >
                        <option value="">-- Pilih Sasaran Strategis --</option>
                        {strategicGoals.map((goal) => (
                          <option key={goal.id} value={goal.name}>
                            [{goal.code}] {goal.name}
                          </option>
                        ))}
                        {modalState.strategicGoal &&
                          !strategicGoals.some(
                            (g) => g.name === modalState.strategicGoal,
                          ) && (
                            <option value={modalState.strategicGoal}>
                              {modalState.strategicGoal}
                            </option>
                          )}
                      </select>
                    </label>

                    <label
                      className="modal-form-field"
                      htmlFor="modal-program-kerja"
                    >
                      <span>
                        Program Kerja <b>*</b>
                      </span>
                      <input
                        id="modal-program-kerja"
                        name="programName"
                        type="text"
                        list="existing-program-kerja-list"
                        placeholder="Ketik nama program kerja tahunan unit..."
                        value={modalState.programName}
                        onChange={(e) =>
                          setModalState((prev) =>
                            prev
                              ? { ...prev, programName: e.target.value }
                              : prev,
                          )
                        }
                      />
                      {existingProgramSuggestions.length > 0 && (
                        <datalist id="existing-program-kerja-list">
                          {existingProgramSuggestions.map((prog) => (
                            <option key={prog} value={prog} />
                          ))}
                        </datalist>
                      )}
                    </label>
                  </>
                )}

                <label
                  className="modal-form-field"
                  htmlFor="modal-sasaran-text"
                >
                  <span>
                    Sasaran Kinerja <b>*</b>
                  </span>
                  <textarea
                    id="modal-sasaran-text"
                    name="sasaranText"
                    rows={3}
                    autoFocus={modalState.mode === "addSasaranToProgram"}
                    placeholder="Tuliskan indikator atau target capaian sasaran kinerja..."
                    value={modalState.sasaranText}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev ? { ...prev, sasaranText: e.target.value } : prev,
                      )
                    }
                  />
                </label>

                <div className="modal-form-two-col">
                  <label
                    className="modal-form-field"
                    htmlFor="modal-bulan-mulai"
                  >
                    <span>
                      Bulan Mulai Pelaksanaan <b>*</b>
                    </span>
                    <input
                      id="modal-bulan-mulai"
                      name="bulanMulai"
                      type="month"
                      min={`${draftYear}-01`}
                      max={`${draftYear}-12`}
                      value={modalState.bulanMulai}
                      onChange={(e) =>
                        setModalState((prev) =>
                          prev ? { ...prev, bulanMulai: e.target.value } : prev,
                        )
                      }
                    />
                  </label>

                  <label
                    className="modal-form-field"
                    htmlFor="modal-bulan-selesai"
                  >
                    <span>
                      Bulan Selesai Pelaksanaan <small>(Opsional)</small>
                    </span>
                    <input
                      id="modal-bulan-selesai"
                      name="bulanSelesai"
                      type="month"
                      min={modalState.bulanMulai || `${draftYear}-01`}
                      max={`${draftYear}-12`}
                      value={modalState.bulanSelesai}
                      onChange={(e) =>
                        setModalState((prev) =>
                          prev
                            ? { ...prev, bulanSelesai: e.target.value }
                            : prev,
                        )
                      }
                    />
                  </label>
                </div>

                <label className="modal-form-field" htmlFor="modal-keterangan">
                  <span>Keterangan</span>
                  <textarea
                    id="modal-keterangan"
                    name="keterangan"
                    rows={2}
                    placeholder="Catatan tambahan pelaksanaan atau target..."
                    value={modalState.keterangan}
                    onChange={(e) =>
                      setModalState((prev) =>
                        prev ? { ...prev, keterangan: e.target.value } : prev,
                      )
                    }
                  />
                </label>
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
                  Batal
                </button>
                <div className="triwulan-modal-foot-right">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => applyModalChanges(true)}
                  >
                    Simpan Draf
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => applyModalChanges(false)}
                  >
                    <Icon name="check" size={15} />
                    <span>Simpan Baris</span>
                  </button>
                </div>
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
        headerTitle={`Pratinjau Cetak Sasaran Kinerja (${draftYear})`}
        headerSubtitle="Format Resmi 6 Kolom Hijau · A4 Landscape"
        confirmSubmitLabel="Kirim Sasaran"
        confirmSubmitDisabled={isPeriodLocked || incomplete}
        confirmSubmitTitle={isPeriodLocked ? lockReason : undefined}
        onConfirmSubmit={() => {
          requestSubmit()
        }}
      />

      <SubmitConfirmModal
        info={confirmInfo}
        onCancel={() => setConfirmInfo(null)}
        onConfirm={commitSubmit}
      />
      <SubmitSuccessModal
        info={successInfo}
        onClose={() => setSuccessInfo(null)}
        onViewHistory={
          onViewHistory
            ? () => {
                setSuccessInfo(null)
                onViewHistory()
              }
            : undefined
        }
      />
    </div>
  )
}

export default InputSasaranKinerja
