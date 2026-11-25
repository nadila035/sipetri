import { useEffect, useRef, useState } from "react"
import { confirmNavigation } from "./utils/useUnsavedChanges"
import { refreshScrollLayout, usePageMotion } from "./utils/useMotion"
import { Icon } from "./components/Icon"
import { Sidebar } from "./components/Sidebar"
import { Header } from "./components/Header"
import { AccountInfoModal, HelpGuideModal } from "./components/AccountModals"
import { Dashboard } from "./pages/Dashboard"
import { InputLaporanTriwulan } from "./pages/InputLaporanTriwulan"
import { InputSasaranKinerja } from "./pages/InputSasaranKinerja"
import { RiwayatLaporan, initialHistory } from "./pages/RiwayatLaporan"
import { LoginPage } from "./pages/LoginPage"
import { PortalPage } from "./pages/PortalPage"
import { AuthProvider, useAuth } from "./AuthContext"
import { ReportingProvider, useReporting } from "./ReportingContext"
import { Admin } from "./pages/Admin"
import {
  AdminReminderModal,
  type ReminderPresetRequest,
} from "./components/AdminReminderCenter"
import { StaffReminderBanner } from "./components/StaffReminderBanner"
import {
  acknowledgeStoredNotifications,
  isAdminReminderActive,
  NOTIFICATION_CATEGORY_LABELS,
} from "./utils/notifications"
import { localNotificationTransport } from "./utils/notificationTransport"
import { canNotificationReachSession, getUserReadStorageKey } from "./utils/auth"
import type {
  AppNotification,
  AuthSession,
  HistoryRecord,
  HistoryStatus,
  NoticeTone,
  NotificationPriority,
  NotificationTargetScope,
  NotifyFn,
} from "./types"

type NoticeState = {
  message: string
  tone: NoticeTone
  targetMenu?: string
  priority?: NotificationPriority
}

type ViewportMode = "desktop" | "tablet" | "mobile"

const SIDEBAR_STORAGE_KEY = "sipetri-sidebar-collapsed-v1"

function readViewportMode(): ViewportMode {
  if (typeof window === "undefined") return "desktop"
  if (window.matchMedia("(max-width: 760px)").matches) return "mobile"
  if (window.matchMedia("(max-width: 1000px)").matches) return "tablet"
  return "desktop"
}

function readInitialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function AppWorkspace({
  session,
  onLogout,
}: {
  session: AuthSession
  onLogout: () => void
}) {
  const { data, setData } = useReporting()
  const role = session.role
  const [active, setActive] = useState(
    role === "admin" ? "Dashboard Monitoring" : "Dashboard",
  )
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "Semua" | HistoryStatus
  >("Semua")
  const [historySession, setHistorySession] = useState(0)
  const [adminRecordRequest, setAdminRecordRequest] = useState<{
    id: string
    seq: number
  } | null>(null)
  const [staffRecordRequest, setStaffRecordRequest] = useState<{
    id: string
    seq: number
    revise?: boolean
  } | null>(null)
  const [accountInfoOpen, setAccountInfoOpen] = useState(false)
  const [helpGuideOpen, setHelpGuideOpen] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastPreset, setBroadcastPreset] =
    useState<ReminderPresetRequest>(null)
  const [viewportMode, setViewportMode] =
    useState<ViewportMode>(readViewportMode)
  const [desktopCollapsed, setDesktopCollapsed] = useState(
    readInitialSidebarCollapsed,
  )
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false)
  const seenNotificationIdsRef = useRef<Set<string> | null>(null)
  const collapseBtnRef = useRef<HTMLButtonElement>(null)
  const expandBtnRef = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(false)
  const content = useRef<HTMLDivElement>(null)
  usePageMotion(content, `${session.userId}:${role}:${active}`)

  useEffect(() => {
    if (typeof window === "undefined") return
    const mobileQuery = window.matchMedia("(max-width: 760px)")
    const tabletQuery = window.matchMedia("(max-width: 1000px)")
    const syncViewportMode = () => {
      const next = readViewportMode()
      setViewportMode(next)
      if (next !== "tablet") {
        setTabletDrawerOpen(false)
      }
    }
    syncViewportMode()
    mobileQuery.addEventListener("change", syncViewportMode)
    tabletQuery.addEventListener("change", syncViewportMode)
    return () => {
      mobileQuery.removeEventListener("change", syncViewportMode)
      tabletQuery.removeEventListener("change", syncViewportMode)
    }
  }, [])

  useEffect(() => {
    if (viewportMode !== "tablet" || !tabletDrawerOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      event.preventDefault()
      setTabletDrawerOpen(false)
      requestAnimationFrame(() => expandBtnRef.current?.focus())
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [tabletDrawerOpen, viewportMode])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (viewportMode !== "desktop") return
    const timer = window.setTimeout(() => {
      refreshScrollLayout()
    }, 240)
    return () => window.clearTimeout(timer)
  }, [desktopCollapsed, viewportMode])

  const isSidebarOpen =
    viewportMode === "desktop"
      ? !desktopCollapsed
      : viewportMode === "tablet"
        ? tabletDrawerOpen
        : true
  const isSidebarCollapsed = viewportMode !== "mobile" && !isSidebarOpen

  const handleToggleSidebar = () => {
    const activeEl = document.activeElement
    const wasCollapseBtn = activeEl === collapseBtnRef.current
    const wasExpandBtn = activeEl === expandBtnRef.current
    const focusTargetAfterToggle = (opening: boolean) => {
      if (!wasCollapseBtn && !wasExpandBtn) return
      requestAnimationFrame(() => {
        if (opening) {
          collapseBtnRef.current?.focus()
        } else {
          expandBtnRef.current?.focus()
        }
      })
    }

    if (viewportMode === "desktop") {
      const nextCollapsed = !desktopCollapsed
      setDesktopCollapsed(nextCollapsed)
      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          nextCollapsed ? "1" : "0",
        )
      } catch {
        // Abaikan jika penyimpanan lokal dibatasi.
      }
      focusTargetAfterToggle(!nextCollapsed)
    } else if (viewportMode === "tablet") {
      const nextOpen = !tabletDrawerOpen
      setTabletDrawerOpen(nextOpen)
      focusTargetAfterToggle(nextOpen)
    }
  }

  const notify: NotifyFn = (message, tone = "success") => {
    setNotice(message ? { message, tone } : null)
  }

  useEffect(() => {
    const list = data.notifications ?? []
    if (seenNotificationIdsRef.current === null) {
      seenNotificationIdsRef.current = new Set(list.map((item) => item.id))
      return
    }
    const incoming = list.filter(
      (item) =>
        canNotificationReachSession(item, session) &&
        !item.read &&
        (item.category !== "admin_reminder" || isAdminReminderActive(item)) &&
        !seenNotificationIdsRef.current!.has(item.id),
    )
    if (incoming.length === 0) return
    for (const item of incoming) {
      seenNotificationIdsRef.current.add(item.id)
    }
    const latest = incoming[0]
    const senderLabel = role === "staff" ? "Admin" : "Staf"
    const categoryLabel = NOTIFICATION_CATEGORY_LABELS[latest.category]
    const summary =
      latest.category === "admin_reminder"
        ? incoming.length === 1
          ? `${latest.priority === "urgent" ? "Pengingat mendesak" : latest.priority === "important" ? "Pengingat penting" : "Pengingat baru"}: ${latest.title}`
          : `${incoming.length} pengingat baru dari Admin PRP (${latest.title})`
        : incoming.length === 1
          ? `Notifikasi baru dari ${senderLabel}: ${categoryLabel} - ${latest.title}`
          : `${incoming.length} notifikasi baru dari ${senderLabel} (terbaru: ${categoryLabel} - ${latest.title})`
    setNotice({
      message: summary,
      tone: "info",
      targetMenu:
        role === "staff" && incoming.length === 1 ? latest.targetMenu : undefined,
      priority:
        latest.category === "admin_reminder" ? latest.priority : undefined,
    })
  }, [data.notifications, role, session])

  const handleAcknowledgeReminder = (id: string) => {
    const acknowledgedAt = new Date().toISOString()
    const acknowledgedBy = session.displayName || "Staf Unit"
    const userReadKey = getUserReadStorageKey(session)
    try {
      const existing: unknown = JSON.parse(
        localStorage.getItem(userReadKey) ?? "[]",
      )
      const list = Array.isArray(existing)
        ? existing.filter((item): item is string => typeof item === "string")
        : []
      localStorage.setItem(
        userReadKey,
        JSON.stringify([...new Set([...list, id])]),
      )
    } catch {
      // Abaikan jika penyimpanan baca lokal tidak tersedia.
    }

    setData((current) => ({
      ...current,
      notifications: acknowledgeStoredNotifications(
        current.notifications,
        "staff",
        [id],
        acknowledgedBy,
        acknowledgedAt,
      ),
    }))
    localNotificationTransport.publishEvent({
      type: "reminder_acknowledged",
      notificationIds: [id],
      acknowledgedAt,
      acknowledgedBy,
    })
  }

  const selectMenu = (label: string) => {
    if (label === active) {
      if (label === "Isi Laporan Triwulan" || label === "Isi Sasaran Kinerja") {
        if (!confirmNavigation()) return
        setResumeDraftId(null)
        setStaffRecordRequest(null)
        setFormSession((value) => value + 1)
        setNotice(null)
      }
      setTabletDrawerOpen(false)
      return
    }
    if (!confirmNavigation()) return
    setResumeDraftId(null)
    setStaffRecordRequest(null)
    setFormSession((value) => value + 1)
    setHistoryStatusFilter("Semua")
    setHistorySession((value) => value + 1)
    setActive(label)
    setNotice(null)
    setTabletDrawerOpen(false)
  }

  const openRevisionHistory = () => {
    if (!confirmNavigation()) return
    setResumeDraftId(null)
    setStaffRecordRequest(null)
    setFormSession((value) => value + 1)
    setHistoryStatusFilter("Revisi")
    setHistorySession((value) => value + 1)
    setActive("Riwayat")
    setNotice(null)
    setTabletDrawerOpen(false)
  }

  const handleSelectStaffNotification = (notification: AppNotification) => {
    if (role !== "staff") return
    if (!confirmNavigation()) return
    setResumeDraftId(null)
    setFormSession((value) => value + 1)
    setNotice(null)
    setTabletDrawerOpen(false)
    const targetMenu = notification.targetMenu || "Riwayat"
    if (targetMenu === "Riwayat" || notification.recordId) {
      setHistoryStatusFilter(
        notification.category === "admin_reminder" &&
          notification.targetScope === "revision_only"
          ? "Revisi"
          : "Semua",
      )
      setHistorySession((value) => value + 1)
      setActive("Riwayat")
      if (notification.recordId) {
        setStaffRecordRequest((current) => ({
          id: notification.recordId!,
          seq: (current?.seq ?? 0) + 1,
          revise: Boolean(notification.openRevision),
        }))
      } else {
        setStaffRecordRequest(null)
      }
      return
    }
    setStaffRecordRequest(null)
    setActive(targetMenu)
  }

  const continueDraft = (record: HistoryRecord) => {
    setResumeDraftId(record.id)
    setStaffRecordRequest(null)
    setFormSession((value) => value + 1)
    setActive(
      record.type === "Sasaran Kinerja"
        ? "Isi Sasaran Kinerja"
        : "Isi Laporan Triwulan",
    )
    setNotice(null)
  }

  const openAdminBroadcast = (scope?: NotificationTargetScope) => {
    if (role !== "admin") return
    if (scope) {
      setBroadcastPreset((current) => ({
        scope,
        seq: (current?.seq ?? 0) + 1,
      }))
    }
    setBroadcastOpen(true)
  }

  return (
    <div
      className={`app-shell${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}${
        viewportMode === "tablet" && tabletDrawerOpen
          ? " is-tablet-drawer-open"
          : ""
      }`}
    >
      <Sidebar
        active={active}
        session={session}
        collapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        collapseBtnRef={collapseBtnRef}
        expandBtnRef={expandBtnRef}
        onSelectMenu={selectMenu}
        onOpenAccountInfo={() => {
          setTabletDrawerOpen(false)
          setAccountInfoOpen(true)
        }}
        onOpenHelp={() => {
          setTabletDrawerOpen(false)
          setHelpGuideOpen(true)
        }}
        onLogout={onLogout}
      />

      {viewportMode === "tablet" && tabletDrawerOpen && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setTabletDrawerOpen(false)}
        />
      )}

      <main className="main">
        <Header
          active={active}
          session={session}
          onOpenHistory={() => selectMenu("Riwayat")}
          onOpenAccountInfo={() => setAccountInfoOpen(true)}
          onOpenHelp={() => setHelpGuideOpen(true)}
          onLogout={onLogout}
          onOpenBroadcast={() => openAdminBroadcast()}
          onSelectStaffNotification={handleSelectStaffNotification}
          onOpenAdminRecord={(menu, recordId) => {
            if (role !== "admin") return
            if (!confirmNavigation()) return
            setTabletDrawerOpen(false)
            if (menu !== active) {
              setActive(menu)
              setNotice(null)
            }
            setAdminRecordRequest((current) => ({
              id: recordId,
              seq: (current?.seq ?? 0) + 1,
            }))
          }}
        />

        <div className="content" ref={content}>
          {notice && (
            <div
              className={`notice${
                notice.tone === "error"
                  ? " is-error"
                  : notice.priority === "urgent"
                    ? " is-urgent"
                    : notice.priority === "important"
                      ? " is-important"
                      : notice.tone === "info"
                        ? " is-info"
                        : ""
              }`}
              role={
                notice.tone === "error" || notice.priority === "urgent"
                  ? "alert"
                  : "status"
              }
            >
              <span aria-hidden="true">
                {notice.tone === "error" || notice.priority === "urgent" ? (
                  "!"
                ) : notice.tone === "info" ? (
                  <Icon name="bell" size={15} />
                ) : (
                  <Icon name="check" size={16} />
                )}
              </span>
              <p className="notice-text">{notice.message}</p>
              <div className="notice-actions">
                {notice.targetMenu && role === "staff" && (
                  <button
                    type="button"
                    className="notice-link-btn"
                    onClick={() => selectMenu(notice.targetMenu!)}
                  >
                    Buka {notice.targetMenu}
                  </button>
                )}
                <button
                  type="button"
                  className="notice-close-btn"
                  aria-label="Tutup pemberitahuan"
                  onClick={() => setNotice(null)}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {role === "staff" && (
            <StaffReminderBanner
              onOpenTarget={handleSelectStaffNotification}
              onAcknowledge={handleAcknowledgeReminder}
            />
          )}

          {role === "admin" ? (
            <Admin
              active={active}
              notify={notify}
              openRecordRequest={adminRecordRequest}
              onSelectMenu={selectMenu}
              onOpenBroadcast={openAdminBroadcast}
            />
          ) : active === "Isi Laporan Triwulan" ? (
            <InputLaporanTriwulan
              key={`triwulan-${formSession}`}
              notify={notify}
              resumeDraftId={resumeDraftId}
              onViewHistory={() => selectMenu("Riwayat")}
            />
          ) : active === "Isi Sasaran Kinerja" ? (
            <InputSasaranKinerja
              key={`sasaran-${formSession}`}
              notify={notify}
              resumeDraftId={resumeDraftId}
              onViewHistory={() => selectMenu("Riwayat")}
            />
          ) : active === "Riwayat" ? (
            <RiwayatLaporan
              key={`riwayat-${historySession}`}
              initialStatus={historyStatusFilter}
              notify={notify}
              onContinueDraft={continueDraft}
              openRecordRequest={staffRecordRequest}
            />
          ) : (
            <Dashboard
              onSelectMenu={selectMenu}
              onOpenRevisions={openRevisionHistory}
            />
          )}

          <footer>
            © 2025 Sistem Pelaporan Triwulan · Sekretariat Institusi{" "}
            <span>Versi 2.4.0</span>
          </footer>
        </div>
      </main>

      <AccountInfoModal
        open={accountInfoOpen}
        session={session}
        onClose={() => setAccountInfoOpen(false)}
      />
      <HelpGuideModal
        open={helpGuideOpen}
        role={role}
        onClose={() => setHelpGuideOpen(false)}
      />
      {role === "admin" && (
        <AdminReminderModal
          open={broadcastOpen}
          onClose={() => setBroadcastOpen(false)}
          notify={notify}
          presetRequest={broadcastPreset}
        />
      )}
    </div>
  )
}

function readInitialAuthView(): "portal" | "login" {
  if (typeof window === "undefined") return "portal"
  return window.location.pathname.endsWith("/login") ||
    window.location.hash === "#login"
    ? "login"
    : "portal"
}

function syncAuthUrl(view: "portal" | "login") {
  if (typeof window === "undefined") return
  try {
    const target = view === "login" ? "/login" : "/"
    if (window.location.pathname !== target) {
      window.history.pushState({ view }, "", target)
    }
  } catch {
    // Ignore history errors in restricted/file contexts.
  }
}

function AuthGate() {
  const { session, logout } = useAuth()
  const [authView, setAuthView] = useState<"portal" | "login">(
    readInitialAuthView,
  )

  useEffect(() => {
    const onPopState = () => {
      setAuthView(readInitialAuthView())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const openLogin = () => {
    setAuthView("login")
    syncAuthUrl("login")
    window.scrollTo({ top: 0 })
  }

  const openPortal = () => {
    setAuthView("portal")
    syncAuthUrl("portal")
    window.scrollTo({ top: 0 })
  }

  if (!session) {
    return authView === "login" ? (
      <LoginPage onBackToPortal={openPortal} />
    ) : (
      <PortalPage onEnterLogin={openLogin} />
    )
  }

  const handleLogout = () => {
    if (!confirmNavigation()) return
    setAuthView("login")
    syncAuthUrl("login")
    logout()
  }
  return (
    <AppWorkspace
      key={session.userId}
      session={session}
      onLogout={handleLogout}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ReportingProvider records={initialHistory}>
        <AuthGate />
      </ReportingProvider>
    </AuthProvider>
  )
}
