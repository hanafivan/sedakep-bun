import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak surat tugas.
 *
 * Meniru `cetak_surtug.php`: kop instansi, nomor, tubuh surat, daftar pegawai,
 * keterangan, tembusan, dan penanda tangan. Halaman ini sengaja berada di luar
 * Layout (tanpa menu) dan dicetak lewat `window.print()`. PDF sisi server →
 * MinIO menyusul di Fase 13.
 */

type PrintData = api.AssignmentLetterDetail;

export function AssignmentPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getAssignmentLetter(Number(id))
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat surat tugas');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat...</p>;

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak
        </button>
      </div>

      <div className="print-sheet">
        <header className="print-kop">
          <div className="print-logo">{data.instance?.name ?? 'KEMENTERIAN AGAMA'}</div>
          <div className="print-instansi">
            <strong>{data.instance?.name ?? ''}</strong>
            <div>{data.instance?.address ?? ''}</div>
            {data.instance?.website ? <div>{data.instance.website}</div> : null}
          </div>
        </header>

        <h1 className="print-title">SURAT TUGAS</h1>
        <p className="print-number">NOMOR: {data.number_display ?? '-'}</p>

        <p className="print-line">
          <strong>Pertimbangan:</strong> {data.consideration ?? '-'}
        </p>
        <p className="print-line">
          <strong>Dasar:</strong> {data.legal_basis ?? '-'}
        </p>
        <p className="print-line print-center">MEMUTUSKAN</p>
        <p className="print-line">
          <strong>Menugaskan:</strong> {data.content ?? '-'}
        </p>

        <table className="print-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>NIP</th>
              <th>Jabatan</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member, index) => (
              <tr key={member.id}>
                <td>{index + 1}</td>
                <td>
                  {member.name}
                  {member.grade ? ` (${member.grade})` : ''}
                </td>
                <td>{member.nip ?? '-'}</td>
                <td>{member.position ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.notes.length > 0 ? (
          <>
            <p className="print-line">
              <strong>Keterangan:</strong>
            </p>
            <ol className="print-notes">
              {data.notes.map((note) => (
                <li key={note.id}>{note.note}</li>
              ))}
            </ol>
          </>
        ) : null}

        <div className="print-sign">
          <div>
            {data.place ? `${data.place}, ` : ''}
            {formatDate(data.printed_at ?? data.created_at)}
          </div>
          <div>{data.signer_position ?? ''}</div>
          <div className="print-sign-space" />
          <div>
            <strong>{data.signer_name ?? ''}</strong>
          </div>
        </div>

        {data.copies.length > 0 ? (
          <div className="print-copies">
            <strong>Tembusan:</strong>
            <ol>
              {data.copies.map((copy) => (
                <li key={copy.id}>{copy.copy_to}</li>
              ))}
            </ol>
          </div>
        ) : null}

        {data.verify_code ? (
          <div className="print-qr">
            <img src={`/api/v1/verify/${data.verify_code}/qr`} alt="QR verifikasi" />
            <div>Pindai untuk verifikasi</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
