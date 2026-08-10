import type { AnalysisResult, ParsedWorkbook, ReportConfig, ReportType } from '../types';
import { analyze } from './analysis';
import { getProgramConfig, resolveProgramConfig } from './programConfig';

/**
 * Comparativo mensual: cada archivo Excel es un período (mes) de la MISMA
 * auditoría. Se analiza cada archivo con el motor estándar y luego se comparan
 * el cumplimiento global y por indicador período a período.
 */

/** Un período del comparativo (un archivo = un mes). */
export interface ComparativePeriod {
  id: string;
  /** Etiqueta editable del período (por defecto, el nombre del archivo). */
  label: string;
  fileName: string;
  result: AnalysisResult;
}

/** Una fila de la matriz indicador × período. */
export interface IndicatorRow {
  label: string;
  kind?: 'obligatorio' | 'complementario';
  /** % de cumplimiento por período (null si el indicador no aparece ese mes). */
  values: (number | null)[];
}

/** Resultado consolidado del comparativo. */
export interface ComparativeResult {
  programName: string;
  goal: number;
  periods: ComparativePeriod[];
  globals: number[];
  indicators: IndicatorRow[];
  avg: number;
  best: { label: string; percent: number } | null;
  worst: { label: string; percent: number } | null;
  /** Variación (pp) entre el primer y el último período. */
  delta: number | null;
}

/** Nombre legible a partir del nombre de archivo (sin extensión ni guiones). */
export function periodLabelFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || fileName;
}

/** Config del motor para el comparativo (mensual, con la meta del programa). */
export function comparativeConfig(reportType: ReportType, auditId?: string): ReportConfig {
  const goal = resolveProgramConfig({ reportType, auditId, analysisType: 'mensual', highlights: [], goal: getProgramConfig(reportType).goal }).goal;
  return { reportType, auditId, analysisType: 'mensual', highlights: [], goal };
}

/** Analiza cada archivo como un período independiente. */
export function analyzePeriods(workbooks: ParsedWorkbook[], reportType: ReportType, auditId?: string): ComparativePeriod[] {
  const cfg = comparativeConfig(reportType, auditId);
  return workbooks.map((wb, i) => ({
    id: `p${i}-${wb.fileName}`,
    label: periodLabelFromFile(wb.fileName),
    fileName: wb.fileName,
    result: analyze(wb, cfg),
  }));
}

/** Construye el comparativo (derivados) a partir de los períodos analizados. */
export function buildComparative(periods: ComparativePeriod[], reportType: ReportType): ComparativeResult {
  const program = getProgramConfig(reportType);
  const goal = periods[0]?.result.config.goal ?? program.goal;
  const globals = periods.map((p) => p.result.global.percent);

  // Matriz indicador × período: unión de indicadores, en orden de aparición.
  const map = new Map<string, IndicatorRow>();
  periods.forEach((p, idx) => {
    for (const g of p.result.complianceByIndicator) {
      if (!map.has(g.label)) map.set(g.label, { label: g.label, kind: g.kind, values: Array(periods.length).fill(null) });
      map.get(g.label)!.values[idx] = g.percent;
    }
  });
  const indicators = [...map.values()];

  const avg = globals.length ? Number((globals.reduce((a, b) => a + b, 0) / globals.length).toFixed(1)) : 0;
  let best: ComparativeResult['best'] = null;
  let worst: ComparativeResult['worst'] = null;
  periods.forEach((p, i) => {
    const pct = globals[i];
    if (!best || pct > best.percent) best = { label: p.label, percent: pct };
    if (!worst || pct < worst.percent) worst = { label: p.label, percent: pct };
  });
  const delta = periods.length >= 2 ? Number((globals[globals.length - 1] - globals[0]).toFixed(1)) : null;

  return { programName: program.programName, goal, periods, globals, indicators, avg, best, worst, delta };
}
