# Follow-up penyederhanaan Dashboard Monitoring

Mode sesi: after. Perbaikan disetujui setelah analisis grafik.

## Perubahan
- Grafik status horizontal menggantikan batang vertikal dan donat yang mengulang kartu status.
- Tren cakupan mempertahankan empat label triwulan; periode mendatang tanpa pengiriman tidak diplot sebagai penurunan ke nol.
- Daftar tindak lanjut memakai status laporan terakhir per pelapor. Lewat tenggat ditentukan dari deadline, bukan dari isian kosong atau status menunggu.
- Matriks pelapor × triwulan menggantikan persentase kelengkapan isian. Status ditulis sebagai teks, bukan warna saja.
- Panel dokumen terbaru tidak lagi diklaim sebagai log verifikasi.
- Preview hanya melihat laporan; keputusan verifikasi tetap melalui alur verifikasi lama.

## Bukti
- Production build berhasil.
- Empat tes organizations.test.mjs lulus (master 22 induk/42 pelapor, isolasi periode, deduplikasi status terakhir, identitas tidak valid).
- Browser: 22 batang kelompok dan 42 baris matriks; tidak ada donat atau heading Monitoring Risiko Kinerja.
- Filter Rektorat menghasilkan 4 batang dan 4 baris; filter status Disetujui tidak menghilangkan baris cakupan.
- Matriks memiliki kolom TW I, II, III, IV.
- Desktop tidak overflow root: clientWidth dan scrollWidth sama-sama 1911 px.
- Screenshot panel baru diperiksa; gaya panel, warna institusi dan tipografi tetap mengikuti dashboard.
- Editor tidak menemukan error pada tiga file yang diubah/ditambahkan.

## Batas validasi
- Data sampel lama belum terpetakan tidak direkayasa menjadi pelapor master.
- Tidak mengirim atau mengubah dokumen tersimpan saat pengujian.
- Skenario visual data positif dan periode masa depan belum diuji end-to-end; logika mempertahankan dokumen yang benar-benar ada walaupun periodenya mendatang.
- npm test masih terhambat sintaks lama pada src/utils/workflow.ts; bukan akibat perubahan dashboard.
