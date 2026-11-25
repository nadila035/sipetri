# Tindak Lanjut Audit 015: Penyederhanaan Halaman Admin, Header Notifikasi, dan Tombol Aksi Verifikasi

Tanggal: 2026-11-16
Mode: `after`
Lingkup: Penyelarasan halaman Admin (`AdminNotifications`, `Header`, `Sidebar`, `MonitoringOverview`, `Admin`, `Icon`, `App`, `index.css`, `admin.css`, `types/index.ts`) tanpa mengubah perilaku maupun tampilan halaman Staf.

## Ringkasan Perbaikan yang Diterapkan

1. **Penyederhanaan Copywriting dan Penghapusan Elemen Redundan (`Admin.tsx`, `MonitoringOverview.tsx`, `admin.css`)**
   - Menghapus kartu duplikat `Tenggat Aktif` pada bagian bawah `Dashboard Monitoring` karena tenggat aktif beserta tombol `Atur periode & tenggat` bergaya Staf kini dipusatkan di hero atas `.admin-welcome`.
   - Menyatukan panel `Tren Cakupan Pelaporan` dan `Dokumen Terbaru` berdampingan dalam satu baris grid `.admin-insight-grid` sehingga tidak menyisakan kolom kosong maupun scrollbar horizontal grafik pada desktop `1280x800`.
   - Memangkas paragraf penjelasan berulang dan subjudul instruktif pada `Cakupan Pelaporan Unit`, panel `MonitoringOverview`, heading subhalaman (`.report-heading`), blok `.admin-panel-header` (`Antrean pemeriksaan` / `Rekap dokumen`), dan kartu pengaturan `Periode dan Tenggat Waktu`.

2. **Pengingat Menunggu Verifikasi Terpusat di Card KPI (`Admin.tsx`, `Header.tsx`, `Sidebar.tsx`, `MonitoringOverview.tsx`)**
   - Pengingat tekstual `"Menunggu verifikasi"` dipertahankan hanya pada kartu KPI `Menunggu` di `Dashboard Monitoring`.
   - Menghapus chip teks `"N menunggu verifikasi"` di header Admin, badge `.admin-heading-pill` pada heading halaman verifikasi, teks `"N menunggu pemeriksaan"` di atas tabel, teks pengingat `"Laporan sudah masuk dan perlu diperiksa Admin."` pada tab `Menunggu` di `MonitoringOverview`, serta titik penanda `.nav-dot` pada menu Admin di `Sidebar.tsx` (titik `.nav-dot` draf Staf tetap tidak diubah).

3. **Header Admin Minimal Ikon Notifikasi (`AdminNotifications.tsx`, `Header.tsx`, `App.tsx`, `index.css`)**
   - Mengganti tombol chip antrean dan chip periode berulang di header Admin dengan komponen ikon lonceng `AdminNotifications` (`44x44px`, memakai gaya `.staff-notifications` yang seragam dengan header Staf).
   - Klik item di dropdown notifikasi menandai item sebagai dibaca, mengarahkan ke menu verifikasi yang sesuai, dan langsung membuka modal pemeriksaan dokumen terkait.

4. **Penyesuaian Kolom Aksi di Tabel Verifikasi dan Arsip (`Admin.tsx`, `admin.css`, `Icon.tsx`, `types/index.ts`)**
   - Menghapus tombol `Excel` pada kolom `Aksi` tabel di halaman `Verifikasi Laporan Triwulan`, `Verifikasi Sasaran Kinerja`, dan `Arsip dan Rekapitulasi` karena tombol `Unduh Excel` sudah tersedia di footer modal detail/pemeriksaan (dan `Unduh Rekap Excel` tetap di header `Arsip dan Rekapitulasi`).
   - Sesuai permintaan lanjutan pengguna, tombol `Aksi` pada kedua halaman verifikasi dikembalikan ke tampilan sebelumnya: tombol biru solid `Periksa` (`.admin-action-primary`, `#2558b5` dengan teks putih) untuk dokumen berstatus `"Menunggu"`, `Lihat detail` untuk status lain maupun di halaman `Arsip dan Rekapitulasi`, disertai tombol `Pratinjau`.
   - Menambahkan definisi path ikon `download` pada `src/types/index.ts` dan `src/components/Icon.tsx` agar tombol `Unduh Rekap Excel` menampilkan ikon panah unduh dengan benar.

5. **Penyederhanaan Kartu Periode pada Menu `Periode dan Tenggat Waktu` (`Admin.tsx`, `admin.css`)**
   - Menambahkan banner ringkas `Kontrol akses pengisian` di atas kartu jadwal periode.
   - Menyederhanakan tiap kartu periode (`Sasaran Kinerja Tahunan`, `I`, `II`, `III`, `IV`) agar bersih seperti desain referensi: header berisi label `TAHUNAN`/`TRIWULAN`, judul tegas beserta rentang bulan, serta sakelar buka-tutup (`admin-switch`); area isi menampilkan titik status (`Akses Dibuka` / `Akses Dikunci` / status jadwal), kolom `Mulai Pengisian` dan `Tenggat Waktu`, serta tombol `Simpan Jadwal`, `Batal`, dan `Kosongkan` hanya muncul saat tanggal diubah.
   - Menghapus kontrol mode akses 3-tab (`Terkunci` / `Rentang Tanggal` / `Buka Bebas`), kotak perpanjangan (`Perpanjang +3/+7/+14 Hari`), kode slot, dan teks pengisi di dalam kartu periode; tidak menambahkan checkbox `Izinkan simpan draf` / `Izinkan terlambat` karena tidak didukung model `Period` pada `workflow.ts` dan agar halaman Staf tidak terganggu.

6. **Status Fitur Revisi per Indikator di Admin (`Admin.tsx`, `admin.css`)**
   - Fitur revisi per indikator tidak dihilangkan: saat membuka dokumen berstatus `"Menunggu"` dari `Dashboard Monitoring`, `Verifikasi Laporan Triwulan`, atau `Verifikasi Sasaran Kinerja`, setiap kartu indikator menampilkan kolom textarea `Catatan revisi indikator (opsional)`, penghitung `Kirim Revisi (N)`, serta penyimpanan `needsRevision` dan `note` per item.
   - Dokumen yang sudah berstatus `"Disetujui"` / `"Revisi"` maupun yang dibuka melalui menu `Arsip dan Rekapitulasi` ditampilkan dalam mode baca (`canEditReview === false`).
   - Kontras warna teks pendukung di dalam modal pemeriksaan diperjelas (`#4e5b6e`, `#526176`, `#5b6575`) agar terbaca jelas di atas latar putih.

## Hasil Verifikasi Setelah Suntingan Terakhir

1. **Unit test (`node --test drafts.test.mjs organizations.test.mjs workflow.test.mjs`)**: 42 test dijalankan, 42 lulus, 0 gagal, 0 dilewati.
2. **Pemeriksaan tipe TypeScript (`node node_modules\typescript\bin\tsc --noEmit`)**: 0 error pada folder `src/` (perintah keluar dengan kode 1 akibat error parser TypeScript bawaan pada `.d.ts` di `node_modules/.pnpm/*`).
3. **Build produksi Vite (`node node_modules\vite\bin\vite.js build`)**: berhasil membangun 51 modul ke `dist/index.html`, `dist/assets/index-BTjWss0R.css`, dan `dist/assets/index-C_TL25Xt.js`.
4. **Inspeksi browser Chrome untuk kartu periode terbaru**: belum dapat diselesaikan karena subagen browser berhenti dengan galat kuota `RESOURCE_EXHAUSTED (code 429)`. Verifikasi browser sebelumnya pada build `index-BBKrumq-.js` / `index-DCVGzy70.css` telah lolos pada desktop `1280x800` dan mobile `390x844` dengan 0 console error/warning.
