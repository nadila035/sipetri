import type { HistoryRecord } from "../types/index.ts"
import { formatBulanPelaksanaan, getTriwulanData } from "./format.ts"
import {
  parseSentAtTimestamp,
  reportingUnits,
  resolveOrganization,
} from "./organizations.ts"

function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n")
}

function triggerBlobDownload(filename: string, blob: Blob) {
  if (typeof document === "undefined") return
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function triggerCsvDownload(filename: string, rows: (string | number)[][]) {
  const csv = toCsv(rows)
  triggerBlobDownload(
    filename,
    new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }),
  )
}

export function buildRecordRows(record: HistoryRecord): (string | number)[][] {
  if (record.type === "Sasaran Kinerja") {
    const rows: (string | number)[][] = [
      ["MATRIKS SASARAN KINERJA DAN PROGRAM KERJA"],
      ["ID Dokumen", record.id],
      ["Unit / Bagian", record.unit],
      ["Periode", record.period],
      ["Tanggal Kirim", record.sentAt],
      ["Status", record.status],
      [],
      [
        "No",
        "SASARAN STRATEGIS",
        "PROGRAM KERJA",
        "SASARAN KINERJA",
        "BULAN PELAKSANAAN PROGRAM KERJA",
        "KETERANGAN",
      ],
    ]

    let rowNo = 0
    if (record.criteriaData && record.criteriaData.length > 0) {
      record.criteriaData.forEach((crit) => {
        const strats =
          crit.strategies && crit.strategies.length > 0
            ? crit.strategies
            : crit.strategy
              ? [crit.strategy]
              : []

        strats.forEach((strat) => {
          const stratName = strat.name || crit.name || "-"
          strat.programs.forEach((prog) => {
            const sList =
              prog.sasaranList && prog.sasaranList.length > 0
                ? prog.sasaranList
                : prog.targets.map((t) => ({
                    sasaran: t.sasaran ?? t.target ?? "",
                    bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                    bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                    keterangan: t.keterangan ?? t.notes ?? "",
                  }))

            sList.forEach((sas) => {
              rowNo += 1
              const bulanCell = formatBulanPelaksanaan(
                sas.bulan_mulai,
                sas.bulan_selesai,
              )

              rows.push([
                rowNo,
                stratName,
                prog.name || "-",
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
      rows.push([
        1,
        getVal("Strategi"),
        getVal("Program"),
        getVal("Sasaran"),
        getVal("Bulan"),
        getVal("Keterangan"),
      ])
    }

    return rows
  }

  const triwulanPrograms = getTriwulanData(record)
  const docYear = record.period.match(/\b(\d{4})\b/)?.[1] ?? "2026"
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
      "No",
      "Sasaran Strategis",
      `Program Kerja ${docYear}`,
      "Sasaran",
      "BULAN PELAKSANAAN PROGRAM KERJA",
      "Tahap Pelaksanaan (Uraian)",
      "Realisasi Pelaksanaan (Uraian)",
      "Realisasi Pelaksanaan (%)",
      "Kendala (diisi jika program kerja belum terlaksana)",
      "Rencana Penyelesaian Kendala (diisi jika pencapaian program kerja tidak sesuai dengan rencana)",
      "Waktu Penyelesaian kendala (diisi jika pencapaian program kerja tidak sesuai dengan rencana)",
      "KETERANGAN",
      "Link Evidence",
    ],
  ]

  let rowNo = 0
  triwulanPrograms.forEach((prog) => {
    prog.sasaranList.forEach((sas) => {
      rowNo += 1
      const ketWithLate =
        sas.lateStatus && sas.lateStatus !== "Tepat Waktu"
          ? `[${sas.lateStatus}] ${sas.notes}`
          : sas.notes
      rows.push([
        rowNo,
        sas.strategicGoal || prog.strategicGoal,
        prog.program,
        sas.target,
        sas.month,
        sas.stage,
        sas.realization,
        sas.percentage,
        sas.obstacle,
        sas.solution,
        sas.solutionTime,
        ketWithLate,
        sas.evidence,
      ])
    })
  })

  return rows
}

export function exportRecordExcel(record: HistoryRecord): string {
  const rows = buildRecordRows(record)
  if (record.type === "Sasaran Kinerja") {
    triggerCsvDownload(`${record.id}_Sasaran_Kinerja.csv`, rows)
    return "File Excel Sasaran Kinerja (6 Kolom) berhasil diunduh."
  }
  triggerCsvDownload(`${record.id}_Laporan_Triwulan.csv`, rows)
  return "File Excel Laporan Triwulan (13 Kolom) berhasil diunduh."
}

function buildSummaryIndexRows(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): (string | number)[][] {
  return [
    ["RINGKASAN DAFTAR DOKUMEN ARSIP SIPETRI ITPLN"],
    ["Filter Tahun", yearFilter || "Semua Tahun"],
    [
      "Filter Triwulan",
      quarterFilter ? `Triwulan ${quarterFilter}` : "Semua Periode",
    ],
    ["Jumlah Dokumen", records.length],
    ["Tanggal Unduh", new Date().toLocaleString("id-ID")],
    [],
    [
      "NO",
      "ID DOKUMEN",
      "JENIS DOKUMEN",
      "JUDUL DOKUMEN",
      "PERIODE",
      "UNIT UTAMA",
      "SUB UNIT / BAGIAN",
      "PENANGGUNG JAWAB",
      "TANGGAL KIRIM",
      "STATUS",
      "KELENGKAPAN (%)",
    ],
    ...records.map((r, idx) => {
      const org = resolveOrganization(r)
      return [
        idx + 1,
        r.id,
        r.type,
        r.title,
        r.period,
        org?.parentUnit ?? r.parentUnit ?? r.unit,
        org?.subUnit ?? r.subUnit ?? r.unit,
        r.author || "-",
        r.sentAt,
        r.status,
        `${r.progress}%`,
      ]
    }),
  ]
}

export function exportArchiveRecapExcel(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): string {
  const yearLabel = yearFilter || "Semua_Tahun"
  const quarterLabel = quarterFilter ? `_TW_${quarterFilter}` : ""
  const rows = buildSummaryIndexRows(records, yearFilter, quarterFilter)
  triggerCsvDownload(
    `Ringkasan_Dokumen_SIPETRI_${yearLabel}${quarterLabel}.csv`,
    rows,
  )
  return `Ringkasan Daftar Dokumen (${records.length} dokumen, .csv) berhasil diunduh.`
}

// CRC32 lookup table for standard PKZIP uncompressed archive entries.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export type ZipEntryInput = {
  path: string
  data: string | Uint8Array
}

export function createStoredZipBytes(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder()
  const now = new Date()
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f)
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f)

  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path.replace(/^\/+/, ""))
    const contentBytes =
      typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data
    const sum = crc32(contentBytes)
    const size = contentBytes.length

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(localHeader.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, sum, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(centralHeader.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, sum, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    centralHeader.set(nameBytes, 46)

    localChunks.push(localHeader, contentBytes)
    centralChunks.push(centralHeader)
    offset += localHeader.length + contentBytes.length
  }

  const centralSize = centralChunks.reduce((acc, b) => acc + b.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  const totalLength = offset + centralSize + eocd.length
  const out = new Uint8Array(totalLength)
  let cursor = 0
  for (const chunk of [...localChunks, ...centralChunks, eocd]) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}

function escapeXml(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function excelColumnName(colIndexZero: number): string {
  let index = colIndexZero + 1
  let label = ""
  while (index > 0) {
    const rem = (index - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    index = Math.floor((index - 1) / 26)
  }
  return label
}

type XlsxSheetSpec = {
  name: string
  rows: (string | number)[][]
  headerRowIndexes?: number[]
  titleRowIndexes?: number[]
  colWidths?: number[]
}

function buildWorksheetXml(sheet: XlsxSheetSpec): string {
  const headerSet = new Set(sheet.headerRowIndexes ?? [])
  const titleSet = new Set(sheet.titleRowIndexes ?? [0])
  const colsXml =
    sheet.colWidths && sheet.colWidths.length > 0
      ? `<cols>${sheet.colWidths
          .map(
            (w, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`,
          )
          .join("")}</cols>`
      : ""

  const rowsXml = sheet.rows
    .map((row, rIdx) => {
      const rowNumber = rIdx + 1
      const styleIdx = titleSet.has(rIdx) ? 1 : headerSet.has(rIdx) ? 2 : 3
      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${excelColumnName(cIdx)}${rowNumber}`
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}" s="${styleIdx}"><v>${cell}</v></c>`
          }
          const str = String(cell ?? "")
          return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(str)}</t></is></c>`
        })
        .join("")
      return `<row r="${rowNumber}">${cellsXml}</row>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXml}<sheetData>${rowsXml}</sheetData></worksheet>`
}

export function buildMasterWorkbookBytes(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): Uint8Array {
  const submitted = records.filter((r) => r.status !== "Draf")
  const targetYear =
    yearFilter ||
    submitted[0]?.period.match(/\b(\d{4})\b/)?.[1] ||
    String(new Date().getFullYear())

  const latestStatusFor = (
    subUnit: string,
    matcher: (r: HistoryRecord) => boolean,
  ): HistoryRecord | undefined => {
    const candidates = submitted.filter((r) => {
      const org = resolveOrganization(r)
      const code = org?.subUnit ?? r.subUnit ?? r.unit
      return code === subUnit && matcher(r)
    })
    if (candidates.length === 0) return undefined
    return candidates.reduce((best, cur) =>
      parseSentAtTimestamp(cur.sentAt) > parseSentAtTimestamp(best.sentAt)
        ? cur
        : best,
    )
  }

  const unitSummaryRows: (string | number)[][] = [
    [`REKAP MASTER KEPATUHAN 42 UNIT KERJA ITPLN - TAHUN ${targetYear}`],
    [
      "Filter Tahun",
      yearFilter || `Semua Tahun (Matriks mengacu ${targetYear})`,
      "Filter Triwulan",
      quarterFilter ? `Triwulan ${quarterFilter}` : "Semua Periode",
    ],
    [
      "Total Dokumen Terfilter",
      submitted.length,
      "Waktu Unduh",
      new Date().toLocaleString("id-ID"),
    ],
    [],
    [
      "NO",
      "UNIT UTAMA",
      "SUB UNIT / PELAPOR",
      `SASARAN KINERJA (${targetYear})`,
      `TW I (${targetYear})`,
      `TW II (${targetYear})`,
      `TW III (${targetYear})`,
      `TW IV (${targetYear})`,
      "PENGIRIMAN TERAKHIR",
    ],
    ...reportingUnits.map((u, idx) => {
      const rka = latestStatusFor(
        u.subUnit,
        (r) =>
          r.type === "Sasaran Kinerja" && r.period === `Tahun ${targetYear}`,
      )
      const tw1 = latestStatusFor(
        u.subUnit,
        (r) =>
          r.type === "Laporan Triwulan" &&
          r.period === `Triwulan I · ${targetYear}`,
      )
      const tw2 = latestStatusFor(
        u.subUnit,
        (r) =>
          r.type === "Laporan Triwulan" &&
          r.period === `Triwulan II · ${targetYear}`,
      )
      const tw3 = latestStatusFor(
        u.subUnit,
        (r) =>
          r.type === "Laporan Triwulan" &&
          r.period === `Triwulan III · ${targetYear}`,
      )
      const tw4 = latestStatusFor(
        u.subUnit,
        (r) =>
          r.type === "Laporan Triwulan" &&
          r.period === `Triwulan IV · ${targetYear}`,
      )
      const latestAny = [rka, tw1, tw2, tw3, tw4]
        .filter((x): x is HistoryRecord => Boolean(x))
        .sort(
          (a, b) =>
            parseSentAtTimestamp(b.sentAt) - parseSentAtTimestamp(a.sentAt),
        )[0]
      return [
        idx + 1,
        u.parentUnit,
        u.subUnit,
        rka?.status ?? "Belum Melapor",
        tw1?.status ?? "Belum Melapor",
        tw2?.status ?? "Belum Melapor",
        tw3?.status ?? "Belum Melapor",
        tw4?.status ?? "Belum Melapor",
        latestAny?.sentAt ?? "-",
      ]
    }),
  ]

  const documentRows = buildSummaryIndexRows(
    submitted,
    yearFilter,
    quarterFilter,
  )

  const triwulanDetailRows: (string | number)[][] = [
    ["RINCIAN MASTER LAPORAN REALISASI TRIWULAN (13 KOLOM)"],
    [],
    [
      "ID DOKUMEN",
      "PERIODE",
      "UNIT UTAMA",
      "SUB UNIT",
      "STATUS",
      "NO",
      "SASARAN STRATEGIS",
      "PROGRAM KERJA",
      "SASARAN",
      "BULAN PELAKSANAAN",
      "TAHAP PELAKSANAAN",
      "REALISASI (URAIAN)",
      "REALISASI (%)",
      "KENDALA",
      "RENCANA PENYELESAIAN",
      "WAKTU PENYELESAIAN",
      "STATUS KETERLAMBATAN",
      "KETERANGAN",
      "LINK EVIDENCE",
    ],
  ]

  for (const rec of submitted.filter((r) => r.type === "Laporan Triwulan")) {
    const org = resolveOrganization(rec)
    const progs = getTriwulanData(rec)
    let rNo = 0
    progs.forEach((prog) => {
      prog.sasaranList.forEach((sas) => {
        rNo += 1
        triwulanDetailRows.push([
          rec.id,
          rec.period,
          org?.parentUnit ?? rec.parentUnit ?? rec.unit,
          org?.subUnit ?? rec.subUnit ?? rec.unit,
          rec.status,
          rNo,
          sas.strategicGoal || prog.strategicGoal,
          prog.program,
          sas.target,
          sas.month,
          sas.stage,
          sas.realization,
          sas.percentage,
          sas.obstacle,
          sas.solution,
          sas.solutionTime,
          sas.lateStatus ?? "Tepat Waktu",
          sas.notes,
          sas.evidence,
        ])
      })
    })
  }

  const sasaranDetailRows: (string | number)[][] = [
    ["RINCIAN MASTER SASARAN KINERJA TAHUNAN / RKA (6 KOLOM)"],
    [],
    [
      "ID DOKUMEN",
      "PERIODE",
      "UNIT UTAMA",
      "SUB UNIT",
      "STATUS",
      "SASARAN STRATEGIS",
      "PROGRAM KERJA",
      "SASARAN KINERJA",
      "BULAN PELAKSANAAN",
      "KETERANGAN",
    ],
  ]

  for (const rec of submitted.filter((r) => r.type === "Sasaran Kinerja")) {
    const org = resolveOrganization(rec)
    if (rec.criteriaData && rec.criteriaData.length > 0) {
      rec.criteriaData.forEach((crit) => {
        const strats =
          crit.strategies && crit.strategies.length > 0
            ? crit.strategies
            : crit.strategy
              ? [crit.strategy]
              : []
        strats.forEach((strat) => {
          const goalName = strat.name || crit.name || "-"
          strat.programs.forEach((prog) => {
            const sList =
              prog.sasaranList && prog.sasaranList.length > 0
                ? prog.sasaranList
                : prog.targets.map((t) => ({
                    sasaran: t.sasaran ?? t.target ?? "",
                    bulan_mulai: t.bulan_mulai ?? t.monthStart ?? "",
                    bulan_selesai: t.bulan_selesai ?? t.monthEnd ?? "",
                    keterangan: t.keterangan ?? t.notes ?? "",
                  }))
            sList.forEach((sas) => {
              sasaranDetailRows.push([
                rec.id,
                rec.period,
                org?.parentUnit ?? rec.parentUnit ?? rec.unit,
                org?.subUnit ?? rec.subUnit ?? rec.unit,
                rec.status,
                goalName,
                prog.name,
                sas.sasaran || "-",
                formatBulanPelaksanaan(sas.bulan_mulai, sas.bulan_selesai),
                sas.keterangan || "-",
              ])
            })
          })
        })
      })
    } else {
      const getVal = (lbl: string) =>
        rec.items.find((i) =>
          i.label.toLowerCase().includes(lbl.toLowerCase()),
        )?.value ?? "-"
      sasaranDetailRows.push([
        rec.id,
        rec.period,
        org?.parentUnit ?? rec.parentUnit ?? rec.unit,
        org?.subUnit ?? rec.subUnit ?? rec.unit,
        rec.status,
        getVal("Strategi"),
        getVal("Program"),
        getVal("Sasaran"),
        getVal("Bulan"),
        getVal("Keterangan"),
      ])
    }
  }

  const sheets: XlsxSheetSpec[] = [
    {
      name: "Ringkasan 42 Unit",
      rows: unitSummaryRows,
      titleRowIndexes: [0],
      headerRowIndexes: [4],
      colWidths: [6, 26, 18, 22, 16, 16, 16, 16, 22],
    },
    {
      name: "Daftar Dokumen",
      rows: documentRows,
      titleRowIndexes: [0],
      headerRowIndexes: [6],
      colWidths: [6, 22, 18, 30, 18, 24, 16, 20, 22, 14, 16],
    },
    {
      name: "Rincian Triwulan",
      rows: triwulanDetailRows,
      titleRowIndexes: [0],
      headerRowIndexes: [2],
      colWidths: [20, 16, 22, 14, 12, 10, 28, 28, 18, 28, 28, 14, 24, 24, 18, 20, 28],
    },
    {
      name: "Rincian Sasaran RKA",
      rows: sasaranDetailRows,
      titleRowIndexes: [0],
      headerRowIndexes: [2],
      colWidths: [20, 14, 22, 14, 12, 26, 28, 28, 28, 18, 22],
    },
  ]

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("\n  ")}
</Types>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join("\n    ")}
  </sheets>
</workbook>`

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("\n  ")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><color rgb="FF17213A"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF162A52"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF162A52"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF0F7"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
</styleSheet>`

  const zipEntries: ZipEntryInput[] = [
    { path: "[Content_Types].xml", data: contentTypesXml },
    { path: "_rels/.rels", data: rootRelsXml },
    { path: "xl/workbook.xml", data: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { path: "xl/styles.xml", data: stylesXml },
    ...sheets.map((sheet, idx) => ({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      data: buildWorksheetXml(sheet),
    })),
  ]

  return createStoredZipBytes(zipEntries)
}

export function exportArchiveMasterXlsx(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): string {
  const yearLabel = yearFilter || "Semua_Tahun"
  const quarterLabel = quarterFilter ? `_TW_${quarterFilter}` : ""
  const bytes = buildMasterWorkbookBytes(records, yearFilter, quarterFilter)
  triggerBlobDownload(
    `Rekap_Master_SIPETRI_${yearLabel}${quarterLabel}.xlsx`,
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
  return `Rekap Master Excel (${records.length} dokumen, 4 sheet .xlsx) berhasil diunduh.`
}

function sanitizePathSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/\s+/g, "_")
  return cleaned || "Unit"
}

export function buildUnitPackageZipBytes(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): Uint8Array {
  const submitted = records.filter((r) => r.status !== "Draf")
  const indexCsv = `\ufeff${toCsv(buildSummaryIndexRows(submitted, yearFilter, quarterFilter))}`
  const entries: ZipEntryInput[] = [
    { path: "00_Indeks_Arsip_SIPETRI.csv", data: indexCsv },
  ]

  const seenPaths = new Set<string>(["00_Indeks_Arsip_SIPETRI.csv"])
  for (const rec of submitted) {
    const org = resolveOrganization(rec)
    const parentSegment = sanitizePathSegment(
      org?.parentUnit ?? rec.parentUnit ?? rec.unit,
    )
    const subSegment = sanitizePathSegment(
      org?.subUnit ?? rec.subUnit ?? rec.unit,
    )
    const folder =
      parentSegment === subSegment
        ? parentSegment
        : `${parentSegment}/${subSegment}`
    const docTag =
      rec.type === "Sasaran Kinerja" ? "Sasaran_Kinerja" : "Laporan_Triwulan"
    const baseName = `${sanitizePathSegment(rec.id)}_${docTag}`
    let candidatePath = `${folder}/${baseName}.csv`
    let suffix = 2
    while (seenPaths.has(candidatePath)) {
      candidatePath = `${folder}/${baseName}_${suffix}.csv`
      suffix++
    }
    seenPaths.add(candidatePath)
    entries.push({
      path: candidatePath,
      data: `\ufeff${toCsv(buildRecordRows(rec))}`,
    })
  }

  return createStoredZipBytes(entries)
}

export function exportArchiveUnitZip(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): string {
  const yearLabel = yearFilter || "Semua_Tahun"
  const quarterLabel = quarterFilter ? `_TW_${quarterFilter}` : ""
  const bytes = buildUnitPackageZipBytes(records, yearFilter, quarterFilter)
  triggerBlobDownload(
    `Arsip_Paket_Unit_SIPETRI_${yearLabel}${quarterLabel}.zip`,
    new Blob([bytes as BlobPart], { type: "application/zip" }),
  )
  return `Arsip Paket Unit (${records.length} dokumen dalam folder unit .zip) berhasil diunduh.`
}
