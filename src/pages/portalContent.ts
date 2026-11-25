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
  kind: "login" | "external" | "mailto" | "tel" | "modal-guide" | "modal-units"
  href?: string
  guideTab?: "staff" | "admin"
  icon: "globe" | "lock" | "report" | "grid" | "mail" | "phone"
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
    id: "panduan-staf",
    title: "Panduan Pelaporan Staf",
    description:
      "Alur pengisian RKA, impor program triwulan, dan tindak lanjut revisi",
    delayMs: 50,
    kind: "modal-guide",
    guideTab: "staff",
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
          "Bagaimana cara masuk ke SIPETRI untuk unit kerja dan Admin PRP?",
        answer:
          'Klik tombol Masuk Aplikasi pada halaman ini untuk menuju gerbang login. Gunakan username "unit" untuk masuk ke ruang kerja pelaporan unit atau "admin" untuk membuka pusat kendali Admin PRP beserta kata sandi Anda.',
      },
      {
        id: "faq-isolasi-data",
        question: "Bagaimana pemilihan unit saat mengisi laporan di ruang kerja staf?",
        answer:
          "Saat mengisi Sasaran Kinerja atau Laporan Triwulan, Anda dapat langsung memilih Unit Utama dan Sub Unit dari daftar resmi 42 unit kerja ITPLN, sementara Admin PRP bertugas memantau dan memverifikasi seluruh kiriman.",
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
        question: "Bagaimana alur perbaikan jika dokumen berstatus Revisi?",
        answer:
          "Jika Admin PRP mengembalikan dokumen dengan catatan per indikator, staf akan menerima pemberitahuan di ikon lonceng dan dapat membuka menu Riwayat. Klik Perbaiki pada dokumen berstatus Revisi untuk memperbarui isian sambil melihat catatan pemeriksa, lalu kirim ulang selama periode masih dibuka.",
      },
      {
        id: "faq-tenggat-wib",
        question:
          "Zona waktu apa yang dipakai untuk batas akhir pengumpulan laporan?",
        answer:
          "Seluruh jadwal mulai dan tenggat akhir pengumpulan dihitung secara ketat berdasarkan kalender Asia/Jakarta (WIB, UTC+07:00). Pengumpulan baru diperbolehkan hingga pukul 23:59:59 WIB pada tanggal tenggat yang ditetapkan oleh Admin PRP.",
      },
    ],
  },
  {
    title: "Pratinjau, Cetak & Penyimpanan",
    items: [
      {
        id: "faq-cetak-excel",
        question:
          "Apakah laporan di SIPETRI dapat dicetak ke PDF atau diekspor ke Excel?",
        answer:
          "Bisa. Sebelum maupun sesudah pengiriman, pengguna dapat membuka Pratinjau Cetak resmi berformat A4 Landscape lengkap dengan kop surat ITPLN dan kolom tanda tangan untuk disimpan sebagai PDF, serta mengekspor rincian laporan ke berkas Excel.",
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

export const PORTAL_GUIDE_STEPS = {
  staff: [
    {
      title: "1. Sasaran Kinerja Tahunan (RKA)",
      detail:
        "Lengkapi target program dan sasaran kerja pada menu Isi Sasaran Kinerja, lalu pilih Unit Utama dan Sub Unit / Bagian pada formulir.",
    },
    {
      title: "2. Laporan Realisasi Triwulan",
      detail:
        "Isi realisasi setiap triwulan atau impor langsung program dari Sasaran Kinerja. Realisasi di bawah 100% wajib melengkapi Kendala, Rencana Penyelesaian, dan Waktu Penyelesaian.",
    },
    {
      title: "3. Pratinjau & Konfirmasi Kirim",
      detail:
        "Periksa kembali hasil input pada tampilan Pratinjau sebelum mengirim dokumen secara permanen ke antrean verifikasi Admin PRP.",
    },
    {
      title: "4. Notifikasi & Perbaikan Revisi",
      detail:
        "Pantau lonceng notifikasi dan buka menu Riwayat. Dokumen berstatus Revisi dapat diperbarui melalui tombol Perbaiki selama periode pelaporan masih dibuka.",
    },
  ],
  admin: [
    {
      title: "1. Pemantauan Kepatuhan Unit",
      detail:
        "Buka Dashboard Monitoring untuk melihat progres pelaporan seluruh 42 unit kerja dan memfilter status dokumen per periode.",
    },
    {
      title: "2. Verifikasi & Catatan Revisi",
      detail:
        "Masuk ke Verifikasi Laporan Triwulan atau Verifikasi Sasaran Kinerja. Saat meminta revisi, tulis catatan pada indikator terkait agar langsung terbaca oleh unit.",
    },
    {
      title: "3. Pengaturan Periode & Tenggat",
      detail:
        "Kelola tanggal mulai, tenggat akhir, serta status buka/tutup pengumpulan pada Periode dan Tenggat Waktu. Perubahan jadwal otomatis memberi notifikasi ke seluruh unit.",
    },
    {
      title: "4. Arsip & Ekspor Rekapitulasi",
      detail:
        "Gunakan Arsip dan Rekapitulasi untuk meninjau riwayat lintas tahun, mencetak pratinjau resmi, atau mengekspor rekap Excel.",
    },
  ],
}
