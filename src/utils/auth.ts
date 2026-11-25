import type {
  AppNotification,
  AuthAccountSummary,
  AuthSession,
  HistoryRecord,
  LoginResult,
} from "../types/index.ts"

export const AUTH_STORAGE_KEY = "sipetri-auth-session-v1"

const SYSTEM_ACCOUNTS: Record<"admin" | "unit", AuthAccountSummary> = {
  admin: {
    userId: "admin",
    username: "admin",
    displayName: "Admin PRP",
    role: "admin",
    parentUnit: "PRP",
    subUnit: "",
  },
  unit: {
    userId: "unit",
    username: "unit",
    displayName: "Unit",
    role: "staff",
    parentUnit: "",
    subUnit: "",
  },
}

export interface AuthAdapter {
  login(username: string, password: string): Promise<LoginResult> | LoginResult
  getSession(): AuthSession | null
  saveSession(session: AuthSession): boolean
  clearSession(): void
}

export function authenticateCredentials(
  usernameInput: string,
  passwordInput: string,
  nowIso = new Date().toISOString(),
): LoginResult {
  const normalizedUser = usernameInput.trim().toLowerCase()
  if (!normalizedUser || !passwordInput) {
    return {
      ok: false,
      error: "Masukkan username dan kata sandi terlebih dahulu.",
    }
  }

  if (normalizedUser !== "admin" && normalizedUser !== "unit") {
    return {
      ok: false,
      error: 'Username tidak dikenali. Gunakan "admin" atau "unit".',
    }
  }

  return {
    ok: true,
    session: {
      ...SYSTEM_ACCOUNTS[normalizedUser],
      loggedInAt: nowIso,
    },
  }
}

export function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null
    if (!parsed || typeof parsed !== "object") return null
    const expectedRole =
      parsed.username === "admin"
        ? "admin"
        : parsed.username === "unit"
          ? "staff"
          : null
    if (
      typeof parsed.userId !== "string" ||
      !parsed.userId.trim() ||
      !expectedRole ||
      typeof parsed.displayName !== "string" ||
      !parsed.displayName.trim() ||
      parsed.role !== expectedRole ||
      typeof parsed.parentUnit !== "string" ||
      typeof parsed.subUnit !== "string" ||
      typeof parsed.loggedInAt !== "string"
    ) {
      return null
    }
    return {
      userId: parsed.userId,
      username: parsed.username as "admin" | "unit",
      displayName: parsed.displayName,
      role: parsed.role,
      parentUnit: parsed.parentUnit,
      subUnit: parsed.subUnit,
      loggedInAt: parsed.loggedInAt,
    }
  } catch {
    return null
  }
}

export const browserAuthAdapter: AuthAdapter = {
  login(username: string, password: string): LoginResult {
    const result = authenticateCredentials(username, password)
    if (!result.ok) return result
    if (!this.saveSession(result.session)) {
      return {
        ok: false,
        error:
          "Sesi tidak dapat disimpan karena penyimpanan browser tidak tersedia.",
      }
    }
    return result
  },
  getSession(): AuthSession | null {
    try {
      if (typeof sessionStorage !== "undefined") {
        const tabSession = parseStoredSession(
          sessionStorage.getItem(AUTH_STORAGE_KEY),
        )
        if (tabSession) return tabSession
      }
    } catch {
      // Abaikan jika sessionStorage tidak tersedia
    }
    try {
      const localSession = parseStoredSession(
        localStorage.getItem(AUTH_STORAGE_KEY),
      )
      if (localSession && typeof sessionStorage !== "undefined") {
        try {
          sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(localSession))
        } catch {
          // Abaikan jika sessionStorage dibatasi
        }
      }
      return localSession
    } catch {
      return null
    }
  },
  saveSession(session: AuthSession): boolean {
    const serialized = JSON.stringify(session)
    let savedAny = false
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(AUTH_STORAGE_KEY, serialized)
        savedAny = true
      }
    } catch {
      // Abaikan jika sessionStorage tidak tersedia
    }
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized)
      savedAny = true
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
    return savedAny
  },
  clearSession(): void {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(AUTH_STORAGE_KEY)
      }
    } catch {
      // Abaikan jika sessionStorage dinonaktifkan
    }
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Abaikan jika localStorage dinonaktifkan
    }
  },
}

export function recordBelongsToSession(
  _record: Pick<HistoryRecord, "unit" | "parentUnit" | "subUnit">,
  session: AuthSession | null,
): boolean {
  return Boolean(
    session && (session.role === "admin" || session.role === "staff"),
  )
}

export function filterRecordsForSession(
  records: HistoryRecord[],
  session: AuthSession | null,
): HistoryRecord[] {
  if (!session) return []
  return records
}

export function canNotificationReachSession(
  notification: AppNotification,
  session: AuthSession | null,
): boolean {
  if (!session) return false
  return notification.recipient === session.role
}

export function getUserReadStorageKey(session: AuthSession | null): string {
  return session
    ? `sipetri-user-read-notifications-v1:${session.userId}`
    : "sipetri-user-read-notifications-v1:guest"
}

export function getUserInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "US"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}
