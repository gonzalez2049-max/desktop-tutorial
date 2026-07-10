import type { AnalysisType, Highlight, ReportType } from '../types';
import type { Granularity } from '../utils/periods';

/** Opciones de tipo de informe para el wizard. */
export const REPORT_TYPES: { value: ReportType; label: string; description: string; icon: string }[] = [
  { value: 'NT234_LPP', label: 'NT 234 / LPP', description: 'Prevención de lesiones por presión', icon: '🛏️' },
  { value: 'IAAS', label: 'IAAS', description: 'Infecciones asociadas a la atención en salud', icon: '🦠' },
  { value: 'Dolor', label: 'Dolor', description: 'Manejo y evaluación del dolor', icon: '📊' },
  { value: 'Caidas', label: 'Caídas', description: 'Prevención de caídas', icon: '⚠️' },
  { value: 'AccesosVasculares', label: 'Accesos Vasculares', description: 'Manejo de accesos vasculares', icon: '💉' },
  { value: 'Personalizado', label: 'Otro informe personalizado', description: 'Auditoría genérica configurable', icon: '🧩' },
];

/** Opciones de datos a destacar. */
export const HIGHLIGHTS: { value: Highlight; label: string; description: string; requires?: 'unidad' | 'turno' | 'indicador' | 'fecha' | 'riesgo' }[] = [
  { value: 'cumplimiento_global', label: 'Cumplimiento global', description: 'Indicador general de toda la auditoría' },
  { value: 'cumplimiento_unidad', label: 'Cumplimiento por unidad', description: 'Desglose por servicio o área clínica', requires: 'unidad' },
  { value: 'cumplimiento_turno', label: 'Cumplimiento por turno', description: 'Desglose por jornada', requires: 'turno' },
  { value: 'indicadores_criticos', label: 'Indicadores críticos', description: 'Los indicadores con peor desempeño', requires: 'indicador' },
  { value: 'pacientes_alto_riesgo', label: 'Pacientes de alto riesgo', description: 'Casos marcados como riesgo alto', requires: 'riesgo' },
  { value: 'brechas', label: 'Brechas principales', description: 'Distancia frente a la meta definida' },
  { value: 'recomendaciones', label: 'Recomendaciones operativas', description: 'Acciones sugeridas según los hallazgos' },
  { value: 'comparacion_mensual', label: 'Comparación mensual', description: 'Evolución del cumplimiento en el tiempo', requires: 'fecha' },
];

/** Tipos de análisis temporal para el wizard. */
export const ANALYSIS_TYPES: { value: AnalysisType; label: string; description: string; icon: string }[] = [
  { value: 'mensual', label: 'Informe mensual', description: 'Segmenta la base por mes y muestra la evolución', icon: '📅' },
  { value: 'trimestral', label: 'Informe trimestral', description: 'Agrupa por trimestre (Q1–Q4) y muestra la evolución', icon: '🗓️' },
  { value: 'semestral', label: 'Informe semestral', description: 'Agrupa por semestre y muestra la evolución', icon: '📆' },
  { value: 'anual', label: 'Informe anual', description: 'Agrupa por año y muestra la evolución', icon: '📈' },
  { value: 'comparacion', label: 'Comparación entre períodos', description: 'Contrasta dos períodos elegidos lado a lado (Δ)', icon: '⚖️' },
];

/** Metas de cumplimiento sugeridas. */
export const GOAL_PRESETS = [80, 85, 90, 95];

/** Etiqueta legible para un tipo de informe. */
export function reportTypeLabel(value: ReportType): string {
  return REPORT_TYPES.find((r) => r.value === value)?.label ?? 'Informe';
}

/** Etiqueta legible para un tipo de análisis. */
export function analysisTypeLabel(value: AnalysisType): string {
  return ANALYSIS_TYPES.find((a) => a.value === value)?.label ?? 'Análisis';
}

/**
 * Granularidad de agrupación temporal para un tipo de análisis.
 * La comparación usa la granularidad más fina (mensual) para elegir períodos.
 */
export function granularityFor(value: AnalysisType): Granularity {
  switch (value) {
    case 'trimestral':
      return 'trimestral';
    case 'semestral':
      return 'semestral';
    case 'anual':
      return 'anual';
    case 'mensual':
    case 'comparacion':
    default:
      return 'mensual';
  }
}

/** Etiqueta legible para un highlight. */
export function highlightLabel(value: Highlight): string {
  return HIGHLIGHTS.find((h) => h.value === value)?.label ?? value;
}
