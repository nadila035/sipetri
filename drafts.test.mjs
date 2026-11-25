import test from "node:test"
import assert from "node:assert/strict"
import {
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

  criteria[0].name = "Organisasi"
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
  criteriaSubmitted.name = "Kriteria 1"
  criteriaSubmitted.strategies[0].name = "Strategi 1"
  criteriaSubmitted.strategies[0].programs[0].name = "Program 1"
  criteriaSubmitted.strategies[0].programs[0].sasaranList[0].sasaran = "Sasaran 1"
  criteriaSubmitted.strategies[0].programs[0].sasaranList[0].bulan_mulai = "2025-01"
  criteriaSubmitted.strategies[0].programs[0].sasaranList[0].bulan_selesai = "2025-12"

  const criteriaDraft = createEmptyCriteria()
  criteriaDraft.name = "Kriteria Draf"
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
      unit: "Unit",
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
      unit: "Unit",
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

test("normalizers and item builders handle blank and filled drafts safely", () => {
  const emptyC = normalizeCriteriaList([])
  assert.equal(emptyC.length, 1)
  assert.equal(calculateSasaranKinerjaCompleteness(emptyC), 0)

  emptyC[0].name = "Mutu"
  emptyC[0].strategies[0].name = "Strategi A"
  emptyC[0].strategies[0].programs[0].name = "Program A"
  emptyC[0].strategies[0].programs[0].sasaranList[0].sasaran = "Target A"
  emptyC[0].strategies[0].programs[0].sasaranList[0].bulan_mulai = "2025-01"
  assert.equal(calculateSasaranKinerjaCompleteness(emptyC), 100)
  assert.equal(buildSasaranKinerjaItems(emptyC).length, 6)

  const emptyT = normalizeTriwulanPrograms([])
  assert.equal(emptyT.length, 1)
  assert.equal(buildTriwulanItems(emptyT).length, 11)
})

test("insertItemAt inserts rows in the middle and top while shifting downstream indices", () => {
  const initialPrograms = ["P1", "P2", "P3", "P4", "P5"].map((label) => ({
    ...createEmptyTriwulanProgram(),
    program: label,
  }))

  // Insert between #2 (index 1) and #3 (index 2)
  const insertedMid = { ...createEmptyTriwulanProgram(), program: "SISIP-TENGAH" }
  const afterMid = insertItemAt(initialPrograms, 2, insertedMid)
  assert.equal(afterMid.length, 6)
  assert.deepEqual(
    afterMid.map((p) => p.program),
    ["P1", "P2", "SISIP-TENGAH", "P3", "P4", "P5"],
  )
  // Old #3 is now #4 (index 3), old #5 is now #6 (index 5)
  assert.equal(afterMid[3].program, "P3")
  assert.equal(afterMid[5].program, "P5")

  // Insert at the top (index 0)
  const insertedTop = { ...createEmptyTriwulanProgram(), program: "SISIP-ATAS" }
  const afterTop = insertItemAt(afterMid, 0, insertedTop)
  assert.deepEqual(
    afterTop.map((p) => p.program),
    ["SISIP-ATAS", "P1", "P2", "SISIP-TENGAH", "P3", "P4", "P5"],
  )
})

test("normalizeTriwulanPrograms and buildTriwulanItems preserve stageTargetTime", () => {
  const normalized = normalizeTriwulanPrograms([
    {
      id: "prog-1",
      program: "Program Uji",
      sasaranList: [
        {
          id: "sas-1",
          sasaran: "Sasaran Uji",
          monthStart: "2026-04",
          monthEnd: "2026-06",
          stage: "Sosialisasi dan pendampingan unit.",
          stageTargetTime: "Minggu ke-2 Mei 2026",
          realization: "Sudah dilaksanakan tahap awal.",
          percentage: "100",
          obstacle: "",
          solution: "",
          solutionTime: "",
          notes: "",
          evidence: "",
        },
      ],
    },
  ])

  assert.equal(
    normalized[0].sasaranList[0].stageTargetTime,
    "Minggu ke-2 Mei 2026",
  )

  const items = buildTriwulanItems(normalized)
  assert.equal(items[3].label, "Tahap Pelaksanaan")
  assert.equal(
    items[3].value,
    "Sosialisasi dan pendampingan unit.\nTarget/Waktu Selesai: Minggu ke-2 Mei 2026",
  )
})

