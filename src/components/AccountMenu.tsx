import { useEffect, useId, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import type { AuthSession } from "../types"
import { getUserInitials } from "../utils/auth"
import { Icon } from "./Icon"

type AccountMenuProps = {
  session: AuthSession
  variant: "sidebar" | "topbar"
  onOpenAccountInfo: () => void
  onOpenHelp: () => void
  onLogout: () => void
}

export function AccountMenu({
  session,
  variant,
  onOpenAccountInfo,
  onOpenHelp,
  onLogout,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const accountSubtitle =
    session.role === "admin" ? "Administrator PRP" : "Semua Unit"

  const accountLabel =
    session.role === "admin" ? "Admin PRP" : session.displayName

  const sopMenuLabel =
    session.role === "admin"
      ? "Panduan & SOP Admin"
      : "Panduan & SOP Staf"

  const closeAndRun = (action: () => void) => {
    setOpen(false)
    action()
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]',
    )
    if (!items || items.length === 0) return
    const list = Array.from(items)
    const activeIndex = list.indexOf(
      document.activeElement as HTMLButtonElement,
    )

    if (event.key === "ArrowDown") {
      event.preventDefault()
      list[(activeIndex + 1) % list.length]?.focus()
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      list[(activeIndex - 1 + list.length) % list.length]?.focus()
    } else if (event.key === "Home") {
      event.preventDefault()
      list[0]?.focus()
    } else if (event.key === "End") {
      event.preventDefault()
      list[list.length - 1]?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      className={`${variant === "sidebar" ? "sidebar-account" : "topbar-account"
        }${open ? " is-open" : ""}`}
    >
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Menu akun pengguna"
          className={`account-popover ${variant === "sidebar" ? "is-sidebar" : "is-topbar"
            }`}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="account-popover-header">
            <div className="avatar is-lg" aria-hidden="true">
              {getUserInitials(session.displayName)}
            </div>
            <div className="account-popover-identity">
              <strong>{accountLabel}</strong>
              <button
                type="button"
                role="menuitem"
                className="account-profile-link"
                onClick={() => closeAndRun(onOpenAccountInfo)}
              >
                Info Akun <Icon name="arrow" size={12} />
              </button>
            </div>
          </div>

          <div className="account-menu-group">
            <button
              type="button"
              role="menuitem"
              className="account-menu-item"
              onClick={() => closeAndRun(onOpenHelp)}
            >
              <span className="account-item-icon" aria-hidden="true">
                <Icon name="help" size={15} />
              </span>
              <span>{sopMenuLabel}</span>
            </button>
          </div>

          <div className="account-menu-divider" />

          <div className="account-menu-group">
            <button
              type="button"
              role="menuitem"
              className="account-menu-item"
              onClick={() => closeAndRun(onLogout)}
            >
              <span className="account-item-icon" aria-hidden="true">
                <Icon name="logout" size={15} />
              </span>
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={
          variant === "sidebar"
            ? "sidebar-user-trigger"
            : "topbar-account-trigger"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu akun ${session.displayName}`}
        title={session.displayName}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="avatar" aria-hidden="true">
          {getUserInitials(session.displayName)}
        </div>
        {variant === "sidebar" && (
          <div className="user-copy">
            <strong>{session.displayName}</strong>
            <span>{accountSubtitle}</span>
          </div>
        )}
        <span className="sidebar-user-chevron" aria-hidden="true">
          <Icon name="chevronDown" size={15} />
        </span>
      </button>
    </div>
  )
}

export default AccountMenu
