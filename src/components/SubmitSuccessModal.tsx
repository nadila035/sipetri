import { useDialog } from "../utils/useDialog"
import { Icon } from "./Icon"

export type SubmitSuccessInfo = {
  title: string
  subtitle: string
  documentTitle: string
  period: string
  unit: string
  sentAt: string
  statusLabel?: string
}

type SubmitSuccessModalProps = {
  info: SubmitSuccessInfo | null
  onClose: () => void
  onViewHistory?: () => void
}

export function SubmitSuccessModal({
  info,
  onClose,
  onViewHistory,
}: SubmitSuccessModalProps) {
  useDialog(!!info, onClose, ".submit-success-overlay")
  if (!info) return null

  return (
    <div
      className="submit-success-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-success-title"
    >
      <button
        type="button"
        className="overlay-close"
        aria-label="Tutup notifikasi"
        onClick={onClose}
      />
      <div className="submit-success-dialog">
        <div className="submit-success-icon" aria-hidden="true">
          <Icon name="check" size={26} />
        </div>
        <h2 id="submit-success-title">{info.title}</h2>
        <p>{info.subtitle}</p>

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
          <div>
            <dt>Waktu Kirim</dt>
            <dd>{info.sentAt}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="status-chip menunggu">
                {info.statusLabel ?? "Menunggu"}
              </span>
            </dd>
          </div>
        </dl>

        <div className="submit-success-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Tutup
          </button>
          {onViewHistory && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onClose()
                onViewHistory()
              }}
            >
              Lihat Riwayat <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SubmitSuccessModal

