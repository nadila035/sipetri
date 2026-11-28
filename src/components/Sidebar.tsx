import type { RefObject } from "react"
import { Icon } from "./Icon"
import { AccountMenu } from "./AccountMenu"
import type { AuthSession, IconName, NavItem } from "../types"
import { adminMenus } from "../pages/Admin"
import { useReporting } from "../ReportingContext"
import { filterRecordsForSession, getSessionLockedOrganization } from "../utils/auth"
import { getUnitAnnualPrerequisiteState } from "../utils/annualSources"
import { collectLateTriwulanItems } from "../utils/lateMonitoring"

export const navItems: NavItem[] = [
  { label: "Dashboard", icon: "grid" },
  { label: "Isi Sasaran Kinerja", icon: "target" },
  { label: "Isi Laporan Triwulan", icon: "report" },
  { label: "Monitoring Keterlambatan", icon: "alert" },
  { label: "Riwayat", icon: "history" },
]

const ADMIN_MENU_ICONS: Record<string, IconName> = {
  "Dashboard Monitoring": "chart",
  "Master Sasaran Strategis": "layers",
  "Verifikasi Sasaran Kinerja": "target",
  "Verifikasi Laporan Triwulan": "report",
  "Monitoring Keterlambatan": "alert",
  "Arsip dan Rekapitulasi": "history",
  "Periode dan Tenggat Waktu": "calendar",
}

type SidebarProps = {
  active: string
  session: AuthSession
  collapsed?: boolean
  onToggleSidebar: () => void
  collapseBtnRef?: RefObject<HTMLButtonElement | null>
  expandBtnRef?: RefObject<HTMLButtonElement | null>
  onSelectMenu: (label: string) => void
  onOpenAccountInfo: () => void
  onOpenHelp: () => void
  onLogout: () => void
}

export function Sidebar({
  active,
  session,
  collapsed = false,
  onToggleSidebar,
  collapseBtnRef,
  expandBtnRef,
  onSelectMenu,
  onOpenAccountInfo,
  onOpenHelp,
  onLogout,
}: SidebarProps) {
  const { data, nowMs } = useReporting()
  const lockedOrg = getSessionLockedOrganization(session)
  const unitRecords = filterRecordsForSession(data.records, session)

  const hasTriwulanDraft = unitRecords.some(
    (record) => record.type === "Laporan Triwulan" && record.status === "Draf",
  )
  const hasSasaranDraft = unitRecords.some(
    (record) => record.type === "Sasaran Kinerja" && record.status === "Draf",
  )

  const prereq =
    session.role === "staff"
      ? getUnitAnnualPrerequisiteState(
          data.records,
          data.year,
          lockedOrg.subUnit,
        )
      : { status: "approved" as const, canAccessTriwulan: true }

  const hasAnyApprovedAnnual =
    session.role === "staff"
      ? unitRecords.some(
          (record) =>
            record.type === "Sasaran Kinerja" && record.status === "Disetujui",
        )
      : true

  const isTriwulanNavLocked =
    session.role === "staff" && !prereq.canAccessTriwulan && !hasAnyApprovedAnnual

  const overdueCount = collectLateTriwulanItems({
    records: data.records,
    periods: data.periods,
    year: data.year,
    activeQuarter: data.quarter,
    sessionSubUnit: session.role === "staff" ? lockedOrg.subUnit : undefined,
    nowMs,
  }).filter((item) => item.lateStatus === "Terlambat").length

  const menus: NavItem[] =
    session.role === "admin"
      ? adminMenus.map((label) => ({
          label,
          icon: ADMIN_MENU_ICONS[label] ?? "grid",
        }))
      : navItems

  return (
    <aside id="app-sidebar" className="sidebar">
      <div className="brand">
        <button
          ref={expandBtnRef}
          type="button"
          className="sidebar-expand-btn"
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
          aria-label="Buka sidebar"
          title="Buka sidebar"
          onClick={onToggleSidebar}
        >
          <img
            className="sidebar-expand-logo"
            src="/logo_itpln.png"
            alt="Logo ITPLN"
            width={34}
            height={34}
          />
          <span className="sidebar-expand-icon" aria-hidden="true">
            <Icon name="sidebarOpen" size={19} />
          </span>
        </button>

        <img
          className="brand-logo"
          src="/logo_itpln.png"
          alt="Logo ITPLN"
          width={34}
          height={34}
        />
        <div className="brand-copy">
          <div className="brand-name">SIPETRI</div>
          <div className="brand-subtitle">Sistem Pelaporan Triwulan</div>
        </div>
        <button
          ref={collapseBtnRef}
          type="button"
          className="sidebar-collapse-btn"
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
          aria-label="Tutup sidebar"
          title="Tutup sidebar"
          onClick={onToggleSidebar}
        >
          <span className="sidebar-collapse-icon-idle" aria-hidden="true">
            <Icon name="sidebarPanel" size={18} />
          </span>
          <span className="sidebar-collapse-icon-hover" aria-hidden="true">
            <Icon name="sidebarClose" size={18} />
          </span>
        </button>
      </div>

      <div className="sidebar-body">
        <nav className="side-nav" aria-label="Menu utama">
          {menus.map((item) => {
            const isLockedTriwulan =
              item.label === "Isi Laporan Triwulan" && isTriwulanNavLocked
            const showIndicatorDot =
              session.role === "staff" &&
              !isLockedTriwulan &&
              ((item.label === "Isi Laporan Triwulan" && hasTriwulanDraft) ||
                (item.label === "Isi Sasaran Kinerja" && hasSasaranDraft))
            const showLateBadge =
              item.label === "Monitoring Keterlambatan" && overdueCount > 0

            const lockTooltip = `Terkunci: Selesaikan dan dapatkan persetujuan (ACC) Sasaran Kinerja Tahun ${data.year} terlebih dahulu.`

            return (
              <button
                key={item.label}
                type="button"
                disabled={isLockedTriwulan}
                aria-label={
                  isLockedTriwulan ? `${item.label} (${lockTooltip})` : item.label
                }
                aria-current={active === item.label ? "page" : undefined}
                title={isLockedTriwulan ? lockTooltip : item.label}
                className={[
                  "nav-item",
                  active === item.label && "active",
                  isLockedTriwulan && "is-locked-nav",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  if (isLockedTriwulan) return
                  onSelectMenu(item.label)
                }}
              >
                <Icon name={isLockedTriwulan ? "lock" : item.icon} />
                <span className="nav-item-label">{item.label}</span>
                {isLockedTriwulan && (
                  <span className="nav-lock-pill" aria-hidden="true">
                    Terkunci
                  </span>
                )}
                {showLateBadge && (
                  <span
                    className="nav-count-badge"
                    aria-label={`${overdueCount} item tertunggak`}
                  >
                    {overdueCount}
                  </span>
                )}
                {showIndicatorDot && (
                  <span className="nav-dot" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <AccountMenu
        session={session}
        variant="sidebar"
        onOpenAccountInfo={onOpenAccountInfo}
        onOpenHelp={onOpenHelp}
        onLogout={onLogout}
      />
    </aside>
  )
}
export default Sidebar
