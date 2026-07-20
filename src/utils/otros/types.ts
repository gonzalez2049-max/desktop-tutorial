// Módulo independiente «Otros informes»: tipos de configuración y de resultado.
// No depende de NT 234, IAAS ni RNAO. Su motor es genérico y configurable.

import type { Granularity } from '../periods';

/** Tipo de análisis que ofrece el asistente. */
export type OtrosReportType = 'cumplimiento' | 'frecuencia' | 'tasa' | 'evolucion' | 'comparacion' | 'descriptivo';

/** Tipo/rol asignado a cada columna del archivo (detección + corrección manual). */
export type OtrosColType = 'texto' | 'numerica' | 'fecha' | 'categoria' | 'unidad' | 'resultado' | 'ignorar';

export const OTROS_REPORT_TYPES: { value: OtrosReportType; label: string; description: string; icon: string }[] = [
  { value: 'cumplimiento', label: 'Cumplimiento', description: 'Cumple / (Cumple + No cumple) × 100, excluyendo N/A', icon: '✅' },
  { value: 'frecuencia', label: 'Frecuencia o conteo', description: 'Recuento de casos por categoría', icon: '🔢' },
  { value: 'tasa', label: 'Tasa', description: 'Numerador / denominador × factor', icon: '➗' },
  { value: 'evolucion', label: 'Evolución temporal', description: 'La métrica elegida a lo largo del tiempo', icon: '📈' },
  { value: 'comparacion', label: 'Comparación entre grupos', description: 'La métrica por unidad o categoría', icon: '⚖️' },
  { value: 'descriptivo', label: 'Caracterización descriptiva', description: 'Prevalencia / distribución de variables', icon: '🧬' },
];

export const OTROS_COL_TYPES: { value: OtrosColType; label: string }[] = [
  { value: 'texto', label: 'Texto' },
  { value: 'numerica', label: 'Numérica' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'categoria', label: 'Categoría' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'resultado', label: 'Resultado (Cumple/No)' },
  { value: 'ignorar', label: 'Ignorar' },
];

/** Métrica a medir en evolución / comparación. */
export type OtrosMetric = 'conteo' | 'promedio' | 'suma' | 'cumplimiento';

/** Configuración de un informe (también se guarda como plantilla reutilizable). */
export interface OtrosConfig {
  id: string;
  name: string;
  objective: string;
  reportType: OtrosReportType;
  /** Tipo asignado a cada columna (por encabezado). */
  mapping: Record<string, OtrosColType>;
  // Columnas principales según el tipo:
  complianceCols: string[]; // cumplimiento
  numeratorCol: string | null; // tasa
  denominatorCol: string | null; // tasa
  factor: number; // tasa
  valueCol: string | null; // métrica numérica (evolución/comparación con promedio/suma)
  metric: OtrosMetric; // evolución/comparación
  dimensionCol: string | null; // comparación/frecuencia: unidad o categoría
  dateCol: string | null; // evolución
  granularity: Granularity;
  descriptiveCols: string[]; // descriptivo
  complementaryCols: string[]; // complementarias (informativas)
  goal: number | null; // meta/referencia (opcional)
  inclusion: string;
  exclusion: string;
  naMode: 'excluir' | 'no_cumple';
  breakdowns: string[]; // columnas de desglose
}

export interface OtrosKpi { label: string; value: string; hint?: string; tone?: 'ok' | 'alert' | 'neutral'; }
export interface OtrosTable { headers: string[]; rows: (string | number)[][]; }
export interface OtrosSeriesPoint { key: string; label: string; value: number | null; }
export interface OtrosDescriptive { label: string; positive: number; answered: number; percent: number; }

export interface OtrosResult {
  config: OtrosConfig;
  formula: string;
  totalRecords: number;
  kpis: OtrosKpi[];
  mainTable: OtrosTable | null;
  temporal: OtrosSeriesPoint[];
  comparison: OtrosTable | null;
  breakdowns: { label: string; table: OtrosTable }[];
  descriptive: OtrosDescriptive[];
  findings: string[];
  gaps: string[];
  alerts: string[];
  summary: string[];
  recommendations: string[];
  /** Advertencias para la pantalla de validación. */
  warnings: string[];
}

/** Crea una configuración vacía por defecto. */
export function emptyOtrosConfig(): OtrosConfig {
  return {
    id: '',
    name: '',
    objective: '',
    reportType: 'cumplimiento',
    mapping: {},
    complianceCols: [],
    numeratorCol: null,
    denominatorCol: null,
    factor: 1000,
    valueCol: null,
    metric: 'conteo',
    dimensionCol: null,
    dateCol: null,
    granularity: 'mensual',
    descriptiveCols: [],
    complementaryCols: [],
    goal: null,
    inclusion: '',
    exclusion: '',
    naMode: 'excluir',
    breakdowns: [],
  };
}
