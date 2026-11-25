# Tindak Lanjut Audit 017: Penyelarasan Identitas SIPETRI, Penyederhanaan Hero & Ritme Latar Selang-Seling

Tanggal: 2026-11-17
Mode: `after` (tindak lanjut atas persetujuan pengguna menerapkan seluruh rekomendasi, penyelesaian temuan `anti-slop/audit-017-2026-11-17.md`, penghapusan kartu Siklus Pelaporan pada hero, serta penerapan latar antar-seksi selang-seling).

## Ringkasan Perubahan yang Diterapkan

1. **Penyederhanaan Hero (`src/pages/PortalPage.tsx`, `src/pages/portalContent.ts`, `src/utils/useMotion.ts`, `src/pages/portal.css`)**
   - Menghapus kartu `Siklus Pelaporan` (`.portal-hero-glass`) di sisi kanan hero beserta ekspor `PORTAL_CYCLE_HIGHLIGHTS` yang tidak terpakai.
   - Menyelaraskan hero menjadi komposisi kiri yang ringkas (`max-width: 590px`) sehingga foto gedung Menara PLN (`/gedung-itpln.jpg`), langit biru, dan bendera di sisi kanan tampil terbuka tanpa tertutup kartu.
2. **Ritme Latar Selang-Seling Khas SIPETRI / ITPLN (`src/pages/portal.css`, `DESIGN.md`)**
   - **Hero (`#beranda`):** Latar penuh foto kampus `/gedung-itpln.jpg` dengan scrim arah kiri agar teks kontras dan bangunan di kanan tetap jelas.
   - **Akses Cepat Portal (`#tautan`):** Latar biru langit lembut (`linear-gradient(180deg, #e7f0fd 0%, #f2f7fe 100%)`) untuk memisahkan area kartu sorotan login dan grid 2x2.
   - **Alur & Layanan (`#layanan`):** Pita jangkar **Deep ITPLN Navy** (`linear-gradient(135deg, #10244d 0%, #16336e 100%)`) dengan kicker emas ITPLN `#f9bd4f`, judul putih, sakelar tab peran, dan kartu langkah putih (`01`–`04`).
   - **FAQ (`#faq`):** Latar putih bersih (`#ffffff`) untuk kenyamanan baca daftar pertanyaan 2 kolom.
   - **Komitmen Tata Kelola & Kontak (`#contact`):** Latar biru-slate sejuk (`linear-gradient(180deg, #edf3fc 0%, #e1ebfa 100%)`) yang mengangkat kartu tata kelola dan kartu kontak dua kolom bergaya `.login-shell`.
   - **Footer:** Latar putih bersih (`#ffffff`) dengan `padding-right: 68px` pada `.portal-footer-inner` agar `Versi 2.4.0` tidak bertumpukan dengan tombol `Kembali ke atas`.
3. **Perbaikan Temuan Audit `audit-017` (`src/components/PortalBrandMark.tsx`, `src/pages/PortalPage.tsx`, `src/pages/portal.css`)**
   - **Temuan #1 (R-25):** Seluruh pasangan warna baru terukur programatik `6.63:1` hingga `15.20:1` (dan `5.04:1`–`17.29:1` pada komponen putih/slate), lulus WCAG AA.
   - **Temuan #2 (R-32):** Dropdown desktop `Panduan` menutup otomatis saat `onBlur` ke luar container, dan `.portal-mobile-drawer` memakai `useDialog` (`Escape`, *focus trap*, pemulihan fokus).
   - **Temuan #4 & #5 (R-08, R-14):** `Gerbang Masuk SIPETRI` dibedakan sebagai kartu utama terhighlight, sedangkan `arrowUpRight` hanya dipakai pada tautan eksternal (`itpln.ac.id`, Google Maps).
   - **Temuan #6 (R-05, R-29):** Memutus dua akordeon berturut-turut dengan mengubah `Alur & Layanan` menjadi alur 4 langkah bertab peran dan menyeimbangkan palet resmi ITPLN.

## Status Verifikasi Pasca-Edit Akhir & Delivery Gate

- **Em-Dash Hygiene (`R-02`)**: `PASS` (`EM_DASH_COUNT: 0` di seluruh berkas yang disentuh).
- **TypeScript (`node node_modules/typescript/bin/tsc --noEmit --skipLibCheck`)**: `PASS` (`SRC_TS_ERRORS: 0` pada `src/`).
- **Build Produksi Vite (`node node_modules/vite/bin/vite.js build`)**: `PASS` (`64 modules transformed`, output `dist/index.html`, `dist/assets/index-JQcxlYlk.css`, `dist/assets/index-BSLMzRgO.js`).
- **Unit Test (`node --test auth.test.mjs drafts.test.mjs notifications.test.mjs organizations.test.mjs workflow.test.mjs`)**: `PASS` (57 dari 57 test lulus).
- **Verifikasi Browser Langsung (`R-35`, `R-03`, `R-32`)**: `PASS` pada `http://127.0.0.1:4173/`:
  - `0` console error dan `0` network request gagal (`/portal-campus-aerial.jpg` dimuat `200`/`304`, seluruh aset lokal & font `200`/`304`).
  - **Desktop (`1280x800`), Tablet (`768x1024`), & Mobile (`390x844`):** Foto udara Menara PLN dan tulisan `INSTITUT TEKNOLOGI PLN` tampil utuh di kanan pada desktop tanpa menutupi keterbacaan teks di kiri, latar seksi selang-seling (`biru langit lembut` -> `deep navy ITPLN` -> `putih bersih` -> `slate-biru sejuk` -> `footer putih`), serta seluruh interaksi (tab `Admin PRP`, akordeon `FAQ`, modal `Panduan Alur` + `Escape`, tombol `Kembali ke atas`, rute `/login` <-> `/`, dan menu mobile) terverifikasi berjalan tanpa horizontal overflow.
