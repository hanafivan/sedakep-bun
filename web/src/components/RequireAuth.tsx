import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

/** Penjaga rute: alihkan ke login bila belum ada sesi. */

export function RequireAuth({ roles }: { roles?: Array<'pegawai' | 'verifikator' | 'atasan' | 'admin'> }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="centered"><p className="sub">Memuat...</p></div>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return (
      <div className="centered">
        <div className="card">
          <h1>Akses ditolak</h1>
          <p className="sub">Peran Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
