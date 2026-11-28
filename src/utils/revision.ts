import type { HistoryRecord } from "../types"
import {
  formatStageWithTargetTime,
  splitStageTargetTime,
} from "./drafts.ts"

export function reviseRecord(
  record: HistoryRecord,
  edits: Record<number, string>,
  actorName?: string,
): HistoryRecord {
  if (record.status !== "Revisi") return record

  const items = record.items.map((item, i) => ({
    ...item,
    value: edits[i] ?? item.value,
    note: undefined,
    needsRevision: false,
  }))

  const values = new Map<string, string[]>()

  items.forEach((item) =>
    values.set(item.label, [...(values.get(item.label) ?? []), item.value]),
  )

  const take = (label: string, fallback: string) =>
    values.get(label)?.shift() ?? fallback

  const takeAny = (labels: string[], fallback: string) => {
    for (const label of labels) {
      const bucket = values.get(label)
      if (bucket && bucket.length > 0) {
        return bucket.shift() ?? fallback
      }
    }
    return fallback
  }

  const dates = (value: string) => value.split(/\s+[–-]\s+/)

  const triwulanPrograms = record.triwulanPrograms?.map((p) => {
    let program = p.program
    let strategicGoal = p.strategicGoal ?? ""
    let updatedProgram = false
    let updatedGoal = false

    const sasaranList = p.sasaranList.map((s, sIdx) => {
      const takenGoal = take(
        "Sasaran Strategis",
        s.strategicGoal || strategicGoal,
      )
      if (sIdx === 0 && takenGoal && takenGoal !== "-") {
        strategicGoal = takenGoal
        updatedGoal = true
      }

      const takenProgram = take("Program Kerja", program)
      if (sIdx === 0) {
        program = takenProgram
        updatedProgram = true
      }

      const resolvedGoal = updatedGoal
        ? strategicGoal
        : takenGoal && takenGoal !== "-"
          ? takenGoal
          : s.strategicGoal || strategicGoal
      const resolvedProgram = updatedProgram ? program : takenProgram

      const target = take("Sasaran", s.target)

      const [monthStart, monthEnd] = dates(
        take(
          "Bulan Pelaksanaan",
          [s.monthStart, s.monthEnd].filter(Boolean).join(" - "),
        ),
      )

      const parsedStage = splitStageTargetTime(
        take(
          "Tahap Pelaksanaan",
          formatStageWithTargetTime(s.stage, s.stageTargetTime),
        ),
      )

      program = resolvedProgram

      return {
        ...s,
        strategicGoal: resolvedGoal,
        target,
        monthStart,
        monthEnd,
        stage: parsedStage.stage,
        stageTargetTime: parsedStage.stageTargetTime,
        realization: take("Realisasi Pelaksanaan", s.realization),
        percentage: take("Realisasi (%)", s.percentage).replace("%", ""),
        obstacle: take("Kendala", s.obstacle),
        solution: take("Rencana Penyelesaian", s.solution),
        solutionTime: take("Waktu Penyelesaian", s.solutionTime),
        notes: take("Keterangan", s.notes),
        evidence: take("Link Evidence", s.evidence),
      }
    })

    return { ...p, strategicGoal, program, sasaranList }
  })

  const criteriaData = record.criteriaData?.map((c) => {
    const legacyCriteriaName = take("Kriteria", "")

    const strategies = (c.strategies ?? [c.strategy]).map((st) => {
      const stratName = takeAny(
        ["Sasaran Strategis", "Strategi"],
        st.name || c.name,
      )
      return {
        ...st,
        name: stratName,
        programs: st.programs.map((p) => {
          const name = take("Program Kerja", p.name)

          const sasaranList = (
            p.sasaranList ??
            p.targets.map((t) => ({
              id: t.id,
              sasaran: t.target,
              bulan_mulai: t.monthStart,
              bulan_selesai: t.monthEnd,
              keterangan: t.notes,
            }))
          ).map((s) => {
            const sasaran = takeAny(
              ["Sasaran Kinerja", "Sasaran"],
              s.sasaran,
            )

            const [bulan_mulai, bulan_selesai] = dates(
              take(
                "Bulan Pelaksanaan",
                [s.bulan_mulai, s.bulan_selesai].filter(Boolean).join(" - "),
              ),
            )

            return {
              ...s,
              sasaran,
              bulan_mulai,
              bulan_selesai,
              keterangan: take("Keterangan", s.keterangan),
            }
          })

          return {
            ...p,
            name,
            sasaranList,
            targets: sasaranList.map((s) => ({
              id: s.id,
              target: s.sasaran,
              monthStart: s.bulan_mulai,
              monthEnd: s.bulan_selesai,
              notes: s.keterangan,
            })),
          }
        }),
      }
    })

    const nextCriteriaName =
      legacyCriteriaName || strategies[0]?.name || c.name

    return {
      ...c,
      name: nextCriteriaName,
      strategies,
      strategy: strategies[0],
    }
  })

  return {
    ...record,
    items,
    criteriaData,
    triwulanPrograms,
    status: "Menunggu",
    sentAt: new Date().toLocaleString("id-ID"),
    reviews: [
      ...(record.reviews ?? []),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor: `${actorName || record.author || "Staf Unit"} (staf)`,
        action: "Menunggu",
        notes: {},
      },
    ],
  }
}
