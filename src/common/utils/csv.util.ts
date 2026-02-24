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
    let str: string;
    if (typeof value === 'object') {
      str = JSON.stringify(value);
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      str = String(value);
    } else if (typeof value === 'symbol') {
      str = value.description ?? '';
    } else if (typeof value === 'bigint') {
      str = value.toString();
    } else {
      // function or other: use toString (object already handled above)
      str = (value as (...args: unknown[]) => unknown).toString();
    }
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
