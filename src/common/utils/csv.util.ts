import { Response } from 'express';
import { CSV_HEADER } from '../constants';

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
    const str = String(value);
    const needsQuotes = /[",\n\r]/.test(str) || str.includes(',');
    const escaped = str.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const headerLine = headers.map(escape).join(',');
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerLine, ...lines].join('\n');
}

export function sendCsvResponse(res: Response, filename: string, rows: Array<Record<string, unknown>>): void {
  const csv = toCsv(rows);
  res.setHeader(CSV_HEADER.CONTENT_TYPE, CSV_HEADER.CONTENT_TYPE_VALUE);
  res.setHeader(CSV_HEADER.CONTENT_DISPOSITION, `${CSV_HEADER.ATTACHMENT_PREFIX}${filename}"`);
  res.send(csv);
}
