import { useState } from "react"
import { useDialog } from "../utils/useDialog"
import type { AuthSession } from "../types"
import { getUserInitials } from "../utils/auth"
import { PORTAL_INSTITUTION } from "../pages/portalContent"
import { Icon } from "./Icon"

export function AccountInfoModal({
  open,
  session,
  onClose,
}: {
  open: boolean
  session: AuthSession
  onClose: () => void
}) {
  useDialog(open, onClose, ".account-info-overlay")
  if (!open) return null

  const unitScopeText =
    session.role === "admin"
      ? "Seluruh bagian dan unit kerja (Administrator PRP)"
      : "Akses seluruh unit pelapor (unit dipilih langsung pada formulir)"

  return (
    <div
      className="submit-success-overlay account-info-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-info-title"
    >
      <div className="submit-success-dialog account-modal-dialog">
        <div className="account-modal-header">
          <div className="avatar is-lg" aria-hidden="true">
            {getUserInitials(session.displayName)}
          </div>
          <div>
            <h2 id="account-info-title">{session.displayName}</h2>
            <p>@{session.username}</p>
          </div>
        </div>

        <dl className="submit-success-meta">
          <div>
            <dt>Peran Akun</dt>
            <dd>
              {session.role === "admin" ? "Admin PRP" : "Staf Bagian / Unit"}
            </dd>
          </div>
          <div>
            <dt>Unit Utama</dt>
            <dd>{session.parentUnit || "Dipilih di formulir"}</dd>
          </div>
          <div>
            <dt>Sub Unit / Bagian</dt>
            <dd>
              {session.role === "admin"
                ? "Semua Unit (Admin)"
                : "Semua Unit (Bebas Pilih)"}
            </dd>
          </div>
          <div>
            <dt>Cakupan Akses</dt>
            <dd>{unitScopeText}</dd>
          </div>
          <div>
            <dt>Mode Autentikasi</dt>
            <dd>Sesi browser lokal (siap integrasi backend API)</dd>
          </div>
        </dl>

        <div className="submit-success-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup informasi akun"
        onClick={onClose}
      />
    </div>
  )
}

export function HelpGuideModal({
  open,
  role,
  onClose,
}: {
  open: boolean
  role: AuthSession["role"]
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<"alur" | "aturan" | "kendala">(
    "alur",
  )
  useDialog(open, onClose, ".help-guide-overlay")
  if (!open) return null

  const workflowSteps =
    role === "admin"
      ? [
          {
            title: "1. Pemantauan Kepatuhan 42 Unit",
            detail:
              "Buka Dashboard Monitoring untuk melihat metrik Wajib Lapor, Sudah Mengirim, Belum Melapor, Pelapor Disetujui, matriks TW I sampai IV, dan panel Perlu Tindak Lanjut.",
          },
          {
            title: "2. Verifikasi & Catatan Revisi per Sel",
            detail:
              "Buka Verifikasi Laporan Triwulan atau Verifikasi Sasaran Kinerja. Klik ikon catatan pada sel tabel untuk memberi catatan perbaikan (wajib minimal 1 catatan sebelum klik Kirim Revisi) atau klik Setujui Dokumen.",
          },
          {
            title: "3. Pengaturan Periode & Tenggat Waktu (WIB)",
            detail:
              "Di menu Periode dan Tenggat Waktu, tambah tahun pelaporan, atur periode default beranda staf, nyalakan atau kunci sakelar akses periode, dan tetapkan tanggal mulai (00:00 WIB) hingga tenggat (23:59 WIB). Perubahan jadwal otomatis memberi notifikasi ke unit.",
          },
          {
            title: "4. Siaran Pengingat Realtime (1 Arah)",
            detail:
              "Klik tombol ikon siaran berwarna biru di sebelah ikon lonceng topbar (atau tombol Ingatkan di Perlu Tindak Lanjut) untuk mengirim pengingat cepat berbasis template ke semua unit, unit belum melapor, unit revisi, atau unit tertentu serta memantau status Sudah dibaca.",
          },
          {
            title: "5. Arsip, Pratinjau Resmi, & Rekap Excel",
            detail:
              "Gunakan Arsip dan Rekapitulasi untuk memfilter riwayat lintas tahun dan unit, membuka Pratinjau Cetak resmi, atau menekan Unduh Rekap Excel.",
          },
        ]
      : [
          {
            title: "1. Pilih Unit & Susun Sasaran Kinerja Tahunan",
            detail:
              "Masuk ke menu Isi Sasaran Kinerja, pilih Unit Utama dan Sub Unit / Bagian dari daftar 42 unit kerja, lalu lengkapi Kriteria, Strategi, Program Kerja, Sasaran, Bulan Mulai/Selesai, dan Keterangan.",
          },
          {
            title: "2. Isi Laporan Realisasi Triwulan atau Impor Sasaran",
            detail:
              "Di menu Isi Laporan Triwulan, Anda dapat mengisi langsung atau mengimpor program dari Sasaran Kinerja tahun berjalan (bisa diimpor meski dokumen tahunan masih berstatus Menunggu). Lengkapi Tahap Pelaksanaan, Realisasi, Persentase, dan tautan Bukti Dukung.",
          },
          {
            title: "3. Simpan Draf Otomatis, Pratinjau, & Kirim",
            detail:
              "Simpan Draf untuk mengaktifkan simpan otomatis lokal di browser (gunakan 1 tab saat mengedit). Gunakan Pratinjau atau Pratinjau Cetak A4 Landscape untuk memeriksa isian sebelum menekan Kirim Laporan ke antrean Admin PRP.",
          },
          {
            title: "4. Pantau Notifikasi & Perbaiki Revisi",
            detail:
              "Buka lonceng notifikasi di topbar untuk melihat hasil verifikasi dan pengingat dari Admin PRP. Pada pengingat 1 arah, klik Buka menu tujuan atau Tandai dibaca. Jika ada dokumen berstatus Revisi, buka Riwayat lalu klik Perbaiki selama periode masih dibuka.",
          },
        ]

  const rulesList = [
    {
      title: "Batas Waktu Kalender Asia/Jakarta (WIB)",
      detail:
        "Seluruh jadwal mulai dan tenggat akhir dihitung menurut WIB (UTC+07:00). Pengiriman dokumen baru dibuka hingga pukul 23:59:59 WIB pada tanggal tenggat. Bila periode dikunci atau sudah melewati tenggat, pengiriman baru dan perbaikan revisi otomatis ditahan hingga Admin memperpanjang tenggat.",
    },
    {
      title: "Aturan Wajib Realisasi di Bawah 100%",
      detail:
        "Pada formulir Laporan Triwulan, setiap sasaran yang persentase realisasinya kurang dari 100% wajib melengkapi kolom Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian sebelum dokumen dapat dikirim.",
    },
    {
      title: "Arti Status Dokumen",
      detail:
        "Draf berarti masih tersimpan lokal dan belum dikirim ke Admin. Menunggu berarti sudah masuk antrean verifikasi Admin PRP. Revisi berarti perlu perbaikan sesuai catatan indikator dari verifikator. Disetujui berarti dokumen telah final dan terarsip.",
    },
    {
      title: "Prioritas Pengingat Realtime Admin (1 Arah)",
      detail:
        "Mendesak menampilkan banner merah di halaman staf dan notifikasi instan. Penting menampilkan banner kuning dan notifikasi instan. Informasi Umum masuk ke lonceng notifikasi dan pemberitahuan singkat. Staf hanya membaca dan menekan Tandai dibaca tanpa kolom balas.",
    },
  ]

  const troubleshootingList =
    role === "admin"
      ? [
          {
            title: "Staf Melapor Tidak Bisa Mengirim atau Mengirim Ulang Revisi",
            detail:
              "Periksa menu Periode dan Tenggat Waktu pada tahun dan triwulan terkait. Pastikan sakelar periode berstatus Dibuka dan tanggal tenggat belum terlewati menurut waktu WIB.",
          },
          {
            title: "Perubahan Pengingat atau Data Tidak Muncul di Tab Lain",
            detail:
              "Pastikan kedua tab dibuka pada alamat dan browser yang sama tanpa mode privat yang memblokir penyimpanan lokal. Untuk sinkronisasi antarperangkat berbeda, sistem perlu dihubungkan ke backend API.",
          },
          {
            title: "Data Tersimpan Gagal Dibaca atau Kuota Browser Penuh",
            detail:
              "Jika muncul peringatan penyimpanan browser, jangan hapus data sebelum mengekspor arsip penting ke Excel atau mencetak PDF lewat Pratinjau Cetak, lalu kosongkan sisa ruang penyimpanan browser.",
          },
        ]
      : [
          {
            title: "Tombol Kirim atau Perbaiki Revisi Terkunci",
            detail:
              "Pengiriman baru dan kirim ulang revisi hanya aktif saat periode dibuka oleh Admin PRP dan belum melewati pukul 23:59:59 WIB pada tanggal tenggat. Hubungi Admin PRP bila memerlukan perpanjangan jadwal.",
          },
          {
            title: "Tombol Impor Sasaran Kinerja Tidak Menampilkan Program",
            detail:
              "Pastikan Unit Utama, Sub Unit, dan Tahun Laporan Triwulan sama persis dengan Sasaran Kinerja Tahunan yang sudah dikirim (bukan yang masih berstatus Draf).",
          },
          {
            title: "Banner Pengingat Mendesak / Penting Terus Tampil",
            detail:
              "Banner pengingat dari Admin PRP tetap tampil di atas halaman hingga Anda menekan tombol Tandai dibaca (atau hingga Admin mengarsipkan pengingat tersebut).",
          },
          {
            title: "Gagal Menyimpan Draf di Browser",
            detail:
              "Hindari membuka dan menyunting formulir di lebih dari satu tab secara bersamaan, dan pastikan mode peramban mengizinkan penyimpanan lokal (localStorage).",
          },
        ]

  return (
    <div
      className="submit-success-overlay help-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-guide-title"
    >
      <div className="submit-success-dialog help-modal-dialog">
        <div className="help-modal-head">
          <div className="submit-confirm-icon" aria-hidden="true">
            <Icon name="help" size={22} />
          </div>
          <div className="help-modal-title-wrap">
            <h2 id="help-guide-title">Pusat Bantuan SIPETRI</h2>
            <p>
              {role === "admin"
                ? "Panduan pemantauan, verifikasi dokumen, pengaturan jadwal, dan siaran pengingat untuk Admin PRP."
                : "Panduan pengisian sasaran kinerja, laporan triwulan, perbaikan revisi, dan notifikasi unit."}
            </p>
          </div>
          <button
            type="button"
            className="help-modal-close"
            aria-label="Tutup panduan bantuan"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div
          className="help-guide-tabs"
          role="tablist"
          aria-label="Kategori panduan bantuan"
        >
          {(
            [
              { key: "alur", label: "Alur Kerja" },
              { key: "aturan", label: "Aturan & Status" },
              { key: "kendala", label: "Kendala & Kontak" },
            ] as const
          ).map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tabItem.key}
              className={activeTab === tabItem.key ? "is-active" : ""}
              onClick={() => setActiveTab(tabItem.key)}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        <div className="help-modal-body">
          {activeTab === "alur" && (
            <ol className="help-guide-list">
              {workflowSteps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          )}

          {activeTab === "aturan" && (
            <ul className="help-guide-list">
              {rulesList.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          )}

          {activeTab === "kendala" && (
            <div className="help-trouble-wrap">
              <ul className="help-guide-list">
                {troubleshootingList.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
              <div className="help-contact-box">
                <strong>Kontak Pengelola Institusi</strong>
                <p>
                  {PORTAL_INSTITUTION.unitManager} ·{" "}
                  {PORTAL_INSTITUTION.institution}
                </p>
                <div className="help-contact-links">
                  <span>Email: {PORTAL_INSTITUTION.email}</span>
                  <span>Telepon: {PORTAL_INSTITUTION.phoneDisplay}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="help-guide-footer">
          <span>
            {PORTAL_INSTITUTION.shortName} ITPLN · {PORTAL_INSTITUTION.version}
          </span>
          <button type="button" className="primary-button" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup panduan bantuan"
        onClick={onClose}
      />
    </div>
  )
}
