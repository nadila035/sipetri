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
    if (selesai && selesai !== mulai) return `${mulai} – ${selesai}`
    return mulai
  }

  if (!selesai || selesai === mulai) {
    return `${startObj.month} ${startObj.year}`.trim()
  }

  const endObj = parseM(selesai)
  if (!endObj.ok) return `${mulai} – ${selesai}`

  if (startObj.year === endObj.year) {
    return `${startObj.month} – ${endObj.month} ${startObj.year}`
  }
  return `${startObj.month} ${startObj.year} – ${endObj.month} ${endObj.year}`
}

import type { HistoryRecord } from "../types"
import { formatStageWithTargetTime } from "./drafts"

export type TriwulanDisplaySasaran = {
  id: string
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
  baseIdx: number
}

export type TriwulanDisplayProgram = {
  id: string
  program: string
  sasaranList: TriwulanDisplaySasaran[]
}

export function getTriwulanData(
  record: HistoryRecord,
): TriwulanDisplayProgram[] {
  if (record.triwulanPrograms && record.triwulanPrograms.length > 0) {
    let globalSasIdx = 0
    return record.triwulanPrograms.map((prog, pIdx) => {
      const sasList: TriwulanDisplaySasaran[] = prog.sasaranList.map(
        (sas, sIdx) => {
          const baseIdx = globalSasIdx * 11
          globalSasIdx++
          const periodeBulan = formatBulanPelaksanaan(
            sas.monthStart,
            sas.monthEnd,
          )
          const persen = sas.percentage
            ? `${sas.percentage.replace("%", "")}%`
            : "0%"
          return {
            id: sas.id || `sas-${pIdx}-${sIdx}`,
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
            baseIdx,
          }
        },
      )
      return {
        id: prog.id || `prog-${pIdx + 1}`,
        program: prog.program || "-",
        sasaranList: sasList,
      }
    })
  }

  // Fallback for legacy or mock records with record.items:
  const items = record.items || []
  const progsMap: { [progName: string]: TriwulanDisplayProgram } = {}
  const progsList: TriwulanDisplayProgram[] = []

  for (let i = 0; i < items.length; i += 11) {
    const chunk = items.slice(i, i + 11)
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
      baseIdx: i,
    }

    if (!progsMap[progVal]) {
      const newProg: TriwulanDisplayProgram = {
        id: `prog-${progsList.length + 1}`,
        program: progVal,
        sasaranList: [sasObj],
      }
      progsMap[progVal] = newProg
      progsList.push(newProg)
    } else {
      progsMap[progVal].sasaranList.push(sasObj)
    }
  }

  return progsList.length > 0
    ? progsList
    : [
        {
          id: "prog-1",
          program: "-",
          sasaranList: [
            {
              id: "sas-1",
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
              baseIdx: 0,
            },
          ],
        },
      ]
}
