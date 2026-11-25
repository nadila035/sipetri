import { useRef, useState } from "react"
import {
  describePeriodLockReason,
  formatDeadlineSummary,
  formatPeriodStatusTag,
  getPeriodState,
} from "../utils/workflow"
import type { SetStateAction } from "react"
import { collectReportingYears, useReporting } from "../ReportingContext"
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
  buildSasaranKinerjaItems,
  calculateSasaranKinerjaCompleteness,
  createEmptyCriteria,
  createEmptySasaran,
  createEmptyStrategy,
  createEmptyWorkProgram,
  formatUpdatedAtLabel,
  hasCriteriaContent,
  insertItemAt,
  normalizeCriteriaList,
  promoteDraftToSubmitted,
  upsertDraftRecord,
} from "../utils/drafts"
import type {
  CriteriaItem,
  HistoryRecord,
  NotifyFn,
} from "../types"
import { resolveInitialUnit, unitOptions } from "../utils/organizations"
import { recordBelongsToSession } from "../utils/auth"
import { useAuth } from "../AuthContext"
import {
  appendNotifications,
  createAppNotification,
  formatRecordUnitLabel,
} from "../utils/notifications"

const newSasaran = createEmptySasaran
const newProgram = createEmptyWorkProgram
const newStrategy = createEmptyStrategy
const newCriteria = createEmptyCriteria

type InputSasaranKinerjaProps = {
  notify: NotifyFn
  resumeDraftId?: string | null
  onViewHistory?: () => void
}

export function InputSasaranKinerja({
  notify,
  resumeDraftId = null,
  onViewHistory,
}: InputSasaranKinerjaProps) {
  const { data, setData, storageError } = useReporting()
  const { session } = useAuth()
  const resumeRecord = resumeDraftId
    ? data.records.find(
      (record) =>
        record.id === resumeDraftId &&
        record.type === "Sasaran Kinerja" &&
        record.status === "Draf" &&
        recordBelongsToSession(record, session),
    )
    : undefined

  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    () => resumeRecord?.id ?? null,
  )
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    () => resumeRecord?.updatedAt ?? "",
  )
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(
    () => resumeRecord?.updatedAt ?? "",
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printPreviewRecord, setPrintPreviewRecord] =
    useState<HistoryRecord | null>(null)
  const [confirmInfo, setConfirmInfo] = useState<SubmitConfirmInfo | null>(null)
  const [successInfo, setSuccessInfo] = useState<SubmitSuccessInfo | null>(null)
  const [draftYear, setDraftYear] = useState<string>(
    () => resumeRecord?.period.match(/\b\d{4}\b/)?.[0] ?? data.year,
  )
  const yearOptions = Array.from(
    new Set([...collectReportingYears(data), draftYear]),
  )
  const annualPeriod = data.periods[`${draftYear}-annual`]
  const periodState = getPeriodState(annualPeriod)
  const isPeriodLocked = !periodState.canSubmit
  const isLockedForNewInput = isPeriodLocked && activeDraftId === null
  const lockReason = describePeriodLockReason(
    annualPeriod,
    `Sasaran Kinerja Tahun ${draftYear}`,
  )
  const [criteria, setCriteriaState] = useState<CriteriaItem[]>(() =>
    resumeRecord?.criteriaData?.length
      ? normalizeCriteriaList(resumeRecord.criteriaData)
      : [newCriteria()],
  )
  const initialOrg = resolveInitialUnit(resumeRecord)
  const [unit, setUnitState] = useState<string>(initialOrg.unit)
  const [subUnit, setSubUnitState] = useState<string>(initialOrg.subUnit)

  const independentUnit = Boolean(unit && unitOptions[unit]?.length === 0)
  const availableSubUnits =
    unit && Object.hasOwn(unitOptions, unit)
      ? independentUnit
        ? [unit]
        : unitOptions[unit]
      : []

  const stateRef = useRef({ criteria, unit, subUnit })
  stateRef.current = { criteria, unit, subUnit }

  const buildDraft = (
    draftId: string,
    snapshot: { criteria: CriteriaItem[]; unit: string; subUnit: string },
    nowIso: string,
  ): HistoryRecord => ({
    id: draftId,
    author: session?.displayName || "Staf Unit",
    type: "Sasaran Kinerja",
    title: `Sasaran Kinerja Tahun ${draftYear}`,
    period: `Tahun ${draftYear}`,
    unit: snapshot.subUnit || snapshot.unit || "Belum diisi",
    parentUnit: snapshot.unit || undefined,
    subUnit: snapshot.subUnit || snapshot.unit || undefined,
    sentAt: "Belum dikirim",
    updatedAt: nowIso,
    status: "Draf",
    progress: calculateSasaranKinerjaCompleteness(snapshot.criteria),
    criteriaData: snapshot.criteria,
    items: buildSasaranKinerjaItems(snapshot.criteria),
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

  const setCriteria = (update: SetStateAction<CriteriaItem[]>) => {
    const prev = stateRef.current
    const next = typeof update === "function" ? update(prev.criteria) : update
    const nextSnapshot = { ...prev, criteria: next }
    stateRef.current = nextSnapshot
    setCriteriaState(next)
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
    activeDraftId === null && hasCriteriaContent(criteria, unit, subUnit),
    "Isian sasaran kinerja belum disimpan sebagai draf dan tidak tersimpan otomatis. Tetap tinggalkan halaman?",
  )

  const [attempted, setAttempted] = useState(false)

  // 1. Kriteria actions
  const updateCriteria = (criteriaId: string, name: string) =>
    setCriteria((items) =>
      items.map((item) => (item.id === criteriaId ? { ...item, name } : item)),
    )

  const addCriteria = () => setCriteria((items) => [...items, newCriteria()])

  const insertCriteriaAt = (index: number) =>
    setCriteria((items) => insertItemAt(items, index, newCriteria()))

  const removeCriteria = (criteriaId: string) =>
    setCriteria((items) => items.filter((item) => item.id !== criteriaId))

  // 2. Strategi actions
  const updateStrategy = (
    criteriaId: string,
    strategyId: string,
    name: string,
  ) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((s) => (s.id === strategyId ? { ...s, name } : s))
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  const addStrategy = (criteriaId: string) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const currentStrategies =
          item.strategies ?? (item.strategy ? [item.strategy] : [newStrategy()])
        const updated = [...currentStrategies, newStrategy()]
        return { ...item, strategies: updated, strategy: updated[0] }
      }),
    )

  const insertStrategyAt = (criteriaId: string, index: number) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const currentStrategies =
          item.strategies ?? (item.strategy ? [item.strategy] : [newStrategy()])
        const updated = insertItemAt(currentStrategies, index, newStrategy())
        return { ...item, strategies: updated, strategy: updated[0] }
      }),
    )

  const removeStrategy = (criteriaId: string, strategyId: string) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).filter((s) => s.id !== strategyId)
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  // 3. Program Kerja actions
  const updateProgram = (
    criteriaId: string,
    strategyId: string,
    programId: string,
    name: string,
  ) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((strategy) => {
          if (strategy.id !== strategyId) return strategy
          return {
            ...strategy,
            programs: strategy.programs.map((program) =>
              program.id === programId ? { ...program, name } : program,
            ),
          }
        })
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  const addProgram = (criteriaId: string, strategyId: string) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((strategy) => {
          if (strategy.id !== strategyId) return strategy
          return {
            ...strategy,
            programs: [...strategy.programs, newProgram()],
          }
        })
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  const insertProgramAt = (
    criteriaId: string,
    strategyId: string,
    index: number,
  ) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((strategy) => {
          if (strategy.id !== strategyId) return strategy
          return {
            ...strategy,
            programs: insertItemAt(strategy.programs, index, newProgram()),
          }
        })
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  const removeProgram = (
    criteriaId: string,
    strategyId: string,
    programId: string,
  ) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((strategy) => {
          if (strategy.id !== strategyId) return strategy
          return {
            ...strategy,
            programs: strategy.programs.filter(
              (program) => program.id !== programId,
            ),
          }
        })
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  // 4. Sasaran actions (1-to-Many under Program Kerja)
  const updateSasaran = (
    criteriaId: string,
    strategyId: string,
    programId: string,
    sasaranId: string,
    field: "sasaran" | "bulan_mulai" | "bulan_selesai" | "keterangan",
    value: string,
  ) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((strategy) => {
          if (strategy.id !== strategyId) return strategy
          return {
            ...strategy,
            programs: strategy.programs.map((program) => {
              if (program.id !== programId) return program
              const currentList =
                program.sasaranList ??
                program.targets.map((t) => ({
                  id: t.id,
                  sasaran: t.sasaran ?? t.target ?? "",
                  bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                  bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                  keterangan: t.keterangan ?? t.notes ?? "",
                }))
              const updatedList = currentList.map((sasaran) => {
                if (sasaran.id !== sasaranId) return sasaran
                const updated: any = { ...sasaran, [field]: value }
                if (field === "sasaran") updated.target = value
                if (field === "bulan_mulai") updated.monthStart = value
                if (field === "bulan_selesai") updated.monthEnd = value
                if (field === "keterangan") updated.notes = value
                return updated
              })
              return {
                ...program,
                sasaranList: updatedList,
                targets: updatedList.map((s) => ({
                  id: s.id,
                  target: s.sasaran,
                  monthStart: s.bulan_mulai,
                  monthEnd: s.bulan_selesai,
                  notes: s.keterangan,
                })),
              }
            }),
          }
        })
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  const updateProgramSasaranList = (
    criteriaId: string,
    strategyId: string,
    programId: string,
    transform: (
      list: ReturnType<typeof newSasaran>[],
    ) => ReturnType<typeof newSasaran>[],
  ) =>
    setCriteria((items) =>
      items.map((item) => {
        if (item.id !== criteriaId) return item
        const strategies = (
          item.strategies ?? (item.strategy ? [item.strategy] : [])
        ).map((strategy) => {
          if (strategy.id !== strategyId) return strategy
          return {
            ...strategy,
            programs: strategy.programs.map((program) => {
              if (program.id !== programId) return program
              const currentList =
                program.sasaranList ??
                program.targets.map((t) => ({
                  id: t.id,
                  sasaran: t.sasaran ?? t.target ?? "",
                  bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                  bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                  keterangan: t.keterangan ?? t.notes ?? "",
                }))
              const updatedList = transform(currentList)
              return {
                ...program,
                sasaranList: updatedList,
                targets: updatedList.map((s) => ({
                  id: s.id,
                  target: s.sasaran,
                  monthStart: s.bulan_mulai,
                  monthEnd: s.bulan_selesai,
                  notes: s.keterangan,
                })),
              }
            }),
          }
        })
        return { ...item, strategies, strategy: strategies[0] }
      }),
    )

  const addSasaran = (
    criteriaId: string,
    strategyId: string,
    programId: string,
  ) =>
    updateProgramSasaranList(criteriaId, strategyId, programId, (list) => [
      ...list,
      newSasaran(),
    ])

  const insertSasaranAt = (
    criteriaId: string,
    strategyId: string,
    programId: string,
    index: number,
  ) =>
    updateProgramSasaranList(criteriaId, strategyId, programId, (list) =>
      insertItemAt(list, index, newSasaran()),
    )

  const removeSasaran = (
    criteriaId: string,
    strategyId: string,
    programId: string,
    sasaranId: string,
  ) =>
    updateProgramSasaranList(criteriaId, strategyId, programId, (list) =>
      list.length <= 1 ? list : list.filter((s) => s.id !== sasaranId),
    )

  const incomplete = criteria.some((item) => {
    if (!item.name.trim()) return true
    const strategies = item.strategies ?? (item.strategy ? [item.strategy] : [])
    if (strategies.length === 0) return true
    return strategies.some((strategy) => {
      if (!strategy.name.trim()) return true
      if (strategy.programs.length === 0) return true
      return strategy.programs.some((program) => {
        if (!program.name.trim()) return true
        const sasaranList =
          program.sasaranList ??
          program.targets.map((t) => ({
            sasaran: t.sasaran ?? t.target ?? "",
            bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
            bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
            keterangan: t.keterangan ?? t.notes ?? "",
          }))
        if (sasaranList.length === 0) return true
        return sasaranList.some((sasaran) => {
          if (!sasaran.sasaran.trim()) return true
          if (!sasaran.bulan_mulai) return true
          // bulan_selesai opsional (hanya dicek jika diisi)
          if (
            sasaran.bulan_selesai &&
            sasaran.bulan_selesai < sasaran.bulan_mulai
          )
            return true
          return false
        })
      })
    })
  })

  const saveDraft = () => {
    if (isLockedForNewInput) {
      return notify(
        `${lockReason} Pilih tahun periode yang terbuka atau hubungi Admin PRP.`,
        "error",
      )
    }
    const isExistingDraft = activeDraftId !== null
    const draftId =
      activeDraftId ??
      `DRAF-SK-${draftYear}-${crypto.randomUUID().slice(0, 8)}`
    const nowIso = new Date().toISOString()
    const draftRecord = buildDraft(draftId, { criteria, unit, subUnit }, nowIso)
    setData((current) => ({
      ...current,
      records: upsertDraftRecord(current.records, draftRecord),
    }))
    setActiveDraftId(draftId)
    setLastSavedAt(nowIso)
    setLastModifiedAt((prev) => prev || nowIso)
    notify(
      isExistingDraft
        ? "Draf sasaran kinerja berhasil diperbarui."
        : "Draf sasaran kinerja disimpan. Simpan otomatis kini aktif.",
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
    if (!unit || !subUnit || incomplete) {
      setPreviewOpen(false)
      setPrintPreviewRecord(null)
      notify(
        !unit || !subUnit
          ? incomplete
            ? "Lengkapi Unit, Kriteria, dan seluruh kolom wajib sebelum mengirim."
            : "Pilih Unit Utama dan Sub Unit / Bagian sebelum mengirim."
          : "Lengkapi Kriteria dan seluruh kolom wajib sebelum mengirim.",
        "error",
      )
      window.scrollTo({ top: 0, behavior: "smooth" })
      return false
    }
    const totalSasaran = criteria.reduce(
      (sum, crit) =>
        sum +
        (crit.strategies ?? [crit.strategy]).reduce(
          (sSum, strat) =>
            sSum +
            strat.programs.reduce(
              (pSum, prog) =>
                pSum + (prog.sasaranList ?? prog.targets).length,
              0,
            ),
          0,
        ),
      0,
    )
    setConfirmInfo({
      title: "Konfirmasi Pengiriman Sasaran Kinerja",
      description:
        "Apakah Anda yakin ingin mengirim dokumen ini sekarang? Anda masih dapat memilih Cek Kembali untuk meninjau ulang isian.",
      documentTitle: `Sasaran Kinerja Tahun ${draftYear}`,
      period: `Tahun ${draftYear}`,
      unit: subUnit || unit,
      summary: `${criteria.length} kriteria · ${totalSasaran} sasaran`,
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
      id: `SK-${draftYear}-${crypto.randomUUID()}`,
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
      message: `${unitLabel} · ${submittedRecord.period} menunggu verifikasi.`,
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
    const fresh = [newCriteria()]
    stateRef.current = { criteria: fresh, unit: "", subUnit: "" }
    setUnitState("")
    setSubUnitState("")
    setCriteriaState(fresh)
    setActiveDraftId(null)
    setLastSavedAt("")
    setLastModifiedAt("")
    setAttempted(false)
    setSuccessInfo({
      title: "Sasaran Kinerja Berhasil Dikirim",
      subtitle:
        "Dokumen RKA/Sasaran Kinerja telah masuk ke antrean verifikasi Admin PRP.",
      documentTitle: submittedRecord.title,
      period: submittedRecord.period,
      unit: submittedRecord.unit,
      sentAt,
      statusLabel: "Menunggu Verifikasi",
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

  const completeness = calculateSasaranKinerjaCompleteness(criteria)

  const previewRecord = previewOpen
    ? buildDraft(
      activeDraftId ?? "PRATINJAU-SEMENTARA",
      { criteria, unit, subUnit },
      lastModifiedAt,
    )
    : null

  return (
    <div className="target-page">
      <div className="report-heading">
        <div>
          <div className="report-kicker">PERENCANAAN KINERJA</div>
          <div className="report-title">Rencana & Sasaran Tahun {draftYear}</div>
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
              <label className="meta-control year-control" htmlFor="sasaran-draft-year">
                <span>Tahun RKA / Sasaran</span>
                <select
                  id="sasaran-draft-year"
                  name="draftYear"
                  aria-label="Tahun sasaran kinerja"
                  value={draftYear}
                  disabled={activeDraftId !== null}
                  onChange={(e) => {
                    setDraftYear(e.target.value)
                    setLastModifiedAt(new Date().toISOString())
                  }}
                >
                  {yearOptions.map((y) => {
                    const yState = getPeriodState(data.periods[`${y}-annual`])
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
            <strong>{formatDeadlineSummary(annualPeriod)}</strong>
          </p>
        </div>
        <div>
          <span>
            <Icon name="chart" size={15} />
          </span>
          <p>
            Kelengkapan sasaran
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
                : "Periode Sasaran Kinerja Terkunci"}
            </strong>
            <span>
              {lockReason}{" "}
              {activeDraftId !== null
                ? "Draf tersimpan tetap dapat diperbarui, namun pengiriman baru menunggu pembukaan atau perpanjangan waktu dari Admin PRP."
                : "Pilih tahun periode yang berstatus Dibuka, atau hubungi Admin PRP apabila memerlukan perpanjangan waktu."}
            </span>
          </div>
        </div>
      )}

      <fieldset className="locked-fieldset" disabled={isLockedForNewInput}>
        <div className="criteria-list">
          <div className="insert-top-rail">
            <button
              type="button"
              className="insert-top-btn"
              onClick={() => insertCriteriaAt(0)}
              title="Tambah kriteria sebelum #1"
              aria-label="Tambah kriteria sebelum #1"
            >
              <Icon name="plus" size={13} />
            </button>
          </div>
          {criteria.map((item, criteriaIndex) => {
            const strategies =
              item.strategies ?? (item.strategy ? [item.strategy] : [])
            return (
              <section className="hierarchy-card" key={item.id}>
                {/* LEVEL 1: KRITERIA */}
                <div className="parent-card-head">
                  <span className="parent-step">{criteriaIndex + 1}</span>
                  <label className="parent-title-input" htmlFor={`sasaran-criteria-${criteriaIndex}`}>
                    <span>
                      Kriteria <b>*</b>
                    </span>
                    <input
                      id={`sasaran-criteria-${criteriaIndex}`}
                      name={`criteria[${criteriaIndex}].name`}
                      className={attempted && !item.name.trim() ? "invalid" : ""}
                      value={item.name}
                      onChange={(e) => updateCriteria(item.id, e.target.value)}
                      placeholder="Contoh: Organisasi, Penjaminan Mutu, dan Kerjasama"
                    />
                  </label>
                  <div className="hierarchy-head-actions action-icon-group">
                    <button
                      type="button"
                      className="row-icon-btn is-insert is-on-navy"
                      onClick={() => insertCriteriaAt(criteriaIndex + 1)}
                      title={`Tambah kriteria setelah #${criteriaIndex + 1}`}
                      aria-label={`Tambah kriteria setelah #${criteriaIndex + 1}`}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                    <button
                      type="button"
                      className="row-icon-btn is-delete is-on-navy"
                      disabled={criteria.length <= 1}
                      onClick={() => removeCriteria(item.id)}
                      title={
                        criteria.length > 1
                          ? `Hapus kriteria #${criteriaIndex + 1}`
                          : "Minimal 1 kriteria harus ada"
                      }
                      aria-label={`Hapus kriteria #${criteriaIndex + 1}`}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                <div className="hierarchy-body">
                  {/* LEVEL 2: STRATEGI LIST */}
                  <div className="strategy-list-container">
                    <div className="insert-top-rail">
                      <button
                        type="button"
                        className="insert-top-btn"
                        onClick={() => insertStrategyAt(item.id, 0)}
                        title={`Tambah strategi sebelum ${criteriaIndex + 1}.1`}
                        aria-label={`Tambah strategi sebelum ${criteriaIndex + 1}.1`}
                      >
                        <Icon name="plus" size={12} />
                      </button>
                    </div>
                    {strategies.map((strategy, strategyIndex) => {
                      const strategyNum = `${criteriaIndex + 1}.${strategyIndex + 1}`
                      return (
                        <div className="strategy-block" key={strategy.id}>
                          <div className="strategy-head">
                            <div className="strategy-number">{strategyNum}</div>
                            <label
                              className="field strategy-input"
                              htmlFor={`sasaran-strategy-${criteriaIndex}-${strategyIndex}`}
                            >
                              <span>
                                Strategi <b>*</b>
                              </span>
                              <input
                                id={`sasaran-strategy-${criteriaIndex}-${strategyIndex}`}
                                name={`criteria[${criteriaIndex}].strategies[${strategyIndex}].name`}
                                className={
                                  attempted && !strategy.name.trim()
                                    ? "invalid"
                                    : ""
                                }
                                value={strategy.name}
                                onChange={(e) =>
                                  updateStrategy(
                                    item.id,
                                    strategy.id,
                                    e.target.value,
                                  )
                                }
                                placeholder="Contoh: Mengembangkan program studi yang terakreditasi..."
                              />
                            </label>
                            <div className="hierarchy-head-actions action-icon-group">
                              <button
                                type="button"
                                className="row-icon-btn is-insert"
                                onClick={() =>
                                  insertStrategyAt(item.id, strategyIndex + 1)
                                }
                                title={`Tambah strategi setelah ${strategyNum}`}
                                aria-label={`Tambah strategi setelah ${strategyNum}`}
                              >
                                <Icon name="plus" size={14} />
                              </button>
                              <button
                                type="button"
                                className="row-icon-btn is-delete"
                                disabled={strategies.length <= 1}
                                onClick={() =>
                                  removeStrategy(item.id, strategy.id)
                                }
                                title={
                                  strategies.length > 1
                                    ? `Hapus strategi ${strategyNum}`
                                    : "Minimal 1 strategi harus ada"
                                }
                                aria-label={`Hapus strategi ${strategyNum}`}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          </div>

                          {/* LEVEL 3: PROGRAM KERJA LIST */}
                          <div className="program-section-label">
                            <span>DAFTAR PROGRAM</span>
                            <i>{strategy.programs.length} entri</i>
                          </div>

                          <div className="program-list">
                            <div className="insert-top-rail">
                              <button
                                type="button"
                                className="insert-top-btn"
                                onClick={() =>
                                  insertProgramAt(item.id, strategy.id, 0)
                                }
                                title={`Tambah program sebelum ${strategyNum}.1`}
                                aria-label={`Tambah program sebelum ${strategyNum}.1`}
                              >
                                <Icon name="plus" size={12} />
                              </button>
                            </div>
                            {strategy.programs.map((program, programIndex) => {
                              const programNum = `${strategyNum}.${programIndex + 1}`
                              const sasaranList =
                                program.sasaranList ??
                                program.targets.map((t) => ({
                                  id: t.id,
                                  sasaran: t.sasaran ?? t.target ?? "",
                                  bulan_mulai:
                                    t.bulan_mulai ?? t.monthStart ?? "",
                                  bulan_selesai:
                                    t.bulan_selesai ?? t.monthEnd ?? "",
                                  keterangan: t.keterangan ?? t.notes ?? "",
                                }))
                              const canDeleteProgram =
                                strategy.programs.length > 1

                              return (
                                <div className="program-card" key={program.id}>
                                  <div className="program-head">
                                    <span>{programNum}</span>
                                    <label
                                      className="field"
                                      htmlFor={`sasaran-program-${criteriaIndex}-${strategyIndex}-${programIndex}`}
                                    >
                                      <span>
                                        Program <b>*</b>
                                      </span>
                                      <input
                                        id={`sasaran-program-${criteriaIndex}-${strategyIndex}-${programIndex}`}
                                        name={`criteria[${criteriaIndex}].strategies[${strategyIndex}].programs[${programIndex}].name`}
                                        className={
                                          attempted && !program.name.trim()
                                            ? "invalid"
                                            : ""
                                        }
                                        value={program.name}
                                        onChange={(e) =>
                                          updateProgram(
                                            item.id,
                                            strategy.id,
                                            program.id,
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Nama program kerja"
                                      />
                                    </label>
                                    <div className="hierarchy-head-actions action-icon-group">
                                      <button
                                        type="button"
                                        className="row-icon-btn is-insert"
                                        onClick={() =>
                                          insertProgramAt(
                                            item.id,
                                            strategy.id,
                                            programIndex + 1,
                                          )
                                        }
                                        title={`Tambah program setelah ${programNum}`}
                                        aria-label={`Tambah program setelah ${programNum}`}
                                      >
                                        <Icon name="plus" size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        className="row-icon-btn is-delete"
                                        disabled={!canDeleteProgram}
                                        aria-label={`Hapus program ${programNum}`}
                                        title={
                                          canDeleteProgram
                                            ? `Hapus program ${programNum}`
                                            : "Minimal 1 program harus ada"
                                        }
                                        onClick={() =>
                                          removeProgram(
                                            item.id,
                                            strategy.id,
                                            program.id,
                                          )
                                        }
                                      >
                                        <Icon name="trash" size={13} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* LEVEL 4: SASARAN (1-TO-MANY) */}
                                  <div className="sasaran-section">
                                    <div className="insert-top-rail is-inner">
                                      <button
                                        type="button"
                                        className="insert-top-btn"
                                        onClick={() =>
                                          insertSasaranAt(
                                            item.id,
                                            strategy.id,
                                            program.id,
                                            0,
                                          )
                                        }
                                        title="Tambah sasaran sebelum #1"
                                        aria-label="Tambah sasaran sebelum #1"
                                      >
                                        <Icon name="plus" size={12} />
                                      </button>
                                    </div>
                                    {sasaranList.map((sasaran, sasaranIndex) => {
                                      const canDeleteSasaran =
                                        sasaranList.length > 1
                                      return (
                                        <div
                                          key={sasaran.id}
                                          className={`sasaran-item-wrapper ${sasaranIndex > 0
                                            ? "sasaran-divider"
                                            : ""
                                            }`}
                                        >
                                          <div className="sasaran-item-topbar">
                                            <div className="sasaran-item-badge">
                                              Sasaran {sasaranIndex + 1}
                                            </div>
                                            <div className="sasaran-item-actions action-icon-group">
                                              <button
                                                type="button"
                                                className="row-icon-btn is-insert is-compact"
                                                onClick={() =>
                                                  insertSasaranAt(
                                                    item.id,
                                                    strategy.id,
                                                    program.id,
                                                    sasaranIndex + 1,
                                                  )
                                                }
                                                title={`Tambah sasaran setelah #${sasaranIndex + 1}`}
                                                aria-label={`Tambah sasaran setelah #${sasaranIndex + 1}`}
                                              >
                                                <Icon name="plus" size={13} />
                                              </button>
                                              <button
                                                type="button"
                                                className="row-icon-btn is-delete is-compact"
                                                disabled={!canDeleteSasaran}
                                                onClick={() =>
                                                  removeSasaran(
                                                    item.id,
                                                    strategy.id,
                                                    program.id,
                                                    sasaran.id,
                                                  )
                                                }
                                                title={
                                                  canDeleteSasaran
                                                    ? `Hapus Sasaran ${sasaranIndex + 1}`
                                                    : "Minimal 1 sasaran harus ada"
                                                }
                                                aria-label={`Hapus Sasaran ${sasaranIndex + 1}`}
                                              >
                                                <Icon name="trash" size={13} />
                                              </button>
                                            </div>
                                          </div>

                                          <div className="program-package">
                                            <label
                                              className="field"
                                              htmlFor={`sasaran-desc-${criteriaIndex}-${strategyIndex}-${programIndex}-${sasaranIndex}`}
                                            >
                                              <span>
                                                Uraian Sasaran <b>*</b>
                                              </span>
                                              <textarea
                                                id={`sasaran-desc-${criteriaIndex}-${strategyIndex}-${programIndex}-${sasaranIndex}`}
                                                name={`criteria[${criteriaIndex}].strategies[${strategyIndex}].programs[${programIndex}].sasaran[${sasaranIndex}].sasaran`}
                                                className={
                                                  attempted &&
                                                    !sasaran.sasaran.trim()
                                                    ? "invalid"
                                                    : ""
                                                }
                                                value={sasaran.sasaran}
                                                onChange={(e) =>
                                                  updateSasaran(
                                                    item.id,
                                                    strategy.id,
                                                    program.id,
                                                    sasaran.id,
                                                    "sasaran",
                                                    e.target.value,
                                                  )
                                                }
                                                placeholder="Tuliskan sasaran program kerja ini"
                                              />
                                            </label>
                                            <div className="field">
                                              <span>
                                                Bulan Pelaksanaan <b>*</b>
                                              </span>
                                              <div className="target-months">
                                                <input
                                                  id={`sasaran-start-${criteriaIndex}-${strategyIndex}-${programIndex}-${sasaranIndex}`}
                                                  name={`criteria[${criteriaIndex}].strategies[${strategyIndex}].programs[${programIndex}].sasaran[${sasaranIndex}].bulanMulai`}
                                                  aria-label="Bulan mulai"
                                                  type="month"
                                                  className={
                                                    attempted &&
                                                      !sasaran.bulan_mulai
                                                      ? "invalid"
                                                      : ""
                                                  }
                                                  value={sasaran.bulan_mulai}
                                                  onChange={(e) =>
                                                    updateSasaran(
                                                      item.id,
                                                      strategy.id,
                                                      program.id,
                                                      sasaran.id,
                                                      "bulan_mulai",
                                                      e.target.value,
                                                    )
                                                  }
                                                />
                                                <span>hingga</span>
                                                <input
                                                  id={`sasaran-end-${criteriaIndex}-${strategyIndex}-${programIndex}-${sasaranIndex}`}
                                                  name={`criteria[${criteriaIndex}].strategies[${strategyIndex}].programs[${programIndex}].sasaran[${sasaranIndex}].bulanSelesai`}
                                                  aria-label="Bulan selesai"
                                                  type="month"
                                                  min={
                                                    sasaran.bulan_mulai ||
                                                    undefined
                                                  }
                                                  className={
                                                    attempted &&
                                                      sasaran.bulan_selesai &&
                                                      sasaran.bulan_selesai <
                                                      sasaran.bulan_mulai
                                                      ? "invalid"
                                                      : ""
                                                  }
                                                  value={
                                                    sasaran.bulan_selesai ?? ""
                                                  }
                                                  onChange={(e) =>
                                                    updateSasaran(
                                                      item.id,
                                                      strategy.id,
                                                      program.id,
                                                      sasaran.id,
                                                      "bulan_selesai",
                                                      e.target.value,
                                                    )
                                                  }
                                                  placeholder="Opsional"
                                                />
                                              </div>
                                              <small className="field-hint">
                                                Bulan selesai opsional (kosongkan
                                                jika 1 bulan)
                                              </small>
                                            </div>
                                            <label
                                              className="field"
                                              htmlFor={`sasaran-notes-${criteriaIndex}-${strategyIndex}-${programIndex}-${sasaranIndex}`}
                                            >
                                              <span>Keterangan</span>
                                              <textarea
                                                id={`sasaran-notes-${criteriaIndex}-${strategyIndex}-${programIndex}-${sasaranIndex}`}
                                                name={`criteria[${criteriaIndex}].strategies[${strategyIndex}].programs[${programIndex}].sasaran[${sasaranIndex}].keterangan`}
                                                value={sasaran.keterangan}
                                                onChange={(e) =>
                                                  updateSasaran(
                                                    item.id,
                                                    strategy.id,
                                                    program.id,
                                                    sasaran.id,
                                                    "keterangan",
                                                    e.target.value,
                                                  )
                                                }
                                                placeholder="Keterangan tambahan (opsional)"
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      )
                                    })}

                                    <div className="sasaran-footer-actions">
                                      <button
                                        type="button"
                                        className="add-target-btn"
                                        onClick={() =>
                                          addSasaran(
                                            item.id,
                                            strategy.id,
                                            program.id,
                                          )
                                        }
                                      >
                                        <span>+</span> Tambah Sasaran
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <button
                            type="button"
                            className="add-program"
                            onClick={() => addProgram(item.id, strategy.id)}
                          >
                            <span>+</span>
                            <div>
                              Tambah Program
                              <small>
                                Program baru di Strategi {strategyNum}
                              </small>
                            </div>
                          </button>
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      className="add-strategy"
                      onClick={() => addStrategy(item.id)}
                    >
                      <span>+</span>
                      <div>
                        Tambah Strategi
                        <small>
                          Strategi baru di Kriteria {criteriaIndex + 1}
                        </small>
                      </div>
                    </button>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </fieldset>

      <button
        type="button"
        className="add-criteria"
        disabled={isLockedForNewInput}
        onClick={addCriteria}
      >
        <span>+</span>
        <div>
          Tambah Kriteria
          <small>Kriteria baru beserta strategi & program</small>
        </div>
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
            Kirim Sasaran <Icon name="arrow" size={17} />
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
        headerTitle="Pratinjau Cetak Sasaran"
        headerSubtitle="Periksa isian sebelum dikirim · A4 Landscape"
        confirmSubmitLabel="Kirim Sasaran"
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

export default InputSasaranKinerja
