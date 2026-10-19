import ExcelJS from 'exceljs';
import { Readable } from 'stream';

export type SheetRow = Record<string, string>;

/** Lower-case, trim and collapse header names so "Selling Price " and "selling_price" match. */
export function normalizeHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase().replace(/[\s\-.]+/g, '_');
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if ('text' in v && typeof v.text === 'string') return v.text; // hyperlink
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue); // formula
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    return String(v);
  }
  return String(v).trim();
}

/**
 * Streams rows out of an .xlsx (first sheet) or .csv file without holding the
 * whole workbook in memory, so 100k-row catalogs import smoothly.
 * Yields [excelRowNumber, row] with normalised header keys.
 */
export async function* readSheet(data: Buffer, fileName: string): AsyncGenerator<[number, SheetRow]> {
  if (fileName.toLowerCase().endsWith('.csv')) {
    yield* readCsv(data.toString('utf8'));
    return;
  }
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(data), {
    sharedStrings: 'cache', hyperlinks: 'cache', worksheets: 'emit', styles: 'ignore',
  });
  for await (const sheet of reader) {
    let headers: string[] | null = null;
    for await (const row of sheet) {
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
      if (!headers) {
        headers = values.map(normalizeHeader);
        continue;
      }
      if (values.every((v) => v === '')) continue;
      const out: SheetRow = {};
      headers.forEach((h, i) => { if (h) out[h] = values[i] ?? ''; });
      yield [row.number, out];
    }
    return; // first worksheet only
  }
}

function* readCsv(text: string): Generator<[number, SheetRow]> {
  const rows = parseCsv(text);
  const headers = (rows.shift() ?? []).map(normalizeHeader);
  let n = 1;
  for (const r of rows) {
    n++;
    if (r.every((v) => v.trim() === '')) continue;
    const out: SheetRow = {};
    headers.forEach((h, i) => { if (h) out[h] = (r[i] ?? '').trim(); });
    yield [n, out];
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Returns the first non-empty value among header aliases. */
export function pick(row: SheetRow, ...aliases: string[]): string {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}
