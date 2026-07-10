import * as XLSX from 'xlsx';
import type { ParsedWorkbook, RawRow, ReportType } from '../types';
import { detectColumns } from './columnDetection';
import { applyDetectionProfile } from './detectionProfiles';

/**
 * Lee un archivo Excel (o CSV) con SheetJS y devuelve las filas, los headers
 * y la detección automática de columnas. Si se indica el programa, aplica su
 * perfil de reconocimiento (p. ej. NT 234 HUAP) para afinar la asignación.
 */
export async function parseExcelFile(file: File, reportType?: ReportType): Promise<ParsedWorkbook> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { cellDates: true });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El archivo no contiene hojas de cálculo.');
  }
  const sheet = workbook.Sheets[sheetName];

  // defval asegura que todas las filas tengan todas las claves.
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: false });

  if (rows.length === 0) {
    throw new Error('La hoja seleccionada está vacía.');
  }

  // Los headers son la unión de todas las claves presentes, preservando el
  // orden de aparición de la primera fila.
  const headers = Object.keys(rows[0]);

  const base = detectColumns(headers, rows);
  const columns = reportType ? applyDetectionProfile(reportType, base, rows) : base;

  return {
    fileName: file.name,
    sheetName,
    headers,
    rows,
    columns,
  };
}

/** Genera un Excel a partir de filas arbitrarias y lo devuelve como Blob. */
export function rowsToWorkbookBlob(sheets: { name: string; rows: RawRow[] }[]): Blob {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
