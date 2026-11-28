import type { ReactNode } from "react"

export type IconName =
  | "grid"
  | "report"
  | "target"
  | "history"
  | "bell"
  | "search"
  | "arrow"
  | "arrowLeft"
  | "check"
  | "clock"
  | "chart"
  | "calendar"
  | "help"
  | "chevron"
  | "chevronDown"
  | "eye"
  | "eyeOff"
  | "plus"
  | "trash"
  | "download"
  | "note"
  | "lock"
  | "logout"
  | "send"
  | "broadcast"
  | "sidebarPanel"
  | "sidebarOpen"
  | "sidebarClose"
  | "alert"
  | "layers"

export type NavItem = {
  label: string
  icon: IconName
}

export type ActionCardItem = {
  title: string
  description: string
  icon: IconName
  tone: string
}

export type MasterStrategicGoal = {
  id: string
  code: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type LateStatus =
  | "Tepat Waktu"
  | "Terlambat"
  | "Pencapaian Terlambat"

export type ReportRow = {
  strategicGoal?: string
  program: string
  target: string
  monthStart: string
  monthEnd: string
  stage: string
  stageTargetTime?: string
  realization: string
  percentage: string
  obstacle: string
  solution: string
  solutionTime: string
  notes: string
  evidence: string
}

export type TriwulanSasaranItem = {
  annualSource?: {
    recordId: string
    criteriaId: string
    strategyId: string
    strategicGoalId?: string
    strategicGoal?: string
    programId: string
    targetId: string
    year: string
    unit: string
    status: HistoryStatus
    capturedAt: string
    program: string
    target: string
    monthStart: string
    monthEnd: string
    notes: string
  }
  id: string
  strategicGoalId?: string
  strategicGoal?: string
  target: string
  monthStart: string
  monthEnd?: string
  stage: string
  stageTargetTime?: string
  realization: string
  percentage: string
  priorPercentage?: number
  carryOverFromQuarter?: string
  startQuarter?: string
  targetQuarter?: string
  isLockedCompleted?: boolean
  completedInQuarter?: string
  lateStatus?: LateStatus
  adminLateNote?: string
  draftSavedAt?: string
  notes: string
  obstacle: string
  solution: string
  solutionTime: string
  evidence: string
}

export type TriwulanProgramItem = {
  id: string
  strategicGoalId?: string
  strategicGoal?: string
  program: string
  sasaranList: TriwulanSasaranItem[]
}

export type TargetItem = {
  id: string
  target: string
  monthStart: string
  monthEnd?: string
  notes: string
  sasaran?: string
  bulan_mulai?: string
  bulan_selesai?: string
  keterangan?: string
}

export type SasaranItem = {
  id: string
  sasaran: string
  bulan_mulai: string
  bulan_selesai?: string
  keterangan: string
  target?: string
  monthStart?: string
  monthEnd?: string
  notes?: string
}

export type WorkProgram = {
  id: string
  name: string
  targets: TargetItem[]
  sasaranList?: SasaranItem[]
}

export type ProgramKerja = WorkProgram

export type StrategyItem = {
  id: string
  strategicGoalId?: string
  name: string
  programs: WorkProgram[]
}

export type CriteriaItem = {
  id: string
  name: string
  strategy: StrategyItem
  strategies?: StrategyItem[]
}

export type HistoryStatus = "Draf" | "Menunggu" | "Disetujui" | "Revisi"
export type HistoryType = "Laporan Triwulan" | "Sasaran Kinerja"

export type HistoryItem = {
  label: string
  value: string
  note?: string
  needsRevision?: boolean
}

export type HistoryRecord = {
  id: string
  type: HistoryType
  title: string
  period: string
  unit: string
  parentUnit?: string
  subUnit?: string
  sentAt: string
  updatedAt?: string
  status: HistoryStatus
  progress: number
  items: HistoryItem[]
  author?: string
  lateNotes?: Record<string, LateStatus>
  reviews?: {
    id: string
    at: string
    actor: string
    action: HistoryStatus
    notes: Record<string, string>
  }[]
  criteriaData?: CriteriaItem[]
  triwulanPrograms?: TriwulanProgramItem[]
}

export type NoticeTone = "success" | "error" | "info"
export type NotifyFn = (message: string, tone?: NoticeTone) => void

export type NotificationRecipient = "staff" | "admin"

export type NotificationPriority = "normal" | "important" | "urgent"

export type NotificationTargetScope =
  | "all"
  | "missing_report"
  | "revision_only"
  | "specific_units"

export type NotificationCategory =
  | "admin_reminder"
  | "revision_requested"
  | "document_approved"
  | "period_opened"
  | "period_updated"
  | "period_locked"
  | "year_added"
  | "default_period_changed"
  | "document_submitted"
  | "revision_resubmitted"
  | "deadline_reminder"
  | "master_strategy_updated"

export type AppNotification = {
  id: string
  recipient: NotificationRecipient
  category: NotificationCategory
  title: string
  message: string
  actor: string
  createdAt: string
  targetMenu: string
  recordId?: string
  openRevision?: boolean
  targetUnit?: string
  unitLabel?: string
  periodLabel?: string
  read?: boolean
  priority?: NotificationPriority
  targetScope?: NotificationTargetScope
  targetUnits?: string[]
  active?: boolean
  expiresAt?: string
  acknowledgedAt?: string
  acknowledgedBy?: string
}

export type UserRole = "staff" | "admin"

export type AuthAccountSummary = {
  userId: string
  username: string
  displayName: string
  role: UserRole
  parentUnit: string
  subUnit: string
}

export type AuthSession = AuthAccountSummary & {
  loggedInAt: string
}

export type LoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string }

export type CustomDialogFooter = ReactNode
