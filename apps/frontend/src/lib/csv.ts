/** Splits one delimited line, honouring double-quoted fields (so "Rao, Asha" stays one cell). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

const DEFAULT_COLUMNS = ["name", "phone", "guardianName", "guardianPhone", "guardianEmail"];

/**
 * Parses pasted spreadsheet/CSV text into rows for the bulk-import API.
 * Pasting from Excel or Google Sheets gives tab-separated text; a saved CSV
 * gives commas — both work. A first row that names columns (Name, Phone,
 * Guardian Email…) is used as the header; otherwise columns are assumed to
 * be name, phone, guardian name, guardian phone, guardian email.
 */
export function parseStudentRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const table = lines.map((l) => splitLine(l, delimiter));

  const looksLikeHeader = table[0].some((c) => /^(student\s*)?name$/i.test(c.trim()));
  const header = looksLikeHeader ? table[0] : DEFAULT_COLUMNS;
  const body = looksLikeHeader ? table.slice(1) : table;

  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
}
