import test from "node:test"
import assert from "node:assert/strict"

import {
  acknowledgeStoredNotifications,
  appendNotifications,
  buildDeadlineReminderNotifications,
  buildPeriodNotification,
  collectActiveStaffReminders,
  collectRecipientNotifications,
  createAdminReminderNotification,
  createAppNotification,
  deleteAdminReminder,
  isAdminReminderActive,
  markStoredNotificationsRead,
  resolveTargetUnitsForScope,
  setAdminReminderActive,
} from "./src/utils/notifications.ts"

const sampleRecord = (overrides = {}) => ({
  id: "LTR-2026-III-1",
  type: "Laporan Triwulan",
  title: "Laporan Realisasi Triwulan III",
  period: "Triwulan III · 2026",
  unit: "FKET",
  parentUnit: "Fakultas",
  subUnit: "FKET",
  sentAt: "17/11/2026, 09.00.00",
  status: "Menunggu",
  progress: 100,
  items: [{ label: "Program Kerja", value: "P1" }],
  author: "Andi Rahman",
  reviews: [],
  ...overrides,
})

test("appendNotifications prepends newest, deduplicates by id, and caps total", () => {
  const n1 = createAppNotification({
    id: "n-1",
    recipient: "staff",
    category: "period_opened",
    title: "Satu",
    message: "Pesan satu",
    actor: "Admin",
    createdAt: "2026-11-17T01:00:00.000Z",
    targetMenu: "Dashboard",
  })
  const n2 = createAppNotification({
    id: "n-2",
    recipient: "staff",
    category: "period_locked",
    title: "Dua",
    message: "Pesan dua",
    actor: "Admin",
    createdAt: "2026-11-17T02:00:00.000Z",
    targetMenu: "Dashboard",
  })
  const n3 = createAppNotification({
    id: "n-3",
    recipient: "staff",
    category: "year_added",
    title: "Tiga",
    message: "Pesan tiga",
    actor: "Admin",
    createdAt: "2026-11-17T03:00:00.000Z",
    targetMenu: "Dashboard",
  })

  const first = appendNotifications([n1], n2, 2)
  assert.deepEqual(
    first.map((n) => n.id),
    ["n-2", "n-1"],
  )

  const dedupedAndCapped = appendNotifications(first, [n3, n2], 2)
  assert.deepEqual(
    dedupedAndCapped.map((n) => n.id),
    ["n-3", "n-2"],
  )
})

test("markStoredNotificationsRead updates only matching recipient notifications", () => {
  const staffN = createAppNotification({
    id: "s-1",
    recipient: "staff",
    category: "document_approved",
    title: "Disetujui",
    message: "OK",
    actor: "Admin",
    targetMenu: "Riwayat",
  })
  const adminN = createAppNotification({
    id: "a-1",
    recipient: "admin",
    category: "document_submitted",
    title: "Masuk",
    message: "Baru",
    actor: "Staf",
    targetMenu: "Verifikasi Laporan Triwulan",
  })

  const marked = markStoredNotificationsRead([staffN, adminN], "staff", "all")
  assert.equal(marked[0].read, true)
  assert.equal(marked[1].read, false)
})

test("buildPeriodNotification detects open, lock, extension, update, and ignores no-op", () => {
  const opened = buildPeriodNotification({
    previousPeriod: { startDate: "", deadline: "", open: false },
    nextPeriod: { startDate: "", deadline: "2026-12-10", open: true },
    slotLabel: "Triwulan III",
    year: "2026",
    isAnnual: false,
  })
  assert.equal(opened?.category, "period_opened")
  assert.equal(opened?.targetMenu, "Isi Laporan Triwulan")

  const locked = buildPeriodNotification({
    previousPeriod: { startDate: "", deadline: "2026-12-10", open: true },
    nextPeriod: { startDate: "", deadline: "2026-12-10", open: false },
    slotLabel: "Sasaran Kinerja Tahunan",
    year: "2026",
    isAnnual: true,
  })
  assert.equal(locked?.category, "period_locked")
  assert.equal(locked?.targetMenu, "Isi Sasaran Kinerja")

  const extended = buildPeriodNotification({
    previousPeriod: { startDate: "", deadline: "2026-11-20", open: true },
    nextPeriod: { startDate: "", deadline: "2026-11-30", open: true },
    slotLabel: "Triwulan III",
    year: "2026",
    isAnnual: false,
  })
  assert.equal(extended?.category, "period_opened")
  assert.equal(extended?.title, "Triwulan III (2026)")
  assert.match(extended?.message ?? "", /diperpanjang/i)

  const unchanged = buildPeriodNotification({
    previousPeriod: { startDate: "2026-10-01", deadline: "2026-11-30", open: true },
    nextPeriod: { startDate: "2026-10-01", deadline: "2026-11-30", open: true },
    slotLabel: "Triwulan III",
    year: "2026",
    isAnnual: false,
  })
  assert.equal(unchanged, null)
})

test("buildDeadlineReminderNotifications alerts within 3 days only when unsubmitted", () => {
  const nowMs = Date.parse("2026-11-17T03:00:00.000Z") // 2026-11-17 10:00 WIB
  const periods = {
    "2026-annual": { startDate: "2026-01-01", deadline: "2026-12-15", open: true },
    "2026-III": { startDate: "2026-07-01", deadline: "2026-11-19", open: true },
  }

  // Only a Draf exists -> reminder still triggers
  const remindersWithDraft = buildDeadlineReminderNotifications({
    periods,
    records: [sampleRecord({ id: "DRAF-1", status: "Draf" })],
    year: "2026",
    quarter: "III",
    nowMs,
  })
  assert.equal(remindersWithDraft.length, 1)
  assert.equal(remindersWithDraft[0].category, "deadline_reminder")
  assert.equal(remindersWithDraft[0].targetMenu, "Isi Laporan Triwulan")

  // Submitted record exists -> reminder cleared
  const remindersWithSubmitted = buildDeadlineReminderNotifications({
    periods,
    records: [sampleRecord({ id: "LTR-SUB-1", status: "Menunggu" })],
    year: "2026",
    quarter: "III",
    nowMs,
  })
  assert.equal(remindersWithSubmitted.length, 0)
})

test("collectRecipientNotifications avoids duplicates for stored events and surfaces legacy fallback", () => {
  const revRecord = sampleRecord({
    id: "LTR-REV-1",
    status: "Revisi",
    reviews: [
      {
        id: "r-1",
        at: "2026-11-17T02:00:00.000Z",
        actor: "Andi Rahman",
        action: "Revisi",
        notes: { "2": "Perbaiki" },
      },
    ],
  })
  const legacyApproved = sampleRecord({
    id: "LTR-OLD-OK",
    status: "Disetujui",
    sentAt: "10/11/2026, 08.00.00",
  })
  const explicitStaff = createAppNotification({
    id: "notif-rev-1",
    recipient: "staff",
    category: "revision_requested",
    title: "Laporan perlu revisi: Laporan Realisasi Triwulan III",
    message: "1 catatan indikator perlu diperbaiki.",
    actor: "Andi Rahman",
    createdAt: "2026-11-17T02:00:00.000Z",
    targetMenu: "Riwayat",
    recordId: "LTR-REV-1",
    openRevision: true,
  })

  const staffFeed = collectRecipientNotifications({
    recipient: "staff",
    storedNotifications: [explicitStaff],
    records: [revRecord, legacyApproved],
    periods: {},
    year: "2026",
    quarter: "III",
    nowMs: Date.parse("2026-11-17T03:00:00.000Z"),
  })

  // LTR-REV-1 should appear ONCE (explicit), LTR-OLD-OK once (legacy)
  const revMatches = staffFeed.filter(
    (entry) => entry.notification.recordId === "LTR-REV-1",
  )
  assert.equal(revMatches.length, 1)
  assert.equal(revMatches[0].notification.id, "notif-rev-1")
  assert.ok(
    staffFeed.some((entry) => entry.notification.recordId === "LTR-OLD-OK"),
  )

  const adminLegacyResubmitted = sampleRecord({
    id: "LTR-WAIT-2",
    status: "Menunggu",
    reviews: [
      {
        id: "r-old",
        at: "2026-11-16T01:00:00.000Z",
        actor: "Andi Rahman",
        action: "Revisi",
        notes: { "1": "Lengkapi" },
      },
    ],
  })
  const adminFeed = collectRecipientNotifications({
    recipient: "admin",
    storedNotifications: [],
    records: [adminLegacyResubmitted],
    periods: {},
    year: "2026",
    quarter: "III",
  })
  assert.equal(adminFeed.length, 1)
  assert.equal(adminFeed[0].notification.category, "revision_resubmitted")
  assert.equal(adminFeed[0].notification.title, "Laporan Realisasi Triwulan III")
})

test("legacy fallback notifications keep concise non-repetitive title and count", () => {
  const rev = sampleRecord({
    id: "LTR-2025-II",
    title: "Laporan Realisasi Triwulan II",
    period: "Triwulan II · 2025",
    status: "Revisi",
    items: [
      { label: "Program Kerja", value: "P1", note: "Cek nama", needsRevision: true },
      { label: "Kendala", value: "-", note: "Lengkapi kendala", needsRevision: true },
    ],
  })
  const feed = collectRecipientNotifications({
    recipient: "staff",
    storedNotifications: [],
    records: [rev],
    periods: {},
    year: "2026",
    quarter: "III",
  })
  assert.equal(feed.length, 1)
  assert.equal(feed[0].notification.category, "revision_requested")
  assert.equal(feed[0].notification.title, "Laporan Realisasi Triwulan II")
  assert.equal(feed[0].notification.message, "2 catatan indikator perlu diperbaiki")
})

test("createAdminReminderNotification validates required fields and produces 1-way staff reminder", () => {
  const emptyTitle = createAdminReminderNotification({
    title: "  ",
    message: "Isi pesan",
  })
  assert.equal(emptyTitle.ok, false)

  const emptyMessage = createAdminReminderNotification({
    title: "Judul",
    message: "",
  })
  assert.equal(emptyMessage.ok, false)

  const missingTarget = createAdminReminderNotification({
    title: "Judul",
    message: "Pesan",
    targetScope: "specific_units",
    targetUnits: [],
  })
  assert.equal(missingTarget.ok, false)

  const invalidExpiry = createAdminReminderNotification({
    title: "Judul",
    message: "Pesan",
    expiresAt: "2026-02-30",
  })
  assert.equal(invalidExpiry.ok, false)

  const valid = createAdminReminderNotification({
    id: "rem-1",
    title: "Segera Kirim Laporan TW III",
    message: "Batas pengisian pukul 23:59 WIB.",
    actor: "Admin PRP",
    priority: "urgent",
    targetScope: "specific_units",
    targetUnits: ["FKET", "BPK"],
    targetMenu: "Isi Laporan Triwulan",
    periodLabel: "Triwulan III · 2026",
    expiresAt: "2026-11-30",
    createdAt: "2026-11-24T07:00:00.000Z",
  })
  assert.equal(valid.ok, true)
  if (!valid.ok) return
  assert.equal(valid.notification.recipient, "staff")
  assert.equal(valid.notification.category, "admin_reminder")
  assert.equal(valid.notification.priority, "urgent")
  assert.equal(valid.notification.active, true)
  assert.equal(valid.notification.read, false)
  assert.equal(valid.notification.unitLabel, "FKET, BPK")
  assert.deepEqual(valid.notification.targetUnits, ["FKET", "BPK"])
})

test("resolveTargetUnitsForScope computes all, missing_report, revision_only, and specific_units", () => {
  const submittedFket = sampleRecord({
    id: "LTR-FKET",
    unit: "FKET",
    parentUnit: "FKET",
    subUnit: "FKET",
    period: "Triwulan III · 2026",
    status: "Menunggu",
  })
  const revisionBpk = sampleRecord({
    id: "LTR-BPK",
    unit: "BPK",
    parentUnit: "PRP",
    subUnit: "BPK",
    period: "Triwulan III · 2026",
    status: "Revisi",
  })
  const records = [submittedFket, revisionBpk]

  const allUnits = resolveTargetUnitsForScope({
    scope: "all",
    records,
    year: "2026",
    quarter: "III",
  })
  assert.equal(allUnits.length, 42)

  const missingUnits = resolveTargetUnitsForScope({
    scope: "missing_report",
    records,
    year: "2026",
    quarter: "III",
  })
  assert.equal(missingUnits.length, 40)
  assert.equal(missingUnits.includes("FKET"), false)
  assert.equal(missingUnits.includes("BPK"), false)

  const revisionUnits = resolveTargetUnitsForScope({
    scope: "revision_only",
    records,
    year: "2026",
    quarter: "III",
  })
  assert.deepEqual(revisionUnits, ["BPK"])

  const specific = resolveTargetUnitsForScope({
    scope: "specific_units",
    records,
    year: "2026",
    quarter: "III",
    specificUnits: ["FTIK", "FTIK", "LPPM"],
  })
  assert.deepEqual(specific, ["FTIK", "LPPM"])
})

test("isAdminReminderActive, collectActiveStaffReminders, acknowledge, archive, and delete lifecycle", () => {
  const urgentRes = createAdminReminderNotification({
    id: "rem-urgent",
    title: "Mendesak",
    message: "Segera kirim hari ini.",
    priority: "urgent",
    expiresAt: "2026-11-24",
    createdAt: "2026-11-24T01:00:00.000Z",
  })
  const importantRes = createAdminReminderNotification({
    id: "rem-important",
    title: "Penting",
    message: "Cek kelengkapan bukti.",
    priority: "important",
    createdAt: "2026-11-24T02:00:00.000Z",
  })
  const normalRes = createAdminReminderNotification({
    id: "rem-normal",
    title: "Informasi",
    message: "Pemberitahuan umum.",
    priority: "normal",
    createdAt: "2026-11-24T03:00:00.000Z",
  })
  assert.equal(urgentRes.ok && importantRes.ok && normalRes.ok, true)
  if (!urgentRes.ok || !importantRes.ok || !normalRes.ok) return

  const beforeCutoff = Date.parse("2026-11-24T16:59:59.999Z")
  const afterCutoff = Date.parse("2026-11-24T17:00:00.000Z")
  assert.equal(isAdminReminderActive(urgentRes.notification, beforeCutoff), true)
  assert.equal(isAdminReminderActive(urgentRes.notification, afterCutoff), false)

  let list = [normalRes.notification, importantRes.notification, urgentRes.notification]
  const activeBefore = collectActiveStaffReminders({
    storedNotifications: list,
    nowMs: beforeCutoff,
  })
  // Urgent precedes important; normal stays in bell & instant notice without persistent banner
  assert.deepEqual(
    activeBefore.map((n) => n.id),
    ["rem-urgent", "rem-important"],
  )

  list = acknowledgeStoredNotifications(
    list,
    "staff",
    ["rem-urgent"],
    "Unit",
    "2026-11-24T08:00:00.000Z",
  )
  assert.equal(list[2].read, true)
  assert.equal(list[2].acknowledgedAt, "2026-11-24T08:00:00.000Z")
  assert.equal(list[1].read, false)

  // Archived reminder no longer shows as active or in staff bell feed
  list = setAdminReminderActive(list, "rem-important", false)
  assert.equal(
    collectActiveStaffReminders({ storedNotifications: list, nowMs: beforeCutoff })
      .length,
    0,
  )
  const staffBellAfterArchive = collectRecipientNotifications({
    recipient: "staff",
    storedNotifications: list,
    records: [],
    periods: {},
    year: "2026",
    quarter: "III",
    nowMs: beforeCutoff,
  })
  assert.deepEqual(
    staffBellAfterArchive.map((entry) => entry.notification.id),
    ["rem-normal", "rem-urgent"],
  )
  const staffBellAfterExpiry = collectRecipientNotifications({
    recipient: "staff",
    storedNotifications: list,
    records: [],
    periods: {},
    year: "2026",
    quarter: "III",
    nowMs: afterCutoff,
  })
  assert.deepEqual(
    staffBellAfterExpiry.map((entry) => entry.notification.id),
    ["rem-normal"],
  )

  // Active unread admin_reminder survives appendNotifications trimming
  const activePin = createAdminReminderNotification({
    id: "rem-pinned",
    title: "Wajib Dibaca",
    message: "Jangan tergeser notifikasi otomatis.",
    priority: "urgent",
    createdAt: "2026-11-24T00:00:00.000Z",
  })
  assert.equal(activePin.ok, true)
  if (activePin.ok) {
    const routine = [1, 2, 3].map((idx) =>
      createAppNotification({
        id: `auto-${idx}`,
        recipient: "staff",
        category: "period_updated",
        title: `Update ${idx}`,
        message: "Info",
        actor: "Admin PRP",
      }),
    )
    const trimmed = appendNotifications([activePin.notification], routine, 3)
    assert.equal(trimmed.length, 3)
    assert.equal(trimmed.some((item) => item.id === "rem-pinned"), true)
  }

  list = deleteAdminReminder(list, "rem-important")
  assert.deepEqual(
    list.map((n) => n.id),
    ["rem-normal", "rem-urgent"],
  )
})
