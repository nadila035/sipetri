import type { HistoryRecord, LateStatus } from "../types/index.ts"
import { formatStageWithTargetTime } from "./drafts.ts"

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

export function detectTriwulanItemStride(record: HistoryRecord): 11 | 12 {
  if (record.items?.[0]?.label === "Sasaran Strategis") return 12
  if (record.items?.length && record.items.length % 12 === 0 && record.items.length % 11 !== 0) {
    return 12
  }
  if (record.items?.length && record.items.length % 11 === 0 && record.items[0]?.label === "Program Kerja") {
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
              prog.strategicGoal ||
              sas.annualSource?.strategicGoal ||
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
