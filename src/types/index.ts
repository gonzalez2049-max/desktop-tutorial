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

/**
 * Resumen ligero calculado tras "Generar reporte". No es el dashboard avanzado:
 * solo confirma que la lectura del Excel y la configuración inteligente funcionan.
 */
export interface ReportSummary {
  config: ReportConfig;
  totalRows: number;
  applicableRows: number;
  cumple: number;
  noCumple: number;
  noAplica: number;
  globalPercent: number;
  meetsGoal: boolean;
  detectedDimensions: {
    unidad: boolean;
    turno: boolean;
    indicador: boolean;
    fecha: boolean;
    riesgo: boolean;
  };
}
