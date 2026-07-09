import type {
  AnalysisResult,
  ComplianceGroup,
  GlobalCompliance,
  GroupCount,
  ParsedWorkbook,
  RawRow,
  ReportConfig,
} from '../types';
import { classifyCompliance, columnForRole, columnsForRole } from './columnDetection';

const UNGROUPED = 'Sin especificar';

/** ¿La celda está vacía? Un vacío en columna de cumplimiento cuenta como "no aplica". */
function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

/** % de cumplimiento sobre casos aplicables (cumple / (cumple + no cumple)). */
function pct(cumple: number, aplicables: number): number {
  return aplicables === 0 ? 0 : Number(((cumple / aplicables) * 100).toFixed(1));
}

/**
 * Cuenta cumple / no cumple / no aplica de una fila sobre una o varias columnas
 * de cumplimiento.
 *
 * Reconoce (vía classifyCompliance, sin distinguir mayúsculas ni acentos):
 * - cumple:      Sí, SI, Si, Cumple, 1, Verdadero
 * - no cumple:   No, No cumple, 0, Falso
 * - no aplica:   N/A, NA, No aplica y celdas vacías cuando corresponde
 */
function tally(row: RawRow, cols: string[]): { cumple: number; noCumple: number; noAplica: number } {
  let cumple = 0;
  let noCumple = 0;
  let noAplica = 0;
  for (const col of cols) {
    const v = row[col];
    const c = classifyCompliance(v);
    if (c === 'cumple') cumple++;
    else if (c === 'no_cumple') noCumple++;
    else if (c === 'no_aplica') noAplica++;
    else if (isEmpty(v)) noAplica++; // vacío en columna de cumplimiento = no aplica
    // valores no reconocidos y no vacíos se ignoran
  }
  return { cumple, noCumple, noAplica };
}

/** Etiqueta legible del valor de una columna de agrupación. */
function labelOf(value: unknown): string {
  return isEmpty(value) ? UNGROUPED : String(value).trim();
}

/** Cuenta registros por categoría (total por unidad / por turno). */
function countBy(rows: RawRow[], dimCol: string | null): GroupCount[] {
  if (!dimCol) return [];
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = labelOf(row[dimCol]);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** Construye un grupo de cumplimiento a partir de conteos crudos. */
function makeGroup(label: string, cumple: number, noCumple: number, noAplica: number, goal: number): ComplianceGroup {
  const aplicables = cumple + noCumple;
  const percent = pct(cumple, aplicables);
  return {
    label,
    total: cumple + noCumple + noAplica,
    cumple,
    noCumple,
    noAplica,
    aplicables,
    percent,
    meetsGoal: aplicables > 0 && percent >= goal,
  };
}

/** Agrupa el cumplimiento por una columna dimensión (turno, unidad…). */
function complianceBy(rows: RawRow[], dimCol: string | null, complianceCols: string[], goal: number): ComplianceGroup[] {
  if (!dimCol) return [];
  const acc = new Map<string, { cumple: number; noCumple: number; noAplica: number }>();
  for (const row of rows) {
    const label = labelOf(row[dimCol]);
    const t = tally(row, complianceCols);
    const g = acc.get(label) ?? { cumple: 0, noCumple: 0, noAplica: 0 };
    g.cumple += t.cumple;
    g.noCumple += t.noCumple;
    g.noAplica += t.noAplica;
    acc.set(label, g);
  }
  return Array.from(acc.entries())
    .map(([label, g]) => makeGroup(label, g.cumple, g.noCumple, g.noAplica, goal))
    .sort((a, b) => b.percent - a.percent);
}

/**
 * Cumplimiento por indicador. Si hay una columna "indicador", agrupa por su valor.
 * Si no, cada columna de cumplimiento se trata como un indicador (formato ancho).
 */
function complianceByIndicator(
  rows: RawRow[],
  indicatorCol: string | null,
  complianceCols: string[],
  goal: number,
): ComplianceGroup[] {
  if (indicatorCol) {
    return complianceBy(rows, indicatorCol, complianceCols, goal);
  }
  return complianceCols
    .map((col) => {
      let cumple = 0;
      let noCumple = 0;
      let noAplica = 0;
      for (const row of rows) {
        const one = tally(row, [col]);
        cumple += one.cumple;
        noCumple += one.noCumple;
        noAplica += one.noAplica;
      }
      return makeGroup(col, cumple, noCumple, noAplica, goal);
    })
    .sort((a, b) => b.percent - a.percent);
}

/** Ejecuta el motor de análisis completo. */
export function analyze(workbook: ParsedWorkbook, config: ReportConfig): AnalysisResult {
  const { rows, columns } = workbook;
  const goal = config.goal;

  const complianceCols = columnsForRole(columns, 'cumplimiento');
  const unitCol = columnForRole(columns, 'unidad');
  const shiftCol = columnForRole(columns, 'turno');
  const indicatorCol = columnForRole(columns, 'indicador');

  // Cumplimiento global.
  let cumple = 0;
  let noCumple = 0;
  let noAplica = 0;
  for (const row of rows) {
    const t = tally(row, complianceCols);
    cumple += t.cumple;
    noCumple += t.noCumple;
    noAplica += t.noAplica;
  }
  const aplicables = cumple + noCumple;
  const globalPercent = pct(cumple, aplicables);
  const global: GlobalCompliance = {
    cumple,
    noCumple,
    noAplica,
    aplicables,
    percent: globalPercent,
    meetsGoal: aplicables > 0 && globalPercent >= goal,
  };

  const byIndicator = complianceByIndicator(rows, indicatorCol, complianceCols, goal);

  return {
    config,
    totalRecords: rows.length,
    global,
    totalByUnit: countBy(rows, unitCol),
    totalByShift: countBy(rows, shiftCol),
    complianceByUnit: complianceBy(rows, unitCol, complianceCols, goal),
    complianceByShift: complianceBy(rows, shiftCol, complianceCols, goal),
    complianceByIndicator: byIndicator,
    criticalIndicators: byIndicator.filter((i) => i.aplicables > 0 && !i.meetsGoal).sort((a, b) => a.percent - b.percent),
    highlightedIndicators: byIndicator.filter((i) => i.meetsGoal).sort((a, b) => b.percent - a.percent),
    detected: {
      unidad: unitCol !== null,
      turno: shiftCol !== null,
      indicador: indicatorCol !== null || complianceCols.length > 0,
    },
  };
}
