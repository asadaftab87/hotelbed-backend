// utils/bulkInsertRaw.ts
import type { Pool } from "mysql2/promise";

function escapeString(s: string) {
  return s.replace(/'/g, "''");
}

export async function bulkInsertRaw(
  table: string,
  rows: Record<string, any>[],
  pool: Pool,
  options?: { onDuplicate?: boolean }
) {
  if (!rows.length) return;

  const columns = Object.keys(rows[0]);
  
  // 🚀 AUTO-ADD id column if missing (let MySQL generate UUID)
  const hasId = columns.includes('id');
  const finalColumns = hasId ? columns : ['id', ...columns];
  const columnsSql = finalColumns.map(c => `\`${c}\``).join(", ");

  const valuesSql = rows
    .map(row => {
      const vals = columns.map(col => {
        const v = row[col];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return Number.isNaN(v) ? "NULL" : String(v);
        if (typeof v === "boolean") return v ? "1" : "0";
        if (typeof v === "string") return `'${escapeString(v)}'`;
        return `'${escapeString(String(v))}'`;
      });
      
      // 🚀 If id not present, prepend UUID() function
      if (!hasId) {
        return `(UUID(), ${vals.join(",")})`;
      }
      return `(${vals.join(",")})`;
    })
    .join(",");

  let sql = `INSERT INTO \`${table}\` (${columnsSql}) VALUES ${valuesSql}`;

  if (options?.onDuplicate) {
    const updates = finalColumns.filter(c => c !== "id").map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(", ");
    if (updates) sql += ` ON DUPLICATE KEY UPDATE ${updates}`;
  }

  await pool.query(sql);
}
