import type { HistoryRecord, LateStatus } from "../types/index.ts"
import {
  extractAnnualSourcesFromRecord,
  logicalTargetKey,
  recordMatchesUnitCode,
} from "./annualSources.ts"
import {
  parseSentAtTimestamp,
  reportingUnits,
  resolveOrganization,
} from "./organizations.ts"
import {
  compareQuarters,
  getPeriodState,
  quarterFromMonth,
  QUARTER_ORDER,
  type Period,
} from "./workflow.ts"

export type LateMonitoringEntry = {
  id: string
  unit: string
  parentUnit: string
  subUnit: string
  unitLabel: string
  year: string
  targetQuarter: string
  latestReportedQuarter: string
  completedInQuarter?: string
  strategicGoal: string
  program: string
  target: string
  monthStart: string
  monthEnd: string
  percentage: number
  remainingPercentage: number
  lateStatus: "Terlambat" | "Pencapaian Terlambat"
  adminLateNote?: string
  obstacle: string
  solution: string
  solutionTime: string
  evidence: string
  latestRecordId?: string
  latestRecordStatus?: HistoryRecord["status"]
}

export function collectLateTriwulanItems({
  records,
  periods,
  year,
  activeQuarter,
  sessionSubUnit,
  nowMs = Date.now(),
}: {
  records: HistoryRecord[]
  periods: Record<string, Period>
  year: string
  activeQuarter: string
  sessionSubUnit?: string
  nowMs?: number
}): LateMonitoringEntry[] {
  const unitsToInspect = sessionSubUnit?.trim()
    ? reportingUnits.filter(
        (u) => u.subUnit.toLowerCase() === sessionSubUnit.trim().toLowerCase(),
      )
    : reportingUnits

  const entries: LateMonitoringEntry[] = []

  for (const orgUnit of unitsToInspect) {
    const unitCode = orgUnit.subUnit
    const unitLabel =
      orgUnit.parentUnit === orgUnit.subUnit
        ? orgUnit.subUnit
        : `${orgUnit.parentUnit} · ${orgUnit.subUnit}`

    const approvedAnnual = records
      .filter(
        (r) =>
          r.type === "Sasaran Kinerja" &&
          r.period === `Tahun ${year}` &&
          r.status === "Disetujui" &&
          recordMatchesUnitCode(r, unitCode),
      )
      .sort(
        (a, b) => parseSentAtTimestamp(b.sentAt) - parseSentAtTimestamp(a.sentAt),
      )[0]

    type AggregatedTarget = {
      key: string
      strategicGoal: string
      program: string
      target: string
      monthStart: string
      monthEnd: string
      targetQuarter: string
      latestQuarter: string
      percentage: number
      firstCompletedQuarter?: string
      adminOverride?: LateStatus
      adminLateNote?: string
      obstacle: string
      solution: string
      solutionTime: string
      evidence: string
      latestRecordId?: string
      latestRecordStatus?: HistoryRecord["status"]
    }

    const targetMap = new Map<string, AggregatedTarget>()

    if (approvedAnnual) {
      const annualItems = extractAnnualSourcesFromRecord(
        approvedAnnual,
        year,
        unitCode,
      )
      for (const src of annualItems) {
        const startQ = quarterFromMonth(src.monthStart) ?? "I"
        const targetQ =
          quarterFromMonth(src.monthEnd || src.monthStart) ?? startQ
        const key = logicalTargetKey({
          strategicGoal: src.strategicGoal,
          program: src.program,
          target: src.target,
          targetId: src.targetId,
        })
        targetMap.set(key, {
          key,
          strategicGoal: src.strategicGoal || "-",
          program: src.program || "-",
          target: src.target || "-",
          monthStart: src.monthStart || "",
          monthEnd: src.monthEnd || "",
          targetQuarter: targetQ,
          latestQuarter: "-",
          percentage: 0,
          obstacle: "",
          solution: "",
          solutionTime: "",
          evidence: "",
          latestRecordId: approvedAnnual.id,
          latestRecordStatus: approvedAnnual.status,
        })
      }
    }

    for (const q of QUARTER_ORDER) {
      const qRecords = records
        .filter(
          (r) =>
            r.type === "Laporan Triwulan" &&
            r.period === `Triwulan ${q} · ${year}` &&
            recordMatchesUnitCode(r, unitCode),
        )
        .sort((a, b) => {
          const rank = (s: HistoryRecord["status"]) =>
            s === "Disetujui" ? 4 : s === "Menunggu" ? 3 : s === "Revisi" ? 2 : 1
          const diff = rank(b.status) - rank(a.status)
          if (diff !== 0) return diff
          const aTs =
            (a.updatedAt ? Date.parse(a.updatedAt) : 0) ||
            parseSentAtTimestamp(a.sentAt)
          const bTs =
            (b.updatedAt ? Date.parse(b.updatedAt) : 0) ||
            parseSentAtTimestamp(b.sentAt)
          return bTs - aTs
        })

      const rec = qRecords[0]
      if (!rec || !rec.triwulanPrograms) continue

      // Skip untouched auto-seeded 0% drafts that have no user input at all
      if (rec.status === "Draf") {
        const hasAnyRealInput = rec.triwulanPrograms.some((p) =>
          p.sasaranList.some(
            (s) =>
              Boolean(s.draftSavedAt) ||
              Boolean(s.stage.trim()) ||
              Boolean(s.realization.trim()) ||
              (Boolean(s.percentage.trim()) && Number(s.percentage) > 0),
          ),
        )
        if (!hasAnyRealInput) continue
      }

      for (const prog of rec.triwulanPrograms) {
        for (const sas of prog.sasaranList) {
          const strategicGoal =
            sas.strategicGoal ||
            prog.strategicGoal ||
            sas.annualSource?.strategicGoal ||
            "-"
          const startQ =
            sas.startQuarter || quarterFromMonth(sas.monthStart) || q
          const targetQ =
            sas.targetQuarter ||
            quarterFromMonth(sas.monthEnd || sas.monthStart) ||
            startQ

          const key = logicalTargetKey({
            strategicGoal,
            program: prog.program,
            target: sas.target,
            targetId: sas.annualSource?.targetId,
          })

          const pct = Math.min(
            100,
            Math.max(0, Number.parseFloat(sas.percentage || "0") || 0),
          )
          const existing = targetMap.get(key)
          const bestPct = Math.max(existing?.percentage ?? 0, pct)

          // Earliest quarter where 100% was achieved
          let firstCompletedQuarter = existing?.firstCompletedQuarter
          if (sas.completedInQuarter) {
            if (
              !firstCompletedQuarter ||
              compareQuarters(sas.completedInQuarter, firstCompletedQuarter) < 0
            ) {
              firstCompletedQuarter = sas.completedInQuarter
            }
          } else if (pct >= 100) {
            if (
              !firstCompletedQuarter ||
              compareQuarters(q, firstCompletedQuarter) < 0
            ) {
              firstCompletedQuarter = q
            }
          }

          // Only treat explicit Admin review lateNotes on verified records as manual override
          const verifiedAdminOverride =
            rec.status === "Disetujui" && rec.lateNotes?.[sas.id]
              ? rec.lateNotes[sas.id]
              : existing?.adminOverride

          targetMap.set(key, {
            key,
            strategicGoal: strategicGoal || existing?.strategicGoal || "-",
            program: prog.program || existing?.program || "-",
            target: sas.target || existing?.target || "-",
            monthStart: sas.monthStart || existing?.monthStart || "",
            monthEnd: sas.monthEnd || existing?.monthEnd || "",
            targetQuarter: existing?.targetQuarter || targetQ,
            latestQuarter: q,
            percentage: bestPct,
            firstCompletedQuarter,
            adminOverride: verifiedAdminOverride,
            adminLateNote: sas.adminLateNote || existing?.adminLateNote,
            obstacle:
              bestPct >= 100 ? "" : sas.obstacle || existing?.obstacle || "",
            solution:
              bestPct >= 100 ? "" : sas.solution || existing?.solution || "",
            solutionTime:
              bestPct >= 100
                ? ""
                : sas.solutionTime || existing?.solutionTime || "",
            evidence: sas.evidence || existing?.evidence || "",
            latestRecordId:
              rec.status !== "Draf" ? rec.id : (existing?.latestRecordId ?? rec.id),
            latestRecordStatus:
              rec.status !== "Draf"
                ? rec.status
                : (existing?.latestRecordStatus ?? rec.status),
          })
        }
      }
    }

    for (const item of targetMap.values()) {
      const targetPeriodKey = `${year}-${item.targetQuarter}`
      const targetPeriodState = getPeriodState(periods[targetPeriodKey], nowMs)
      const isPastTargetQuarter =
        compareQuarters(activeQuarter, item.targetQuarter) > 0 ||
        targetPeriodState.status === "expired" ||
        (item.latestQuarter !== "-" &&
          compareQuarters(item.latestQuarter, item.targetQuarter) > 0)

      let resolvedStatus: "Terlambat" | "Pencapaian Terlambat" | null = null

      if (item.adminOverride === "Tepat Waktu") {
        resolvedStatus = null
      } else if (item.percentage >= 100) {
        if (
          item.firstCompletedQuarter &&
          compareQuarters(item.firstCompletedQuarter, item.targetQuarter) > 0
        ) {
          resolvedStatus = "Pencapaian Terlambat"
        } else if (item.adminOverride === "Pencapaian Terlambat") {
          resolvedStatus = "Pencapaian Terlambat"
        } else {
          resolvedStatus = null
        }
      } else if (
        item.adminOverride === "Terlambat" ||
        (item.percentage < 100 && isPastTargetQuarter)
      ) {
        resolvedStatus = "Terlambat"
      }

      if (!resolvedStatus) continue

      const org = resolveOrganization({
        unit: unitCode,
        parentUnit: orgUnit.parentUnit,
        subUnit: orgUnit.subUnit,
      })

      entries.push({
        id: `${unitCode}-${year}-${item.key}`,
        unit: unitCode,
        parentUnit: org?.parentUnit ?? orgUnit.parentUnit,
        subUnit: org?.subUnit ?? orgUnit.subUnit,
        unitLabel,
        year,
        targetQuarter: item.targetQuarter,
        latestReportedQuarter: item.latestQuarter,
        completedInQuarter: item.firstCompletedQuarter,
        strategicGoal: item.strategicGoal,
        program: item.program,
        target: item.target,
        monthStart: item.monthStart,
        monthEnd: item.monthEnd,
        percentage: item.percentage,
        remainingPercentage: Math.max(0, 100 - item.percentage),
        lateStatus: resolvedStatus,
        adminLateNote: item.adminLateNote,
        obstacle: item.obstacle,
        solution: item.solution,
        solutionTime: item.solutionTime,
        evidence: item.evidence,
        latestRecordId: item.latestRecordId,
        latestRecordStatus: item.latestRecordStatus,
      })
    }
  }

  return entries.sort((a, b) => {
    if (a.lateStatus !== b.lateStatus) {
      return a.lateStatus === "Terlambat" ? -1 : 1
    }
    const qDiff = compareQuarters(a.targetQuarter, b.targetQuarter)
    if (qDiff !== 0) return qDiff
    if (a.percentage !== b.percentage) return a.percentage - b.percentage
    return a.unitLabel.localeCompare(b.unitLabel, "id-ID")
  })
}

export function filterLateMonitoringEntries(
  entries: LateMonitoringEntry[],
  filters: {
    overdueQuarter?: string
    lateStatus?: string
    unitFilter?: string
    query?: string
  },
): LateMonitoringEntry[] {
  const qLower = filters.query?.trim().toLowerCase() ?? ""
  return entries.filter((entry) => {
    if (
      filters.overdueQuarter &&
      filters.overdueQuarter !== "Semua" &&
      entry.targetQuarter !== filters.overdueQuarter
    ) {
      return false
    }
    if (
      filters.lateStatus &&
      filters.lateStatus !== "Semua" &&
      entry.lateStatus !== filters.lateStatus
    ) {
      return false
    }
    if (filters.unitFilter && filters.unitFilter !== "Semua") {
      if (
        entry.parentUnit !== filters.unitFilter &&
        entry.subUnit !== filters.unitFilter &&
        entry.unit !== filters.unitFilter
      ) {
        return false
      }
    }
    if (qLower) {
      const hay = [
        entry.unitLabel,
        entry.strategicGoal,
        entry.program,
        entry.target,
        entry.obstacle,
        entry.solution,
      ]
        .join(" ")
        .toLowerCase()
      if (!hay.includes(qLower)) return false
    }
    return true
  })
}
