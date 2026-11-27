import { useEffect, useMemo, useRef, useState } from "react"
import { PortalBrandMark } from "../components/PortalBrandMark"
import { unitOptions } from "../utils/organizations"
import { useDialog } from "../utils/useDialog"
import { usePortalMotion } from "../utils/useMotion"
import {
  PORTAL_FAQ_CATEGORIES,
  PORTAL_FEATURED_ACCESS,
  PORTAL_GOVERNANCE_FACTS,
  PORTAL_GOVERNANCE_POINTS,
  PORTAL_INSTITUTION,
  PORTAL_NAV_LINKS,
  PORTAL_SERVICE_CARDS,
  PORTAL_SUPPORT_LINKS,
  type PortalLinkCard,
} from "./portalContent"
import "./portal.css"

function PortalGlyph({
  name,
  size = 20,
}: {
  name:
  | "globe"
  | "lock"
  | "user"
  | "report"
  | "grid"
  | "mail"
  | "phone"
  | "arrowUpRight"
  | "arrowRight"
  | "chevronDown"
  | "chevronRight"
  | "menu"
  | "mapPin"
  | "arrowUp"
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "globe" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18" />
        </>
      )}
      {name === "lock" && (
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      )}
      {name === "user" && (
        <>
          <circle cx="12" cy="7" r="4" />
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        </>
      )}
      {name === "report" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </>
      )}
      {name === "grid" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
      {name === "mail" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      )}
      {name === "phone" && (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92Z" />
      )}
      {name === "arrowUpRight" && <path d="M7 17 17 7M8 7h9v9" />}
      {name === "arrowRight" && <path d="M5 12h14M13 6l6 6-6 6" />}
      {name === "chevronDown" && <path d="m6 9 6 6 6-6" />}
      {name === "chevronRight" && <path d="m9 18 6-6-6-6" />}
      {name === "menu" && <path d="M4 7h16M4 12h16M4 17h16" />}
      {name === "mapPin" && (
        <>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </>
      )}
      {name === "arrowUp" && <path d="M12 19V5M5 12l7-7 7 7" />}
    </svg>
  )
}

function PortalUnitsModal({
  open,
  onClose,
  onEnterLogin,
}: {
  open: boolean
  onClose: () => void
  onEnterLogin: () => void
}) {
  const [query, setQuery] = useState("")
  useDialog(open, onClose, ".portal-units-modal")

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.entries(unitOptions)
      .map(([parent, children]) => ({
        parent,
        units: children.length ? children : [parent],
      }))
      .filter((group) => {
        if (!q) return true
        return (
          group.parent.toLowerCase().includes(q) ||
          group.units.some((u) => u.toLowerCase().includes(q))
        )
      })
  }, [query])

  if (!open) return null

  return (
    <div
      className="portal-modal-overlay portal-units-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-units-title"
    >
      <div className="portal-modal-dialog">
        <div className="portal-modal-head">
          <div>
            <h2 id="portal-units-title">Direktori 42 Unit Kerja Pelapor</h2>
            <p>
              Daftar struktur fakultas, bidang, biro, dan lembaga pelapor di
              Institut Teknologi PLN.
            </p>
          </div>
          <button
            type="button"
            className="portal-modal-close"
            aria-label="Tutup direktori unit"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="portal-modal-body">
          <input
            type="search"
            className="portal-unit-search"
            aria-label="Cari nama fakultas, bidang, atau unit kerja"
            placeholder="Cari unit (contoh: FKET, BPK, LPPM, Rektorat)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {groups.length === 0 ? (
            <p style={{ margin: "12px 0", color: "#475569", fontSize: 14 }}>
              Unit kerja dengan kata kunci "{query}" tidak ditemukan.
            </p>
          ) : (
            <div className="portal-unit-groups">
              {groups.map((group) => (
                <div className="portal-unit-group-card" key={group.parent}>
                  <strong>{group.parent}</strong>
                  <div className="portal-unit-tags">
                    {group.units.map((unit) => (
                      <span className="portal-unit-tag" key={unit}>
                        {unit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="portal-modal-foot">
          <span>Total terpetakan: 42 unit kerja</span>
          <div className="portal-modal-foot-actions">
            <button
              type="button"
              className="portal-modal-sec-btn"
              onClick={onClose}
            >
              Tutup
            </button>
            <button
              type="button"
              className="portal-modal-pri-btn"
              onClick={() => {
                onClose()
                onEnterLogin()
              }}
            >
              Masuk Aplikasi
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup jendela direktori unit"
        onClick={onClose}
      />
    </div>
  )
}

export function PortalPage({ onEnterLogin }: { onEnterLogin: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [activeNav, setActiveNav] = useState("beranda")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)
  const [unitsModalOpen, setUnitsModalOpen] = useState(false)

  usePortalMotion(rootRef)
  useDialog(mobileMenuOpen, () => setMobileMenuOpen(false), ".portal-mobile-drawer")

  useEffect(() => {
    const updateScrollState = () => {
      const y = window.scrollY
      setScrolled(y > 100)

      const probe = y + 200
      let matched = "beranda"
      for (const nav of PORTAL_NAV_LINKS) {
        const el = document.getElementById(nav.id)
        if (!el) continue
        if (probe >= el.offsetTop && probe <= el.offsetTop + el.offsetHeight) {
          matched = nav.id
        }
      }
      setActiveNav(matched)
    }

    updateScrollState()
    window.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("load", updateScrollState)
    return () => {
      window.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("load", updateScrollState)
    }
  }, [])

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false)
    if (sectionId === "beranda") {
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    const target = document.getElementById(sectionId)
    if (!target) return
    const headerHeight =
      document.querySelector<HTMLElement>(".portal-header")?.offsetHeight ?? 76
    const top = Math.max(0, target.offsetTop - headerHeight + 4)
    window.scrollTo({ top, behavior: "smooth" })
  }

  const openUnitsModal = () => {
    setMobileMenuOpen(false)
    setUnitsModalOpen(true)
  }

  const renderLinkCard = (card: PortalLinkCard) => {
    const isExternal = card.kind === "external"
    const content = (
      <>
        <span className="portal-link-icon" aria-hidden="true">
          <PortalGlyph name={card.icon} size={22} />
        </span>
        <span className="portal-link-copy">
          <strong>{card.title}</strong>
          <span>{card.description}</span>
        </span>
        <span className="portal-link-arrow" aria-hidden="true">
          <PortalGlyph
            name={isExternal ? "arrowUpRight" : "chevronRight"}
            size={16}
          />
        </span>
      </>
    )

    if (card.kind === "external" || card.kind === "mailto" || card.kind === "tel") {
      return (
        <a
          key={card.id}
          href={card.href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="portal-link-card"
          data-portal-reveal="card"
          data-reveal-delay={card.delayMs}
        >
          {content}
        </a>
      )
    }

    return (
      <button
        key={card.id}
        type="button"
        className="portal-link-card"
        data-portal-reveal="card"
        data-reveal-delay={card.delayMs}
        onClick={() => {
          if (card.kind === "login") onEnterLogin()
          else if (card.kind === "section" && card.href)
            scrollToSection(card.href.replace(/^#/, ""))
          else if (card.kind === "modal-units") openUnitsModal()
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="portal-page" ref={rootRef}>
      <header
        className={scrolled ? "portal-header is-scrolled" : "portal-header"}
      >
        <div className="portal-container portal-header-inner">
          <div className="portal-header-brand">
            <a
              href="#beranda"
              className="portal-brand-logo-link"
              title="SIPETRI Institut Teknologi PLN"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection("beranda")
              }}
            >
              <img src="/logo-itpln.png" alt="Institut Teknologi PLN" />
            </a>
            <span className="portal-brand-divider" aria-hidden="true" />
            <PortalBrandMark variant="header" />
          </div>

          <nav className="portal-nav" aria-label="Navigasi Portal">
            <ul className="portal-nav-list">
              {PORTAL_NAV_LINKS.map((item) => (
                <li className="portal-nav-item" key={item.id}>
                  <a
                    href={item.href}
                    className={
                      activeNav === item.id
                        ? "portal-nav-link is-active"
                        : "portal-nav-link"
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToSection(item.id)
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className="portal-mobile-toggle"
            aria-label="Buka menu navigasi"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <PortalGlyph name="menu" size={20} />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="portal-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi Portal"
        >
          <div className="portal-mobile-drawer-head">
            <span style={{ fontWeight: 800, color: "#162a52", fontSize: 16 }}>
              Navigasi Portal SIPETRI
            </span>
            <button
              type="button"
              className="portal-mobile-close"
              aria-label="Tutup menu navigasi"
              onClick={() => setMobileMenuOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="portal-mobile-card">
            {PORTAL_NAV_LINKS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="portal-mobile-link"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection(item.id)
                }}
              >
                {item.label}
              </a>
            ))}

            <button
              type="button"
              className="portal-mobile-link"
              onClick={openUnitsModal}
            >
              Daftar 42 Unit Kerja
            </button>

            <button
              type="button"
              className="portal-btn-primary"
              style={{ marginTop: 10, width: "100%" }}
              onClick={() => {
                setMobileMenuOpen(false)
                onEnterLogin()
              }}
            >
              <PortalGlyph name="user" size={17} />
              <span>Masuk Aplikasi</span>
            </button>
          </div>
        </div>
      )}

      <main>
        {/* 1. Hero Section (campus photo + SIPETRI narrative & actions) */}
        <section id="beranda" className="portal-hero">
          <img
            src="/gedung-itpln.jpg"
            alt=""
            aria-hidden="true"
            className="portal-hero-bg"
          />
          <div className="portal-hero-scrim" aria-hidden="true" />
          <div className="portal-container portal-hero-grid">
            <div className="portal-hero-copy">
              <h1 className="portal-hero-title">
                Portal Pelaporan Kinerja ITPLN
              </h1>

              <p className="portal-hero-desc">
                Ruang kerja resmi setiap unit untuk menyusun Sasaran Kinerja
                Tahunan (RKA), melaporkan capaian Triwulan I hingga IV, dan
                menindaklanjuti verifikasi Admin PRP.
              </p>

              <div className="portal-hero-actions">
                <button
                  type="button"
                  className="portal-btn-primary"
                  onClick={onEnterLogin}
                >
                  <PortalGlyph name="user" size={17} />
                  <span>Masuk Aplikasi</span>
                </button>

                <button
                  type="button"
                  className="portal-btn-secondary"
                  onClick={openUnitsModal}
                >
                  <PortalGlyph name="grid" size={17} />
                  <span>Daftar 42 Unit</span>
                </button>

                <a
                  href="#contact"
                  className="portal-btn-help"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection("contact")
                  }}
                >
                  <span className="portal-btn-help-icon" aria-hidden="true">
                    <PortalGlyph name="phone" size={16} />
                  </span>
                  <span>Kontak PRP</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Akses Cepat Portal (featured login card + supporting 2x2 cards with sheen sweep) */}
        <section id="tautan" className="portal-links-section">
          <div className="portal-container">
            <div className="portal-head-left" data-portal-reveal="section">
              <span className="portal-kicker">Akses Cepat Portal</span>
              <h2>Pintu Masuk & Informasi Utama</h2>
              <p>
                Pilih gerbang login aplikasi, layanan pelaporan, direktori unit
                pelapor, atau saluran resmi Institut Teknologi PLN.
              </p>
            </div>

            <div className="portal-access-grid">
              <button
                type="button"
                className="portal-link-card portal-link-card--featured"
                data-portal-reveal="card"
                data-reveal-delay={PORTAL_FEATURED_ACCESS.delayMs}
                onClick={onEnterLogin}
              >
                <span className="portal-link-icon" aria-hidden="true">
                  <PortalGlyph name="lock" size={26} />
                </span>
                <span className="portal-link-copy">
                  <strong>{PORTAL_FEATURED_ACCESS.title}</strong>
                  <span>{PORTAL_FEATURED_ACCESS.description}</span>
                </span>
                <span className="portal-featured-cta">
                  <span>Buka Halaman Login</span>
                  <PortalGlyph name="arrowRight" size={16} />
                </span>
              </button>

              <div className="portal-group-grid-double">
                {PORTAL_SUPPORT_LINKS.map(renderLinkCard)}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Alur & Layanan (institutional overview without combining Admin & Staff guides/SOP) */}
        <section id="layanan" className="portal-workflow-section">
          <div className="portal-container">
            <div
              className="portal-workflow-header"
              data-portal-reveal="section"
            >
              <div className="portal-head-left">
                <span className="portal-kicker">Alur & Layanan</span>
                <h2>Siklus Pelaporan Kinerja SIPETRI</h2>
                <p>
                  Layanan terpadu pelaporan kinerja tahunan dan triwulanan.
                  Panduan dan SOP khusus peran tersedia di menu profil setelah
                  masuk ke akun masing-masing.
                </p>
              </div>
            </div>

            <div className="portal-workflow-grid">
              {PORTAL_SERVICE_CARDS.map((card, idx) => (
                <article
                  key={card.title}
                  className="portal-step-card"
                  data-portal-reveal="card"
                  data-reveal-delay={(idx + 1) * 50}
                >
                  <span className="portal-step-num" aria-hidden="true">
                    0{idx + 1}
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </article>
              ))}
            </div>

            <div className="portal-workflow-bar" data-portal-reveal="section">
              <p>
                Panduan operasional dan SOP PDF tersedia khusus di menu profil
                akun Staf Unit maupun Admin PRP setelah login.
              </p>
              <div className="portal-workflow-bar-actions">
                <button
                  type="button"
                  className="portal-bar-btn"
                  onClick={openUnitsModal}
                >
                  <PortalGlyph name="grid" size={16} />
                  <span>Daftar 42 Unit</span>
                </button>
                <a
                  href={`mailto:${PORTAL_INSTITUTION.email}?subject=${encodeURIComponent("Koordinasi Akun atau Jadwal SIPETRI")}`}
                  className="portal-bar-btn"
                >
                  <PortalGlyph name="mail" size={16} />
                  <span>Email Pengelola</span>
                </a>
                <button
                  type="button"
                  className="portal-bar-btn portal-bar-btn-primary"
                  onClick={onEnterLogin}
                >
                  <span>Masuk SIPETRI</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Frequently Asked Questions (smooth 0.35s accordion preserved) */}
        <section id="faq" className="portal-faq-section">
          <div className="portal-container">
            <div className="portal-head-left" data-portal-reveal="section">
              <span className="portal-kicker">Pertanyaan Umum</span>
              <h2>Frequently Asked Questions</h2>
              <p>
                Jawaban ringkas mengenai pengisian Sasaran Kinerja Tahunan
                (RKA), Laporan Realisasi Triwulan, alur revisi, dan batas waktu.
              </p>
            </div>

            <div className="portal-faq-groups">
              {PORTAL_FAQ_CATEGORIES.map((category) => (
                <div key={category.title}>
                  <h3
                    className="portal-faq-category-title"
                    data-portal-reveal="section"
                  >
                    {category.title}
                  </h3>
                  <ul className="portal-faq-list">
                    {category.items.map((item, idx) => {
                      const isOpen = openFaqId === item.id
                      const panelId = `${item.id}-panel`
                      return (
                        <li
                          key={item.id}
                          className={`portal-accordion-item${isOpen ? " is-open" : ""}`}
                          data-portal-reveal="card"
                          data-reveal-delay={(idx + 1) * 50}
                        >
                          <button
                            type="button"
                            className="portal-accordion-trigger"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() =>
                              setOpenFaqId(isOpen ? null : item.id)
                            }
                          >
                            <span
                              className="portal-accordion-qmark"
                              aria-hidden="true"
                            >
                              ?
                            </span>
                            <span className="portal-accordion-label">
                              {item.question}
                            </span>
                            <span
                              className="portal-accordion-chevron"
                              aria-hidden="true"
                            >
                              <PortalGlyph name="chevronDown" size={18} />
                            </span>
                          </button>

                          <div
                            id={panelId}
                            className="portal-accordion-panel"
                            aria-hidden={!isOpen}
                          >
                            <div className="portal-accordion-panel-inner">
                              <div className="portal-accordion-body">
                                <p>{item.answer}</p>
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Tata Kelola & Kontak Institusi (authentic ITPLN split layout) */}
        <section id="contact" className="portal-contact-band">
          <div className="portal-container">
            <div
              className="portal-governance-strip"
              data-portal-reveal="section"
            >
              <div className="portal-governance-copy">
                <span className="portal-kicker">Komitmen Tata Kelola</span>
                <h2>Standar Akuntabilitas Kinerja Unit ITPLN</h2>
                <ul className="portal-governance-list">
                  {PORTAL_GOVERNANCE_POINTS.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="portal-governance-facts">
                {PORTAL_GOVERNANCE_FACTS.map((fact) => (
                  <div className="portal-fact-box" key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="portal-contact-shell" data-portal-reveal="card">
              <div className="portal-campus-panel">
                <img
                  src="/gedung-itpln.jpg"
                  alt="Gedung Menara PLN Kampus Institut Teknologi PLN"
                  className="portal-campus-photo"
                />
                <div className="portal-campus-scrim" aria-hidden="true" />
                <div className="portal-campus-overlay">
                  <span className="portal-campus-kicker">
                    Lokasi Kampus Utama
                  </span>
                  <h3>{PORTAL_INSTITUTION.institution}</h3>
                  <p>{PORTAL_INSTITUTION.address}</p>
                  <div className="portal-location-buttons">
                    <a
                      href={PORTAL_INSTITUTION.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="portal-map-btn"
                    >
                      <PortalGlyph name="mapPin" size={15} />
                      <span>Buka Google Maps</span>
                    </a>
                    <a
                      href={PORTAL_INSTITUTION.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="portal-map-btn portal-map-btn-ghost"
                    >
                      <span>itpln.ac.id</span>
                      <PortalGlyph name="arrowUpRight" size={15} />
                    </a>
                  </div>
                </div>
              </div>

              <div className="portal-contact-panel">
                <div>
                  <div className="portal-contact-panel-head">
                    <img src="/logo_itpln.png" alt="Logo ITPLN" />
                    <div>
                      <strong>{PORTAL_INSTITUTION.unitManager}</strong>
                      <span>Pengelola Portal {PORTAL_INSTITUTION.shortName}</span>
                    </div>
                  </div>
                </div>

                <div className="portal-contact-info-list">
                  <div className="portal-contact-row">
                    <span
                      className="portal-contact-row-icon"
                      aria-hidden="true"
                    >
                      <PortalGlyph name="mapPin" size={18} />
                    </span>
                    <div className="portal-contact-row-copy">
                      <span>Alamat</span>
                      <strong>{PORTAL_INSTITUTION.address}</strong>
                    </div>
                  </div>

                  <a
                    href={`mailto:${PORTAL_INSTITUTION.email}`}
                    className="portal-contact-row"
                  >
                    <span
                      className="portal-contact-row-icon"
                      aria-hidden="true"
                    >
                      <PortalGlyph name="mail" size={18} />
                    </span>
                    <div className="portal-contact-row-copy">
                      <span>Email Resmi</span>
                      <strong>{PORTAL_INSTITUTION.email}</strong>
                    </div>
                  </a>

                  <a
                    href={PORTAL_INSTITUTION.phoneHref}
                    className="portal-contact-row"
                  >
                    <span
                      className="portal-contact-row-icon"
                      aria-hidden="true"
                    >
                      <PortalGlyph name="phone" size={18} />
                    </span>
                    <div className="portal-contact-row-copy">
                      <span>Telepon Kantor</span>
                      <strong>{PORTAL_INSTITUTION.phoneDisplay}</strong>
                    </div>
                  </a>

                  <a
                    href={PORTAL_INSTITUTION.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-contact-row"
                  >
                    <span
                      className="portal-contact-row-icon"
                      aria-hidden="true"
                    >
                      <PortalGlyph name="globe" size={18} />
                    </span>
                    <div className="portal-contact-row-copy">
                      <span>Website Institusi</span>
                      <strong>{PORTAL_INSTITUTION.websiteDisplay}</strong>
                    </div>
                  </a>
                </div>

                <div className="portal-contact-cta-row">
                  <button
                    type="button"
                    className="portal-btn-primary"
                    onClick={onEnterLogin}
                  >
                    <PortalGlyph name="user" size={17} />
                    <span>Masuk Aplikasi</span>
                  </button>
                  <a
                    href={`mailto:${PORTAL_INSTITUTION.email}?subject=Informasi%20SIPETRI%20ITPLN`}
                    className="portal-bar-btn"
                  >
                    <PortalGlyph name="mail" size={16} />
                    <span>Kirim Email Resmi</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="portal-footer">
        <div className="portal-container portal-footer-inner">
          <span>
            © 2026 {PORTAL_INSTITUTION.shortName} ·{" "}
            {PORTAL_INSTITUTION.institution}
          </span>
          <span>{PORTAL_INSTITUTION.version}</span>
        </div>
      </footer>

      <button
        type="button"
        className={
          scrolled
            ? "portal-back-to-top is-visible"
            : "portal-back-to-top"
        }
        aria-label="Kembali ke atas halaman"
        onClick={() => scrollToSection("beranda")}
      >
        <PortalGlyph name="arrowUp" size={20} />
      </button>

      <PortalUnitsModal
        open={unitsModalOpen}
        onClose={() => setUnitsModalOpen(false)}
        onEnterLogin={onEnterLogin}
      />
    </div>
  )
}

export default PortalPage
