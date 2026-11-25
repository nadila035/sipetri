import test from "node:test"
import assert from "node:assert/strict"

import {
  authenticateCredentials,
  canNotificationReachSession,
  filterRecordsForSession,
  getUserInitials,
  getUserReadStorageKey,
  parseStoredSession,
  recordBelongsToSession,
} from "./src/utils/auth.ts"
import {
  collectRecipientNotifications,
  createAppNotification,
} from "./src/utils/notifications.ts"

const sampleRecord = (overrides = {}) => ({
  id: "LTR-2026-I-1",
  type: "Laporan Triwulan",
  title: "Laporan Realisasi Triwulan I",
  period: "Triwulan I · 2026",
  unit: "BPK",
  parentUnit: "BPK",
  subUnit: "BPK",
  sentAt: "10/04/2026, 10.00.00",
  status: "Menunggu",
  progress: 100,
  items: [{ label: "Program Kerja", value: "Program 1" }],
  author: "Staf BPK",
  ...overrides,
})

test("authenticateCredentials accepts admin and unit with any non-empty password and rejects others", () => {
  assert.equal(authenticateCredentials("", "bebas123").ok, false)
  assert.equal(authenticateCredentials("admin", "").ok, false)
  assert.equal(authenticateCredentials("unit", "").ok, false)
  assert.equal(authenticateCredentials("staff", "bebas123").ok, false)
  assert.equal(authenticateCredentials("fket", "Unit@2026").ok, false)
  assert.equal(authenticateCredentials("admin.prp", "AdminPRP@2026").ok, false)
  assert.equal(authenticateCredentials("unknown", "random-pass").ok, false)

  const adminRes = authenticateCredentials(
    "  ADMIN  ",
    "sandi-bebas-123!",
    "2026-11-17T00:00:00.000Z",
  )
  assert.equal(adminRes.ok, true)
  if (adminRes.ok) {
    assert.equal(adminRes.session.role, "admin")
    assert.equal(adminRes.session.username, "admin")
    assert.equal(adminRes.session.userId, "admin")
    assert.equal(adminRes.session.displayName, "Admin PRP")
    assert.equal(adminRes.session.loggedInAt, "2026-11-17T00:00:00.000Z")
  }

  const unitRes = authenticateCredentials(
    " UnIt ",
    "apapun-boleh",
    "2026-11-17T01:00:00.000Z",
  )
  assert.equal(unitRes.ok, true)
  if (unitRes.ok) {
    assert.equal(unitRes.session.role, "staff")
    assert.equal(unitRes.session.username, "unit")
    assert.equal(unitRes.session.userId, "unit")
    assert.equal(unitRes.session.displayName, "Unit")
    assert.equal(unitRes.session.parentUnit, "")
    assert.equal(unitRes.session.subUnit, "")
    assert.equal(unitRes.session.loggedInAt, "2026-11-17T01:00:00.000Z")
  }
})

test("parseStoredSession validates JSON, allows unlocked unit sessions, and rejects invalid payloads", () => {
  assert.equal(parseStoredSession(null), null)
  assert.equal(parseStoredSession("not-json"), null)
  assert.equal(parseStoredSession("{}"), null)
  assert.equal(
    parseStoredSession(
      JSON.stringify({
        userId: "staff-fket",
        username: "fket",
        displayName: "Staf FKET",
        role: "staff",
        parentUnit: "FKET",
        subUnit: "FKET",
        loggedInAt: "2026-11-17T00:00:00.000Z",
      }),
    ),
    null,
  )
  assert.equal(
    parseStoredSession(
      JSON.stringify({
        userId: "staff",
        username: "staff",
        displayName: "Staf Unit",
        role: "staff",
        parentUnit: "",
        subUnit: "",
        loggedInAt: "2026-11-17T00:00:00.000Z",
      }),
    ),
    null,
  )
  assert.equal(
    parseStoredSession(
      JSON.stringify({
        userId: "admin",
        username: "admin",
        displayName: "Admin",
        role: "staff",
        parentUnit: "",
        subUnit: "",
        loggedInAt: "2026-11-17T00:00:00.000Z",
      }),
    ),
    null,
  )

  const parsedUnit = parseStoredSession(
    JSON.stringify({
      userId: "unit",
      username: "unit",
      displayName: "Unit",
      role: "staff",
      parentUnit: "",
      subUnit: "",
      loggedInAt: "2026-11-17T00:00:00.000Z",
      extraField: "ignored",
    }),
  )
  assert.deepEqual(parsedUnit, {
    userId: "unit",
    username: "unit",
    displayName: "Unit",
    role: "staff",
    parentUnit: "",
    subUnit: "",
    loggedInAt: "2026-11-17T00:00:00.000Z",
  })

  const parsedAdmin = parseStoredSession(
    JSON.stringify({
      userId: "admin",
      username: "admin",
      displayName: "Admin PRP",
      role: "admin",
      parentUnit: "PRP",
      subUnit: "",
      loggedInAt: "2026-11-17T00:00:00.000Z",
    }),
  )
  assert.deepEqual(parsedAdmin, {
    userId: "admin",
    username: "admin",
    displayName: "Admin PRP",
    role: "admin",
    parentUnit: "PRP",
    subUnit: "",
    loggedInAt: "2026-11-17T00:00:00.000Z",
  })
})

test("recordBelongsToSession and filterRecordsForSession work cleanly for unlocked unit and admin sessions", () => {
  const admin = authenticateCredentials("admin", "pass1")
  const unit = authenticateCredentials("unit", "pass2")
  assert.equal(admin.ok && unit.ok, true)
  if (!admin.ok || !unit.ok) return

  const recBpk = sampleRecord({ id: "rec-bpk", unit: "BPK", parentUnit: "PRP", subUnit: "BPK" })
  const recFket = sampleRecord({
    id: "rec-fket",
    unit: "FKET",
    parentUnit: "FKET",
    subUnit: "FKET",
    status: "Draf",
  })
  const all = [recBpk, recFket]

  assert.deepEqual(filterRecordsForSession(all, null), [])
  assert.deepEqual(
    filterRecordsForSession(all, admin.session).map((r) => r.id),
    ["rec-bpk", "rec-fket"],
  )
  assert.deepEqual(
    filterRecordsForSession(all, unit.session).map((r) => r.id),
    ["rec-bpk", "rec-fket"],
  )
  assert.equal(recordBelongsToSession(recBpk, unit.session), true)
  assert.equal(recordBelongsToSession(recFket, unit.session), true)

  const legacyShapedStaffSession = {
    ...unit.session,
    parentUnit: "PRP",
    subUnit: "BPK",
  }
  assert.equal(recordBelongsToSession(recFket, legacyShapedStaffSession), true)
  assert.deepEqual(
    filterRecordsForSession(all, legacyShapedStaffSession).map((r) => r.id),
    ["rec-bpk", "rec-fket"],
  )
})

test("notifications and read-state keys work cleanly for unit and admin sessions", () => {
  const unit = authenticateCredentials("unit", "bebas")
  const admin = authenticateCredentials("admin", "bebas")
  assert.equal(unit.ok && admin.ok, true)
  if (!unit.ok || !admin.ok) return

  assert.notEqual(
    getUserReadStorageKey(unit.session),
    getUserReadStorageKey(admin.session),
  )
  assert.equal(getUserInitials("Unit"), "UN")
  assert.equal(getUserInitials("Admin PRP"), "AP")

  const bpkRevision = createAppNotification({
    id: "notif-bpk",
    recipient: "staff",
    category: "revision_requested",
    title: "Laporan Realisasi Triwulan II",
    message: "2 catatan indikator perlu diperbaiki",
    actor: "Admin PRP",
    createdAt: "2026-11-17T08:00:00.000Z",
    targetMenu: "Riwayat",
    targetUnit: "BPK",
  })
  const broadcastPeriod = createAppNotification({
    id: "notif-period",
    recipient: "staff",
    category: "period_opened",
    title: "Triwulan III · 2026 dibuka",
    message: "Periode pelaporan telah dibuka.",
    actor: "Admin PRP",
    createdAt: "2026-11-17T09:00:00.000Z",
    targetMenu: "Dashboard",
  })
  const adminSubmit = createAppNotification({
    id: "notif-admin",
    recipient: "admin",
    category: "document_submitted",
    title: "Laporan BPK",
    message: "Menunggu verifikasi",
    actor: "Unit",
    targetMenu: "Verifikasi Laporan Triwulan",
  })

  assert.equal(canNotificationReachSession(bpkRevision, unit.session), true)
  assert.equal(canNotificationReachSession(bpkRevision, admin.session), false)
  assert.equal(canNotificationReachSession(broadcastPeriod, unit.session), true)
  assert.equal(canNotificationReachSession(adminSubmit, admin.session), true)
  assert.equal(canNotificationReachSession(adminSubmit, unit.session), false)

  const staffFeed = collectRecipientNotifications({
    recipient: "staff",
    storedNotifications: [bpkRevision, broadcastPeriod, adminSubmit],
    records: [],
    periods: {},
    year: "2026",
    quarter: "III",
    sessionSubUnit: unit.session.subUnit,
  })

  assert.deepEqual(
    staffFeed.map((item) => item.notification.id),
    ["notif-period", "notif-bpk"],
  )
})
