import type {
  CriteriaItem,
  HistoryItem,
  HistoryRecord,
  SasaranItem,
  StrategyItem,
  TriwulanProgramItem,
  TriwulanSasaranItem,
  WorkProgram,
} from "../types/index.ts"

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

export function createEmptySasaran(): SasaranItem {
  return {
    id: makeId("sasaran"),
    sasaran: "",
    bulan_mulai: "",
    bulan_selesai: "",
    keterangan: "",
    target: "",
    monthStart: "",
    monthEnd: "",
    notes: "",
  }
}

export function createEmptyWorkProgram(): WorkProgram {
  const defaultSasaran = createEmptySasaran()
  return {
    id: makeId("program"),
    name: "",
    sasaranList: [defaultSasaran],
    targets: [
      {
        id: defaultSasaran.id,
        target: "",
        monthStart: "",
        monthEnd: "",
        notes: "",
      },
    ],
  }
}

export function createEmptyStrategy(): StrategyItem {
  return {
    id: makeId("strategy"),
    strategicGoalId: "",
    name: "",
    programs: [createEmptyWorkProgram()],
  }
}

export function createEmptyCriteria(): CriteriaItem {
  const defaultStrategy = createEmptyStrategy()
  return {
    id: makeId("criteria"),
    name: "",
    strategies: [defaultStrategy],
    strategy: defaultStrategy,
  }
}

export function createEmptyTriwulanSasaran(id?: string): TriwulanSasaranItem {
  return {
    id: id || makeId("tw-sasaran"),
    strategicGoalId: "",
    strategicGoal: "",
    target: "",
    monthStart: "",
    monthEnd: "",
    stage: "",
    stageTargetTime: "",
    realization: "",
    percentage: "",
    notes: "",
    obstacle: "",
    solution: "",
    solutionTime: "",
    evidence: "",
  }
}

export function createEmptyTriwulanProgram(id?: string): TriwulanProgramItem {
  return {
    id: id || makeId("tw-program"),
    strategicGoalId: "",
    strategicGoal: "",
    program: "",
    sasaranList: [createEmptyTriwulanSasaran()],
  }
}

export function insertItemAt<T>(items: T[], index: number, item: T): T[] {
  const bounded = Math.max(0, Math.min(index, items.length))
  return [...items.slice(0, bounded), item, ...items.slice(bounded)]
}

export function getStrategies(item: CriteriaItem): StrategyItem[] {
  return Array.isArray(item.strategies) && item.strategies.length > 0
    ? item.strategies
    : item.strategy
      ? [item.strategy]
      : []
}

export function getProgramSasaran(program: WorkProgram): SasaranItem[] {
  if (Array.isArray(program.sasaranList) && program.sasaranList.length > 0) {
    return program.sasaranList.map((s) => ({
      id: s.id || makeId("sasaran"),
      sasaran: s.sasaran ?? s.target ?? "",
      bulan_mulai: s.bulan_mulai ?? s.monthStart ?? "",
      bulan_selesai: s.bulan_selesai ?? s.monthEnd ?? "",
      keterangan: s.keterangan ?? s.notes ?? "",
      target: s.target ?? s.sasaran ?? "",
      monthStart: s.monthStart ?? s.bulan_mulai ?? "",
      monthEnd: s.monthEnd ?? s.bulan_selesai ?? "",
      notes: s.notes ?? s.keterangan ?? "",
    }))
  }
  if (Array.isArray(program.targets) && program.targets.length > 0) {
    return program.targets.map((t) => ({
      id: t.id || makeId("sasaran"),
      sasaran: t.sasaran ?? t.target ?? "",
      bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
      bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
      keterangan: t.keterangan ?? t.notes ?? "",
      target: t.target ?? t.sasaran ?? "",
      monthStart: t.monthStart ?? t.bulan_mulai ?? "",
      monthEnd: t.monthEnd ?? t.bulan_selesai ?? "",
      notes: t.notes ?? t.keterangan ?? "",
    }))
  }
  return [createEmptySasaran()]
}

export function normalizeCriteriaList(raw: unknown): CriteriaItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [createEmptyCriteria()]
  return raw.map((c: any) => {
    const rawStrategies =
      Array.isArray(c?.strategies) && c.strategies.length > 0
        ? c.strategies
        : c?.strategy
          ? [c.strategy]
          : []
    const strategies: StrategyItem[] = (
      rawStrategies.length > 0 ? rawStrategies : [createEmptyStrategy()]
    ).map((s: any) => ({
      id: s?.id || makeId("strategy"),
      strategicGoalId:
        typeof s?.strategicGoalId === "string" ? s.strategicGoalId : "",
      name:
        typeof s?.name === "string" && s.name
          ? s.name
          : typeof c?.name === "string"
            ? c.name
            : "",
      programs: (
        Array.isArray(s?.programs) && s.programs.length > 0
          ? s.programs
          : [createEmptyWorkProgram()]
      ).map((p: any) => {
        const sasaranList = getProgramSasaran(p ?? {})
        return {
          id: p?.id || makeId("program"),
          name: typeof p?.name === "string" ? p.name : "",
          sasaranList,
          targets: sasaranList.map((st) => ({
            id: st.id,
            target: st.sasaran,
            monthStart: st.bulan_mulai,
            monthEnd: st.bulan_selesai,
            notes: st.keterangan,
          })),
        }
      }),
    }))
    const syncedName =
      typeof c?.name === "string" && c.name
        ? c.name
        : strategies[0]?.name || ""
    return {
      id: c?.id || makeId("criteria"),
      name: syncedName,
      strategy: strategies[0],
      strategies,
    }
  })
}

export function normalizeTriwulanPrograms(raw: unknown): TriwulanProgramItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [createEmptyTriwulanProgram()]
  return raw.map((r: any, idx: number) => {
    if (Array.isArray(r?.sasaranList) && r.sasaranList.length > 0) {
      const progGoal =
        r?.strategicGoal ||
        r.sasaranList[0]?.strategicGoal ||
        r.sasaranList[0]?.annualSource?.strategicGoal ||
        ""
      const progGoalId =
        r?.strategicGoalId ||
        r.sasaranList[0]?.strategicGoalId ||
        r.sasaranList[0]?.annualSource?.strategicGoalId ||
        ""
      return {
        id: r.id || `program-${idx + 1}`,
        strategicGoalId: progGoalId,
        strategicGoal: progGoal,
        program: r.program || "",
        sasaranList: r.sasaranList.map((s: any, sIdx: number) => ({
          annualSource: s?.annualSource,
          id: s?.id || `sasaran-${idx + 1}-${sIdx + 1}`,
          strategicGoalId:
            s?.strategicGoalId ||
            s?.annualSource?.strategicGoalId ||
            progGoalId,
          strategicGoal:
            s?.strategicGoal || s?.annualSource?.strategicGoal || progGoal,
          target: s?.target || s?.sasaran || "",
          monthStart: s?.monthStart || s?.bulan_mulai || "",
          monthEnd: s?.monthEnd || s?.bulan_selesai || "",
          stage: s?.stage || "",
          stageTargetTime: s?.stageTargetTime || "",
          realization: s?.realization || "",
          percentage:
            s?.percentage !== undefined && s?.percentage !== null
              ? String(s.percentage)
              : "",
          ...(typeof s?.priorPercentage === "number"
            ? { priorPercentage: s.priorPercentage }
            : {}),
          ...(typeof s?.carryOverFromQuarter === "string" &&
          s.carryOverFromQuarter
            ? { carryOverFromQuarter: s.carryOverFromQuarter }
            : {}),
          ...(typeof s?.startQuarter === "string" && s.startQuarter
            ? { startQuarter: s.startQuarter }
            : {}),
          ...(typeof s?.targetQuarter === "string" && s.targetQuarter
            ? { targetQuarter: s.targetQuarter }
            : {}),
          ...(typeof s?.isLockedCompleted === "boolean"
            ? { isLockedCompleted: s.isLockedCompleted }
            : {}),
          ...(typeof s?.completedInQuarter === "string" && s.completedInQuarter
            ? { completedInQuarter: s.completedInQuarter }
            : {}),
          ...(typeof s?.lateStatus === "string" && s.lateStatus
            ? { lateStatus: s.lateStatus }
            : {}),
          ...(typeof s?.adminLateNote === "string" && s.adminLateNote
            ? { adminLateNote: s.adminLateNote }
            : {}),
          ...(typeof s?.draftSavedAt === "string" && s.draftSavedAt
            ? { draftSavedAt: s.draftSavedAt }
            : {}),
          notes: s?.notes || s?.keterangan || "",
          obstacle: s?.obstacle || "",
          solution: s?.solution || "",
          solutionTime: s?.solutionTime || "",
          evidence: s?.evidence || "",
        })),
      }
    }
    return {
      id: r?.id || `program-${idx + 1}`,
      strategicGoalId: r?.strategicGoalId || "",
      strategicGoal: r?.strategicGoal || "",
      program: r?.program || "",
      sasaranList: [
        {
          id: `sasaran-${idx + 1}-1`,
          strategicGoalId: r?.strategicGoalId || "",
          strategicGoal: r?.strategicGoal || "",
          target: r?.target || "",
          monthStart: r?.monthStart || "",
          monthEnd: r?.monthEnd || "",
          stage: r?.stage || "",
          stageTargetTime: r?.stageTargetTime || "",
          realization: r?.realization || "",
          percentage:
            r?.percentage !== undefined && r?.percentage !== null
              ? String(r.percentage)
              : "",
          notes: r?.notes || "",
          obstacle: r?.obstacle || "",
          solution: r?.solution || "",
          solutionTime: r?.solutionTime || "",
          evidence: r?.evidence || "",
        },
      ],
    }
  })
}

export function hasCriteriaContent(
  criteria: CriteriaItem[],
  unit = "",
  subUnit = "",
): boolean {
  if (unit.trim() || subUnit.trim()) return true
  if (criteria.length > 1) return true
  return criteria.some((item) => {
    if (item.name.trim()) return true
    const strategies = getStrategies(item)
    if (strategies.length > 1) return true
    return strategies.some((strategy) => {
      if (strategy.name.trim()) return true
      if (strategy.programs.length > 1) return true
      return strategy.programs.some((program) => {
        if (program.name.trim()) return true
        const sasaranList = getProgramSasaran(program)
        if (sasaranList.length > 1) return true
        return sasaranList.some(
          (s) =>
            s.sasaran.trim() ||
            s.bulan_mulai.trim() ||
            (s.bulan_selesai ?? "").trim() ||
            s.keterangan.trim(),
        )
      })
    })
  })
}

export function hasTriwulanContent(
  programs: TriwulanProgramItem[],
  unit: string,
  subUnit: string,
): boolean {
  if (unit.trim() || subUnit.trim()) return true
  if (programs.length > 1) return true
  return programs.some((program) => {
    if ((program.strategicGoal ?? "").trim() || program.program.trim()) {
      return true
    }
    if (program.sasaranList.length > 1) return true
    return program.sasaranList.some((s) =>
      [
        s.strategicGoal ?? "",
        s.target,
        s.monthStart,
        s.monthEnd ?? "",
        s.stage,
        s.stageTargetTime ?? "",
        s.realization,
        s.percentage,
        s.notes,
        s.obstacle,
        s.solution,
        s.solutionTime,
        s.evidence,
      ].some((val) => val.trim() !== ""),
    )
  })
}

export function calculateSasaranKinerjaCompleteness(
  criteria: CriteriaItem[],
): number {
  let total = 0
  let completed = 0
  for (const item of criteria) {
    const strategies = getStrategies(item)
    for (const strategy of strategies) {
      const strategicGoalName = strategy.name.trim() || item.name.trim()
      for (const program of strategy.programs) {
        const sasaranList = getProgramSasaran(program)
        for (const sasaran of sasaranList) {
          total += 1
          const validDates =
            Boolean(sasaran.bulan_mulai) &&
            (!sasaran.bulan_selesai ||
              sasaran.bulan_selesai >= sasaran.bulan_mulai)
          if (
            strategicGoalName &&
            program.name.trim() &&
            sasaran.sasaran.trim() &&
            validDates
          ) {
            completed += 1
          }
        }
      }
    }
  }
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

export type FlatSasaranInputRow = {
  criteriaId?: string
  strategyId?: string
  strategicGoalId: string
  strategicGoal: string
  programId?: string
  programName: string
  sasaranId: string
  sasaranText: string
  bulanMulai: string
  bulanSelesai: string
  keterangan: string
}

export function extractFlatSasaranRows(
  criteria: CriteriaItem[],
): FlatSasaranInputRow[] {
  const rows: FlatSasaranInputRow[] = []
  for (const crit of criteria) {
    const strategies = getStrategies(crit)
    for (const strat of strategies) {
      const goalName = strat.name.trim() || crit.name.trim()
      for (const prog of strat.programs) {
        const sList = getProgramSasaran(prog)
        for (const sas of sList) {
          const hasAnyField = Boolean(
            goalName ||
              prog.name.trim() ||
              sas.sasaran.trim() ||
              sas.bulan_mulai.trim() ||
              (sas.bulan_selesai ?? "").trim() ||
              sas.keterangan.trim(),
          )
          if (!hasAnyField && criteria.length === 1 && rows.length === 0) {
            continue
          }
          rows.push({
            criteriaId: crit.id,
            strategyId: strat.id,
            strategicGoalId: strat.strategicGoalId ?? "",
            strategicGoal: goalName,
            programId: prog.id,
            programName: prog.name,
            sasaranId: sas.id,
            sasaranText: sas.sasaran,
            bulanMulai: sas.bulan_mulai,
            bulanSelesai: sas.bulan_selesai ?? "",
            keterangan: sas.keterangan,
          })
        }
      }
    }
  }
  return rows
}

export function rebuildCriteriaFromFlatRows(
  rows: FlatSasaranInputRow[],
): CriteriaItem[] {
  if (rows.length === 0) return []

  const usedCriteriaIds = new Set<string>()
  const usedStrategyIds = new Set<string>()
  const usedProgramIds = new Set<string>()
  const usedSasaranIds = new Set<string>()

  const claimId = (
    preferred: string | undefined,
    used: Set<string>,
    prefix: string,
  ): string => {
    const clean = preferred?.trim() ?? ""
    if (clean && !used.has(clean)) {
      used.add(clean)
      return clean
    }
    let next = makeId(prefix)
    while (used.has(next)) {
      next = makeId(prefix)
    }
    used.add(next)
    return next
  }

  const normKey = (val: string) => val.trim().replace(/\s+/g, " ").toLowerCase()
  const criteriaOut: CriteriaItem[] = []

  let cursor = 0
  while (cursor < rows.length) {
    const firstGoalRow = rows[cursor]
    const goalKey = normKey(firstGoalRow.strategicGoal)
    let goalEnd = cursor
    if (goalKey) {
      while (
        goalEnd + 1 < rows.length &&
        normKey(rows[goalEnd + 1].strategicGoal) === goalKey
      ) {
        goalEnd += 1
      }
    }

    const programsOut: WorkProgram[] = []
    let pCursor = cursor
    while (pCursor <= goalEnd) {
      const firstProgRow = rows[pCursor]
      const progKey = normKey(firstProgRow.programName)
      let progEnd = pCursor
      if (progKey) {
        while (
          progEnd + 1 <= goalEnd &&
          normKey(rows[progEnd + 1].programName) === progKey
        ) {
          progEnd += 1
        }
      }

      const sasaranList: SasaranItem[] = []
      for (let sIdx = pCursor; sIdx <= progEnd; sIdx++) {
        const r = rows[sIdx]
        const sId = claimId(r.sasaranId, usedSasaranIds, "sasaran")
        const sasText = r.sasaranText
        const bMulai = r.bulanMulai
        const bSelesai = r.bulanSelesai
        const ket = r.keterangan
        sasaranList.push({
          id: sId,
          sasaran: sasText,
          bulan_mulai: bMulai,
          bulan_selesai: bSelesai,
          keterangan: ket,
          target: sasText,
          monthStart: bMulai,
          monthEnd: bSelesai,
          notes: ket,
        })
      }

      programsOut.push({
        id: claimId(firstProgRow.programId, usedProgramIds, "program"),
        name: firstProgRow.programName,
        sasaranList,
        targets: sasaranList.map((s) => ({
          id: s.id,
          target: s.sasaran,
          monthStart: s.bulan_mulai,
          monthEnd: s.bulan_selesai,
          notes: s.keterangan,
        })),
      })

      pCursor = progEnd + 1
    }

    const strat: StrategyItem = {
      id: claimId(firstGoalRow.strategyId, usedStrategyIds, "strategy"),
      strategicGoalId: firstGoalRow.strategicGoalId,
      name: firstGoalRow.strategicGoal,
      programs: programsOut,
    }

    criteriaOut.push({
      id: claimId(firstGoalRow.criteriaId, usedCriteriaIds, "criteria"),
      name: firstGoalRow.strategicGoal,
      strategy: strat,
      strategies: [strat],
    })

    cursor = goalEnd + 1
  }

  return criteriaOut
}

export function buildSasaranKinerjaItems(
  criteria: CriteriaItem[],
): HistoryItem[] {
  return criteria.flatMap((item) => {
    const strategies = getStrategies(item)
    return strategies.flatMap((strategy) => {
      const strategicGoal = strategy.name.trim() || item.name.trim()
      return [
        { label: "Sasaran Strategis", value: strategicGoal },
        ...strategy.programs.flatMap((program) => {
          const sList = getProgramSasaran(program)
          return [
            { label: "Program Kerja", value: program.name },
            ...sList.flatMap((sasaran) => [
              { label: "Sasaran Kinerja", value: sasaran.sasaran },
              {
                label: "Bulan Pelaksanaan",
                value: sasaran.bulan_selesai
                  ? `${sasaran.bulan_mulai} - ${sasaran.bulan_selesai}`
                  : sasaran.bulan_mulai,
              },
              { label: "Keterangan", value: sasaran.keterangan || "-" },
            ]),
          ]
        }),
      ]
    })
  })
}

const STAGE_TARGET_TIME_PREFIX = "Target/Waktu Selesai:"

export function formatStageWithTargetTime(
  stage: string,
  stageTargetTime?: string,
): string {
  const base = stage.trim()
  const time = stageTargetTime?.trim()
  if (!time) return stage
  if (base.includes(STAGE_TARGET_TIME_PREFIX)) return stage
  return base
    ? `${base}\n${STAGE_TARGET_TIME_PREFIX} ${time}`
    : `${STAGE_TARGET_TIME_PREFIX} ${time}`
}

export function splitStageTargetTime(value: string): {
  stage: string
  stageTargetTime: string
} {
  const lines = value.split(/\r?\n/)
  const targetIdx = lines.findIndex((line) =>
    line.trim().startsWith(STAGE_TARGET_TIME_PREFIX),
  )
  if (targetIdx < 0) return { stage: value, stageTargetTime: "" }
  const extractedTime = lines[targetIdx]
    .trim()
    .slice(STAGE_TARGET_TIME_PREFIX.length)
    .trim()
  const remaining = [
    ...lines.slice(0, targetIdx),
    ...lines.slice(targetIdx + 1),
  ]
    .join("\n")
    .trim()
  return { stage: remaining, stageTargetTime: extractedTime }
}

export const TRIWULAN_ITEMS_PER_SASARAN = 12

export function buildTriwulanItems(
  programs: TriwulanProgramItem[],
): HistoryItem[] {
  return programs.flatMap((prog) =>
    prog.sasaranList.flatMap((sas) => {
      const strategicGoal =
        sas.strategicGoal?.trim() ||
        prog.strategicGoal?.trim() ||
        sas.annualSource?.strategicGoal?.trim() ||
        "-"
      const periodeBulan =
        sas.monthEnd && sas.monthEnd.trim()
          ? `${sas.monthStart} - ${sas.monthEnd}`
          : sas.monthStart
      const persenStr = sas.percentage.trim() ? `${sas.percentage}%` : "0%"
      return [
        { label: "Sasaran Strategis", value: strategicGoal },
        { label: "Program Kerja", value: prog.program },
        { label: "Sasaran", value: sas.target },
        { label: "Bulan Pelaksanaan", value: periodeBulan },
        {
          label: "Tahap Pelaksanaan",
          value: formatStageWithTargetTime(sas.stage, sas.stageTargetTime),
        },
        { label: "Realisasi Pelaksanaan", value: sas.realization },
        { label: "Realisasi (%)", value: persenStr },
        { label: "Kendala", value: sas.obstacle },
        { label: "Rencana Penyelesaian", value: sas.solution },
        { label: "Waktu Penyelesaian", value: sas.solutionTime },
        { label: "Keterangan", value: sas.notes },
        { label: "Link Evidence", value: sas.evidence },
      ]
    }),
  )
}

export function formatUpdatedAtLabel(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function upsertDraftRecord(
  records: HistoryRecord[],
  draft: HistoryRecord,
): HistoryRecord[] {
  const exists = records.some((r) => r.id === draft.id)
  if (!exists) return [draft, ...records]
  return records.map((r) => (r.id === draft.id ? draft : r))
}

export function promoteDraftToSubmitted(
  records: HistoryRecord[],
  activeDraftId: string | null,
  submitted: HistoryRecord,
): HistoryRecord[] {
  const withoutDraft = activeDraftId
    ? records.filter((r) => r.id !== activeDraftId)
    : records
  return [submitted, ...withoutDraft]
}

export function extractDashboardAnnualMetrics(
  records: HistoryRecord[],
  year: string,
) {
  const submittedAnnual = records.filter(
    (record) =>
      record.type === "Sasaran Kinerja" &&
      record.period === `Tahun ${year}` &&
      record.status !== "Draf",
  )

  const criteriaList = submittedAnnual.flatMap(
    (record) => record.criteriaData ?? [],
  )
  const allStrategies = criteriaList.flatMap(getStrategies)
  const strategies = allStrategies.filter((item) => item.name.trim())
  const programs = allStrategies
    .flatMap((item) => item.programs)
    .filter((program) => program.name.trim())

  const normalizedPrograms = programs.map((program) => ({
    program,
    sasaranList: getProgramSasaran(program),
  }))

  const currentPrograms = normalizedPrograms.filter(({ sasaranList }) =>
    sasaranList.some(
      (target) =>
        target.bulan_mulai &&
        target.bulan_mulai <= `${year}-12` &&
        (!target.bulan_selesai || target.bulan_selesai >= `${year}-01`),
    ),
  )

  const targets = normalizedPrograms
    .flatMap(({ sasaranList }) => sasaranList)
    .filter(
      (target) =>
        target.sasaran.trim() &&
        target.bulan_mulai &&
        target.bulan_mulai <= `${year}-12` &&
        (!target.bulan_selesai || target.bulan_selesai >= `${year}-01`),
    )

  const currentProgramSet = new Set(currentPrograms.map((entry) => entry.program))
  const currentStrategies = strategies.filter((strategy) =>
    (strategy.programs ?? []).some((program) => currentProgramSet.has(program)),
  )

  return {
    strategies,
    currentStrategies,
    currentPrograms,
    targets,
  }
}
