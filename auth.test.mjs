import test from "node:test"
import assert from "node:assert/strict"

import {
  UNIT_ACCOUNTS,
  authenticateCredentials,
  canNotificationReachSession,
  filterRecordsForSession,
  getSessionLockedOrganization,
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
  parentUnit: "PRP",
  subUnit: "BPK",
  sentAt: "10/04/2026, 10.00.00",
  status: "Menunggu",
  progress: 100,
  items: [{ label: "Program Kerja", value: "Program 1" }],
  author: "Unit BPK",
  ...overrides,
})

test("authenticateCredentials supports admin, renbang, and all 42 locked unit accounts", () => {
  assert.equal(UNIT_ACCOUNTS.length, 42)
  assert.equal(authenticateCredentials("", "bebas123").ok, false)
  assert.equal(authenticateCredentials("admin", "").ok, false)
  assert.equal(authenticateCredentials("unit", "bebas123").ok, false)
  assert.equal(authenticateCredentials("staff", "bebas123").ok, false)
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
    assert.equal(adminRes.session.displayName, "Admin PRP")
  }

  const renbangRes = authenticateCredentials(
    "renbang",
    "renbang123",
    "2026-11-17T00:00:00.000Z",
  )
  assert.equal(renbangRes.ok, true)
  if (renbangRes.ok) {
    assert.equal(renbangRes.session.role, "admin")
    assert.equal(renbangRes.session.username, "renbang")
    assert.equal(renbangRes.session.displayName, "Admin Renbang")
  }

  const fketRes = authenticateCredentials(
    " FKET ",
    "Unit@2026",
    "2026-11-17T01:00:00.000Z",
  )
  assert.equal(fketRes.ok, true)
  if (fketRes.ok) {
    assert.equal(fketRes.session.role, "staff")
    assert.equal(fketRes.session.username, "fket")
    assert.equal(fketRes.session.parentUnit, "FKET")
    assert.equal(fketRes.session.subUnit, "FKET")
    assert.deepEqual(getSessionLockedOrganization(fketRes.session), {
      unit: "FKET",
      subUnit: "FKET",
      unitLabel: "FKET",
    })
  }

  const baumRes = authenticateCredentials("unit.baum", "apapun-boleh")
  assert.equal(baumRes.ok, true)
  if (baumRes.ok) {
    assert.equal(baumRes.session.parentUnit, "Rektorat")
    assert.equal(baumRes.session.subUnit, "BAUM")
    assert.deepEqual(getSessionLockedOrganization(baumRes.session), {
      unit: "Rektorat",
      subUnit: "BAUM",
      unitLabel: "Rektorat · BAUM",
    })
  }
})

test("parseStoredSession validates locked unit sessions and rejects tampered unit payloads", () => {
  assert.equal(parseStoredSession(null), null)
  assert.equal(parseStoredSession("not-json"), null)
  assert.equal(parseStoredSession("{}"), null)
  // Rejects unlocked legacy 'unit' session
  assert.equal(
    parseStoredSession(
      JSON.stringify({
        userId: "unit",
        username: "unit",
        displayName: "Unit",
        role: "staff",
        parentUnit: "",
        subUnit: "",
        loggedInAt: "2026-11-17T00:00:00.000Z",
      }),
    ),
    null,
  )
  // Rejects mismatched parentUnit tampering
  assert.equal(
    parseStoredSession(
      JSON.stringify({
        userId: "unit-baum",
        username: "baum",
        displayName: "Unit BAUM",
        role: "staff",
        parentUnit: "FKET",
        subUnit: "BAUM",
        loggedInAt: "2026-11-17T00:00:00.000Z",
      }),
    ),
    null,
  )

  const parsedFket = parseStoredSession(
    JSON.stringify({
      userId: "unit-fket",
      username: "fket",
      displayName: "Unit FKET",
      role: "staff",
      parentUnit: "FKET",
      subUnit: "FKET",
      loggedInAt: "2026-11-17T00:00:00.000Z",
    }),
  )
  assert.deepEqual(parsedFket, {
    userId: "unit-fket",
    username: "fket",
    displayName: "Unit FKET",
    role: "staff",
    parentUnit: "FKET",
    subUnit: "FKET",
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
  assert.equal(parsedAdmin?.role, "admin")
})

test("recordBelongsToSession and filterRecordsForSession strictly isolate unit sessions", () => {
  const admin = authenticateCredentials("admin", "pass1")
  const bpk = authenticateCredentials("bpk", "pass2")
  const fket = authenticateCredentials("fket", "pass3")
  assert.equal(admin.ok && bpk.ok && fket.ok, true)
  if (!admin.ok || !bpk.ok || !fket.ok) return

  const recBpk = sampleRecord({
    id: "rec-bpk",
    unit: "BPK",
    parentUnit: "PRP",
    subUnit: "BPK",
  })
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
    filterRecordsForSession(all, bpk.session).map((r) => r.id),
    ["rec-bpk"],
  )
  assert.deepEqual(
    filterRecordsForSession(all, fket.session).map((r) => r.id),
    ["rec-fket"],
  )
  assert.equal(recordBelongsToSession(recBpk, fket.session), false)
  assert.equal(recordBelongsToSession(recFket, fket.session), true)
})

test("notifications route strictly to matching locked unit session or broadcast", () => {
  const bpk = authenticateCredentials("bpk", "bebas")
  const fket = authenticateCredentials("fket", "bebas")
  const admin = authenticateCredentials("admin", "bebas")
  assert.equal(bpk.ok && fket.ok && admin.ok, true)
  if (!bpk.ok || !fket.ok || !admin.ok) return

  assert.notEqual(
    getUserReadStorageKey(bpk.session),
    getUserReadStorageKey(fket.session),
  )
  assert.equal(getUserInitials("Unit FKET"), "UF")
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
    actor: "Unit BPK",
    targetMenu: "Verifikasi Laporan Triwulan",
  })

  assert.equal(canNotificationReachSession(bpkRevision, bpk.session), true)
  assert.equal(canNotificationReachSession(bpkRevision, fket.session), false)
  assert.equal(canNotificationReachSession(broadcastPeriod, fket.session), true)
  assert.equal(canNotificationReachSession(adminSubmit, admin.session), true)
  assert.equal(canNotificationReachSession(adminSubmit, bpk.session), false)

  const fketFeed = collectRecipientNotifications({
    recipient: "staff",
    storedNotifications: [bpkRevision, broadcastPeriod, adminSubmit],
    records: [],
    periods: {},
    year: "2026",
    quarter: "III",
    sessionSubUnit: fket.session.subUnit,
  })

  assert.deepEqual(
    fketFeed.map((item) => item.notification.id),
    ["notif-period"],
  )
})
