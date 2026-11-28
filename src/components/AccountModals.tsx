import { useEffect, useMemo, useRef, useState } from "react"
import { useDialog } from "../utils/useDialog"
import type { AuthSession } from "../types"
import { getUserInitials } from "../utils/auth"
import { PORTAL_INSTITUTION } from "../pages/portalContent"
import {
  filterSopChapters,
  getAllowedWorkspaceSopRoles,
  getSopSpec,
  type SopRole,
} from "../data/sopContent"
import { Icon } from "./Icon"
import { SopPrintPreviewModal } from "./SopPrintPreviewModal"
import "./sop-guide.css"

export function AccountInfoModal({
  open,
  session,
  onClose,
}: {
  open: boolean
  session: AuthSession
  onClose: () => void
}) {
  useDialog(open, onClose, ".account-info-overlay")
  if (!open) return null

  const unitScopeText =
    session.role === "admin"
      ? "Seluruh bagian dan unit kerja (Administrator PRP / Renbang)"
      : `Terkunci otomatis pada unit ${session.subUnit || session.parentUnit} sesuai sesi login aktif`

  return (
    <div
      className="submit-success-overlay account-info-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-info-title"
    >
      <div className="submit-success-dialog account-modal-dialog">
        <div className="account-modal-header">
          <div className="avatar is-lg" aria-hidden="true">
            {getUserInitials(session.displayName)}
          </div>
          <div>
            <h2 id="account-info-title">{session.displayName}</h2>
            <p>@{session.username}</p>
          </div>
        </div>

        <dl className="submit-success-meta">
          <div>
            <dt>Peran Akun</dt>
            <dd>
              {session.role === "admin"
                ? session.displayName
                : "Staf Bagian / Unit Pelapor"}
            </dd>
          </div>
          <div>
            <dt>Unit Utama</dt>
            <dd>{session.parentUnit || "-"}</dd>
          </div>
          <div>
            <dt>Sub Unit / Bagian</dt>
            <dd>
              {session.role === "admin"
                ? "Semua Unit (Admin)"
                : `${session.subUnit || session.parentUnit} (Terkunci Sesi)`}
            </dd>
          </div>
          <div>
            <dt>Cakupan Akses</dt>
            <dd>{unitScopeText}</dd>
          </div>
          <div>
            <dt>Mode Autentikasi</dt>
            <dd>Sesi browser lokal (siap integrasi backend API)</dd>
          </div>
        </dl>

        <div className="submit-success-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup informasi akun"
        onClick={onClose}
      />
    </div>
  )
}

export function HelpGuideModal({
  open,
  role,
  onClose,
}: {
  open: boolean
  role: AuthSession["role"]
  onClose: () => void
}) {
  const allowedRoles = getAllowedWorkspaceSopRoles(role)
  const effectiveRole: SopRole = allowedRoles[0]

  const [searchQuery, setSearchQuery] = useState("")
  const [activeChapterId, setActiveChapterId] = useState<string>("")
  const [printOpen, setPrintOpen] = useState(false)
  const readerRef = useRef<HTMLDivElement>(null)

  const spec = getSopSpec(effectiveRole)

  const visibleChapters = useMemo(
    () => filterSopChapters(spec.chapters, searchQuery),
    [spec.chapters, searchQuery],
  )

  useEffect(() => {
    if (!open) {
      setPrintOpen(false)
      return
    }
    setSearchQuery("")
    const nextSpec = getSopSpec(effectiveRole)
    setActiveChapterId(nextSpec.chapters[0]?.id ?? "")
    if (readerRef.current) {
      readerRef.current.scrollTop = 0
    }
  }, [open, effectiveRole])

  useDialog(open, onClose, ".sop-guide-overlay")
  if (!open) return null

  const jumpToChapter = (chapterId: string) => {
    setActiveChapterId(chapterId)
    const target = document.getElementById(`sop-card-${chapterId}`)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleReaderScroll = () => {
    const container = readerRef.current
    if (!container || visibleChapters.length === 0) return
    const containerTop = container.getBoundingClientRect().top
    let currentId = visibleChapters[0].id
    for (const ch of visibleChapters) {
      const card = document.getElementById(`sop-card-${ch.id}`)
      if (!card) continue
      const offset = card.getBoundingClientRect().top - containerTop
      if (offset <= 90) {
        currentId = ch.id
      }
    }
    if (currentId !== activeChapterId) {
      setActiveChapterId(currentId)
    }
  }

  return (
    <>
      <div
        className="sop-guide-overlay help-guide-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-guide-title"
      >
        <div className="sop-guide-dialog">
          <header className="sop-guide-head">
            <div className="sop-guide-head-main">
              <div className="sop-guide-head-icon" aria-hidden="true">
                <Icon name="help" size={22} />
              </div>
              <div className="sop-guide-head-copy">
                <div className="sop-guide-kicker-row">
                  <span
                    className={`sop-guide-role-pill${effectiveRole === "admin" ? " is-admin" : ""}`}
                  >
                    {spec.roleBadge}
                  </span>
                  <span className="sop-guide-doc-meta">
                    {spec.docCode} · {spec.scopeSummary}
                  </span>
                </div>
                <h2 id="sop-guide-title">{spec.title}</h2>
                <p>{spec.subtitle}</p>
              </div>
            </div>

            <div className="sop-guide-head-right">
              <button
                type="button"
                className="sop-guide-close"
                aria-label="Tutup panduan SOP"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </header>

          <div className="sop-guide-toolbar">
            <div className="sop-search-box">
              <span className="sop-search-icon" aria-hidden="true">
                <Icon name="search" size={16} />
              </span>
              <input
                id="sop-guide-search-input"
                name="sop-search"
                type="search"
                aria-label={`Cari materi di dalam ${spec.shortLabel}`}
                placeholder={`Cari langkah, nama menu, aturan, atau kendala (${spec.shortLabel})...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sop-search-clear"
                  aria-label="Bersihkan kata kunci pencarian SOP"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </div>

            <div className="sop-pdf-actions">
              <button
                type="button"
                className="sop-pdf-btn is-primary"
                onClick={() => setPrintOpen(true)}
              >
                <Icon name="download" size={15} />
                <span>Cetak / Simpan {spec.shortLabel} (PDF)</span>
              </button>
            </div>
          </div>

          <div className="sop-guide-workspace">
            <nav
              className="sop-toc-rail"
              aria-label={`Daftar bab ${spec.shortLabel}`}
            >
              <span className="sop-toc-heading">
                Daftar Isi ({visibleChapters.length}/{spec.chapters.length} Bab)
              </span>
              <ul className="sop-toc-list">
                {visibleChapters.map((chapter) => {
                  const isCurrent =
                    activeChapterId === chapter.id ||
                    (!visibleChapters.some((c) => c.id === activeChapterId) &&
                      visibleChapters[0]?.id === chapter.id)
                  return (
                    <li key={chapter.id}>
                      <button
                        type="button"
                        className={`sop-toc-btn${isCurrent ? " is-active" : ""}`}
                        onClick={() => jumpToChapter(chapter.id)}
                      >
                        <span className="sop-toc-num">{chapter.number}</span>
                        <span className="sop-toc-title">{chapter.title}</span>
                      </button>
                    </li>
                  )
                })}
                <li>
                  <button
                    type="button"
                    className={`sop-toc-btn${activeChapterId === "sop-kontak-prp" ? " is-active" : ""}`}
                    onClick={() => jumpToChapter("sop-kontak-prp")}
                  >
                    <span className="sop-toc-num">Kontak</span>
                    <span className="sop-toc-title">
                      Layanan Bantuan PRP ITPLN
                    </span>
                  </button>
                </li>
              </ul>
            </nav>

            <div
              ref={readerRef}
              className="sop-reader-pane"
              onScroll={handleReaderScroll}
            >
              {visibleChapters.length === 0 ? (
                <div className="sop-empty-search" role="status">
                  <Icon name="search" size={24} />
                  <strong>
                    Topik "{searchQuery}" tidak ditemukan pada {spec.shortLabel}
                  </strong>
                  <p>
                    Gunakan kata kunci lain seperti "Revisi", "100%", "WIB",
                    "Impor", atau tampilkan kembali seluruh bab.
                  </p>
                  <button
                    type="button"
                    className="sop-pdf-btn is-primary"
                    onClick={() => setSearchQuery("")}
                  >
                    Tampilkan Semua Bab
                  </button>
                </div>
              ) : (
                visibleChapters.map((chapter) => (
                  <article
                    key={chapter.id}
                    id={`sop-card-${chapter.id}`}
                    className="sop-chapter-card"
                  >
                    <header className="sop-chapter-head">
                      <span className="sop-chapter-badge">{chapter.number}</span>
                      <div className="sop-chapter-title-wrap">
                        <h3>{chapter.title}</h3>
                        <span className="sop-chapter-menu-ref">
                          {chapter.menuRef}
                        </span>
                      </div>
                    </header>

                    <div className="sop-chapter-body">
                      <section className="sop-section-block">
                        <h4 className="sop-section-label">Tujuan Singkat</h4>
                        <p className="sop-purpose-text">{chapter.purpose}</p>
                      </section>

                      <section className="sop-section-block">
                        <h4 className="sop-section-label">Langkah Kerja</h4>
                        <ol className="sop-steps-list">
                          {chapter.steps.map((step, index) => (
                            <li key={index}>
                              <span
                                className="sop-step-index"
                                aria-hidden="true"
                              >
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </section>

                      {chapter.statusTable && (
                        <section className="sop-section-block">
                          <h4 className="sop-section-label">
                            Tabel Arti 4 Status Dokumen
                          </h4>
                          <div className="sop-ref-table-wrap">
                            <table className="sop-ref-table">
                              <thead>
                                <tr>
                                  <th>Status</th>
                                  <th>Arti Status di Sistem</th>
                                  <th>Tindakan Staf Unit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chapter.statusTable.map((row) => (
                                  <tr key={row.status}>
                                    <td>
                                      <span
                                        className={`sop-status-pill is-${row.badgeTone}`}
                                      >
                                        {row.status}
                                      </span>
                                    </td>
                                    <td>{row.meaning}</td>
                                    <td>{row.action}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      {chapter.exportTable && (
                        <section className="sop-section-block">
                          <h4 className="sop-section-label">
                            Panduan Memilih Jenis Unduhan Rekap Master
                          </h4>
                          <div className="sop-ref-table-wrap">
                            <table className="sop-ref-table">
                              <thead>
                                <tr>
                                  <th>Jenis Unduhan</th>
                                  <th>Format</th>
                                  <th>Kegunaan Utama</th>
                                  <th>Cakupan Isi Berkas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chapter.exportTable.map((row) => (
                                  <tr key={row.extension}>
                                    <td>
                                      <strong>{row.label}</strong>
                                    </td>
                                    <td>
                                      <span className="sop-ext-pill">
                                        {row.extension}
                                      </span>
                                    </td>
                                    <td>{row.purpose}</td>
                                    <td>{row.contents}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      <aside
                        className="sop-mandatory-callout"
                        aria-label={chapter.mandatoryTitle}
                      >
                        <div className="sop-mandatory-head">
                          <span
                            className="sop-mandatory-mark"
                            aria-hidden="true"
                          >
                            !
                          </span>
                          <h4>{chapter.mandatoryTitle}</h4>
                        </div>
                        <ul className="sop-mandatory-list">
                          {chapter.mandatoryRules.map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      </aside>

                      <section className="sop-section-block">
                        <h4 className="sop-section-label">
                          Cara Mengatasi Kendala
                        </h4>
                        <div className="sop-fixes-grid">
                          {chapter.quickFixes.map((item, idx) => (
                            <div className="sop-fix-item" key={idx}>
                              <strong>Kendala: {item.issue}</strong>
                              <p>Solusi: {item.fix}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </article>
                ))
              )}

              <section
                id="sop-card-sop-kontak-prp"
                className="help-contact-box"
              >
                <strong>Kontak Pengelola Resmi SIPETRI</strong>
                <p>
                  {PORTAL_INSTITUTION.unitManager} ·{" "}
                  {PORTAL_INSTITUTION.institution}
                </p>
                <div className="help-contact-links">
                  <span>Email: {PORTAL_INSTITUTION.email}</span>
                  <span>Telepon: {PORTAL_INSTITUTION.phoneDisplay}</span>
                  <span>Lokasi: {PORTAL_INSTITUTION.address}</span>
                </div>
              </section>
            </div>
          </div>

          <footer className="sop-guide-footer">
            <span className="sop-guide-footer-meta">
              {PORTAL_INSTITUTION.shortName} ITPLN ·{" "}
              {PORTAL_INSTITUTION.version} · Tekan Esc untuk menutup
            </span>
            <div className="sop-guide-footer-actions">
              <button
                type="button"
                className="primary-button"
                onClick={onClose}
              >
                Tutup Panduan
              </button>
            </div>
          </footer>
        </div>

        <button
          type="button"
          className="overlay-close"
          aria-label="Tutup panduan SOP"
          onClick={onClose}
        />
      </div>

      <SopPrintPreviewModal
        role={printOpen ? effectiveRole : null}
        onClose={() => setPrintOpen(false)}
      />
    </>
  )
}
