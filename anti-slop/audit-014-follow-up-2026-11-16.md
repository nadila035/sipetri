# Tindak Lanjut Audit 014: Sinkronisasi Seluruh Halaman Admin dengan Halaman Staf

Tanggal: 2026-11-16
Rujukan: `anti-slop/audit-014-2026-11-16.md`
Mode: `after`
Status: Seluruh 10 temuan telah diperbaiki dan diverifikasi ulang setelah suntingan terakhir.

## Ringkasan Perbaikan per Temuan

1. **HIGH (Temuan #1) Header Admin dan indikator menu Sidebar (`Header.tsx`, `Sidebar.tsx`, `index.css`)**
   - Status: Selesai.
   - Perubahan: `Header.tsx` mengganti teks penghitung `"perlu revisi"` dengan chip interaktif `.admin-pending-chip` yang menghitung dokumen berstatus `"Menunggu"` verifikasi dan membuka menu verifikasi terkait saat diklik. `Sidebar.tsx` menambahkan titik penanda `.nav-dot` pada menu `Verifikasi Laporan Triwulan` dan `Verifikasi Sasaran Kinerja` ketika ada antrean `"Menunggu"`.

2. **HIGH (Temuan #2) Aksi klik pada panel `MonitoringOverview` (`Admin.tsx`, `MonitoringOverview.tsx`, `monitoring-overview.css`)**
   - Status: Selesai.
   - Perubahan: `Admin.tsx` menghubungkan `MonitoringOverview` dengan `onReview={openReviewModal}` agar membuka modal pemeriksaan Admin, bukan pratinjau cetak. `MonitoringOverview.tsx` menyesuaikan label tombol menjadi `"Periksa"` untuk dokumen `"Menunggu"` dan `"Lihat detail"` untuk status lainnya.

3. **HIGH (Temuan #3) Parser waktu kirim untuk pengurutan dan cakupan unit (`organizations.ts`, `organizations.test.mjs`, `Admin.tsx`)**
   - Status: Selesai.
   - Perubahan: Menambahkan `parseSentAtTimestamp` di `src/utils/organizations.ts` yang mendukung format numerik (`DD/MM/YYYY`, `DD.MM.YYYY`), nama bulan bahasa Indonesia, dan ISO. Parser ini dipakai bersama oleh `reportingCoverage` dan pengurutan `Dokumen Terbaru` di `Admin.tsx`, serta diuji melalui `organizations.test.mjs`.

4. **HIGH (Temuan #4) Sinkronisasi kartu `Tenggat Aktif`, periode tahunan, dan label status (`Admin.tsx`, `workflow.ts`)**
   - Status: Selesai.
   - Perubahan: Kartu `Tenggat Aktif` pada `Admin.tsx` menggunakan `getDeadlineCardModel` (basis kalender `Asia/Jakarta` dan progres antara tanggal buka hingga tenggat) dengan struktur visual bergaya beranda Staf (`.admin-welcome`, `.deadline-card`, `.mini-progress`), menampilkan status periode tahunan untuk `Sasaran Kinerja`, dan memakai `formatPeriodStatusTag` untuk label status periode.

5. **HIGH (Temuan #5) Penjaga perubahan belum tersimpan dan penutupan modal (`useDialog.ts`, `Admin.tsx`)**
   - Status: Selesai.
   - Perubahan: `src/utils/useDialog.ts` menyimpan `onCloseRef` agar tombol `Escape` selalu memanggil penutup modal terbaru. `src/pages/Admin.tsx` menerapkan `useConfirmableUnsavedChanges` dan `confirmReviewDiscard` sehingga klik `Batal`, tombol tutup, atau `Escape` menampilkan konfirmasi keluar/buang catatan saat sedang mengisi catatan revisi.

6. **HIGH (Temuan #6) Modal pemeriksaan Admin serta detail `Sasaran Kinerja` Staf (`Admin.tsx`, `RiwayatLaporan.tsx`, `DetailModal.tsx`)**
   - Status: Selesai.
   - Perubahan:
     - `RiwayatLaporan.tsx` mengekstrak `sk2025Criteria` dan membentuk item `SK-2025-001` lewat `buildSasaranKinerjaItems(sk2025Criteria)` agar selaras dengan jumlah program/indikator pada modal pemeriksaan.
     - `Admin.tsx` menambahkan `canEditReview`, status pemeriksaan program pada daftar sisi kiri, penanda indikator bertanda revisi yang sudah tersimpan, pemformatan `formatBulanPelaksanaan`, tautan `Link Evidence` yang dapat diklik, tampilan `Catatan sebelumnya`, nama program/indikator pada `Riwayat pemeriksaan`, serta tombol footer modal bergaya Staf (`Unduh Excel` dan `Pratinjau / Cetak (PDF)`).
     - `DetailModal.tsx` menampilkan tabel 7 kolom `criteriaData` untuk `Sasaran Kinerja` baik dalam mode baca (menampilkan `.cell-note`) maupun mode revisi `canEdit` (textarea inline pada sel yang ditandai Admin).

7. **HIGH (Temuan #7) Filter `Triwulan` dan penjaga form `Periode dan Tenggat Waktu` (`Admin.tsx`)**
   - Status: Selesai.
   - Perubahan: Filter `Triwulan` disembunyikan pada menu `Verifikasi Sasaran Kinerja`. `handleCardToggleOpen` dan `handleSaveActivePeriod` di `Admin.tsx` menjaga draf perubahan tanggal yang belum disimpan dengan konfirmasi serta memperingatkan bila periode default beranda Staf masih terkunci.

8. **HIGH (Temuan #8) Penyelarasan unit data awal di `RiwayatLaporan.tsx` (`RiwayatLaporan.tsx`)**
   - Status: Selesai.
   - Perubahan: Mengubah unit data awal `RiwayatLaporan.tsx` menjadi unit terdaftar di `organizations.ts` (`PRP · BPK`, `PRP · BPSR`, dan `Bidang Sumber Daya · BKU`) dengan penyusun `"Andi Rahman"` sehingga tidak lagi muncul sebagai laporan tak terpetakan.

9. **MEDIUM (Temuan #9) Konsistensi warna badge status, gaya panel, dan tata letak responsif (`Dashboard.tsx`, `dashboard.css`, `Admin.tsx`, `index.css`, `admin.css`)**
   - Status: Selesai.
   - Perubahan:
     - Menyeragamkan warna badge status lintas Staf dan Admin (`Disetujui`, `Menunggu` dengan kelas `waiting`, `Revisi`, dan `Draf` dengan kelas `ongoing`).
     - Memperbaiki kelas ikon KPI biru dan gaya `.admin-kpi-copy`, menghapus warisan garis timeline Staf dari `Dokumen Terbaru`, dan menyeragamkan tombol aksi `Periksa` / `Detail`.
     - Merapikan jarak vertikal `.sidebar` (`src/index.css`) dan `.role-switch` (`src/admin.css`) agar tombol `Staf` / `Admin` tampil utuh di atas lipatan desktop `1280x800` tanpa scrollbar sidebar, serta menyesuaikan nav bawah mobile (`Arsip dan Rekapitulasi` membungkus kata secara utuh), tombol `Unduh Rekap Excel`, dan tinggi modal pemeriksaan Admin (`.admin-review-modal`, `.admin-review-programs`, `.admin-review-content`, `.admin-review-footer-actions`) agar muat pada layar `390x844`.

10. **LOW (Temuan #10) Keseragaman halaman `Arsip`, tabel Admin, retensi filter, dan judul (`App.tsx`, `Admin.tsx`)**
    - Status: Selesai.
    - Perubahan: `App.tsx` menghapus `key={active}` pada `<Admin>` agar filter tetap tersimpan saat berpindah antar-menu Admin. `Admin.tsx` menerapkan gaya heading, statistik, panel, dan tab dokumen bergaya `Riwayat` (`.report-heading`, `.history-stats`, `.history-panel`, `.history-tabs`) pada `Arsip dan Rekapitulasi`, menampilkan `parentUnit` serta `author` pada baris tabel, dan menyelaraskan judul/subjudul kontekstual.

## Verifikasi Setelah Suntingan Terakhir

1. **Unit test (`node --test drafts.test.mjs organizations.test.mjs workflow.test.mjs`)**
   - Hasil: Lulus seluruhnya (42 test dijalankan, 42 lulus, 0 gagal, 0 dilewati).
2. **Pemeriksaan tipe TypeScript (`node node_modules\typescript\bin\tsc --noEmit`)**
   - Hasil: 0 error pada folder `src/`; perintah tetap keluar dengan kode 1 akibat error parser TypeScript bawaan pada file `.d.ts` di dalam `node_modules/.pnpm/*`.
3. **Build produksi Vite (`node node_modules\vite\bin\vite.js build`)**
   - Hasil: Berhasil membangun 50 modul ke `dist/index.html`, `dist/assets/index-BwZnnTZx.css`, dan `dist/assets/index-WQDqJOJx.js`.
4. **Inspeksi browser langsung (`http://127.0.0.1:4173/`, Vite preview)**
   - Desktop `1280x800`: Sidebar Admin bebas scrollbar vertikal dengan tombol `Staf` dan `Admin` (`.role-switch`) tampil utuh di atas lipatan 800px; kelima menu Admin, titik notifikasi, kartu bantuan, chip pengguna, dan ring fokus keyboard (`:focus-visible`) tampil rapi tanpa terpotong.
   - Mobile `390x844`: Label `"Arsip dan Rekapitulasi"` pada bar navigasi bawah terlipat rapi per kata (`"Arsip dan / Rekapitulasi"`), tombol `Unduh Rekap Excel` terlihat dan aktif, serta modal pemeriksaan Admin (`LTR-2024-004`) menampilkan header dan kelima tombol footer secara utuh di dalam viewport dengan area konten yang dapat digulir.
   - Konsol browser: 0 console error, 0 console warning, dan 0 uncaught page error selama pemeriksaan desktop maupun mobile.
