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
  formatStageWithTargetTime,
  splitStageTargetTime,
} from "./src/utils/drafts.ts"

import {
  formatReviewItemLocation,
  getReviewPrograms,
  getSasaranKinerjaReviewCriteria,
} from "./src/utils/review.ts"

import {
  annualSources,
  importAnnualSources,
  sourceKey,
} from "./src/utils/annualSources.ts"

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
    sasaran: "Sasaran 1",
    monthStart: "2026-04",
    monthEnd: "2026-06",
    stage: "Tahap awal",
    stageTargetTime: "Mei 2026",
    realization: "Berjalan",
    percentage: "100",
  }
  const programs = [{ id: "p-1", program: "Program 1", sasaranList: [sasaran] }]
  const items = buildTriwulanItems(programs).map((item, idx) =>
    idx === 3 ? { ...item, needsRevision: true, note: "Lengkapi uraian" } : item,
  )
  const record = {
    id: "LTR-2026-II-1",
    type: "Laporan Triwulan",
    title: "Laporan Realisasi Triwulan II",
    period: "Triwulan II · 2026",
    unit: "Bagian Keuangan",
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
  const updated = reviseRecord(record, { 3: revisedValue })

  assert.equal(updated.status, "Menunggu")
  assert.equal(updated.items[3].value, revisedValue)
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
  assert.equal(
    formatDeadlineSummary({
      startDate: "2026-11-01",
      deadline: "2026-11-27",
      open: true,
    }),
    "27 November 2026",
  )
  assert.equal(
    formatDeadlineSummary({
      startDate: "2026-01-01",
      deadline: "2026-01-31",
      open: false,
    }),
    "31 Januari 2026 (Terkunci)",
  )
  assert.equal(
    formatDeadlineSummary({ startDate: "", deadline: "", open: true }),
    "Tanpa batas tanggal",
  )
  assert.equal(
    formatDeadlineSummary({ startDate: "", deadline: "", open: false }),
    "Terkunci",
  )
})

test("getReviewPrograms groups multi-sasaran Laporan Triwulan programs and keeps Program Kerja at program level", () => {
  const sas1 = createEmptyTriwulanSasaran("sas-1")
  sas1.target = "Sasaran Pertama"
  sas1.percentage = "80"
  const sas2 = createEmptyTriwulanSasaran("sas-2")
  sas2.target = "Sasaran Kedua"
  sas2.percentage = "95"
  const sas3 = createEmptyTriwulanSasaran("sas-3")
  sas3.target = "Sasaran Ketiga"

  const triwulanPrograms = [
    {
      id: "prog-1",
      program: "Digitalisasi Layanan",
      sasaranList: [sas1, sas2],
    },
    {
      id: "prog-2",
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
  assert.deepEqual(reviewed[0].programItemIndexes, [0])
  assert.equal(reviewed[0].sasaranList.length, 2)
  assert.equal(reviewed[0].sasaranList[0].label, "Sasaran Pertama")
  assert.equal(reviewed[0].sasaranList[0].itemIndexes.length, 10)
  assert.equal(reviewed[0].sasaranList[0].itemIndexes[0], 1)
  assert.equal(reviewed[0].sasaranList[1].label, "Sasaran Kedua")
  assert.equal(reviewed[0].sasaranList[1].itemIndexes.length, 10)
  assert.equal(reviewed[0].sasaranList[1].itemIndexes[0], 12)
  assert.equal(
    formatReviewItemLocation(record, reviewed, 16),
    "Program 1 · Sasaran 2 · Realisasi (%)",
  )
  assert.equal(
    formatReviewItemLocation(record, reviewed, 0),
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

test("getReviewPrograms groups multi-sasaran Sasaran Kinerja programs cleanly", () => {
  const criteriaData = [
    {
      id: "crit-1",
      name: "Tata Kelola",
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
  assert.deepEqual(reviewed[0].programItemIndexes, [0, 1, 2])
  assert.equal(reviewed[0].sasaranList.length, 2)
  assert.deepEqual(reviewed[0].sasaranList[0].itemIndexes, [3, 4, 5])
  assert.deepEqual(reviewed[0].sasaranList[1].itemIndexes, [6, 7, 8])
  assert.equal(
    formatReviewItemLocation(record, reviewed, 6),
    "Program 1 · Sasaran 2 · Sasaran",
  )
})

test("reviseRecord preserves edited Program Kerja name on multi-sasaran Laporan Triwulan", () => {
  const sas1 = createEmptyTriwulanSasaran("sas-1")
  sas1.target = "Target 1"
  const sas2 = createEmptyTriwulanSasaran("sas-2")
  sas2.target = "Target 2"
  const programs = [
    { id: "prog-1", program: "Program Lama", sasaranList: [sas1, sas2] },
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

  const updated = reviseRecord(record, { 0: "Program Baru" })
  assert.equal(updated.triwulanPrograms[0].program, "Program Baru")
})

test("getSasaranKinerjaReviewCriteria maps structured multi-sasaran and legacy fallback rows to exact item indexes", () => {
  const criteriaData = [
    {
      id: "crit-1",
      name: "Kriteria A",
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
  assert.equal(structured[0].critItemIdx, 0)
  assert.equal(structured[0].stratSlots[0].stratItemIdx, 1)
  assert.equal(structured[0].stratSlots[0].programSlots[0].progItemIdx, 2)
  assert.equal(
    structured[0].stratSlots[0].programSlots[0].sasaranSlots.length,
    2,
  )
  assert.equal(
    structured[0].stratSlots[0].programSlots[0].sasaranSlots[0].sasaranItemIdx,
    3,
  )
  assert.equal(
    structured[0].stratSlots[0].programSlots[0].sasaranSlots[1].sasaranItemIdx,
    6,
  )

  const legacy = getSasaranKinerjaReviewCriteria({
    ...record,
    criteriaData: undefined,
  })
  assert.equal(legacy.length, 1)
  assert.equal(legacy[0].stratSlots[0].programSlots[0].sasaranSlots.length, 2)
  assert.equal(
    legacy[0].stratSlots[0].programSlots[0].sasaranSlots[1].keteranganItemIdx,
    8,
  )
})
