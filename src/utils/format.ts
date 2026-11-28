import type { HistoryRecord, LateStatus } from "../types/index.ts"
import { formatStageWithTargetTime } from "./drafts.ts"
import { getSasaranKinerjaReviewCriteria } from "./review.ts"

export const formatBulanPelaksanaan = (
  mulai?: string,
  selesai?: string,
): string => {
  if (!mulai) return "-"
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ]
  const parseM = (val: string) => {
    const parts = val.split("-")
    if (
      parts.length === 2 &&
      !isNaN(Number(parts[0])) &&
      !isNaN(Number(parts[1]))
    ) {
      const y = parts[0]
      const mIdx = parseInt(parts[1], 10) - 1
      if (mIdx >= 0 && mIdx < 12)
        return { month: monthNames[mIdx], year: y, ok: true }
    }
    return { month: val, year: "", ok: false }
  }

  const startObj = parseM(mulai)
  if (!startObj.ok) {
    if (selesai && selesai !== mulai) return `${mulai} - ${selesai}`
    return mulai
  }

  if (!selesai || selesai === mulai) {
    return `${startObj.month} ${startObj.year}`.trim()
  }

  const endObj = parseM(selesai)
  if (!endObj.ok) return `${mulai} - ${selesai}`

  if (startObj.year === endObj.year) {
    return `${startObj.month} - ${endObj.month} ${startObj.year}`
  }
  return `${startObj.month} ${startObj.year} - ${endObj.month} ${endObj.year}`
}

export type TableMergeSpan = {
  groupNumber: number
  noSpan: number
  goalSpan: number
  programSpan: number
  goalEndIndex: number
  programEndIndex: number
}

function normalizeMergeKey(raw?: string | null): string {
  const trimmed = (raw ?? "").trim()
  if (!trimmed || trimmed === "-") return ""
  return trimmed.replace(/\s+/g, " ").toLowerCase()
}

export function computeTableMergeSpans(
  rows: ReadonlyArray<{
    strategicGoal?: string | null
    programName?: string | null
  }>,
): TableMergeSpan[] {
  const n = rows.length
  const goalKeys = rows.map((r) => normalizeMergeKey(r.strategicGoal))
  const progKeys = rows.map((r) => normalizeMergeKey(r.programName))

  let runningGroupNumber = 0

  return rows.map((_, i) => {
    const gKey = goalKeys[i]
    const pKey = progKeys[i]

    let goalSpan = 1
    let goalEndIndex = i
    if (gKey) {
      if (i > 0 && goalKeys[i - 1] === gKey) {
        goalSpan = 0
      } else {
        let j = i
        while (j + 1 < n && goalKeys[j + 1] === gKey) {
          j += 1
        }
        goalSpan = j - i + 1
        goalEndIndex = j
      }
    }

    let programSpan = 1
    let programEndIndex = i
    if (pKey) {
      const sameGoalPrev = i > 0 && goalKeys[i - 1] === gKey
      if (sameGoalPrev && progKeys[i - 1] === pKey) {
        programSpan = 0
      } else {
        let j = i
        while (
          j + 1 < n &&
          goalKeys[j + 1] === gKey &&
          progKeys[j + 1] === pKey
        ) {
          j += 1
        }
        programSpan = j - i + 1
        programEndIndex = j
      }
    }

    const noSpan = programSpan
    if (noSpan > 0) {
      runningGroupNumber += 1
    }

    return {
      groupNumber: runningGroupNumber,
      noSpan,
      goalSpan,
      programSpan,
      goalEndIndex,
      programEndIndex,
    }
  })
}

export type SasaranKinerjaDisplayRow = {
  key: string
  rowNumber: number
  strategicGoal: string
  programName: string
  sasaran: string
  bulanMulai: string
  bulanSelesai: string
  bulanFormatted: string
  keterangan: string
  stratItemIdx: number
  progItemIdx: number
  sasaranItemIdx: number
  bulanItemIdx: number
  keteranganItemIdx: number
}

export function getSasaranKinerjaDisplayRows(
  record: HistoryRecord,
): SasaranKinerjaDisplayRow[] {
  const criteriaSlots = getSasaranKinerjaReviewCriteria(record)
  const out: SasaranKinerjaDisplayRow[] = []
  let rowCounter = 0

  for (const crit of criteriaSlots) {
    for (const strat of crit.stratSlots) {
      const goalText = (strat.name || crit.name || "-").trim() || "-"
      for (const prog of strat.programSlots) {
        const progText = (prog.name || "-").trim() || "-"
        const sList = prog.sasaranSlots.length
          ? prog.sasaranSlots
          : [
              {
                id: `${prog.id}-empty`,
                sasaran: "-",
                bulanMulai: "-",
                bulanSelesai: "",
                keterangan: "-",
                sasaranItemIdx: -1,
                bulanItemIdx: -1,
                keteranganItemIdx: -1,
              },
            ]

        for (const sas of sList) {
          rowCounter += 1
          out.push({
            key: `${strat.id}-${prog.id}-${sas.id}-${rowCounter}`,
            rowNumber: rowCounter,
            strategicGoal: goalText,
            programName: progText,
            sasaran: (sas.sasaran || "-").trim() || "-",
            bulanMulai: sas.bulanMulai,
            bulanSelesai: sas.bulanSelesai,
            bulanFormatted: formatBulanPelaksanaan(
              sas.bulanMulai,
              sas.bulanSelesai,
            ),
            keterangan: (sas.keterangan || "-").trim() || "-",
            stratItemIdx: strat.stratItemIdx,
            progItemIdx: prog.progItemIdx,
            sasaranItemIdx: sas.sasaranItemIdx,
            bulanItemIdx: sas.bulanItemIdx,
            keteranganItemIdx: sas.keteranganItemIdx,
          })
        }
      }
    }
  }

  return out
}

export type TriwulanDisplaySasaran = {
  id: string
  strategicGoal: string
  target: string
  month: string
  stage: string
  realization: string
  percentage: string
  obstacle: string
  solution: string
  solutionTime: string
  notes: string
  evidence: string
  lateStatus?: LateStatus
  adminLateNote?: string
  isLockedCompleted?: boolean
  completedInQuarter?: string
  carryOverFromQuarter?: string
  priorPercentage?: number
  targetQuarter?: string
  stride: 11 | 12
  baseIdx: number
}

export type TriwulanDisplayProgram = {
  id: string
  strategicGoal: string
  program: string
  sasaranList: TriwulanDisplaySasaran[]
}

export type TriwulanFlatDisplayRow = {
  key: string
  rowNumber: number
  programId: string
  sasaranId: string
  strategicGoal: string
  programName: string
  sasaran: TriwulanDisplaySasaran
  goalItemIdx: number
  progItemIdx: number
  sasaranItemIdx: number
  monthItemIdx: number
  stageItemIdx: number
  realizationItemIdx: number
  pctItemIdx: number
  obstacleItemIdx: number
  solutionItemIdx: number
  solutionTimeItemIdx: number
  notesItemIdx: number
  evidenceItemIdx: number
}

export function detectTriwulanItemStride(record: HistoryRecord): 11 | 12 {
  if (record.items?.[0]?.label === "Sasaran Strategis") return 12
  if (
    record.items?.length &&
    record.items.length % 12 === 0 &&
    record.items.length % 11 !== 0
  ) {
    return 12
  }
  if (
    record.items?.length &&
    record.items.length % 11 === 0 &&
    record.items[0]?.label === "Program Kerja"
  ) {
    return 11
  }
  return 12
}

export function getTriwulanData(
  record: HistoryRecord,
): TriwulanDisplayProgram[] {
  const stride = detectTriwulanItemStride(record)

  if (record.triwulanPrograms && record.triwulanPrograms.length > 0) {
    let globalSasIdx = 0
    return record.triwulanPrograms.map((prog, pIdx) => {
      const progGoal =
        prog.strategicGoal ||
        prog.sasaranList[0]?.strategicGoal ||
        prog.sasaranList[0]?.annualSource?.strategicGoal ||
        "-"
      const sasList: TriwulanDisplaySasaran[] = prog.sasaranList.map(
        (sas, sIdx) => {
          const baseIdx = globalSasIdx * stride
          globalSasIdx++
          const periodeBulan = formatBulanPelaksanaan(
            sas.monthStart,
            sas.monthEnd,
          )
          const persen = sas.percentage
            ? `${sas.percentage.replace("%", "")}%`
            : "0%"
          const sasId = sas.id || `sas-${pIdx}-${sIdx}`
          const resolvedLateStatus =
            record.lateNotes?.[sasId] ?? sas.lateStatus
          return {
            id: sasId,
            strategicGoal:
              sas.strategicGoal ||
              sas.annualSource?.strategicGoal ||
              prog.strategicGoal ||
              "-",
            target: sas.target || "-",
            month: periodeBulan || "-",
            stage:
              formatStageWithTargetTime(sas.stage, sas.stageTargetTime) || "-",
            realization: sas.realization || "-",
            percentage: persen,
            obstacle: sas.obstacle || "-",
            solution: sas.solution || "-",
            solutionTime: sas.solutionTime || "-",
            notes: sas.notes || "-",
            evidence: sas.evidence || "-",
            lateStatus: resolvedLateStatus,
            adminLateNote: sas.adminLateNote,
            isLockedCompleted: sas.isLockedCompleted,
            completedInQuarter: sas.completedInQuarter,
            carryOverFromQuarter: sas.carryOverFromQuarter,
            priorPercentage: sas.priorPercentage,
            targetQuarter: sas.targetQuarter,
            stride,
            baseIdx,
          }
        },
      )
      return {
        id: prog.id || `prog-${pIdx + 1}`,
        strategicGoal: progGoal,
        program: prog.program || "-",
        sasaranList: sasList,
      }
    })
  }

  const items = record.items || []
  const progsMap: { [progKey: string]: TriwulanDisplayProgram } = {}
  const progsList: TriwulanDisplayProgram[] = []

  for (let i = 0; i < items.length; i += stride) {
    const chunk = items.slice(i, i + stride)
    const goalVal =
      chunk.find((c) => c.label === "Sasaran Strategis")?.value ?? "-"
    const progVal = chunk.find((c) => c.label === "Program Kerja")?.value ?? "-"
    const targetVal = chunk.find((c) => c.label === "Sasaran")?.value ?? "-"
    const monthVal = chunk.find((c) => c.label.includes("Bulan"))?.value ?? "-"
    const stageVal = chunk.find((c) => c.label.includes("Tahap"))?.value ?? "-"
    const realVal =
      chunk.find(
        (c) =>
          c.label.includes("Realisasi Pelaksanaan") || c.label === "Realisasi",
      )?.value ?? "-"
    const pctVal = chunk.find((c) => c.label.includes("(%)"))?.value ?? "-"
    const obsVal =
      chunk.find(
        (c) => c.label.includes("Kendala") && !c.label.includes("Penyelesaian"),
      )?.value ?? "-"
    const solVal = chunk.find((c) => c.label.includes("Rencana"))?.value ?? "-"
    const solTimeVal =
      chunk.find((c) => c.label.includes("Waktu"))?.value ?? "-"
    const noteVal =
      chunk.find((c) => c.label.includes("Keterangan"))?.value ?? "-"
    const evVal = chunk.find((c) => c.label.includes("Evidence"))?.value ?? "-"

    const sasObj: TriwulanDisplaySasaran = {
      id: `sas-${i}`,
      strategicGoal: goalVal,
      target: targetVal,
      month: monthVal,
      stage: stageVal,
      realization: realVal,
      percentage: pctVal,
      obstacle: obsVal,
      solution: solVal,
      solutionTime: solTimeVal,
      notes: noteVal,
      evidence: evVal,
      stride,
      baseIdx: i,
    }

    const groupKey = `${goalVal}||${progVal}`
    if (!progsMap[groupKey]) {
      const newProg: TriwulanDisplayProgram = {
        id: `prog-${progsList.length + 1}`,
        strategicGoal: goalVal,
        program: progVal,
        sasaranList: [sasObj],
      }
      progsMap[groupKey] = newProg
      progsList.push(newProg)
    } else {
      progsMap[groupKey].sasaranList.push(sasObj)
    }
  }

  return progsList.length > 0
    ? progsList
    : [
        {
          id: "prog-1",
          strategicGoal: "-",
          program: "-",
          sasaranList: [
            {
              id: "sas-1",
              strategicGoal: "-",
              target: "-",
              month: "-",
              stage: "-",
              realization: "-",
              percentage: "0%",
              obstacle: "-",
              solution: "-",
              solutionTime: "-",
              notes: "-",
              evidence: "-",
              stride,
              baseIdx: 0,
            },
          ],
        },
      ]
}

export function getTriwulanDisplayRows(
  record: HistoryRecord,
): TriwulanFlatDisplayRow[] {
  const programs = getTriwulanData(record)
  const out: TriwulanFlatDisplayRow[] = []
  let rowCounter = 0

  for (const prog of programs) {
    for (const [sIdx, sas] of prog.sasaranList.entries()) {
      rowCounter += 1
      const stride = sas.stride ?? 12
      const baseIdx = sas.baseIdx ?? (rowCounter - 1) * stride
      const goalOff = stride === 12 ? 0 : -1
      const progOff = stride === 12 ? 1 : 0

      out.push({
        key: `${prog.id}-${sas.id || sIdx}-${rowCounter}`,
        rowNumber: rowCounter,
        programId: prog.id,
        sasaranId: sas.id || `sas-${sIdx}`,
        strategicGoal:
          (sas.strategicGoal && sas.strategicGoal !== "-"
            ? sas.strategicGoal
            : prog.strategicGoal) || "-",
        programName: prog.program || "-",
        sasaran: sas,
        goalItemIdx: goalOff >= 0 ? baseIdx + goalOff : -1,
        progItemIdx: baseIdx + progOff,
        sasaranItemIdx: baseIdx + progOff + 1,
        monthItemIdx: baseIdx + progOff + 2,
        stageItemIdx: baseIdx + progOff + 3,
        realizationItemIdx: baseIdx + progOff + 4,
        pctItemIdx: baseIdx + progOff + 5,
        obstacleItemIdx: baseIdx + progOff + 6,
        solutionItemIdx: baseIdx + progOff + 7,
        solutionTimeItemIdx: baseIdx + progOff + 8,
        notesItemIdx: baseIdx + progOff + 9,
        evidenceItemIdx: baseIdx + progOff + 10,
      })
    }
  }

  return out
}
