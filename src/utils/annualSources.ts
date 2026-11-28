import type {
  HistoryRecord,
  LateStatus,
  TriwulanProgramItem,
  TriwulanSasaranItem,
} from "../types/index.ts"
import { parseSentAtTimestamp, resolveOrganization } from "./organizations.ts"
import { compareQuarters, quarterFromMonth, QUARTER_ORDER } from "./workflow.ts"

export type AnnualSource = NonNullable<TriwulanSasaranItem["annualSource"]>

export function recordMatchesUnitCode(
  record: Pick<HistoryRecord, "unit" | "parentUnit" | "subUnit">,
  unitCode: string,
): boolean {
  const target = unitCode.trim().toLowerCase()
  if (!target) return false
  const org = resolveOrganization(record)
  const candidates = [
    org?.subUnit,
    record.subUnit,
    record.unit,
  ]
    .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
    .map((v) => v.trim().toLowerCase())
  return candidates.includes(target)
}

export type AnnualPrerequisiteState = {
  status: "missing" | "draft" | "waiting" | "revision" | "approved"
  canAccessTriwulan: boolean
  approvedRecord?: HistoryRecord
  latestRecord?: HistoryRecord
}

export function getUnitAnnualPrerequisiteState(
  records: HistoryRecord[],
  year: string,
  unitCode: string,
): AnnualPrerequisiteState {
  const unitAnnualRecords = records
    .filter(
      (r) =>
        r.type === "Sasaran Kinerja" &&
        r.period === `Tahun ${year}` &&
        recordMatchesUnitCode(r, unitCode),
    )
    .sort((a, b) => {
      const aTs =
        (a.updatedAt ? Date.parse(a.updatedAt) : 0) ||
        parseSentAtTimestamp(a.sentAt)
      const bTs =
        (b.updatedAt ? Date.parse(b.updatedAt) : 0) ||
        parseSentAtTimestamp(b.sentAt)
      return bTs - aTs
    })

  if (unitAnnualRecords.length === 0) {
    return { status: "missing", canAccessTriwulan: false }
  }

  const approvedRecord = unitAnnualRecords.find((r) => r.status === "Disetujui")
  const latestRecord = unitAnnualRecords[0]

  if (approvedRecord) {
    return {
      status: "approved",
      canAccessTriwulan: true,
      approvedRecord,
      latestRecord,
    }
  }

  if (unitAnnualRecords.some((r) => r.status === "Revisi")) {
    return {
      status: "revision",
      canAccessTriwulan: false,
      latestRecord:
        unitAnnualRecords.find((r) => r.status === "Revisi") ?? latestRecord,
    }
  }

  if (unitAnnualRecords.some((r) => r.status === "Menunggu")) {
    return {
      status: "waiting",
      canAccessTriwulan: false,
      latestRecord:
        unitAnnualRecords.find((r) => r.status === "Menunggu") ?? latestRecord,
    }
  }

  return {
    status: "draft",
    canAccessTriwulan: false,
    latestRecord,
  }
}

export function extractAnnualSourcesFromRecord(
  record: HistoryRecord,
  year: string,
  unitOverride?: string,
): AnnualSource[] {
  const unitVal = unitOverride ?? record.subUnit ?? record.unit
  return (record.criteriaData ?? []).flatMap((criteria) =>
    (criteria.strategies && criteria.strategies.length > 0
      ? criteria.strategies
      : criteria.strategy
        ? [criteria.strategy]
        : []
    ).flatMap((strategy) => {
      const strategicGoal = strategy.name?.trim() || criteria.name?.trim() || ""
      const strategicGoalId = strategy.strategicGoalId || ""
      return (strategy.programs ?? []).flatMap((program) =>
        (program.sasaranList && program.sasaranList.length > 0
          ? program.sasaranList
          : program.targets ?? []
        ).map((target: any) => ({
          recordId: record.id,
          criteriaId: criteria.id,
          strategyId: strategy.id,
          strategicGoalId,
          strategicGoal,
          programId: program.id,
          targetId: target.id,
          year,
          unit: unitVal,
          status: record.status,
          capturedAt: record.sentAt,
          program: program.name,
          target: target.sasaran ?? target.target ?? "",
          monthStart: target.bulan_mulai ?? target.monthStart ?? "",
          monthEnd: target.bulan_selesai ?? target.monthEnd ?? "",
          notes: target.keterangan ?? target.notes ?? "",
        })),
      )
    }),
  )
}

export function annualSources(
  records: HistoryRecord[],
  year: string,
  unit: string,
): AnnualSource[] {
  return records
    .filter(
      (r) =>
        r.type === "Sasaran Kinerja" &&
        r.period === `Tahun ${year}` &&
        recordMatchesUnitCode(r, unit),
    )
    .flatMap((record) => extractAnnualSourcesFromRecord(record, year, unit))
}

export function approvedAnnualSources(
  records: HistoryRecord[],
  year: string,
  unit: string,
): AnnualSource[] {
  const prereq = getUnitAnnualPrerequisiteState(records, year, unit)
  if (!prereq.approvedRecord) return []
  return extractAnnualSourcesFromRecord(prereq.approvedRecord, year, unit)
}

export function sourceKey(source: AnnualSource): string {
  return JSON.stringify([
    source.recordId,
    source.criteriaId,
    source.strategyId,
    source.programId,
    source.targetId,
  ])
}

export function logicalTargetKey(input: {
  strategicGoal?: string
  program: string
  target: string
  targetId?: string
}): string {
  if (input.targetId) return `tid:${input.targetId}`
  return `name:${(input.strategicGoal ?? "").trim().toLowerCase()}|${input.program
    .trim()
    .toLowerCase()}|${input.target.trim().toLowerCase()}`
}

export function computeLateStatus({
  currentQuarter,
  targetQuarter,
  percentage,
  completedInQuarter,
  explicitOverride,
}: {
  currentQuarter: string
  targetQuarter: string
  percentage: number
  completedInQuarter?: string
  explicitOverride?: LateStatus
}): LateStatus {
  if (explicitOverride) return explicitOverride
  if (completedInQuarter) {
    return compareQuarters(completedInQuarter, targetQuarter) > 0
      ? "Pencapaian Terlambat"
      : "Tepat Waktu"
  }
  if (compareQuarters(currentQuarter, targetQuarter) > 0) {
    return percentage >= 100 ? "Pencapaian Terlambat" : "Terlambat"
  }
  return "Tepat Waktu"
}

export function importAnnualSources(
  programs: TriwulanProgramItem[],
  sources: AnnualSource[],
  year: string,
  unit: string,
): TriwulanProgramItem[] {
  const result = structuredClone(programs)

  const existing = new Set(
    result.flatMap((p) =>
      p.sasaranList.flatMap((s) =>
        s.annualSource ? [sourceKey(s.annualSource)] : [],
      ),
    ),
  )

  for (const source of sources) {
    const key = sourceKey(source)

    if (source.year !== year || source.unit !== unit || existing.has(key))
      continue

    existing.add(key)

    const sourceGoalNorm = (source.strategicGoal ?? "").trim().toLowerCase()
    let program = result.find(
      (p) =>
        (p.strategicGoal ?? "").trim().toLowerCase() === sourceGoalNorm &&
        p.sasaranList.some(
          (s) =>
            s.annualSource?.recordId === source.recordId &&
            s.annualSource.programId === source.programId,
        ),
    )

    if (!program) {
      program = {
        id: crypto.randomUUID(),
        strategicGoalId: source.strategicGoalId,
        strategicGoal: source.strategicGoal,
        program: source.program,
        sasaranList: [],
      }

      result.push(program)
    }

    const startQ = quarterFromMonth(source.monthStart) ?? "I"
    const targetQ =
      quarterFromMonth(source.monthEnd || source.monthStart) ?? startQ

    program.sasaranList.push({
      id: crypto.randomUUID(),
      strategicGoalId: source.strategicGoalId,
      strategicGoal: source.strategicGoal,
      target: source.target,
      monthStart: source.monthStart,
      monthEnd: source.monthEnd,
      startQuarter: startQ,
      targetQuarter: targetQ,
      stage: "",
      realization: "",
      percentage: "",
      notes: "",
      obstacle: "",
      solution: "",
      solutionTime: "",
      evidence: "",
      annualSource: structuredClone(source),
    })
  }

  return result.filter(
    (p) =>
      p.program ||
      p.sasaranList.some(
        (s) =>
          s.target ||
          s.realization ||
          s.evidence ||
          s.notes ||
          s.stage ||
          s.monthStart ||
          s.monthEnd ||
          s.percentage ||
          s.obstacle ||
          s.solution ||
          s.solutionTime,
      ),
  )
}

type PriorSasaranHistory = {
  lastQuarter: string
  lastPercentage: number
  lastSasaran: TriwulanSasaranItem
  validatedCompletedQuarter?: string
  explicitLateStatus?: LateStatus
}

function collectPriorQuarterHistory(
  records: HistoryRecord[],
  year: string,
  unitCode: string,
  currentQuarter: string,
): Map<string, PriorSasaranHistory> {
  const map = new Map<string, PriorSasaranHistory>()

  const priorQuarters = QUARTER_ORDER.filter(
    (q) => compareQuarters(q, currentQuarter) < 0,
  )

  for (const q of priorQuarters) {
    const qRecords = records
      .filter(
        (r) =>
          r.type === "Laporan Triwulan" &&
          r.period === `Triwulan ${q} · ${year}` &&
          recordMatchesUnitCode(r, unitCode),
      )
      .sort((a, b) => {
        const statusRank = (s: HistoryRecord["status"]) =>
          s === "Disetujui" ? 4 : s === "Menunggu" ? 3 : s === "Revisi" ? 2 : 1
        const diff = statusRank(b.status) - statusRank(a.status)
        if (diff !== 0) return diff
        return parseSentAtTimestamp(b.sentAt) - parseSentAtTimestamp(a.sentAt)
      })

    const chosen = qRecords[0]
    if (!chosen || !chosen.triwulanPrograms) continue

    for (const prog of chosen.triwulanPrograms) {
      for (const sas of prog.sasaranList) {
        const key = logicalTargetKey({
          strategicGoal: sas.strategicGoal ?? prog.strategicGoal,
          program: prog.program,
          target: sas.target,
          targetId: sas.annualSource?.targetId,
        })
        const pctNum = Math.min(
          100,
          Math.max(0, Number.parseFloat(sas.percentage || "0") || 0),
        )
        const prev = map.get(key)
        const bestPct = Math.max(prev?.lastPercentage ?? 0, pctNum)
        const recordLateOverride = chosen.lateNotes?.[sas.id] ?? sas.lateStatus
        const validated100Quarter =
          prev?.validatedCompletedQuarter ??
          (chosen.status === "Disetujui" && pctNum >= 100 ? q : undefined)

        map.set(key, {
          lastQuarter: q,
          lastPercentage: bestPct,
          lastSasaran: sas,
          validatedCompletedQuarter: validated100Quarter,
          explicitLateStatus: recordLateOverride ?? prev?.explicitLateStatus,
        })
      }
    }
  }

  return map
}

export function syncTriwulanFromApprovedAnnual({
  existingPrograms,
  approvedRecord,
  allRecords,
  year,
  quarter,
  unitCode,
}: {
  existingPrograms: TriwulanProgramItem[]
  approvedRecord: HistoryRecord
  allRecords: HistoryRecord[]
  year: string
  quarter: string
  unitCode: string
}): TriwulanProgramItem[] {
  const sources = extractAnnualSourcesFromRecord(approvedRecord, year, unitCode)
  if (sources.length === 0) return existingPrograms

  const baseImported = importAnnualSources(
    existingPrograms,
    sources,
    year,
    unitCode,
  )

  const priorMap = collectPriorQuarterHistory(
    allRecords,
    year,
    unitCode,
    quarter,
  )

  return baseImported.map((prog) => {
    const nextSasaranList = prog.sasaranList.map((sas) => {
      const startQ =
        sas.startQuarter || quarterFromMonth(sas.monthStart) || "I"
      const targetQ =
        sas.targetQuarter ||
        quarterFromMonth(sas.monthEnd || sas.monthStart) ||
        startQ

      const key = logicalTargetKey({
        strategicGoal: sas.strategicGoal ?? prog.strategicGoal,
        program: prog.program,
        target: sas.target,
        targetId: sas.annualSource?.targetId,
      })

      const prior = priorMap.get(key)

      if (prior?.validatedCompletedQuarter) {
        const lateStatus = computeLateStatus({
          currentQuarter: quarter,
          targetQuarter: targetQ,
          percentage: 100,
          completedInQuarter: prior.validatedCompletedQuarter,
          explicitOverride:
            prior.explicitLateStatus === "Pencapaian Terlambat"
              ? "Pencapaian Terlambat"
              : undefined,
        })
        return {
          ...sas,
          strategicGoalId:
            sas.strategicGoalId ||
            sas.annualSource?.strategicGoalId ||
            prog.strategicGoalId,
          strategicGoal:
            sas.strategicGoal ||
            sas.annualSource?.strategicGoal ||
            prog.strategicGoal,
          startQuarter: startQ,
          targetQuarter: targetQ,
          priorPercentage: 100,
          isLockedCompleted: true,
          completedInQuarter: prior.validatedCompletedQuarter,
          carryOverFromQuarter: undefined,
          stage: sas.stage || prior.lastSasaran.stage,
          stageTargetTime:
            sas.stageTargetTime || prior.lastSasaran.stageTargetTime,
          realization: sas.realization || prior.lastSasaran.realization,
          percentage: "100",
          obstacle: "",
          solution: "",
          solutionTime: "",
          notes:
            sas.notes ||
            prior.lastSasaran.notes ||
            `Selesai 100% pada Triwulan ${prior.validatedCompletedQuarter}`,
          evidence: sas.evidence || prior.lastSasaran.evidence,
          lateStatus,
        }
      }

      const priorPct = prior?.lastPercentage ?? 0
      const isCarryOver =
        Boolean(prior && prior.lastPercentage < 100) ||
        compareQuarters(startQ, quarter) < 0

      const rawCurrentPct = sas.percentage.trim()
      const effectivePctNum =
        rawCurrentPct !== ""
          ? Math.max(priorPct, Number.parseFloat(rawCurrentPct) || 0)
          : priorPct

      const nextPercentageStr =
        rawCurrentPct !== ""
          ? String(effectivePctNum)
          : priorPct > 0
            ? String(priorPct)
            : ""

      const lateStatus = computeLateStatus({
        currentQuarter: quarter,
        targetQuarter: targetQ,
        percentage: effectivePctNum,
        explicitOverride: sas.adminLateNote ? sas.lateStatus : undefined,
      })

      return {
        ...sas,
        strategicGoalId:
          sas.strategicGoalId ||
          sas.annualSource?.strategicGoalId ||
          prog.strategicGoalId,
        strategicGoal:
          sas.strategicGoal ||
          sas.annualSource?.strategicGoal ||
          prog.strategicGoal,
        startQuarter: startQ,
        targetQuarter: targetQ,
        priorPercentage: priorPct,
        isLockedCompleted: false,
        completedInQuarter: undefined,
        carryOverFromQuarter: isCarryOver
          ? prior?.lastQuarter ?? targetQ
          : undefined,
        stage: sas.stage || prior?.lastSasaran.stage || "",
        stageTargetTime:
          sas.stageTargetTime || prior?.lastSasaran.stageTargetTime || "",
        realization: sas.realization || prior?.lastSasaran.realization || "",
        percentage: nextPercentageStr,
        obstacle:
          effectivePctNum >= 100
            ? ""
            : sas.obstacle || prior?.lastSasaran.obstacle || "",
        solution:
          effectivePctNum >= 100
            ? ""
            : sas.solution || prior?.lastSasaran.solution || "",
        solutionTime:
          effectivePctNum >= 100
            ? ""
            : sas.solutionTime || prior?.lastSasaran.solutionTime || "",
        notes: sas.notes || prior?.lastSasaran.notes || "",
        evidence: sas.evidence || prior?.lastSasaran.evidence || "",
        lateStatus,
      }
    })

    return {
      ...prog,
      strategicGoalId:
        prog.strategicGoalId || nextSasaranList[0]?.strategicGoalId || "",
      strategicGoal:
        prog.strategicGoal || nextSasaranList[0]?.strategicGoal || "",
      sasaranList: nextSasaranList,
    }
  })
}
