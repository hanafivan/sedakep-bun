import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../App';
import { login, setToken } from '../api';

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('hanafi');
  const [password, setPassword] = useState('password123');
  const [output, setOutput] = useState('Belum ada request.');
  const [status, setStatus] = useState<'' | 'ok' | 'err'>('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setOutput('Memproses...');

    try {
      const result = await login(username, password);
      setToken(result.data.token);
      setStatus('ok');
      setOutput(`Login berhasil. Token disimpan.\n\n${JSON.stringify(result, null, 2)}`);
      navigate('/dashboard');
    } catch (error) {
      setStatus('err');
      setOutput(`Gagal: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Login" sub="Masuk untuk mendapatkan JWT.">
      <form onSubmit={onSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={busy}>
          {busy ? 'Memproses...' : 'Login'}
        </button>
      </form>

      <nav className="nav">
        <Link to="/">Beranda</Link>
        <Link to="/register">Register</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <pre className={status}>{output}</pre>
    </Card>
  );
}
