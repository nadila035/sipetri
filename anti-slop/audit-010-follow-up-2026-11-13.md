# Laporan Tindak Lanjut Audit 010: Alur Form Kosong, Simpan Draf, dan Autosave

Tanggal: 2026-11-13
Acuan audit: `anti-slop/audit-010-2026-11-13.md` (Mode: `after`, 7 temuan disetujui untuk diperbaiki tanpa merusak tampilan visual yang sudah ada).

## Ringkasan Perbaikan per Temuan

1. **Temuan 1 (HIGH): Form dimulai kosong dan metrik Dashboard tetap akurat (`R-38`, `R-27`, `R-17`).**
   - `src/ReportingContext.tsx`: Menginisialisasi dan memulihkan `criteria: []`, `targetDraft: false`, dan `drafts: {}` agar membuka form dari menu sidebar tidak otomatis terisi dari riwayat `SK-2025-001` maupun edit sebelumnya di `localStorage`, sekaligus melengkapi titik koma yang hilang pada deklarasi tipe `periods` baris 20.
   - `src/pages/InputSasaranKinerja.tsx` & `src/pages/InputLaporanTriwulan.tsx`: Kedua form selalu dimulai kosong (`resumeDraftId = null`, `activeDraftId = null`) kecuali dibuka melalui tombol `Lanjut Isi` pada `Riwayat`, serta mengosongkan state form dan menonaktifkan autosave kembali setelah pengiriman (`Kirim`) berhasil.
   - `src/utils/drafts.ts` (`extractDashboardAnnualMetrics`, baris 399-454) & `src/pages/Dashboard.tsx` (baris 37, 190-212): Mengalihkan perhitungan KPI tahunan (`currentStrategies`, `currentPrograms`, `targets`) dan target grafik ke record `Sasaran Kinerja` tahun berjalan yang sudah dikirim (`status !== "Draf"`), termasuk memperbaiki pemetaan `currentStrategies` (`Total Strategi`: sebelumnya membandingkan `WorkProgram` langsung ke array pembungkus `{ program, sasaranList }`), serta menyaring `Aktivitas Terbaru` agar tidak menampilkan record `"Draf"`.
   - `src/pages/Admin.tsx`: Menggunakan `submittedRecords` (`status !== "Draf"`) untuk daftar, tahun laporan (baris 404), dan pemetaan organisasi (baris 434).

2. **Temuan 2 (HIGH): Autosave hanya aktif setelah Simpan Draf ditekan (`R-26`, `R-27`).**
   - `src/pages/InputSasaranKinerja.tsx` (baris 90-104) & `src/pages/InputLaporanTriwulan.tsx` (baris 150-207): Perubahan sebelum `Simpan Draf` hanya berada di state lokal komponen dan tidak ditulis ke `localStorage` ataupun `data.records`.
   - `src/utils/useUnsavedChanges.ts`: Menambahkan `useConfirmableUnsavedChanges(dirty, message)` memakai konfirmasi `window.confirm` pada event `reporting:navigate` dan peringatan `beforeunload` saat `activeDraftId === null` dan form sudah memiliki isi (`hasCriteriaContent` / `hasTriwulanContent`).
   - Setelah `Simpan Draf` ditekan (atau saat draf dilanjutkan dari `Riwayat`), `activeDraftId` terisi dan setiap perubahan langsung diperbarui otomatis lewat `upsertDraftRecord` tanpa memicu blokir navigasi.

3. **Temuan 3 (HIGH): Simpan Draf fungsional & dukungan Lanjut Isi untuk kedua jenis laporan (`R-26`).**
   - `src/types/index.ts`: Menambahkan field opsional `updatedAt?: string` pada `HistoryRecord`.
   - `src/utils/drafts.ts`: Menyediakan helper bersama untuk state kosong, normalisasi item, deteksi isi, pembuatan item ringkasan, `upsertDraftRecord`, `promoteDraftToSubmitted`, `formatUpdatedAtLabel`, dan `extractDashboardAnnualMetrics`.
   - `src/pages/InputSasaranKinerja.tsx` (`saveDraft`, baris 404-415) & `src/pages/InputLaporanTriwulan.tsx` (`saveDraft`, baris 308-323): Menyimpan atau memperbarui record `"Draf"` ke `data.records` dan mengaktifkan autosave.
   - `src/pages/RiwayatLaporan.tsx` & `src/App.tsx`: `Riwayat` menyatukan draf `Laporan Triwulan` dan `Sasaran Kinerja` dari `data.records` berstatus `"Draf"` dengan tombol `Lanjut Isi` (`onContinueDraft(record)`, baris 605) yang diteruskan ke `continueDraft` (`src/App.tsx:41-43`). Mengklik menu sidebar (`selectMenu`) atau mengganti role (`onRoleChange`) mereset `resumeDraftId` ke `null` dan menaikkan `formSession` (`key` form) sehingga menu sidebar selalu membuka form kosong.

4. **Temuan 4 (HIGH): Status header dan keterangan footer mencerminkan kondisi sebenarnya (`R-36`, `R-27`).**
   - `src/pages/InputSasaranKinerja.tsx` (baris 470-498, 874) & `src/pages/InputLaporanTriwulan.tsx` (baris 395-423, 918): Menampilkan status `"Belum disimpan"` (`is-idle`) + keterangan footer bahwa perubahan belum disimpan dan akan ditanyakan saat keluar sebelum `Simpan Draf` ditekan, lalu berubah menjadi `"Draf tersimpan"` + waktu `Terakhir diperbarui ...` dan keterangan autosave aktif setelah draf aktif (atau status peringatan `is-error` saat `localStorage` gagal disimpan).

5. **Temuan 5 (HIGH): Indikator status, waktu pembaruan, dan footer aksi tampil rapi di mobile (`R-03`, `C-2`).**
   - `src/pages/InputSasaranKinerja.tsx` (baris 493-498) & `src/pages/InputLaporanTriwulan.tsx` (baris 418-423): Menggunakan pembungkus `.draft-save-info` dan `.draft-updated-at`.
   - `src/index.css`: Menghapus `.report-status { display: none; }` dari `@media (max-width: 760px)` dan menambahkan `.draft-save-info { justify-items: start; }` (baris 573-574), serta menaikkan posisi sticky `.report-actions` ke `bottom: 72px` dengan teks fleksibel dan `.main { padding-bottom: 84px }` (baris 564, 578-579) agar tombol aksi tidak tertutup navigasi bawah `66px` pada layar kecil.

6. **Temuan 6 (MEDIUM): Titik indikator sidebar dan status dot header dinamis (`R-09`).**
   - `src/components/Sidebar.tsx` (baris 29-34, 63-64): Merender `.nav-dot` (`aria-hidden="true"`) hanya jika `data.records` memiliki record `"Draf"` untuk `Laporan Triwulan` atau `Sasaran Kinerja`.
   - `src/index.css` (baris 144-147): Menambahkan variasi `.report-status.is-idle span` (abu-abu netral `#94a3b8`) dan `.report-status.is-error span` (oranye `#d97706`) agar berbeda dari status tersimpan (hijau `#22a77a`).

7. **Temuan 7 (LOW): Penyeragaman istilah "Draf" di Riwayat (`R-15`, `R-31`).**
   - `src/pages/RiwayatLaporan.tsx`: Menggunakan `"Draf"` untuk filter/chip status (selaras dengan `HistoryStatus`, `Dashboard`, dan kedua halaman form), disertai subjudul waktu pembaruan draf.
   - `src/index.css` (baris 377): Menyelaraskan selector `.status-chip.draf, .status-chip.draft` dengan `#526176` di atas `#edf1f6`.

## Hasil Verifikasi Terakhir (Setelah Edit Terakhir)

### 1. Kontras Warna WCAG (Diukur via Node)
- `.status-chip.draf` (`#526176` di `#edf1f6`): `5.56:1` (lolos WCAG AA `>= 4.5:1`); `#526176` di `#ffffff`: `6.31:1`.
- `.report-status` & `.report-actions > span` (`#58657a` di `#ffffff`): `5.90:1` (lolos WCAG AA `>= 4.5:1`).
- `.draft-updated-at` (`#657187` di `#ffffff`): `4.92:1`; di `#f6f8fb`: `4.63:1` (lolos WCAG AA `>= 4.5:1`).

### 2. Pengujian Unit, Build, dan TypeScript
- `node --test drafts.test.mjs organizations.test.mjs`: **8/8 lolos** (`0` gagal, `0` dilewati), mencakup kondisi kosong awal, `upsertDraftRecord` + `promoteDraftToSubmitted`, `extractDashboardAnnualMetrics` (termasuk `currentStrategies` baris 123), normalizer, serta `organizations.test.mjs`.
- `node --test workflow.test.mjs`: **1 gagal** (pra-eksis di luar lingkup perubahan): gagal parse pada `src/utils/workflow.ts:1` (`export type Period = { deadline: string open: boolean }`).
- `node node_modules\vite\bin\vite.js build`: **Berhasil (exit code 0)**, 48 modul ditransformasi, menghasilkan `dist/index.html` (`0.59 kB`), `dist/assets/index-BqCMdrcu.css` (`115.18 kB`), `dist/assets/index-CyWc02gv.js` (`441.63 kB`) dalam `2.22s`.
- `node node_modules\typescript\bin\tsc --noEmit`: Exit code 1 hanya pada error `.d.ts` bawaan `node_modules/.pnpm` dan 2 file pra-eksis yang tidak diubah (`src/components/Icon.tsx(75,60)` dan `src/utils/workflow.ts(1,41)`). **0 error TypeScript pada seluruh file yang dibuat atau dimodifikasi.**

### 3. Verifikasi Browser Langsung (Desktop `1280x800` & Mobile `501px`)
Pengujian dilakukan lewat subagen browser Chrome DevTools pada build preview `http://127.0.0.1:4173/` dengan tab terisolasi dan `localStorage` bersih:
- **Dashboard awal**: `Total Strategi = 2`, `Total Program Kerja = 4`, `Total Sasaran Kinerja = 5` (dari `SK-2025-001`), `Aktivitas Terbaru` hanya menampilkan dokumen terkirim (tanpa `"Draf"`), dan Sidebar tidak menampilkan `.nav-dot`.
- **Isi Sasaran Kinerja (alur penuh)**:
  - Dibuka dari Sidebar dalam kondisi kosong dengan status `"Belum disimpan"`.
  - Mengetik sebelum `Simpan Draf` tidak membuat draf di `localStorage` atau `Riwayat`, dan berpindah halaman via Sidebar memicu dialog `window.confirm` (`Cancel` tetap di form; `OK` membuang isian dan reopening dari Sidebar tetap kosong).
  - Menekan `Simpan Draf` menyimpan `"Draf"`, memunculkan status `"Draf tersimpan"` + timestamp dan `.nav-dot` pada Sidebar, lalu edit tambahan tersimpan otomatis tanpa memblokir navigasi ke `Riwayat`.
  - Membuka menu `Isi Sasaran Kinerja` dari Sidebar saat draf tersimpan tetap menampilkan form kosong, sedangkan tombol `"Lanjut Isi"` di `Riwayat` memulihkan isian draf beserta edit autosave-nya.
  - Menekan `"Kirim Sasaran"` mempromosikan `"Draf"` menjadi `"Menunggu"`, menghapus draf aktif, menghilangkan `.nav-dot`, dan mereset form kembali kosong.
- **Isi Laporan Triwulan (alur penuh)**:
  - Dibuka dari Sidebar dalam kondisi kosong (`"Belum disimpan"`, `Kelengkapan laporan: 0%`).
  - Isian sebelum `Simpan Draf` dilindungi `window.confirm` saat navigasi dan tidak ditulis ke draf.
  - Menekan `Simpan Draf` mengaktifkan `"Draf tersimpan"`, timestamp, `.nav-dot`, dan autosave untuk ketikan lanjutan; filter `"Draf"` dan tombol `"Lanjut Isi"` di `Riwayat` berfungsi konsisten dengan penamaan `"Draf"`.
  - Membuka menu `Isi Laporan Triwulan` dari Sidebar saat draf tersimpan tetap terbuka kosong, sedangkan `"Lanjut Isi"` memulihkan seluruh field draf; `"Kirim Laporan"` mempromosikan `"Draf"` menjadi `"Menunggu"`, menghapus `.nav-dot`, dan mengosongkan form kembali.
- **Tampilan responsif mobile & Console (`resize_page(390, 844)` -> terukur `innerWidth = 501px` pada Windows Chrome)**:
  - `document.documentElement.scrollWidth` = `486 <= 501` (tanpa horizontal overflow dokumen) pada `Isi Sasaran Kinerja`, `Isi Laporan Triwulan`, dan `Riwayat`.
  - `.draft-save-info`, `.report-status`, dan `.draft-updated-at` terlihat (`display: grid` / `flex` / `block`, `visibility: visible`, `opacity: 1`) baik saat `"Belum disimpan"` maupun `"Draf tersimpan"`.
  - Sticky `.report-actions` (`bottom: 515.3`) berada tepat di atas navigasi bawah `.sidebar` (`top: 521.3`, celah `6px`) sehingga tombol `Simpan Draf` dan `Kirim` tampak utuh dan dapat diklik tanpa tertutup bilah navigasi.
  - `0` error konsol maupun unhandled exception selama seluruh sesi pengujian.

### Catatan Batas Verifikasi
- Pengubahan ukuran jendela Chrome desktop pada Windows via `resize_page(390, 844)` dibatasi oleh lebar minimum jendela OS sebesar `501px` (alat `emulate` tidak tersedia pada MCP toolset ini), sehingga breakpoint CSS `<= 760px` terverifikasi langsung di DOM sedangkan breakpoint `<= 440px` hanya diperiksa dari aturan CSS.
- Pada lebar `501px`, bilah navigasi bawah `.sidebar` pra-eksis memiliki scrollbar internal horizontal/vertikal karena pengalih peran `Staf`/`Admin` berada di baris yang sama dengan menu navigasi; perilaku bawaan tersebut tidak diubah sesuai arahan untuk mempertahankan desain existing.

## Delivery Gate (Mode `after`)

| Syarat Delivery Gate | Status | Catatan Teramati |
| :--- | :--- | :--- |
| Kode bersih dari placeholder, logik draf konsisten, build & unit test baru hijau (`C-1`, `R-26`, `R-27`, `R-36`, `R-38`) | PASS | `drafts.test.mjs` + `organizations.test.mjs` (8/8 lolos) dan `vite build` (exit 0) dijalankan setelah edit terakhir; 0 error `tsc` di file yang diubah. |
| Pemeriksaan kontras WCAG pada teks status/chip yang diubah (`R-03`, `C-2`) | PASS | Semua rasio terukur >= 4.5:1 (`5.56:1`, `5.90:1`, `4.63:1` / `4.92:1`). |
| Peninjauan runtime aplikasi berjalan pada desktop (`1280x800`) dan breakpoint mobile (`<= 760px`) dengan klik alur interaktif serta console check | PASS | Seluruh alur form kosong, `Simpan Draf`, autosave, `Lanjut Isi`, `Kirim`, metrik Dashboard (`Total Strategi = 2`), visibilitas status & aksi mobile (`501px`), dan `0` console error terverifikasi langsung. |

**Kesimpulan Delivery Gate: PASS (Lolos verifikasi unit test, build, kontras, serta uji klik browser desktop dan mobile `<= 760px`).**
