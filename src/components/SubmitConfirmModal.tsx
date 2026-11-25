import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"

export type SubmitConfirmInfo = {
  title: string
  description: string
  documentTitle: string
  period: string
  unit: string
  summary?: string
  cancelLabel?: string
  confirmLabel?: string
}

type SubmitConfirmModalProps = {
  info: SubmitConfirmInfo | null
  onCancel: () => void
  onConfirm: () => void
}

export function SubmitConfirmModal({
  info,
  onCancel,
  onConfirm,
}: SubmitConfirmModalProps) {
  useDialog(!!info, onCancel, ".submit-confirm-overlay")
  if (!info) return null

  return (
    <div
      className="submit-success-overlay submit-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-confirm-title"
    >
      <div className="submit-success-dialog">
        <div className="submit-confirm-icon" aria-hidden="true">
          <Icon name="help" size={24} />
        </div>
        <h2 id="submit-confirm-title">{info.title}</h2>
        <p>{info.description}</p>

        <dl className="submit-success-meta">
          <div>
            <dt>Dokumen</dt>
            <dd>{info.documentTitle}</dd>
          </div>
          <div>
            <dt>Periode</dt>
            <dd>{info.period}</dd>
          </div>
          <div>
            <dt>Unit / Bagian</dt>
            <dd>{info.unit || "-"}</dd>
          </div>
          {info.summary && (
            <div>
              <dt>Ringkasan</dt>
              <dd>{info.summary}</dd>
            </div>
          )}
        </dl>

        <div className="submit-success-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {info.cancelLabel ?? "Cek Kembali"}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            {info.confirmLabel ?? "Kirim"} <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup konfirmasi pengiriman"
        onClick={onCancel}
      />
    </div>
  )
}

export default SubmitConfirmModal
