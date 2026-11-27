import { useDialog } from "../utils/useDialog"
import { getSopSpec, type SopRole } from "../data/sopContent"
import { PORTAL_INSTITUTION } from "../pages/portalContent"
import { Icon } from "./Icon"

type SopPrintPreviewModalProps = {
  role: SopRole | null
  onClose: () => void
}

export function SopPrintPreviewModal({
  role,
  onClose,
}: SopPrintPreviewModalProps) {
  useDialog(Boolean(role), onClose, ".sop-print-preview")
  if (!role) return null

  const spec = getSopSpec(role)
  const printedDate = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date())

  return (
    <div
      className="print-preview sop-print-preview"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau cetak ${spec.shortLabel}`}
    >
      <div className="print-preview-bar sop-print-bar">
        <div>
          <strong>Pratinjau Resmi {spec.shortLabel}</strong>
          <span>
            Dokumen A4 · Portrait · Berkop {PORTAL_INSTITUTION.shortName} ITPLN
          </span>
        </div>

        <div className="sop-print-bar-actions">
          <button type="button" onClick={onClose}>
            Tutup
          </button>
          <button
            type="button"
            className="print-now"
            onClick={() => window.print()}
          >
            <Icon name="download" size={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <div className="print-canvas sop-print-canvas">
        <article className="print-sheet sop-print-sheet">
          <header className="letterhead">
            <div
              className="itpln-logo"
              aria-label="Logo Institut Teknologi PLN"
            >
              <img
                src="/logo-itpln.png"
                alt="Logo ITPLN"
                style={{ width: "78px", height: "auto" }}
              />
            </div>
            <div className="letterhead-copy">
              <h1>{PORTAL_INSTITUTION.institution}</h1>
              <p>{PORTAL_INSTITUTION.address}</p>
              <p>
                Website : {PORTAL_INSTITUTION.websiteDisplay} · e-Mail :{" "}
                {PORTAL_INSTITUTION.email} · Telepon :{" "}
                {PORTAL_INSTITUTION.phoneDisplay}
              </p>
            </div>
            <div className="letterhead-spacer" />
          </header>
          <div className="letterhead-rule" />

          <section className="sop-print-banner">
            <span className="sop-print-doc-code">
              DOKUMEN RESMI · {spec.docCode} · {PORTAL_INSTITUTION.version.toUpperCase()}
            </span>
            <h2>{spec.title.toUpperCase()}</h2>
            <p>
              {PORTAL_INSTITUTION.shortName} ({PORTAL_INSTITUTION.fullName}) ·{" "}
              {spec.roleBadge}
            </p>
          </section>

          <table className="sop-print-meta-table">
            <tbody>
              <tr>
                <th>Sasaran Pengguna</th>
                <td>{spec.audience}</td>
                <th>Kode Dokumen</th>
                <td>{spec.docCode}</td>
              </tr>
              <tr>
                <th>Unit Pengelola</th>
                <td>{PORTAL_INSTITUTION.unitManager}</td>
                <th>Acuan Waktu Sistem</th>
                <td>Kalender Asia/Jakarta (WIB, UTC+07:00)</td>
              </tr>
            </tbody>
          </table>

          <section className="sop-print-toc">
            <h3>Daftar Isi Operasional</h3>
            <ol>
              {spec.chapters.map((ch) => (
                <li key={ch.id}>
                  <strong>
                    {ch.number}: {ch.title}
                  </strong>{" "}
                  <span>({ch.menuRef})</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="sop-print-chapters">
            {spec.chapters.map((chapter) => (
              <section className="sop-print-chapter" key={chapter.id}>
                <div className="sop-print-chapter-head">
                  <span className="sop-print-chapter-num">{chapter.number}</span>
                  <div>
                    <h3>{chapter.title}</h3>
                    <span className="sop-print-chapter-menu">
                      Lokasi di Aplikasi: {chapter.menuRef}
                    </span>
                  </div>
                </div>

                <div className="sop-print-block">
                  <h4>A. Tujuan Singkat</h4>
                  <p>{chapter.purpose}</p>
                </div>

                <div className="sop-print-block">
                  <h4>B. Langkah Kerja</h4>
                  <ol className="sop-print-steps">
                    {chapter.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                {chapter.statusTable && (
                  <div className="sop-print-block">
                    <h4>Tabel Arti 4 Status Dokumen</h4>
                    <table className="sop-print-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: "16%" }}>Status</th>
                          <th style={{ width: "46%" }}>Arti Status di Sistem</th>
                          <th style={{ width: "38%" }}>Tindakan Staf Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapter.statusTable.map((row) => (
                          <tr key={row.status}>
                            <td>
                              <strong>{row.status}</strong>
                            </td>
                            <td>{row.meaning}</td>
                            <td>{row.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {chapter.exportTable && (
                  <div className="sop-print-block">
                    <h4>Panduan Memilih Jenis Unduhan Rekap Master</h4>
                    <table className="sop-print-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: "24%" }}>Jenis Unduhan</th>
                          <th style={{ width: "12%" }}>Format</th>
                          <th style={{ width: "26%" }}>Kegunaan Utama</th>
                          <th style={{ width: "38%" }}>Cakupan Isi Berkas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapter.exportTable.map((row) => (
                          <tr key={row.extension}>
                            <td>
                              <strong>{row.label}</strong>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <strong>{row.extension}</strong>
                            </td>
                            <td>{row.purpose}</td>
                            <td>{row.contents}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="sop-print-callout">
                  <h4>C. {chapter.mandatoryTitle}</h4>
                  <ul>
                    {chapter.mandatoryRules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>

                <div className="sop-print-block">
                  <h4>D. Cara Mengatasi Kendala</h4>
                  <ul className="sop-print-fixes">
                    {chapter.quickFixes.map((item, idx) => (
                      <li key={idx}>
                        <strong>Kendala: {item.issue}.</strong> Solusi:{" "}
                        {item.fix}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>

          <section className="sop-print-contact">
            <div>
              <strong>Bantuan Teknis & Koordinasi Jadwal Pelaporan</strong>
              <p>
                {PORTAL_INSTITUTION.unitManager} ·{" "}
                {PORTAL_INSTITUTION.institution}
              </p>
              <p>
                Email: {PORTAL_INSTITUTION.email} · Telepon:{" "}
                {PORTAL_INSTITUTION.phoneDisplay} · Alamat:{" "}
                {PORTAL_INSTITUTION.address}
              </p>
            </div>
          </section>

          <footer className="print-footer sop-print-footer">
            <span>
              {spec.docCode} · {spec.shortLabel} {PORTAL_INSTITUTION.shortName}{" "}
              ITPLN ({PORTAL_INSTITUTION.version})
            </span>
            <span>Dicetak pada {printedDate} WIB</span>
          </footer>
        </article>
      </div>
    </div>
  )
}

export default SopPrintPreviewModal
