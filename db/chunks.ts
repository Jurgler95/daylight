/**
 * Splits rows for multi-row inserts. SQLite caps the bound variables of one statement (32766 in
 * current builds), and a few thousand entries with their links would exceed it in one go.
 */
export const INSERT_CHUNK = 200;

export function chunked<T>(rows: readonly T[], size = INSERT_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}
