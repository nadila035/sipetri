import type {
  HistoryRecord,
  TriwulanProgramItem,
  TriwulanSasaranItem,
} from "../types/index.ts"

export type AnnualSource = NonNullable<TriwulanSasaranItem["annualSource"]>

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
        r.unit === unit,
    )
    .flatMap((record) =>
      (record.criteriaData ?? []).flatMap((criteria) =>
        (criteria.strategies ?? [criteria.strategy]).flatMap((strategy) =>
          strategy.programs.flatMap((program) =>
            (program.sasaranList ?? program.targets).map((target) => ({
              recordId: record.id,
              criteriaId: criteria.id,
              strategyId: strategy.id,
              programId: program.id,
              targetId: target.id,

              year,
              unit,
              status: record.status,
              capturedAt: record.sentAt,

              program: program.name,
              target: target.sasaran ?? target.target ?? "",

              monthStart: target.bulan_mulai ?? target.monthStart ?? "",
              monthEnd: target.bulan_selesai ?? target.monthEnd ?? "",

              notes: target.keterangan ?? target.notes ?? "",
            })),
          ),
        ),
      ),
    )
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

    let program = result.find((p) =>
      p.sasaranList.some(
        (s) =>
          s.annualSource?.recordId === source.recordId &&
          s.annualSource.programId === source.programId,
      ),
    )

    if (!program) {
      program = {
        id: crypto.randomUUID(),
        program: source.program,
        sasaranList: [],
      }

      result.push(program)
    }

    program.sasaranList.push({
      id: crypto.randomUUID(),
      target: source.target,
      monthStart: source.monthStart,
      monthEnd: source.monthEnd,

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
