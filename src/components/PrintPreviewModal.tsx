import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"
import type { HistoryRecord } from "../types"
import { formatBulanPelaksanaan, getTriwulanData } from "../utils/format"
import { getSasaranKinerjaReviewCriteria } from "../utils/review"

function formatPrintText(value?: string | null): string {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : "-"
}

function textCellAlign(value?: string | null): "left" | "center" {
  return formatPrintText(value) === "-" ? "center" : "left"
}

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

  const docYear = record.period.match(/\b(\d{4})\b/)?.[1] ?? "2026"

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
                Website : www.itpln.ac.id / e-Mail : rektorat@itpln.ac.id /
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
            (() => {
              const criteriaSlots = getSasaranKinerjaReviewCriteria(record)
              let rowCounter = 0
              return (
                <table className="official-report-table target-official-table sasaran-green-print-table">
                  <colgroup>
                    <col style={{ width: "44px" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
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
                        const stratText = formatPrintText(
                          strat.name || crit.name,
                        )

                        return strat.programSlots.map((prog, pIdx) => {
                          const progText = formatPrintText(prog.name)
                          const sList = prog.sasaranSlots.length
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
                          const progRows = sList.length

                          return sList.map((sas, sasIdx) => {
                            rowCounter += 1
                            const isFirstSasOfProg = sasIdx === 0
                            const isFirstProgOfStrat =
                              pIdx === 0 && isFirstSasOfProg

                            const sasText = formatPrintText(sas.sasaran)
                            const notesText = formatPrintText(sas.keterangan)
                            const bulanText = formatPrintText(
                              formatBulanPelaksanaan(
                                sas.bulanMulai,
                                sas.bulanSelesai,
                              ),
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
                                    style={{
                                      textAlign: textCellAlign(stratText),
                                      verticalAlign: "top",
                                    }}
                                  >
                                    {stratText}
                                  </td>
                                )}
                                {isFirstSasOfProg && (
                                  <td
                                    rowSpan={progRows}
                                    style={{
                                      textAlign: textCellAlign(progText),
                                      verticalAlign: "top",
                                    }}
                                  >
                                    {progText}
                                  </td>
                                )}
                                <td
                                  style={{
                                    textAlign: textCellAlign(sasText),
                                    verticalAlign: "top",
                                  }}
                                >
                                  {sasText}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    verticalAlign: "top",
                                  }}
                                >
                                  {bulanText}
                                </td>
                                <td
                                  style={{
                                    textAlign: textCellAlign(notesText),
                                    verticalAlign: "top",
                                  }}
                                >
                                  {notesText}
                                </td>
                              </tr>
                            )
                          })
                        })
                      }),
                    )}
                  </tbody>
                </table>
              )
            })()
          ) : (
            (() => {
              let rowCounter = 0
              return (
                <table className="official-report-table triwulan-official-table triwulan-color-print-table">
                  <colgroup>
                    <col style={{ width: "3%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "7%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="th-blue" style={{ textAlign: "center" }}>
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
                    {getTriwulanData(record).map((prog) => {
                      const totalSasRows = Math.max(1, prog.sasaranList.length)
                      return prog.sasaranList.map((sas, sIdx) => {
                        rowCounter += 1
                        const isFirstSas = sIdx === 0
                        const goalText = formatPrintText(prog.strategicGoal)
                        const programText = formatPrintText(prog.program)
                        const targetText = formatPrintText(sas.target)
                        const monthText = formatPrintText(sas.month)
                        const stageText = formatPrintText(sas.stage)
                        const realizationText = formatPrintText(sas.realization)
                        const percentageText = formatPrintText(sas.percentage)
                        const obstacleText = formatPrintText(sas.obstacle)
                        const solutionText = formatPrintText(sas.solution)
                        const solutionTimeText = formatPrintText(
                          sas.solutionTime,
                        )
                        const baseNotes = formatPrintText(sas.notes)
                        const notesText =
                          sas.lateStatus && sas.lateStatus !== "Tepat Waktu"
                            ? baseNotes === "-"
                              ? `[${sas.lateStatus}]`
                              : `[${sas.lateStatus}] ${baseNotes}`
                            : baseNotes
                        const evidenceText = formatPrintText(sas.evidence)

                        return (
                          <tr key={`${prog.id}-${sas.id || sIdx}`}>
                            <td
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
                                  style={{
                                    textAlign: textCellAlign(goalText),
                                    verticalAlign: "top",
                                  }}
                                >
                                  {goalText}
                                </td>
                                <td
                                  rowSpan={totalSasRows}
                                  style={{
                                    textAlign: textCellAlign(programText),
                                    verticalAlign: "top",
                                  }}
                                >
                                  {programText}
                                </td>
                              </>
                            )}
                            <td
                              style={{
                                textAlign: textCellAlign(targetText),
                                verticalAlign: "top",
                              }}
                            >
                              {targetText}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                verticalAlign: "top",
                              }}
                            >
                              {monthText}
                            </td>
                            <td
                              style={{
                                textAlign: textCellAlign(stageText),
                                verticalAlign: "top",
                              }}
                            >
                              {stageText}
                            </td>
                            <td
                              style={{
                                textAlign: textCellAlign(realizationText),
                                verticalAlign: "top",
                              }}
                            >
                              {realizationText}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                verticalAlign: "top",
                                fontWeight: 700,
                              }}
                            >
                              {percentageText}
                            </td>
                            <td
                              style={{
                                textAlign: textCellAlign(obstacleText),
                                verticalAlign: "top",
                              }}
                            >
                              {obstacleText}
                            </td>
                            <td
                              style={{
                                textAlign: textCellAlign(solutionText),
                                verticalAlign: "top",
                              }}
                            >
                              {solutionText}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                verticalAlign: "top",
                              }}
                            >
                              {solutionTimeText}
                            </td>
                            <td
                              style={{
                                textAlign: textCellAlign(notesText),
                                verticalAlign: "top",
                              }}
                            >
                              {notesText}
                            </td>
                            <td
                              style={{
                                textAlign: textCellAlign(evidenceText),
                                verticalAlign: "top",
                                wordBreak: "break-all",
                              }}
                            >
                              {evidenceText}
                            </td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                </table>
              )
            })()
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
