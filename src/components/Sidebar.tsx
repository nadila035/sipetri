import type { RefObject } from "react"
import { Icon } from "./Icon"
import { AccountMenu } from "./AccountMenu"
import type { AuthSession, NavItem } from "../types"
import { adminMenus } from "../pages/Admin"
import { useReporting } from "../ReportingContext"
import { filterRecordsForSession } from "../utils/auth"

export const navItems: NavItem[] = [
  { label: "Dashboard", icon: "grid" },
  { label: "Isi Laporan Triwulan", icon: "report" },
  { label: "Isi Sasaran Kinerja", icon: "target" },
  { label: "Riwayat", icon: "history" },
]

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
  const { data } = useReporting()
  const unitRecords = filterRecordsForSession(data.records, session)
  const hasTriwulanDraft = unitRecords.some(
    (record) => record.type === "Laporan Triwulan" && record.status === "Draf",
  )
  const hasSasaranDraft = unitRecords.some(
    (record) => record.type === "Sasaran Kinerja" && record.status === "Draf",
  )
  const menus: NavItem[] =
    session.role === "admin"
      ? adminMenus.map((label, i) => ({
        label,
        icon:
          (["chart", "report", "target", "history", "calendar"] as const)[
          i
          ] ?? "grid",
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
            const showIndicatorDot =
              session.role === "staff" &&
              ((item.label === "Isi Laporan Triwulan" && hasTriwulanDraft) ||
                (item.label === "Isi Sasaran Kinerja" && hasSasaranDraft))
            return (
              <button
                key={item.label}
                aria-label={item.label}
                aria-current={active === item.label ? "page" : undefined}
                title={item.label}
                className={
                  active === item.label ? "nav-item active" : "nav-item"
                }
                onClick={() => onSelectMenu(item.label)}
              >
                <Icon name={item.icon} />
                <span className="nav-item-label">{item.label}</span>
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
