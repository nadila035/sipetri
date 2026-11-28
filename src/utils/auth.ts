import type {
  AppNotification,
  AuthAccountSummary,
  AuthSession,
  HistoryRecord,
  LoginResult,
} from "../types/index.ts"
import {
  reportingUnits,
  resolveOrganization,
  unitOptions,
} from "./organizations.ts"

export const AUTH_STORAGE_KEY = "sipetri-auth-session-v1"

const ADMIN_ACCOUNTS: Record<string, AuthAccountSummary> = {
  admin: {
    userId: "admin",
    username: "admin",
    displayName: "Admin PRP",
    role: "admin",
    parentUnit: "PRP",
    subUnit: "",
  },
  renbang: {
    userId: "renbang",
    username: "renbang",
    displayName: "Admin Renbang",
    role: "admin",
    parentUnit: "PRP",
    subUnit: "",
  },
}

export const UNIT_ACCOUNTS: AuthAccountSummary[] = reportingUnits.map(
  ({ parentUnit, subUnit }) => ({
    userId: `unit-${subUnit.toLowerCase()}`,
    username: subUnit.toLowerCase(),
    displayName: `Unit ${subUnit}`,
    role: "staff",
    parentUnit,
    subUnit,
  }),
)

const UNIT_ACCOUNT_BY_USERNAME = new Map<string, AuthAccountSummary>()
for (const account of UNIT_ACCOUNTS) {
  UNIT_ACCOUNT_BY_USERNAME.set(account.username, account)
  UNIT_ACCOUNT_BY_USERNAME.set(`unit.${account.username}`, account)
  UNIT_ACCOUNT_BY_USERNAME.set(`unit-${account.username}`, account)
  UNIT_ACCOUNT_BY_USERNAME.set(`staf.${account.username}`, account)
}

export interface AuthAdapter {
  login(username: string, password: string): Promise<LoginResult> | LoginResult
  getSession(): AuthSession | null
  saveSession(session: AuthSession): boolean
  clearSession(): void
}

export function resolveUnitAccountByCode(
  rawUsername: string,
): AuthAccountSummary | null {
  const cleaned = rawUsername.trim().toLowerCase()
  if (!cleaned) return null
  return UNIT_ACCOUNT_BY_USERNAME.get(cleaned) ?? null
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

  const adminAccount = ADMIN_ACCOUNTS[normalizedUser]
  if (adminAccount) {
    return {
      ok: true,
      session: {
        ...adminAccount,
        loggedInAt: nowIso,
      },
    }
  }

  const unitAccount = resolveUnitAccountByCode(normalizedUser)
  if (unitAccount) {
    return {
      ok: true,
      session: {
        ...unitAccount,
        loggedInAt: nowIso,
      },
    }
  }

  if (normalizedUser === "unit" || normalizedUser === "staff" || normalizedUser === "staf") {
    return {
      ok: false,
      error:
        'Sesi unit kini dikunci otomatis per unit kerja. Masuk menggunakan kode unit Anda (contoh: "fket", "ftik", "baum", "bpk", "pjm").',
    }
  }

  const matchedParent = Object.keys(unitOptions).find(
    (parent) => parent.toLowerCase() === normalizedUser,
  )
  if (matchedParent && unitOptions[matchedParent]?.length > 0) {
    const sampleChildren = unitOptions[matchedParent]
      .map((sub) => sub.toLowerCase())
      .join(", ")
    return {
      ok: false,
      error: `Gunakan kode sub-unit di bawah ${matchedParent}: ${sampleChildren}.`,
    }
  }

  return {
    ok: false,
    error:
      'Username tidak dikenali. Gunakan "admin" / "renbang" atau kode unit kerja (contoh: "fket", "baum", "bpk").',
  }
}

export function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null
    if (!parsed || typeof parsed !== "object") return null
    if (
      typeof parsed.userId !== "string" ||
      !parsed.userId.trim() ||
      typeof parsed.username !== "string" ||
      !parsed.username.trim() ||
      typeof parsed.displayName !== "string" ||
      !parsed.displayName.trim() ||
      typeof parsed.parentUnit !== "string" ||
      typeof parsed.subUnit !== "string" ||
      typeof parsed.loggedInAt !== "string"
    ) {
      return null
    }

    const uname = parsed.username.trim().toLowerCase()
    const adminMatch = ADMIN_ACCOUNTS[uname]
    if (adminMatch) {
      if (parsed.role !== "admin") return null
      return {
        userId: adminMatch.userId,
        username: adminMatch.username,
        displayName: parsed.displayName,
        role: "admin",
        parentUnit: adminMatch.parentUnit,
        subUnit: adminMatch.subUnit,
        loggedInAt: parsed.loggedInAt,
      }
    }

    const unitMatch = resolveUnitAccountByCode(uname)
    if (unitMatch) {
      if (
        parsed.role !== "staff" ||
        parsed.parentUnit !== unitMatch.parentUnit ||
        parsed.subUnit !== unitMatch.subUnit
      ) {
        return null
      }
      return {
        userId: unitMatch.userId,
        username: unitMatch.username,
        displayName: parsed.displayName,
        role: "staff",
        parentUnit: unitMatch.parentUnit,
        subUnit: unitMatch.subUnit,
        loggedInAt: parsed.loggedInAt,
      }
    }

    return null
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
      // Ignore if sessionStorage is unavailable.
    }
    try {
      const localSession = parseStoredSession(
        localStorage.getItem(AUTH_STORAGE_KEY),
      )
      if (localSession && typeof sessionStorage !== "undefined") {
        try {
          sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(localSession))
        } catch {
          // Ignore if sessionStorage is restricted.
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
      // Ignore if sessionStorage is unavailable.
    }
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized)
      savedAny = true
    } catch {
      // Ignore if localStorage is unavailable.
    }
    return savedAny
  },
  clearSession(): void {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(AUTH_STORAGE_KEY)
      }
    } catch {
      // Ignore if sessionStorage is disabled.
    }
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // Ignore if localStorage is disabled.
    }
  },
}

export function getSessionLockedOrganization(session: AuthSession | null): {
  unit: string
  subUnit: string
  unitLabel: string
} {
  if (!session || session.role !== "staff") {
    return { unit: "", subUnit: "", unitLabel: "Administrator PRP" }
  }
  const unit = session.parentUnit
  const subUnit = session.subUnit || session.parentUnit
  const unitLabel =
    unit && subUnit && unit !== subUnit ? `${unit} · ${subUnit}` : subUnit || unit
  return { unit, subUnit, unitLabel }
}

export function recordBelongsToSession(
  record: Pick<HistoryRecord, "unit" | "parentUnit" | "subUnit">,
  session: AuthSession | null,
): boolean {
  if (!session) return false
  if (session.role === "admin") return true
  if (!session.subUnit.trim()) return false
  const org = resolveOrganization(record)
  const recordSubUnit = (org?.subUnit ?? record.subUnit ?? record.unit ?? "").trim()
  return recordSubUnit.toLowerCase() === session.subUnit.trim().toLowerCase()
}

export function filterRecordsForSession(
  records: HistoryRecord[],
  session: AuthSession | null,
): HistoryRecord[] {
  if (!session) return []
  if (session.role === "admin") return records
  return records.filter((record) => recordBelongsToSession(record, session))
}

export function canNotificationReachSession(
  notification: AppNotification,
  session: AuthSession | null,
): boolean {
  if (!session) return false
  if (notification.recipient !== session.role) return false
  if (session.role === "admin") return true

  const sessionSub = session.subUnit.trim().toLowerCase()
  if (!sessionSub) return false

  if (notification.targetUnit?.trim()) {
    return notification.targetUnit.trim().toLowerCase() === sessionSub
  }

  if (
    notification.targetScope &&
    notification.targetScope !== "all" &&
    Array.isArray(notification.targetUnits)
  ) {
    if (notification.targetUnits.length === 0) return false
    return notification.targetUnits.some(
      (unitCode) => unitCode.trim().toLowerCase() === sessionSub,
    )
  }

  return true
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
