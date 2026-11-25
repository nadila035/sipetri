import { Fragment } from "react"
import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"
import type { HistoryRecord } from "../types"
import { formatBulanPelaksanaan, getTriwulanData } from "../utils/format"

type PrintPreviewModalProps = {
  record: HistoryRecord | null
  onClose: () => void
  headerTitle?: string
  headerSubtitle?: string
  confirmSubmitLabel?: string
  confirmSubmitDisabled?: boolean
  confirmSubmitTitle?: string
  onConfirmSubmit?: () => void
}

export function PrintPreviewModal({
  record,
  onClose,
  headerTitle,
  headerSubtitle,
  confirmSubmitLabel,
  confirmSubmitDisabled = false,
  confirmSubmitTitle,
  onConfirmSubmit,
}: PrintPreviewModalProps) {
  useDialog(!!record, onClose, ".print-preview")
  if (!record) return null

  return (
    <div
      className="print-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Pratinjau cetak laporan"
    >
      <div className="print-preview-bar">
        <div>
          <strong>{headerTitle ?? "Pratinjau Cetak"}</strong>
          <span>{headerSubtitle ?? "Dokumen A4 · Landscape"}</span>
        </div>
        <div>
          <button type="button" onClick={onClose}>
            Tutup
          </button>
          <button
            type="button"
            className={onConfirmSubmit ? undefined : "print-now"}
            onClick={() => window.print()}
          >
            <Icon name="report" size={16} /> Cetak / Simpan PDF
          </button>
          {onConfirmSubmit && (
            <button
              type="button"
              className="print-now"
              disabled={confirmSubmitDisabled}
              title={confirmSubmitTitle}
              onClick={onConfirmSubmit}
            >
              {confirmSubmitLabel ?? "Kirim Laporan"}{" "}
              <Icon name="arrow" size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="print-canvas">
        <article className="print-sheet">
          <header className="letterhead">
            <div
              className="itpln-logo"
              aria-label="Logo Institut Teknologi PLN"
            >
              <img
                src="/logo-itpln.png"
                alt="Logo ITPLN"
                style={{ width: "80px", height: "auto" }}
              />
            </div>
            <div className="letterhead-copy">
              <h1>Institut Teknologi Perusahaan Listrik Negara</h1>
              <p>Menara PLN Jalan Lingkar Luar Barat Duri Kosambi Cengkareng</p>
              <p>
                Website : www.itpln.ac.id/ e-Mail : rektorat@itpln.ac.id/
                Telepon : 0215440342
              </p>
            </div>
            <div className="letterhead-spacer" />
          </header>
          <div className="letterhead-rule" />

          <section className="print-metadata">
            {record.type === "Sasaran Kinerja" ? (
              <>
                <div>
                  <p>
                    <b>NAMA UNIT / FAKULTAS</b>
                    <span>:</span>
                    <strong>{record.unit}</strong>
                  </p>
                </div>
                <div>
                  <p>
                    <b>PERIODE / TAHUN SASARAN KINERJA</b>
                    <span>:</span>
                    <strong>{record.period}</strong>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p>
                    <b>NAMA UNIT / FAKULTAS</b>
                    <span>:</span>
                    <strong>{record.unit}</strong>
                  </p>
                  <p>
                    <b>PENANGGUNG JAWAB</b>
                    <span>:</span>
                    <strong>{record.author || "Belum dicatat"}</strong>
                  </p>
                </div>
                <div>
                  <p>
                    <b>PERIODE LAPORAN</b>
                    <span>:</span>
                    <strong>{record.period.split("·")[0].trim()}</strong>
                  </p>
                  <p>
                    <b>TAHUN ANGGARAN</b>
                    <span>:</span>
                    <strong>
                      {record.period.match(/\d{4}/)?.[0] ?? "Belum diisi"}
                    </strong>
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="print-document-title">
            <strong>
              {record.type === "Sasaran Kinerja"
                ? "SASARAN KINERJA INSTITUT TEKNOLOGI PLN"
                : "LAPORAN KINERJA TRIWULAN"}
            </strong>
            <span>
              {record.type === "Sasaran Kinerja"
                ? `PERIODE ${record.period.toUpperCase()}`
                : `PERIODE ${record.period.replace("·", "TAHUN").toUpperCase()}`}
            </span>
          </section>

          {record.type === "Sasaran Kinerja" ? (
            <table className="official-report-table target-official-table">
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
                    style={{ textAlign: "center", width: "calc(48px + 25%)" }}
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
                  record.criteriaData.map((crit, cIdx) => {
                    const strats =
                      crit.strategies && crit.strategies.length > 0
                        ? crit.strategies
                        : crit.strategy
                          ? [crit.strategy]
                          : []

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
                            {crit.name || "-"}
                          </td>
                        </tr>
                        {strats.map((strat, sIdx) => {
                          const stratNum = `${cIdx + 1}.${sIdx + 1}`
                          const totalStratRows = strat.programs.reduce(
                            (acc, p) => {
                              const list =
                                p.sasaranList && p.sasaranList.length > 0
                                  ? p.sasaranList
                                  : p.targets
                              return acc + Math.max(1, list.length)
                            },
                            0,
                          )

                          return strat.programs.map((prog, pIdx) => {
                            const progNum = `${stratNum}.${pIdx + 1}`
                            const sList =
                              prog.sasaranList && prog.sasaranList.length > 0
                                ? prog.sasaranList
                                : prog.targets.map((t) => ({
                                    id: t.id,
                                    sasaran: t.sasaran ?? t.target ?? "",
                                    bulan_mulai:
                                      t.bulan_mulai ?? t.monthStart ?? "",
                                    bulan_selesai:
                                      t.bulan_selesai ?? t.monthEnd ?? "",
                                    keterangan: t.keterangan ?? t.notes ?? "",
                                  }))
                            const progRows = Math.max(1, sList.length)

                            return sList.map((sas, sasIdx) => {
                              const isFirstSasOfProg = sasIdx === 0
                              const isFirstProgOfStrat =
                                pIdx === 0 && isFirstSasOfProg

                              return (
                                <tr key={`${prog.id}-${sas.id}`}>
                                  {isFirstProgOfStrat && (
                                    <>
                                      <td
                                        rowSpan={totalStratRows}
                                        style={{
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
                                        style={{ verticalAlign: "top" }}
                                      >
                                        {strat.name || "-"}
                                      </td>
                                    </>
                                  )}
                                  {isFirstSasOfProg && (
                                    <>
                                      <td
                                        rowSpan={progRows}
                                        style={{
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
                                        style={{ verticalAlign: "top" }}
                                      >
                                        {prog.name || "-"}
                                      </td>
                                    </>
                                  )}
                                  <td style={{ verticalAlign: "top" }}>
                                    {sas.sasaran || "-"}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: "center",
                                      verticalAlign: "top",
                                    }}
                                  >
                                    {formatBulanPelaksanaan(
                                      sas.bulan_mulai,
                                      sas.bulan_selesai,
                                    )}
                                  </td>
                                  <td style={{ verticalAlign: "top" }}>
                                    {sas.keterangan || "-"}
                                  </td>
                                </tr>
                              )
                            })
                          })
                        })}
                      </Fragment>
                    )
                  })
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
                        {record.items.find((item) => item.label === "Kriteria")
                          ?.value ?? "-"}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          textAlign: "center",
                          verticalAlign: "top",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        1.1
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        {record.items.find((item) => item.label === "Strategi")
                          ?.value ?? "-"}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          verticalAlign: "top",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        1.1.1
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        {record.items.find(
                          (item) => item.label === "Program Kerja",
                        )?.value ?? "-"}
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        {record.items.find((item) => item.label === "Sasaran")
                          ?.value ?? "-"}
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "top" }}>
                        {record.items.find(
                          (item) => item.label === "Bulan Pelaksanaan",
                        )?.value ?? "-"}
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        {record.items.find(
                          (item) => item.label === "Keterangan",
                        )?.value ?? "-"}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          ) : (
            <table className="official-report-table triwulan-official-table">
              <colgroup>
                <col style={{ width: "3%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={{
                      width: "3%",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    NO
                  </th>
                  <th style={{ width: "10%" }}>PROGRAM KERJA</th>
                  <th style={{ width: "10%" }}>SASARAN</th>
                  <th style={{ width: "9%", textAlign: "center" }}>
                    BULAN PELAKSANAAN PROGRAM KERJA
                  </th>
                  <th style={{ width: "10%" }}>TAHAP PELAKSANAAN (URAIAN)</th>
                  <th style={{ width: "10%" }}>
                    REALISASI PELAKSANAAN (URAIAN)
                  </th>
                  <th style={{ width: "9%", textAlign: "center" }}>
                    REALISASI PELAKSANAAN (%)
                  </th>
                  <th style={{ width: "7%" }}>KENDALA</th>
                  <th style={{ width: "8%" }}>RENCANA PENYELESAIAN KENDALA</th>
                  <th style={{ width: "8%" }}>WAKTU PENYELESAIAN KENDALA</th>
                  <th style={{ width: "8%" }}>KETERANGAN</th>
                  <th style={{ width: "8%" }}>LINK EVIDENCE</th>
                </tr>
                <tr className="subhead-number-row">
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    1
                  </th>
                  <th style={{ textAlign: "center" }}>2</th>
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
                {getTriwulanData(record).map((prog, pIdx) => {
                  const totalSasRows = Math.max(1, prog.sasaranList.length)
                  return prog.sasaranList.map((sas, sIdx) => {
                    const isFirstSas = sIdx === 0
                    return (
                      <tr key={`${prog.id}-${sas.id || sIdx}`}>
                        {isFirstSas && (
                          <>
                            <td
                              rowSpan={totalSasRows}
                              style={{
                                width: "28px",
                                textAlign: "center",
                                verticalAlign: "top",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {pIdx + 1}
                            </td>
                            <td
                              rowSpan={totalSasRows}
                              style={{ verticalAlign: "top" }}
                            >
                              {prog.program}
                            </td>
                          </>
                        )}
                        <td style={{ verticalAlign: "top" }}>{sas.target}</td>
                        <td
                          style={{ textAlign: "center", verticalAlign: "top" }}
                        >
                          {sas.month}
                        </td>
                        <td style={{ verticalAlign: "top" }}>{sas.stage}</td>
                        <td style={{ verticalAlign: "top" }}>
                          {sas.realization}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            verticalAlign: "top",
                            fontWeight: 700,
                          }}
                        >
                          {sas.percentage}
                        </td>
                        <td style={{ verticalAlign: "top" }}>{sas.obstacle}</td>
                        <td style={{ verticalAlign: "top" }}>{sas.solution}</td>
                        <td style={{ verticalAlign: "top" }}>
                          {sas.solutionTime}
                        </td>
                        <td style={{ verticalAlign: "top" }}>{sas.notes}</td>
                        <td
                          style={{
                            verticalAlign: "top",
                            wordBreak: "break-all",
                          }}
                        >
                          {sas.evidence}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          )}

          {record.type === "Sasaran Kinerja" ? (
            <div className="print-signatures approval-signatures">
              <div>
                <span>Menyetujui,</span>
                <b>REKTOR,</b>
                <i />
                <strong>................................</strong>
                <small>NIP/NIDN. ................................</small>
              </div>
              <div>
                <span>
                  Jakarta,{" "}
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date())}
                </span>
                <b>PIMPINAN UNIT / FAKULTAS,</b>
                <i />
                <strong>
                  {record.author || "................................"}
                </strong>
                <small>NIP/NIDN. ................................</small>
              </div>
            </div>
          ) : (
            <div className="print-signatures">
              <div>
                <span>Mengetahui,</span>
                <span>Pimpinan Unit / Fakultas</span>
                <i />
                <strong>( ........................................ )</strong>
              </div>
              <div>
                <span>Jakarta, ................................</span>
                <span>Penanggung Jawab</span>
                <i />
                <strong>
                  {record.author || "................................"}
                </strong>
              </div>
            </div>
          )}
          <footer className="print-footer">
            <span>{record.id}</span>
            <span>Dicetak melalui Sistem Pelaporan Triwulan ITPLN</span>
          </footer>
        </article>
      </div>
    </div>
  )
}
export default PrintPreviewModal
