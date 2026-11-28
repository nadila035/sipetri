export type SopRole = "staff" | "admin"

export type SopStatusRow = {
  status: "Draf" | "Menunggu" | "Revisi" | "Disetujui"
  badgeTone: "draf" | "menunggu" | "revisi" | "disetujui"
  meaning: string
  action: string
}

export type SopExportRow = {
  label: string
  extension: string
  purpose: string
  contents: string
}

export type SopQuickFix = {
  issue: string
  fix: string
}

export type SopChapter = {
  id: string
  number: string
  menuRef: string
  title: string
  purpose: string
  steps: string[]
  mandatoryTitle: string
  mandatoryRules: string[]
  quickFixes: SopQuickFix[]
  statusTable?: SopStatusRow[]
  exportTable?: SopExportRow[]
}

export type SopDocumentSpec = {
  role: SopRole
  docCode: string
  shortLabel: string
  roleBadge: string
  title: string
  subtitle: string
  audience: string
  scopeSummary: string
  chapters: SopChapter[]
}

export const SOP_STAFF_DOC: SopDocumentSpec = {
  role: "staff",
  docCode: "SOP-PRP-SIPETRI-01",
  shortLabel: "SOP Staf Unit",
  roleBadge: "Staf Unit / Bagian (42 Unit Kerja)",
  title: "SOP Operasional Pelaporan Staf Unit SIPETRI",
  subtitle:
    "Panduan langkah demi langkah penyusunan Sasaran Kinerja Tahunan (RKA), pelaporan realisasi Triwulan I sampai IV, perbaikan revisi, dan pengunduhan arsip resmi unit.",
  audience: "Penanggung Jawab & Staf Pelapor pada 42 Unit Kerja ITPLN",
  scopeSummary: "5 Bab Operasional · Acuan Waktu Asia/Jakarta (WIB)",
  chapters: [
    {
      id: "staf-bab-1-login-beranda",
      number: "Bab 1",
      menuRef: "Portal -> Login -> Dashboard",
      title: "Masuk Sistem & Membaca Beranda Kerja",
      purpose:
        "Memastikan staf berhasil masuk ke ruang kerja unit, mengetahui periode pelaporan yang sedang aktif, membaca batas waktu resmi WIB, dan menindaklanjuti pengingat dari Admin PRP.",
      steps: [
        'Buka halaman depan Portal SIPETRI, lalu klik tombol "Masuk Aplikasi" di bagian atas atau klik kartu "Gerbang Masuk SIPETRI" ("Buka Halaman Login").',
        'Pada halaman "Masuk Akun", ketik kode akun unit kerja Anda (contoh: "fket", "ftik", "baum", "bpk", "pjm") pada kolom "Username Akun / Kode Unit" dan isi "Kata Sandi", kemudian klik tombol "Masuk". Sistem mengunci identitas unit organisasi secara otomatis sesuai sesi login aktif.',
        'Setelah masuk ke menu "Dashboard", baca kalimat status pada kartu biru sambutan untuk memastikan Tahun dan Triwulan default yang sedang dibuka Admin PRP.',
        'Periksa kartu "Batas pengumpulan" di sisi kanan atas untuk melihat tanggal tenggat, sisa hari pengumpulan, dan indikator progres waktu.',
        'Periksa bagian atas halaman: jika muncul banner "Pengingat Mendesak" (merah) atau "Pengingat Penting" (kuning) dari Admin PRP, klik tombol pintas "Buka [Nama Menu]" untuk langsung mengerjakan tugas atau klik "Tandai dibaca" setelah instruksi dipahami.',
        'Jika muncul kotak peringatan dokumen perlu direvisi di bawah kartu sambutan, klik tautan "Periksa riwayat" untuk langsung membuka daftar dokumen berstatus Revisi.',
      ],
      mandatoryTitle: "Aturan Wajib Waktu & Pengingat 1 Arah",
      mandatoryRules: [
        "Seluruh jadwal mulai dan tenggat akhir menggunakan zona waktu Asia/Jakarta (WIB, UTC+07:00) tanpa mengikuti pengaturan jam lokal komputer pengguna.",
        "Pengiriman dokumen baru dibuka hingga pukul 23:59:59 WIB tepat pada tanggal tenggat. Satu detik setelah lewat tengah malam WIB, sistem otomatis mengunci pengiriman.",
        "Pengingat dari Admin PRP bersifat 1 arah (tanpa kolom balasan). Banner merah (Mendesak) dan kuning (Penting) akan tetap tampil di atas layar hingga Anda menekan tombol Tandai dibaca.",
      ],
      quickFixes: [
        {
          issue: 'Muncul pesan "Username tidak dikenali" saat masuk',
          fix: 'Pastikan penulisan username tanpa spasi tambahan (gunakan akun "unit" untuk pelapor unit kerja) dan kata sandi sudah terisi.',
        },
        {
          issue: "Banner pengingat merah atau kuning tidak hilang meski halaman dimuat ulang",
          fix: 'Klik tombol "Tandai dibaca" di sisi kanan banner pengingat agar sistem mencatat bahwa unit Anda sudah membaca instruksi tersebut.',
        },
      ],
    },
    {
      id: "staf-bab-2-sasaran-kinerja",
      number: "Bab 2",
      menuRef: "Menu: Isi Sasaran Kinerja",
      title: "Menyusun Sasaran Kinerja Tahunan / RKA",
      purpose:
        "Mencatat target rencana kerja tahunan (Kriteria, Strategi, Program Kerja, dan Sasaran) dari salah satu dari 42 unit kerja sebagai acuan pelaporan Triwulan I sampai IV.",
      steps: [
        'Klik menu "Isi Sasaran Kinerja" pada sidebar kiri (tahap pertama wajib sebelum Laporan Triwulan dapat dibuka).',
        'Pada kotak "Periode Sasaran Tahunan", pilih tahun pelaporan pada dropdown "Tahun RKA / Sasaran" yang berstatus "[Dibuka]". Identitas Unit Utama dan Sub Unit / Bagian sudah terkunci otomatis sesuai akun unit Anda.',
        'Klik tombol "+ Tambah Program / Sasaran" untuk membuka jendela pop-up pengisian baris pada tabel resmi 6 kolom berheader hijau.',
        'Pilih "Sasaran Strategis" dari menu dropdown (master pilihan dikelola terpusat oleh Admin/Renbang), isi nama "Program Kerja", "Sasaran Kinerja", "Bulan Mulai" serta "Bulan Selesai" (opsional), dan "Keterangan".',
        'Klik tombol "Simpan Draf" di dalam pop-up atau di bilah bawah agar progres tersimpan bertahap di penyimpanan browser sebelum pengiriman final.',
        'Klik tombol "Pratinjau" untuk memeriksa tabel resmi 6 kolom berheader hijau atau mencetak dokumen A4 Landscape berkop ITPLN.',
        'Jika seluruh baris telah lengkap, klik "Kirim Sasaran" lalu konfirmasi "Ya, Kirim Sasaran". Begitu disetujui (ACC) oleh Admin PRP, seluruh data otomatis tertarik ke lembar kerja Laporan Triwulan.',
      ],
      mandatoryTitle: "Aturan Wajib Penyusunan & Penyimpanan Draf RKA",
      mandatoryRules: [
        "Simpan otomatis baru aktif setelah Anda menekan tombol Simpan Draf minimal satu kali pada sesi pengisian tersebut.",
        "Draf disimpan pada penyimpanan lokal browser (localStorage). Wajib membuka dan mengedit formulir hanya pada 1 tab browser agar draf tidak saling menimpa antar-tab.",
        "Kolom Kriteria, Strategi, Program, Uraian Sasaran, dan Bulan Mulai wajib terisi semua, serta Bulan Selesai tidak boleh lebih awal daripada Bulan Mulai.",
      ],
      quickFixes: [
        {
          issue: "Muncul banner Periode Sasaran Kinerja Terkunci saat memilih tahun tertentu",
          fix: 'Admin PRP belum membuka periode tahun tersebut atau batas waktu 23:59:59 WIB telah lewat. Pilih tahun lain pada dropdown Tahun RKA / Sasaran yang berstatus "[Dibuka]", atau hubungi Admin PRP untuk membuka jadwal.',
        },
        {
          issue: "Muncul peringatan kolom wajib saat menekan Kirim Sasaran",
          fix: "Periksa kotak input yang bergaris tepi merah: pastikan Unit Utama, Sub Unit, seluruh nama Kriteria/Strategi/Program, Uraian Sasaran, dan Bulan Mulai tidak ada yang kosong.",
        },
      ],
    },
    {
      id: "staf-bab-3-laporan-triwulan",
      number: "Bab 3",
      menuRef: "Menu: Isi Laporan Triwulan",
      title: "Mengisi Laporan Realisasi Triwulan (TW I sampai IV)",
      purpose:
        "Melaporkan capaian pelaksanaan program kerja per triwulan lengkap dengan persentase realisasi, tautan bukti dukung (evidence), serta tindak lanjut kendala bila capaian belum 100%.",
      steps: [
        'Pastikan Sasaran Kinerja tahun berjalan unit Anda telah berstatus "Disetujui" (ACC) oleh Admin PRP sehingga menu "Isi Laporan Triwulan" otomatis terbuka.',
        'Klik menu "Isi Laporan Triwulan" untuk melihat grid tabel 13 kolom yang telah terisi otomatis dengan Sasaran Strategis, Program Kerja, Sasaran, dan Bulan Pelaksanaan dari RKA unit.',
        'Klik baris program kerja atau tombol "Isi Progres" pada kolom aksi untuk membuka jendela pop-up pengisian progres.',
        'Di dalam jendela pop-up, lengkapi "Tahap Pelaksanaan (Uraian)", "Realisasi Pelaksanaan (Uraian)", serta angka akumulatif "Realisasi Pelaksanaan (%)" (melanjutkan capaian triwulan sebelumnya hingga 100%).',
        'Apabila nilai "Realisasi Pelaksanaan (%)" masih di bawah 100%, lengkapi kolom merah muda: "Kendala", "Rencana Penyelesaian Kendala", dan "Waktu Penyelesaian Kendala".',
        'Isi "Keterangan" dan tempelkan tautan dokumen pada "Link Evidence", lalu gunakan tombol "Simpan Draf" di dalam pop-up untuk menyimpan bertahap sebelum klik "Kirim Laporan".',
        'Program yang belum mencapai 100% otomatis terbuka kembali (carry-over) di triwulan berikutnya dengan status "Terlambat" / "Pencapaian Terlambat", sedangkan program yang sudah tervalidasi 100% otomatis terkunci (Close 100%). Pantau tunggakan melalui menu "Monitoring Keterlambatan".',
      ],
      mandatoryTitle: "Aturan Wajib Impor RKA & Realisasi di Bawah 100%",
      mandatoryRules: [
        "Syarat Impor dari Sasaran Kinerja: dokumen Sasaran Kinerja pada Tahun dan Unit/Sub Unit yang sama wajib sudah dikirim (minimal berstatus Menunggu, Revisi, atau Disetujui; dokumen yang masih berstatus Draf belum dapat diimpor).",
        "Aturan Tegas Realisasi < 100%: setiap sasaran yang persentase realisasinya kurang dari 100% (angka 0 sampai 99) wajib mengisi lengkap kolom Kendala, Rencana Penyelesaian Kendala, dan Waktu Penyelesaian Kendala. Jika salah satu kosong, tombol Kirim Laporan akan menolak pengiriman.",
        "Pastikan tautan pada kolom Link Evidence diawali https:// dan tidak terkunci privat agar tidak dikembalikan sebagai revisi oleh Admin PRP.",
      ],
      quickFixes: [
        {
          issue: 'Tombol "Impor dari Sasaran Kinerja" tidak memunculkan program',
          fix: "Pastikan Tahun, Unit Utama, dan Sub Unit pada formulir Laporan Triwulan sama persis dengan dokumen Sasaran Kinerja, dan pastikan Sasaran Kinerja tersebut sudah dikirim (bukan masih berstatus Draf di menu Riwayat).",
        },
        {
          issue: "Kolom Kendala terkunci (abu-abu) atau justru menolak kirim",
          fix: "Kolom Kendala otomatis terbuka hanya setelah angka Realisasi (%) diisi kurang dari 100. Jika bernilai 100%, kolom tersebut memang tidak wajib diisi.",
        },
      ],
    },
    {
      id: "staf-bab-4-riwayat-revisi-unduh",
      number: "Bab 4",
      menuRef: "Menu: Riwayat & Lonceng Notifikasi",
      title: "Memantau Status, Perbaikan Revisi, & Unduh Arsip Unit",
      purpose:
        "Memahami arti 4 status verifikasi dokumen, mengerjakan perbaikan berdasarkan catatan per indikator dari Admin PRP, serta mengunduh arsip PDF resmi maupun Excel/CSV satuan unit.",
      steps: [
        'Klik ikon "Lonceng Notifikasi" di pojok kanan atas untuk melihat pembaruan verifikasi terbaru, atau buka menu "Riwayat" di sidebar kiri untuk melihat seluruh dokumen unit.',
        'Gunakan tab jenis dokumen ("Semua", "Laporan Triwulan", "Sasaran Kinerja"), kotak "Cari dokumen...", filter tahun, atau dropdown status ("Draf", "Menunggu", "Disetujui", "Revisi").',
        'Untuk melanjutkan draf yang belum dikirim, klik tombol "Lanjut Isi" pada baris berstatus "Draf".',
        'Untuk memperbaiki dokumen berstatus "Revisi": filter status ke "Revisi", lalu klik tombol "Perbaiki" pada baris dokumen tersebut.',
        'Di dalam panel detail revisi, cari sel tabel berlabel merah "PERLU REVISI", baca instruksi pada kotak "Catatan:" dari Admin PRP, lalu ubah isian langsung pada kotak teks yang tersedia.',
        'Setelah seluruh sel yang ditandai selesai diperbaiki, klik tombol "Kirim Perbaikan" di kanan bawah lalu klik "Ya, Kirim Perbaikan" agar dokumen kembali masuk ke antrean verifikasi Admin PRP (status berubah kembali menjadi "Menunggu").',
        'Untuk menyimpan arsip resmi PDF satuan unit: klik "Lihat Detail" pada dokumen, klik "Cetak Laporan Realisasi (PDF)" atau "Cetak Sasaran Kinerja (PDF)", lalu pada layar Pratinjau Cetak A4 Landscape klik "Cetak / Simpan PDF" dan pilih "Save as PDF".',
        'Untuk mengunduh data tabel ke spreadsheet: buka "Lihat Detail" pada dokumen terkirim, lalu klik tombol "Cetak Excel" di bagian bawah untuk mengunduh berkas CSV resmi (7 kolom RKA atau 12 kolom Triwulan) yang siap dibuka di Microsoft Excel.',
      ],
      mandatoryTitle: "Aturan Penguncian Pengiriman & Perbaikan Revisi",
      mandatoryRules: [
        "Dokumen berstatus Menunggu maupun Disetujui bersifat baca-saja (tidak dapat diedit ulang oleh staf).",
        "Pengiriman ulang perbaikan Revisi hanya dapat dilakukan selama periode dokumen tersebut masih berstatus Dibuka oleh Admin PRP dan belum melewati pukul 23:59:59 WIB pada tanggal tenggat.",
        "Apabila masa pengumpulan sudah ditutup atau lewat tenggat 23:59:59 WIB, tombol Kirim Perbaikan otomatis terkunci hingga Admin PRP memberikan perpanjangan jadwal.",
      ],
      statusTable: [
        {
          status: "Draf",
          badgeTone: "draf",
          meaning:
            "Dokumen masih tersimpan sementara di browser lokal staf dan belum masuk ke antrean Admin PRP.",
          action: 'Klik "Lanjut Isi" untuk melengkapi lalu tekan Kirim.',
        },
        {
          status: "Menunggu",
          badgeTone: "menunggu",
          meaning:
            "Dokumen telah dikirim unit (atau baru selesai dikirim ulang dari revisi) dan sedang menunggu pemeriksaan Admin PRP.",
          action: 'Klik "Lihat Detail" untuk memantau atau mencetak salinan.',
        },
        {
          status: "Revisi",
          badgeTone: "revisi",
          meaning:
            "Admin PRP mengembalikan dokumen dengan catatan perbaikan spesifik pada satu atau beberapa sel indikator.",
          action: 'Klik "Perbaiki", ubah sel bertanda PERLU REVISI, lalu klik "Kirim Perbaikan".',
        },
        {
          status: "Disetujui",
          badgeTone: "disetujui",
          meaning:
            "Seluruh isian dan bukti dukung telah diverifikasi serta disahkan Admin PRP sebagai arsip kinerja resmi unit.",
          action: 'Klik "Lihat Detail" lalu unduh PDF A4 Landscape dan Cetak Excel sebagai arsip unit.',
        },
      ],
      quickFixes: [
        {
          issue: "Sel tertentu pada tabel detail tidak bisa diketik saat klik Perbaiki",
          fix: "Saat mode Perbaiki, sistem hanya membuka kotak edit pada sel indikator yang diberi catatan revisi oleh Admin PRP agar data lain yang sudah disetujui tetap terjaga.",
        },
        {
          issue: "Tampilan tabel PDF terpotong saat dicetak ke kertas",
          fix: 'Pada jendela cetak browser, pastikan orientasi kertas diatur ke "Landscape" (Mendatar), ukuran kertas "A4", dan opsi "Background graphics" diaktifkan.',
        },
      ],
    },
    {
      id: "staf-bab-5-kendala-umum",
      number: "Bab 5",
      menuRef: "Troubleshooting Staf Unit",
      title: "Panduan Mengatasi Kendala Umum Staf",
      purpose:
        "Rujukan cepat bagi staf unit kerja saat menghadapi kendala penguncian tombol kirim, gagal impor sasaran tahunan, pengingat yang terus tampil, atau kendala penyimpanan browser.",
      steps: [
        "Identifikasi gejala kendala atau pesan pemberitahuan merah di bagian atas halaman kerja Anda.",
        "Cocokkan gejala tersebut dengan daftar solusi mandiri di bawah ini sebelum menghubungi Admin PRP.",
        "Apabila kendala berkaitan dengan pembukaan periode atau perpanjangan tenggat waktu, sampaikan nama Unit Kerja, Jenis Dokumen, serta Tahun dan Triwulan kepada Admin PRP.",
      ],
      mandatoryTitle: "Pencegahan Kehilangan Draf Lokal di Browser",
      mandatoryRules: [
        "Jangan menggunakan fitur Clear Site Data / Hapus Riwayat & Cache Situs pada browser selama masih ada dokumen berstatus Draf yang belum dikirim.",
        "Hindari mengisi formulir menggunakan jendela Incognito / InPrivate karena data draf akan terhapus otomatis begitu jendela ditutup.",
        "Setelah dokumen dikirim, biasakan langsung mengunduh salinan PDF dan Excel dari menu Riwayat sebagai cadangan resmi di folder kerja unit.",
      ],
      quickFixes: [
        {
          issue: 'Tombol "Kirim Sasaran", "Kirim Laporan", atau "Kirim Perbaikan" terkunci / nonaktif',
          fix: "Periode pelaporan terkait sedang berstatus Ditutup oleh Admin PRP atau waktu sekarang telah melewati pukul 23:59:59 WIB pada tanggal tenggat. Hubungi Admin PRP untuk permohonan pembukaan akses atau perpanjangan tanggal tenggat.",
        },
        {
          issue: 'Program kerja tidak muncul saat menekan "Impor dari Sasaran Kinerja"',
          fix: 'Periksa 3 syarat: (1) Tahun pada Laporan Triwulan sama dengan Tahun RKA, (2) Unit Utama & Sub Unit sama persis dengan unit pada RKA, dan (3) RKA tersebut sudah dikirim di menu Riwayat (minimal berstatus "Menunggu", bukan "Draf").',
        },
        {
          issue: 'Banner pengingat "Mendesak" atau "Penting" selalu muncul setiap pindah menu',
          fix: 'Banner siaran 1 arah dirancang tetap tampil lintas menu agar tidak terlewat. Klik tombol "Tandai dibaca" pada sisi kanan banner untuk menutupnya.',
        },
        {
          issue: 'Muncul pesan "Gagal menyimpan ke penyimpanan browser" atau draf tidak berubah',
          fix: "Tutup tab SIPETRI lain jika Anda membuka lebih dari 1 tab bersamaan, pastikan ruang penyimpanan browser tidak penuh, lalu unduh cadangan dokumen lama dari menu Riwayat sebelum membersihkan ruang disk.",
        },
      ],
    },
  ],
}

export const SOP_ADMIN_DOC: SopDocumentSpec = {
  role: "admin",
  docCode: "SOP-PRP-SIPETRI-02",
  shortLabel: "SOP Admin PRP",
  roleBadge: "Administrator & Verifikator PRP",
  title: "SOP Operasional Pengelolaan & Verifikasi Admin PRP",
  subtitle:
    "Panduan resmi pengaturan jadwal WIB, pemantauan kepatuhan 42 unit kerja, pemeriksaan dokumen & catatan revisi per sel, siaran pengingat 1 arah, serta unduhan Rekap Master.",
  audience: "Tim Direktorat / Bagian Perencanaan & Risiko (PRP) ITPLN",
  scopeSummary: "6 Bab Operasional · Kendali 42 Unit Kerja ITPLN",
  chapters: [
    {
      id: "admin-bab-1-periode-tenggat",
      number: "Bab 1",
      menuRef: "Menu: Periode dan Tenggat Waktu",
      title: "Mengatur Tahun, Periode Default, & Tenggat Waktu",
      purpose:
        "Membuka siklus tahun pelaporan baru, mengarahkan periode default yang tampil di beranda staf, serta menetapkan rentang tanggal pengisian dan penguncian akses berbasis WIB.",
      steps: [
        'Masuk menggunakan akun Admin PRP (username "admin" beserta kata sandi), lalu klik menu "Periode dan Tenggat Waktu" di sidebar kiri (atau tombol "Atur periode & tenggat" di beranda monitoring).',
        'Untuk menambah tahun anggaran baru: pada kartu "Tahun Pelaporan", isi angka tahun 4 digit (2020 sampai 2100) pada kolom "Tambah tahun baru", lalu klik tombol "+ Buat Tahun Baru". Sistem otomatis membuat 5 kartu jadwal (Sasaran Kinerja Tahunan serta Triwulan I sampai IV) dalam status awal terkunci.',
        'Untuk mengatur periode utama yang dilihat staf saat baru masuk: pada kartu "Periode Default Beranda Staf", pilih "Tahun beranda staf" dan "Triwulan beranda staf", lalu klik tombol "Terapkan ke Beranda Staf".',
        'Untuk mengatur jadwal per dokumen: pilih tahun pada dropdown "Kelola tahun", lalu pada kartu "Sasaran Kinerja Tahunan" atau kartu "Triwulan I" sampai "Triwulan IV", isi tanggal "Mulai Pengisian (00:00 WIB)" dan "Tenggat Waktu (23:59 WIB)".',
        'Setelah mengubah tanggal pada kartu jadwal, wajib menekan tombol biru "Simpan Jadwal" yang muncul di bagian bawah kartu tersebut (klik "Batal" untuk mengurungkan perubahan atau "Kosongkan" untuk menghapus tanggal).',
        'Gunakan tombol sakelar (switch) di pojok kanan atas setiap kartu periode untuk langsung membuka ("Akses Dibuka") atau mengunci ("Akses Dikunci") pengumpulan seluruh unit secara seketika.',
      ],
      mandatoryTitle: "Aturan Wajib Penjadwalan & Efek Notifikasi Otomatis",
      mandatoryRules: [
        "Tanggal Mulai Pengisian berlaku sejak pukul 00:00:00 WIB dan Tenggat Waktu berakhir tepat pukul 23:59:59 WIB pada tanggal yang dipilih.",
        "Menyalakan ulang sakelar pada periode yang tanggal tenggatnya sudah terlewat tidak otomatis memperpanjang tenggat; perbarui tanggal Tenggat Waktu ke tanggal mendatang lalu klik Simpan Jadwal.",
        "Setiap penambahan tahun baru, perubahan periode default beranda, pembukaan/penguncian sakelar, maupun perpanjangan tenggat otomatis mengirim notifikasi sistem ke lonceng seluruh staf unit.",
      ],
      quickFixes: [
        {
          issue: "Muncul peringatan konfirmasi saat berpindah menu dari halaman Periode",
          fix: 'Berarti masih ada kartu jadwal berlabel "Belum disimpan". Klik tombol "Simpan Jadwal" atau "Batal" pada kartu tersebut terlebih dahulu.',
        },
        {
          issue: "Ingin membuka periode tanpa batas tanggal akhir",
          fix: 'Kosongkan kolom Mulai Pengisian dan Tenggat Waktu menggunakan tombol "Kosongkan", klik "Simpan Jadwal", lalu pastikan sakelar kanan atas kartu dalam posisi aktif ("Akses Dibuka").',
        },
      ],
    },
    {
      id: "admin-bab-2-dashboard-monitoring",
      number: "Bab 2",
      menuRef: "Menu: Dashboard Monitoring",
      title: "Memantau Kepatuhan Pelaporan 42 Unit Kerja",
      purpose:
        "Memantau tingkat kepatuhan pengiriman laporan seluruh 42 unit kerja secara menyeluruh maupun per kelompok unit, serta menindaklanjuti unit yang belum melapor atau sedang revisi.",
      steps: [
        'Buka menu "Dashboard Monitoring" di sidebar kiri.',
        'Gunakan bilah filter di bawah kartu sambutan ("Cari dokumen", "Tahun", "Triwulan", "Unit", dan "Status") untuk memfokuskan pemantauan pada periode atau unit induk/subunit tertentu.',
        'Baca panel "Cakupan Pelaporan Unit" yang menampilkan 4 indikator utama kepatuhan: "Wajib Lapor" (total 42 unit atau sesuai filter), "Sudah Mengirim", "Belum Melapor", dan "Pelapor Disetujui".',
        'Amati panel kiri "Status Pelaporan per Unit" untuk melihat grafik batang bertumpuk proporsi status tiap kelompok unit utama, serta grafik "Tren Cakupan Pelaporan" untuk membandingkan kenaikan/penurunan kepatuhan antartriwulan.',
        'Pada panel kanan "Perlu Tindak Lanjut", klik tab "Belum Melapor", "Menunggu", atau "Revisi" untuk melihat daftar unit yang membutuhkan perhatian segera.',
        'Klik tombol "Periksa" pada baris unit berstatus "Menunggu" untuk langsung membuka meja verifikasi, atau klik tombol "Ingatkan (...)" di sudut kanan atas panel untuk menyiarkan pengingat ke seluruh unit pada daftar tersebut.',
        'Gulir ke tabel bawah "Status Pelaporan Sepanjang Tahun" (matriks TW I sampai TW IV) untuk memeriksa konsistensi tahunan tiap unit; klik langsung lencana status berwarna pada sel tabel untuk membuka dokumen terkait.',
      ],
      mandatoryTitle: "Aturan Perhitungan Cakupan 42 Unit",
      mandatoryRules: [
        "Angka Sudah Mengirim pada Cakupan Pelaporan Unit hanya menghitung dokumen Laporan Triwulan yang telah dikirim (status Menunggu, Revisi, atau Disetujui). Dokumen Draf lokal milik staf tidak dihitung sebagai sudah melapor.",
        "Apabila satu unit memiliki lebih dari satu kiriman pada triwulan yang sama, matriks kepatuhan menampilkan dokumen dengan waktu pengiriman terbaru.",
        "Jika muncul keterangan dokumen belum cocok dengan master unit, periksa penulisan nama unit pada dokumen tersebut di menu Arsip.",
      ],
      quickFixes: [
        {
          issue: "Angka pada kartu KPI bawah berbeda dengan kartu Cakupan Pelaporan Unit",
          fix: "Kartu Cakupan Pelaporan Unit khusus menghitung rasio kepatuhan 42 unit wajib lapor pada satu triwulan, sedangkan 4 kartu KPI di bawahnya menghitung total seluruh dokumen (termasuk Sasaran Kinerja) yang cocok dengan filter aktif.",
        },
        {
          issue: 'Matriks menampilkan label "Belum berjalan" pada triwulan akhir tahun',
          fix: "Triwulan yang kalendernya belum berjalan dan belum memiliki kiriman ditandai Belum berjalan agar tidak terhitung sebagai tunggakan Belum Melapor.",
        },
      ],
    },
    {
      id: "admin-bab-3-verifikasi-revisi",
      number: "Bab 3",
      menuRef: "Verifikasi Laporan Triwulan & Verifikasi Sasaran Kinerja",
      title: "Memverifikasi Dokumen & Memberi Catatan Revisi per Sel",
      purpose:
        "Memeriksa kelengkapan substansi laporan dan tautan bukti dukung unit, memberi catatan perbaikan tepat pada sel indikator yang bermasalah, atau mengesahkan dokumen menjadi Disetujui.",
      steps: [
        'Buka menu "Verifikasi Laporan Triwulan" (tabel 12 kolom) atau "Verifikasi Sasaran Kinerja" (tabel 7 kolom) di sidebar kiri, lalu pilih filter "Status: Menunggu" untuk menampilkan antrean pemeriksaan.',
        'Klik tombol "Lihat Detail" pada baris dokumen untuk meninjau pratinjau cepat dan keterkaitan sumber RKA, kemudian klik tombol "Periksa" di pojok kanan bawah (atau buka langsung dari lonceng notifikasi Admin).',
        'Di jendela meja pemeriksaan, periksa kesesuaian Program Kerja, Sasaran, Bulan Pelaksanaan, dan kewajaran angka "Realisasi Pelaksanaan (%)".',
        'Jika terdapat sasaran dengan realisasi di bawah 100%, pastikan kolom "Kendala", "Rencana Penyelesaian Kendala", dan "Waktu Penyelesaian Kendala" telah diisi secara konkret dan logis.',
        'Klik tautan pada kolom "Link Evidence" untuk membuka bukti dukung di tab baru dan memastikan berkas bukti benar serta dapat diakses tanpa terkunci izin.',
        'Apabila ada sel yang perlu diperbaiki unit: klik "ikon catatan kecil" (ikon pena/catatan) di sebelah kanan teks di dalam sel tersebut, ketik instruksi perbaikan yang spesifik pada panel editor bawah, lalu klik "Selesai". Ulangi pada sel lain yang memerlukan revisi.',
        'Untuk mengembalikan dokumen ke unit agar diperbaiki, klik tombol "Kirim Revisi (...)". Untuk mengesahkan dokumen yang sudah benar sepenuhnya, klik tombol hijau "Setujui Dokumen".',
      ],
      mandatoryTitle: "Aturan Wajib Meja Verifikasi Admin PRP",
      mandatoryRules: [
        "Hanya dokumen berstatus Menunggu yang dapat diberi keputusan Setujui Dokumen atau Kirim Revisi. Dokumen yang sudah berstatus Revisi atau Disetujui tampil dalam mode baca beserta riwayat pemeriksaannya.",
        "Syarat Wajib Kirim Revisi: Admin wajib menulis minimal 1 catatan indikator (tidak boleh kosong) pada sel tabel sebelum tombol Kirim Revisi dapat dijalankan.",
        "Jangan menutup jendela pemeriksaan saat masih ada catatan revisi yang belum dikirim kecuali Anda memang ingin membatalkan catatan tersebut.",
      ],
      quickFixes: [
        {
          issue: 'Muncul pesan error "Isi setidaknya satu catatan indikator sebelum meminta revisi"',
          fix: 'Klik ikon catatan kecil pada sel tabel yang perlu diperbaiki, ketik alasan/instruksi revisi hingga angka pada tombol berubah misalnya menjadi "Kirim Revisi (1)", baru klik tombol tersebut.',
        },
        {
          issue: "Salah menandai sel saat sedang memeriksa tabel",
          fix: 'Klik kembali catatan pada sel tersebut, lalu tekan tombol "Hapus Catatan" di panel editor bawah sebelum menekan Setujui Dokumen atau Kirim Revisi.',
        },
      ],
    },
    {
      id: "admin-bab-4-siaran-pengingat",
      number: "Bab 4",
      menuRef: "Tombol Siaran (Broadcast) di Header Atas",
      title: "Mengirim Siaran Pengingat Realtime 1 Arah",
      purpose:
        "Mengirimkan instruksi atau pengingat tenggat secara terarah ke seluruh unit, unit yang belum melapor, unit berstatus revisi, atau unit tertentu, sekaligus memantau status baca staf.",
      steps: [
        'Klik tombol biru bergambar gelombang siaran ("Kirim pengingat realtime") di sebelah kiri ikon lonceng pada header atas halaman Admin.',
        'Untuk pengisian cepat, klik salah satu tombol pada bagian "Template Cepat (1-Klik)": "Input Laporan Triwulan", "Susun Sasaran Kinerja", "Perbaikan Revisi", atau "Lengkapi Bukti Dukung".',
        'Sesuaikan dropdown "Tujuan Penerima": pilih "Semua Unit (42 Unit Pelapor)", "Unit Belum Melapor TW ...", "Unit Status Revisi", atau "Pilih Unit Tertentu" (centang unit kerja tujuan lewat kotak pencarian unit).',
        'Pilih "Tingkat Prioritas": "Mendesak" (memunculkan banner merah di layar staf), "Penting" (memunculkan banner kuning), atau "Informasi Umum" (masuk ke lonceng notifikasi tanpa banner menetap).',
        'Pilih "Pintasan Menu Tujuan" agar tombol aksi pada banner staf langsung membuka halaman yang tepat, atur tanggal "Berlaku Hingga (Opsional)" bila pengingat ingin otomatis kedaluwarsa, lalu periksa "Judul Pengingat" dan "Isi Pesan Pengingat".',
        'Klik tombol "Kirim Pengingat Realtime" untuk menyiarkan pesan.',
        'Pantau bagian bawah "Daftar Pengingat & Status Baca": gunakan tab "Semua", "Aktif", atau "Diarsipkan" untuk mengecek lencana "Sudah dibaca" / "Belum dibaca", klik "Arsipkan" untuk menarik banner dari layar staf, atau klik "Hapus" bila sudah tidak diperlukan.',
      ],
      mandatoryTitle: "Aturan Siaran Pengingat & Masa Berlaku",
      mandatoryRules: [
        "Jika Tujuan Penerima diatur ke Pilih Unit Tertentu, minimal 1 unit kerja wajib dicentang sebelum pengingat dapat dikirim.",
        "Kolom Berlaku Hingga bersifat opsional dan mengikuti batas pukul 23:59:59 WIB pada tanggal yang dipilih; setelah lewat, banner otomatis berhenti tampil di layar staf.",
        "Pengingat aktif yang belum dibaca staf dilindungi sistem agar tidak tergeser keluar oleh notifikasi otomatis rutin.",
      ],
      quickFixes: [
        {
          issue: "Ingin menghentikan banner pengingat merah di layar staf karena periode sudah selesai",
          fix: 'Buka kembali jendela Siaran Pengingat dari tombol header, cari pengingat tersebut pada tab "Aktif", lalu klik tombol "Arsipkan".',
        },
        {
          issue: "Target unit pada opsi Unit Belum Melapor tertulis 0 unit",
          fix: "Berarti seluruh 42 unit kerja pada triwulan default saat ini sudah mengirim laporan. Ubah periode default atau gunakan opsi Pilih Unit Tertentu bila ingin menyapa unit spesifik.",
        },
      ],
    },
    {
      id: "admin-bab-5-arsip-rekap-master",
      number: "Bab 5",
      menuRef: "Menu: Arsip dan Rekapitulasi",
      title: "Arsip Lintas Periode, Pratinjau Resmi, & Unduh Rekap Master",
      purpose:
        "Menelusuri seluruh dokumen terkirim lintas tahun dan unit kerja, mencetak dokumen resmi satuan berformat A4 Landscape, serta mengunduh Rekap Master untuk pelaporan tingkat institusi.",
      steps: [
        'Buka menu "Arsip dan Rekapitulasi" di sidebar kiri.',
        'Pilih tab jenis dokumen ("Semua", "Laporan Triwulan", atau "Sasaran Kinerja"), lalu gunakan filter "Cari dokumen", "Tahun", "Triwulan", "Unit", dan "Status" sesuai cakupan rekap yang diinginkan.',
        'Untuk memeriksa isi lengkap beserta jejak verifikasi satu dokumen, klik tombol "Lihat detail" pada kolom Aksi.',
        'Untuk mencetak atau menyimpan PDF resmi satu dokumen lengkap dengan kop surat ITPLN dan blok tanda tangan, klik tombol "Pratinjau" pada baris dokumen -> klik "Cetak / Simpan PDF".',
        'Untuk mengunduh rekapitulasi seluruh dokumen yang tampil sesuai filter aktif, klik tombol "Unduh Rekap Master" di kanan atas halaman, lalu pilih salah satu dari 3 format unduhan resmi sesuai kebutuhan.',
      ],
      mandatoryTitle: "Aturan Cakupan Filter pada Unduhan Rekap Master",
      mandatoryRules: [
        "Seluruh berkas yang diunduh dari tombol Unduh Rekap Master mengikuti filter yang sedang aktif di layar (Tahun, Triwulan, Unit, Status, dan Tab Jenis Dokumen). Kosongkan filter bila ingin mengunduh rekap penuh seluruh institusi.",
        "Dokumen berstatus Draf milik staf tidak pernah masuk ke Arsip Admin; hanya dokumen yang telah dikirim (Menunggu, Revisi, Disetujui) yang direkap.",
      ],
      exportTable: [
        {
          label: "Rekap Master Excel",
          extension: ".xlsx",
          purpose: "Olah data komprehensif & evaluasi pimpinan / tim PRP",
          contents:
            "Workbook Excel multi-sheet berisi Ringkasan Kepatuhan 42 Unit, Daftar Dokumen Terfilter, Rincian Laporan Triwulan (12 kolom), dan Rincian Sasaran Kinerja/RKA (7 kolom).",
        },
        {
          label: "Arsip Paket Unit",
          extension: ".zip",
          purpose: "Penyimpanan arsip terstruktur per folder unit kerja",
          contents:
            "Paket ZIP berisi berkas indeks ringkasan arsip serta folder terpisah untuk setiap unit kerja yang memuat rincian tabel masing-masing dokumen.",
        },
        {
          label: "Ringkasan Daftar Dokumen",
          extension: ".csv",
          purpose: "Pengecekan cepat daftar status & waktu pengiriman",
          contents:
            "Tabel ringkas 1 lembar (ID Dokumen, Jenis, Judul, Periode, Unit, Penanggung Jawab, Waktu Kirim, Status, dan Kelengkapan).",
        },
      ],
      quickFixes: [
        {
          issue: 'Tombol "Unduh Rekap Master" nonaktif (tidak bisa diklik)',
          fix: "Tabel arsip saat ini kosong karena filter pencarian terlalu sempit atau belum ada dokumen terkirim. Atur ulang filter Tahun, Triwulan, Unit, dan Status ke pilihan Semua.",
        },
        {
          issue: "Ingin mengunduh khusus dokumen yang sudah sah (final) saja",
          fix: 'Pilih filter Status menjadi "Disetujui" terlebih dahulu, baru klik "Unduh Rekap Master" -> pilih format .xlsx atau .zip.',
        },
      ],
    },
    {
      id: "admin-bab-6-kendala-umum",
      number: "Bab 6",
      menuRef: "Troubleshooting Admin PRP",
      title: "Panduan Mengatasi Kendala Operasional Admin",
      purpose:
        "Menangani permintaan perpanjangan waktu dari unit kerja, memahami batasan penyimpanan lokal antartab/perangkat, serta menjaga keamanan cadangan data pelaporan.",
      steps: [
        "Periksa laporan kendala yang disampaikan staf unit kerja dengan mencocokkan status periode di menu Periode dan Tenggat Waktu.",
        "Gunakan langkah penanganan di bawah ini dan lakukan pengunduhan Rekap Master secara berkala setiap penutupan triwulan.",
      ],
      mandatoryTitle: "Aturan Cadangan Data & Sinkronisasi Penyimpanan",
      mandatoryRules: [
        "Aplikasi saat ini menyimpan data pada penyimpanan lokal browser (localStorage kunci quarterly-reporting-v1) dengan sinkronisasi otomatis antartab di dalam browser dan profil yang sama.",
        "Data pada satu browser atau komputer tidak otomatis berpindah ke perangkat/browser berbeda sebelum dihubungkan ke server backend API.",
        "Wajib mengunduh Rekap Master Excel (.xlsx) dan Arsip Paket Unit (.zip) secara berkala sebelum membersihkan cache/data situs browser.",
      ],
      quickFixes: [
        {
          issue: "Unit meminta perpanjangan waktu karena pengiriman baru atau pengiriman ulang Revisi terkunci",
          fix: 'Buka menu "Periode dan Tenggat Waktu", pilih Tahun terkait, pastikan sakelar kartu periode menyala ("Akses Dibuka"), ubah tanggal "Tenggat Waktu" ke tanggal perpanjangan baru (berlaku s.d. 23:59 WIB), lalu klik "Simpan Jadwal".',
        },
        {
          issue: "Kiriman unit dari komputer/browser lain belum muncul di layar Admin",
          fix: "Karena mode penyimpanan saat ini masih berbasis browser lokal tanpa server pusat, pastikan simulasi pengiriman unit dan pemeriksaan Admin dijalankan pada browser dan profil pengguna yang sama (bukan mode Incognito terpisah).",
        },
        {
          issue: "Muncul peringatan penyimpanan browser penuh atau gagal membaca data",
          fix: 'Jangan menekan hapus data situs terlebih dahulu. Segera buka "Arsip dan Rekapitulasi", pastikan filter disetel ke "Semua", lalu unduh "Rekap Master Excel (.xlsx)" dan "Arsip Paket Unit (.zip)" sebagai cadangan penuh.',
        },
      ],
    },
  ],
}

export function getSopSpec(role: SopRole): SopDocumentSpec {
  return role === "admin" ? SOP_ADMIN_DOC : SOP_STAFF_DOC
}

export function getAllowedWorkspaceSopRoles(
  sessionRole: SopRole,
): SopRole[] {
  return [sessionRole]
}

export function filterSopChapters(
  chapters: SopChapter[],
  rawQuery: string,
): SopChapter[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return chapters

  return chapters.filter((chapter) => {
    const haystacks: string[] = [
      chapter.number,
      chapter.menuRef,
      chapter.title,
      chapter.purpose,
      ...chapter.steps,
      chapter.mandatoryTitle,
      ...chapter.mandatoryRules,
      ...chapter.quickFixes.flatMap((item) => [item.issue, item.fix]),
      ...(chapter.statusTable?.flatMap((row) => [
        row.status,
        row.meaning,
        row.action,
      ]) ?? []),
      ...(chapter.exportTable?.flatMap((row) => [
        row.label,
        row.extension,
        row.purpose,
        row.contents,
      ]) ?? []),
    ]
    return haystacks.some((text) => text.toLowerCase().includes(query))
  })
}
