import test from "node:test"
import assert from "node:assert/strict"
import {
  TRIWULAN_ITEMS_PER_SASARAN,
  buildSasaranKinerjaItems,
  buildTriwulanItems,
  calculateSasaranKinerjaCompleteness,
  createEmptyCriteria,
  createEmptyTriwulanProgram,
  extractDashboardAnnualMetrics,
  hasCriteriaContent,
  hasTriwulanContent,
  insertItemAt,
  normalizeCriteriaList,
  normalizeTriwulanPrograms,
  promoteDraftToSubmitted,
  upsertDraftRecord,
} from "./src/utils/drafts.ts"

test("empty initial forms report no unsaved content", () => {
  const criteria = [createEmptyCriteria()]
  const triwulan = [createEmptyTriwulanProgram()]

  assert.equal(hasCriteriaContent(criteria), false)
  assert.equal(hasCriteriaContent(criteria, "Rektorat", ""), true)
  assert.equal(hasTriwulanContent(triwulan, "", ""), false)

  criteria[0].strategies[0].name = "SS-01 Mutu Pendidikan"
  assert.equal(hasCriteriaContent(criteria), true)

  assert.equal(hasTriwulanContent(triwulan, "Rektorat", ""), true)
  triwulan[0].program = "Digitalisasi"
  assert.equal(hasTriwulanContent(triwulan, "", ""), true)
})

test("upsertDraftRecord updates existing draft without creating duplicates and promoteDraftToSubmitted removes active draft", () => {
  const draftA = {
    id: "DRAF-LTR-2025-II-abc",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan II",
    period: "Triwulan II · 2025",
    unit: "BAUM",
    sentAt: "Belum dikirim",
    updatedAt: "2026-11-13T10:00:00.000Z",
    status: "Draf",
    progress: 25,
    items: [],
  }
  const existing = [{ id: "SK-2025-001", status: "Disetujui" }]

  const afterInsert = upsertDraftRecord(existing, draftA)
  assert.equal(afterInsert.length, 2)
  assert.equal(afterInsert[0].id, "DRAF-LTR-2025-II-abc")

  const afterUpdate = upsertDraftRecord(afterInsert, {
    ...draftA,
    progress: 80,
    updatedAt: "2026-11-13T10:05:00.000Z",
  })
  assert.equal(afterUpdate.length, 2)
  assert.equal(afterUpdate[0].progress, 80)

  const submitted = {
    id: "LTR-2025-II-xyz",
    status: "Menunggu",
  }
  const afterSubmit = promoteDraftToSubmitted(
    afterUpdate,
    "DRAF-LTR-2025-II-abc",
    submitted,
  )
  assert.equal(afterSubmit.length, 2)
  assert.equal(afterSubmit[0].id, "LTR-2025-II-xyz")
  assert.equal(
    afterSubmit.some((r) => r.id === "DRAF-LTR-2025-II-abc"),
    false,
  )
})

test("extractDashboardAnnualMetrics reads only submitted Sasaran Kinerja records and ignores Draf", () => {
  const criteriaSubmitted = createEmptyCriteria()
  criteriaSubmitted.strategies[0].name = "Strategi 1"
  criteriaSubmitted.strategies[0].programs[0].name = "Program 1"
  criteriaSubmitted.strategies[0].programs[0].sasaranList[0].sasaran = "Sasaran 1"
  criteriaSubmitted.strategies[0].programs[0].sasaranList[0].bulan_mulai = "2025-01"
  criteriaSubmitted.strategies[0].programs[0].sasaranList[0].bulan_selesai = "2025-12"

  const criteriaDraft = createEmptyCriteria()
  criteriaDraft.strategies[0].name = "Strategi Draf"
  criteriaDraft.strategies[0].programs[0].name = "Program Draf"
  criteriaDraft.strategies[0].programs[0].sasaranList[0].sasaran = "Sasaran Draf"
  criteriaDraft.strategies[0].programs[0].sasaranList[0].bulan_mulai = "2025-02"

  const records = [
    {
      id: "DRAF-SK-2025-1",
      type: "Sasaran Kinerja",
      title: "Sasaran Kinerja Tahun 2025",
      period: "Tahun 2025",
      unit: "FKET",
      sentAt: "Belum dikirim",
      status: "Draf",
      progress: 100,
      items: [],
      criteriaData: [criteriaDraft],
    },
    {
      id: "SK-2025-001",
      type: "Sasaran Kinerja",
      title: "Sasaran Kinerja Tahun 2025",
      period: "Tahun 2025",
      unit: "FKET",
      sentAt: "10 Jan 2025",
      status: "Disetujui",
      progress: 100,
      items: [],
      criteriaData: [criteriaSubmitted],
    },
  ]

  const metrics = extractDashboardAnnualMetrics(records, "2025")
  assert.equal(metrics.strategies.length, 1)
  assert.equal(metrics.strategies[0].name, "Strategi 1")
  assert.equal(metrics.currentStrategies.length, 1)
  assert.equal(metrics.currentPrograms.length, 1)
  assert.equal(metrics.targets.length, 1)
})

test("normalizers and item builders match 6-column Sasaran Kinerja and 13-column Triwulan", () => {
  const emptyC = normalizeCriteriaList([])
  assert.equal(emptyC.length, 1)
  assert.equal(calculateSasaranKinerjaCompleteness(emptyC), 0)

  emptyC[0].strategies[0].name = "SS-01 Mutu Pendidikan"
  emptyC[0].strategies[0].programs[0].name = "Program A"
  emptyC[0].strategies[0].programs[0].sasaranList[0].sasaran = "Target A"
  emptyC[0].strategies[0].programs[0].sasaranList[0].bulan_mulai = "2026-01"
  assert.equal(calculateSasaranKinerjaCompleteness(emptyC), 100)

  const skItems = buildSasaranKinerjaItems(emptyC)
  assert.equal(skItems.length, 5)
  assert.equal(skItems[0].label, "Sasaran Strategis")
  assert.equal(skItems[1].label, "Program Kerja")
  assert.equal(skItems[2].label, "Sasaran Kinerja")

  const emptyT = normalizeTriwulanPrograms([])
  assert.equal(emptyT.length, 1)
  const twItems = buildTriwulanItems(emptyT)
  assert.equal(twItems.length, TRIWULAN_ITEMS_PER_SASARAN)
  assert.equal(twItems[0].label, "Sasaran Strategis")
  assert.equal(twItems[1].label, "Program Kerja")
  assert.equal(twItems[11].label, "Link Evidence")
})

test("insertItemAt inserts rows in the middle and top while shifting downstream indices", () => {
  const initialPrograms = ["P1", "P2", "P3", "P4", "P5"].map((label) => ({
    ...createEmptyTriwulanProgram(),
    program: label,
  }))

  const insertedMid = { ...createEmptyTriwulanProgram(), program: "SISIP-TENGAH" }
  const afterMid = insertItemAt(initialPrograms, 2, insertedMid)
  assert.equal(afterMid.length, 6)
  assert.deepEqual(
    afterMid.map((p) => p.program),
    ["P1", "P2", "SISIP-TENGAH", "P3", "P4", "P5"],
  )

  const insertedTop = { ...createEmptyTriwulanProgram(), program: "SISIP-ATAS" }
  const afterTop = insertItemAt(afterMid, 0, insertedTop)
  assert.deepEqual(
    afterTop.map((p) => p.program),
    ["SISIP-ATAS", "P1", "P2", "SISIP-TENGAH", "P3", "P4", "P5"],
  )
})

test("normalizeTriwulanPrograms preserves carry-over, lock, lateStatus, and stageTargetTime", () => {
  const normalized = normalizeTriwulanPrograms([
    {
      id: "prog-1",
      strategicGoal: "SS-04 Transformasi Digital",
      program: "Program Uji",
      sasaranList: [
        {
          id: "sas-1",
          sasaran: "Sasaran Uji",
          monthStart: "2026-01",
          monthEnd: "2026-03",
          priorPercentage: 60,
          carryOverFromQuarter: "I",
          targetQuarter: "I",
          isLockedCompleted: false,
          lateStatus: "Terlambat",
          stage: "Sosialisasi dan pendampingan unit.",
          stageTargetTime: "Minggu ke-2 Mei 2026",
          realization: "Sudah dilaksanakan tahap awal.",
          percentage: "80",
          obstacle: "Menunggu jadwal",
          solution: "Koordinasi lanjutan",
          solutionTime: "Juni 2026",
          notes: "",
          evidence: "https://drive.google.com/example",
        },
      ],
    },
  ])

  const sas = normalized[0].sasaranList[0]
  assert.equal(sas.strategicGoal, "SS-04 Transformasi Digital")
  assert.equal(sas.priorPercentage, 60)
  assert.equal(sas.carryOverFromQuarter, "I")
  assert.equal(sas.lateStatus, "Terlambat")
  assert.equal(sas.stageTargetTime, "Minggu ke-2 Mei 2026")

  const items = buildTriwulanItems(normalized)
  assert.equal(items[0].value, "SS-04 Transformasi Digital")
  assert.equal(items[4].label, "Tahap Pelaksanaan")
  assert.equal(
    items[4].value,
    "Sosialisasi dan pendampingan unit.\nTarget/Waktu Selesai: Minggu ke-2 Mei 2026",
  )
})
