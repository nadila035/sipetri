import type { HistoryRecord } from "../types/index.ts"

export type ReviewSasaran = {
  id: string
  label: string
  itemIndexes: number[]
}

export type ReviewProgram = {
  id: string
  name: string
  contextLabel?: string
  programItemIndexes: number[]
  sasaranList: ReviewSasaran[]
  itemIndexes: number[]
}

function hasSavedRevision(record: HistoryRecord, index: number): boolean {
  const item = record.items[index]
  return Boolean(item?.needsRevision || item?.note?.trim())
}

function buildTriwulanReviewPrograms(
  record: HistoryRecord,
): ReviewProgram[] | null {
  if (record.type !== "Laporan Triwulan" || !record.triwulanPrograms?.length) {
    return null
  }

  const itemsPerSasaran = 11
  const expectedItemCount = record.triwulanPrograms.reduce(
    (count, program) => count + program.sasaranList.length * itemsPerSasaran,
    0,
  )

  if (expectedItemCount !== record.items.length) return null

  let cursor = 0
  return record.triwulanPrograms.map((program, pIdx) => {
    const programItemIndexes: number[] = []
    const sasaranList: ReviewSasaran[] = program.sasaranList.map((sas, sIdx) => {
      const base = cursor
      cursor += itemsPerSasaran

      if (sIdx === 0 || hasSavedRevision(record, base)) {
        programItemIndexes.push(base)
      }

      return {
        id: sas.id || `${program.id || pIdx}-sas-${sIdx}`,
        label:
          sas.target?.trim() ||
          record.items[base + 1]?.value?.trim() ||
          `Sasaran ${sIdx + 1}`,
        itemIndexes: Array.from(
          { length: itemsPerSasaran - 1 },
          (_, offset) => base + 1 + offset,
        ),
      }
    })

    return {
      id: program.id || `triwulan-prog-${pIdx}`,
      name: program.program || `Program ${pIdx + 1}`,
      programItemIndexes,
      sasaranList,
      itemIndexes: [
        ...programItemIndexes,
        ...sasaranList.flatMap((sas) => sas.itemIndexes),
      ],
    }
  })
}

function buildSasaranKinerjaReviewPrograms(
  record: HistoryRecord,
): ReviewProgram[] | null {
  if (record.type !== "Sasaran Kinerja" || !record.criteriaData?.length) {
    return null
  }

  let cursor = 0
  const pendingIndexes: number[] = []
  const programs: ReviewProgram[] = []

  for (const [cIdx, criteria] of record.criteriaData.entries()) {
    pendingIndexes.push(cursor++)
    const strategies =
      criteria.strategies ?? (criteria.strategy ? [criteria.strategy] : [])

    for (const [stIdx, strategy] of strategies.entries()) {
      pendingIndexes.push(cursor++)

      for (const [pIdx, program] of strategy.programs.entries()) {
        const rawSasaran =
          program.sasaranList && program.sasaranList.length > 0
            ? program.sasaranList
            : program.targets.map((target) => ({
              id: target.id,
              sasaran: target.sasaran ?? target.target ?? "",
            }))

        const programItemIndexes = [...pendingIndexes, cursor++]
        pendingIndexes.length = 0

        const sasaranList: ReviewSasaran[] = rawSasaran.map((sas, sIdx) => {
          const itemIndexes = [cursor, cursor + 1, cursor + 2]
          cursor += 3
          return {
            id: sas.id || `${program.id || pIdx}-sas-${sIdx}`,
            label:
              sas.sasaran?.trim() ||
              record.items[itemIndexes[0]]?.value?.trim() ||
              `Sasaran ${sIdx + 1}`,
            itemIndexes,
          }
        })

        programs.push({
          id: program.id || `sk-prog-${cIdx}-${stIdx}-${pIdx}`,
          name: program.name || `Program ${programs.length + 1}`,
          contextLabel: `Kriteria ${cIdx + 1} · Strategi ${cIdx + 1}.${stIdx + 1}`,
          programItemIndexes,
          sasaranList,
          itemIndexes: [
            ...programItemIndexes,
            ...sasaranList.flatMap((sas) => sas.itemIndexes),
          ],
        })
      }
    }
  }

  if (cursor === record.items.length && programs.length) return programs
  return null
}

function buildTriwulanItemsFallback(
  record: HistoryRecord,
): ReviewProgram[] | null {
  if (
    record.type !== "Laporan Triwulan" ||
    record.items.length === 0 ||
    record.items.length % 11 !== 0 ||
    !record.items.every(
      (item, idx) => idx % 11 !== 0 || item.label === "Program Kerja",
    )
  ) {
    return null
  }

  const byName = new Map<string, ReviewProgram>()
  const result: ReviewProgram[] = []

  for (let i = 0; i < record.items.length; i += 11) {
    const programName =
      record.items[i].value?.trim() ||
      record.title ||
      `Program ${result.length + 1}`
    let entry = byName.get(programName)
    if (!entry) {
      entry = {
        id: `triwulan-fallback-${result.length}`,
        name: programName,
        programItemIndexes: [i],
        sasaranList: [],
        itemIndexes: [],
      }
      byName.set(programName, entry)
      result.push(entry)
    } else if (hasSavedRevision(record, i)) {
      entry.programItemIndexes.push(i)
    }

    const sIdx = entry.sasaranList.length
    entry.sasaranList.push({
      id: `triwulan-fallback-sas-${i}`,
      label: record.items[i + 1]?.value?.trim() || `Sasaran ${sIdx + 1}`,
      itemIndexes: Array.from({ length: 10 }, (_, offset) => i + 1 + offset),
    })
  }

  return result.map((program) => ({
    ...program,
    itemIndexes: [
      ...program.programItemIndexes,
      ...program.sasaranList.flatMap((sas) => sas.itemIndexes),
    ],
  }))
}

function buildGenericItemsFallback(record: HistoryRecord): ReviewProgram[] {
  const programs: ReviewProgram[] = []
  let pendingProgramIndexes: number[] = []
  let currentProgram: ReviewProgram | null = null
  let currentSasaran: ReviewSasaran | null = null

  const ensureProgram = (fallbackName: string) => {
    if (currentProgram) return currentProgram
    currentProgram = {
      id: `generic-prog-${programs.length}`,
      name: fallbackName,
      programItemIndexes: [...pendingProgramIndexes],
      sasaranList: [],
      itemIndexes: [],
    }
    pendingProgramIndexes = []
    programs.push(currentProgram)
    return currentProgram
  }

  record.items.forEach((item, index) => {
    if (item.label === "Kriteria" || item.label === "Strategi") {
      pendingProgramIndexes.push(index)
      currentSasaran = null
      return
    }

    if (item.label === "Program Kerja") {
      currentProgram = {
        id: `generic-prog-${programs.length}`,
        name:
          item.value?.trim() || record.title || `Program ${programs.length + 1}`,
        programItemIndexes: [...pendingProgramIndexes, index],
        sasaranList: [],
        itemIndexes: [],
      }
      pendingProgramIndexes = []
      currentSasaran = null
      programs.push(currentProgram)
      return
    }

    const program = ensureProgram(record.title)

    if (item.label === "Sasaran" || !currentSasaran) {
      const sIdx = program.sasaranList.length
      currentSasaran = {
        id: `generic-sas-${index}`,
        label:
          item.label === "Sasaran"
            ? item.value?.trim() || `Sasaran ${sIdx + 1}`
            : `Sasaran ${sIdx + 1}`,
        itemIndexes: [index],
      }
      program.sasaranList.push(currentSasaran)
      return
    }

    currentSasaran.itemIndexes.push(index)
  })

  if (pendingProgramIndexes.length) {
    const tailProgram = ensureProgram(record.title)
    tailProgram.programItemIndexes.push(...pendingProgramIndexes)
  }

  if (!programs.length) {
    const allIndexes = record.items.map((_, idx) => idx)
    return [
      {
        id: "fallback-0",
        name: record.title,
        programItemIndexes: [],
        sasaranList: allIndexes.length
          ? [
            {
              id: "fallback-sas-0",
              label: record.title,
              itemIndexes: allIndexes,
            },
          ]
          : [],
        itemIndexes: allIndexes,
      },
    ]
  }

  return programs.map((program) => ({
    ...program,
    itemIndexes: [
      ...program.programItemIndexes,
      ...program.sasaranList.flatMap((sas) => sas.itemIndexes),
    ],
  }))
}

export function getReviewPrograms(record: HistoryRecord): ReviewProgram[] {
  return (
    buildTriwulanReviewPrograms(record) ??
    buildSasaranKinerjaReviewPrograms(record) ??
    buildTriwulanItemsFallback(record) ??
    buildGenericItemsFallback(record)
  )
}

export function formatReviewItemLocation(
  record: HistoryRecord,
  programs: ReviewProgram[],
  itemIndex: number,
): string {
  const label = record.items[itemIndex]?.label ?? "Indikator"

  for (const [pIdx, program] of programs.entries()) {
    if (program.programItemIndexes.includes(itemIndex)) {
      return `Program ${pIdx + 1} · ${label}`
    }

    for (const [sIdx, sasaran] of program.sasaranList.entries()) {
      if (sasaran.itemIndexes.includes(itemIndex)) {
        return `Program ${pIdx + 1} · Sasaran ${sIdx + 1} · ${label}`
      }
    }
  }

  return `Indikator ${itemIndex + 1} (${label})`
}

export type ReviewTargetSasaranSlot = {
  id: string
  sasaran: string
  bulanMulai: string
  bulanSelesai: string
  keterangan: string
  sasaranItemIdx: number
  bulanItemIdx: number
  keteranganItemIdx: number
}

export type ReviewTargetProgramSlot = {
  id: string
  name: string
  progItemIdx: number
  sasaranSlots: ReviewTargetSasaranSlot[]
}

export type ReviewTargetStrategySlot = {
  id: string
  name: string
  stratItemIdx: number
  programSlots: ReviewTargetProgramSlot[]
}

export type ReviewTargetCriteriaSlot = {
  id: string
  name: string
  critItemIdx: number
  stratSlots: ReviewTargetStrategySlot[]
}

export function getSasaranKinerjaReviewCriteria(
  record: HistoryRecord,
): ReviewTargetCriteriaSlot[] {
  if (record.criteriaData?.length) {
    let cursor = 0
    const criteriaSlots: ReviewTargetCriteriaSlot[] = record.criteriaData.map(
      (crit, cIdx) => {
        const critItemIdx = cursor++
        const strats =
          crit.strategies && crit.strategies.length > 0
            ? crit.strategies
            : crit.strategy
              ? [crit.strategy]
              : []

        const stratSlots: ReviewTargetStrategySlot[] = strats.map(
          (strat, stIdx) => {
            const stratItemIdx = cursor++
            const programSlots: ReviewTargetProgramSlot[] = strat.programs.map(
              (prog, pIdx) => {
                const progItemIdx = cursor++
                const sList =
                  prog.sasaranList && prog.sasaranList.length > 0
                    ? prog.sasaranList
                    : prog.targets.map((t) => ({
                        id: t.id,
                        sasaran: t.sasaran ?? t.target ?? "",
                        bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                        bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                        keterangan: t.keterangan ?? t.notes ?? "",
                      }))

                const sasaranSlots: ReviewTargetSasaranSlot[] = sList.map(
                  (sas, sIdx) => ({
                    id: sas.id || `${prog.id || pIdx}-sas-${sIdx}`,
                    sasaran: sas.sasaran || "-",
                    bulanMulai: sas.bulan_mulai || "",
                    bulanSelesai: sas.bulan_selesai || "",
                    keterangan: sas.keterangan || "-",
                    sasaranItemIdx: cursor++,
                    bulanItemIdx: cursor++,
                    keteranganItemIdx: cursor++,
                  }),
                )

                return {
                  id: prog.id || `prog-${cIdx}-${stIdx}-${pIdx}`,
                  name: prog.name || "-",
                  progItemIdx,
                  sasaranSlots,
                }
              },
            )

            return {
              id: strat.id || `strat-${cIdx}-${stIdx}`,
              name: strat.name || "-",
              stratItemIdx,
              programSlots,
            }
          },
        )

        return {
          id: crit.id || `crit-${cIdx}`,
          name: crit.name || "-",
          critItemIdx,
          stratSlots,
        }
      },
    )

    if (record.items.length > 0 && cursor === record.items.length) {
      return criteriaSlots
    }
  }

  // Fallback for legacy/flat Sasaran Kinerja items without criteriaData
  const criteriaSlots: ReviewTargetCriteriaSlot[] = []
  let currentCrit: ReviewTargetCriteriaSlot | null = null
  let currentStrat: ReviewTargetStrategySlot | null = null
  let currentProg: ReviewTargetProgramSlot | null = null
  let currentSas: ReviewTargetSasaranSlot | null = null

  const ensureCrit = (name: string, critItemIdx = -1) => {
    if (currentCrit) return currentCrit
    currentCrit = {
      id: `fallback-crit-${criteriaSlots.length}`,
      name,
      critItemIdx,
      stratSlots: [],
    }
    criteriaSlots.push(currentCrit)
    return currentCrit
  }

  const ensureStrat = (name: string, stratItemIdx = -1) => {
    const crit = ensureCrit(record.title)
    if (currentStrat) return currentStrat
    currentStrat = {
      id: `fallback-strat-${crit.stratSlots.length}`,
      name,
      stratItemIdx,
      programSlots: [],
    }
    crit.stratSlots.push(currentStrat)
    return currentStrat
  }

  const ensureProg = (name: string, progItemIdx = -1) => {
    const strat = ensureStrat("-")
    if (currentProg) return currentProg
    currentProg = {
      id: `fallback-prog-${strat.programSlots.length}`,
      name,
      progItemIdx,
      sasaranSlots: [],
    }
    strat.programSlots.push(currentProg)
    return currentProg
  }

  const ensureSas = (name: string, sasaranItemIdx = -1) => {
    const prog = ensureProg(record.title)
    if (currentSas) return currentSas
    currentSas = {
      id: `fallback-sas-${prog.sasaranSlots.length}`,
      sasaran: name,
      bulanMulai: "-",
      bulanSelesai: "",
      keterangan: "-",
      sasaranItemIdx,
      bulanItemIdx: -1,
      keteranganItemIdx: -1,
    }
    prog.sasaranSlots.push(currentSas)
    return currentSas
  }

  record.items.forEach((item, idx) => {
    if (item.label === "Kriteria") {
      currentCrit = {
        id: `fallback-crit-${criteriaSlots.length}`,
        name: item.value || "-",
        critItemIdx: idx,
        stratSlots: [],
      }
      criteriaSlots.push(currentCrit)
      currentStrat = null
      currentProg = null
      currentSas = null
      return
    }

    if (item.label === "Strategi") {
      const crit = ensureCrit(record.title)
      currentStrat = {
        id: `fallback-strat-${crit.stratSlots.length}`,
        name: item.value || "-",
        stratItemIdx: idx,
        programSlots: [],
      }
      crit.stratSlots.push(currentStrat)
      currentProg = null
      currentSas = null
      return
    }

    if (item.label === "Program Kerja") {
      const strat = ensureStrat("-")
      currentProg = {
        id: `fallback-prog-${strat.programSlots.length}`,
        name: item.value || "-",
        progItemIdx: idx,
        sasaranSlots: [],
      }
      strat.programSlots.push(currentProg)
      currentSas = null
      return
    }

    if (item.label === "Sasaran") {
      const prog = ensureProg(record.title)
      currentSas = {
        id: `fallback-sas-${prog.sasaranSlots.length}`,
        sasaran: item.value || "-",
        bulanMulai: "-",
        bulanSelesai: "",
        keterangan: "-",
        sasaranItemIdx: idx,
        bulanItemIdx: -1,
        keteranganItemIdx: -1,
      }
      prog.sasaranSlots.push(currentSas)
      return
    }

    const sas = ensureSas("-")
    if (item.label.includes("Bulan")) {
      sas.bulanMulai = item.value || "-"
      sas.bulanItemIdx = idx
    } else if (item.label === "Keterangan") {
      sas.keterangan = item.value || "-"
      sas.keteranganItemIdx = idx
    }
  })

  return criteriaSlots
}

