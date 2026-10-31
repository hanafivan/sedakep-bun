import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Halaman Riwayat Cuti telah dikonsolidasikan ke dalam modul Permohonan Cuti (`/leave`).
 * Mengarahkan pengunjung lama secara transparan dengan membawa parameter pencarian dan tab.
 */
export function LeaveHistory() {
  const [searchParams] = useSearchParams();
  const nextParams = new URLSearchParams(searchParams);
  if (!nextParams.has('tab')) {
    nextParams.set('tab', 'history');
  }
  return <Navigate to={`/leave?${nextParams.toString()}`} replace />;
}
