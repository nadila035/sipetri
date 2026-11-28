import test from "node:test"

import assert from "node:assert/strict"

import {
  canSubmit,
  deadlineCutoff,
  startCutoff,
  getPeriodState,
  addDaysToDateString,
  resolveRecordPeriodKey,
  formatPeriodStatusTag,
  formatDeadlineSummary,
  getDeadlineCardModel,
  canReview,
} from "./src/utils/workflow.ts"

import { reviseRecord } from "./src/utils/revision.ts"

import {
  buildSasaranKinerjaItems,
  buildTriwulanItems,
  createEmptyTriwulanSasaran,
  extractFlatSasaranRows,
  formatStageWithTargetTime,
  rebuildCriteriaFromFlatRows,
  splitStageTargetTime,
} from "./src/utils/drafts.ts"

import {
  computeTableMergeSpans,
  getSasaranKinerjaDisplayRows,
  getTriwulanDisplayRows,
} from "./src/utils/format.ts"

import {
  formatReviewItemLocation,
  getReviewPrograms,
  getSasaranKinerjaReviewCriteria,
} from "./src/utils/review.ts"

import {
  annualSources,
  getUnitAnnualPrerequisiteState,
  importAnnualSources,
  sourceKey,
  syncTriwulanFromApprovedAnnual,
} from "./src/utils/annualSources.ts"

import {
  DEFAULT_STRATEGIC_GOALS,
  addMasterStrategicGoal,
  propagateStrategicGoalRename,
  removeMasterStrategicGoal,
  updateMasterStrategicGoal,
} from "./src/utils/strategicGoals.ts"

import {
  collectLateTriwulanItems,
  filterLateMonitoringEntries,
} from "./src/utils/lateMonitoring.ts"

import fs from "node:fs"
import path from "node:path"

import {
  SOP_ADMIN_DOC,
  SOP_STAFF_DOC,
  filterSopChapters,
  getAllowedWorkspaceSopRoles,
  getSopSpec,
} from "./src/data/sopContent.ts"

import {
  buildMasterWorkbookBytes,
  buildSingleRecordWorkbookBytes,
  buildUnitPackageZipBytes,
} from "./src/utils/exportExcel.ts"

const annual = {
  id: "annual",
  type: "Sasaran Kinerja",
  period: "Tahun 2025",
  unit: "Unit",
  status: "Menunggu",
  sentAt: "snapshot",
  criteriaData: [
    {
      id: "c",
      strategy: {
        id: "s",
        programs: [
          {
            id: "p",
            name: "Program",
            targets: [
              {
                id: "t",
                target: "Target",
                monthStart: "2025-01",
                notes: "annual note",
              },
            ],
          },
        ],
      },
    },
  ],
}

test("annual import matches exact year and unit without approval requirement", () => {
  assert.equal(annualSources([annual], "2025", "Unit").length, 1)

  assert.equal(annualSources([annual], "2026", "Unit").length, 0)

  assert.equal(annualSources([annual], "2025", "Other").length, 0)

  assert.equal(
    annualSources([{ ...annual, criteriaData: undefined }], "2025", "Unit")
      .length,
    0,
  )
})

test("reimport preserves realization evidence notes and immutable snapshot across reload", () => {
  const sources = annualSources([annual], "2025", "Unit")

  const first = importAnnualSources([], sources, "2025", "Unit")

  Object.assign(first[0].sasaranList[0], {
    realization: "done",
    evidence: "https://example.com",
    notes: "quarter note",
  })

  const reloaded = JSON.parse(JSON.stringify(first))

  const next = importAnnualSources(
    reloaded,
    [...sources, ...sources],
    "2025",
    "Unit",
  )

  assert.deepEqual(next, first)

  sources[0].target = "changed annual"

  assert.equal(next[0].sasaranList[0].annualSource.target, "Target")

  assert.deepEqual(importAnnualSources([], sources, "2026", "Unit"), [])

  assert.deepEqual(importAnnualSources([], sources, "2025", "Other"), [])
})

test("distinct annual documents remain explicit sources; legacy rows preserved", () => {
  const sources = annualSources(
    [annual, { ...annual, id: "annual-2" }],
    "2025",
    "Unit",
  )

  assert.notEqual(sourceKey(sources[0]), sourceKey(sources[1]))

  const legacy = [
    {
      id: "legacy",
      program: "Manual",
      sasaranList: [
        { id: "manual", target: "Manual", realization: "existing" },
      ],
    },
  ]

  assert.deepEqual(
    importAnnualSources(legacy, sources, "2025", "Unit")[0],
    legacy[0],
  )
})

test("quarter revision retains annual snapshot", () => {
  const programs = importAnnualSources(
    [],
    annualSources([annual], "2025", "Unit"),
    "2025",
    "Unit",
  )

  const result = reviseRecord(
    { status: "Revisi", items: [], triwulanPrograms: programs },
    {},
  )

  assert.deepEqual(
    result.triwulanPrograms[0].sasaranList[0].annualSource,
    programs[0].sasaranList[0].annualSource,
  )
})

const period = { deadline: "2026-10-30", open: true }

const cutoff = Date.parse("2026-10-30T16:59:59.999Z")

for (const [name, time, allowed] of [
  ["before", cutoff - 1, true],
  ["exact", cutoff, true],
  ["after", cutoff + 1, false],
]) {
  test(`Jakarta cutoff ${name}`, () =>
    assert.equal(canSubmit(period, time), allowed))
}

test("timezone explicit", () =>
  assert.equal(deadlineCutoff(period.deadline), cutoff))

test("closed before deadline", () =>
  assert.equal(canSubmit({ ...period, open: false }, cutoff - 1), false))

test("reopen before deadline", () =>
  assert.equal(canSubmit(period, cutoff - 1), true))

test("reopen does not extend deadline", () =>
  assert.equal(canSubmit(period, cutoff + 1), false))

test("closed or expired period also locks resubmission under Option A until extended", () => {
  assert.equal(canSubmit({ ...period, open: false }, cutoff - 1), false)
  assert.equal(canSubmit(period, cutoff + 1), false)
  assert.equal(
    resolveRecordPeriodKey({
      type: "Laporan Triwulan",
      period: "Triwulan III · 2026",
    }),
    "2026-III",
  )
  assert.equal(
    resolveRecordPeriodKey({
      type: "Sasaran Kinerja",
      period: "Tahun 2026",
    }),
    "2026-annual",
  )
})

test("unconfigured period defaults locked until Admin opens it", () => {
  assert.equal(canSubmit(), false)
  assert.equal(getPeriodState().status, "unscheduled")
  assert.equal(formatPeriodStatusTag(getPeriodState().status), "Ditutup")
})

test("empty deadline allows open period when Admin opens freely", () => {
  assert.equal(canSubmit({ deadline: "", open: true }), true)
  assert.equal(getPeriodState({ deadline: "", open: true }).status, "open")
  assert.equal(
    formatPeriodStatusTag(getPeriodState({ deadline: "", open: true }).status),
    "Dibuka",
  )
})

for (const deadline of ["2026-02-30", "invalid", "2026-13-01"])
  test(`invalid date fails closed: ${deadline}`, () =>
    assert.equal(canSubmit({ deadline, open: true }), false))

for (const status of ["Revisi", "Disetujui"])
  test(`cannot review ${status}`, () =>
    assert.equal(canReview(status, "Disetujui", {}), false))

test("approval of pending record", () =>
  assert.equal(canReview("Menunggu", "Disetujui", {}), true))

test("revision needs nonblank notes", () => {
  assert.equal(canReview("Menunggu", "Revisi", { 0: " " }), false)

  assert.equal(canReview("Menunggu", "Revisi", { 0: "Perbaiki" }), true)
})

test("revision resubmits and clears flags while preserving review history", () => {
  const record = {
    status: "Revisi",
    items: [
      { label: "Sasaran", value: "lama", note: "ubah", needsRevision: true },
    ],
    reviews: [{ id: "prior" }],
  }

  const updated = reviseRecord(record, { 0: "baru" })

  assert.equal(updated.status, "Menunggu")

  assert.equal(updated.items[0].value, "baru")

  assert.equal(updated.items[0].needsRevision, false)

  assert.equal(updated.reviews.length, 2)

  assert.equal(record.items[0].value, "lama")
})

for (const status of ["Menunggu", "Disetujui"])
  test(`revision cannot modify ${status}`, () => {
    const record = { status, items: [] }

    assert.equal(reviseRecord(record, {}), record)
  })

test("startDate and deadline window blocks before startDate and allows inside range", () => {
  const windowed = {
    startDate: "2026-03-25",
    deadline: "2026-04-14",
    open: true,
  }
  const startMs = Date.parse("2026-03-24T17:00:00.000Z")
  const endMs = Date.parse("2026-04-14T16:59:59.999Z")

  assert.equal(startCutoff("2026-03-25"), startMs)
  assert.equal(canSubmit(windowed, startMs - 1), false)
  assert.equal(getPeriodState(windowed, startMs - 1).status, "upcoming")

  assert.equal(canSubmit(windowed, startMs), true)
  assert.equal(getPeriodState(windowed, startMs).status, "open")

  assert.equal(canSubmit(windowed, endMs), true)
  assert.equal(canSubmit(windowed, endMs + 1), false)
  assert.equal(getPeriodState(windowed, endMs + 1).status, "expired")
})

test("invalid startDate or inverted range fails closed", () => {
  assert.equal(
    canSubmit({ startDate: "2026-02-30", deadline: "2026-04-14", open: true }),
    false,
  )
  assert.equal(
    getPeriodState({
      startDate: "2026-05-01",
      deadline: "2026-04-14",
      open: true,
    }).status,
    "invalid",
  )
  assert.equal(
    canSubmit({
      startDate: "2026-05-01",
      deadline: "2026-04-14",
      open: true,
    }),
    false,
  )
})

test("extending deadline adds days accurately and unlocks expired period", () => {
  const extendedDeadline = addDaysToDateString("2026-10-30", 7)
  assert.equal(extendedDeadline, "2026-11-06")
  const afterOldCutoff = Date.parse("2026-10-30T17:00:00.000Z")
  assert.equal(canSubmit({ deadline: "2026-10-30", open: true }, afterOldCutoff), false)
  assert.equal(canSubmit({ deadline: extendedDeadline, open: true }, afterOldCutoff), true)
})

test("formatStageWithTargetTime and splitStageTargetTime roundtrip cleanly", () => {
  const formatted = formatStageWithTargetTime(
    "Penyusunan draf pedoman",
    "Minggu ke-2 Mei 2026",
  )
  assert.equal(
    formatted,
    "Penyusunan draf pedoman\nTarget/Waktu Selesai: Minggu ke-2 Mei 2026",
  )
  assert.deepEqual(splitStageTargetTime(formatted), {
    stage: "Penyusunan draf pedoman",
    stageTargetTime: "Minggu ke-2 Mei 2026",
  })
  assert.deepEqual(splitStageTargetTime("Tanpa keterangan target"), {
    stage: "Tanpa keterangan target",
    stageTargetTime: "",
  })
})

test("reviseRecord updates Tahap Pelaksanaan without duplicating target time label", () => {
  const sasaran = {
    ...createEmptyTriwulanSasaran(),
    strategicGoal: "SS-01",
    target: "Sasaran 1",
    monthStart: "2026-04",
    monthEnd: "2026-06",
    stage: "Tahap awal",
    stageTargetTime: "Mei 2026",
    realization: "Berjalan",
    percentage: "100",
  }
  const programs = [
    {
      id: "p-1",
      strategicGoal: "SS-01",
      program: "Program 1",
      sasaranList: [sasaran],
    },
  ]
  const items = buildTriwulanItems(programs).map((item, idx) =>
    idx === 4 ? { ...item, needsRevision: true, note: "Lengkapi uraian" } : item,
  )
  const record = {
    id: "LTR-2026-II-1",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan II",
    period: "Triwulan II · 2026",
    unit: "BKU",
    sentAt: "10 Juli 2026",
    status: "Revisi",
    progress: 100,
    items,
    triwulanPrograms: programs,
    reviews: [],
  }

  const revisedValue = formatStageWithTargetTime(
    "Tahap awal sudah diperbarui",
    "Akhir Mei 2026",
  )
  const updated = reviseRecord(record, { 4: revisedValue })

  assert.equal(updated.status, "Menunggu")
  assert.equal(updated.items[4].value, revisedValue)
  assert.equal(
    updated.triwulanPrograms[0].sasaranList[0].stage,
    "Tahap awal sudah diperbarui",
  )
  assert.equal(
    updated.triwulanPrograms[0].sasaranList[0].stageTargetTime,
    "Akhir Mei 2026",
  )
})

test("getDeadlineCardModel formats active countdown, open-ended, upcoming, expired, and closed states", () => {
  const june18Midday = Date.parse("2025-06-18T05:00:00.000Z")
  const openWithDeadline = getDeadlineCardModel(
    { startDate: "2025-06-01", deadline: "2025-06-30", open: true },
    june18Midday,
  )
  assert.equal(openWithDeadline.title, "Batas pengumpulan")
  assert.equal(openWithDeadline.headline, "30 Juni 2025")
  assert.equal(openWithDeadline.countdownHighlight, "12")
  assert.equal(openWithDeadline.countdownSuffix, "hari lagi")
  assert.equal(openWithDeadline.progressPercent, 58)
  assert.equal(openWithDeadline.tone, "open")

  const openUnlimited = getDeadlineCardModel(
    { startDate: "", deadline: "", open: true },
    june18Midday,
  )
  assert.equal(openUnlimited.headline, "Terbuka")
  assert.equal(openUnlimited.progressPercent, 100)

  const upcoming = getDeadlineCardModel(
    { startDate: "2025-06-25", deadline: "2025-07-10", open: true },
    june18Midday,
  )
  assert.equal(upcoming.headline, "10 Juli 2025")
  assert.equal(upcoming.countdownHighlight, "7")
  assert.equal(upcoming.countdownSuffix, "hari lagi dibuka")
  assert.equal(upcoming.progressPercent, 0)

  const expired = getDeadlineCardModel(
    { startDate: "2025-05-01", deadline: "2025-06-15", open: true },
    june18Midday,
  )
  assert.equal(expired.headline, "15 Juni 2025")
  assert.equal(expired.countdownHighlight, "3")
  assert.equal(expired.countdownSuffix, "hari lewat tenggat")
  assert.equal(expired.tone, "expired")

  const closed = getDeadlineCardModel(
    { startDate: "", deadline: "2025-06-30", open: false },
    june18Midday,
  )
  assert.equal(closed.headline, "30 Juni 2025")
  assert.equal(closed.countdownSuffix, "Pengiriman ditutup")
  assert.equal(closed.progressPercent, 0)
})

test("formatDeadlineSummary keeps concise deadline-only labels across states", () => {
  const midNov2026 = Date.parse("2026-11-20T05:00:00.000Z")
  const lateNov2026 = Date.parse("2026-11-28T05:00:00.000Z")
  assert.equal(
    formatDeadlineSummary(
      {
        startDate: "2026-11-01",
        deadline: "2026-11-27",
        open: true,
      },
      midNov2026,
    ),
    "27 November 2026",
  )
  assert.equal(
    formatDeadlineSummary(
      {
        startDate: "2026-11-01",
        deadline: "2026-11-27",
        open: true,
      },
      lateNov2026,
    ),
    "27 November 2026 (Terkunci)",
  )
  assert.equal(
    formatDeadlineSummary(
      {
        startDate: "2026-01-01",
        deadline: "2026-01-31",
        open: false,
      },
      midNov2026,
    ),
    "31 Januari 2026 (Terkunci)",
  )
  assert.equal(
    formatDeadlineSummary(
      { startDate: "", deadline: "", open: true },
      midNov2026,
    ),
    "Tanpa batas tanggal",
  )
  assert.equal(
    formatDeadlineSummary(
      { startDate: "", deadline: "", open: false },
      midNov2026,
    ),
    "Terkunci",
  )
})

test("getReviewPrograms groups multi-sasaran 13-column Laporan Triwulan programs cleanly", () => {
  const sas1 = createEmptyTriwulanSasaran("sas-1")
  sas1.strategicGoal = "SS-04 Transformasi Digital"
  sas1.target = "Sasaran Pertama"
  sas1.percentage = "80"
  const sas2 = createEmptyTriwulanSasaran("sas-2")
  sas2.strategicGoal = "SS-04 Transformasi Digital"
  sas2.target = "Sasaran Kedua"
  sas2.percentage = "95"
  const sas3 = createEmptyTriwulanSasaran("sas-3")
  sas3.strategicGoal = "SS-03 Pengembangan SDM"
  sas3.target = "Sasaran Ketiga"

  const triwulanPrograms = [
    {
      id: "prog-1",
      strategicGoal: "SS-04 Transformasi Digital",
      program: "Digitalisasi Layanan",
      sasaranList: [sas1, sas2],
    },
    {
      id: "prog-2",
      strategicGoal: "SS-03 Pengembangan SDM",
      program: "Peningkatan SDM",
      sasaranList: [sas3],
    },
  ]

  const record = {
    id: "LTR-TEST-MULTI",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan III",
    period: "Triwulan III · 2026",
    unit: "BPK",
    sentAt: "10 Oktober 2026",
    status: "Menunggu",
    progress: 100,
    triwulanPrograms,
    items: buildTriwulanItems(triwulanPrograms),
  }

  const reviewed = getReviewPrograms(record)
  assert.equal(reviewed.length, 2)
  assert.equal(reviewed[0].name, "Digitalisasi Layanan")
  assert.deepEqual(reviewed[0].programItemIndexes, [0, 1])
  assert.equal(reviewed[0].sasaranList.length, 2)
  assert.equal(reviewed[0].sasaranList[0].label, "Sasaran Pertama")
  assert.equal(reviewed[0].sasaranList[0].itemIndexes.length, 10)
  assert.equal(reviewed[0].sasaranList[0].itemIndexes[0], 2)
  assert.equal(reviewed[0].sasaranList[1].label, "Sasaran Kedua")
  assert.equal(reviewed[0].sasaranList[1].itemIndexes.length, 10)
  assert.equal(reviewed[0].sasaranList[1].itemIndexes[0], 14)
  assert.equal(
    formatReviewItemLocation(record, reviewed, 18),
    "Program 1 · Sasaran 2 · Realisasi (%)",
  )
  assert.equal(
    formatReviewItemLocation(record, reviewed, 1),
    "Program 1 · Program Kerja",
  )

  const legacyRecord = {
    ...record,
    triwulanPrograms: undefined,
  }
  const fallbackReviewed = getReviewPrograms(legacyRecord)
  assert.equal(fallbackReviewed.length, 2)
  assert.equal(fallbackReviewed[0].sasaranList.length, 2)
  assert.equal(fallbackReviewed[1].sasaranList.length, 1)
})

test("getReviewPrograms groups multi-sasaran 6-column Sasaran Kinerja programs cleanly", () => {
  const criteriaData = [
    {
      id: "crit-1",
      name: "Digitalisasi Tata Kelola",
      strategy: {
        id: "strat-1",
        name: "Digitalisasi Tata Kelola",
        programs: [],
      },
      strategies: [
        {
          id: "strat-1",
          name: "Digitalisasi Tata Kelola",
          programs: [
            {
              id: "prog-1",
              name: "Pengembangan Sistem",
              targets: [],
              sasaranList: [
                {
                  id: "s-1",
                  sasaran: "Modul verifikasi aktif",
                  bulan_mulai: "2026-01",
                  bulan_selesai: "2026-06",
                  keterangan: "Tahap 1",
                },
                {
                  id: "s-2",
                  sasaran: "Modul arsip aktif",
                  bulan_mulai: "2026-07",
                  bulan_selesai: "2026-12",
                  keterangan: "Tahap 2",
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  const record = {
    id: "SK-TEST-MULTI",
    type: "Sasaran Kinerja",
    title: "Sasaran Kinerja Tahun 2026",
    period: "Tahun 2026",
    unit: "BPK",
    sentAt: "10 Januari 2026",
    status: "Menunggu",
    progress: 100,
    criteriaData,
    items: buildSasaranKinerjaItems(criteriaData),
  }

  const reviewed = getReviewPrograms(record)
  assert.equal(reviewed.length, 1)
  assert.deepEqual(reviewed[0].programItemIndexes, [0, 1])
  assert.equal(reviewed[0].sasaranList.length, 2)
  assert.deepEqual(reviewed[0].sasaranList[0].itemIndexes, [2, 3, 4])
  assert.deepEqual(reviewed[0].sasaranList[1].itemIndexes, [5, 6, 7])
  assert.equal(
    formatReviewItemLocation(record, reviewed, 5),
    "Program 1 · Sasaran 2 · Sasaran Kinerja",
  )
})

test("reviseRecord preserves edited Program Kerja name on multi-sasaran Laporan Triwulan", () => {
  const sas1 = createEmptyTriwulanSasaran("sas-1")
  sas1.strategicGoal = "SS-01"
  sas1.target = "Target 1"
  const sas2 = createEmptyTriwulanSasaran("sas-2")
  sas2.strategicGoal = "SS-01"
  sas2.target = "Target 2"
  const programs = [
    {
      id: "prog-1",
      strategicGoal: "SS-01",
      program: "Program Lama",
      sasaranList: [sas1, sas2],
    },
  ]
  const record = {
    id: "LTR-REV-MULTI",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan I",
    period: "Triwulan I · 2026",
    unit: "BPK",
    sentAt: "10 April 2026",
    status: "Revisi",
    progress: 100,
    items: buildTriwulanItems(programs),
    triwulanPrograms: programs,
    reviews: [],
  }

  const updated = reviseRecord(record, { 1: "Program Baru" })
  assert.equal(updated.triwulanPrograms[0].program, "Program Baru")
})

test("getSasaranKinerjaReviewCriteria maps structured 6-column multi-sasaran and fallback rows to exact item indexes", () => {
  const criteriaData = [
    {
      id: "crit-1",
      name: "Strategi A",
      strategy: { id: "s1", name: "Strategi A", programs: [] },
      strategies: [
        {
          id: "s1",
          name: "Strategi A",
          programs: [
            {
              id: "p1",
              name: "Program A",
              targets: [],
              sasaranList: [
                {
                  id: "t1",
                  sasaran: "Sasaran 1",
                  bulan_mulai: "2026-01",
                  bulan_selesai: "2026-06",
                  keterangan: "Ket 1",
                },
                {
                  id: "t2",
                  sasaran: "Sasaran 2",
                  bulan_mulai: "2026-07",
                  bulan_selesai: "2026-12",
                  keterangan: "Ket 2",
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  const record = {
    id: "SK-CRIT-MULTI",
    type: "Sasaran Kinerja",
    title: "Sasaran Kinerja Tahun 2026",
    period: "Tahun 2026",
    unit: "BPK",
    sentAt: "10 Januari 2026",
    status: "Menunggu",
    progress: 100,
    criteriaData,
    items: buildSasaranKinerjaItems(criteriaData),
  }

  const structured = getSasaranKinerjaReviewCriteria(record)
  assert.equal(structured.length, 1)
  assert.equal(structured[0].critItemIdx, -1)
  assert.equal(structured[0].stratSlots[0].stratItemIdx, 0)
  assert.equal(structured[0].stratSlots[0].programSlots[0].progItemIdx, 1)
  assert.equal(
    structured[0].stratSlots[0].programSlots[0].sasaranSlots.length,
    2,
  )
  assert.equal(
    structured[0].stratSlots[0].programSlots[0].sasaranSlots[0].sasaranItemIdx,
    2,
  )
  assert.equal(
    structured[0].stratSlots[0].programSlots[0].sasaranSlots[1].sasaranItemIdx,
    5,
  )

  const legacy = getSasaranKinerjaReviewCriteria({
    ...record,
    criteriaData: undefined,
  })
  assert.equal(legacy.length, 1)
  assert.equal(legacy[0].stratSlots[0].programSlots[0].sasaranSlots.length, 2)
  assert.equal(
    legacy[0].stratSlots[0].programSlots[0].sasaranSlots[1].keteranganItemIdx,
    7,
  )
})

test("SOP role isolation, chapter structure, and keyword search work accurately", () => {
  assert.deepEqual(getAllowedWorkspaceSopRoles("staff"), ["staff"])
  assert.deepEqual(getAllowedWorkspaceSopRoles("admin"), ["admin"])

  assert.equal(getSopSpec("staff").chapters.length, 5)
  assert.equal(getSopSpec("admin").chapters.length, 6)

  for (const doc of [SOP_STAFF_DOC, SOP_ADMIN_DOC]) {
    const serialized = JSON.stringify(doc)
    assert.equal(serialized.includes("\u2014"), false)
    for (const ch of doc.chapters) {
      assert.ok(ch.purpose.length > 10)
      assert.ok(ch.steps.length >= 2)
      assert.ok(ch.mandatoryRules.length >= 1)
      assert.ok(ch.quickFixes.length >= 1)
    }
  }

  const staffUnder100 = filterSopChapters(SOP_STAFF_DOC.chapters, "100%")
  assert.ok(
    staffUnder100.some((ch) => ch.id === "staf-bab-3-laporan-triwulan"),
  )

  const staffStatusTable = SOP_STAFF_DOC.chapters.find(
    (ch) => ch.id === "staf-bab-4-riwayat-revisi-unduh",
  )
  assert.deepEqual(
    staffStatusTable?.statusTable?.map((r) => r.status),
    ["Draf", "Menunggu", "Revisi", "Disetujui"],
  )

  const adminExports = SOP_ADMIN_DOC.chapters.find(
    (ch) => ch.id === "admin-bab-5-arsip-rekap-master",
  )
  assert.deepEqual(
    adminExports?.exportTable?.map((r) => r.extension),
    [".xlsx", ".zip", ".csv"],
  )
  assert.equal(
    filterSopChapters(SOP_ADMIN_DOC.chapters, "kata-kunci-tidak-ada").length,
    0,
  )
})

test("Master Recap .xlsx and Unit Package .zip builders produce valid PKZIP containers", () => {
  const sampleRecords = [
    {
      id: "SK-2026-FKET",
      type: "Sasaran Kinerja",
      title: "Sasaran Kinerja Tahun 2026",
      period: "Tahun 2026",
      unit: "FKET",
      parentUnit: "FKET",
      subUnit: "FKET",
      sentAt: "10/01/2026, 09.00.00",
      status: "Disetujui",
      progress: 100,
      items: [],
      criteriaData: [
        {
          id: "c1",
          name: "Pendidikan",
          strategy: {
            id: "s1",
            name: "Mutu Prodi",
            programs: [
              {
                id: "p1",
                name: "Akreditasi",
                targets: [
                  {
                    id: "t1",
                    target: "Unggul",
                    monthStart: "2026-01",
                    monthEnd: "2026-06",
                    notes: "-",
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: "LTR-2026-I-BPK",
      type: "Laporan Triwulan",
      title: "Laporan Realisasi Triwulan I",
      period: "Triwulan I · 2026",
      unit: "BPK",
      parentUnit: "PRP",
      subUnit: "BPK",
      sentAt: "05/04/2026, 14.30.00",
      status: "Menunggu",
      progress: 100,
      items: [],
      triwulanPrograms: [
        {
          id: "tp1",
          program: "Evaluasi Anggaran",
          sasaranList: [
            {
              ...createEmptyTriwulanSasaran("ts1"),
              target: "Monitoring RKA",
              monthStart: "2026-01",
              monthEnd: "2026-03",
              stage: "Kompilasi",
              realization: "80% unit terkumpul",
              percentage: "80",
              obstacle: "2 unit belum lengkap",
              solution: "Pendampingan teknis",
              solutionTime: "2026-04-15",
              evidence: "https://drive.google.com/example",
            },
          ],
        },
      ],
    },
  ]

  const xlsxBytes = buildMasterWorkbookBytes(sampleRecords, "2026", "")
  assert.equal(xlsxBytes[0], 0x50)
  assert.equal(xlsxBytes[1], 0x4b)
  assert.equal(xlsxBytes[2], 0x03)
  assert.equal(xlsxBytes[3], 0x04)
  const xlsxText = new TextDecoder().decode(xlsxBytes)
  assert.ok(xlsxText.includes("Ringkasan 42 Unit"))
  assert.ok(xlsxText.includes("Daftar Dokumen"))
  assert.ok(xlsxText.includes("Rincian Triwulan"))
  assert.ok(xlsxText.includes("Rincian Sasaran RKA"))
  assert.ok(xlsxText.includes("Perpustakaan"))

  const zipBytes = buildUnitPackageZipBytes(sampleRecords, "2026", "")
  assert.equal(zipBytes[0], 0x50)
  assert.equal(zipBytes[1], 0x4b)
  const zipText = new TextDecoder().decode(zipBytes)
  assert.ok(zipText.includes("00_Indeks_Arsip_SIPETRI.xlsx"))
  assert.ok(zipText.includes("FKET/SK-2026-FKET_Sasaran_Kinerja.xlsx"))
  assert.ok(zipText.includes("PRP/BPK/LTR-2026-I-BPK_Laporan_Triwulan.xlsx"))
})

test("Independent Sasaran Strategis per row, merge spans, and XLSX mergeCells work accurately", () => {
  // Step 1: Start with 2 rows sharing SS-05 and Program Kerja "hghgh", plus Row 3 under SS-05 with "jbbhbh"
  const initialCriteria = rebuildCriteriaFromFlatRows([
    {
      strategicGoalId: "ss-itpln-05",
      strategicGoal:
        "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
      programName: "hghgh",
      sasaranId: "sas-1",
      sasaranText: "bjbjjb",
      bulanMulai: "2026-01",
      bulanSelesai: "2026-12",
      keterangan: "jjjhhjb",
    },
    {
      strategicGoalId: "ss-itpln-05",
      strategicGoal:
        "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
      programName: "hghgh",
      sasaranId: "sas-2",
      sasaranText: "mmnkn",
      bulanMulai: "2026-01",
      bulanSelesai: "2026-12",
      keterangan: "nnnkm",
    },
    {
      strategicGoalId: "ss-itpln-05",
      strategicGoal:
        "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
      programName: "jbbhbh",
      sasaranId: "sas-3",
      sasaranText: "nknkkn",
      bulanMulai: "2026-01",
      bulanSelesai: "2026-12",
      keterangan: "nknkkn",
    },
  ])

  const initialRecord = {
    id: "SK-2026-FTBE-MERGE",
    type: "Sasaran Kinerja",
    title: "Sasaran Kinerja Tahun 2026",
    period: "Tahun 2026",
    unit: "FTBE",
    parentUnit: "FTBE",
    subUnit: "FTBE",
    sentAt: "28/11/2026",
    status: "Disetujui",
    progress: 100,
    criteriaData: initialCriteria,
    items: buildSasaranKinerjaItems(initialCriteria),
  }

  // Verify contiguous merge spans on initial 3 rows:
  // Rows 1 & 2 share No = 1 (noSpan = 2), Goal spans 3 rows, Program 1 spans 2 rows; Row 3 becomes No = 2 (noSpan = 1)!
  const displayBefore = getSasaranKinerjaDisplayRows(initialRecord)
  const spansBefore = computeTableMergeSpans(displayBefore)
  assert.deepEqual(
    spansBefore.map((s) => [
      s.groupNumber,
      s.noSpan,
      s.goalSpan,
      s.programSpan,
    ]),
    [
      [1, 2, 3, 2],
      [1, 0, 0, 0],
      [2, 1, 0, 1],
    ],
  )

  // Verify single-record XLSX export emits real <mergeCells> for A9:A10 (No), B9:B11 (Sasaran Strategis), and C9:C10 (Program Kerja)
  const skXlsxBytes = buildSingleRecordWorkbookBytes(initialRecord)
  const skXlsxXml = new TextDecoder().decode(skXlsxBytes)
  assert.ok(skXlsxXml.includes('<mergeCell ref="A9:A10"/>'))
  assert.ok(skXlsxXml.includes('<mergeCell ref="B9:B11"/>'))
  assert.ok(skXlsxXml.includes('<mergeCell ref="C9:C10"/>'))
  assert.ok(skXlsxXml.includes("FF4ED64E"))

  // Step 2: Edit ONLY Row 2 ("mmnkn") to choose a DIFFERENT Sasaran Strategis (SS-02) while keeping Program Kerja "hghgh"!
  const extracted = extractFlatSasaranRows(initialCriteria)
  assert.equal(extracted.length, 3)
  extracted[1] = {
    ...extracted[1],
    criteriaId: undefined,
    strategyId: undefined,
    programId: undefined,
    strategicGoalId: "ss-itpln-02",
    strategicGoal:
      "Penguatan Riset Terapan Transisi Energi dan Inovasi Pengabdian",
  }

  const afterEditCriteria = rebuildCriteriaFromFlatRows(extracted)
  const afterEditRows = extractFlatSasaranRows(afterEditCriteria)
  assert.equal(afterEditRows.length, 3)
  // Row 1 MUST keep SS-05!
  assert.equal(
    afterEditRows[0].strategicGoal,
    "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
  )
  assert.equal(afterEditRows[0].programName, "hghgh")
  // Row 2 MUST keep its newly chosen SS-02 even though Program Kerja is also "hghgh"!
  assert.equal(
    afterEditRows[1].strategicGoal,
    "Penguatan Riset Terapan Transisi Energi dan Inovasi Pengabdian",
  )
  assert.equal(afterEditRows[1].programName, "hghgh")
  // Row 3 MUST also remain untouched (SS-05, jbbhbh)!
  assert.equal(
    afterEditRows[2].strategicGoal,
    "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
  )
  assert.equal(afterEditRows[2].programName, "jbbhbh")

  // Verify merge spans do NOT merge "hghgh" or "No" across SS-05 (Row 1) and SS-02 (Row 2)
  const spansAfterEdit = computeTableMergeSpans(afterEditRows)
  assert.deepEqual(
    spansAfterEdit.map((s) => [
      s.groupNumber,
      s.noSpan,
      s.goalSpan,
      s.programSpan,
    ]),
    [
      [1, 1, 1, 1],
      [2, 1, 1, 1],
      [3, 1, 1, 1],
    ],
  )

  // Verify Triwulan sync preserves distinct Sasaran Strategis when Program Kerja names match
  const updatedApprovedRecord = {
    ...initialRecord,
    criteriaData: afterEditCriteria,
    items: buildSasaranKinerjaItems(afterEditCriteria),
  }
  const syncedTw = syncTriwulanFromApprovedAnnual({
    existingPrograms: [],
    approvedRecord: updatedApprovedRecord,
    allRecords: [updatedApprovedRecord],
    year: "2026",
    quarter: "I",
    unitCode: "FTBE",
  })
  const twDisplay = getTriwulanDisplayRows({
    id: "LTR-2026-I-FTBE",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan I",
    period: "Triwulan I · 2026",
    unit: "FTBE",
    sentAt: "28/11/2026",
    status: "Draf",
    progress: 0,
    items: buildTriwulanItems(syncedTw),
    triwulanPrograms: syncedTw,
  })
  assert.equal(
    twDisplay[0].strategicGoal,
    "Peningkatan Prestasi Kemahasiswaan, Karier Alumni, dan Kerjasama Industri",
  )
  assert.equal(
    twDisplay[1].strategicGoal,
    "Penguatan Riset Terapan Transisi Energi dan Inovasi Pengabdian",
  )
})


test("Master Sasaran Strategis CRUD and rename propagation work end-to-end", () => {
  const initial = structuredClone(DEFAULT_STRATEGIC_GOALS)
  assert.equal(initial.length, 6)

  const added = addMasterStrategicGoal(initial, {
    name: "Kemandirian Laboratorium Riset Energi Baru",
    description: "Penguatan sertifikasi ISO laboratorium",
  })
  assert.equal(added.ok, true)
  if (!added.ok) return
  assert.equal(added.created.code, "SS-07")
  assert.equal(added.list.length, 7)

  const duplicate = addMasterStrategicGoal(added.list, {
    name: "kemandirian laboratorium riset energi baru",
  })
  assert.equal(duplicate.ok, false)

  const edited = updateMasterStrategicGoal(added.list, added.created.id, {
    name: "Keunggulan Laboratorium Riset Transisi Energi",
  })
  assert.equal(edited.ok, true)
  if (!edited.ok) return

  const draftRecords = [
    {
      id: "DRAF-SK-2026-fket",
      type: "Sasaran Kinerja",
      period: "Tahun 2026",
      unit: "FKET",
      status: "Draf",
      sentAt: "Belum dikirim",
      progress: 100,
      items: [{ label: "Sasaran Strategis", value: added.created.name }],
      criteriaData: [
        {
          id: "c1",
          name: added.created.name,
          strategy: {
            id: "s1",
            strategicGoalId: added.created.id,
            name: added.created.name,
            programs: [],
          },
          strategies: [
            {
              id: "s1",
              strategicGoalId: added.created.id,
              name: added.created.name,
              programs: [],
            },
          ],
        },
      ],
    },
  ]

  const propagated = propagateStrategicGoalRename(
    draftRecords,
    edited.updated.id,
    edited.previous.name,
    edited.updated.name,
  )
  assert.equal(
    propagated[0].criteriaData[0].strategies[0].name,
    "Keunggulan Laboratorium Riset Transisi Energi",
  )
  assert.equal(
    propagated[0].items[0].value,
    "Keunggulan Laboratorium Riset Transisi Energi",
  )

  const removed = removeMasterStrategicGoal(edited.list, edited.updated.id)
  assert.equal(removed.ok, true)
  if (removed.ok) {
    assert.equal(removed.list.length, 6)
  }
})

test("Prerequisite workflow, auto-populate after ACC, carry-over, 100% lock, and late monitoring work accurately", () => {
  const skDraft = {
    id: "SK-2026-FKET",
    type: "Sasaran Kinerja",
    title: "Sasaran Kinerja Tahun 2026",
    period: "Tahun 2026",
    unit: "FKET",
    parentUnit: "FKET",
    subUnit: "FKET",
    sentAt: "10/01/2026, 09.00.00",
    status: "Menunggu",
    progress: 100,
    items: [],
    criteriaData: [
      {
        id: "crit-1",
        name: "Peningkatan Mutu Pendidikan",
        strategy: { id: "st-1", name: "Peningkatan Mutu Pendidikan", programs: [] },
        strategies: [
          {
            id: "st-1",
            strategicGoalId: "ss-itpln-01",
            name: "Peningkatan Mutu Pendidikan",
            programs: [
              {
                id: "prog-tw1-done",
                name: "Audit Kurikulum OBE",
                targets: [],
                sasaranList: [
                  {
                    id: "target-a",
                    sasaran: "100% RPS berbasis OBE",
                    bulan_mulai: "2026-01",
                    bulan_selesai: "2026-03",
                    keterangan: "Selesai TW I",
                  },
                ],
              },
              {
                id: "prog-tw1-carry",
                name: "Sertifikasi Kompetensi Dosen",
                targets: [],
                sasaranList: [
                  {
                    id: "target-b",
                    sasaran: "25 dosen tersertifikasi industri",
                    bulan_mulai: "2026-01",
                    bulan_selesai: "2026-03",
                    keterangan: "Target TW I",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  // Before Admin ACC: Triwulan is locked
  const waitingPrereq = getUnitAnnualPrerequisiteState(
    [skDraft],
    "2026",
    "FKET",
  )
  assert.equal(waitingPrereq.status, "waiting")
  assert.equal(waitingPrereq.canAccessTriwulan, false)

  // Admin approves (ACC) Sasaran Kinerja
  const skApproved = { ...skDraft, status: "Disetujui" }
  const approvedPrereq = getUnitAnnualPrerequisiteState(
    [skApproved],
    "2026",
    "FKET",
  )
  assert.equal(approvedPrereq.status, "approved")
  assert.equal(approvedPrereq.canAccessTriwulan, true)

  // Auto-populate TW I
  const tw1Auto = syncTriwulanFromApprovedAnnual({
    existingPrograms: [],
    approvedRecord: skApproved,
    allRecords: [skApproved],
    year: "2026",
    quarter: "I",
    unitCode: "FKET",
  })
  assert.equal(tw1Auto.length, 2)
  assert.equal(tw1Auto[0].strategicGoal, "Peningkatan Mutu Pendidikan")
  assert.equal(tw1Auto[0].sasaranList[0].isLockedCompleted, false)

  // Unit submits TW I: target-a = 100%, target-b = 60% (<100%), and Admin approves TW I
  const tw1SubmittedPrograms = structuredClone(tw1Auto)
  tw1SubmittedPrograms[0].sasaranList[0].stage = "Evaluasi selesai"
  tw1SubmittedPrograms[0].sasaranList[0].realization = "Seluruh RPS disahkan"
  tw1SubmittedPrograms[0].sasaranList[0].percentage = "100"

  tw1SubmittedPrograms[1].sasaranList[0].stage = "Batch 1 berjalan"
  tw1SubmittedPrograms[1].sasaranList[0].realization = "15 dari 25 dosen lulus"
  tw1SubmittedPrograms[1].sasaranList[0].percentage = "60"
  tw1SubmittedPrograms[1].sasaranList[0].obstacle = "Jadwal asesor mundur"
  tw1SubmittedPrograms[1].sasaranList[0].solution = "Penjadwalan batch 2"
  tw1SubmittedPrograms[1].sasaranList[0].solutionTime = "Mei 2026"

  const tw1ApprovedRecord = {
    id: "LTR-2026-I-FKET",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan I",
    period: "Triwulan I · 2026",
    unit: "FKET",
    parentUnit: "FKET",
    subUnit: "FKET",
    sentAt: "05/04/2026, 10.00.00",
    status: "Disetujui",
    progress: 100,
    items: buildTriwulanItems(tw1SubmittedPrograms),
    triwulanPrograms: tw1SubmittedPrograms,
  }

  // Open TW II:
  // - target-a (validated 100% in TW I) MUST be locked read-only (isLockedCompleted: true)
  // - target-b (60% in TW I, targetQuarter I) MUST carry-over starting at 60% with lateStatus = "Terlambat"
  const tw2Synced = syncTriwulanFromApprovedAnnual({
    existingPrograms: [],
    approvedRecord: skApproved,
    allRecords: [skApproved, tw1ApprovedRecord],
    year: "2026",
    quarter: "II",
    unitCode: "FKET",
  })

  const tw2ItemA = tw2Synced[0].sasaranList[0]
  const tw2ItemB = tw2Synced[1].sasaranList[0]

  assert.equal(tw2ItemA.isLockedCompleted, true)
  assert.equal(tw2ItemA.completedInQuarter, "I")
  assert.equal(tw2ItemA.percentage, "100")

  assert.equal(tw2ItemB.isLockedCompleted, false)
  assert.equal(tw2ItemB.carryOverFromQuarter, "I")
  assert.equal(tw2ItemB.priorPercentage, 60)
  assert.equal(tw2ItemB.percentage, "60")
  assert.equal(tw2ItemB.lateStatus, "Terlambat")

  // Late Monitoring detects target-b as overdue in TW I
  const lateDuringTw2 = collectLateTriwulanItems({
    records: [skApproved, tw1ApprovedRecord],
    periods: {},
    year: "2026",
    activeQuarter: "II",
  })
  assert.equal(lateDuringTw2.length, 1)
  assert.equal(lateDuringTw2[0].subUnit, "FKET")
  assert.equal(lateDuringTw2[0].targetQuarter, "I")
  assert.equal(lateDuringTw2[0].percentage, 60)
  assert.equal(lateDuringTw2[0].remainingPercentage, 40)
  assert.equal(lateDuringTw2[0].lateStatus, "Terlambat")
  assert.equal(
    filterLateMonitoringEntries(lateDuringTw2, { overdueQuarter: "I" }).length,
    1,
  )
  assert.equal(
    filterLateMonitoringEntries(lateDuringTw2, { overdueQuarter: "II" }).length,
    0,
  )

  // Now unit finishes target-b to 100% in TW II -> status becomes "Pencapaian Terlambat"
  tw2ItemB.percentage = "100"
  tw2ItemB.draftSavedAt = "2026-05-10T09:00:00.000Z"
  const tw2ResyncedAfter100 = syncTriwulanFromApprovedAnnual({
    existingPrograms: tw2Synced,
    approvedRecord: skApproved,
    allRecords: [skApproved, tw1ApprovedRecord],
    year: "2026",
    quarter: "II",
    unitCode: "FKET",
  })
  assert.equal(
    tw2ResyncedAfter100[1].sasaranList[0].lateStatus,
    "Pencapaian Terlambat",
  )

  // Verify Late Monitoring updates to Pencapaian Terlambat and NEVER flags target-a (completed on-time in TW I) even if an untouched TW III draft exists
  const tw2DraftRecord = {
    id: "DRAF-LTR-2026-II-fket",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan II",
    period: "Triwulan II · 2026",
    unit: "FKET",
    parentUnit: "FKET",
    subUnit: "FKET",
    sentAt: "Belum dikirim",
    updatedAt: "2026-05-10T09:00:00.000Z",
    status: "Draf",
    progress: 100,
    items: buildTriwulanItems(tw2ResyncedAfter100),
    triwulanPrograms: tw2ResyncedAfter100,
  }
  const untouchedTw3AutoDraft = {
    id: "DRAF-LTR-2026-III-fket-auto",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan III",
    period: "Triwulan III · 2026",
    unit: "FKET",
    parentUnit: "FKET",
    subUnit: "FKET",
    sentAt: "Belum dikirim",
    status: "Draf",
    progress: 0,
    items: [],
    triwulanPrograms: tw1Auto.map((p) => ({
      ...p,
      sasaranList: p.sasaranList.map((s) => ({
        ...s,
        lateStatus: "Terlambat",
      })),
    })),
  }

  const lateAfterTw2Draft100 = collectLateTriwulanItems({
    records: [
      skApproved,
      tw1ApprovedRecord,
      tw2DraftRecord,
      untouchedTw3AutoDraft,
    ],
    periods: {},
    year: "2026",
    activeQuarter: "III",
  })
  assert.equal(lateAfterTw2Draft100.length, 1)
  assert.equal(lateAfterTw2Draft100[0].program, "Sertifikasi Kompetensi Dosen")
  assert.equal(lateAfterTw2Draft100[0].percentage, 100)
  assert.equal(lateAfterTw2Draft100[0].lateStatus, "Pencapaian Terlambat")
})

test("Zero em-dashes (U+2014) exist anywhere across src/ TypeScript and TSX files", () => {
  const walk = (dir) => {
    const out = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(full))
      else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  const files = walk(path.resolve("src"))
  assert.ok(files.length > 20)
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8")
    assert.equal(
      content.includes("\u2014"),
      false,
      `Found forbidden em-dash in ${file}`,
    )
  }
})
