import { useMemo, useState } from "react"
import { useAuth } from "../AuthContext"
import { collectReportingYears, useReporting } from "../ReportingContext"
import type { NotifyFn, UserRole } from "../types"
import { getSessionLockedOrganization } from "../utils/auth"
import { formatBulanPelaksanaan } from "../utils/format"
import {
  collectLateTriwulanItems,
  filterLateMonitoringEntries,
  type LateMonitoringEntry,
} from "../utils/lateMonitoring"
import { localNotificationTransport } from "../utils/notificationTransport"
import {
  appendNotifications,
  createAdminReminderNotification,
} from "../utils/notifications"
import { unitOptions } from "../utils/organizations"
import { Icon } from "./Icon"

type LateMonitoringPageProps = {
  role: UserRole
  notify: NotifyFn
  onOpenTriwulan?: () => void
  onOpenDocument?: (recordId: string) => void
}

export function LateMonitoringPage({
  role,
  notify,
  onOpenTriwulan,
  onOpenDocument,
}: LateMonitoringPageProps) {
  const { data, setData, nowMs } = useReporting()
  const { session } = useAuth()
  const lockedOrg = getSessionLockedOrganization(session)

  const [selectedYear, setSelectedYear] = useState<string>(data.year)
  const [overdueQuarter, setOverdueQuarter] = useState<string>("Semua")
  const [lateStatusFilter, setLateStatusFilter] = useState<string>("Semua")
  const [unitFilter, setUnitFilter] = useState<string>("Semua")
  const [query, setQuery] = useState<string>("")

  const yearOptions = collectReportingYears(data)

  const rawEntries = useMemo(
    () =>
      collectLateTriwulanItems({
        records: data.records,
        periods: data.periods,
        year: selectedYear,
        activeQuarter: data.quarter,
        sessionSubUnit: role === "staff" ? lockedOrg.subUnit : undefined,
        nowMs,
      }),
    [
      data.records,
      data.periods,
      selectedYear,
      data.quarter,
      role,
      lockedOrg.subUnit,
      nowMs,
    ],
  )

  const filteredEntries = useMemo(
    () =>
      filterLateMonitoringEntries(rawEntries, {
        overdueQuarter,
        lateStatus: lateStatusFilter,
        unitFilter: role === "admin" ? unitFilter : "Semua",
        query,
      }),
    [rawEntries, overdueQuarter, lateStatusFilter, role, unitFilter, query],
  )

  const quarterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Semua: rawEntries.length,
      I: 0,
      II: 0,
      III: 0,
      IV: 0,
    }
    for (const item of rawEntries) {
      counts[item.targetQuarter] = (counts[item.targetQuarter] ?? 0) + 1
    }
    return counts
  }, [rawEntries])

  const stillOverdueCount = filteredEntries.filter(
    (e) => e.lateStatus === "Terlambat",
  ).length
  const completedLateCount = filteredEntries.filter(
    (e) => e.lateStatus === "Pencapaian Terlambat",
  ).length
  const affectedUnitsCount = new Set(filteredEntries.map((e) => e.subUnit)).size

  const handleSendQuickReminder = (entry: LateMonitoringEntry) => {
    const res = createAdminReminderNotification({
      title: `Tindak Lanjut Tunggakan Triwulan ${entry.targetQuarter} (${entry.year})`,
      message: `Program "${entry.program}" (${entry.target}) masih berada pada capaian ${entry.percentage}%. Mohon segera menuntaskan progres carry-over hingga 100% pada periode berjalan.`,
      actor: session?.displayName || "Admin PRP",
      priority: "urgent",
      targetScope: "specific_units",
      targetUnits: [entry.subUnit],
      targetMenu: "Isi Laporan Triwulan",
      periodLabel: `Tertunggak TW ${entry.targetQuarter} · ${entry.year}`,
    })
    if (!res.ok) {
      notify(res.error, "error")
      return
    }
    setData((current) => ({
      ...current,
      notifications: appendNotifications(
        current.notifications,
        res.notification,
      ),
    }))
    localNotificationTransport.publishEvent({
      type: "reminder_created",
      notification: res.notification,
      sentAt: res.notification.createdAt,
    })
    notify(
      `Pengingat keterlambatan berhasil dikirim secara realtime ke unit ${entry.unitLabel}.`,
    )
  }

  return (
    <div className="late-monitoring-page">
      {role === "staff" && (
        <div className="report-heading">
          <div>
            <div className="report-kicker">
              MONITORING CARRY-OVER · UNIT {lockedOrg.unitLabel.toUpperCase()}
            </div>
            <div className="report-title">
              Monitoring Pekerjaan Triwulan Terlambat ({selectedYear})
            </div>
          </div>
          {onOpenTriwulan && (
            <button
              type="button"
              className="primary-button"
              onClick={onOpenTriwulan}
            >
              <span>Kejar Progres di Laporan Triwulan</span>
              <Icon name="arrow" size={15} />
            </button>
          )}
        </div>
      )}

      <section
        className="panel overdue-period-bar"
        aria-label="Filter periode triwulan tertunggak"
      >
        <div className="overdue-period-head">
          <div>
            <strong>Filter Periode Tertunggak</strong>
            <span>
              Pilih periode target awal program kerja (Triwulan I, II, III, atau
              IV) untuk memantau sisa target yang belum tuntas maupun pencapaian
              terlambat.
            </span>
          </div>
          <label className="overdue-year-select" htmlFor="late-filter-year">
            <span>Tahun</span>
            <select
              id="late-filter-year"
              name="lateFilterYear"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          className="overdue-quarter-tabs"
          role="tablist"
          aria-label="Periode keterlambatan"
        >
          {(["Semua", "I", "II", "III", "IV"] as const).map((q) => (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={overdueQuarter === q}
              className={overdueQuarter === q ? "is-active" : ""}
              onClick={() => setOverdueQuarter(q)}
            >
              <span>
                {q === "Semua" ? "Semua Periode" : `Tertunggak Triwulan ${q}`}
              </span>
              <b>{quarterCounts[q] ?? 0}</b>
            </button>
          ))}
        </div>
      </section>

      <div className="admin-kpis late-kpi-grid">
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-blue">
            <Icon name="layers" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">
              Total Riwayat Terlambat
            </span>
            <strong>{filteredEntries.length}</strong>
            <small>Sesuai filter periode</small>
          </div>
        </article>
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-red">
            <Icon name="alert" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">
              Masih Tertunggak (&lt;100%)
            </span>
            <strong>{stillOverdueCount}</strong>
            <small className="admin-kpi-note-red">
              Terbuka otomatis (Carry-Over)
            </small>
          </div>
        </article>
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-amber">
            <Icon name="clock" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">
              Pencapaian Terlambat (100%)
            </span>
            <strong>{completedLateCount}</strong>
            <small className="admin-kpi-note-amber">
              Tuntas melewati triwulan target
            </small>
          </div>
        </article>
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-green">
            <Icon name="grid" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">
              {role === "admin" ? "Unit Kerja Terdampak" : "Unit Sesi Aktif"}
            </span>
            <strong>
              {role === "admin" ? affectedUnitsCount : lockedOrg.subUnit || "-"}
            </strong>
            <small>
              {role === "admin" ? "Dari 42 unit pelapor" : lockedOrg.unitLabel}
            </small>
          </div>
        </article>
      </div>

      <section className="panel admin-panel">
        <div className="admin-filters late-extra-filters">
          <label htmlFor="late-search-query">
            <span>Cari program / sasaran / kendala</span>
            <input
              id="late-search-query"
              name="lateSearchQuery"
              type="search"
              placeholder="Ketik nama program, sasaran strategis, atau kendala..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label htmlFor="late-status-select">
            <span>Status Keterlambatan</span>
            <select
              id="late-status-select"
              name="lateStatusFilter"
              value={lateStatusFilter}
              onChange={(e) => setLateStatusFilter(e.target.value)}
            >
              <option value="Semua">Semua Status Keterlambatan</option>
              <option value="Terlambat">Masih Tertunggak (&lt;100%)</option>
              <option value="Pencapaian Terlambat">
                Pencapaian Terlambat (Selesai 100%)
              </option>
            </select>
          </label>
          {role === "admin" && (
            <label htmlFor="late-unit-select">
              <span>Filter Unit Kerja</span>
              <select
                id="late-unit-select"
                name="lateUnitFilter"
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
              >
                <option value="Semua">Semua Unit (42 Unit)</option>
                {Object.entries(unitOptions).map(([parent, children]) => (
                  <optgroup key={parent} label={parent}>
                    <option value={parent}>
                      {parent}
                      {children.length ? " (Semua Subunit)" : ""}
                    </option>
                    {children.map((child) => (
                      <option key={child} value={child}>
                        {child}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="admin-table-wrap" data-lenis-prevent>
          <table>
            <thead>
              <tr>
                {role === "admin" && <th>Unit Kerja</th>}
                <th>Periode Tertunggak</th>
                <th>Sasaran Strategis & Program Kerja</th>
                <th>Sasaran Kinerja</th>
                <th>Capaian & Sisa Target</th>
                <th>Kendala & Rencana Tindak Lanjut</th>
                <th>Status Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={role === "admin" ? 8 : 7}
                    className="matrix-empty-cell"
                  >
                    <div className="matrix-empty-state">
                      <Icon name="check" size={24} />
                      <strong>
                        {rawEntries.length === 0
                          ? `Tidak ada pekerjaan triwulan terlambat pada Tahun ${selectedYear}`
                          : "Tidak ada item keterlambatan yang sesuai dengan filter"}
                      </strong>
                      <p>
                        {rawEntries.length === 0
                          ? "Seluruh sasaran kinerja yang telah berjalan berada dalam jadwal targetnya atau belum melewati batas triwulan pelaksanaan."
                          : "Ubah pilihan Filter Periode Tertunggak, Status Keterlambatan, atau kata kunci pencarian untuk melihat daftar lainnya."}
                      </p>
                      {rawEntries.length > 0 && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setOverdueQuarter("Semua")
                            setLateStatusFilter("Semua")
                            setUnitFilter("Semua")
                            setQuery("")
                          }}
                        >
                          Tampilkan Semua Riwayat Terlambat
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    {role === "admin" && (
                      <td>
                        <strong>{entry.subUnit}</strong>
                        {entry.parentUnit !== entry.subUnit && (
                          <small className="admin-unit-parent">
                            {entry.parentUnit}
                          </small>
                        )}
                      </td>
                    )}
                    <td>
                      <span className="overdue-quarter-chip">
                        Tertunggak TW {entry.targetQuarter}
                      </span>
                      <small className="cell-sub-meta">
                        {formatBulanPelaksanaan(entry.monthStart, entry.monthEnd)}
                      </small>
                    </td>
                    <td>
                      <small className="cell-goal-tag">
                        {entry.strategicGoal}
                      </small>
                      <strong>{entry.program}</strong>
                    </td>
                    <td>
                      <span>{entry.target}</span>
                    </td>
                    <td>
                      <strong
                        className={
                          entry.percentage >= 100
                            ? "pct-pill is-full"
                            : "pct-pill is-partial"
                        }
                      >
                        {entry.percentage}%
                      </strong>
                      <small className="cell-sub-meta">
                        {entry.remainingPercentage > 0
                          ? `Sisa target: ${entry.remainingPercentage}%`
                          : `Tuntas di TW ${entry.completedInQuarter ?? entry.latestReportedQuarter}`}
                      </small>
                    </td>
                    <td>
                      <span>{entry.obstacle || "-"}</span>
                      {entry.solution && (
                        <small className="cell-sub-meta">
                          Rencana: {entry.solution}
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          entry.lateStatus === "Terlambat"
                            ? "late-badge is-overdue"
                            : "late-badge is-late-done"
                        }
                      >
                        {entry.lateStatus}
                      </span>
                    </td>
                    <td>
                      <div className="history-actions admin-table-actions">
                        {role === "staff" ? (
                          entry.lateStatus === "Terlambat" && onOpenTriwulan ? (
                            <button
                              type="button"
                              className="admin-action-primary"
                              onClick={onOpenTriwulan}
                            >
                              Tindak Lanjuti
                            </button>
                          ) : (
                            <span className="cell-sub-meta">Terkunci 100%</span>
                          )
                        ) : (
                          <>
                            {entry.latestRecordId && onOpenDocument && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenDocument(entry.latestRecordId!)
                                }
                              >
                                Lihat Dokumen
                              </button>
                            )}
                            {entry.lateStatus === "Terlambat" && (
                              <button
                                type="button"
                                className="admin-action-primary"
                                onClick={() => handleSendQuickReminder(entry)}
                              >
                                Ingatkan Unit
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default LateMonitoringPage
