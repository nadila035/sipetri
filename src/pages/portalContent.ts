export type PortalNavItem = {
  id: string
  label: string
  href: string
}

export type PortalLinkCard = {
  id: string
  title: string
  description: string
  delayMs: number
  kind: "login" | "external" | "mailto" | "tel" | "section" | "modal-units"
  href?: string
  icon: "globe" | "lock" | "report" | "grid" | "mail" | "phone"
}

export type PortalServiceCard = {
  title: string
  detail: string
}

export type PortalFaqItem = {
  id: string
  question: string
  answer: string
}

export type PortalFaqCategory = {
  title: string
  items: PortalFaqItem[]
}

export const PORTAL_INSTITUTION = {
  shortName: "SIPETRI",
  fullName: "Sistem Pelaporan Triwulan",
  institution: "Institut Teknologi Perusahaan Listrik Negara",
  unitManager: "Direktorat / Bagian Perencanaan & Risiko (PRP)",
  address: "Menara PLN, Jalan Lingkar Luar Barat, Duri Kosambi, Cengkareng",
  email: "rektorat@itpln.ac.id",
  phoneDisplay: "(021) 5440342",
  phoneHref: "tel:+62215440342",
  websiteDisplay: "www.itpln.ac.id",
  websiteUrl: "https://www.itpln.ac.id/",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Institut+Teknologi+PLN+Menara+PLN+Duri+Kosambi+Cengkareng",
  version: "Versi 2.4.0",
}

export const PORTAL_NAV_LINKS: PortalNavItem[] = [
  { id: "beranda", label: "Beranda", href: "#beranda" },
  { id: "layanan", label: "Alur & Layanan", href: "#layanan" },
  { id: "faq", label: "FAQ", href: "#faq" },
  { id: "contact", label: "Kontak", href: "#contact" },
]

export const PORTAL_FEATURED_ACCESS: PortalLinkCard = {
  id: "sipetri-login",
  title: "Gerbang Masuk SIPETRI",
  description:
    "Masuk ke ruang kerja pelaporan bagi staf 42 unit kerja atau pusat kendali verifikasi Admin PRP.",
  delayMs: 50,
  kind: "login",
  icon: "lock",
}

export const PORTAL_SUPPORT_LINKS: PortalLinkCard[] = [
  {
    id: "layanan-pelaporan",
    title: "Layanan & Siklus Pelaporan",
    description:
      "Gambaran umum tahapan RKA tahunan, pelaporan triwulanan, dan arsip kinerja",
    delayMs: 50,
    kind: "section",
    href: "#layanan",
    icon: "report",
  },
  {
    id: "direktori-unit",
    title: "Daftar 42 Unit Pelapor",
    description:
      "Struktur fakultas, bidang, biro, dan lembaga terpetakan di ITPLN",
    delayMs: 100,
    kind: "modal-units",
    icon: "grid",
  },
  {
    id: "itpln-web",
    title: "Website Resmi ITPLN",
    description: "Kunjungi portal informasi Institut Teknologi PLN (itpln.ac.id)",
    delayMs: 150,
    kind: "external",
    href: PORTAL_INSTITUTION.websiteUrl,
    icon: "globe",
  },
  {
    id: "email-institusi",
    title: "Korespondensi Email",
    description: "Hubungi pengelola resmi melalui rektorat@itpln.ac.id",
    delayMs: 200,
    kind: "mailto",
    href: `mailto:${PORTAL_INSTITUTION.email}?subject=Layanan%20SIPETRI%20ITPLN`,
    icon: "mail",
  },
]

export const PORTAL_FAQ_CATEGORIES: PortalFaqCategory[] = [
  {
    title: "Umum & Ruang Lingkup",
    items: [
      {
        id: "faq-apa-itu-sipetri",
        question: "Apa itu aplikasi SIPETRI?",
        answer:
          "SIPETRI (Sistem Pelaporan Triwulan) adalah portal pelaporan kinerja unit kerja di Institut Teknologi PLN. Melalui aplikasi ini, setiap unit menyusun Sasaran Kinerja Tahunan (RKA), melaporkan realisasi Triwulan I hingga Triwulan IV, serta memantau status verifikasi dari Admin PRP.",
      },
      {
        id: "faq-unit-pelapor",
        question: "Siapa saja unit kerja yang tercakup dalam pelaporan SIPETRI?",
        answer:
          "Pelaporan mencakup 42 unit kerja di lingkungan Institut Teknologi PLN yang terdiri atas 6 Fakultas/Program (FKET, FTBE, FTIK, FTEN, PASCASARJANA, VOKASI), unit di bawah Rektorat, 5 Bidang, serta pusat dan lembaga (PRP, LPPM, PKA, PMA, PPA, PPK, LEMTERA, TCC, PJM, SPI, dan Perpustakaan).",
      },
      {
        id: "faq-beda-rka-triwulan",
        question:
          "Apa perbedaan Sasaran Kinerja Tahunan (RKA) dan Laporan Triwulan?",
        answer:
          "Sasaran Kinerja Tahunan (RKA) berisi rencana program kerja, kriteria sasaran, rencana kegiatan, indikator, dan bulan pelaksanaan dalam satu tahun. Laporan Realisasi Triwulan mencatat capaian progres tiap program pada Triwulan I sampai IV, lengkap dengan tautan bukti (evidence) serta kendala bila capaian belum mencapai 100%.",
      },
    ],
  },
  {
    title: "Akun & Keamanan Akses",
    items: [
      {
        id: "faq-cara-masuk",
        question:
          "Bagaimana cara masuk ke SIPETRI untuk unit kerja dan Admin PRP / Renbang?",
        answer:
          'Klik tombol Masuk Aplikasi pada halaman ini untuk menuju gerbang login. Gunakan kode unit kerja Anda (contoh: "fket", "ftik", "baum", "bpk") untuk masuk ke ruang kerja unit yang terkunci otomatis, atau gunakan "admin" / "renbang" untuk membuka pusat kendali Admin PRP dan Renbang.',
      },
      {
        id: "faq-isolasi-data",
        question: "Mengapa Unit Organisasi pada formulir terkunci otomatis dan menu Laporan Triwulan tidak bisa dibuka di awal?",
        answer:
          "Nama unit kerja dikunci otomatis sesuai sesi akun unit yang sedang login. Selain itu, alur pelaporan bersifat hierarkis: unit wajib mengisi dan mendapatkan persetujuan (ACC) Sasaran Kinerja terlebih dahulu sebelum lembar kerja Laporan Triwulan terbuka dan terisi otomatis.",
      },
    ],
  },
  {
    title: "Pengisian, Revisi & Tenggat",
    items: [
      {
        id: "faq-kendala-wajib",
        question:
          "Kapan kolom Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian wajib diisi?",
        answer:
          "Pada Laporan Realisasi Triwulan, setiap sasaran dengan realisasi di bawah 100% wajib melengkapi kolom Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian sebelum dokumen dapat dikirim. Jika capaian telah mencapai 100%, bagian tindak lanjut tersebut otomatis tidak wajib diisi.",
      },
      {
        id: "faq-alur-revisi",
        question: "Di mana pengguna dapat melihat panduan lengkap dan SOP penggunaan SIPETRI?",
        answer:
          "Panduan langkah kerja dan SOP operasional dipisah khusus berdasarkan peran akun agar lebih aman dan fokus. Setelah masuk ke aplikasi, klik ikon profil akun Anda lalu pilih menu Panduan & SOP.",
      },
      {
        id: "faq-tenggat-wib",
        question:
          "Zona waktu apa yang dipakai untuk batas akhir pengumpulan laporan?",
        answer:
          "Seluruh jadwal mulai dan tenggat akhir pengumpulan dihitung berdasarkan kalender resmi Asia/Jakarta (WIB, UTC+07:00) hingga pukul 23:59:59 WIB pada tanggal tenggat.",
      },
    ],
  },
  {
    title: "Pratinjau, Cetak & Penyimpanan",
    items: [
      {
        id: "faq-cetak-excel",
        question:
          "Apakah laporan kinerja di SIPETRI dapat dicetak ke PDF atau diekspor ke spreadsheet?",
        answer:
          "Bisa. Dokumen pelaporan dan dokumen SOP operasional sesuai peran akun masing-masing dilengkapi pratinjau cetak berkop resmi ITPLN untuk disimpan sebagai PDF maupun ekspor data tabel ke spreadsheet.",
      },
      {
        id: "faq-autosave-draf",
        question:
          "Apakah isian formulir tersimpan otomatis jika halaman belum sempat dikirim?",
        answer:
          "Ya. Isi formulir Sasaran Kinerja Tahunan maupun Laporan Triwulan tersimpan otomatis sebagai draf di penyimpanan lokal peramban agar progres unit tidak hilang, dan draf dapat dilanjutkan kembali kapan saja selama periode pelaporan masih aktif.",
      },
    ],
  },
]

export const PORTAL_GOVERNANCE_POINTS = [
  "Prinsip Good University Governance (GUG) dalam pelaporan kinerja tahunan dan triwulan.",
  "Pemetaan pelaporan 42 unit kerja untuk menjaga ketertiban arsip dan pemantauan kinerja.",
  "Catatan pemeriksaan, riwayat revisi, dan status persetujuan terdokumentasi per indikator.",
  "Penegakan tenggat periode berbasis kalender resmi Asia/Jakarta (WIB).",
]

export const PORTAL_GOVERNANCE_FACTS = [
  { label: "Cakupan Organisasi", value: "42 Unit Kerja & Fakultas" },
  { label: "Acuan Tenggat", value: "Kalender Asia/Jakarta (WIB)" },
  { label: "Format Dokumen Resmi", value: "Pratinjau A4 Landscape & Excel" },
]

export const PORTAL_SERVICE_CARDS: PortalServiceCard[] = [
  {
    title: "Perencanaan Sasaran Tahunan (RKA)",
    detail:
      "Penyusunan program kerja tahunan tiap unit kerja yang mencakup kriteria, strategi, sasaran kinerja, dan jadwal bulan pelaksanaan.",
  },
  {
    title: "Pelaporan Realisasi Triwulanan",
    detail:
      "Pencatatan progres capaian Triwulan I hingga Triwulan IV secara periodik lengkap dengan persentase realisasi dan tautan bukti dukung.",
  },
  {
    title: "Penjaminan Mutu & Dokumentasi",
    detail:
      "Proses pemeriksaan terstruktur dengan catatan riwayat yang terdokumentasi per indikator untuk menjaga akuntabilitas laporan.",
  },
  {
    title: "Ketertiban Jadwal WIB & Arsip Resmi",
    detail:
      "Pengendalian periode pelaporan berbasis kalender Asia/Jakarta (WIB) serta arsip cetak berformat resmi Institut Teknologi PLN.",
  },
]
