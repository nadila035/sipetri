import test from "node:test"
import assert from "node:assert/strict"
import { unitOptions, reportingUnits, resolveOrganization, matchesOrganization, parseSentAtTimestamp, reportingCoverage } from "./src/utils/organizations.ts"

const record = (unit, overrides = {}) => ({ id: unit, unit, type: "Laporan Triwulan", period: "Triwulan I · 2026", sentAt: "11/11/2026, 10.00.00", status: "Menunggu", items: [], ...overrides })

test("master contains 22 parents and 42 unique reporters", () => {
  assert.equal(Object.keys(unitOptions).length, 22)
  assert.equal(reportingUnits.length, 42)
  assert.equal(new Set(reportingUnits.map(row => row.subUnit)).size, 42)
  assert.equal(resolveOrganization(record("PJM")).parentUnit, "PJM")
  assert.equal(resolveOrganization(record("BAUM")).parentUnit, "Rektorat")
  assert.equal(resolveOrganization(record("Unknown")), undefined)
  assert.equal(matchesOrganization(record("BAUM"), "Rektorat"), true)
})

test("coverage includes missing reporters, isolates periods and excludes unknown/annual documents", () => {
  const result = reportingCoverage([record("BAUM"), record("Unknown"), record("PJM", { type: "Sasaran Kinerja" }), record("SPI", { period: "Triwulan II · 2026" }), record("FKET", { period: "Triwulan I · 2025" })], "2026", "I")
  assert.equal(result.expected, 42)
  assert.equal(result.submitted, 1)
  assert.equal(result.missing, 41)
  assert.equal(result.unmapped, 1)
  assert.equal(result.rows.find(row => row.subUnit === "SPI").record, undefined)
})

test("duplicate submissions count once, latest status wins regardless of order", () => {
  const records = [record("BAUM", { status: "Disetujui", sentAt: "10/11/2026, 10.00.00" }), record("BAUM", { status: "Revisi" }), record("BHSE", { status: "Disetujui" })]
  const result = reportingCoverage(records, "2026", "I", "Rektorat")
  assert.equal(result.expected, 4)
  assert.equal(result.submitted, 2)
  assert.equal(result.approved, 1)
  assert.equal(result.percent, 50)
  assert.equal(result.rows.find(row => row.subUnit === "BAUM").record.status, "Revisi")
  assert.equal(reportingCoverage(records, "2026", "I", "BHSE").expected, 1)
})

test("explicit identity must be valid, unknown selector cannot inflate coverage", () => {
  assert.equal(resolveOrganization(record("BAUM", { parentUnit: "PKA", subUnit: "BAUM" })), undefined)
  assert.equal(reportingCoverage([], "2026", "I", "Unknown").percent, 0)
})

test("parseSentAtTimestamp normalizes numeric and Indonesian month formats for coverage and sorting", () => {
  const march = parseSentAtTimestamp("28 Maret 2025, 09:05")
  const june = parseSentAtTimestamp("18 Juni 2025, 10:24")
  const julyNumeric = parseSentAtTimestamp("05/07/2025, 14.30.00")
  assert.ok(march > 0 && june > march && julyNumeric > june)
  assert.equal(parseSentAtTimestamp("belum valid"), 0)

  const mixed = reportingCoverage(
    [
      record("BPK", { status: "Revisi", sentAt: "18 Juni 2025, 10:24" }),
      record("BPK", { status: "Disetujui", sentAt: "05/07/2025, 14.30.00" }),
    ],
    "2026",
    "I",
    "PRP",
  )
  assert.equal(mixed.rows.find((row) => row.subUnit === "BPK").record.status, "Disetujui")
})
