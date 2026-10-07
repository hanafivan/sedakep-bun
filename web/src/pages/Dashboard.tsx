import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../App';
import { clearToken, getToken, me, type User } from '../api';

export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [output, setOutput] = useState('Memuat data user...');
  const [status, setStatus] = useState<'' | 'ok' | 'err'>('');
  const [hasToken, setHasToken] = useState(Boolean(getToken()));

  const load = async () => {
    setStatus('');
    setOutput('Memuat...');
    try {
      const result = await me();
      setUser(result.data);
      setStatus('ok');
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setUser(null);
      setStatus('err');
      setOutput(`Gagal: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    if (hasToken) void load();
    else {
      setStatus('err');
      setOutput('Belum ada token. Login dulu di /login');
    }
  }, [hasToken]);

  const onLogout = () => {
    clearToken();
    setHasToken(false);
    setUser(null);
    setStatus('');
    setOutput('Token dihapus.');
  };

  return (
    <Card
      title="Dashboard"
      sub="Memanggil GET /api/v1/users/me memakai token JWT dari localStorage."
    >
      {user ? (
        <p className="sub">
          Login sebagai <strong>{user.username}</strong> ({user.id})
        </p>
      ) : null}

      <button type="button" onClick={() => void load()} disabled={!hasToken}>
        Muat ulang data user
      </button>

      <button type="button" className="secondary" onClick={onLogout} disabled={!hasToken}>
        Hapus token
      </button>

      <nav className="nav">
        <Link to="/">Beranda</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </nav>

      <pre className={status}>{output}</pre>
    </Card>
  );
}
