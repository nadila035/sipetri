import type { AppNotification, AuthSession } from "../types"
import { getSessionLockedOrganization } from "../utils/auth"
import { AccountMenu } from "./AccountMenu"
import { AdminNotifications } from "./AdminNotifications"
import { Icon } from "./Icon"
import { StaffNotifications } from "./StaffNotifications"

type HeaderProps = {
  active: string
  session: AuthSession
  onOpenHistory: () => void
  onSelectStaffNotification?: (notification: AppNotification) => void
  onOpenAdminRecord?: (menu: string, recordId: string) => void
  onOpenBroadcast?: () => void
  onOpenAccountInfo: () => void
  onOpenHelp: () => void
  onLogout: () => void
}

export function Header({
  active,
  session,
  onOpenHistory,
  onSelectStaffNotification,
  onOpenAdminRecord,
  onOpenBroadcast,
  onOpenAccountInfo,
  onOpenHelp,
  onLogout,
}: HeaderProps) {
  const role = session.role
  const title = role === "staff" && active === "Riwayat" ? "Riwayat Dokumen" : active
  const lockedOrg = getSessionLockedOrganization(session)
  const unitTag =
    role === "admin"
      ? `${session.displayName} (Semua Unit)`
      : `Unit Terkunci: ${lockedOrg.unitLabel}`
  const staffBreadcrumb =
    active === "Dashboard"
      ? `Ringkasan kinerja · ${unitTag}`
      : active === "Isi Laporan Triwulan"
        ? `Beranda / Pelaporan Triwulan · ${unitTag}`
        : active === "Isi Sasaran Kinerja"
          ? `Beranda / Perencanaan Tahunan · ${unitTag}`
          : active === "Monitoring Keterlambatan"
            ? `Beranda / Riwayat Keterlambatan · ${unitTag}`
            : active === "Riwayat"
              ? `Beranda / Arsip Unit · ${unitTag}`
              : `Beranda / ${title}`
  const adminBreadcrumb =
    active === "Dashboard Monitoring"
      ? "Ringkasan pemantauan institusi"
      : active === "Master Sasaran Strategis"
        ? "Beranda / Master Data Renbang & PRP"
        : active === "Verifikasi Laporan Triwulan"
          ? "Beranda / Laporan Triwulan"
          : active === "Verifikasi Sasaran Kinerja"
            ? "Beranda / Sasaran Kinerja"
            : active === "Monitoring Keterlambatan"
              ? "Beranda / Rekap Triwulan Tertunggak"
              : active === "Arsip dan Rekapitulasi"
                ? "Beranda / Arsip"
                : active === "Periode dan Tenggat Waktu"
                  ? "Beranda / Pengaturan Periode"
                  : `Beranda / ${title}`
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <div className="page-title">{title}</div>
        <div className="breadcrumb">
          {role === "staff" ? staffBreadcrumb : adminBreadcrumb}
        </div>
      </div>
      <div className="topbar-actions">
        {role === "admin" && onOpenBroadcast && (
          <button
            type="button"
            className="topbar-broadcast-btn"
            aria-label="Kirim pengingat realtime"
            title="Kirim pengingat realtime ke unit"
            onClick={onOpenBroadcast}
          >
            <Icon name="broadcast" size={17} />
          </button>
        )}
        {role === "admin" ? (
          <AdminNotifications onSelectRecord={onOpenAdminRecord} />
        ) : (
          <StaffNotifications
            onSelectNotification={onSelectStaffNotification}
            onOpenHistory={onOpenHistory}
          />
        )}
        <AccountMenu
          session={session}
          variant="topbar"
          onOpenAccountInfo={onOpenAccountInfo}
          onOpenHelp={onOpenHelp}
          onLogout={onLogout}
        />
      </div>
    </header>
  )
}
export default Header
