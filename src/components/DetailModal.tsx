import { Fragment } from "react"
import { AnnualSourceSummary } from "./AnnualSourceSummary"
import { formatUpdatedAtLabel } from "../utils/drafts"
import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"
import type { HistoryRecord } from "../types"
import { formatBulanPelaksanaan, getTriwulanData } from "../utils/format"

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
  useDialog(!!record, onClose, ".detail-overlay")
  if (!record) return null
  const canEdit = editing && !revisionLocked
  const isUnsavedTemp = isDraftPreview && record.id === "PRATINJAU-SEMENTARA"
  const updatedAtLabel = formatUpdatedAtLabel(record.updatedAt)

  return (
    <div
      className="detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Detail laporan"
    >
      <button
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
                ? "7 kolom (Format Dokumen Resmi)"
                : "12 kolom (Format Dokumen Resmi)"}
            </b>
          </div>

          {record.type === "Sasaran Kinerja" &&
          canEdit &&
          (!record.criteriaData || record.criteriaData.length === 0) &&
          record.items.length > 6 ? (
            <div className="admin-page">
              {record.items.map((item, index) => (
                <label className="admin-indicator" key={index}>
                  {index + 1}. {item.label}
                  {item.note && <strong>Catatan: {item.note}</strong>}
                  <textarea
                    id={`detail-item-${index}`}
                    name={`detailItem[${index}]`}
                    aria-label={`${item.label} ${index + 1}`}
                    value={edits[index] ?? item.value}
                    onChange={(e) => onUpdateEdit(index, e.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : record.type === "Sasaran Kinerja" ? (
            (() => {
              const kriteriaIdx = record.items.findIndex(
                (item) => item.label === "Kriteria",
              )
              const kriteriaItem =
                kriteriaIdx >= 0 ? record.items[kriteriaIdx] : null
              const kriteriaVal =
                kriteriaIdx >= 0
                  ? (edits[kriteriaIdx] ?? kriteriaItem?.value ?? "-")
                  : "-"

              const strategiIdx = record.items.findIndex(
                (item) => item.label === "Strategi",
              )
              const strategiItem =
                strategiIdx >= 0 ? record.items[strategiIdx] : null

              const programIdx = record.items.findIndex(
                (item) => item.label === "Program Kerja",
              )
              const programItem =
                programIdx >= 0 ? record.items[programIdx] : null

              const sasaranIdx = record.items.findIndex(
                (item) => item.label === "Sasaran",
              )
              const sasaranItem =
                sasaranIdx >= 0 ? record.items[sasaranIdx] : null

              const bulanIdx = record.items.findIndex((item) =>
                item.label.includes("Bulan"),
              )
              const bulanItem = bulanIdx >= 0 ? record.items[bulanIdx] : null

              const keteranganIdx = record.items.findIndex(
                (item) => item.label === "Keterangan",
              )
              const keteranganItem =
                keteranganIdx >= 0 ? record.items[keteranganIdx] : null

              let cursor = 0
              const criteriaSlots = (record.criteriaData ?? []).map((crit) => {
                const critItemIdx = cursor++
                const strats =
                  crit.strategies && crit.strategies.length > 0
                    ? crit.strategies
                    : crit.strategy
                      ? [crit.strategy]
                      : []
                const stratSlots = strats.map((strat) => {
                  const stratItemIdx = cursor++
                  const programSlots = strat.programs.map((prog) => {
                    const progItemIdx = cursor++
                    const sList =
                      prog.sasaranList && prog.sasaranList.length > 0
                        ? prog.sasaranList
                        : prog.targets.map((t) => ({
                            id: t.id,
                            sasaran: t.sasaran ?? t.target ?? "",
                            bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                            bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                            keterangan: t.keterangan ?? t.notes ?? "",
                          }))
                    const sasaranSlots = sList.map((sas) => ({
                      sas,
                      sasaranItemIdx: cursor++,
                      bulanItemIdx: cursor++,
                      keteranganItemIdx: cursor++,
                    }))
                    return { prog, progItemIdx, sasaranSlots }
                  })
                  return { strat, stratItemIdx, programSlots }
                })
                return { crit, critItemIdx, stratSlots }
              })
              const hasAlignedItems =
                record.items.length > 0 && cursor === record.items.length
              const slotItem = (idx: number) =>
                hasAlignedItems && idx >= 0 ? record.items[idx] : null
              const slotEdit = (idx: number) =>
                hasAlignedItems && idx >= 0 ? edits[idx] : undefined

              return (
                <div className="detail-table-wrap target-table-wrap">
                  <table className="detail-target-table">
                    <colgroup>
                      <col style={{ width: "48px" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "48px" }} />
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "23%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "13%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th
                          style={{
                            width: "48px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          NO
                        </th>
                        <th style={{ width: "22%" }}>STRATEGI</th>
                        <th
                          colSpan={2}
                          style={{
                            textAlign: "center",
                            width: "calc(48px + 25%)",
                          }}
                        >
                          PROGRAM KERJA
                        </th>
                        <th style={{ width: "23%" }}>SASARAN</th>
                        <th style={{ width: "13%", textAlign: "center" }}>
                          BULAN PELAKSANAAN PROGRAM KERJA
                        </th>
                        <th style={{ width: "13%" }}>KETERANGAN</th>
                      </tr>
                      <tr className="subhead-number-row">
                        <th
                          style={{
                            width: "48px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          1
                        </th>
                        <th style={{ textAlign: "center" }}>2</th>
                        <th
                          style={{
                            width: "48px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          3
                        </th>
                        <th style={{ textAlign: "center" }}>4</th>
                        <th style={{ textAlign: "center" }}>5</th>
                        <th style={{ textAlign: "center" }}>6</th>
                        <th style={{ textAlign: "center" }}>7</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.criteriaData && record.criteriaData.length > 0 ? (
                        criteriaSlots.map(
                          ({ crit, critItemIdx, stratSlots }, cIdx) => {
                            const critItem = slotItem(critItemIdx)
                            return (
                              <Fragment key={crit.id}>
                                <tr className="criteria-section-row">
                                  <td
                                    className="criteria-num-cell"
                                    style={{
                                      textAlign: "center",
                                      fontWeight: "bold",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {cIdx + 1}
                                  </td>
                                  <td
                                    className="criteria-title-cell"
                                    colSpan={6}
                                    style={{ fontWeight: "bold" }}
                                  >
                                    {canEdit && critItem?.needsRevision ? (
                                      <textarea
                                        id={`detail-sas-${critItemIdx}`}
                                        name={`detailEdit[${critItemIdx}]`}
                                        aria-label={`Revisi Kriteria ${cIdx + 1}`}
                                        value={
                                          slotEdit(critItemIdx) ??
                                          critItem.value ??
                                          crit.name
                                        }
                                        onChange={(e) =>
                                          onUpdateEdit(
                                            critItemIdx,
                                            e.target.value,
                                          )
                                        }
                                      />
                                    ) : (
                                      <p>
                                        {slotEdit(critItemIdx) ??
                                          critItem?.value ??
                                          crit.name}
                                      </p>
                                    )}
                                    {critItem?.note && (
                                      <div className="cell-note">
                                        <strong>Catatan:</strong>
                                        {critItem.note}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {stratSlots.map(
                                  ({ strat, stratItemIdx, programSlots }, sIdx) => {
                                    const stratNum = `${cIdx + 1}.${sIdx + 1}`
                                    const stratItem = slotItem(stratItemIdx)
                                    const totalStratRows = programSlots.reduce(
                                      (acc, p) =>
                                        acc + Math.max(1, p.sasaranSlots.length),
                                      0,
                                    )

                                    return programSlots.map(
                                      (
                                        { prog, progItemIdx, sasaranSlots },
                                        pIdx,
                                      ) => {
                                        const progNum = `${stratNum}.${pIdx + 1}`
                                        const progItem = slotItem(progItemIdx)
                                        const progRows = Math.max(
                                          1,
                                          sasaranSlots.length,
                                        )

                                        return sasaranSlots.map(
                                          (
                                            {
                                              sas,
                                              sasaranItemIdx,
                                              bulanItemIdx,
                                              keteranganItemIdx,
                                            },
                                            sasIdx,
                                          ) => {
                                            const isFirstSasOfProg =
                                              sasIdx === 0
                                            const isFirstProgOfStrat =
                                              pIdx === 0 && isFirstSasOfProg
                                            const sasItem =
                                              slotItem(sasaranItemIdx)
                                            const bulanItemSlot =
                                              slotItem(bulanItemIdx)
                                            const ketItem =
                                              slotItem(keteranganItemIdx)

                                            return (
                                              <tr key={`${prog.id}-${sas.id}`}>
                                                {isFirstProgOfStrat && (
                                                  <>
                                                    <td
                                                      rowSpan={totalStratRows}
                                                      style={{
                                                        width: "48px",
                                                        textAlign: "center",
                                                        verticalAlign: "top",
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                      }}
                                                    >
                                                      {stratNum}
                                                    </td>
                                                    <td
                                                      rowSpan={totalStratRows}
                                                      style={{
                                                        verticalAlign: "top",
                                                      }}
                                                    >
                                                      {canEdit &&
                                                      stratItem?.needsRevision ? (
                                                        <textarea
                                                          id={`detail-sas-${stratItemIdx}`}
                                                          name={`detailEdit[${stratItemIdx}]`}
                                                          aria-label={`Revisi Strategi ${stratNum}`}
                                                          value={
                                                            slotEdit(
                                                              stratItemIdx,
                                                            ) ??
                                                            stratItem.value ??
                                                            ""
                                                          }
                                                          onChange={(e) =>
                                                            onUpdateEdit(
                                                              stratItemIdx,
                                                              e.target.value,
                                                            )
                                                          }
                                                        />
                                                      ) : (
                                                        <p>
                                                          {slotEdit(
                                                            stratItemIdx,
                                                          ) ??
                                                            stratItem?.value ??
                                                            strat.name ??
                                                            "-"}
                                                        </p>
                                                      )}
                                                      {stratItem?.note && (
                                                        <div className="cell-note">
                                                          <strong>
                                                            Catatan:
                                                          </strong>
                                                          {stratItem.note}
                                                        </div>
                                                      )}
                                                    </td>
                                                  </>
                                                )}
                                                {isFirstSasOfProg && (
                                                  <>
                                                    <td
                                                      rowSpan={progRows}
                                                      style={{
                                                        width: "48px",
                                                        textAlign: "center",
                                                        verticalAlign: "top",
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                      }}
                                                    >
                                                      {progNum}
                                                    </td>
                                                    <td
                                                      rowSpan={progRows}
                                                      style={{
                                                        verticalAlign: "top",
                                                      }}
                                                    >
                                                      {canEdit &&
                                                      progItem?.needsRevision ? (
                                                        <textarea
                                                          id={`detail-sas-${progItemIdx}`}
                                                          name={`detailEdit[${progItemIdx}]`}
                                                          aria-label={`Revisi Program Kerja ${progNum}`}
                                                          value={
                                                            slotEdit(
                                                              progItemIdx,
                                                            ) ??
                                                            progItem.value ??
                                                            ""
                                                          }
                                                          onChange={(e) =>
                                                            onUpdateEdit(
                                                              progItemIdx,
                                                              e.target.value,
                                                            )
                                                          }
                                                        />
                                                      ) : (
                                                        <p>
                                                          {slotEdit(
                                                            progItemIdx,
                                                          ) ??
                                                            progItem?.value ??
                                                            prog.name ??
                                                            "-"}
                                                        </p>
                                                      )}
                                                      {progItem?.note && (
                                                        <div className="cell-note">
                                                          <strong>
                                                            Catatan:
                                                          </strong>
                                                          {progItem.note}
                                                        </div>
                                                      )}
                                                    </td>
                                                  </>
                                                )}
                                                <td
                                                  style={{
                                                    verticalAlign: "top",
                                                  }}
                                                >
                                                  {canEdit &&
                                                  sasItem?.needsRevision ? (
                                                    <textarea
                                                      id={`detail-sas-${sasaranItemIdx}`}
                                                      name={`detailEdit[${sasaranItemIdx}]`}
                                                      aria-label={`Revisi Sasaran ${progNum}.${sasIdx + 1}`}
                                                      value={
                                                        slotEdit(
                                                          sasaranItemIdx,
                                                        ) ??
                                                        sasItem.value ??
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        onUpdateEdit(
                                                          sasaranItemIdx,
                                                          e.target.value,
                                                        )
                                                      }
                                                    />
                                                  ) : (
                                                    <p>
                                                      {slotEdit(
                                                        sasaranItemIdx,
                                                      ) ??
                                                        sasItem?.value ??
                                                        (sas.sasaran || "-")}
                                                    </p>
                                                  )}
                                                  {sasItem?.note && (
                                                    <div className="cell-note">
                                                      <strong>Catatan:</strong>
                                                      {sasItem.note}
                                                    </div>
                                                  )}
                                                </td>
                                                <td
                                                  style={{
                                                    verticalAlign: "top",
                                                  }}
                                                >
                                                  {canEdit &&
                                                  bulanItemSlot?.needsRevision ? (
                                                    <textarea
                                                      id={`detail-sas-${bulanItemIdx}`}
                                                      name={`detailEdit[${bulanItemIdx}]`}
                                                      aria-label={`Revisi Bulan Pelaksanaan ${progNum}.${sasIdx + 1}`}
                                                      value={
                                                        slotEdit(
                                                          bulanItemIdx,
                                                        ) ??
                                                        bulanItemSlot.value ??
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        onUpdateEdit(
                                                          bulanItemIdx,
                                                          e.target.value,
                                                        )
                                                      }
                                                    />
                                                  ) : (
                                                    <p>
                                                      {slotEdit(bulanItemIdx) ??
                                                        bulanItemSlot?.value ??
                                                        formatBulanPelaksanaan(
                                                          sas.bulan_mulai,
                                                          sas.bulan_selesai,
                                                        )}
                                                    </p>
                                                  )}
                                                  {bulanItemSlot?.note && (
                                                    <div className="cell-note">
                                                      <strong>Catatan:</strong>
                                                      {bulanItemSlot.note}
                                                    </div>
                                                  )}
                                                </td>
                                                <td
                                                  style={{
                                                    verticalAlign: "top",
                                                  }}
                                                >
                                                  {canEdit &&
                                                  ketItem?.needsRevision ? (
                                                    <textarea
                                                      id={`detail-sas-${keteranganItemIdx}`}
                                                      name={`detailEdit[${keteranganItemIdx}]`}
                                                      aria-label={`Revisi Keterangan ${progNum}.${sasIdx + 1}`}
                                                      value={
                                                        slotEdit(
                                                          keteranganItemIdx,
                                                        ) ??
                                                        ketItem.value ??
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        onUpdateEdit(
                                                          keteranganItemIdx,
                                                          e.target.value,
                                                        )
                                                      }
                                                    />
                                                  ) : (
                                                    <p>
                                                      {slotEdit(
                                                        keteranganItemIdx,
                                                      ) ??
                                                        ketItem?.value ??
                                                        (sas.keterangan || "-")}
                                                    </p>
                                                  )}
                                                  {ketItem?.note && (
                                                    <div className="cell-note">
                                                      <strong>Catatan:</strong>
                                                      {ketItem.note}
                                                    </div>
                                                  )}
                                                </td>
                                              </tr>
                                            )
                                          },
                                        )
                                      },
                                    )
                                  },
                                )}
                              </Fragment>
                            )
                          },
                        )
                      ) : (
                        <>
                          <tr className="criteria-section-row">
                            <td
                              className="criteria-num-cell"
                              style={{
                                textAlign: "center",
                                fontWeight: "bold",
                                whiteSpace: "nowrap",
                              }}
                            >
                              1
                            </td>
                            <td
                              className="criteria-title-cell"
                              colSpan={6}
                              style={{ fontWeight: "bold" }}
                            >
                              {canEdit && kriteriaItem?.needsRevision ? (
                                <textarea
                                  id={`detail-kriteria-${kriteriaIdx}`}
                                  name={`detailEdit[${kriteriaIdx}]`}
                                  aria-label="Revisi Kriteria"
                                  value={edits[kriteriaIdx] ?? ""}
                                  onChange={(e) =>
                                    onUpdateEdit(kriteriaIdx, e.target.value)
                                  }
                                />
                              ) : (
                                kriteriaVal
                              )}
                              {kriteriaItem?.note && (
                                <div className="cell-note">
                                  <strong>Catatan:</strong>
                                  {kriteriaItem.note}
                                </div>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td
                              style={{
                                width: "48px",
                                textAlign: "center",
                                verticalAlign: "top",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              1.1
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {canEdit && strategiItem?.needsRevision ? (
                                <textarea
                                  id={`detail-strategi-${strategiIdx}`}
                                  name={`detailEdit[${strategiIdx}]`}
                                  aria-label="Revisi Strategi"
                                  value={edits[strategiIdx] ?? ""}
                                  onChange={(e) =>
                                    onUpdateEdit(strategiIdx, e.target.value)
                                  }
                                />
                              ) : (
                                <p>
                                  {strategiIdx >= 0
                                    ? (edits[strategiIdx] ??
                                      strategiItem?.value ??
                                      "-")
                                    : "-"}
                                </p>
                              )}
                              {strategiItem?.note && (
                                <div className="cell-note">
                                  <strong>Catatan:</strong>
                                  {strategiItem.note}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                width: "48px",
                                textAlign: "center",
                                verticalAlign: "top",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              1.1.1
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {canEdit && programItem?.needsRevision ? (
                                <textarea
                                  id={`detail-program-${programIdx}`}
                                  name={`detailEdit[${programIdx}]`}
                                  aria-label="Revisi Program Kerja"
                                  value={edits[programIdx] ?? ""}
                                  onChange={(e) =>
                                    onUpdateEdit(programIdx, e.target.value)
                                  }
                                />
                              ) : (
                                <p>
                                  {programIdx >= 0
                                    ? (edits[programIdx] ??
                                      programItem?.value ??
                                      "-")
                                    : "-"}
                                </p>
                              )}
                              {programItem?.note && (
                                <div className="cell-note">
                                  <strong>Catatan:</strong>
                                  {programItem.note}
                                </div>
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {canEdit && sasaranItem?.needsRevision ? (
                                <textarea
                                  id={`detail-sasaran-${sasaranIdx}`}
                                  name={`detailEdit[${sasaranIdx}]`}
                                  aria-label="Revisi Sasaran"
                                  value={edits[sasaranIdx] ?? ""}
                                  onChange={(e) =>
                                    onUpdateEdit(sasaranIdx, e.target.value)
                                  }
                                />
                              ) : (
                                <p>
                                  {sasaranIdx >= 0
                                    ? (edits[sasaranIdx] ??
                                      sasaranItem?.value ??
                                      "-")
                                    : "-"}
                                </p>
                              )}
                              {sasaranItem?.note && (
                                <div className="cell-note">
                                  <strong>Catatan:</strong>
                                  {sasaranItem.note}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                verticalAlign: "top",
                              }}
                            >
                              {canEdit && bulanItem?.needsRevision ? (
                                <textarea
                                  id={`detail-bulan-${bulanIdx}`}
                                  name={`detailEdit[${bulanIdx}]`}
                                  aria-label="Revisi Bulan Pelaksanaan"
                                  value={edits[bulanIdx] ?? ""}
                                  onChange={(e) =>
                                    onUpdateEdit(bulanIdx, e.target.value)
                                  }
                                />
                              ) : (
                                <p>
                                  {bulanIdx >= 0
                                    ? (edits[bulanIdx] ??
                                      bulanItem?.value ??
                                      "-")
                                    : "-"}
                                </p>
                              )}
                              {bulanItem?.note && (
                                <div className="cell-note">
                                  <strong>Catatan:</strong>
                                  {bulanItem.note}
                                </div>
                              )}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              {canEdit && keteranganItem?.needsRevision ? (
                                <textarea
                                  id={`detail-keterangan-${keteranganIdx}`}
                                  name={`detailEdit[${keteranganIdx}]`}
                                  aria-label="Revisi Keterangan"
                                  value={edits[keteranganIdx] ?? ""}
                                  onChange={(e) =>
                                    onUpdateEdit(keteranganIdx, e.target.value)
                                  }
                                />
                              ) : (
                                <p>
                                  {keteranganIdx >= 0
                                    ? (edits[keteranganIdx] ??
                                      keteranganItem?.value ??
                                      "-")
                                    : "-"}
                                </p>
                              )}
                              {keteranganItem?.note && (
                                <div className="cell-note">
                                  <strong>Catatan:</strong>
                                  {keteranganItem.note}
                                </div>
                              )}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })()
          ) : (
            (() => {
              const triwulanPrograms = getTriwulanData(record)
              return (
                <div
                  className="detail-table-wrap target-table-wrap"
                  style={{ overflowX: "auto" }}
                >
                  <table className="detail-triwulan-table">
                    <colgroup>
                      <col style={{ width: "44px" }} />
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
                            width: "44px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          NO
                        </th>
                        <th
                          className="sticky-program"
                          style={{ width: "13%" }}
                        >
                          PROGRAM KERJA
                        </th>
                        <th style={{ width: "13%" }}>SASARAN</th>
                        <th style={{ width: "9%", textAlign: "center" }}>
                          BULAN PELAKSANAAN PROGRAM KERJA
                        </th>
                        <th style={{ width: "10%" }}>
                          TAHAP PELAKSANAAN (URAIAN)
                        </th>
                        <th style={{ width: "10%" }}>
                          REALISASI PELAKSANAAN (URAIAN)
                        </th>
                        <th style={{ width: "6%", textAlign: "center" }}>
                          REALISASI PELAKSANAAN (%)
                        </th>
                        <th style={{ width: "9%" }}>KENDALA</th>
                        <th style={{ width: "9%" }}>
                          RENCANA PENYELESAIAN KENDALA
                        </th>
                        <th style={{ width: "8%" }}>
                          WAKTU PENYELESAIAN KENDALA
                        </th>
                        <th style={{ width: "8%" }}>KETERANGAN</th>
                        <th style={{ width: "9%" }}>LINK EVIDENCE</th>
                      </tr>
                      <tr className="subhead-number-row">
                        <th
                          className="sticky-no"
                          style={{
                            width: "44px",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
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
                        return prog.sasaranList.map((sas, sIdx) => {
                          const isFirstSas = sIdx === 0
                          const baseIdx = sas.baseIdx ?? pIdx * 11 + sIdx * 11
                          const itemAt = (offset: number) =>
                            record.items[baseIdx + offset]
                          const editAt = (offset: number) =>
                            edits[baseIdx + offset]

                          return (
                            <tr key={`${prog.id}-${sas.id || sIdx}`}>
                              {isFirstSas && (
                                <>
                                  <td
                                    rowSpan={totalSasRows}
                                    className="sticky-no"
                                    style={{
                                      width: "44px",
                                      textAlign: "center",
                                      verticalAlign: "top",
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {pIdx + 1}
                                  </td>
                                  <td
                                    rowSpan={totalSasRows}
                                    className="sticky-program"
                                    style={{ verticalAlign: "top" }}
                                  >
                                    {canEdit && itemAt(0)?.needsRevision ? (
                                      <textarea
                                        id={`detail-tw-${pIdx}-${sIdx}-0`}
                                        name={`detailEdit[${baseIdx}]`}
                                        aria-label={`Revisi Program Kerja #${pIdx + 1}`}
                                        value={editAt(0) ?? ""}
                                        onChange={(e) =>
                                          onUpdateEdit(baseIdx, e.target.value)
                                        }
                                      />
                                    ) : (
                                      <p>{editAt(0) ?? prog.program}</p>
                                    )}
                                    {itemAt(0)?.note && (
                                      <div className="cell-note">
                                        <strong>Catatan:</strong>
                                        {itemAt(0).note}
                                      </div>
                                    )}
                                  </td>
                                </>
                              )}
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(1)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-1`}
                                    name={`detailEdit[${baseIdx + 1}]`}
                                    aria-label={`Revisi Sasaran #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(1) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 1, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(1) ?? sas.target}</p>
                                )}
                                {itemAt(1)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(1).note}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  verticalAlign: "top",
                                }}
                              >
                                {canEdit && itemAt(2)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-2`}
                                    name={`detailEdit[${baseIdx + 2}]`}
                                    aria-label={`Revisi Bulan Pelaksanaan #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(2) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 2, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(2) ?? sas.month}</p>
                                )}
                                {itemAt(2)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(2).note}
                                  </div>
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(3)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-3`}
                                    name={`detailEdit[${baseIdx + 3}]`}
                                    aria-label={`Revisi Tahap Pelaksanaan #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(3) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 3, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(3) ?? sas.stage}</p>
                                )}
                                {itemAt(3)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(3).note}
                                  </div>
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(4)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-4`}
                                    name={`detailEdit[${baseIdx + 4}]`}
                                    aria-label={`Revisi Realisasi Pelaksanaan #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(4) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 4, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(4) ?? sas.realization}</p>
                                )}
                                {itemAt(4)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(4).note}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  verticalAlign: "top",
                                  fontWeight: 600,
                                }}
                              >
                                {canEdit && itemAt(5)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-5`}
                                    name={`detailEdit[${baseIdx + 5}]`}
                                    aria-label={`Revisi Realisasi Persen #${pIdx + 1}.${sIdx + 1}`}
                                    style={{ textAlign: "center" }}
                                    value={editAt(5) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 5, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p style={{ textAlign: "center" }}>
                                    {editAt(5) ?? sas.percentage}
                                  </p>
                                )}
                                {itemAt(5)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(5).note}
                                  </div>
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(6)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-6`}
                                    name={`detailEdit[${baseIdx + 6}]`}
                                    aria-label={`Revisi Kendala #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(6) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 6, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(6) ?? sas.obstacle}</p>
                                )}
                                {itemAt(6)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(6).note}
                                  </div>
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(7)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-7`}
                                    name={`detailEdit[${baseIdx + 7}]`}
                                    aria-label={`Revisi Rencana Penyelesaian #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(7) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 7, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(7) ?? sas.solution}</p>
                                )}
                                {itemAt(7)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(7).note}
                                  </div>
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(8)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-8`}
                                    name={`detailEdit[${baseIdx + 8}]`}
                                    aria-label={`Revisi Waktu Penyelesaian #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(8) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 8, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(8) ?? sas.solutionTime}</p>
                                )}
                                {itemAt(8)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(8).note}
                                  </div>
                                )}
                              </td>
                              <td style={{ verticalAlign: "top" }}>
                                {canEdit && itemAt(9)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-9`}
                                    name={`detailEdit[${baseIdx + 9}]`}
                                    aria-label={`Revisi Keterangan #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(9) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 9, e.target.value)
                                    }
                                  />
                                ) : (
                                  <p>{editAt(9) ?? sas.notes}</p>
                                )}
                                {itemAt(9)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(9).note}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  verticalAlign: "top",
                                  wordBreak: "break-all",
                                }}
                              >
                                {canEdit && itemAt(10)?.needsRevision ? (
                                  <textarea
                                    id={`detail-tw-${pIdx}-${sIdx}-10`}
                                    name={`detailEdit[${baseIdx + 10}]`}
                                    aria-label={`Revisi Link Evidence #${pIdx + 1}.${sIdx + 1}`}
                                    value={editAt(10) ?? ""}
                                    onChange={(e) =>
                                      onUpdateEdit(baseIdx + 10, e.target.value)
                                    }
                                  />
                                ) : sas.evidence &&
                                  sas.evidence.startsWith("http") ? (
                                  <a
                                    href={sas.evidence}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: "#2563eb",
                                      textDecoration: "underline",
                                    }}
                                  >
                                    {sas.evidence}
                                  </a>
                                ) : (
                                  <p>{(editAt(10) ?? sas.evidence) || "-"}</p>
                                )}
                                {itemAt(10)?.note && (
                                  <div className="cell-note">
                                    <strong>Catatan:</strong>
                                    {itemAt(10).note}
                                  </div>
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
              <button className="secondary-button" onClick={onCancelEditing}>
                Batal
              </button>
              <div className="detail-actions-right">
                <button
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
                <button className="secondary-button" onClick={onClose}>
                  Tutup
                </button>
              )}
              <div className="detail-actions-right">
                {!isDraftPreview && onExportExcel && (
                  <button
                    className="secondary-button"
                    onClick={() => onExportExcel(record)}
                  >
                    Cetak Excel
                  </button>
                )}
                <button
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
