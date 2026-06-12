import { Response } from 'express';

/**
 * Builds a CSV string with a fixed, ordered set of columns.
 * Returns a header-only CSV when rows is empty (never returns an empty string).
 */
export function buildFixedCsv(
  headers: readonly string[],
  rows: readonly (string | number | boolean | null | undefined)[][],
): string {
  const escape = (v: string | number | boolean | null | undefined): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  return lines.join('\n');
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows || rows.length === 0) {
    return '';
  }

  const headerSet = rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((k) => set.add(k));
    return set;
  }, new Set<string>());
  const headers = Array.from(headerSet);

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str =
      typeof value === 'object'
        ? JSON.stringify(value)
        : String(value as string | number | boolean | bigint);
    const needsQuotes = /[",\n\r]/.test(str) || str.includes(',');
    const escaped = str.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const headerLine = headers.map(escape).join(',');
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
}

export function sendCsvResponse(
  res: Response,
  filename: string,
  rows: Array<Record<string, unknown>>,
): void {
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}
