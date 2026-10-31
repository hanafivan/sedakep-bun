import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Daftar surat keterangan cuti.
 *
 * Satu tabel `leave_letters` melayani dua jenis surat legacy: `suket`
 * (surat keterangan biasa, punya nomor) dan `suket_madrasah` (hanya berkas SK).
 * Halaman ini tidak menghitung apa pun — semua nomor dan tanggal berasal dari API.
 */

const LETTER_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua jenis' },
  { value: 'suket', label: 'Surat keterangan (SK)' },
  { value: 'suket_madrasah', label: 'SK madrasah' },
];

const PER_PAGE = 25;

export function LettersPanel() {
  const [letterType, setLetterType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<api.LeaveLetter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listLetters({
        letter_type: letterType || undefined,
        search: search || undefined,
        page,
        per_page: PER_PAGE,
      });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat surat keterangan');
    } finally {
      setLoading(false);
    }
  }, [letterType, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (letter: api.LeaveLetter) => {
    if (!letter.document_id) return;
    setBusyId(letter.id);
    setError(null);
    try {
      const { url } = await api.getDownloadUrl(letter.document_id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat tautan unduhan');
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (letter: api.LeaveLetter) => {
    const label = letter.number ?? (letter.letter_type === 'suket' ? 'surat keterangan' : 'SK madrasah');
    if (!window.confirm(`Cabut ${label}? Berkas yang tersimpan juga akan dihapus.`)) return;
    setBusyId(letter.id);
    setError(null);
    setNotice(null);
    try {
      await api.revokeLetter(letter.leave_request_id, letter.letter_type);
      setNotice(`${label} dicabut.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencabut surat');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="toolbar">
        <select
          value={letterType}
          onChange={(event) => {
            setPage(1);
            setLetterType(event.target.value);
          }}
        >
          {LETTER_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Cari nomor, nama, atau NIP"
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1);
              setSearch((event.target as HTMLInputElement).value);
            }
          }}
        />
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat...</p> : null}

      {!loading && items.length === 0 ? (
        <p className="sub">Tidak ada surat pada filter ini.</p>
      ) : null}

      {items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Nomor</th>
                <th>Terbit</th>
                <th>Nama</th>
                <th>NIP</th>
                <th>Jenis cuti</th>
                <th>Berkas</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((letter) => (
                <tr key={letter.id}>
                  <td>{letter.letter_type === 'suket' ? 'Surat keterangan' : 'SK madrasah'}</td>
                  <td>{letter.number ?? '-'}</td>
                  <td>{formatDate(letter.issued_at)}</td>
                  <td>{letter.name ?? '-'}</td>
                  <td>{letter.nip ?? '-'}</td>
                  <td>{letter.leave_type ?? '-'}</td>
                  <td>
                    {letter.document_id ? (
                      <button
                        className="button secondary small"
                        type="button"
                        disabled={busyId === letter.id}
                        onClick={() => void download(letter)}
                      >
                        Unduh
                      </button>
                    ) : (
                      <span className="sub">Belum ada</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="button danger small"
                      type="button"
                      disabled={busyId === letter.id}
                      onClick={() => void revoke(letter)}
                    >
                      Cabut
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button
              className="button secondary small"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Sebelumnya
            </button>
            <span>Halaman {page}</span>
            <button
              className="button secondary small"
              type="button"
              disabled={items.length < PER_PAGE}
              onClick={() => setPage((value) => value + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}

export function Letters() {
  return <Navigate to="/leave?arsip=sk-belum-unggah" replace />;
}
