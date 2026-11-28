import { useMemo, useState } from "react"
import { useAuth } from "../AuthContext"
import { useReporting } from "../ReportingContext"
import type { MasterStrategicGoal, NotifyFn } from "../types"
import {
  addMasterStrategicGoal,
  countStrategicGoalUsage,
  nextStrategicGoalCode,
  propagateStrategicGoalRename,
  removeMasterStrategicGoal,
  updateMasterStrategicGoal,
} from "../utils/strategicGoals"
import { formatUpdatedAtLabel } from "../utils/drafts"
import { appendNotifications, createAppNotification } from "../utils/notifications"
import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"

type GoalModalState = {
  mode: "create" | "edit"
  id?: string
  code: string
  name: string
  description: string
}

export function AdminMasterSasaranStrategis({
  notify,
}: {
  notify: NotifyFn
}) {
  const { data, setData } = useReporting()
  const { session } = useAuth()
  const [query, setQuery] = useState("")
  const [modalState, setModalState] = useState<GoalModalState | null>(null)
  const [modalError, setModalError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<MasterStrategicGoal | null>(
    null,
  )

  useDialog(Boolean(modalState), () => {
    setModalState(null)
    setModalError("")
  }, ".master-goal-modal-overlay")

  useDialog(Boolean(deleteTarget), () => {
    setDeleteTarget(null)
  }, ".master-goal-delete-overlay")

  const goals = data.strategicGoals ?? []

  const usageById = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of goals) {
      map.set(g.id, countStrategicGoalUsage(data.records, g))
    }
    return map
  }, [goals, data.records])

  const filteredGoals = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return goals
    return goals.filter((g) =>
      `${g.code} ${g.name} ${g.description ?? ""}`.toLowerCase().includes(q),
    )
  }, [goals, query])

  const totalUsedCount = Array.from(usageById.values()).filter(
    (v) => v > 0,
  ).length

  const openCreateModal = () => {
    setModalError("")
    setModalState({
      mode: "create",
      code: nextStrategicGoalCode(goals),
      name: "",
      description: "",
    })
  }

  const openEditModal = (goal: MasterStrategicGoal) => {
    setModalError("")
    setModalState({
      mode: "edit",
      id: goal.id,
      code: goal.code,
      name: goal.name,
      description: goal.description ?? "",
    })
  }

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalState) return
    const nowIso = new Date().toISOString()
    const actor = session?.displayName || "Admin Renbang / PRP"

    if (modalState.mode === "create") {
      const res = addMasterStrategicGoal(
        goals,
        {
          code: modalState.code,
          name: modalState.name,
          description: modalState.description,
        },
        nowIso,
      )
      if (!res.ok) {
        setModalError(res.error)
        return
      }
      const notif = createAppNotification({
        recipient: "staff",
        category: "master_strategy_updated",
        title: `Sasaran Strategis Baru: ${res.created.code}`,
        message: `"${res.created.name}" kini tersedia pada pilihan dropdown penyusunan Sasaran Kinerja.`,
        actor,
        createdAt: nowIso,
        targetMenu: "Isi Sasaran Kinerja",
      })
      setData((current) => ({
        ...current,
        strategicGoals: res.list,
        notifications: appendNotifications(current.notifications, notif),
      }))
      setModalState(null)
      setModalError("")
      notify(
        `Master Sasaran Strategis [${res.created.code}] berhasil ditambahkan.`,
      )
      return
    }

    if (modalState.mode === "edit" && modalState.id) {
      const res = updateMasterStrategicGoal(
        goals,
        modalState.id,
        {
          code: modalState.code,
          name: modalState.name,
          description: modalState.description,
        },
        nowIso,
      )
      if (!res.ok) {
        setModalError(res.error)
        return
      }
      const renamed = res.previous.name !== res.updated.name
      setData((current) => {
        const nextRecords = renamed
          ? propagateStrategicGoalRename(
              current.records,
              res.updated.id,
              res.previous.name,
              res.updated.name,
            )
          : current.records
        const notif = renamed
          ? createAppNotification({
              recipient: "staff",
              category: "master_strategy_updated",
              title: `Pembaruan Sasaran Strategis ${res.updated.code}`,
              message: `Pilihan "${res.previous.name}" diperbarui menjadi "${res.updated.name}".`,
              actor,
              createdAt: nowIso,
              targetMenu: "Isi Sasaran Kinerja",
            })
          : null
        return {
          ...current,
          strategicGoals: res.list,
          records: nextRecords,
          notifications: notif
            ? appendNotifications(current.notifications, notif)
            : current.notifications,
        }
      })
      setModalState(null)
      setModalError("")
      notify(
        `Master Sasaran Strategis [${res.updated.code}] berhasil diperbarui.`,
      )
    }
  }

  const confirmDeleteGoal = () => {
    if (!deleteTarget) return
    const res = removeMasterStrategicGoal(goals, deleteTarget.id)
    if (!res.ok) {
      notify(res.error, "error")
      setDeleteTarget(null)
      return
    }
    setData((current) => ({
      ...current,
      strategicGoals: res.list,
    }))
    setDeleteTarget(null)
    notify(
      `Pilihan Sasaran Strategis [${res.removed.code}] telah dihapus dari daftar master.`,
    )
  }

  return (
    <div className="master-goals-module">
      <div className="admin-kpis">
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-blue">
            <Icon name="layers" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">
              Total Sasaran Strategis
            </span>
            <strong>{goals.length}</strong>
            <small>Tersedia di dropdown unit</small>
          </div>
        </article>
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-green">
            <Icon name="check" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">
              Digunakan Dokumen Unit
            </span>
            <strong>{totalUsedCount}</strong>
            <small>Terkait ke RKA & Triwulan</small>
          </div>
        </article>
        <article className="panel kpi-card admin-kpi-card">
          <span className="action-icon admin-kpi-icon admin-kpi-icon-amber">
            <Icon name="lock" size={19} />
          </span>
          <div className="admin-kpi-copy">
            <span className="kpi-label admin-kpi-label">Kendali Input Unit</span>
            <strong>Dropdown Terkunci</strong>
            <small>Unit tidak dapat mengetik bebas</small>
          </div>
        </article>
      </div>

      <section className="panel admin-panel">
        <div className="matrix-grid-toolbar">
          <div className="matrix-grid-toolbar-copy">
            <h2 className="admin-card-title">
              Daftar Master Data Sasaran Strategis (Admin / Renbang)
            </h2>
            <p className="admin-card-subtitle">
              Kelola pilihan dropdown Sasaran Strategis secara terpusat. Setiap
              penambahan, perubahan, atau penghapusan langsung tersinkronisasi
              secara realtime ke formulir seluruh 42 unit kerja.
            </p>
          </div>
          <div className="matrix-grid-toolbar-actions">
            <label
              className="matrix-search-input"
              htmlFor="master-goal-search"
            >
              <Icon name="search" size={15} />
              <input
                id="master-goal-search"
                name="masterGoalSearch"
                type="search"
                placeholder="Cari kode atau nama sasaran strategis..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={openCreateModal}
            >
              <Icon name="plus" size={15} />
              <span>Tambah Sasaran Strategis</span>
            </button>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "90px" }}>Kode</th>
                <th>Sasaran Strategis</th>
                <th>Deskripsi / Ruang Lingkup</th>
                <th style={{ width: "140px" }}>Pemakaian</th>
                <th style={{ width: "160px" }}>Diperbarui</th>
                <th style={{ width: "150px" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredGoals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="matrix-empty-cell">
                    <div className="matrix-empty-state">
                      <Icon name="layers" size={22} />
                      <strong>
                        {goals.length === 0
                          ? "Belum ada Master Sasaran Strategis terdaftar"
                          : `Tidak ditemukan hasil untuk "${query}"`}
                      </strong>
                      <p>
                        {goals.length === 0
                          ? "Tambahkan pilihan Sasaran Strategis agar unit kerja dapat menyusun Sasaran Kinerja Tahunan."
                          : "Gunakan kata kunci pencarian lain atau tampilkan semua daftar master."}
                      </p>
                      {goals.length === 0 ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={openCreateModal}
                        >
                          <Icon name="plus" size={15} />
                          <span>Tambah Sasaran Strategis</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setQuery("")}
                        >
                          Reset Pencarian
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGoals.map((goal) => {
                  const usedCount = usageById.get(goal.id) ?? 0
                  return (
                    <tr key={goal.id}>
                      <td>
                        <span className="goal-code-badge">{goal.code}</span>
                      </td>
                      <td>
                        <strong>{goal.name}</strong>
                      </td>
                      <td>
                        <span>{goal.description || "-"}</span>
                      </td>
                      <td>
                        <span className="goal-usage-pill">
                          {usedCount} entri unit
                        </span>
                      </td>
                      <td>
                        <small>
                          {formatUpdatedAtLabel(goal.updatedAt) ?? "-"}
                        </small>
                      </td>
                      <td>
                        <div className="history-actions admin-table-actions">
                          <button
                            type="button"
                            onClick={() => openEditModal(goal)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger-outline"
                            onClick={() => setDeleteTarget(goal)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalState && (
        <div
          className="submit-success-overlay master-goal-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-goal-modal-title"
        >
          <form className="triwulan-row-modal" onSubmit={handleSaveGoal}>
            <header className="triwulan-row-modal-head">
              <div>
                <span className="triwulan-modal-kicker">
                  MASTER DATA ADMIN / RENBANG
                </span>
                <h2 id="master-goal-modal-title">
                  {modalState.mode === "create"
                    ? "Tambah Pilihan Sasaran Strategis"
                    : "Edit Pilihan Sasaran Strategis"}
                </h2>
              </div>
              <button
                type="button"
                className="triwulan-modal-close"
                aria-label="Tutup modal"
                onClick={() => {
                  setModalState(null)
                  setModalError("")
                }}
              >
                ×
              </button>
            </header>

            <div className="triwulan-row-modal-body">
              {modalError && (
                <div className="login-error" role="alert">
                  <span aria-hidden="true">!</span>
                  <span>{modalError}</span>
                </div>
              )}

              <label className="modal-form-field" htmlFor="goal-code-input">
                <span>
                  Kode Sasaran Strategis <b>*</b>
                </span>
                <input
                  id="goal-code-input"
                  name="goalCode"
                  type="text"
                  placeholder="Contoh: SS-07"
                  value={modalState.code}
                  onChange={(e) =>
                    setModalState((prev) =>
                      prev ? { ...prev, code: e.target.value } : prev,
                    )
                  }
                  required
                />
              </label>

              <label className="modal-form-field" htmlFor="goal-name-input">
                <span>
                  Nama Sasaran Strategis <b>*</b>
                </span>
                <textarea
                  id="goal-name-input"
                  name="goalName"
                  rows={2}
                  placeholder="Ketik rumusan Sasaran Strategis institusi..."
                  value={modalState.name}
                  onChange={(e) =>
                    setModalState((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  required
                />
              </label>

              <label className="modal-form-field" htmlFor="goal-desc-input">
                <span>Deskripsi / Cakupan Indikator (Opsional)</span>
                <textarea
                  id="goal-desc-input"
                  name="goalDescription"
                  rows={2}
                  placeholder="Penjelasan singkat ruang lingkup sasaran strategis..."
                  value={modalState.description}
                  onChange={(e) =>
                    setModalState((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev,
                    )
                  }
                />
              </label>
            </div>

            <footer className="triwulan-row-modal-foot">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setModalState(null)
                  setModalError("")
                }}
              >
                Batal
              </button>
              <button type="submit" className="primary-button">
                <Icon name="check" size={15} />
                <span>
                  {modalState.mode === "create"
                    ? "Simpan Pilihan Baru"
                    : "Simpan Perubahan"}
                </span>
              </button>
            </footer>
          </form>
          <button
            type="button"
            className="overlay-close"
            aria-label="Tutup modal"
            onClick={() => {
              setModalState(null)
              setModalError("")
            }}
          />
        </div>
      )}

      {deleteTarget && (
        <div
          className="submit-success-overlay master-goal-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-goal-title"
        >
          <div className="submit-success-dialog">
            <h2 id="delete-goal-title">
              Hapus Sasaran Strategis [{deleteTarget.code}]?
            </h2>
            <p>
              Pilihan <strong>"{deleteTarget.name}"</strong> akan dihapus dari
              dropdown pengisian baru.
              {(usageById.get(deleteTarget.id) ?? 0) > 0 &&
                ` Data pada ${usageById.get(deleteTarget.id)} entri dokumen unit yang telah tersimpan sebelumnya tetap terjaga dan tidak hilang.`}
            </p>
            <div className="submit-success-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="primary-button is-danger-btn"
                onClick={confirmDeleteGoal}
              >
                Ya, Hapus Pilihan
              </button>
            </div>
          </div>
          <button
            type="button"
            className="overlay-close"
            aria-label="Tutup konfirmasi hapus"
            onClick={() => setDeleteTarget(null)}
          />
        </div>
      )}
    </div>
  )
}

export default AdminMasterSasaranStrategis
