import type { HistoryRecord } from "../types"

export function AnnualSourceSummary({ record }: { record: HistoryRecord }) {
  const linked =
    record.triwulanPrograms?.flatMap((p) =>
      p.sasaranList.filter((s) => s.annualSource),
    ) ?? []

  if (!linked.length) return null

  return (
    <section
      aria-label="Keterkaitan sasaran tahunan"
      style={{ overflowWrap: "anywhere" }}
    >
      <h3>Sumber sasaran tahunan</h3>
      <p>Salinan saat impor, bukan status persetujuan terkini.</p>
      {linked.map((s) => (
        <p key={s.id}>
          <strong>{s.target}</strong>: {s.annualSource!.recordId},{" "}
          {s.annualSource!.year}, {s.annualSource!.unit}. Status saat impor:{" "}
          {s.annualSource!.status}. Sasaran sumber: {s.annualSource!.target}.
          Catatan sumber: {s.annualSource!.notes || "Tidak ada"}.
        </p>
      ))}
    </section>
  )
}
