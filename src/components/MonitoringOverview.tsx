import { useState } from "react"
import type { HistoryRecord } from "../types"
import { reportingCoverage, unitOptions } from "../utils/organizations"
import { deadlineCutoff } from "../utils/workflow"
import "./monitoring-overview.css"

const quarters = ["I", "II", "III", "IV"]
const statuses = ["Belum Melapor", "Menunggu", "Revisi", "Disetujui"]
const statusClass = (status: string) => ["missing", "waiting", "revision", "approved"][statuses.indexOf(status)] ?? "future"

export function MonitoringOverview({ records, year, quarter, unit, periods, onReview, onRemindScope }: {
  records: HistoryRecord[]
  year: string
  quarter: string
  unit: string
  periods: Record<string, { deadline: string; open: boolean }>
  onReview: (record: HistoryRecord) => void
  onRemindScope?: (scope: "missing_report" | "revision_only") => void
}) {
  const [action, setAction] = useState("Belum Melapor")
  const coverage = reportingCoverage(records, year, quarter, unit)
  const groups = unit ? (unitOptions[unit]?.length ? unitOptions[unit] : [unit]) : Object.keys(unitOptions)
  const period = periods[`${year}-${quarter}`]
  const cutoff = period?.deadline ? deadlineCutoff(period.deadline) : NaN
  const started = (index: number) => Date.now() >= Date.UTC(Number(year), index * 3, 1) - 7 * 3600_000
  const currentStarted = started(quarters.indexOf(quarter))
  const overdue = currentStarted && Number.isFinite(cutoff) && Date.now() > cutoff
  const actionableRows = coverage.rows.filter((row) => row.record || currentStarted)
  const followUp = actionableRows.filter((row) => (row.record?.status ?? "Belum Melapor") === action)
  const matrix = quarters.map((q) => reportingCoverage(records, year, q, unit))

  return <>
    <div className="admin-charts monitoring-overview">
      <section className="panel admin-panel">
        <h2 className="admin-card-title">Status Pelaporan per Unit</h2>
        <p className="admin-card-subtitle">TW {quarter} · {year}</p>
        <ul className="monitoring-legend" aria-label="Legenda status pelaporan">{statuses.map((status) => <li key={status}><i className={`monitoring-${statusClass(status)}`} />{status}</li>)}</ul>
        <div className="monitoring-unit-list" tabIndex={0} aria-label="Grafik status unit, dapat digulir">
          {groups.map((group) => {
            const result = reportingCoverage(records, year, quarter, group)
            const values = statuses.map((status) => result.rows.filter((row) => (row.record?.status ?? "Belum Melapor") === status).length)
            if (!currentStarted && !result.submitted) return <div className="monitoring-unit-row" key={group}><div className="monitoring-unit-heading"><strong>{group}</strong><span>Belum berjalan · {result.expected} wajib lapor</span></div><div className="monitoring-stacked-bar monitoring-future" aria-label={`${group}: belum berjalan`} /></div>
            return <div className="monitoring-unit-row" key={group}>
              <div className="monitoring-unit-heading"><strong>{group}</strong><span>{result.submitted}/{result.expected} mengirim · {Math.round(result.percent)}%</span></div>
              <div className="monitoring-stacked-bar" role="img" aria-label={`${group}: ${statuses.map((status, index) => `${status} ${values[index]}`).join(", ")}`}>
                {statuses.map((status, index) => values[index] > 0 && <span key={status} className={`monitoring-${statusClass(status)}`} style={{ width: `${values[index] / result.expected * 100}%` }} title={`${status}: ${values[index]}`} />)}
              </div>
            </div>
          })}
          {!coverage.expected && <p>Unit ini belum terdaftar sebagai pelapor wajib.</p>}
        </div>
      </section>
      <section className="panel admin-panel">
        <div className="monitoring-followup-head">
          <div>
            <h2 className="admin-card-title">Perlu Tindak Lanjut</h2>
            <p className="admin-card-subtitle">TW {quarter} · {year}</p>
          </div>
          {onRemindScope && (action === "Belum Melapor" || action === "Revisi") && followUp.length > 0 && (
            <button
              type="button"
              className="monitoring-remind-btn"
              onClick={() => onRemindScope(action === "Belum Melapor" ? "missing_report" : "revision_only")}
            >
              Ingatkan ({followUp.length})
            </button>
          )}
        </div>
        <div className="monitoring-action-tabs" aria-label="Jenis tindak lanjut">
          {statuses.slice(0, 3).map((status) => <button type="button" key={status} aria-pressed={action === status} onClick={() => setAction(status)}>{status} ({actionableRows.filter((row) => (row.record?.status ?? "Belum Melapor") === status).length})</button>)}
        </div>
        {action === "Belum Melapor" && !currentStarted && <p>Periode belum berjalan.</p>}
        <ul className="monitoring-follow-up">
          {followUp.map((row) => <li key={row.subUnit}><div><strong>{row.subUnit}</strong><span>{row.parentUnit}{row.record ? ` · ${row.record.sentAt}` : ""}</span></div>{row.record ? <button type="button" onClick={() => onReview(row.record!)}>{row.record.status === "Menunggu" ? "Periksa" : "Lihat detail"}</button> : <span className={`monitoring-status monitoring-${overdue ? "revision" : "missing"}`}>{overdue ? "Lewat tenggat" : "Belum mengirim"}</span>}</li>)}
        </ul>
        {!followUp.length && <p>Tidak ada pelapor dengan status ini pada pilihan periode dan unit.</p>}
      </section>
    </div>
    <section className="panel admin-panel monitoring-matrix">
      <h2 className="admin-card-title">Status Pelaporan Sepanjang Tahun</h2>
      <p className="admin-card-subtitle">Tahun {year}</p>
      <div className="admin-table-wrap" tabIndex={0} aria-label="Matriks status pelapor, dapat digulir">
        <table><thead><tr><th>UNIT UTAMA</th><th>PELAPOR</th>{quarters.map((q) => <th key={q}>TW {q}</th>)}</tr></thead>
          <tbody>{coverage.rows.map((row) => <tr key={row.subUnit}><td>{row.parentUnit}</td><th scope="row">{row.subUnit}</th>{matrix.map((result, index) => {
            const record = result.rows.find((item) => item.subUnit === row.subUnit)?.record
            const status = record?.status ?? (started(index) ? "Belum Melapor" : "Belum berjalan")
            return <td key={quarters[index]}>{record ? <button type="button" className={`monitoring-status monitoring-${statusClass(status)}`} onClick={() => onReview(record)} aria-label={`${row.subUnit}, TW ${quarters[index]}: ${status}, ${status === "Menunggu" ? "periksa laporan" : "lihat detail laporan"}`}>{status}</button> : <span className={`monitoring-status monitoring-${statusClass(status)}`}>{status}</span>}</td>
          })}</tr>)}</tbody>
        </table>
      </div>
      {!coverage.expected && <p>Tidak ada pelapor wajib yang cocok dengan pilihan unit.</p>}
    </section>
  </>
}
