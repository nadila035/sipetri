import { AnnualSourceSummary } from "./AnnualSourceSummary"
import { useReporting } from "../ReportingContext"
import { formatUpdatedAtLabel } from "../utils/drafts"
import {
  computeTableMergeSpans,
  getSasaranKinerjaDisplayRows,
  getTriwulanDisplayRows,
} from "../utils/format"
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
  onCancelEditing = () => { },
  onUpdateEdit = () => { },
  onSaveRevision = () => { },
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
    itemIndexes: number | number[],
    fallbackVal: string,
    ariaLabel: string,
    options?: {
      isStrategicGoal?: boolean
      isLink?: boolean
      centerText?: boolean
      boldText?: boolean
    },
  ) => {
    const idxList = (
      Array.isArray(itemIndexes) ? itemIndexes : [itemIndexes]
    ).filter((idx) => idx >= 0)
    const primaryIdx = idxList[0] ?? -1
    const flaggedIdx =
      idxList.find((idx) => Boolean(record.items[idx]?.needsRevision)) ?? -1
    const noteItem = idxList
      .map((idx) => record.items[idx])
      .find((it) => Boolean(it?.note))

    const primaryItem = primaryIdx >= 0 ? record.items[primaryIdx] : undefined
    const val =
      (primaryIdx >= 0 ? edits[primaryIdx] : undefined) ??
      primaryItem?.value ??
      fallbackVal

    const handleMultiUpdate = (nextValue: string) => {
      const uniqueIndexes = Array.from(new Set(idxList))
      for (const idx of uniqueIndexes) {
        onUpdateEdit(idx, nextValue)
      }
    }

    if (canEdit && flaggedIdx >= 0 && primaryIdx >= 0) {
      if (options?.isStrategicGoal && strategicGoals.length > 0) {
        return (
          <>
            <select
              id={`detail-edit-${primaryIdx}`}
              name={`detailEdit[${primaryIdx}]`}
              className="detail-revision-select"
              aria-label={ariaLabel}
              value={val}
              onChange={(e) => handleMultiUpdate(e.target.value)}
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
            {noteItem?.note && (
              <div className="cell-note">
                <strong>Catatan:</strong>
                {noteItem.note}
              </div>
            )}
          </>
        )
      }
      return (
        <>
          <textarea
            id={`detail-edit-${primaryIdx}`}
            name={`detailEdit[${primaryIdx}]`}
            aria-label={ariaLabel}
            style={options?.centerText ? { textAlign: "center" } : undefined}
            value={val}
            onChange={(e) => handleMultiUpdate(e.target.value)}
          />
          {noteItem?.note && (
            <div className="cell-note">
              <strong>Catatan:</strong>
              {noteItem.note}
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
          <p
            style={{
              ...(options?.centerText ? { textAlign: "center" } : {}),
              ...(options?.boldText ? { fontWeight: 700 } : {}),
            }}
          >
            {trimmed || "-"}
          </p>
        )}
        {noteItem?.note && (
          <div className="cell-note">
            <strong>Catatan:</strong>
            {noteItem.note}
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

        <div className="detail-scroll-body" data-lenis-prevent>
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
                ? "6 kolom (Format Resmi Hijau · Merge Sel Otomatis)"
                : "13 kolom (Format Resmi Triwulan · Merge Sel Otomatis)"}
            </b>
          </div>

          {record.type === "Sasaran Kinerja" ? (
            (() => {
              const displayRows = getSasaranKinerjaDisplayRows(record)
              const spans = computeTableMergeSpans(displayRows)
              return (
                <div
                  className="detail-table-wrap target-table-wrap official-grid-scroll"
                  data-lenis-prevent
                >
                  <table className="detail-target-table sasaran-green-table">
                    <colgroup>
                      <col style={{ width: "48px" }} />
                      <col style={{ width: "23%" }} />
                      <col style={{ width: "21%" }} />
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
                      {displayRows.map((row, idx) => {
                        const span = spans[idx]
                        const coveredGoalIndexes =
                          span.goalSpan > 0
                            ? displayRows
                              .slice(idx, span.goalEndIndex + 1)
                              .map((r) => r.stratItemIdx)
                            : []
                        const coveredProgIndexes =
                          span.programSpan > 0
                            ? displayRows
                              .slice(idx, span.programEndIndex + 1)
                              .map((r) => r.progItemIdx)
                            : []

                        return (
                          <tr key={row.key}>
                            {span.noSpan > 0 && (
                              <td
                                rowSpan={span.noSpan}
                                className="is-merged-cell"
                                style={{
                                  textAlign: "center",
                                  verticalAlign: "top",
                                  fontWeight: 700,
                                }}
                              >
                                {span.groupNumber}
                              </td>
                            )}
                            {span.goalSpan > 0 && (
                              <td
                                rowSpan={span.goalSpan}
                                className="is-merged-cell"
                                style={{ verticalAlign: "top" }}
                              >
                                {renderEditableCell(
                                  coveredGoalIndexes,
                                  row.strategicGoal,
                                  `Revisi Sasaran Strategis #${row.rowNumber}`,
                                  { isStrategicGoal: true, boldText: true },
                                )}
                              </td>
                            )}
                            {span.programSpan > 0 && (
                              <td
                                rowSpan={span.programSpan}
                                className="is-merged-cell"
                                style={{ verticalAlign: "top" }}
                              >
                                {renderEditableCell(
                                  coveredProgIndexes,
                                  row.programName,
                                  `Revisi Program Kerja #${row.rowNumber}`,
                                )}
                              </td>
                            )}
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.sasaranItemIdx,
                                row.sasaran,
                                `Revisi Sasaran Kinerja #${row.rowNumber}`,
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.bulanItemIdx,
                                row.bulanFormatted,
                                `Revisi Bulan Pelaksanaan #${row.rowNumber}`,
                                { centerText: true },
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.keteranganItemIdx,
                                row.keterangan,
                                `Revisi Keterangan #${row.rowNumber}`,
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()
          ) : (
            (() => {
              const displayRows = getTriwulanDisplayRows(record)
              const spans = computeTableMergeSpans(displayRows)
              return (
                <div
                  className="detail-table-wrap target-table-wrap official-grid-scroll"
                  data-lenis-prevent
                >
                  <table className="detail-triwulan-table triwulan-grid-table">
                    <thead>
                      <tr>
                        <th
                          className="th-blue"
                          style={{ width: "44px", textAlign: "center" }}
                        >
                          No
                        </th>
                        <th className="th-blue">Sasaran Strategis</th>
                        <th className="th-blue">Program Kerja {docYear}</th>
                        <th className="th-blue">Sasaran</th>
                        <th className="th-blue" style={{ textAlign: "center" }}>
                          BULAN PELAKSANAAN PROGRAM KERJA
                        </th>
                        <th className="th-blue">Tahap Pelaksanaan (Uraian)</th>
                        <th className="th-blue">
                          Realisasi Pelaksanaan (Uraian)
                        </th>
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
                      {displayRows.map((row, idx) => {
                        const span = spans[idx]
                        const sas = row.sasaran
                        const coveredGoalIndexes =
                          span.goalSpan > 0
                            ? displayRows
                              .slice(idx, span.goalEndIndex + 1)
                              .map((r) => r.goalItemIdx)
                            : []
                        const coveredProgIndexes =
                          span.programSpan > 0
                            ? displayRows
                              .slice(idx, span.programEndIndex + 1)
                              .map((r) => r.progItemIdx)
                            : []

                        return (
                          <tr key={row.key}>
                            {span.noSpan > 0 && (
                              <td
                                rowSpan={span.noSpan}
                                className="is-merged-cell"
                                style={{
                                  textAlign: "center",
                                  verticalAlign: "top",
                                  fontWeight: 700,
                                }}
                              >
                                {span.groupNumber}
                              </td>
                            )}
                            {span.goalSpan > 0 && (
                              <td
                                rowSpan={span.goalSpan}
                                className="is-merged-cell"
                                style={{ verticalAlign: "top" }}
                              >
                                {renderEditableCell(
                                  coveredGoalIndexes,
                                  row.strategicGoal,
                                  `Revisi Sasaran Strategis #${row.rowNumber}`,
                                  { isStrategicGoal: true, boldText: true },
                                )}
                              </td>
                            )}
                            {span.programSpan > 0 && (
                              <td
                                rowSpan={span.programSpan}
                                className="is-merged-cell"
                                style={{ verticalAlign: "top" }}
                              >
                                {renderEditableCell(
                                  coveredProgIndexes,
                                  row.programName,
                                  `Revisi Program Kerja #${row.rowNumber}`,
                                )}
                              </td>
                            )}
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.sasaranItemIdx,
                                sas.target,
                                `Revisi Sasaran #${row.rowNumber}`,
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.monthItemIdx,
                                sas.month,
                                `Revisi Bulan Pelaksanaan #${row.rowNumber}`,
                                { centerText: true },
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.stageItemIdx,
                                sas.stage,
                                `Revisi Tahap Pelaksanaan #${row.rowNumber}`,
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.realizationItemIdx,
                                sas.realization,
                                `Revisi Realisasi Pelaksanaan #${row.rowNumber}`,
                              )}
                            </td>
                            <td
                              style={{
                                verticalAlign: "top",
                                fontWeight: 700,
                              }}
                            >
                              {renderEditableCell(
                                row.pctItemIdx,
                                sas.percentage,
                                `Revisi Realisasi Persen #${row.rowNumber}`,
                                { centerText: true },
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.obstacleItemIdx,
                                sas.obstacle,
                                `Revisi Kendala #${row.rowNumber}`,
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.solutionItemIdx,
                                sas.solution,
                                `Revisi Rencana Penyelesaian #${row.rowNumber}`,
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {renderEditableCell(
                                row.solutionTimeItemIdx,
                                sas.solutionTime,
                                `Revisi Waktu Penyelesaian #${row.rowNumber}`,
                                { centerText: true },
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
                                row.notesItemIdx,
                                sas.notes,
                                `Revisi Keterangan #${row.rowNumber}`,
                              )}
                            </td>
                            <td
                              style={{
                                verticalAlign: "top",
                                wordBreak: "break-all",
                              }}
                            >
                              {renderEditableCell(
                                row.evidenceItemIdx,
                                sas.evidence,
                                `Revisi Link Evidence #${row.rowNumber}`,
                                { isLink: true },
                              )}
                            </td>
                          </tr>
                        )
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
                  Kirim Perbaikan <Icon name="send" size={14} />
                </button>
              </div>
            </>
          ) : isDraftPreview ? (
            <>
              <span className="detail-draft-note">
                {updatedAtLabel ? (
                  <>
                    Terakhir diubah:{" "}
                    <time dateTime={record.updatedAt}>{updatedAtLabel}</time>
                  </>
                ) : (
                  "Pratinjau draf sementara"
                )}
              </span>
              <div className="detail-actions-right">
                {onExportExcel && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onExportExcel(record)}
                  >
                    Unduh Excel (.xlsx) <Icon name="download" size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onPrintPreview(record)}
                >
                  {record.type === "Sasaran Kinerja"
                    ? "Cetak Sasaran Kinerja (PDF)"
                    : "Cetak Laporan (PDF)"}{" "}
                  <Icon name="report" size={15} />
                </button>
              </div>
            </>
          ) : isAdmin ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Tutup
              </button>
              <div className="detail-actions-right">
                {onExportExcel && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onExportExcel(record)}
                  >
                    Unduh Excel (.xlsx) <Icon name="download" size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onPrintPreview(record)}
                >
                  Cetak PDF <Icon name="report" size={15} />
                </button>
                {record.status === "Menunggu" && onOpenReview && canReview && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onOpenReview(record)}
                  >
                    Periksa & Verifikasi <Icon name="check" size={15} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Tutup
              </button>
              <div className="detail-actions-right">
                {onExportExcel && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onExportExcel(record)}
                  >
                    Unduh Excel (.xlsx) <Icon name="download" size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onPrintPreview(record)}
                >
                  {record.type === "Sasaran Kinerja"
                    ? "Cetak Sasaran Kinerja (PDF)"
                    : "Cetak Laporan (PDF)"}{" "}
                  <Icon name="report" size={15} />
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
