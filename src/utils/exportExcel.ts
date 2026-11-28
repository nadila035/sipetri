import type { HistoryRecord } from "../types/index.ts"
import {
  computeTableMergeSpans,
  getSasaranKinerjaDisplayRows,
  getTriwulanDisplayRows,
} from "./format.ts"
import {
  parseSentAtTimestamp,
  reportingUnits,
  resolveOrganization,
} from "./organizations.ts"

function triggerBlobDownload(filename: string, blob: Blob) {
  if (typeof document === "undefined") return
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function buildRecordRows(record: HistoryRecord): (string | number)[][] {
  if (record.type === "Sasaran Kinerja") {
    const displayRows = getSasaranKinerjaDisplayRows(record)
    const spans = computeTableMergeSpans(displayRows)
    const rows: (string | number)[][] = [
      ["SASARAN KINERJA INSTITUT TEKNOLOGI PLN", "", "", "", "", ""],
      ["ID Dokumen", record.id, "", "", "", ""],
      ["Unit / Bagian", record.unit, "", "", "", ""],
      ["Periode", record.period, "", "", "", ""],
      ["Tanggal Kirim", record.sentAt, "", "", "", ""],
      ["Status", record.status, "", "", "", ""],
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

    displayRows.forEach((row, idx) => {
      const span = spans[idx]
      rows.push([
        span.noSpan > 0 ? span.groupNumber : "",
        span.goalSpan > 0 ? row.strategicGoal : "",
        span.programSpan > 0 ? row.programName : "",
        row.sasaran,
        row.bulanFormatted,
        row.keterangan,
      ])
    })

    return rows
  }

  const displayRows = getTriwulanDisplayRows(record)
  const spans = computeTableMergeSpans(displayRows)
  const docYear = record.period.match(/\b(\d{4})\b/)?.[1] ?? "2026"
  const emptyTail = Array.from({ length: 11 }, () => "")
  const rows: (string | number)[][] = [
    ["LAPORAN KINERJA TRIWULAN INSTITUT TEKNOLOGI PLN", "", ...emptyTail],
    ["ID Dokumen", record.id, ...emptyTail],
    ["Unit / Bagian", record.unit, ...emptyTail],
    ["Penanggung Jawab", record.author || "-", ...emptyTail],
    ["Periode", record.period, ...emptyTail],
    ["Tanggal Kirim", record.sentAt, ...emptyTail],
    ["Status", record.status, ...emptyTail],
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

  displayRows.forEach((row, idx) => {
    const span = spans[idx]
    const sas = row.sasaran
    const baseNotes = sas.notes && sas.notes !== "-" ? sas.notes : "-"
    const ketWithLate =
      sas.lateStatus && sas.lateStatus !== "Tepat Waktu"
        ? baseNotes === "-"
          ? `[${sas.lateStatus}]`
          : `[${sas.lateStatus}] ${baseNotes}`
        : baseNotes

    rows.push([
      span.noSpan > 0 ? span.groupNumber : "",
      span.goalSpan > 0 ? row.strategicGoal : "",
      span.programSpan > 0 ? row.programName : "",
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

  return rows
}

function buildSummaryIndexRows(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): (string | number)[][] {
  return [
    [
      "RINGKASAN DAFTAR DOKUMEN ARSIP SIPETRI ITPLN",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "Filter Tahun",
      yearFilter || "Semua Tahun",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "Filter Triwulan",
      quarterFilter ? `Triwulan ${quarterFilter}` : "Semua Periode",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    ["Jumlah Dokumen", records.length, "", "", "", "", "", "", "", "", ""],
    [
      "Tanggal Unduh",
      new Date().toLocaleString("id-ID"),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
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

const STYLE = {
  PLAIN: 0,
  TITLE_BANNER: 1,
  HEADER_SLATE: 2,
  BODY_LEFT: 3,
  BODY_CENTER: 4,
  HEADER_FULL_GREEN: 5,
  HEADER_SKY_BLUE: 6,
  HEADER_SOFT_PINK: 7,
  HEADER_SOFT_GREEN: 8,
  HEADER_BRIGHT_YELLOW: 9,
  META_LABEL: 10,
  META_VALUE: 11,
  BODY_MERGED_BOLD: 12,
} as const

type XlsxSheetSpec = {
  name: string
  rows: (string | number)[][]
  headerRowIndexes?: number[]
  titleRowIndexes?: number[]
  metaRowIndexes?: number[]
  colWidths?: number[]
  merges?: string[]
  cellStyles?: Record<string, number>
  rowHeights?: Record<number, number>
}

const WORKBOOK_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="8">
    <font><sz val="10"/><color rgb="FF17213A"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF162A52"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0B190E"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F1E36"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF281120"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0D2211"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1C1900"/><name val="Calibri"/></font>
  </fonts>
  <fills count="10">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF162A52"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF0F7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4ED64E"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9ED9F7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7D4EA"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF93E38D"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF212"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF64748B"/></left>
      <right style="thin"><color rgb="FF64748B"/></right>
      <top style="thin"><color rgb="FF64748B"/></top>
      <bottom style="thin"><color rgb="FF64748B"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF1E293B"/></left>
      <right style="thin"><color rgb="FF1E293B"/></right>
      <top style="thin"><color rgb="FF1E293B"/></top>
      <bottom style="thin"><color rgb="FF1E293B"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="13">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="8" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`

function buildWorksheetXml(sheet: XlsxSheetSpec): string {
  const headerSet = new Set(sheet.headerRowIndexes ?? [])
  const titleSet = new Set(sheet.titleRowIndexes ?? [0])
  const metaSet = new Set(sheet.metaRowIndexes ?? [])
  const cellStyles = sheet.cellStyles ?? {}
  const rowHeights = sheet.rowHeights ?? {}

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
      const customHeight = rowHeights[rIdx]
      const heightAttrs = customHeight
        ? ` ht="${customHeight}" customHeight="1"`
        : titleSet.has(rIdx)
          ? ` ht="28" customHeight="1"`
          : headerSet.has(rIdx)
            ? ` ht="34" customHeight="1"`
            : ""

      if (row.length === 0) {
        return `<row r="${rowNumber}" ht="10" customHeight="1"/>`
      }

      const defaultRowStyle = titleSet.has(rIdx)
        ? STYLE.TITLE_BANNER
        : headerSet.has(rIdx)
          ? STYLE.HEADER_SLATE
          : STYLE.BODY_LEFT

      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${excelColumnName(cIdx)}${rowNumber}`
          let styleIdx = cellStyles[ref]
          if (styleIdx === undefined) {
            if (metaSet.has(rIdx)) {
              styleIdx = cIdx === 0 ? STYLE.META_LABEL : STYLE.META_VALUE
            } else {
              styleIdx = defaultRowStyle
            }
          }
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}" s="${styleIdx}"><v>${cell}</v></c>`
          }
          const str = String(cell ?? "")
          return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(str)}</t></is></c>`
        })
        .join("")
      return `<row r="${rowNumber}"${heightAttrs}>${cellsXml}</row>`
    })
    .join("")

  const merges = sheet.merges ?? []
  const mergesXml =
    merges.length > 0
      ? `<mergeCells count="${merges.length}">${merges
          .map((ref) => `<mergeCell ref="${ref}"/>`)
          .join("")}</mergeCells>`
      : ""

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXml}<sheetData>${rowsXml}</sheetData>${mergesXml}</worksheet>`
}

function packSheetsToXlsxBytes(sheets: XlsxSheetSpec[]): Uint8Array {
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
          `<sheet name="${escapeXml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
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

  const zipEntries: ZipEntryInput[] = [
    { path: "[Content_Types].xml", data: contentTypesXml },
    { path: "_rels/.rels", data: rootRelsXml },
    { path: "xl/workbook.xml", data: workbookXml },
    { path: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { path: "xl/styles.xml", data: WORKBOOK_STYLES_XML },
    ...sheets.map((sheet, idx) => ({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      data: buildWorksheetXml(sheet),
    })),
  ]

  return createStoredZipBytes(zipEntries)
}

export function buildRecordSheetSpec(record: HistoryRecord): XlsxSheetSpec {
  const rows = buildRecordRows(record)
  const cellStyles: Record<string, number> = {}
  const merges: string[] = []

  if (record.type === "Sasaran Kinerja") {
    const displayRows = getSasaranKinerjaDisplayRows(record)
    const spans = computeTableMergeSpans(displayRows)

    merges.push("A1:F1")
    for (let mRow = 2; mRow <= 6; mRow++) {
      merges.push(`B${mRow}:F${mRow}`)
    }

    const headerRowNum = 8
    for (let col = 0; col < 6; col++) {
      cellStyles[`${excelColumnName(col)}${headerRowNum}`] =
        STYLE.HEADER_FULL_GREEN
    }

    const dataStartRowNum = 9
    displayRows.forEach((_, idx) => {
      const excelRow = dataStartRowNum + idx
      const span = spans[idx]

      cellStyles[`A${excelRow}`] = STYLE.BODY_CENTER
      cellStyles[`B${excelRow}`] = STYLE.BODY_MERGED_BOLD
      cellStyles[`C${excelRow}`] = STYLE.BODY_LEFT
      cellStyles[`D${excelRow}`] = STYLE.BODY_LEFT
      cellStyles[`E${excelRow}`] = STYLE.BODY_CENTER
      cellStyles[`F${excelRow}`] = STYLE.BODY_LEFT

      if (span.noSpan > 1) {
        merges.push(`A${excelRow}:A${excelRow + span.noSpan - 1}`)
      }
      if (span.goalSpan > 1) {
        merges.push(`B${excelRow}:B${excelRow + span.goalSpan - 1}`)
      }
      if (span.programSpan > 1) {
        merges.push(`C${excelRow}:C${excelRow + span.programSpan - 1}`)
      }
    })

    return {
      name: "Sasaran Kinerja",
      rows,
      titleRowIndexes: [0],
      metaRowIndexes: [1, 2, 3, 4, 5],
      headerRowIndexes: [7],
      colWidths: [7, 34, 30, 34, 24, 24],
      merges,
      cellStyles,
    }
  }

  const displayRows = getTriwulanDisplayRows(record)
  const spans = computeTableMergeSpans(displayRows)

  merges.push("A1:M1")
  for (let mRow = 2; mRow <= 7; mRow++) {
    merges.push(`B${mRow}:M${mRow}`)
  }

  const headerRowNum = 9
  for (let col = 0; col < 13; col++) {
    const colRef = `${excelColumnName(col)}${headerRowNum}`
    if (col <= 7) {
      cellStyles[colRef] = STYLE.HEADER_SKY_BLUE
    } else if (col <= 10) {
      cellStyles[colRef] = STYLE.HEADER_SOFT_PINK
    } else if (col === 11) {
      cellStyles[colRef] = STYLE.HEADER_SOFT_GREEN
    } else {
      cellStyles[colRef] = STYLE.HEADER_BRIGHT_YELLOW
    }
  }

  const dataStartRowNum = 10
  displayRows.forEach((_, idx) => {
    const excelRow = dataStartRowNum + idx
    const span = spans[idx]

    cellStyles[`A${excelRow}`] = STYLE.BODY_CENTER
    cellStyles[`B${excelRow}`] = STYLE.BODY_MERGED_BOLD
    cellStyles[`E${excelRow}`] = STYLE.BODY_CENTER
    cellStyles[`H${excelRow}`] = STYLE.BODY_CENTER
    cellStyles[`K${excelRow}`] = STYLE.BODY_CENTER

    if (span.noSpan > 1) {
      merges.push(`A${excelRow}:A${excelRow + span.noSpan - 1}`)
    }
    if (span.goalSpan > 1) {
      merges.push(`B${excelRow}:B${excelRow + span.goalSpan - 1}`)
    }
    if (span.programSpan > 1) {
      merges.push(`C${excelRow}:C${excelRow + span.programSpan - 1}`)
    }
  })

  return {
    name: "Laporan Triwulan",
    rows,
    titleRowIndexes: [0],
    metaRowIndexes: [1, 2, 3, 4, 5, 6],
    headerRowIndexes: [8],
    colWidths: [6, 30, 28, 28, 22, 28, 28, 16, 24, 26, 20, 22, 28],
    merges,
    cellStyles,
  }
}

export function buildSingleRecordWorkbookBytes(
  record: HistoryRecord,
): Uint8Array {
  return packSheetsToXlsxBytes([buildRecordSheetSpec(record)])
}

export function exportRecordExcel(record: HistoryRecord): string {
  const bytes = buildSingleRecordWorkbookBytes(record)
  const safeId = sanitizePathSegment(record.id)
  const suffix =
    record.type === "Sasaran Kinerja" ? "Sasaran_Kinerja" : "Laporan_Triwulan"
  triggerBlobDownload(
    `${safeId}_${suffix}.xlsx`,
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
  return record.type === "Sasaran Kinerja"
    ? "File Excel Sasaran Kinerja (.xlsx · 6 Kolom Resmi + Merge Sel) berhasil diunduh."
    : "File Excel Laporan Triwulan (.xlsx · 13 Kolom Resmi + Merge Sel) berhasil diunduh."
}

export function exportArchiveRecapExcel(
  records: HistoryRecord[],
  yearFilter: string,
  quarterFilter: string,
): string {
  const yearLabel = yearFilter || "Semua_Tahun"
  const quarterLabel = quarterFilter ? `_TW_${quarterFilter}` : ""
  const rows = buildSummaryIndexRows(records, yearFilter, quarterFilter)
  const sheet: XlsxSheetSpec = {
    name: "Daftar Dokumen",
    rows,
    titleRowIndexes: [0],
    metaRowIndexes: [1, 2, 3, 4],
    headerRowIndexes: [6],
    colWidths: [6, 24, 18, 32, 18, 24, 16, 20, 22, 14, 16],
    merges: ["A1:K1", "B2:K2", "B3:K3", "B4:K4", "B5:K5"],
  }
  const bytes = packSheetsToXlsxBytes([sheet])
  triggerBlobDownload(
    `Ringkasan_Dokumen_SIPETRI_${yearLabel}${quarterLabel}.xlsx`,
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
  return `Ringkasan Daftar Dokumen (${records.length} dokumen, .xlsx) berhasil diunduh.`
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
    [
      `REKAP MASTER KEPATUHAN 42 UNIT KERJA ITPLN - TAHUN ${targetYear}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "Filter Tahun",
      yearFilter || `Semua Tahun (Matriks mengacu ${targetYear})`,
      "Filter Triwulan",
      quarterFilter ? `Triwulan ${quarterFilter}` : "Semua Periode",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "Total Dokumen Terfilter",
      submitted.length,
      "Waktu Unduh",
      new Date().toLocaleString("id-ID"),
      "",
      "",
      "",
      "",
      "",
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
    [
      "RINCIAN MASTER LAPORAN REALISASI TRIWULAN (13 KOLOM RESMI)",
      ...Array.from({ length: 18 }, () => ""),
    ],
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

  const triwulanMerges: string[] = ["A1:S1"]
  const triwulanCellStyles: Record<string, number> = {}
  for (let col = 0; col < 19; col++) {
    const ref = `${excelColumnName(col)}3`
    if (col >= 5 && col <= 12) {
      triwulanCellStyles[ref] = STYLE.HEADER_SKY_BLUE
    } else if (col >= 13 && col <= 15) {
      triwulanCellStyles[ref] = STYLE.HEADER_SOFT_PINK
    } else if (col >= 16 && col <= 17) {
      triwulanCellStyles[ref] = STYLE.HEADER_SOFT_GREEN
    } else if (col === 18) {
      triwulanCellStyles[ref] = STYLE.HEADER_BRIGHT_YELLOW
    }
  }

  for (const rec of submitted.filter((r) => r.type === "Laporan Triwulan")) {
    const org = resolveOrganization(rec)
    const displayRows = getTriwulanDisplayRows(rec)
    const spans = computeTableMergeSpans(displayRows)
    const startExcelRow = triwulanDetailRows.length + 1

    if (displayRows.length > 1) {
      const endDocRow = startExcelRow + displayRows.length - 1
      for (const colLetter of ["A", "B", "C", "D", "E"]) {
        triwulanMerges.push(`${colLetter}${startExcelRow}:${colLetter}${endDocRow}`)
      }
    }

    displayRows.forEach((row, idx) => {
      const excelRow = startExcelRow + idx
      const span = spans[idx]
      const sas = row.sasaran
      triwulanCellStyles[`F${excelRow}`] = STYLE.BODY_CENTER
      triwulanCellStyles[`G${excelRow}`] = STYLE.BODY_MERGED_BOLD
      triwulanCellStyles[`J${excelRow}`] = STYLE.BODY_CENTER
      triwulanCellStyles[`M${excelRow}`] = STYLE.BODY_CENTER

      if (span.noSpan > 1) {
        triwulanMerges.push(`F${excelRow}:F${excelRow + span.noSpan - 1}`)
      }
      if (span.goalSpan > 1) {
        triwulanMerges.push(`G${excelRow}:G${excelRow + span.goalSpan - 1}`)
      }
      if (span.programSpan > 1) {
        triwulanMerges.push(`H${excelRow}:H${excelRow + span.programSpan - 1}`)
      }

      triwulanDetailRows.push([
        idx === 0 ? rec.id : "",
        idx === 0 ? rec.period : "",
        idx === 0 ? (org?.parentUnit ?? rec.parentUnit ?? rec.unit) : "",
        idx === 0 ? (org?.subUnit ?? rec.subUnit ?? rec.unit) : "",
        idx === 0 ? rec.status : "",
        span.noSpan > 0 ? span.groupNumber : "",
        span.goalSpan > 0 ? row.strategicGoal : "",
        span.programSpan > 0 ? row.programName : "",
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
  }

  const sasaranDetailRows: (string | number)[][] = [
    [
      "RINCIAN MASTER SASARAN KINERJA TAHUNAN / RKA (6 KOLOM RESMI)",
      ...Array.from({ length: 10 }, () => ""),
    ],
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
      "SASARAN KINERJA",
      "BULAN PELAKSANAAN",
      "KETERANGAN",
    ],
  ]

  const sasaranMerges: string[] = ["A1:K1"]
  const sasaranCellStyles: Record<string, number> = {}
  for (let col = 5; col <= 10; col++) {
    sasaranCellStyles[`${excelColumnName(col)}3`] = STYLE.HEADER_FULL_GREEN
  }

  for (const rec of submitted.filter((r) => r.type === "Sasaran Kinerja")) {
    const org = resolveOrganization(rec)
    const displayRows = getSasaranKinerjaDisplayRows(rec)
    const spans = computeTableMergeSpans(displayRows)
    const startExcelRow = sasaranDetailRows.length + 1

    if (displayRows.length > 1) {
      const endDocRow = startExcelRow + displayRows.length - 1
      for (const colLetter of ["A", "B", "C", "D", "E"]) {
        sasaranMerges.push(`${colLetter}${startExcelRow}:${colLetter}${endDocRow}`)
      }
    }

    displayRows.forEach((row, idx) => {
      const excelRow = startExcelRow + idx
      const span = spans[idx]
      sasaranCellStyles[`F${excelRow}`] = STYLE.BODY_CENTER
      sasaranCellStyles[`G${excelRow}`] = STYLE.BODY_MERGED_BOLD
      sasaranCellStyles[`J${excelRow}`] = STYLE.BODY_CENTER

      if (span.noSpan > 1) {
        sasaranMerges.push(`F${excelRow}:F${excelRow + span.noSpan - 1}`)
      }
      if (span.goalSpan > 1) {
        sasaranMerges.push(`G${excelRow}:G${excelRow + span.goalSpan - 1}`)
      }
      if (span.programSpan > 1) {
        sasaranMerges.push(`H${excelRow}:H${excelRow + span.programSpan - 1}`)
      }

      sasaranDetailRows.push([
        idx === 0 ? rec.id : "",
        idx === 0 ? rec.period : "",
        idx === 0 ? (org?.parentUnit ?? rec.parentUnit ?? rec.unit) : "",
        idx === 0 ? (org?.subUnit ?? rec.subUnit ?? rec.unit) : "",
        idx === 0 ? rec.status : "",
        span.noSpan > 0 ? span.groupNumber : "",
        span.goalSpan > 0 ? row.strategicGoal : "",
        span.programSpan > 0 ? row.programName : "",
        row.sasaran,
        row.bulanFormatted,
        row.keterangan,
      ])
    })
  }

  const sheets: XlsxSheetSpec[] = [
    {
      name: "Ringkasan 42 Unit",
      rows: unitSummaryRows,
      titleRowIndexes: [0],
      headerRowIndexes: [4],
      colWidths: [6, 26, 18, 22, 16, 16, 16, 16, 22],
      merges: ["A1:I1"],
    },
    {
      name: "Daftar Dokumen",
      rows: documentRows,
      titleRowIndexes: [0],
      metaRowIndexes: [1, 2, 3, 4],
      headerRowIndexes: [6],
      colWidths: [6, 22, 18, 30, 18, 24, 16, 20, 22, 14, 16],
      merges: ["A1:K1", "B2:K2", "B3:K3", "B4:K4", "B5:K5"],
    },
    {
      name: "Rincian Triwulan",
      rows: triwulanDetailRows,
      titleRowIndexes: [0],
      headerRowIndexes: [2],
      colWidths: [
        20, 16, 22, 14, 12, 6, 30, 28, 28, 20, 28, 28, 14, 24, 24, 18, 18, 20,
        28,
      ],
      merges: triwulanMerges,
      cellStyles: triwulanCellStyles,
    },
    {
      name: "Rincian Sasaran RKA",
      rows: sasaranDetailRows,
      titleRowIndexes: [0],
      headerRowIndexes: [2],
      colWidths: [20, 14, 22, 14, 12, 6, 32, 28, 30, 20, 22],
      merges: sasaranMerges,
      cellStyles: sasaranCellStyles,
    },
  ]

  return packSheetsToXlsxBytes(sheets)
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
  return `Rekap Master Excel (${records.length} dokumen, 4 sheet .xlsx + Merge Sel) berhasil diunduh.`
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
  const indexSheet: XlsxSheetSpec = {
    name: "Indeks Arsip",
    rows: buildSummaryIndexRows(submitted, yearFilter, quarterFilter),
    titleRowIndexes: [0],
    metaRowIndexes: [1, 2, 3, 4],
    headerRowIndexes: [6],
    colWidths: [6, 24, 18, 32, 18, 24, 16, 20, 22, 14, 16],
    merges: ["A1:K1", "B2:K2", "B3:K3", "B4:K4", "B5:K5"],
  }
  const entries: ZipEntryInput[] = [
    {
      path: "00_Indeks_Arsip_SIPETRI.xlsx",
      data: packSheetsToXlsxBytes([indexSheet]),
    },
  ]

  const seenPaths = new Set<string>(["00_Indeks_Arsip_SIPETRI.xlsx"])
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
    let candidatePath = `${folder}/${baseName}.xlsx`
    let suffix = 2
    while (seenPaths.has(candidatePath)) {
      candidatePath = `${folder}/${baseName}_${suffix}.xlsx`
      suffix++
    }
    seenPaths.add(candidatePath)
    entries.push({
      path: candidatePath,
      data: buildSingleRecordWorkbookBytes(rec),
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
  return `Arsip Paket Unit (${records.length} dokumen .xlsx dalam folder unit .zip) berhasil diunduh.`
}
