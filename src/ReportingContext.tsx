import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { useUnsavedChanges } from "./utils/useUnsavedChanges"
import {
  createEmptyTriwulanProgram,
  createEmptyTriwulanSasaran,
} from "./utils/drafts"
import {
  DEFAULT_STRATEGIC_GOALS,
  normalizeStrategicGoals,
} from "./utils/strategicGoals"
import { localNotificationTransport } from "./utils/notificationTransport"
import type { Period } from "./utils/workflow"
import type {
  AppNotification,
  CriteriaItem,
  HistoryRecord,
  MasterStrategicGoal,
  ReportRow,
  TriwulanProgramItem,
  TriwulanSasaranItem,
} from "./types"

export type ReportingData = {
  year: string
  quarter: string
  availableYears: string[]
  yearsReset2026?: boolean
  defaultHistoryCleared?: boolean
  strategicGoals: MasterStrategicGoal[]
  criteria: CriteriaItem[]
  drafts: Record<string, any[]>
  draftUpdatedAt?: Record<string, string>
  records: HistoryRecord[]
  notifications?: AppNotification[]
  targetDraft: boolean
  periods: Record<string, Period>
  draftUnits?: Record<
    string,
    {
      unit: string
      subUnit: string
      customUnit: string
      customSubUnit: string
    }
  >
}

const ReportingContext = createContext<{
  data: ReportingData
  setData: Dispatch<SetStateAction<ReportingData>>
  savedDraftUpdatedAt: Record<string, string>
  storageError: string
  nowMs: number
} | null>(null)

const storageKey = "quarterly-reporting-v1"
const REALTIME_STATE_CHANNEL = "sipetri-realtime-sync-v1"

function getRealtimeTabId(): string {
  const holder = globalThis as Record<string, unknown>
  const key = "__sipetriRealtimeTabId"
  if (typeof holder[key] === "string") return holder[key] as string
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`
  holder[key] = id
  return id
}

export const emptyTriwulanSasaran = (id?: string): TriwulanSasaranItem =>
  createEmptyTriwulanSasaran(id)

export const emptyTriwulanProgram = (id?: string): TriwulanProgramItem =>
  createEmptyTriwulanProgram(id)

export const emptyReportRow = (): ReportRow => ({
  strategicGoal: "",
  program: "",
  target: "",
  monthStart: "",
  monthEnd: "",
  stage: "",
  realization: "",
  percentage: "",
  obstacle: "",
  solution: "",
  solutionTime: "",
  notes: "",
  evidence: "",
})

export function collectReportingYears(data: {
  year: string
  availableYears?: string[]
  records: HistoryRecord[]
  periods: Record<string, Period>
}): string[] {
  const years = new Set<string>(["2024", "2025", "2026"])
  if (/^\d{4}$/.test(data.year)) years.add(data.year)
  for (const y of data.availableYears ?? []) {
    if (/^\d{4}$/.test(y)) years.add(y)
  }
  for (const r of data.records) {
    const match = r.period.match(/\b(\d{4})\b/)
    if (match) years.add(match[1])
  }
  for (const key of Object.keys(data.periods)) {
    const match = key.match(/^(\d{4})-/)
    if (match) years.add(match[1])
  }
  return Array.from(years).sort((a, b) => Number(b) - Number(a))
}

export function defaultInitialPeriods(
  year = "2026",
  activeQuarter = "III",
): Record<string, Period> {
  return {
    [`${year}-annual`]: { startDate: "", deadline: "", open: true },
    [`${year}-I`]: { startDate: "", deadline: "", open: activeQuarter === "I" },
    [`${year}-II`]: { startDate: "", deadline: "", open: activeQuarter === "II" },
    [`${year}-III`]: { startDate: "", deadline: "", open: activeQuarter === "III" },
    [`${year}-IV`]: { startDate: "", deadline: "", open: activeQuarter === "IV" },
  }
}

const BASE_REPORTING_YEARS = new Set(["2024", "2025", "2026"])
const DEFAULT_HISTORY_IDS = new Set([
  "LTR-2025-002",
  "SK-2025-001",
  "LTR-2025-001",
  "LTR-2024-004",
])

function parseStoredReportingData(
  raw: string | null,
): { status: "empty" | "invalid" } | { status: "ok"; data: ReportingData } {
  if (!raw) return { status: "empty" }
  try {
    const saved = JSON.parse(raw) as Partial<ReportingData> | null
    if (saved === null) return { status: "empty" }
    if (
      saved &&
      typeof saved.year === "string" &&
      saved.quarter &&
      ["I", "II", "III", "IV"].includes(saved.quarter) &&
      Array.isArray(saved.criteria) &&
      Array.isArray(saved.records) &&
      saved.drafts &&
      typeof saved.targetDraft === "boolean"
    ) {
      const shouldResetYears = !saved.yearsReset2026
      const safeYear =
        shouldResetYears && !BASE_REPORTING_YEARS.has(saved.year)
          ? "2026"
          : saved.year
      const rawPeriods =
        saved.periods && Object.keys(saved.periods).length > 0
          ? saved.periods
          : defaultInitialPeriods(safeYear, saved.quarter)
      const prunedPeriods = shouldResetYears
        ? Object.fromEntries(
            Object.entries(rawPeriods).filter(([key]) => {
              const match = key.match(/^(\d{4})-/)
              return match ? BASE_REPORTING_YEARS.has(match[1]) : false
            }),
          )
        : rawPeriods
      const periods =
        Object.keys(prunedPeriods).length > 0
          ? prunedPeriods
          : defaultInitialPeriods(safeYear, saved.quarter)
      const shouldClearDefaults = !saved.defaultHistoryCleared
      const cleanedRecords = shouldClearDefaults
        ? saved.records.filter((record) => !DEFAULT_HISTORY_IDS.has(record.id))
        : saved.records
      const savedNotifications = Array.isArray(saved.notifications)
        ? saved.notifications
        : []
      const notifications = savedNotifications.filter((item) => {
        if (shouldResetYears && item.category === "year_added") {
          const match = item.periodLabel?.match(/\b(\d{4})\b/)
          if (!match || !BASE_REPORTING_YEARS.has(match[1])) return false
        }
        if (shouldClearDefaults) {
          if (item.recordId && DEFAULT_HISTORY_IDS.has(item.recordId)) return false
          if (
            Array.from(DEFAULT_HISTORY_IDS).some((id) =>
              item.id.startsWith(`legacy-staff-${id}-`),
            )
          ) {
            return false
          }
        }
        return true
      })
      const savedAvailableYears = shouldResetYears
        ? ["2026", "2025", "2024"]
        : Array.isArray(saved.availableYears)
          ? saved.availableYears
          : undefined
      const strategicGoals = Array.isArray(saved.strategicGoals)
        ? normalizeStrategicGoals(saved.strategicGoals)
        : structuredClone(DEFAULT_STRATEGIC_GOALS)
      return {
        status: "ok",
        data: {
          ...(saved as ReportingData),
          year: safeYear,
          periods,
          records: cleanedRecords,
          notifications,
          strategicGoals,
          yearsReset2026: true,
          defaultHistoryCleared: true,
          availableYears: collectReportingYears({
            year: safeYear,
            availableYears: savedAvailableYears,
            records: cleanedRecords,
            periods,
          }),
          criteria: [],
          drafts: {},
          targetDraft: false,
        },
      }
    }
    return { status: "invalid" }
  } catch {
    return { status: "invalid" }
  }
}

export function ReportingProvider({
  records,
  children,
}: {
  records: HistoryRecord[]
  children: ReactNode
}) {
  const [loadError, setLoadError] = useState(false)
  const skipNextPersistRef = useRef(false)
  const lastPersistedRawRef = useRef<string | null>(null)
  const senderTabId = getRealtimeTabId()
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  const [data, setData] = useState<ReportingData>(() => {
    const year = "2026"
    const initial: ReportingData = {
      year,
      quarter: "III",
      availableYears: ["2026", "2025", "2024"],
      yearsReset2026: true,
      defaultHistoryCleared: true,
      strategicGoals: structuredClone(DEFAULT_STRATEGIC_GOALS),
      records,
      notifications: [],
      drafts: {},
      targetDraft: false,
      periods: defaultInitialPeriods(year, "III"),
      criteria: [],
    }
    const parsed = parseStoredReportingData(localStorage.getItem(storageKey))
    if (parsed.status === "ok") {
      return parsed.data
    }
    if (parsed.status === "invalid") {
      setLoadError(true)
    }
    return initial
  })
  const [storageError, setStorageError] = useState("")
  const [savedDraftUpdatedAt, setSavedDraftUpdatedAt] = useState<
    Record<string, string>
  >({})
  useUnsavedChanges(!!storageError)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const applyExternalRaw = (raw: string | null) => {
      if (!raw || raw === lastPersistedRawRef.current) return
      const parsed = parseStoredReportingData(raw)
      if (parsed.status === "ok") {
        lastPersistedRawRef.current = raw
        skipNextPersistRef.current = true
        setLoadError(false)
        setData(parsed.data)
      }
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      applyExternalRaw(event.newValue)
    }
    window.addEventListener("storage", handleStorage)

    let stateChannel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== "undefined") {
      try {
        stateChannel = new BroadcastChannel(REALTIME_STATE_CHANNEL)
        stateChannel.addEventListener("message", (event) => {
          const payload = event.data as
            | { senderTabId?: string; raw?: string }
            | undefined
          if (!payload || payload.senderTabId === senderTabId) return
          if (typeof payload.raw === "string") {
            applyExternalRaw(payload.raw)
          } else {
            try {
              applyExternalRaw(localStorage.getItem(storageKey))
            } catch {
              // Ignore restricted storage read.
            }
          }
        })
      } catch {
        stateChannel = null
      }
    }

    const unsubscribeTransport = localNotificationTransport.subscribe(() => {
      try {
        applyExternalRaw(localStorage.getItem(storageKey))
      } catch {
        // Ignore restricted storage read.
      }
    })
    return () => {
      window.removeEventListener("storage", handleStorage)
      stateChannel?.close()
      unsubscribeTransport()
    }
  }, [senderTabId])

  useEffect(() => {
    if (loadError) {
      setStorageError(
        "Data tersimpan tidak dapat dibaca. Data lama tidak ditimpa; pulihkan cadangan browser sebelum menyimpan perubahan.",
      )
      return
    }
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      setSavedDraftUpdatedAt(data.draftUpdatedAt ?? {})
      setStorageError("")
      return
    }
    try {
      const serialized = JSON.stringify(data)
      localStorage.setItem(storageKey, serialized)
      lastPersistedRawRef.current = serialized
      setSavedDraftUpdatedAt(data.draftUpdatedAt ?? {})
      setStorageError("")

      if (typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel(REALTIME_STATE_CHANNEL)
          ch.postMessage({ senderTabId, raw: serialized })
          ch.close()
        } catch {
          // Ignore BroadcastChannel restrictions.
        }
      }
    } catch {
      setStorageError(
        "Penyimpanan browser gagal. Data sesi belum tersimpan; kosongkan ruang penyimpanan sebelum menutup halaman.",
      )
    }
  }, [data, loadError, senderTabId])

  return (
    <ReportingContext.Provider
      value={{ data, setData, savedDraftUpdatedAt, storageError, nowMs }}
    >
      {storageError && <div role="alert">{storageError}</div>}
      {children}
    </ReportingContext.Provider>
  )
}

export function useReporting() {
  const context = useContext(ReportingContext)
  if (!context) throw new Error("ReportingProvider is required")
  return context
}
