import type { HistoryRecord } from "../types"

export const unitOptions: Record<string, string[]> = {
  FKET: [], FTBE: [], FTIK: [], FTEN: [], PASCASARJANA: [], VOKASI: [],
  Rektorat: ["BAUM", "BHSE", "BHMS", "BHM"],
  "Bidang Akademik": ["BAA", "BPAK"],
  "Bidang Sumber Daya": ["BSDM", "BAG", "BAKT", "BKU"],
  "Bidang Kemahasiswaan": ["BKK"],
  "Bidang Pengembangan Usaha Strategis": ["BPKU"],
  PRP: ["BPSR", "BPK", "BPI"], LPPM: ["BPP", "BPM", "BPUB"],
  PKA: ["BKAN", "BKAI"], PMA: ["BPAA", "BPTI", "BPAS"],
  PPA: ["BSAR", "BPAD"], PPK: ["BKM", "BPIK", "BPKA"],
  LEMTERA: ["BPTT", "BOPT"], TCC: ["BPTC", "BOTC", "LDC"],
  PJM: [], SPI: [], Perpustakaan: [],
}

export const reportingUnits = Object.entries(unitOptions).flatMap(([parentUnit, children]) =>
  (children.length ? children : [parentUnit]).map((subUnit) => ({ parentUnit, subUnit })),
)

export function resolveOrganization(record: Pick<HistoryRecord, "unit" | "parentUnit" | "subUnit">) {
  if (record.parentUnit || record.subUnit) {
    return reportingUnits.find((unit) => unit.parentUnit === record.parentUnit && unit.subUnit === record.subUnit)
  }
  return reportingUnits.find((unit) => unit.subUnit === record.unit)
}

export function resolveInitialUnit(
  record?: Pick<HistoryRecord, "unit" | "parentUnit" | "subUnit">,
): { unit: string; subUnit: string } {
  if (!record) return { unit: "", subUnit: "" }
  const parent =
    record.parentUnit && Object.hasOwn(unitOptions, record.parentUnit)
      ? record.parentUnit
      : record.unit && Object.hasOwn(unitOptions, record.unit)
        ? record.unit
        : resolveOrganization(record)?.parentUnit ?? ""
  if (!parent) return { unit: "", subUnit: "" }
  const subList = unitOptions[parent]
  if (!subList || subList.length === 0) return { unit: parent, subUnit: parent }
  const candidate = record.subUnit || record.unit
  return {
    unit: parent,
    subUnit: subList.includes(candidate) ? candidate : "",
  }
}

export function matchesOrganization(record: HistoryRecord, selection: string) {
  if (!selection) return true
  const organization = resolveOrganization(record)
  return organization
    ? organization.parentUnit === selection || organization.subUnit === selection
    : record.unit === selection
}

const monthNumbers: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
}

export function parseSentAtTimestamp(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return Date.parse(trimmed) || 0
  }
  const numeric = trimmed.match(
    /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:,?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/,
  )
  if (numeric) {
    return (
      Date.UTC(
        +numeric[3],
        +numeric[2] - 1,
        +numeric[1],
        +(numeric[4] || 0),
        +(numeric[5] || 0),
        +(numeric[6] || 0),
      ) -
      7 * 3600_000
    )
  }
  const named = trimmed.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,?\s*(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?)?/,
  )
  if (named) {
    const month = monthNumbers[named[2].toLowerCase()]
    if (month !== undefined) {
      return (
        Date.UTC(
          +named[3],
          month,
          +named[1],
          +(named[4] || 0),
          +(named[5] || 0),
          +(named[6] || 0),
        ) -
        7 * 3600_000
      )
    }
  }
  return 0
}

export function reportingCoverage(records: HistoryRecord[], year: string, quarter: string, selection = "") {
  const expected = reportingUnits.filter((unit) => !selection || unit.parentUnit === selection || unit.subUnit === selection)
  const periodRecords = records.filter((record) => record.type === "Laporan Triwulan" && record.period === `Triwulan ${quarter} · ${year}` && record.status !== "Draf")
  const latest = new Map<string, HistoryRecord>()
  // Equal or unparseable timestamps retain the newest-first storage order.
  for (const record of periodRecords) {
    const organization = resolveOrganization(record)
    if (!organization) continue
    const previous = latest.get(organization.subUnit)
    if (!previous || parseSentAtTimestamp(record.sentAt) > parseSentAtTimestamp(previous.sentAt)) latest.set(organization.subUnit, record)
  }
  const rows = expected.map((unit) => ({ ...unit, record: latest.get(unit.subUnit) }))
  const submitted = rows.filter((row) => row.record).length
  return {
    rows, expected: rows.length, submitted, missing: rows.length - submitted,
    approved: rows.filter((row) => row.record?.status === "Disetujui").length,
    percent: rows.length ? submitted / rows.length * 100 : 0,
    unmapped: periodRecords.filter((record) => !resolveOrganization(record)).length,
  }
}
