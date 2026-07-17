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

/**
 * Tipo de análisis temporal elegido en el wizard.
 * Los períodos (mensual…anual) segmentan la base y muestran la evolución del
 * cumplimiento sin filtrar; 'comparacion' habilita el contraste de dos períodos.
 */
export type AnalysisType =
  | 'mensual'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | 'comparacion';

/** Configuración final del informe elegida en el wizard. */
export interface ReportConfig {
  reportType: ReportType;
  /** Sub-auditoría dentro del programa (p. ej. IAAS → Higiene de Manos). */
  auditId?: string;
  analysisType: AnalysisType;
  highlights: Highlight[];
  goal: number; // meta de cumplimiento en % (0..100)
  /** Vigilancia: tipo de servicio elegido manualmente para fijar la referencia. */
  serviceType?: string;
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
  /**
   * Solo en «cumplimiento por indicador»: tipo del indicador. Los
   * complementarios se muestran aparte y NO alteran el cumplimiento oficial.
   */
  kind?: 'obligatorio' | 'complementario';
}

/** Cumplimiento agrupado por una dimensión de desglose configurada. */
export interface BreakdownCompliance {
  key: string;
  label: string;
  groups: ComplianceGroup[];
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

/** Fila del plan de acción sugerido. */
export interface ActionPlanRow {
  priority: 'Alta' | 'Media' | 'Baja';
  finding: string;
  action: string;
  responsible: string;
  deadline: string;
  target: string;
}

/** Una sección redactada del resumen ejecutivo. */
export interface ReportSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  actionPlan?: ActionPlanRow[]; // si está presente, la sección se rinde como tabla
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

/** Distribución de LPP por estadio/categoría clínica. */
export interface LppStageCount {
  stage: string;
  count: number;
  percent: number; // sobre el total de pacientes con LPP
}

/**
 * Caracterización clínica de la base (NT 234 / LPP): total original, registros
 * incluidos/excluidos por riesgo y prevalencia de LPP.
 */
export interface ClinicalCharacterization {
  totalOriginal: number;
  highRisk: number; // pacientes con riesgo alto
  moderateRisk: number; // pacientes con riesgo moderado
  includedByRisk: number | null; // riesgo moderado + alto; null = no determinado (falta columna de riesgo)
  excludedByRisk: number | null; // sin riesgo + bajo + no informado + vacío; null = no determinado
  riskColumnDetected: boolean; // se detectó una columna de riesgo utilizable
  riskFilterApplied: boolean; // true solo para NT 234 / LPP con columna de riesgo
  lppPositive: number | null;
  lppAnswered: number | null;
  lppPrevalence: number | null;
  lppStages: LppStageCount[]; // distribución por estadio (vacío si no hay datos)
}

/** Punto de la evolución temporal del cumplimiento (un período). */
export interface EvolutionPoint {
  key: string; // clave ordenable del período (p. ej. "2026-Q1")
  label: string; // etiqueta legible (p. ej. "Q1 2026")
  total: number; // registros aplicables del período
  cumple: number;
  percent: number; // cumplimiento global del período
  meetsGoal: boolean;
}

/** Cumplimiento de un indicador dentro de un período (para la comparación). */
export interface PeriodIndicator {
  label: string;
  percent: number | null; // null = sin datos aplicables en ese período
}

/** Métricas de un período elegido para la comparación lado a lado. */
export interface PeriodSnapshot {
  key: string;
  label: string;
  global: number | null; // % cumplimiento global
  aplicables: number;
  byIndicator: PeriodIndicator[];
  lppPrevalence: number | null;
}

/**
 * Análisis temporal: evolución del cumplimiento por período y, cuando la base
 * tiene columna de fecha, los períodos disponibles para comparar.
 */
export interface TemporalAnalysis {
  hasDate: boolean; // existe columna de fecha utilizable
  granularity: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  evolution: EvolutionPoint[]; // vacío si no hay fecha
  periods: { key: string; label: string }[]; // períodos disponibles para comparar
}

/** Tasa de vigilancia de una categoría (unidad o período): num/den × factor. */
export interface SurveillanceRatePoint {
  key: string; // clave ordenable (unidad o período)
  label: string; // etiqueta legible
  cases: number; // numerador (p. ej. casos ITS-CVC)
  deviceDays: number; // denominador (p. ej. días CVC)
  rate: number | null; // cases/deviceDays × factor; null si deviceDays = 0
  reference: number | null; // referencia aplicable (por servicio) o null si no determinada
  exceedsReference: boolean; // rate > reference
  service?: string; // tipo de servicio detectado (solo por unidad)
  serviceLabel?: string; // etiqueta del servicio (p. ej. "Medicina")
}

/** Referencia por tipo de servicio disponible para el selector. */
export interface ServiceReferenceOption {
  service: string;
  label: string;
  reference: number;
}

/**
 * Análisis de vigilancia epidemiológica (tasas num/den × factor). NO usa la
 * fórmula de cumplimiento. Se calcula solo para auditorías en modo 'vigilancia'.
 */
export interface SurveillanceAnalysis {
  rateName: string; // p. ej. "Tasa de ITS-CVC"
  unitLabel: string; // p. ej. "por 1.000 días de CVC"
  numeratorLabel: string; // p. ej. "Casos de ITS-CVC"
  denominatorLabel: string; // p. ej. "Días de exposición a CVC"
  factor: number; // p. ej. 1000
  reference: number | null; // referencia global (uniforme o manual) o null si mixta
  totalCases: number; // Σ numerador
  totalDeviceDays: number; // Σ denominador
  overallRate: number | null; // Σcasos / Σdías × factor
  exceedsReference: boolean; // tasa global > referencia (si aplica)
  byUnit: SurveillanceRatePoint[]; // resultado por unidad
  byPeriod: SurveillanceRatePoint[]; // resultado por período (evolución)
  hasDate: boolean; // existe columna de período utilizable
  granularityLabel: string; // etiqueta del período (mensual/trimestral…)
  totalPatientDays: number | null; // Σ días paciente (si existe)
  utilizationRatio: number | null; // días dispositivo / días paciente
  numeratorFound: boolean; // se localizó la columna del numerador
  denominatorFound: boolean; // se localizó la columna del denominador
  /** Formato detectado del Excel: agregado (unidad×período) o línea por caso. */
  format: 'aggregated' | 'line_list';
  /** Referencias por categoría disponibles (para el selector). */
  services: ServiceReferenceOption[];
  /** Etiqueta de la dimensión de referencia (p. ej. "Servicio" o "Población"). */
  referenceLabel: string;
  /** Categoría elegida manualmente (o null si automático). */
  selectedService: string | null;
  /** Modo de referencia: uniforme, por unidad (mixta), manual o sin referencia. */
  referenceMode: 'uniform' | 'per_unit' | 'manual' | 'none';
  /** Hay unidades cuyo servicio no se identificó y no hay selección manual. */
  hasUnresolvedService: boolean;
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
  /** Desgloses adicionales por dimensión configurada (p. ej. estamento). */
  complianceByBreakdown: BreakdownCompliance[];
  criticalIndicators: ComplianceGroup[]; // bajo la meta
  highlightedIndicators: ComplianceGroup[]; // sobre o en la meta
  descriptiveVariables: DescriptiveVariable[]; // prevalencia (no cumplimiento)
  characterization: ClinicalCharacterization;
  temporal: TemporalAnalysis;
  /** Análisis de vigilancia (solo auditorías en modo 'vigilancia'). */
  surveillance?: SurveillanceAnalysis;
  detected: {
    unidad: boolean;
    turno: boolean;
    indicador: boolean;
  };
}
