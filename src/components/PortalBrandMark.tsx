export function PortalBrandMark({
  variant = "hero",
}: {
  variant?: "hero" | "header"
}) {
  if (variant === "header") {
    return (
      <span className="portal-brand-sipetri" aria-label="SIPETRI">
        <svg
          width="32"
          height="32"
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="sipetriBadgeHdr"
              x1="4"
              y1="4"
              x2="36"
              y2="36"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#153a80" />
              <stop offset="100%" stopColor="#2864ca" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill="url(#sipetriBadgeHdr)" />
          <rect x="9" y="22" width="4" height="9" rx="1.5" fill="#bfdbfe" />
          <rect x="15" y="18" width="4" height="13" rx="1.5" fill="#dbeafe" />
          <rect x="21" y="14" width="4" height="17" rx="1.5" fill="#ffffff" />
          <rect x="27" y="9" width="4" height="22" rx="1.5" fill="#f9bd4f" />
        </svg>
        <span className="portal-brand-sipetri-text">
          <strong>SIPETRI</strong>
          <small>Pelaporan Triwulan</small>
        </span>
      </span>
    )
  }

  return (
    <div
      className="portal-hero-brand"
      aria-label="SIPETRI - Sistem Pelaporan Triwulan Institut Teknologi PLN"
    >
      <div className="portal-hero-emblem" aria-hidden="true">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <defs>
            <linearGradient
              id="sipetriBadgeHero"
              x1="4"
              y1="4"
              x2="52"
              y2="52"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#153a80" />
              <stop offset="100%" stopColor="#2864ca" />
            </linearGradient>
          </defs>
          <rect width="56" height="56" rx="14" fill="url(#sipetriBadgeHero)" />
          <rect x="12" y="31" width="6" height="13" rx="2" fill="#bfdbfe" />
          <rect x="20.5" y="25" width="6" height="19" rx="2" fill="#dbeafe" />
          <rect x="29" y="19" width="6" height="25" rx="2" fill="#ffffff" />
          <rect x="37.5" y="12" width="6" height="32" rx="2" fill="#f9bd4f" />
        </svg>
      </div>
      <div className="portal-hero-wordmark">
        <span className="portal-hero-word">SIPETRI</span>
        <span className="portal-hero-sub">
          SISTEM PELAPORAN TRIWULAN · ITPLN
        </span>
      </div>
    </div>
  )
}
export default PortalBrandMark
