/**
 * Output helpers — chalk-styled table by default, raw JSON when --json
 * is on. Mirrors plugipay's CLI output shape so shells scripts can rely
 * on the same conventions across the Forjio family.
 */
import chalk from 'chalk';

export interface Column<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
  width?: number;
}

export interface FormatOptions {
  json?: boolean;
  noColor?: boolean;
}

function cellValue(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '–';
  return String(v);
}

export function formatTable<T>(rows: readonly T[], columns: readonly Column<T>[]): string {
  if (columns.length === 0) return '';
  const stringRows: string[][] = rows.map((row) =>
    columns.map((col) => cellValue(col.accessor(row))),
  );
  const widths = columns.map((col, idx) => {
    const dataMax = stringRows.reduce(
      (max, r) => Math.max(max, (r[idx] ?? '').length),
      0,
    );
    return Math.max(col.header.length, dataMax, col.width ?? 0);
  });
  const pad = (s: string, w: number): string => s + ' '.repeat(Math.max(0, w - s.length));
  const headerLine = columns
    .map((c, i) => chalk.bold(pad(c.header, widths[i] ?? c.header.length)))
    .join('  ');
  const divider = widths.map((w) => '─'.repeat(w)).join('  ');
  const bodyLines = stringRows.map((r) =>
    r.map((cell, i) => pad(cell, widths[i] ?? cell.length)).join('  '),
  );
  return [headerLine, divider, ...bodyLines].join('\n');
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function printResult<T>(
  data: T | readonly T[],
  columns: readonly Column<T>[],
  opts: FormatOptions = {},
): void {
  if (opts.json) {
    process.stdout.write(`${formatJson(data)}\n`);
    return;
  }
  if (Array.isArray(data) && data.length === 0) {
    process.stdout.write(chalk.dim('(no results)\n'));
    return;
  }
  const rows = Array.isArray(data) ? (data as readonly T[]) : [data as T];
  process.stdout.write(`${formatTable(rows, columns)}\n`);
}

export function printJson(data: unknown): void {
  process.stdout.write(`${formatJson(data)}\n`);
}

export function printMessage(msg: string, opts: FormatOptions = {}): void {
  if (opts.json) {
    process.stdout.write(`${formatJson({ ok: true, message: msg })}\n`);
    return;
  }
  process.stdout.write(`${msg}\n`);
}

export function printError(
  err: { code?: string; message: string; requestId?: string },
  opts: FormatOptions = {},
): void {
  if (opts.json) {
    process.stderr.write(
      `${formatJson({
        error: {
          code: err.code ?? 'unknown',
          message: err.message,
          requestId: err.requestId,
        },
      })}\n`,
    );
    return;
  }
  process.stderr.write(`${chalk.red(`Error: ${err.code ?? 'error'} — ${err.message}`)}\n`);
  if (err.requestId) {
    process.stderr.write(`${chalk.dim(`Request ID: ${err.requestId}`)}\n`);
  }
}
