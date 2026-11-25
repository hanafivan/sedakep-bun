import { today } from './helpers';

/**
 * Utilitas ekspor CSV generik (pemisah titik-koma `;`, EOL CRLF).
 */

/** Escape satu sel CSV (menangani kutip, titik-koma, CR/LF, serta objek Date). */
export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Bangun konten CSV lengkap beserta header dan trailing CRLF. */
export const buildCsv = (headers: readonly string[], data: unknown[][]): string => {
  const lines: string[] = [headers.join(';')];
  for (const row of data) {
    lines.push(row.map(csvCell).join(';'));
  }
  return `${lines.join('\r\n')}\r\n`;
};

/** Nama berkas CSV dengan tanggal berjalan, misal `alibi_export_2026-11-10.csv`. */
export const csvFilename = (prefix: string): string => `${prefix}_${today()}.csv`;
