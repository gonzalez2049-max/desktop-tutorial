import * as XLSX from 'xlsx';
import type { ParsedWorkbook, RawRow, ReportType } from '../types';
import { detectColumns } from './columnDetection';
import { applyDetectionProfile } from './detectionProfiles';

/**
 * Lee un archivo Excel (o CSV) con SheetJS y devuelve las filas, los headers
 * y la detección automática de columnas. Si se indica el programa, aplica su
 * perfil de reconocimiento (p. ej. NT 234 HUAP) para afinar la asignación.
 */
export async function parseExcelFile(file: File, reportType?: ReportType, auditId?: string): Promise<ParsedWorkbook> {
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

  // Headers reales del Excel, descartando columnas auxiliares o vacías:
  // - sin encabezado o encabezado en blanco,
  // - columnas generadas por SheetJS sin encabezado (__EMPTY, __EMPTY_1, …),
  // - columnas completamente vacías en todas las filas.
  const isBlankHeader = (h: string) => h == null || String(h).trim() === '' || /^__EMPTY/i.test(h);
  const isEmptyColumn = (h: string) => rows.every((r) => r[h] === null || r[h] === undefined || String(r[h]).trim() === '');
  const headers = Object.keys(rows[0]).filter((h) => !isBlankHeader(h) && !isEmptyColumn(h));

  const base = detectColumns(headers, rows);
  const columns = reportType ? applyDetectionProfile(reportType, base, rows, auditId) : base;

  return {
    fileName: file.name,
    sheetName,
    headers,
    rows,
    columns,
  };
}

/**
 * Construye un ParsedWorkbook a partir de una hoja ya leída (SheetJS), aplicando
 * la misma detección de columnas y perfil de reconocimiento que la carga normal.
 * Reutilizado por el Dashboard Consolidado (una hoja = una auditoría).
 */
function buildParsedFromSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  fileName: string,
  reportType: ReportType,
  auditId: string,
): ParsedWorkbook | null {
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: false });
  if (rows.length === 0) return null;
  const isBlankHeader = (h: string) => h == null || String(h).trim() === '' || /^__EMPTY/i.test(h);
  const isEmptyColumn = (h: string) => rows.every((r) => r[h] === null || r[h] === undefined || String(r[h]).trim() === '');
  const headers = Object.keys(rows[0]).filter((h) => !isBlankHeader(h) && !isEmptyColumn(h));
  const base = detectColumns(headers, rows);
  const columns = applyDetectionProfile(reportType, base, rows, auditId);
  return { fileName, sheetName, headers, rows, columns };
}

/**
 * Carga un archivo Excel como los datos de UNA auditoría concreta (primera hoja).
 * Usado por el modo «un archivo por auditoría» del Dashboard Consolidado.
 */
export async function parseModuleFile(file: File, reportType: ReportType, auditId: string): Promise<ParsedWorkbook> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('El archivo no contiene hojas de cálculo.');
  const parsed = buildParsedFromSheet(wb.Sheets[sheetName], sheetName, file.name, reportType, auditId);
  if (!parsed) throw new Error('La hoja seleccionada está vacía.');
  return parsed;
}

/** Reglas de coincidencia hoja → auditoría IAAS (por nombre de la hoja). */
const SHEET_AUDIT_RULES: { auditId: string; needAll: string[][]; deny?: string[] }[] = [
  // Bundles primero (requieren "bundle" o "paquete" para no confundir con vigilancia).
  { auditId: 'bundle_cvc', needAll: [['bundle', 'paquete'], ['cvc', 'venoso central']] },
  { auditId: 'bundle_cup', needAll: [['bundle', 'paquete'], ['cup', 'urinario']] },
  { auditId: 'bundle_navm', needAll: [['bundle', 'paquete'], ['navm', 'ventil', 'vap']] },
  // Vigilancias (excluyen "bundle"/"paquete").
  { auditId: 'its_cvc', needAll: [['its', 'torrente', 'clabsi', 'cvc']], deny: ['bundle', 'paquete'] },
  { auditId: 'itu_cup', needAll: [['itu', 'urinaria', 'cauti', 'cup']], deny: ['bundle', 'paquete'] },
  { auditId: 'navm', needAll: [['navm', 'ventil', 'vap']], deny: ['bundle', 'paquete'] },
  // Prácticas.
  { auditId: 'higiene_manos', needAll: [['higiene', 'manos', 'hand', 'oms']] },
];

const normSheet = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Deduce la auditoría IAAS a la que corresponde una hoja por su nombre. */
export function guessAuditForSheet(sheetName: string): string | null {
  const n = normSheet(sheetName);
  for (const rule of SHEET_AUDIT_RULES) {
    if (rule.deny && rule.deny.some((d) => n.includes(d))) continue;
    if (rule.needAll.every((group) => group.some((tok) => n.includes(tok)))) return rule.auditId;
  }
  return null;
}

/** Una hoja de un libro consolidado, con su auditoría deducida (o null). */
export interface WorkbookSheet {
  sheetName: string;
  guessedAuditId: string | null;
  sheet: XLSX.WorkSheet;
}

/** Lee un libro con varias hojas y deduce la auditoría de cada una. */
export async function readConsolidatedWorkbook(file: File): Promise<{ fileName: string; sheets: WorkbookSheet[] }> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellDates: true });
  const sheets: WorkbookSheet[] = wb.SheetNames.map((sheetName) => ({
    sheetName,
    guessedAuditId: guessAuditForSheet(sheetName),
    sheet: wb.Sheets[sheetName],
  }));
  return { fileName: file.name, sheets };
}

/** Convierte una hoja mapeada a una auditoría en un ParsedWorkbook. */
export function parseMappedSheet(sheet: WorkbookSheet, fileName: string, reportType: ReportType, auditId: string): ParsedWorkbook | null {
  return buildParsedFromSheet(sheet.sheet, sheet.sheetName, fileName, reportType, auditId);
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
