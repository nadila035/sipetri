import type { HistoryRecord } from "../types"
import { formatBulanPelaksanaan, getTriwulanData } from "./format"

function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n")
}

function triggerCsvDownload(filename: string, rows: (string | number)[][]) {
  const csv = toCsv(rows)
  const url = URL.createObjectURL(
    new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportRecordExcel(record: HistoryRecord): string {
  if (record.type === "Sasaran Kinerja") {
    const rows: (string | number)[][] = [
      ["MATRIKS SASARAN KINERJA DAN PROGRAM KERJA"],
      ["Unit / Bagian", record.unit],
      ["Periode", record.period],
      ["Tanggal Kirim", record.sentAt],
      ["Status", record.status],
      [],
      [
        "NO",
        "STRATEGI",
        "",
        "PROGRAM KERJA",
        "SASARAN",
        "BULAN PELAKSANAAN PROGRAM KERJA",
        "KETERANGAN",
      ],
      ["1", "2", "3", "4", "5", "6", "7"],
    ]

    if (record.criteriaData && record.criteriaData.length > 0) {
      record.criteriaData.forEach((crit, cIdx) => {
        rows.push([cIdx + 1, crit.name, "", "", "", "", ""])

        const strats =
          crit.strategies && crit.strategies.length > 0
            ? crit.strategies
            : crit.strategy
              ? [crit.strategy]
              : []

        strats.forEach((strat, sIdx) => {
          const stratNum = `${cIdx + 1}.${sIdx + 1}`
          strat.programs.forEach((prog, pIdx) => {
            const progNum = `${stratNum}.${pIdx + 1}`
            const sList =
              prog.sasaranList && prog.sasaranList.length > 0
                ? prog.sasaranList
                : prog.targets.map((t) => ({
                    sasaran: t.sasaran ?? t.target ?? "",
                    bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                    bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                    keterangan: t.keterangan ?? t.notes ?? "",
                  }))

            sList.forEach((sas, sasIdx) => {
              const stratNoCell = pIdx === 0 && sasIdx === 0 ? stratNum : ""
              const stratNameCell =
                pIdx === 0 && sasIdx === 0 ? strat.name : ""
              const progNoCell = sasIdx === 0 ? progNum : ""
              const progNameCell = sasIdx === 0 ? prog.name : ""
              const bulanCell = formatBulanPelaksanaan(
                sas.bulan_mulai,
                sas.bulan_selesai,
              )

              rows.push([
                stratNoCell,
                stratNameCell,
                progNoCell,
                progNameCell,
                sas.sasaran || "-",
                bulanCell,
                sas.keterangan || "-",
              ])
            })
          })
        })
      })
    } else {
      const getVal = (lbl: string) =>
        record.items.find((i) =>
          i.label.toLowerCase().includes(lbl.toLowerCase()),
        )?.value ?? "-"
      rows.push([1, getVal("Kriteria"), "", "", "", "", ""])
      rows.push([
        "1.1",
        getVal("Strategi"),
        "1.1.1",
        getVal("Program"),
        getVal("Sasaran"),
        getVal("Bulan"),
        getVal("Keterangan"),
      ])
    }

    triggerCsvDownload(`${record.id}_Sasaran_Kinerja.csv`, rows)
    return "File Excel Sasaran Kinerja (7 Kolom) berhasil diunduh."
  }

  const triwulanPrograms = getTriwulanData(record)
  const rows: (string | number)[][] = [
    ["LAPORAN KINERJA TRIWULAN"],
    ["ID Dokumen", record.id],
    ["Unit / Bagian", record.unit],
    ["Penanggung Jawab", record.author || "-"],
    ["Periode", record.period],
    ["Tanggal Kirim", record.sentAt],
    ["Status", record.status],
    [],
    [
      "NO",
      "PROGRAM KERJA",
      "SASARAN",
      "BULAN PELAKSANAAN PROGRAM KERJA",
      "TAHAP PELAKSANAAN (URAIAN)",
      "REALISASI PELAKSANAAN (URAIAN)",
      "REALISASI PELAKSANAAN (%)",
      "KENDALA",
      "RENCANA PENYELESAIAN KENDALA",
      "WAKTU PENYELESAIAN KENDALA",
      "KETERANGAN",
      "LINK EVIDENCE",
    ],
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  ]

  triwulanPrograms.forEach((prog, pIdx) => {
    prog.sasaranList.forEach((sas, sIdx) => {
      rows.push([
        sIdx === 0 ? pIdx + 1 : "",
        sIdx === 0 ? prog.program : "",
        sas.target,
        sas.month,
        sas.stage,
        sas.realization,
        sas.percentage,
        sas.obstacle,
        sas.solution,
        sas.solutionTime,
        sas.notes,
        sas.evidence,
      ])
    })
  })

  triggerCsvDownload(`${record.id}_Laporan_Triwulan.csv`, rows)
  return "File Excel Laporan Triwulan (12 Kolom) berhasil diunduh."
}

export function exportArchiveRecapExcel(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): string {
  const yearLabel = yearFilter || "Semua_Tahun"
  const quarterLabel = quarterFilter ? `_TW_${quarterFilter}` : ""
  const rows: (string | number)[][] = [
    ["REKAPITULASI ARSIP PELAPORAN"],
    ["Filter Tahun", yearFilter || "Semua Tahun"],
    ["Filter Triwulan", quarterFilter ? `Triwulan ${quarterFilter}` : "Semua Periode"],
    ["Jumlah Dokumen", records.length],
    ["Tanggal Unduh", new Date().toLocaleString("id-ID")],
    [],
    [
      "NO",
      "ID DOKUMEN",
      "JENIS DOKUMEN",
      "JUDUL DOKUMEN",
      "PERIODE",
      "UNIT / BAGIAN",
      "PENANGGUNG JAWAB",
      "TANGGAL KIRIM",
      "STATUS",
      "KELENGKAPAN (%)",
    ],
    ...records.map((r, idx) => [
      idx + 1,
      r.id,
      r.type,
      r.title,
      r.period,
      r.unit,
      r.author || "-",
      r.sentAt,
      r.status,
      `${r.progress}%`,
    ]),
  ]

  triggerCsvDownload(`Arsip_Pelaporan_${yearLabel}${quarterLabel}.csv`, rows)
  return `Rekap arsip (${records.length} dokumen) berhasil diunduh.`
}

