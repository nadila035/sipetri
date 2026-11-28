import type { HistoryRecord, MasterStrategicGoal } from "../types/index.ts"

const DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z"

export const DEFAULT_STRATEGIC_GOALS: MasterStrategicGoal[] = [
  {
    id: "ss-itpln-01",
    code: "SS-01",
    name: "Peningkatan Mutu Pendidikan, Kurikulum, dan Akreditasi Unggul",
    description:
      "Pengembangan kualitas pembelajaran, akreditasi program studi, dan kompetensi lulusan.",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: "ss-itpln-02",
    code: "SS-02",
    name: "Penguatan Riset Terapan Transisi Energi dan Inovasi Pengabdian",
    description:
      "Peningkatan publikasi ilmiah, hilirisasi inovasi ketenagalistrikan, dan kemitraan pengabdian masyarakat.",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: "ss-itpln-03",
    code: "SS-03",
    name: "Pengembangan Kapasitas SDM dan Budaya Kerja Berkinerja Tinggi",
    description:
      "Peningkatan kualifikasi dosen, tenaga kependidikan, sertifikasi keahlian, dan kesejahteraan kerja.",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: "ss-itpln-04",
    code: "SS-04",
    name: "Transformasi Digital, Tata Kelola Institusi, dan Penjaminan Mutu",
    description:
      "Integrasi sistem informasi kampus, pengawasan mutu internal, kearsipan, dan kepatuhan regulasi.",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: "ss-itpln-05",
    code: "SS-05",
    name: "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
    description:
      "Pembinaan prestasi mahasiswa, keterserapan lulusan di dunia kerja, dan jejaring mitra strategis.",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: "ss-itpln-06",
    code: "SS-06",
    name: "Optimalisasi Pengelolaan Keuangan, Sarana Prasarana, dan Usaha Strategis",
    description:
      "Efisiensi anggaran, keandalan fasilitas laboratorium serta kampus, dan pertumbuhan pendapatan usaha.",
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
]

function makeGoalId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `ss-${crypto.randomUUID().slice(0, 8)}`
    : `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function nextStrategicGoalCode(goals: MasterStrategicGoal[]): string {
  let maxNum = 0
  for (const g of goals) {
    const m = g.code.match(/(\d+)/)
    if (m) maxNum = Math.max(maxNum, Number(m[1]))
  }
  return `SS-${String(maxNum + 1).padStart(2, "0")}`
}

export function normalizeStrategicGoals(
  raw: unknown,
): MasterStrategicGoal[] {
  if (!Array.isArray(raw)) {
    return structuredClone(DEFAULT_STRATEGIC_GOALS)
  }
  const seenIds = new Set<string>()
  const result: MasterStrategicGoal[] = []
  for (const [idx, item] of raw.entries()) {
    if (!item || typeof item !== "object") continue
    const obj = item as Partial<MasterStrategicGoal>
    const name = typeof obj.name === "string" ? obj.name.trim() : ""
    if (!name) continue
    const id =
      typeof obj.id === "string" && obj.id.trim() && !seenIds.has(obj.id.trim())
        ? obj.id.trim()
        : `${makeGoalId()}-${idx + 1}`
    seenIds.add(id)
    const code =
      typeof obj.code === "string" && obj.code.trim()
        ? obj.code.trim()
        : `SS-${String(result.length + 1).padStart(2, "0")}`
    result.push({
      id,
      code,
      name,
      description:
        typeof obj.description === "string" ? obj.description.trim() : "",
      createdAt:
        typeof obj.createdAt === "string" && obj.createdAt
          ? obj.createdAt
          : DEFAULT_TIMESTAMP,
      updatedAt:
        typeof obj.updatedAt === "string" && obj.updatedAt
          ? obj.updatedAt
          : DEFAULT_TIMESTAMP,
    })
  }
  return result
}

export function addMasterStrategicGoal(
  list: MasterStrategicGoal[],
  input: { code?: string; name: string; description?: string },
  nowIso = new Date().toISOString(),
):
  | { ok: true; list: MasterStrategicGoal[]; created: MasterStrategicGoal }
  | { ok: false; error: string } {
  const name = input.name.trim()
  const code = (input.code?.trim() || nextStrategicGoalCode(list)).toUpperCase()
  const description = input.description?.trim() ?? ""

  if (!name) {
    return { ok: false, error: "Nama Sasaran Strategis wajib diisi." }
  }
  if (list.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    return {
      ok: false,
      error: "Sasaran Strategis dengan nama tersebut sudah terdaftar.",
    }
  }
  if (list.some((g) => g.code.toLowerCase() === code.toLowerCase())) {
    return {
      ok: false,
      error: `Kode ${code} sudah digunakan pada Sasaran Strategis lain.`,
    }
  }

  const created: MasterStrategicGoal = {
    id: makeGoalId(),
    code,
    name,
    description,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  return { ok: true, list: [...list, created], created }
}

export function updateMasterStrategicGoal(
  list: MasterStrategicGoal[],
  id: string,
  input: { code?: string; name: string; description?: string },
  nowIso = new Date().toISOString(),
):
  | {
      ok: true
      list: MasterStrategicGoal[]
      previous: MasterStrategicGoal
      updated: MasterStrategicGoal
    }
  | { ok: false; error: string } {
  const existing = list.find((g) => g.id === id)
  if (!existing) {
    return { ok: false, error: "Data Sasaran Strategis tidak ditemukan." }
  }
  const name = input.name.trim()
  const code = (input.code?.trim() || existing.code).toUpperCase()
  const description = input.description?.trim() ?? ""

  if (!name) {
    return { ok: false, error: "Nama Sasaran Strategis wajib diisi." }
  }
  if (
    list.some(
      (g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      error: "Sasaran Strategis dengan nama tersebut sudah terdaftar.",
    }
  }
  if (
    list.some(
      (g) => g.id !== id && g.code.toLowerCase() === code.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      error: `Kode ${code} sudah digunakan pada Sasaran Strategis lain.`,
    }
  }

  const updated: MasterStrategicGoal = {
    ...existing,
    code,
    name,
    description,
    updatedAt: nowIso,
  }
  return {
    ok: true,
    list: list.map((g) => (g.id === id ? updated : g)),
    previous: existing,
    updated,
  }
}

export function removeMasterStrategicGoal(
  list: MasterStrategicGoal[],
  id: string,
): { ok: true; list: MasterStrategicGoal[]; removed: MasterStrategicGoal } | { ok: false; error: string } {
  const target = list.find((g) => g.id === id)
  if (!target) {
    return { ok: false, error: "Data Sasaran Strategis tidak ditemukan." }
  }
  return {
    ok: true,
    list: list.filter((g) => g.id !== id),
    removed: target,
  }
}

export function countStrategicGoalUsage(
  records: HistoryRecord[],
  goal: Pick<MasterStrategicGoal, "id" | "name">,
): number {
  let count = 0
  const targetNameLower = goal.name.trim().toLowerCase()
  for (const record of records) {
    if (record.type === "Sasaran Kinerja") {
      for (const crit of record.criteriaData ?? []) {
        const strats = crit.strategies ?? (crit.strategy ? [crit.strategy] : [])
        for (const strat of strats) {
          if (
            strat.strategicGoalId === goal.id ||
            strat.name.trim().toLowerCase() === targetNameLower
          ) {
            count += 1
          }
        }
      }
    } else if (record.type === "Laporan Triwulan") {
      for (const prog of record.triwulanPrograms ?? []) {
        if (
          prog.strategicGoalId === goal.id ||
          (prog.strategicGoal ?? "").trim().toLowerCase() === targetNameLower
        ) {
          count += 1
        }
      }
    }
  }
  return count
}

export function propagateStrategicGoalRename(
  records: HistoryRecord[],
  goalId: string,
  oldName: string,
  newName: string,
): HistoryRecord[] {
  const oldLower = oldName.trim().toLowerCase()
  return records.map((record) => {
    // Only mutate Draf or Menunggu/Revisi active records when matching ID/name, preserving Disetujui audit snapshots unless ID matches Draf
    if (record.status === "Disetujui") return record

    if (record.type === "Sasaran Kinerja" && record.criteriaData) {
      let changed = false
      const criteriaData = record.criteriaData.map((crit) => {
        const strats = crit.strategies ?? (crit.strategy ? [crit.strategy] : [])
        const nextStrats = strats.map((strat) => {
          if (
            strat.strategicGoalId === goalId ||
            strat.name.trim().toLowerCase() === oldLower
          ) {
            changed = true
            return { ...strat, strategicGoalId: goalId, name: newName }
          }
          return strat
        })
        const nextCritName =
          crit.name.trim().toLowerCase() === oldLower ? newName : crit.name
        return {
          ...crit,
          name: nextCritName,
          strategies: nextStrats,
          strategy: nextStrats[0] ?? crit.strategy,
        }
      })
      if (!changed) return record
      const items = record.items.map((item) =>
        (item.label === "Sasaran Strategis" || item.label === "Strategi") &&
        item.value.trim().toLowerCase() === oldLower
          ? { ...item, value: newName }
          : item,
      )
      return { ...record, criteriaData, items }
    }

    if (record.type === "Laporan Triwulan" && record.triwulanPrograms) {
      let changed = false
      const triwulanPrograms = record.triwulanPrograms.map((prog) => {
        const matchProg =
          prog.strategicGoalId === goalId ||
          (prog.strategicGoal ?? "").trim().toLowerCase() === oldLower
        const nextSasaran = prog.sasaranList.map((sas) => {
          const matchSas =
            sas.strategicGoalId === goalId ||
            (sas.strategicGoal ?? "").trim().toLowerCase() === oldLower
          if (!matchSas && !matchProg) return sas
          changed = true
          return {
            ...sas,
            strategicGoalId: goalId,
            strategicGoal: newName,
          }
        })
        if (!matchProg && !changed) return prog
        changed = true
        return {
          ...prog,
          strategicGoalId: goalId,
          strategicGoal: newName,
          sasaranList: nextSasaran,
        }
      })
      if (!changed) return record
      const items = record.items.map((item) =>
        item.label === "Sasaran Strategis" &&
        item.value.trim().toLowerCase() === oldLower
          ? { ...item, value: newName }
          : item,
      )
      return { ...record, triwulanPrograms, items }
    }

    return record
  })
}
