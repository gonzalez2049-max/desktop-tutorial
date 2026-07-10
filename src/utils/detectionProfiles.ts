// Perfiles de reconocimiento de columnas por programa. Mejoran la asignación
// automática sin tocar el motor de cálculo: solo deciden el ROL de cada columna.
import type { DetectedColumn, RawRow, ReportType } from '../types';
import { classifyCompliance, isDescriptiveVariable, normalize } from './columnDetection';
import { isLppStageColumn } from './lpp';
import { canonicalIndicatorNT234 } from './nt234';

/** Nombre del perfil de reconocimiento del módulo NT 234 (estructura HUAP). */
export const NT234_HUAP_PROFILE = 'NT 234 HUAP';

// Encabezados que deben ignorarse: identificadores de registro / índices, no clínicos.
const IGNORE_EXACT = new Set([
  'record id', 'recordid', 'record', 'id', 'n', 'nro', 'num', 'numero',
  'index', 'indice', 'fila', 'row', 'correlativo', 'orden',
]);

// Columnas de resumen / derivadas: nunca son indicador. Se ignoran salvo que su
// contenido sea realmente cumplimiento (Sí/No), en cuyo caso son la columna de
// cumplimiento (formato largo).
const SUMMARY_EXACT = new Set([
  'cumple', 'no cumple', 'cumplimiento', 'porcentaje de cumplimiento', 'porcentaje cumplimiento',
  'meta', 'estado', 'total', 'totales', 'resultado', 'promedio', 'logro', 'observacion', 'observaciones',
]);

// Señales de columna de identificación del paciente (N° Ficha, Ficha, RUN, RUT…).
const PATIENT_HINT = /(\bficha\b|ficha clinica|\brun\b|\brut\b|\bpaciente\b|identificador del paciente|id del paciente|id paciente|historia clinica)/;

/** Proporción de valores Sí/No (cumple/no cumple) en las primeras filas de una columna. */
function complianceRatio(rows: RawRow[], col: string): number {
  const sample = rows.slice(0, 50).map((r) => r[col]);
  if (sample.length === 0) return 0;
  const hits = sample.filter((v) => {
    const c = classifyCompliance(v);
    return c === 'cumple' || c === 'no_cumple';
  }).length;
  return hits / sample.length;
}

/**
 * Perfil "NT 234 HUAP": ajusta la detección base a la estructura habitual del
 * Excel del HUAP. Prioriza identificación del paciente, nivel de riesgo e
 * indicadores oficiales, e ignora columnas de índice y de resumen/derivadas.
 */
function applyNt234HuapProfile(columns: DetectedColumn[], rows: RawRow[]): DetectedColumn[] {
  return columns.map((col) => {
    const n = normalize(col.original);
    if (!n) return { ...col, role: 'desconocido', confidence: 0 };

    // 1) Record ID / índices -> Ignorar (nunca paciente).
    if (IGNORE_EXACT.has(n) || /^record\s*id\b/.test(n)) {
      return { ...col, role: 'desconocido', confidence: 0.95 };
    }

    // 2) Identificación del paciente (prioritaria; no si es riesgo o descriptiva).
    if (col.role !== 'descriptivo' && PATIENT_HINT.test(n) && !/\briesgo\b|\bbraden\b/.test(n)) {
      return { ...col, role: 'paciente', confidence: 0.95 };
    }

    // 3) Indicador oficial NT 234 con contenido Sí/No -> columna de cumplimiento
    //    (formato ancho). Gana a la señal de riesgo de "Valoración de Riesgo…".
    if (canonicalIndicatorNT234(col.original) && complianceRatio(rows, col.original) >= 0.5) {
      return { ...col, role: 'cumplimiento', confidence: 0.95 };
    }

    // 3b) LPP descriptiva / clasificación de LPP (no es riesgo ni cumplimiento).
    if (col.role !== 'descriptivo' && (isDescriptiveVariable(col.original) || isLppStageColumn(col.original))) {
      return { ...col, role: 'descriptivo', confidence: 0.9 };
    }

    // 4) Resumen / derivados: nunca indicador. Se ignoran salvo contenido Sí/No real.
    if (SUMMARY_EXACT.has(n)) {
      return complianceRatio(rows, col.original) >= 0.7
        ? { ...col, role: 'cumplimiento', confidence: 0.85 }
        : { ...col, role: 'desconocido', confidence: 0.9 };
    }

    return col;
  });
}

/** Nombre del perfil de reconocimiento aplicable a un programa (o null). */
export function profileNameFor(reportType: ReportType): string | null {
  return reportType === 'NT234_LPP' ? NT234_HUAP_PROFILE : null;
}

/** Aplica el perfil de reconocimiento del programa a las columnas detectadas. */
export function applyDetectionProfile(reportType: ReportType, columns: DetectedColumn[], rows: RawRow[]): DetectedColumn[] {
  if (reportType === 'NT234_LPP') return applyNt234HuapProfile(columns, rows);
  return columns;
}
