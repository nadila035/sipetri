import { AnnualSourceSummary } from "./AnnualSourceSummary"
import { useReporting } from "../ReportingContext"
import { formatUpdatedAtLabel } from "../utils/drafts"
import { formatBulanPelaksanaan, getTriwulanData } from "../utils/format"
import { getSasaranKinerjaReviewCriteria } from "../utils/review"
import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"
import type { HistoryRecord } from "../types"

type DetailModalProps = {
  record: HistoryRecord | null
  editing?: boolean
  edits?: Record<number, string>
  revisionLocked?: boolean
  revisionLockReason?: string
  isDraftPreview?: boolean
  isAdmin?: boolean
  canReview?: boolean
  onClose: () => void
  onCancelEditing?: () => void
  onUpdateEdit?: (index: number, value: string) => void
  onSaveRevision?: () => void
  onExportExcel?: (record: HistoryRecord) => void
  onPrintPreview: (record: HistoryRecord) => void
  onOpenReview?: (record: HistoryRecord) => void
}

export function DetailModal({
  record,
  editing = false,
  edits = {},
  revisionLocked = false,
  revisionLockReason = "",
  isDraftPreview = false,
  isAdmin = false,
  canReview = true,
  onClose,
  onCancelEditing = () => {},
  onUpdateEdit = () => {},
  onSaveRevision = () => {},
  onExportExcel,
  onPrintPreview,
  onOpenReview,
}: DetailModalProps) {
  const { data } = useReporting()
  useDialog(!!record, onClose, ".detail-overlay")
  if (!record) return null
  const canEdit = editing && !revisionLocked
  const isUnsavedTemp = isDraftPreview && record.id === "PRATINJAU-SEMENTARA"
  const updatedAtLabel = formatUpdatedAtLabel(record.updatedAt)
  const docYear = record.period.match(/\b(\d{4})\b/)?.[1] ?? data.year
  const strategicGoals = data.strategicGoals ?? []

  const renderEditableCell = (
    itemIdx: number,
    fallbackVal: string,
    ariaLabel: string,
    options?: {
      isStrategicGoal?: boolean
      isLink?: boolean
      centerText?: boolean
    },
  ) => {
    const item = itemIdx >= 0 ? record.items[itemIdx] : undefined
    const val =
      (itemIdx >= 0 ? edits[itemIdx] : undefined) ?? item?.value ?? fallbackVal

    if (canEdit && item?.needsRevision && itemIdx >= 0) {
      if (options?.isStrategicGoal && strategicGoals.length > 0) {
        return (
          <>
            <select
              id={`detail-edit-${itemIdx}`}
              aria-label={ariaLabel}
              value={val}
              onChange={(e) => onUpdateEdit(itemIdx, e.target.value)}
            >
              {strategicGoals.map((g) => (
                <option key={g.id} value={g.name}>
                  [{g.code}] {g.name}
                </option>
              ))}
              {val && !strategicGoals.some((g) => g.name === val) && (
                <option value={val}>{val}</option>
              )}
            </select>
            {item.note && (
              <div className="cell-note">
                <strong>Catatan:</strong>
                {item.note}
              </div>
            )}
          </>
        )
      }
      return (
        <>
          <textarea
            id={`detail-edit-${itemIdx}`}
            name={`detailEdit[${itemIdx}]`}
            aria-label={ariaLabel}
            style={options?.centerText ? { textAlign: "center" } : undefined}
            value={val}
            onChange={(e) => onUpdateEdit(itemIdx, e.target.value)}
          />
          {item.note && (
            <div className="cell-note">
              <strong>Catatan:</strong>
              {item.note}
            </div>
          )}
        </>
      )
    }

    const trimmed = (val || "-").trim()
    return (
      <>
        {options?.isLink && /^https?:\/\/\S+$/i.test(trimmed) ? (
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1d4ed8", textDecoration: "underline" }}
          >
            {trimmed}
          </a>
        ) : (
          <p style={options?.centerText ? { textAlign: "center" } : undefined}>
            {trimmed || "-"}
          </p>
        )}
        {item?.note && (
          <div className="cell-note">
            <strong>Catatan:</strong>
            {item.note}
          </div>
        )}
      </>
    )
  }

  return (
    <div
      className="detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Detail laporan"
    >
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup detail"
        onClick={onClose}
      />
      <aside className="detail-drawer">
        <div className="detail-head">
          <div>
            <span className="detail-head-tag">
              {isDraftPreview ? "PRATINJAU SEMENTARA" : record.type}
            </span>
            <strong>{record.title}</strong>
            <p>
              {isUnsavedTemp ? record.period : `${record.id} · ${record.period}`}
            </p>
          </div>
          <button
            type="button"
            className="detail-close-btn"
            aria-label="Tutup"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="detail-scroll-body">
          <div className="detail-meta">
            <div>
              <span>Status</span>
              <b className={`status-chip ${record.status.toLowerCase()}`}>
                {isUnsavedTemp ? "Belum Disimpan" : record.status}
              </b>
            </div>
            <div>
              {isDraftPreview ? (
                <>
                  <span>Kelengkapan</span>
                  <strong>{record.progress}%</strong>
                </>
              ) : (
                <>
                  <span>Tanggal Kirim</span>
                  <strong>{record.sentAt}</strong>
                </>
              )}
            </div>
            <div>
              <span>Unit / Bagian</span>
              <strong>{record.unit}</strong>
            </div>
          </div>

          <AnnualSourceSummary record={record} />
          {record.status === "Revisi" && (
            <div className="revision-alert">
              <span>!</span>
              <div>
                <strong>
                  {isAdmin
                    ? "Dokumen dikembalikan untuk revisi"
                    : "Dokumen perlu diperbaiki"}
                </strong>
                <p>
                  {isAdmin
                    ? "Menunggu unit pengirim memperbaiki indikator yang ditandai dan mengirim ulang dokumen."
                    : "Perbaiki indikator yang ditandai berdasarkan catatan verifikator, lalu kirim ulang."}
                </p>
              </div>
            </div>
          )}

          <div className="detail-section-title">
            <span>Rincian Tabel Dokumen</span>
            <b>
              {record.type === "Sasaran Kinerja"
                ? "6 kolom (Format Resmi Hijau)"
                : "13 kolom (Format Resmi Triwulan)"}
            </b>
          </div>

          {record.type === "Sasaran Kinerja" ? (
            (() => {
              const criteriaSlots = getSasaranKinerjaReviewCriteria(record)
              let rowCounter = 0
              return (
                <div className="detail-table-wrap target-table-wrap">
                  <table className="detail-target-table sasaran-green-table">
                    <colgroup>
                      <col style={{ width: "48px" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "center" }}>No</th>
                        <th>SASARAN STRATEGIS</th>
                        <th>PROGRAM KERJA</th>
                        <th>SASARAN KINERJA</th>
                        <th style={{ textAlign: "center" }}>
                          BULAN PELAKSANAAN PROGRAM KERJA
                        </th>
                        <th>KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteriaSlots.map((crit) =>
                        crit.stratSlots.map((strat) => {
                          const totalStratRows = strat.programSlots.reduce(
                            (acc, p) =>
                              acc + Math.max(1, p.sasaranSlots.length),
                            0,
                          )
                          return strat.programSlots.map((prog, pIdx) => {
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
                              rowCounter += 1
                              const isFirstSasOfProg = sasIdx === 0
                              const isFirstProgOfStrat =
                                pIdx === 0 && isFirstSasOfProg
                              const formattedBulan = formatBulanPelaksanaan(
                                sas.bulanMulai,
                                sas.bulanSelesai,
                              )
                              return (
                                <tr key={`${prog.id}-${sas.id}`}>
                                  <td
                                    style={{
                                      textAlign: "center",
                                      verticalAlign: "top",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {rowCounter}
                                  </td>
                                  {isFirstProgOfStrat && (
                                    <td
                                      rowSpan={totalStratRows}
                                      style={{ verticalAlign: "top" }}
                                    >
                                      {renderEditableCell(
                                        strat.stratItemIdx,
                                        strat.name || crit.name || "-",
                                        `Revisi Sasaran Strategis #${rowCounter}`,
                                        { isStrategicGoal: true },
                                      )}
                                    </td>
                                  )}
                                  {isFirstSasOfProg && (
                                    <td
                                      rowSpan={progRows}
                                      style={{ verticalAlign: "top" }}
                                    >
                                      {renderEditableCell(
                                        prog.progItemIdx,
                                        prog.name || "-",
                                        `Revisi Program Kerja #${rowCounter}`,
                                      )}
                                    </td>
                                  )}
                                  <td style={{ verticalAlign: "top" }}>
                                    {renderEditableCell(
                                      sas.sasaranItemIdx,
                                      sas.sasaran || "-",
                                      `Revisi Sasaran Kinerja #${rowCounter}`,
                                    )}
                                  </td>
                                  <td style={{ verticalAlign: "top" }}>
                                    {renderEditableCell(
                                      sas.bulanItemIdx,
                                      formattedBulan,
                                      `Revisi Bulan Pelaksanaan #${rowCounter}`,
                                    )}
                                  </td>
                                  <td style={{ verticalAlign: "top" }}>
                                    {renderEditableCell(
                                      sas.keteranganItemIdx,
                                      sas.keterangan || "-",
                                      `Revisi Keterangan #${rowCounter}`,
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          })
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })()
          ) : (
            (() => {
              const triwulanPrograms = getTriwulanData(record)
              let rowCounter = 0
              return (
                <div
                  className="detail-table-wrap target-table-wrap"
                  style={{ overflowX: "auto" }}
                >
                  <table className="detail-triwulan-table triwulan-grid-table">
                    <thead>
                      <tr>
                        <th className="th-blue sticky-no" style={{ width: "44px", textAlign: "center" }}>
                          No
                        </th>
                        <th className="th-blue">Sasaran Strategis</th>
                        <th className="th-blue sticky-program">
                          Program Kerja {docYear}
                        </th>
                        <th className="th-blue">Sasaran</th>
                        <th className="th-blue" style={{ textAlign: "center" }}>
                          BULAN PELAKSANAAN PROGRAM KERJA
                        </th>
                        <th className="th-blue">Tahap Pelaksanaan (Uraian)</th>
                        <th className="th-blue">Realisasi Pelaksanaan (Uraian)</th>
                        <th className="th-blue" style={{ textAlign: "center" }}>
                          Realisasi Pelaksanaan (%)
                        </th>
                        <th className="th-pink">
                          Kendala (diisi jika program kerja belum terlaksana)
                        </th>
                        <th className="th-pink">
                          Rencana Penyelesaian Kendala (diisi jika pencapaian
                          program kerja tidak sesuai dengan rencana)
                        </th>
                        <th className="th-pink">
                          Waktu Penyelesaian kendala (diisi jika pencapaian
                          program kerja tidak sesuai dengan rencana)
                        </th>
                        <th className="th-green">KETERANGAN</th>
                        <th className="th-yellow">Link Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {triwulanPrograms.map((prog, pIdx) => {
                        const totalSasRows = Math.max(
                          1,
                          prog.sasaranList.length,
                        )
                        return prog.sasaranList.map((sas, sIdx) => {
                          rowCounter += 1
                          const isFirstSas = sIdx === 0
                          const stride = sas.stride ?? 12
                          const baseIdx =
                            sas.baseIdx ?? (rowCounter - 1) * stride
                          const goalOff = stride === 12 ? 0 : -1
                          const progOff = stride === 12 ? 1 : 0
                          const sasOff = stride === 12 ? 2 : 1
                          const monthOff = stride === 12 ? 3 : 2
                          const stageOff = stride === 12 ? 4 : 3
                          const realOff = stride === 12 ? 5 : 4
                          const pctOff = stride === 12 ? 6 : 5
                          const obsOff = stride === 12 ? 7 : 6
                          const solOff = stride === 12 ? 8 : 7
                          const solTimeOff = stride === 12 ? 9 : 8
                          const noteOff = stride === 12 ? 10 : 9
                          const evOff = stride === 12 ? 11 : 10

                          return (
                            <tr key={`${prog.id}-${sas.id || sIdx}`}>
                              <td
                                className="sticky-no"
                                style={{
                                  textAlign: "center",
                                  verticalAlign: "top",
                                  fontWeight: 700,
                                }}
                              >
                                {rowCounter}
                              </td>
                              {isFirstSas && (
                                <>
                                  <td
                                    rowSpan={totalSasRows}
                                    style={{ verticalAlign: "top" }}
                                  >
                                    {renderEditableCell(
                                      goalOff >= 0 ? baseIdx + goalOff : -1,
                                      prog.strategicGoal,
                                      `Revisi Sasaran Strategis #${pIdx + 1}`,
                                      { isStrategicGoal: true },
                                    )}
                                  </td>
                                  <td
                                    rowSpan={totalSasRows}
                                    className="sticky-program"
                                    style={{ verticalAlign: "top" }}
                                  >
                                    {renderEditableCell(
                                      baseIdx + progOff,
                                      prog.program,
                                      `Revisi Program Kerja #${pIdx + 1}`,
                                    )}
                                  </td>
                                </>
                              )}
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + sasOff,
                                  sas.target,
                                  `Revisi Sasaran #${rowCounter}`,
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + monthOff,
                                  sas.month,
                                  `Revisi Bulan Pelaksanaan #${rowCounter}`,
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + stageOff,
                                  sas.stage,
                                  `Revisi Tahap Pelaksanaan #${rowCounter}`,
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + realOff,
                                  sas.realization,
                                  `Revisi Realisasi Pelaksanaan #${rowCounter}`,
                                )}
                              </td>
                              <td
                                style={{
                                  verticalAlign: "top",
                                  fontWeight: 700,
                                }}
                              >
                                {renderEditableCell(
                                  baseIdx + pctOff,
                                  sas.percentage,
                                  `Revisi Realisasi Persen #${rowCounter}`,
                                  { centerText: true },
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + obsOff,
                                  sas.obstacle,
                                  `Revisi Kendala #${rowCounter}`,
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + solOff,
                                  sas.solution,
                                  `Revisi Rencana Penyelesaian #${rowCounter}`,
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {renderEditableCell(
                                  baseIdx + solTimeOff,
                                  sas.solutionTime,
                                  `Revisi Waktu Penyelesaian #${rowCounter}`,
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {sas.lateStatus &&
                                  sas.lateStatus !== "Tepat Waktu" && (
                                    <span
                                      className={
                                        sas.lateStatus === "Terlambat"
                                          ? "late-badge is-overdue"
                                          : "late-badge is-late-done"
                                      }
                                    >
                                      {sas.lateStatus}
                                    </span>
                                  )}
                                {renderEditableCell(
                                  baseIdx + noteOff,
                                  sas.notes,
                                  `Revisi Keterangan #${rowCounter}`,
                                )}
                              </td>
                              <td
                                style={{
                                  verticalAlign: "top",
                                  wordBreak: "break-all",
                                }}
                              >
                                {renderEditableCell(
                                  baseIdx + evOff,
                                  sas.evidence,
                                  `Revisi Link Evidence #${rowCounter}`,
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
            })()
          )}
        </div>

        {editing && revisionLocked && (
          <div
            className="period-lock-banner"
            role="status"
            style={{ margin: "0 20px 10px" }}
          >
            <Icon name="clock" size={18} />
            <div>
              <strong>Pengiriman Ulang Revisi Terkunci</strong>
              <span>{revisionLockReason}</span>
            </div>
          </div>
        )}

        <div
          className={`detail-actions${editing ? " is-editing" : isAdmin ? " is-admin" : ""}`}
        >
          {editing ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={onCancelEditing}
              >
                Batal
              </button>
              <div className="detail-actions-right">
                <button
                  type="button"
                  className="primary-button"
                  disabled={revisionLocked}
                  title={revisionLocked ? revisionLockReason : undefined}
                  onClick={onSaveRevision}
                >
                  Kirim Perbaikan <Icon name="arrow" size={16} />
                </button>
              </div>
            </>
          ) : isAdmin ? (
            <div className="detail-actions-right">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onPrintPreview(record)}
              >
                <Icon name="report" size={16} /> Cetak
              </button>
              {onOpenReview && canReview && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onOpenReview(record)}
                >
                  Periksa <Icon name="arrow" size={16} />
                </button>
              )}
            </div>
          ) : (
            <>
              {isDraftPreview ? (
                <div className="detail-last-modified">
                  <span>Terakhir diubah:</span>
                  {updatedAtLabel ? (
                    <time dateTime={record.updatedAt}>{updatedAtLabel}</time>
                  ) : (
                    <strong>Belum ada perubahan</strong>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onClose}
                >
                  Tutup
                </button>
              )}
              <div className="detail-actions-right">
                {!isDraftPreview && onExportExcel && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onExportExcel(record)}
                  >
                    Cetak Excel
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onPrintPreview(record)}
                >
                  {record.type === "Sasaran Kinerja"
                    ? "Cetak Sasaran Kinerja (PDF)"
                    : "Cetak Laporan Realisasi (PDF)"}{" "}
                  <Icon name="report" size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
export default DetailModal
