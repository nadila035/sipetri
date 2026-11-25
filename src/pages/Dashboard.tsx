import { Icon } from "../components/Icon"
import { getDeadlineCardModel, getPeriodState } from "../utils/workflow"
import { extractDashboardAnnualMetrics } from "../utils/drafts"
import { filterRecordsForSession } from "../utils/auth"
import { useAuth } from "../AuthContext"
import { useReporting } from "../ReportingContext"
import "../dashboard.css"
import type { ActionCardItem } from "../types"

const actions: ActionCardItem[] = [
  {
    title: "Isi Laporan Triwulan",
    description: "Catat realisasi, kendala, dan bukti dukung.",
    icon: "report",
    tone: "blue",
  },
  {
    title: "Isi Sasaran Kinerja",
    description: "Susun target tahunan dan jadwal program.",
    icon: "target",
    tone: "teal",
  },
  {
    title: "Riwayat Dokumen",
    description: "Pantau verifikasi, perbaiki revisi, dan unduh arsip.",
    icon: "history",
    tone: "violet",
  },
]

type DashboardProps = {
  onSelectMenu: (label: string) => void
  onOpenRevisions: () => void
}

export function Dashboard({ onSelectMenu, onOpenRevisions }: DashboardProps) {
  const { data } = useReporting()
  const { session } = useAuth()
  const unitRecords = filterRecordsForSession(data.records, session)
  const { year, quarter } = data
  const quarters = ["I", "II", "III", "IV"]
  const { currentPrograms } = extractDashboardAnnualMetrics(unitRecords, year)
  const annualRecord = unitRecords.find(
    (record) =>
      record.type === "Sasaran Kinerja" &&
      record.period === `Tahun ${year}` &&
      record.status !== "Draf",
  )
  const annualDraftRecord = unitRecords.find(
    (record) =>
      record.type === "Sasaran Kinerja" &&
      record.period === `Tahun ${year}` &&
      record.status === "Draf",
  )
  const documents = [
    {
      title: "Sasaran Kinerja Tahunan",
      status: annualDraftRecord
        ? "Draf / Sedang Diisi"
        : (annualRecord?.status ?? "Belum Dimulai"),
    },
    ...quarters.map((q) => {
      const hasDraft = unitRecords.some(
        (record) =>
          record.type === "Laporan Triwulan" &&
          record.period === `Triwulan ${q} · ${year}` &&
          record.status === "Draf",
      )
      const submitted = unitRecords.find(
        (record) =>
          record.type === "Laporan Triwulan" &&
          record.period === `Triwulan ${q} · ${year}` &&
          record.status !== "Draf",
      )
      return {
        title: `Laporan Triwulan ${q}`,
        status: hasDraft
          ? "Draf / Sedang Diisi"
          : (submitted?.status ?? "Belum Dimulai"),
      }
    }),
  ]
  const chart = quarters.map((q, index) => {
    const start = `${year}-${String(index * 3 + 1).padStart(2, "0")}`
    const end = `${year}-${String(index * 3 + 3).padStart(2, "0")}`
    const planned = currentPrograms.filter(({ sasaranList }) =>
      sasaranList.some((target) => {
        const startTarget = target.bulan_mulai
        const endTarget = target.bulan_selesai || target.bulan_mulai
        return startTarget <= end && endTarget >= start
      }),
    )
    const reported = new Set(
      unitRecords
        .filter(
          (record) =>
            record.type === "Laporan Triwulan" &&
            record.period === `Triwulan ${q} · ${year}` &&
            ["Disetujui", "Menunggu", "Revisi"].includes(record.status),
        )
        .flatMap((record) =>
          record.items
            .filter((item) => item.label === "Program Kerja")
            .map((item) => item.value.trim().toLowerCase())
            .filter(Boolean),
        ),
    )
    return { quarter: q, target: planned.length, reported: reported.size }
  })
  const totalTarget = chart.reduce((total, item) => total + item.target, 0)
  const totalReported = chart.reduce((total, item) => total + item.reported, 0)
  const percentage = totalTarget
    ? Math.round((totalReported / totalTarget) * 100)
    : 0
  const maximum = Math.max(
    1,
    ...chart.flatMap((item) => [item.target, item.reported]),
  )
  const period = data.periods[`${year}-${quarter}`]
  const periodState = getPeriodState(period)
  const deadlineCard = getDeadlineCardModel(period)
  const welcomeStatusNote =
    periodState.status === "upcoming"
      ? "Pengisian baru belum dimulai. Gunakan Riwayat untuk melihat dokumen sebelumnya."
      : periodState.status === "expired"
        ? "Tenggat pengiriman baru berakhir. Draf dan revisi tetap dapat dibuka."
        : periodState.status === "closed" ||
            periodState.status === "unscheduled"
          ? "Pengiriman baru sedang ditutup oleh Admin PRP."
          : periodState.status === "invalid"
            ? "Rentang tanggal periode belum valid. Hubungi Admin PRP."
            : `Periode pelaporan Triwulan ${quarter} sedang berjalan. Pastikan seluruh data kinerja telah terisi sebelum batas waktu.`
  const revisionRecords = unitRecords.filter(
    (record) => record.status === "Revisi",
  )
  const revisionCount = revisionRecords.length
  const firstRevision = revisionRecords[0]
  const firstRevisionNotesCount = firstRevision
    ? firstRevision.items.filter(
        (item) => item.needsRevision || item.note?.trim(),
      ).length
    : 0
  const revisionNoun = revisionRecords.every(
    (record) => record.type === "Laporan Triwulan",
  )
    ? "laporan"
    : "dokumen"
  const revisionSummary =
    revisionCount === 1 && firstRevision
      ? `${firstRevision.title} (${firstRevision.period})${
          firstRevisionNotesCount > 0
            ? ` memiliki ${firstRevisionNotesCount} catatan verifikator untuk diperbaiki.`
            : " menunggu perbaikan sebelum dikirim ulang."
        }`
      : `${revisionRecords
          .slice(0, 2)
          .map((record) => `${record.title} (${record.period})`)
          .join(", ")}${
          revisionCount > 2 ? `, dan ${revisionCount - 2} dokumen lainnya` : ""
        } menunggu perbaikan.`
  return (
    <>
      <section className="welcome">
        <div className="welcome-copy">
          <div className="eyebrow">SELAMAT DATANG KEMBALI</div>
          <div className="welcome-title">
            Halo, {session?.displayName ?? "Rekan Unit"}. Mari tuntaskan laporan
            bagian Anda.
          </div>
          <p>{welcomeStatusNote}</p>
          <button onClick={() => onSelectMenu("Isi Laporan Triwulan")}>
            Lanjutkan pengisian <Icon name="arrow" size={18} />
          </button>
        </div>
        <div className="deadline-card">
          <div className="deadline-top">
            <span className="deadline-icon">
              <Icon name="clock" />
            </span>
            <span>{deadlineCard.title}</span>
          </div>
          <strong>{deadlineCard.headline}</strong>
          <div className="countdown">
            {deadlineCard.countdownHighlight ? (
              <>
                <span>{deadlineCard.countdownHighlight}</span>{" "}
                {deadlineCard.countdownSuffix}
              </>
            ) : (
              deadlineCard.countdownSuffix
            )}
          </div>
          <div
            className={`mini-progress${
              deadlineCard.tone === "expired" ? " is-expired" : ""
            }`}
            aria-hidden="true"
          >
            <i style={{ width: `${deadlineCard.progressPercent}%` }} />
          </div>
        </div>
        <div className="welcome-pattern" />
      </section>

      {revisionCount > 0 && (
        <section
          className="revision-reminder"
          aria-label="Pengingat dokumen perlu revisi"
        >
          <span className="revision-reminder-icon" aria-hidden="true">
            !
          </span>
          <div className="revision-reminder-copy">
            <strong>
              {revisionCount} {revisionNoun} perlu direvisi
            </strong>
            <p>
              {revisionSummary}{" "}
              <button
                type="button"
                className="revision-reminder-action"
                onClick={onOpenRevisions}
              >
                Periksa riwayat
              </button>
            </p>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="section-title">Akses Cepat</div>
            <p>Pintasan ke halaman pengisian dan arsip dokumen.</p>
          </div>
        </div>
        <div className="action-grid">
          {actions.map((action) => (
            <button
              className="action-card"
              key={action.title}
              onClick={() =>
                onSelectMenu(
                  action.title === "Riwayat Dokumen" ? "Riwayat" : action.title,
                )
              }
            >
              <span className={`action-icon ${action.tone}`}>
                <Icon name={action.icon} size={24} />
              </span>
              <span className="action-copy">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </span>
              <span className="action-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <div className="section-title">Status Dokumen {year}</div>
              <p>Kelengkapan sasaran tahunan dan laporan triwulanan</p>
            </div>
            <button
              className="text-button"
              onClick={() => onSelectMenu("Isi Laporan Triwulan")}
            >
              Isi laporan <Icon name="arrow" size={15} />
            </button>
          </div>
          <ol
            className="document-timeline"
            aria-label={`Status dokumen tahun ${year}`}
          >
            {documents.map((document, index) => (
              <li key={document.title}>
                <span
                  className={`timeline-step ${
                    document.status === "Disetujui" ? "approved" : ""
                  }`}
                >
                  {document.status === "Disetujui" ? (
                    <Icon name="check" size={13} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="document-title">{document.title}</span>
                <span
                  className={`document-badge ${
                    document.status === "Disetujui"
                      ? "approved"
                      : document.status === "Belum Dimulai"
                        ? "not-started"
                        : document.status === "Revisi"
                          ? "revision"
                          : document.status === "Menunggu"
                            ? "waiting"
                            : "ongoing"
                  }`}
                >
                  {document.status}
                </span>
              </li>
            ))}
          </ol>
          <div className="realization-heading">
            <h3>Realisasi Program Kerja per Triwulan</h3>
            <p>Perbandingan target RKA terhadap program yang telah dikirim.</p>
          </div>
          <div className="realization-content">
            <div
              className="quarter-chart"
              role="img"
              aria-label={chart
                .map(
                  (item) =>
                    `TW ${item.quarter}: target ${item.target}, dilaporkan ${item.reported}`,
                )
                .join("; ")}
            >
              <div className="chart-legend">
                <span>
                  <i className="target-key" />
                  Target
                </span>
                <span>
                  <i className="reported-key" />
                  Sudah dilaporkan
                </span>
              </div>
              <div className="chart-columns">
                {chart.map((item) => (
                  <div className="quarter-column" key={item.quarter}>
                    <div className="bar-pair">
                      <div className="bar-slot">
                        <b>{item.target}</b>
                        <div
                          className="quarter-bar target-bar"
                          style={{
                            height: `${(item.target / maximum) * 90}px`,
                          }}
                        />
                      </div>
                      <div className="bar-slot">
                        <b>{item.reported}</b>
                        <div
                          className="quarter-bar reported-bar"
                          style={{
                            height: `${(item.reported / maximum) * 90}px`,
                          }}
                        />
                      </div>
                    </div>
                    <span>TW {item.quarter}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="annual-realization">
              <div
                className="annual-ring"
                style={{
                  background: `conic-gradient(#2c67d3 ${percentage}%, #e9edf3 0)`,
                }}
              >
                <strong>{percentage}%</strong>
              </div>
              <strong>Realisasi tahunan</strong>
              <span>
                {totalReported} dari {totalTarget} target pelaporan
              </span>
            </div>
          </div>
          <p className="chart-note">
            Program berstatus Disetujui, Menunggu, atau Revisi dihitung sekali
            per triwulan, tanpa draf.
          </p>
          {totalTarget === 0 && (
            <p className="chart-note">
              Belum ada target program kerja untuk tahun {year}.
            </p>
          )}
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <div className="section-title">Aktivitas Terbaru</div>
              <p>Dokumen yang baru saja dikirim</p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onSelectMenu("Riwayat")}
            >
              Semua riwayat <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="activity-list">
            {unitRecords
              .filter((record) => record.status !== "Draf")
              .slice(0, 3)
              .map((record) => (
              <div className="activity-item" key={record.id}>
                <span className="activity-icon blue">
                  <Icon name="history" size={16} />
                </span>
                <div>
                  <strong>{record.title}</strong>
                  <p>
                    {record.status} · {record.period}
                  </p>
                  <time>{record.sentAt}</time>
                </div>
              </div>
            ))}
            {!unitRecords.some((record) => record.status !== "Draf") && (
              <p>
                Belum ada pengiriman. Isi laporan atau sasaran kinerja untuk
                mengirim dokumen.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
export default Dashboard
