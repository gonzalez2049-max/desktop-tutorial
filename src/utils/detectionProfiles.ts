// Perfiles de reconocimiento de columnas por programa. Mejoran la asignación
// automática sin tocar el motor de cálculo: solo deciden el ROL de cada columna.
import type { DetectedColumn, RawRow, ReportType } from '../types';
import { classifyCompliance, isDescriptiveVariable, normalize } from './columnDetection';
import { isLppStageColumn } from './lpp';
import { canonicalIndicatorNT234 } from './nt234';
import { LPP_RNAO_ALL_INDICATORS } from './lppRnao';
import { canonicalizerFor } from '../config/programs';
import { getProgramConfig } from './programConfig';

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

/**
 * Perfil por auditoría (IAAS y futuras): reconoce los indicadores oficiales de
 * la auditoría elegida para asignarles el rol correcto sin intervención manual.
 * - Formato ancho: una columna cuyo encabezado coincide con un indicador oficial
 *   y cuyo contenido es Sí/No → columna de cumplimiento (aunque el encabezado
 *   contenga palabras como "paciente" o "entorno").
 * - Formato largo: una columna cuyos valores son los indicadores oficiales →
 *   columna de indicador.
 * No altera las columnas de dimensión (unidad, turno, estamento, etc.).
 */
function applyAuditProfile(reportType: ReportType, auditId: string, columns: DetectedColumn[], rows: RawRow[]): DetectedColumn[] {
  const audit = getProgramConfig(reportType).audits?.find((a) => a.id === auditId);
  const officialNames = audit?.indicators.map((i) => i.name) ?? [];
  if (officialNames.length === 0) return columns;
  const canon = canonicalizerFor(reportType, officialNames);

  /**
   * Proporción de valores de la columna que son indicadores oficiales. Ignora
   * valores cortos (≤ 3 caracteres, p. ej. "UCI") para evitar falsos positivos
   * por coincidencia de subcadena contra nombres largos de indicador.
   */
  const indicatorRatio = (col: string): number => {
    const sample = rows.slice(0, 50).map((r) => r[col]).filter((v) => String(v ?? '').trim().length > 3);
    if (sample.length === 0) return 0;
    return sample.filter((v) => canon(v) !== null).length / sample.length;
  };

  // Dimensiones estructurales ya reconocidas: el reconocimiento de indicador en
  // formato largo NO debe secuestrarlas (una columna «Unidad» o «Turno» no es un
  // indicador aunque algún valor corto coincida por subcadena).
  const dimensionRoles = new Set<DetectedColumn['role']>(['unidad', 'turno', 'fecha', 'paciente', 'riesgo']);

  return columns.map((col) => {
    // Ancho: encabezado = indicador oficial + contenido Sí/No → cumplimiento.
    if (canon(col.original) !== null && complianceRatio(rows, col.original) >= 0.5) {
      return { ...col, role: 'cumplimiento', confidence: 0.95 };
    }
    // Largo: valores = indicadores oficiales → indicador. Solo en columnas que no
    // son ya cumplimiento ni una dimensión estructural.
    if (col.role !== 'cumplimiento' && !dimensionRoles.has(col.role) && indicatorRatio(col.original) >= 0.5) {
      return { ...col, role: 'indicador', confidence: 0.9 };
    }
    return col;
  });
}

/** Nombre del perfil de reconocimiento aplicable a un programa (o null). */
export function profileNameFor(reportType: ReportType): string | null {
  if (reportType === 'NT234_LPP') return NT234_HUAP_PROFILE;
  if (reportType === 'LPP_RNAO') return 'LPP – Guía RNAO';
  if (reportType === 'IAAS') return 'IAAS';
  return null;
}

// Indicadores oficiales RNAO normalizados (para reconocer sus columnas).
const LPP_RNAO_NORM = LPP_RNAO_ALL_INDICATORS.map((i) => normalize(i));

/** ¿El encabezado corresponde a un indicador oficial de la guía RNAO? */
function isLppRnaoIndicator(header: string): boolean {
  const h = normalize(header);
  if (!h) return false;
  return LPP_RNAO_NORM.some((ni) => ni !== '' && (ni === h || h.includes(ni) || ni.includes(h)));
}

/** Proporción de valores clasificables (cumple/no cumple/N-A) en una columna. */
function classifiableRatio(rows: RawRow[], col: string): number {
  const sample = rows.slice(0, 50).map((r) => r[col]);
  if (sample.length === 0) return 0;
  const hits = sample.filter((v) => classifyCompliance(v) !== 'desconocido').length;
  return hits / sample.length;
}

/**
 * Perfil "LPP – Guía RNAO": los indicadores oficiales de la guía cuyos nombres
 * contienen palabras estructurales (p. ej. «riesgo», «paciente») serían mal
 * clasificados por la detección base como rol riesgo/paciente. Aquí se fuerza a
 * rol 'cumplimiento' cualquier columna cuyo encabezado coincida con un indicador
 * oficial y cuyo contenido sea de cumplimiento (Cumple/No cumple/N/A). Las
 * columnas estructurales (unidad, turno, estamento, nivel de riesgo, presencia
 * de LPP, fecha) conservan su rol.
 */
function applyLppRnaoProfile(columns: DetectedColumn[], rows: RawRow[]): DetectedColumn[] {
  return columns.map((col) => {
    const n = normalize(col.original);
    if (!n) return col;
    // La presencia de LPP y demás variables descriptivas se mantienen descriptivas.
    if (isDescriptiveVariable(col.original)) return { ...col, role: 'descriptivo', confidence: 1 };
    // Indicador oficial con contenido de cumplimiento -> forzar rol 'cumplimiento'.
    if (isLppRnaoIndicator(col.original) && classifiableRatio(rows, col.original) >= 0.5) {
      return { ...col, role: 'cumplimiento', confidence: 0.95 };
    }
    return col;
  });
}

/** Aplica el perfil de reconocimiento del programa a las columnas detectadas. */
export function applyDetectionProfile(reportType: ReportType, columns: DetectedColumn[], rows: RawRow[], auditId?: string): DetectedColumn[] {
  if (reportType === 'NT234_LPP') return applyNt234HuapProfile(columns, rows);
  if (reportType === 'LPP_RNAO') return applyLppRnaoProfile(columns, rows);
  if (auditId) return applyAuditProfile(reportType, auditId, columns, rows);
  return columns;
}
