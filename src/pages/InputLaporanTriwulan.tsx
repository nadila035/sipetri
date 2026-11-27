import { useRef, useState } from "react"
import {
  describePeriodLockReason,
  formatDeadlineSummary,
  formatPeriodStatusTag,
  getPeriodState,
} from "../utils/workflow"
import type { SetStateAction } from "react"
import {
  collectReportingYears,
  emptyTriwulanProgram,
  emptyTriwulanSasaran,
  useReporting,
} from "../ReportingContext"
import { DetailModal } from "../components/DetailModal"
import { Icon } from "../components/Icon"
import { OrganizationSelect } from "../components/OrganizationSelect"
import { PrintPreviewModal } from "../components/PrintPreviewModal"
import {
  SubmitConfirmModal,
  type SubmitConfirmInfo,
} from "../components/SubmitConfirmModal"
import {
  SubmitSuccessModal,
  type SubmitSuccessInfo,
} from "../components/SubmitSuccessModal"
import { useConfirmableUnsavedChanges } from "../utils/useUnsavedChanges"
import {
  buildTriwulanItems,
  formatUpdatedAtLabel,
  hasTriwulanContent,
  insertItemAt,
  normalizeTriwulanPrograms,
  promoteDraftToSubmitted,
  upsertDraftRecord,
} from "../utils/drafts"
import type {
  HistoryRecord,
  NotifyFn,
  TriwulanProgramItem,
  TriwulanSasaranItem,
} from "../types"

import { resolveInitialUnit, unitOptions } from "../utils/organizations"
import { annualSources, importAnnualSources } from "../utils/annualSources"
import { recordBelongsToSession } from "../utils/auth"
import { useAuth } from "../AuthContext"
import {
  appendNotifications,
  createAppNotification,
  formatRecordUnitLabel,
} from "../utils/notifications"

type InputLaporanTriwulanProps = {
  notify: NotifyFn
  resumeDraftId?: string | null
  onViewHistory?: () => void
}

function parseResumePeriod(period: string, fallbackQuarter: string, fallbackYear: string) {
  return {
    quarter: period.match(/Triwulan\s+(IV|III|II|I)\b/i)?.[1]?.toUpperCase() ?? fallbackQuarter,
    year: period.match(/\b(\d{4})\b/)?.[1] ?? fallbackYear,
  }
}

export function InputLaporanTriwulan({
  notify,
  resumeDraftId = null,
  onViewHistory,
}: InputLaporanTriwulanProps) {
  const { data, setData, storageError } = useReporting()
  const { session } = useAuth()
  const resumeRecord = resumeDraftId
    ? data.records.find(
      (record) =>
        record.id === resumeDraftId &&
        record.type === "Laporan Triwulan" &&
        record.status === "Draf" &&
        recordBelongsToSession(record, session),
    )
    : undefined

  const initialPeriod = resumeRecord
    ? parseResumePeriod(resumeRecord.period, data.quarter, data.year)
    : { quarter: data.quarter, year: data.year }
  const initialOrg = resolveInitialUnit(resumeRecord)

  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    () => resumeRecord?.id ?? null,
  )
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    () => resumeRecord?.updatedAt ?? "",
  )
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(
    () => resumeRecord?.updatedAt ?? "",
  )
  const [quarter, setQuarterState] = useState<string>(initialPeriod.quarter)
  const [year, setYearState] = useState<string>(initialPeriod.year)
  const [unit, setUnitState] = useState<string>(initialOrg.unit)
  const [subUnit, setSubUnitState] = useState<string>(initialOrg.subUnit)
  const [programs, setProgramsState] = useState<TriwulanProgramItem[]>(() =>
    resumeRecord?.triwulanPrograms?.length
      ? normalizeTriwulanPrograms(resumeRecord.triwulanPrograms)
      : [emptyTriwulanProgram()],
  )

  const key = `${year}-${quarter}`
  const yearOptions = Array.from(new Set([...collectReportingYears(data), year]))
  const currentPeriod = data.periods[key]
  const periodState = getPeriodState(currentPeriod)
  const isPeriodLocked = !periodState.canSubmit
  const isLockedForNewInput = isPeriodLocked && activeDraftId === null
  const lockReason = describePeriodLockReason(currentPeriod, "Periode ini")
  const updatedLabel = formatUpdatedAtLabel(lastSavedAt)
  const [attempted, setAttempted] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printPreviewRecord, setPrintPreviewRecord] =
    useState<HistoryRecord | null>(null)
  const [confirmInfo, setConfirmInfo] = useState<SubmitConfirmInfo | null>(null)
  const [successInfo, setSuccessInfo] = useState<SubmitSuccessInfo | null>(null)
  const quarterDescriptions: Record<string, string> = {
    I: "Januari - Maret",
    II: "April - Juni",
    III: "Juli - September",
    IV: "Oktober - Desember",
  }

  const independentUnit = Boolean(unit && unitOptions[unit]?.length === 0)
  const availableSubUnits = unit && Object.hasOwn(unitOptions, unit)
    ? (independentUnit ? [unit] : unitOptions[unit])
    : []
  const targetUnitCode = subUnit || unit
  const submittedAnnualSources = targetUnitCode
    ? annualSources(
        data.records.filter((r) => r.status !== "Draf"),
        year,
        targetUnitCode,
      )
    : []

  const stateRef = useRef({ programs, quarter, year, unit, subUnit })
  stateRef.current = { programs, quarter, year, unit, subUnit }

  const computeCompleteness = (list: TriwulanProgramItem[]) => {
    const total = list.reduce((acc, p) => acc + p.sasaranList.length, 0)
    const done = list.reduce(
      (acc, p) =>
        acc +
        p.sasaranList.filter(
          (s) => p.program.trim() !== "" && !isSasaranIncomplete(s),
        ).length,
      0,
    )
    return total > 0 ? Math.round((done / total) * 100) : 0
  }

  const buildDraft = (
    draftId: string,
    snapshot: {
      programs: TriwulanProgramItem[]
      quarter: string
      year: string
      unit: string
      subUnit: string
    },
    nowIso: string,
  ): HistoryRecord => ({
    id: draftId,
    author: session?.displayName || "Staf Unit",
    type: "Laporan Triwulan",
    title: `Laporan Realisasi Triwulan ${snapshot.quarter}`,
    period: `Triwulan ${snapshot.quarter} · ${snapshot.year}`,
    unit: snapshot.subUnit || snapshot.unit || "Belum diisi",
    parentUnit: snapshot.unit || undefined,
    subUnit: snapshot.subUnit || snapshot.unit || undefined,
    sentAt: "Belum dikirim",
    updatedAt: nowIso,
    status: "Draf",
    progress: computeCompleteness(snapshot.programs),
    items: buildTriwulanItems(snapshot.programs),
    triwulanPrograms: snapshot.programs,
  })

  const syncAutosave = (nextSnapshot: typeof stateRef.current) => {
    const nowIso = new Date().toISOString()
    setLastModifiedAt(nowIso)
    if (!activeDraftId) return
    setLastSavedAt(nowIso)
    setData((current) => ({
      ...current,
      records: upsertDraftRecord(
        current.records,
        buildDraft(activeDraftId, nextSnapshot, nowIso),
      ),
    }))
  }

  const setPrograms = (update: SetStateAction<TriwulanProgramItem[]>) => {
    const prev = stateRef.current
    const nextPrograms =
      typeof update === "function" ? update(prev.programs) : update
    const nextSnapshot = { ...prev, programs: nextPrograms }
    stateRef.current = nextSnapshot
    setProgramsState(nextPrograms)
    syncAutosave(nextSnapshot)
  }

  const setQuarter = (nextQuarter: string) => {
    const nextSnapshot = { ...stateRef.current, quarter: nextQuarter }
    stateRef.current = nextSnapshot
    setQuarterState(nextQuarter)
    syncAutosave(nextSnapshot)
  }

  const setYear = (nextYear: string) => {
    const nextSnapshot = { ...stateRef.current, year: nextYear }
    stateRef.current = nextSnapshot
    setYearState(nextYear)
    syncAutosave(nextSnapshot)
  }

  const setUnit = (value: string) => {
    const nextSubUnit = unitOptions[value]?.[0] ?? value
    const nextSnapshot = {
      ...stateRef.current,
      unit: value,
      subUnit: nextSubUnit,
    }
    stateRef.current = nextSnapshot
    setUnitState(value)
    setSubUnitState(nextSubUnit)
    syncAutosave(nextSnapshot)
  }

  const setSubUnit = (value: string) => {
    const nextSnapshot = { ...stateRef.current, subUnit: value }
    stateRef.current = nextSnapshot
    setSubUnitState(value)
    syncAutosave(nextSnapshot)
  }

  useConfirmableUnsavedChanges(
    activeDraftId === null && hasTriwulanContent(programs, unit, subUnit),
    "Isian laporan triwulan belum disimpan sebagai draf dan tidak tersimpan otomatis. Tetap tinggalkan halaman?",
  )
  // Update Program
  const updateProgramName = (pIndex: number, name: string) => {
    setPrograms((current) =>
      current.map((p, i) => (i === pIndex ? { ...p, program: name } : p)),
    )
  }

  const addProgram = () => {
    setPrograms((current) => [...current, emptyTriwulanProgram()])
  }

  const handleImportFromAnnual = () => {
    if (isLockedForNewInput) {
      notify(
        `${lockReason} Pilih periode yang sedang dibuka untuk mengimpor program.`,
        "error",
      )
      return
    }
    if (!unit || !subUnit) {
      notify(
        "Pilih Unit Utama dan Sub Unit / Bagian terlebih dahulu sebelum mengimpor dari Sasaran Kinerja.",
        "error",
      )
      return
    }
    if (submittedAnnualSources.length === 0) {
      notify(
        `Sasaran Kinerja Tahun ${year} untuk unit ${targetUnitCode} belum ditemukan atau masih berstatus Draf. Kirim RKA terlebih dahulu hingga minimal berstatus Menunggu.`,
        "error",
      )
      return
    }
    const prevLinkedCount = programs.reduce(
      (acc, p) => acc + p.sasaranList.filter((s) => s.annualSource).length,
      0,
    )
    const nextPrograms = importAnnualSources(
      programs,
      submittedAnnualSources,
      year,
      targetUnitCode,
    )
    const nextLinkedCount = nextPrograms.reduce(
      (acc, p) => acc + p.sasaranList.filter((s) => s.annualSource).length,
      0,
    )
    setPrograms(
      nextPrograms.length > 0 ? nextPrograms : [emptyTriwulanProgram()],
    )
    const addedCount = nextLinkedCount - prevLinkedCount
    notify(
      addedCount > 0
        ? `${addedCount} sasaran dari Sasaran Kinerja Tahun ${year} (${targetUnitCode}) berhasil diimpor.`
        : `Seluruh sasaran dari Sasaran Kinerja Tahun ${year} (${targetUnitCode}) sudah ada pada formulir ini.`,
      addedCount > 0 ? "success" : "info",
    )
  }

  const insertProgramAt = (index: number) => {
    setPrograms((current) =>
      insertItemAt(current, index, emptyTriwulanProgram()),
    )
  }

  const removeProgram = (pIndex: number) => {
    setPrograms((current) => current.filter((_, i) => i !== pIndex))
  }

  // Update Sasaran inside Program
  const addSasaran = (pIndex: number) => {
    setPrograms((current) =>
      current.map((p, i) =>
        i === pIndex
          ? { ...p, sasaranList: [...p.sasaranList, emptyTriwulanSasaran()] }
          : p,
      ),
    )
  }

  const insertSasaranAt = (pIndex: number, index: number) => {
    setPrograms((current) =>
      current.map((p, i) =>
        i === pIndex
          ? {
            ...p,
            sasaranList: insertItemAt(
              p.sasaranList,
              index,
              emptyTriwulanSasaran(),
            ),
          }
          : p,
      ),
    )
  }

  const removeSasaran = (pIndex: number, sIndex: number) => {
    setPrograms((current) =>
      current.map((p, i) =>
        i === pIndex
          ? {
            ...p,
            sasaranList: p.sasaranList.filter((_, si) => si !== sIndex),
          }
          : p,
      ),
    )
  }

  const updateSasaran = (
    pIndex: number,
    sIndex: number,
    field: keyof TriwulanSasaranItem,
    value: string,
  ) => {
    setPrograms((current) =>
      current.map((p, i) =>
        i === pIndex
          ? {
            ...p,
            sasaranList: p.sasaranList.map((s, si) =>
              si === sIndex ? { ...s, [field]: value } : s,
            ),
          }
          : p,
      ),
    )
  }

  const isValidPercentage = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === "") return false
    const val = Number(trimmed)
    return !Number.isNaN(val) && val >= 0 && val <= 100
  }

  const hasInvalidMonthRange = (s: TriwulanSasaranItem) => {
    const start = s.monthStart.trim()
    const end = (s.monthEnd ?? "").trim()
    return (
      Boolean(end) &&
      /^\d{4}-\d{2}$/.test(start) &&
      /^\d{4}-\d{2}$/.test(end) &&
      end < start
    )
  }

  // Follow-up required only after percentage is entered and < 100
  const needsFollowUp = (s: TriwulanSasaranItem) => {
    if (s.percentage.trim() === "") return false
    const val = Number(s.percentage)
    return Number.isNaN(val) || val < 100
  }

  const hasFollowUpError = (s: TriwulanSasaranItem) =>
    needsFollowUp(s) &&
    (!s.obstacle.trim() || !s.solution.trim() || !s.solutionTime.trim())

  const isSasaranIncomplete = (s: TriwulanSasaranItem) =>
    !s.target.trim() ||
    !s.monthStart.trim() ||
    hasInvalidMonthRange(s) ||
    !s.stage.trim() ||
    !s.realization.trim() ||
    !isValidPercentage(s.percentage) ||
    hasFollowUpError(s)

  const isProgramIncomplete = (p: TriwulanProgramItem) =>
    !p.program.trim() ||
    p.sasaranList.length === 0 ||
    p.sasaranList.some(isSasaranIncomplete)

  // Completeness stats
  const totalSasaran = programs.reduce(
    (acc, p) => acc + p.sasaranList.length,
    0,
  )
  const completedSasaran = programs.reduce(
    (acc, p) =>
      acc +
      p.sasaranList.filter(
        (s) => p.program.trim() !== "" && !isSasaranIncomplete(s),
      ).length,
    0,
  )
  const completeness =
    totalSasaran > 0 ? Math.round((completedSasaran / totalSasaran) * 100) : 0

  const saveDraft = () => {
    if (isLockedForNewInput) {
      notify(
        `${lockReason} Pilih periode yang sedang dibuka untuk mulai mengisi laporan baru.`,
        "error",
      )
      return
    }
    const isExistingDraft = activeDraftId !== null
    const draftId =
      activeDraftId ??
      `DRAF-LTR-${year}-${quarter}-${crypto.randomUUID().slice(0, 8)}`
    const nowIso = new Date().toISOString()
    const draftRecord = buildDraft(
      draftId,
      { programs, quarter, year, unit, subUnit },
      nowIso,
    )
    setData((current) => ({
      ...current,
      records: upsertDraftRecord(current.records, draftRecord),
    }))
    setActiveDraftId(draftId)
    setLastSavedAt(nowIso)
    setLastModifiedAt((prev) => prev || nowIso)
    notify(
      isExistingDraft
        ? "Draf laporan berhasil diperbarui."
        : "Draf laporan disimpan. Simpan otomatis kini aktif.",
    )
  }

  const requestSubmit = (): boolean => {
    setAttempted(true)
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
    if (
      !unit ||
      !subUnit ||
      !year ||
      programs.some(isProgramIncomplete)
    ) {
      setPreviewOpen(false)
      setPrintPreviewRecord(null)
      const hasMissingFollowUp =
        Boolean(unit && subUnit && year) &&
        programs.some((program) => program.sasaranList.some(hasFollowUpError))
      notify(
        hasMissingFollowUp
          ? "Realisasi di bawah 100% wajib mengisi Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian."
          : "Periksa kembali kolom wajib yang masih kosong.",
        "error",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return false
    }
    const sasaranTotal = programs.reduce(
      (sum, program) => sum + program.sasaranList.length,
      0,
    )
    setConfirmInfo({
      title: "Konfirmasi Pengiriman Laporan",
      description:
        "Apakah Anda yakin ingin mengirim laporan ini sekarang? Anda masih dapat memilih Cek Kembali untuk meninjau ulang isian.",
      documentTitle: `Laporan Realisasi Triwulan ${quarter}`,
      period: `Triwulan ${quarter} · ${year}`,
      unit: subUnit || unit,
      summary: `${programs.length} program · ${sasaranTotal} sasaran`,
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
    const items = buildTriwulanItems(programs)
    const submittedRecord: HistoryRecord = {
      id: `LTR-${year}-${quarter}-${crypto.randomUUID()}`,
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
      items,
      triwulanPrograms: programs,
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
    const freshPrograms = [emptyTriwulanProgram()]
    stateRef.current = {
      ...stateRef.current,
      unit: "",
      subUnit: "",
      programs: freshPrograms,
    }
    setUnitState("")
    setSubUnitState("")
    setProgramsState(freshPrograms)
    setActiveDraftId(null)
    setLastSavedAt("")
    setLastModifiedAt("")
    setAttempted(false)
    setSuccessInfo({
      title: "Laporan Triwulan Berhasil Dikirim",
      subtitle:
        "Laporan telah tersimpan dan masuk ke antrean verifikasi Admin PRP.",
      documentTitle: submittedRecord.title,
      period: submittedRecord.period,
      unit: submittedRecord.unit,
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
      { programs, quarter, year, unit, subUnit },
      lastModifiedAt,
    )
    : null

  return (
    <div className="report-page">
      <div className="report-heading">
        <div>
          <div className="report-kicker">PELAPORAN KINERJA</div>
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
            <div className="identity-title">Periode Laporan</div>
            <div className="period-controls">
              <label className="meta-control" htmlFor="triwulan-quarter">
                <span>Triwulan</span>
                <select
                  id="triwulan-quarter"
                  name="quarter"
                  aria-label="Triwulan"
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                >
                  {(["I", "II", "III", "IV"] as const).map((q) => {
                    const qState = getPeriodState(data.periods[`${year}-${q}`])
                    const tag = formatPeriodStatusTag(qState.status)
                    return (
                      <option key={q} value={q}>
                        Triwulan {q} ({quarterDescriptions[q]}) [{tag}]
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="meta-control year-control" htmlFor="triwulan-year">
                <span>Tahun</span>
                <select
                  id="triwulan-year"
                  name="year"
                  aria-label="Tahun pelaporan"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
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
                  onClick={() => {
                    setQuarter(data.quarter)
                    setYear(data.year)
                  }}
                >
                  Gunakan periode aktif
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="identity-block organization-block">
          <div className="identity-icon teal">
            <Icon name="grid" size={19} />
          </div>
          <div className="identity-content">
            <div className="identity-title">Unit Organisasi</div>
            <fieldset
              className="locked-fieldset"
              disabled={isLockedForNewInput}
            >
              <div className="organization-controls">
                <OrganizationSelect
                  label="Unit Utama"
                  value={unit}
                  options={Object.keys(unitOptions)}
                  onChange={setUnit}
                />
                <OrganizationSelect
                  key={unit}
                  label="Sub Unit / Bagian"
                  value={subUnit}
                  options={availableSubUnits}
                  onChange={setSubUnit}
                />
              </div>
            </fieldset>
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
            <strong>{formatDeadlineSummary(currentPeriod)}</strong>
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
            <Icon name="grid" size={15} />
          </span>
          <p>
            Unit
            <strong>{subUnit || unit || "Belum dipilih"}</strong>
          </p>
        </div>
      </div>

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
                ? "Draf tersimpan tetap dapat diperbarui, namun pengiriman baru menunggu pembukaan atau perpanjangan waktu dari Admin PRP."
                : "Pilih periode lain yang berstatus Dibuka, atau hubungi Admin PRP apabila memerlukan perpanjangan waktu."}
            </span>
          </div>
        </div>
      )}

      <fieldset className="locked-fieldset" disabled={isLockedForNewInput}>
        <div className="annual-import-bar" style={{ marginBottom: 14 }}>
          <div className="annual-import-copy">
            <strong>Tarik Program dari Sasaran Kinerja Tahunan (RKA)</strong>
            <span>
              {!unit || !subUnit
                ? "Pilih Unit Utama dan Sub Unit / Bagian yang sama dengan RKA untuk menarik daftar program kerja."
                : submittedAnnualSources.length > 0
                  ? `Tersedia ${submittedAnnualSources.length} sasaran RKA Tahun ${year} milik ${targetUnitCode} yang siap diimpor.`
                  : `Belum ada RKA Tahun ${year} terkirim (minimal berstatus Menunggu, bukan Draf) untuk unit ${targetUnitCode}.`}
            </span>
          </div>
          <button
            type="button"
            className="annual-import-btn"
            disabled={isLockedForNewInput}
            onClick={handleImportFromAnnual}
          >
            <Icon name="target" size={16} />
            <span>Impor dari Sasaran Kinerja</span>
          </button>
        </div>

        <div className="report-list">
          <div className="insert-top-rail">
            <button
              type="button"
              className="insert-top-btn"
              onClick={() => insertProgramAt(0)}
              title="Tambah program sebelum #1"
              aria-label="Tambah program sebelum #1"
            >
              <Icon name="plus" size={13} />
            </button>
          </div>
          {programs.map((prog, pIdx) => {
            return (
              <section className="report-card" key={prog.id || pIdx}>
                <div className="report-card-head">
                  <div className="number-box">
                    {String(pIdx + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <strong>Program Kerja #{pIdx + 1}</strong>
                    <span>Masukkan rincian pelaksanaan program</span>
                  </div>
                  <div className="card-head-actions action-icon-group">
                    <button
                      type="button"
                      className="row-icon-btn is-insert"
                      onClick={() => insertProgramAt(pIdx + 1)}
                      title={`Tambah program setelah #${pIdx + 1}`}
                      aria-label={`Tambah program setelah #${pIdx + 1}`}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                    <button
                      type="button"
                      className="row-icon-btn is-delete"
                      disabled={programs.length <= 1}
                      onClick={() => removeProgram(pIdx)}
                      title={
                        programs.length > 1
                          ? `Hapus program #${pIdx + 1}`
                          : "Minimal 1 program harus ada"
                      }
                      aria-label={`Hapus program #${pIdx + 1}`}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                {/* Input Nama Program Kerja */}
                <div className="form-grid" style={{ paddingBottom: 6 }}>
                  <label className="field span-2" htmlFor={`triwulan-${pIdx}-program`}>
                    <span>
                      Program Kerja <b>*</b>
                    </span>
                    <input
                      id={`triwulan-${pIdx}-program`}
                      name={`triwulan[${pIdx}].program`}
                      className={
                        attempted && !prog.program.trim() ? "invalid" : ""
                      }
                      value={prog.program}
                      onChange={(e) => updateProgramName(pIdx, e.target.value)}
                      placeholder="Contoh: Peningkatan kualitas layanan publik"
                    />
                  </label>
                </div>

                {/* Daftar Sasaran (Relasi 1-to-Many Tanpa Sub-Penomoran) */}
                <div className="insert-top-rail is-inner">
                  <button
                    type="button"
                    className="insert-top-btn"
                    onClick={() => insertSasaranAt(pIdx, 0)}
                    title="Tambah sasaran sebelum #1"
                    aria-label="Tambah sasaran sebelum #1"
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
                {prog.sasaranList.map((sas, sIdx) => {
                  const conditional = needsFollowUp(sas)
                  const canDeleteSasaran =
                    prog.sasaranList.length > 1 || Boolean(sas.annualSource)
                  return (
                    <div key={sas.id || sIdx} className="sasaran-item-block">
                      {sIdx > 0 && <hr className="sasaran-divider" />}

                      <div
                        className="sasaran-item-header"
                        style={{ marginTop: sIdx > 0 ? 0 : 6 }}
                      >
                        <strong>Sasaran #{sIdx + 1}</strong>
                        <div className="sasaran-item-actions action-icon-group">
                          <button
                            type="button"
                            className="row-icon-btn is-insert is-compact"
                            onClick={() => insertSasaranAt(pIdx, sIdx + 1)}
                            title={`Tambah sasaran setelah #${sIdx + 1}`}
                            aria-label={`Tambah sasaran setelah #${sIdx + 1}`}
                          >
                            <Icon name="plus" size={13} />
                          </button>
                          <button
                            type="button"
                            className="row-icon-btn is-delete is-compact"
                            disabled={!canDeleteSasaran}
                            onClick={() => removeSasaran(pIdx, sIdx)}
                            title={
                              canDeleteSasaran
                                ? `Hapus sasaran #${sIdx + 1}`
                                : "Minimal 1 sasaran harus ada"
                            }
                            aria-label={`Hapus sasaran #${sIdx + 1}`}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>

                      {sas.annualSource && (
                        <p style={{ overflowWrap: "anywhere" }}>
                          Sumber: {sas.annualSource.recordId},{" "}
                          {sas.annualSource.year}, {sas.annualSource.unit}. Status
                          saat impor: {sas.annualSource.status}. Target sumber:{" "}
                          {sas.annualSource.target}.
                        </p>
                      )}
                      <div className="form-grid" style={{ paddingTop: 6 }}>
                        <label
                          className="field span-2"
                          htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-target`}
                        >
                          <span>
                            Sasaran <b>*</b>
                          </span>
                          <textarea
                            id={`triwulan-${pIdx}-sasaran-${sIdx}-target`}
                            name={`triwulan[${pIdx}].sasaran[${sIdx}].target`}
                            className={
                              attempted && !sas.target.trim() ? "invalid" : ""
                            }
                            value={sas.target}
                            onChange={(e) =>
                              updateSasaran(pIdx, sIdx, "target", e.target.value)
                            }
                            placeholder="Tuliskan sasaran yang ingin dicapai"
                          />
                        </label>

                        <fieldset className="field month-field span-2">
                          <legend>
                            Bulan Pelaksanaan Program Kerja <b>*</b>
                          </legend>
                          <div className="month-range">
                            <label htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-month-start`}>
                              <span>Mulai</span>
                              <input
                                id={`triwulan-${pIdx}-sasaran-${sIdx}-month-start`}
                                name={`triwulan[${pIdx}].sasaran[${sIdx}].monthStart`}
                                type="month"
                                aria-label="Bulan mulai"
                                className={
                                  attempted && !sas.monthStart.trim()
                                    ? "invalid"
                                    : ""
                                }
                                value={sas.monthStart}
                                onChange={(e) =>
                                  updateSasaran(
                                    pIdx,
                                    sIdx,
                                    "monthStart",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                            <span className="range-arrow">hingga</span>
                            <label htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-month-end`}>
                              <span>Selesai</span>
                              <input
                                id={`triwulan-${pIdx}-sasaran-${sIdx}-month-end`}
                                name={`triwulan[${pIdx}].sasaran[${sIdx}].monthEnd`}
                                type="month"
                                aria-label="Bulan selesai"
                                min={sas.monthStart || undefined}
                                className={
                                  attempted && hasInvalidMonthRange(sas)
                                    ? "invalid"
                                    : ""
                                }
                                value={sas.monthEnd || ""}
                                onChange={(e) =>
                                  updateSasaran(
                                    pIdx,
                                    sIdx,
                                    "monthEnd",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <small>
                            Pilih satu bulan yang sama jika program hanya
                            berlangsung selama satu bulan.
                          </small>
                        </fieldset>

                        <label
                          className="field"
                          htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-stage`}
                        >
                          <span>
                            Tahap Pelaksanaan (Uraian) <b>*</b>
                          </span>
                          <textarea
                            id={`triwulan-${pIdx}-sasaran-${sIdx}-stage`}
                            name={`triwulan[${pIdx}].sasaran[${sIdx}].stage`}
                            className={
                              attempted && !sas.stage.trim() ? "invalid" : ""
                            }
                            value={sas.stage}
                            onChange={(e) =>
                              updateSasaran(pIdx, sIdx, "stage", e.target.value)
                            }
                            placeholder="Uraikan tahapan yang telah dilakukan"
                          />
                        </label>

                        <label
                          className="field"
                          htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-realization`}
                        >
                          <span>
                            Realisasi Pelaksanaan (Uraian) <b>*</b>
                          </span>
                          <textarea
                            id={`triwulan-${pIdx}-sasaran-${sIdx}-realization`}
                            name={`triwulan[${pIdx}].sasaran[${sIdx}].realization`}
                            className={
                              attempted && !sas.realization.trim()
                                ? "invalid"
                                : ""
                            }
                            value={sas.realization}
                            onChange={(e) =>
                              updateSasaran(
                                pIdx,
                                sIdx,
                                "realization",
                                e.target.value,
                              )
                            }
                            placeholder="Uraikan hasil pelaksanaan program"
                          />
                        </label>

                        <label
                          className="field percentage-field"
                          htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-percentage`}
                        >
                          <span>
                            Realisasi Pelaksanaan (%) <b>*</b>
                          </span>
                          <div>
                            <input
                              id={`triwulan-${pIdx}-sasaran-${sIdx}-percentage`}
                              name={`triwulan[${pIdx}].sasaran[${sIdx}].percentage`}
                              type="number"
                              min="0"
                              max="100"
                              className={
                                attempted && !isValidPercentage(sas.percentage)
                                  ? "invalid"
                                  : ""
                              }
                              value={sas.percentage}
                              onChange={(e) => {
                                const v = e.target.value
                                updateSasaran(
                                  pIdx,
                                  sIdx,
                                  "percentage",
                                  v === "" || Number.isNaN(Number(v))
                                    ? ""
                                    : String(
                                      Math.min(100, Math.max(0, Number(v))),
                                    ),
                                )
                              }}
                              placeholder="0"
                            />
                            <i>%</i>
                          </div>
                        </label>

                        <label
                          className="field"
                          htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-notes`}
                        >
                          <span>Keterangan</span>
                          <input
                            id={`triwulan-${pIdx}-sasaran-${sIdx}-notes`}
                            name={`triwulan[${pIdx}].sasaran[${sIdx}].notes`}
                            value={sas.notes}
                            onChange={(e) =>
                              updateSasaran(pIdx, sIdx, "notes", e.target.value)
                            }
                            placeholder="Keterangan tambahan (opsional)"
                          />
                        </label>
                      </div>

                      {/* Penanganan Kendala - Otomatis aktif jika realisasi < 100% */}
                      <div
                        className={conditional ? "follow-up active" : "follow-up"}
                      >
                        <div className="follow-up-heading">
                          <span>
                            <Icon name="clock" size={17} />
                          </span>
                          <div>
                            <strong>Penanganan Kendala</strong>
                            <p>
                              {conditional
                                ? "Wajib diisi karena realisasi pelaksanaan di bawah 100%."
                                : sas.percentage.trim() === "100"
                                  ? "Realisasi sudah mencapai 100% (penanganan kendala tidak wajib)."
                                  : "Diisi jika realisasi pelaksanaan belum mencapai 100%."}
                            </p>
                          </div>
                          {conditional && <b>WAJIB</b>}
                        </div>
                        <div className="form-grid three">
                          <label
                            className="field"
                            htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-obstacle`}
                          >
                            <span>Kendala {conditional && <b>*</b>}</span>
                            <textarea
                              id={`triwulan-${pIdx}-sasaran-${sIdx}-obstacle`}
                              name={`triwulan[${pIdx}].sasaran[${sIdx}].obstacle`}
                              disabled={!conditional}
                              className={
                                attempted && conditional && !sas.obstacle.trim()
                                  ? "invalid"
                                  : ""
                              }
                              value={sas.obstacle}
                              onChange={(e) =>
                                updateSasaran(
                                  pIdx,
                                  sIdx,
                                  "obstacle",
                                  e.target.value,
                                )
                              }
                              placeholder="Jelaskan kendala yang dihadapi"
                            />
                          </label>
                          <label
                            className="field"
                            htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-solution`}
                          >
                            <span>
                              Rencana Penyelesaian Kendala{" "}
                              {conditional && <b>*</b>}
                            </span>
                            <textarea
                              id={`triwulan-${pIdx}-sasaran-${sIdx}-solution`}
                              name={`triwulan[${pIdx}].sasaran[${sIdx}].solution`}
                              disabled={!conditional}
                              className={
                                attempted && conditional && !sas.solution.trim()
                                  ? "invalid"
                                  : ""
                              }
                              value={sas.solution}
                              onChange={(e) =>
                                updateSasaran(
                                  pIdx,
                                  sIdx,
                                  "solution",
                                  e.target.value,
                                )
                              }
                              placeholder="Uraikan rencana tindak lanjut"
                            />
                          </label>
                          <label
                            className="field"
                            htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-solution-time`}
                          >
                            <span>
                              Waktu Penyelesaian Kendala {conditional && <b>*</b>}
                            </span>
                            <input
                              id={`triwulan-${pIdx}-sasaran-${sIdx}-solution-time`}
                              name={`triwulan[${pIdx}].sasaran[${sIdx}].solutionTime`}
                              type="date"
                              disabled={!conditional}
                              className={
                                attempted &&
                                  conditional &&
                                  !sas.solutionTime.trim()
                                  ? "invalid"
                                  : ""
                              }
                              value={sas.solutionTime}
                              onChange={(e) =>
                                updateSasaran(
                                  pIdx,
                                  sIdx,
                                  "solutionTime",
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>

                      <label
                        className="field evidence-field"
                        htmlFor={`triwulan-${pIdx}-sasaran-${sIdx}-evidence`}
                      >
                        <span>Link Evidence</span>
                        <div>
                          <span className="link-prefix">↗</span>
                          <input
                            id={`triwulan-${pIdx}-sasaran-${sIdx}-evidence`}
                            name={`triwulan[${pIdx}].sasaran[${sIdx}].evidence`}
                            type="url"
                            value={sas.evidence}
                            onChange={(e) =>
                              updateSasaran(
                                pIdx,
                                sIdx,
                                "evidence",
                                e.target.value,
                              )
                            }
                            placeholder="https://drive.google.com/..."
                          />
                        </div>
                        <small>
                          Pastikan tautan dapat diakses oleh verifikator.
                        </small>
                      </label>
                    </div>
                  )
                })}

                {/* Tombol Tambah Sasaran di Dalam Card Program Kerja */}
                <button
                  type="button"
                  className="add-sasaran-btn"
                  onClick={() => addSasaran(pIdx)}
                >
                  <span>+</span> Tambah Sasaran
                </button>
              </section>
            )
          })}
        </div>
      </fieldset>

      <button
        type="button"
        className="add-row"
        disabled={isLockedForNewInput}
        onClick={addProgram}
      >
        <span>+</span> Tambah Program
      </button>

      <div className="report-actions">
        <button
          type="button"
          className="secondary-button preview-button"
          onClick={() => setPreviewOpen(true)}
        >
          Pratinjau
        </button>
        <div>
          <button
            type="button"
            className="secondary-button"
            disabled={isLockedForNewInput}
            onClick={saveDraft}
          >
            Simpan Draf
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isPeriodLocked}
            title={isPeriodLocked ? lockReason : undefined}
            onClick={requestSubmit}
          >
            Kirim Laporan <Icon name="arrow" size={17} />
          </button>
        </div>
      </div>

      <DetailModal
        isDraftPreview
        record={previewRecord}
        onClose={() => {
          setPreviewOpen(false)
          setPrintPreviewRecord(null)
        }}
        onPrintPreview={(rec) => setPrintPreviewRecord(rec)}
      />

      <PrintPreviewModal
        record={printPreviewRecord}
        onClose={() => setPrintPreviewRecord(null)}
        headerTitle="Pratinjau Cetak Laporan"
        headerSubtitle="Periksa isian sebelum dikirim · A4 Landscape"
        confirmSubmitLabel="Kirim Laporan"
        confirmSubmitDisabled={isPeriodLocked}
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
        onViewHistory={onViewHistory}
      />
    </div>
  )
}
export default InputLaporanTriwulan
