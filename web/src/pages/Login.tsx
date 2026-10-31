import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

/** Halaman masuk. */

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="centered">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-badge">PTSP KEMENAG SLEMAN</div>
          <h1>Sedakep</h1>
          <p className="sub">Sistem Layanan Administrasi Kepegawaian</p>
        </div>

        <div className="form-group">
          <label htmlFor="username">Username / NIP</label>
          <input
            id="username"
            placeholder="Masukkan username atau NIP"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Kata Sandi</label>
          <input
            id="password"
            type="password"
            placeholder="Masukkan kata sandi"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <p className="err login-err">{error}</p> : null}

        <button className="login-submit" type="submit" disabled={busy || !username || !password}>
          {busy ? 'Memverifikasi...' : 'Masuk ke Sistem'}
        </button>

        <div className="demo-accounts">
          <div className="demo-accounts-title">Isi otomatis akun simulasi:</div>
          <div className="demo-chips">
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setUsername('admin.sedakep');
                setPassword('demo1234');
              }}
            >
              Admin
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setUsername('atasan.sedakep');
                setPassword('demo1234');
              }}
            >
              Atasan
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                setUsername('pegawai.sedakep');
                setPassword('demo1234');
              }}
            >
              Pegawai
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
