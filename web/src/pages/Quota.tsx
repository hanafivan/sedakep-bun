import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, QuotaCard } from '../components/Layout';
import { decisionLabel, formatDate } from '../format';
import { useAuth } from '../auth';
import * as api from '../api';

/** Halaman kuota: saldo official/reserved/available, histori, dan rebuild. */

export function Quota() {
  const now = new Date().getFullYear();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [year, setYear] = useState(now);
  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [stored, setStored] = useState<api.StoredQuota[]>([]);
  const [history, setHistory] = useState<api.QuotaAudit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (targetYear: number) => {
    setError(null);
    try {
      const [quotaData, storedData, historyData] = await Promise.all([
        api.getQuota(targetYear),
        api.getStoredQuotas(),
        api.getQuotaHistory(targetYear),
      ]);
      setQuota(quotaData);
      setStored(storedData.filter((row) => Number(row.year) === targetYear));
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kuota');
    }
  };

  useEffect(() => {
    void load(year);
  }, [year]);

  const rebuild = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await api.rebuildQuota({ year, all_users: true });
      await load(year);
      setNotice(`Projection kuota ${year} berhasil dibangun ulang.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Kuota Cuti" sub="Saldo resmi, sisa tersimpan, dan riwayat perubahan">
      <div className="toolbar">
        <label htmlFor="year">Tahun</label>
        <input
          id="year"
          className="year"
          type="number"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        />
        {isAdmin ? (
          <button className="button secondary" type="button" disabled={busy} onClick={rebuild}>
            {busy ? 'Membangun...' : 'Rebuild projection semua pegawai'}
          </button>
        ) : null}
        <Link className="button" to="/quota/print/me">
          Cetak buku cuti
        </Link>
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {quota ? (
        <>
          <div className="stats">
            <QuotaCard label="Official N" value={quota.official.n} hint="jatah tahun berjalan" />
            <QuotaCard label="Official N-1" value={quota.official.n1} hint="carry-over tahun lalu" />
            <QuotaCard label="Official N-2" value={quota.official.n2} hint="carry-over dua tahun lalu" />
            <QuotaCard label="Available" value={quota.available.total} hint="setelah dikurangi terpesan" tone="ok" />
            <QuotaCard label="Reserved" value={quota.reserved_days} hint={`${quota.reserved_count} permohonan`} tone={quota.reserved_days > 0 ? 'warn' : undefined} />
          </div>

          <p className="sub">
            Status kelayakan: {quota.eligibility.eligible ? 'memenuhi syarat' : quota.eligibility.reason}
            {quota.eligibility.is_pppk ? ' · PPPK' : ''}
          </p>
        </>
      ) : null}

      <div className="split">
        <div className="panel">
          <h2>Projection tersimpan</h2>
          <p className="sub">Angka hasil rebuild yang dipakai halaman daftar; bukan hitungan live.</p>
          {stored.length === 0 ? (
            <p className="sub">Belum ada projection untuk tahun ini.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tahun</th>
                    <th>Sisa N</th>
                    <th>Sisa N-1</th>
                    <th>Sisa N-2</th>
                    <th>Total</th>
                    <th>Terpesan</th>
                    <th>Dibangun</th>
                  </tr>
                </thead>
                <tbody>
                  {stored.map((row) => (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{row.remaining_n}</td>
                      <td>{row.remaining_n1}</td>
                      <td>{row.remaining_n2}</td>
                      <td><strong>{row.total_remaining}</strong></td>
                      <td>{row.reserved_days}</td>
                      <td>{row.computed_at ? formatDate(row.computed_at) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Riwayat perubahan</h2>
          {history.length === 0 ? (
            <p className="sub">Belum ada catatan audit.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Aksi</th>
                    <th>Selisih</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 20).map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td><span className="badge">{decisionLabel(row.action)}</span></td>
                      <td><strong>{row.difference ?? '-'}</strong></td>
                      <td>{row.reason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <p className="sub">
        Butuh detail per pegawai? Buka <Link to="/leave">daftar permohonan</Link> lalu pilih baris.
      </p>
    </Page>
  );
}
