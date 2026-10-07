import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../App';
import { register } from '../api';

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [output, setOutput] = useState('Belum ada request.');
  const [status, setStatus] = useState<'' | 'ok' | 'err'>('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setOutput('Memproses...');

    try {
      const result = await register(username, password);
      setStatus('ok');
      setOutput(`Berhasil daftar. Silakan login.\n\n${JSON.stringify(result, null, 2)}`);
      setUsername('');
      setPassword('');
    } catch (error) {
      setStatus('err');
      setOutput(`Gagal: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Register" sub="Minimal 3 karakter username, 6 karakter password.">
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
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={busy}>
          {busy ? 'Memproses...' : 'Daftar'}
        </button>
      </form>

      <nav className="nav">
        <Link to="/">Beranda</Link>
        <Link to="/login">Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <pre className={status}>{output}</pre>
    </Card>
  );
}
