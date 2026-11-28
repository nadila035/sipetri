import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { AuthSession, LoginResult } from "./types"
import {
  AUTH_STORAGE_KEY,
  browserAuthAdapter,
  parseStoredSession,
  type AuthAdapter,
} from "./utils/auth"

type AuthContextValue = {
  session: AuthSession | null
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  adapter = browserAuthAdapter,
}: {
  children: ReactNode
  adapter?: AuthAdapter
}) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    adapter.getSession(),
  )

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY) return
      try {
        if (
          typeof sessionStorage !== "undefined" &&
          parseStoredSession(sessionStorage.getItem(AUTH_STORAGE_KEY))
        ) {
          return
        }
      } catch {
        // Abaikan jika sessionStorage tidak tersedia
      }
      setSession(parseStoredSession(event.newValue))
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const login = async (
    username: string,
    password: string,
  ): Promise<LoginResult> => {
    const result = await adapter.login(username, password)
    if (result.ok) {
      setSession(result.session)
    }
    return result
  }

  const logout = () => {
    adapter.clearSession()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("AuthProvider is required")
  return ctx
}
