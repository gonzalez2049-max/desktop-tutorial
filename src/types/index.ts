// Modelo de datos de NEX Report (primera versión funcional).

/** Tipos de informe que ofrece el asistente. */
export type ReportType =
  | 'NT234_LPP'
  | 'IAAS'
  | 'Dolor'
  | 'Caidas'
  | 'AccesosVasculares'
  | 'Personalizado';

/** Datos que el usuario puede pedir destacar en el informe. */
export type Highlight =
  | 'cumplimiento_global'
  | 'cumplimiento_unidad'
  | 'cumplimiento_turno'
  | 'indicadores_criticos'
  | 'pacientes_alto_riesgo'
  | 'brechas'
  | 'recomendaciones'
  | 'comparacion_mensual';

/** Roles semánticos que intentamos detectar automáticamente en las columnas. */
export type ColumnRole =
  | 'unidad'
  | 'turno'
  | 'indicador'
  | 'cumplimiento'
  | 'fecha'
  | 'paciente'
  | 'riesgo'
  | 'descriptivo' // variable clínica descriptiva / prevalencia (p. ej. "¿Tiene LPP?")
  | 'valor'
  | 'desconocido';

/** Resultado de la detección de una columna del Excel. */
export interface DetectedColumn {
  /** Nombre original de la columna en el Excel. */
  original: string;
  /** Rol semántico detectado. */
  role: ColumnRole;
  /** Confianza de la detección 0..1. */
  confidence: number;
}

/** Un valor de cumplimiento normalizado. */
export type ComplianceValue = 'cumple' | 'no_cumple' | 'no_aplica' | 'desconocido';

/** Configuración final del informe elegida en el wizard. */
export interface ReportConfig {
  reportType: ReportType;
  highlights: Highlight[];
  goal: number; // meta de cumplimiento en % (0..100)
}

/** Fila cruda leída del Excel. */
export type RawRow = Record<string, unknown>;

/** Resultado de leer el archivo Excel. */
export interface ParsedWorkbook {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: RawRow[];
  columns: DetectedColumn[];
}

/** Conteo simple de registros por categoría (p. ej. total por unidad). */
export interface GroupCount {
  label: string;
  count: number;
}

/** Cumplimiento agregado de una categoría (indicador, turno, unidad…). */
export interface ComplianceGroup {
  label: string;
  total: number; // registros del grupo
  cumple: number;
  noCumple: number;
  noAplica: number;
  aplicables: number; // cumple + noCumple
  percent: number; // cumple / aplicables * 100
  meetsGoal: boolean;
}

/** Cumplimiento global de toda la auditoría. */
export interface GlobalCompliance {
  cumple: number;
  noCumple: number;
  noAplica: number;
  aplicables: number;
  percent: number;
  meetsGoal: boolean;
}

/** Una sección redactada del resumen ejecutivo. */
export interface ReportSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/** Informe ejecutivo completo generado a partir del análisis. */
export interface ExecutiveReport {
  title: string;
  meta: {
    reportTypeLabel: string;
    goal: number;
    generatedAt: string; // fecha legible
  };
  sections: ReportSection[];
}

/**
 * Variable clínica descriptiva / de prevalencia (p. ej. "¿Tiene LPP?").
 * No es un indicador de cumplimiento: no se compara contra la meta.
 */
export interface DescriptiveVariable {
  label: string;
  positive: number; // casos "Sí" (p. ej. pacientes con LPP)
  negative: number; // casos "No"
  answered: number; // positive + negative
  prevalence: number; // positive / totalRecords * 100
}

/** Fila de la matriz de cumplimiento por turno dentro de cada unidad. */
export interface UnitShiftRow {
  unit: string;
  overall: number; // % de la unidad (todos los turnos)
  byShift: Record<string, number | null>; // % por turno (null = sin datos aplicables)
}

/** Matriz cumplimiento turno × unidad. */
export interface UnitShiftMatrix {
  shifts: string[];
  rows: UnitShiftRow[];
}

/** Resultado completo del motor de análisis. */
export interface AnalysisResult {
  config: ReportConfig;
  totalRecords: number;
  global: GlobalCompliance;
  totalByUnit: GroupCount[];
  totalByShift: GroupCount[];
  complianceByUnit: ComplianceGroup[];
  complianceByShift: ComplianceGroup[];
  complianceByIndicator: ComplianceGroup[];
  criticalIndicators: ComplianceGroup[]; // bajo la meta
  highlightedIndicators: ComplianceGroup[]; // sobre o en la meta
  descriptiveVariables: DescriptiveVariable[]; // prevalencia (no cumplimiento)
  detected: {
    unidad: boolean;
    turno: boolean;
    indicador: boolean;
  };
}
