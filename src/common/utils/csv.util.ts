export function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows || rows.length === 0) {
    return "";
  }

  const headerSet = rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((k) => set.add(k));
    return set;
  }, new Set<string>());
  const headers = Array.from(headerSet);

  const escape = (value: any): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Escape double quotes by doubling them
    const needsQuotes = /[",\n\r]/.test(str) || str.includes(",");
    const escaped = str.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const headerLine = headers.map(escape).join(",");
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

export function sendCsvResponse(
  res: any,
  filename: string,
  rows: Array<Record<string, any>>,
): void {
  const csv = toCsv(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
