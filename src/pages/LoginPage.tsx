import { useRef, useState } from "react"
import { useAuth } from "../AuthContext"
import { Icon } from "../components/Icon"
import { useLoginMotion } from "../utils/useMotion"

export function LoginPage({
  onBackToPortal,
}: {
  onBackToPortal?: () => void
}) {
  const { login } = useAuth()
  const rootRef = useRef<HTMLDivElement>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useLoginMotion(rootRef)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      const result = await login(username, password)
      if (!result.ok) {
        setError(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page" ref={rootRef}>
      <div className="login-shell">
        <section className="login-brand-panel" aria-label="Kampus ITPLN">
          <img
            className="login-campus-photo"
            src="/gedung-itpln.jpg"
            alt="Gedung Kampus Institut Teknologi PLN"
          />
          <div className="login-brand-scrim" aria-hidden="true" />
          <div className="login-brand-overlay">
            <h1 className="login-portal-title">SISTEM PELAPORAN KINERJA</h1>
            <p className="login-campus-caption">
              INSTITUT TEKNOLOGI PERUSAHAAN LISTRIK NEGARA
            </p>
          </div>
        </section>

        <section className="login-form-panel" aria-label="Formulir Masuk">
          {onBackToPortal && (
            <button
              type="button"
              className="login-back-portal"
              onClick={onBackToPortal}
            >
              <Icon name="arrowLeft" size={16} />
              <span>Beranda</span>
            </button>
          )}
          <div className="login-form-head">
            <h2>Masuk Akun</h2>
            <p>
              Masukkan username admin atau Unit beserta kata sandi Anda.
            </p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <span aria-hidden="true">!</span>
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field" htmlFor="login-username">
              <span>Username</span>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label className="login-field" htmlFor="login-password">
              <span>Kata Sandi</span>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  aria-pressed={showPassword}
                  title={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="primary-button login-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Memeriksa..." : "Masuk"}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default LoginPage
