import { useEffect, useState } from "react"
import {
  confirmNavigation,
  useUnsavedChanges,
} from "../utils/useUnsavedChanges"
import { collectReportingYears, useReporting } from "../ReportingContext"
import { Icon } from "../components/Icon"
import { DetailModal } from "../components/DetailModal"
import { PrintPreviewModal } from "../components/PrintPreviewModal"
import {
  SubmitConfirmModal,
  type SubmitConfirmInfo,
} from "../components/SubmitConfirmModal"
import {
  SubmitSuccessModal,
  type SubmitSuccessInfo,
} from "../components/SubmitSuccessModal"
import type { HistoryRecord, HistoryStatus, HistoryType, NotifyFn } from "../types"
import { exportRecordExcel } from "../utils/exportExcel"
import { formatUpdatedAtLabel } from "../utils/drafts"
import { reviseRecord } from "../utils/revision"
import { filterRecordsForSession, recordBelongsToSession } from "../utils/auth"
import { useAuth } from "../AuthContext"
import {
  appendNotifications,
  createAppNotification,
  formatRecordUnitLabel,
} from "../utils/notifications"
import {
  describePeriodLockReason,
  getPeriodState,
  resolveRecordPeriodKey,
} from "../utils/workflow"

export const initialHistory: HistoryRecord[] = []

type RiwayatLaporanProps = {
  notify: NotifyFn
  onContinueDraft: (record: HistoryRecord) => void
  initialStatus?: "Semua" | HistoryStatus
  openRecordRequest?: { id: string; seq: number; revise?: boolean } | null
}

function historyPeriod(period: string) {
  return {
    label: period.match(/Triwulan\s+(IV|III|II|I)\b/i)?.[0] ?? "Tahunan",
    year: period.match(/\b\d{4}\b/)?.[0] ?? "-",
  }
}

export function RiwayatLaporan({
  notify,
  onContinueDraft,
  initialStatus = "Semua",
  openRecordRequest,
}: RiwayatLaporanProps) {
  const { data, setData } = useReporting()
  const { session } = useAuth()
  const records = filterRecordsForSession(data.records, session)
  const [tab, setTab] = useState<"Semua" | HistoryType>("Semua")
  const [status, setStatus] = useState<"Semua" | HistoryStatus>(initialStatus)
  const [yearFilter, setYearFilter] = useState("")
  const [query, setQuery] = useState("")
  const yearOptions = collectReportingYears(data)
  const [selected, setSelected] = useState<HistoryRecord | null>(null)
  const [printPreview, setPrintPreview] = useState<HistoryRecord | null>(null)
  const [confirmInfo, setConfirmInfo] = useState<SubmitConfirmInfo | null>(null)
  const [successInfo, setSuccessInfo] = useState<SubmitSuccessInfo | null>(null)
  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState<Record<number, string>>({})
  const selectedPeriodKey = selected ? resolveRecordPeriodKey(selected) : null
  const selectedPeriod = selectedPeriodKey
    ? data.periods[selectedPeriodKey]
    : undefined
  const selectedPeriodState = selectedPeriodKey
    ? getPeriodState(selectedPeriod)
    : null
  const revisionLocked = Boolean(
    editing && selectedPeriodState && !selectedPeriodState.canSubmit,
  )
  const revisionLockReason = revisionLocked
    ? `${describePeriodLockReason(selectedPeriod, "Periode dokumen ini")} Perpanjangan waktu atau pembukaan periode dari Admin PRP diperlukan sebelum perbaikan dapat dikirim ulang.`
    : ""
  const hasRevisionEdits = Boolean(
    editing &&
    !revisionLocked &&
    selected &&
    selected.items.some(
      (item, index) => (edits[index] ?? item.value) !== item.value,
    ),
  )
  useUnsavedChanges(hasRevisionEdits)

  const filtered = records.filter(
    (record) =>
      (tab === "Semua" || record.type === tab) &&
      (status === "Semua" || record.status === status) &&
      (!yearFilter || record.period.includes(yearFilter)) &&
      `${record.title} ${record.id} ${record.unit}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )

  const openDetail = (record: HistoryRecord, revise = false) => {
    setSelected(record)
    setEditing(revise)
    setEdits(
      Object.fromEntries(
        record.items.map((item, index) => [index, item.value]),
      ),
    )
  }

  const [lastRecordSeq, setLastRecordSeq] = useState(0)
  useEffect(() => {
    if (!openRecordRequest || openRecordRequest.seq === lastRecordSeq) return
    setLastRecordSeq(openRecordRequest.seq)
    const target = records.find((item) => item.id === openRecordRequest.id)
    if (target) {
      openDetail(
        target,
        Boolean(openRecordRequest.revise && target.status === "Revisi"),
      )
    }
  }, [openRecordRequest, lastRecordSeq, records])

  const exportExcel = (record: HistoryRecord) => {
    notify(exportRecordExcel(record))
  }

  const requestSaveRevision = () => {
    if (!selected) return
    if (!recordBelongsToSession(selected, session)) return
    if (selected.status !== "Revisi") return
    if (revisionLocked) {
      return notify(
        revisionLockReason ||
        "Periode pengumpulan sedang terkunci. Hubungi Admin PRP untuk perpanjangan waktu.",
        "error",
      )
    }
    setConfirmInfo({
      title: "Konfirmasi Kirim Perbaikan",
      description:
        "Periksa kembali perubahan revisi Anda. Setelah dikirim ulang, dokumen akan masuk kembali ke antrean verifikasi Admin PRP.",
      documentTitle: selected.title,
      period: selected.period,
      unit: selected.unit,
      cancelLabel: "Cek Kembali",
      confirmLabel: "Ya, Kirim Perbaikan",
    })
  }

  const commitSaveRevision = () => {
    setConfirmInfo(null)
    if (
      !selected ||
      !recordBelongsToSession(selected, session) ||
      selected.status !== "Revisi" ||
      revisionLocked
    )
      return
    const revised = reviseRecord(selected, edits, session?.displayName)
    const updated = {
      ...revised,
      author: session?.displayName || revised.author,
    }
    const unitLabel = formatRecordUnitLabel(updated)
    const revisionRound = (updated.reviews ?? []).filter(
      (rev) => rev.action === "Revisi",
    ).length
    const adminNotif = createAppNotification({
      recipient: "admin",
      category: "revision_resubmitted",
      title: updated.title,
      message: `${unitLabel} · ${updated.period}${revisionRound > 0 ? ` · Putaran ke-${revisionRound}` : ""} siap diperiksa kembali.`,
      actor: `${updated.author || "Staf Unit"} (${unitLabel})`,
      targetMenu:
        updated.type === "Sasaran Kinerja"
          ? "Verifikasi Sasaran Kinerja"
          : "Verifikasi Laporan Triwulan",
      recordId: updated.id,
      unitLabel,
      periodLabel: updated.period,
    })

    setData((current) => ({
      ...current,
      records: current.records.map((item) =>
        item.id === selected.id ? updated : item,
      ),
      notifications: appendNotifications(current.notifications, adminNotif),
    }))
    setSelected(null)
    setEditing(false)
    setSuccessInfo({
      title: "Perbaikan Revisi Berhasil Dikirim",
      subtitle:
        "Hasil perbaikan telah dikirim ulang untuk diverifikasi kembali oleh Admin PRP.",
      documentTitle: updated.title,
      period: updated.period,
      unit: updated.unit,
      sentAt: new Date().toLocaleString("id-ID"),
      statusLabel: "Menunggu Verifikasi",
    })
  }

  const counts = {
    Menunggu: records.filter((item) => item.status === "Menunggu").length,
    Disetujui: records.filter((item) => item.status === "Disetujui").length,
    Revisi: records.filter((item) => item.status === "Revisi").length,
  }

  return (
    <div className="history-page">
      <div className="report-heading">
        <div>
          <div className="report-kicker">ARSIP & MONITORING</div>
          <div className="report-title">Daftar Dokumen & Verifikasi</div>
          <p>
            Lanjutkan draf, pantau status laporan, dan tindak lanjuti catatan verifikator.
          </p>
        </div>
        <button
          className="history-help"
          onClick={() =>
            notify(
              "Status diperbarui otomatis setelah proses verifikasi selesai.",
            )
          }
        >
          <Icon name="help" size={16} /> Panduan status
        </button>
      </div>

      <div className="history-stats">
        <div>
          <span className="stat-icon all">
            <Icon name="history" size={19} />
          </span>
          <p>
            Total Dokumen<strong>{records.length}</strong>
          </p>
        </div>
        <div>
          <span className="stat-icon waiting">
            <Icon name="clock" size={19} />
          </span>
          <p>
            Menunggu<strong>{counts.Menunggu}</strong>
          </p>
        </div>
        <div>
          <span className="stat-icon approved">
            <Icon name="check" size={19} />
          </span>
          <p>
            Disetujui<strong>{counts.Disetujui}</strong>
          </p>
        </div>
        <div>
          <span className="stat-icon revision">!</span>
          <p>
            Perlu Revisi<strong>{counts.Revisi}</strong>
          </p>
        </div>
      </div>

      <section className="history-panel">
        <div className="history-toolbar">
          <div className="history-tabs">
            {(["Semua", "Laporan Triwulan", "Sasaran Kinerja"] as const).map(
              (item) => (
                <button
                  className={tab === item ? "active" : ""}
                  key={item}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <div className="history-filters">
            <label htmlFor="riwayat-search">
              <Icon name="search" size={16} />
              <input
                id="riwayat-search"
                name="query"
                aria-label="Cari dokumen"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari dokumen..."
              />
            </label>
            <select
              id="riwayat-year"
              name="yearFilter"
              aria-label="Filter tahun"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">Semua Tahun</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
            <select
              id="riwayat-status"
              name="statusFilter"
              aria-label="Filter status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="Semua">Semua</option>
              <option value="Draf">Draf</option>
              <option value="Menunggu">Menunggu</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Revisi">Revisi</option>
            </select>
          </div>
        </div>

        <div className="history-table-head">
          <span>Dokumen</span>
          <span>Periode</span>
          <span>Dikirim</span>
          <span>Status</span>
          <span>Aksi</span>
        </div>
        <div className="history-list">
          {filtered.map((record) => {
            const updatedLabel =
              record.status === "Draf"
                ? formatUpdatedAtLabel(record.updatedAt)
                : null
            return (
              <div className="history-row" key={record.id}>
                <div className="document-cell">
                  <span
                    className={
                      record.type === "Laporan Triwulan"
                        ? "doc-icon blue"
                        : "doc-icon violet"
                    }
                  >
                    <Icon
                      name={
                        record.type === "Laporan Triwulan" ? "report" : "target"
                      }
                      size={18}
                    />
                  </span>
                  <p>
                    <strong>{record.title}</strong>
                    <span>
                      {record.id} · {record.unit}
                      {updatedLabel ? ` · Diperbarui ${updatedLabel}` : ""}
                    </span>
                  </p>
                </div>
                <div className="period-cell">
                  <strong>{historyPeriod(record.period).label}</strong>
                  <span>{historyPeriod(record.period).year}</span>
                </div>
                <div className="sent-cell">{record.sentAt}</div>
                <div>
                  <span className={`status-chip ${record.status.toLowerCase()}`}>
                    {record.status}
                  </span>
                </div>
                <div className="history-actions">
                  {record.status === "Draf" ? (
                    <button
                      aria-label={`Lanjut Isi ${record.title}`}
                      onClick={() => {
                        if (!confirmNavigation()) return
                        onContinueDraft(record)
                      }}
                    >
                      Lanjut Isi
                    </button>
                  ) : record.status === "Revisi" ? (
                    <button
                      className="revise-button"
                      onClick={() => openDetail(record, true)}
                    >
                      Perbaiki
                    </button>
                  ) : (
                    <button onClick={() => openDetail(record)}>
                      Lihat Detail
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {!filtered.length && (
            <div className="empty-history">
              <Icon name="search" size={25} />
              <strong>Dokumen tidak ditemukan</strong>
              <span>Coba ubah kata kunci atau filter status.</span>
            </div>
          )}
        </div>
      </section>

      <DetailModal
        record={selected}
        editing={editing}
        edits={edits}
        revisionLocked={revisionLocked}
        revisionLockReason={revisionLockReason}
        onClose={() => {
          if (
            hasRevisionEdits &&
            !window.confirm(
              "Perubahan revisi belum dikirim. Tutup detail dan batalkan perubahan?",
            )
          )
            return
          setSelected(null)
          setEditing(false)
          setEdits({})
        }}
        onCancelEditing={() => {
          if (
            hasRevisionEdits &&
            !window.confirm("Batalkan perubahan revisi yang belum dikirim?")
          )
            return
          if (selected) {
            setEdits(
              Object.fromEntries(
                selected.items.map((item, index) => [index, item.value]),
              ),
            )
          }
          setEditing(false)
        }}
        onUpdateEdit={(index, value) =>
          setEdits((current) => ({ ...current, [index]: value }))
        }
        onSaveRevision={requestSaveRevision}
        onExportExcel={exportExcel}
        onPrintPreview={(rec) => setPrintPreview(rec)}
      />

      <PrintPreviewModal
        record={printPreview}
        onClose={() => setPrintPreview(null)}
      />
      <SubmitConfirmModal
        info={confirmInfo}
        onCancel={() => setConfirmInfo(null)}
        onConfirm={commitSaveRevision}
      />
      <SubmitSuccessModal
        info={successInfo}
        onClose={() => setSuccessInfo(null)}
      />
    </div>
  )
}
export default RiwayatLaporan
