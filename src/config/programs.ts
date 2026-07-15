// Configuración por programa clínico (NT 234, IAAS, Caídas, Dolor, Accesos
// Vasculares, Personalizado). Centraliza todo lo que puede variar entre módulos
// para que crear uno nuevo solo requiera añadir/editar su configuración aquí,
// sin tocar el motor de análisis.
import type { ReportType } from '../types';
import { normalize } from '../utils/columnDetection';
import { NT234_INDICATORS, canonicalIndicatorNT234 } from '../utils/nt234';

/** Colores del semáforo de cumplimiento (verde / amarillo / rojo). */
export interface TrafficColors {
  verde: string;
  amarillo: string;
  rojo: string;
}

/** Campos editables de un programa (persistibles, sin lógica). */
export interface ProgramConfigEditable {
  /** Nombre del programa. */
  programName: string;
  /** Nombre de la institución. */
  institutionName: string;
  /** Nombre de la unidad (etiqueta por defecto). */
  unitName: string;
  /** Logo institucional (emoji o data URI). */
  logo: string;
  /** Meta institucional de cumplimiento (%). */
  goal: number;
  /** Colores del semáforo. */
  traffic: TrafficColors;
  /** Texto base del resumen ejecutivo (preámbulo institucional). */
  executiveBaseText: string;
  /** Indicadores oficiales del programa. */
  officialIndicators: string[];
  /** Variables descriptivas (prevalencia; NO forman parte del cumplimiento). */
  descriptiveVariables: string[];
}

/**
 * Modo de análisis de una auditoría:
 * - 'practicas': cumplimiento = cumple / (cumple + no cumple) × 100 (excluye N/A).
 * - 'vigilancia': tasas epidemiológicas (numerador/denominador). No aplica la
 *   fórmula de cumplimiento automáticamente.
 */
export type AuditMode = 'practicas' | 'vigilancia';

/** Indicador de una auditoría (obligatorio o complementario). */
export interface AuditIndicator {
  name: string;
  kind: 'obligatorio' | 'complementario';
}

/** Tasa de vigilancia epidemiológica (numerador / denominador × factor). */
export interface SurveillanceRate {
  name: string;
  numerator: string; // descripción del numerador
  denominator: string; // descripción del denominador (p. ej. días dispositivo)
  factor: number; // p. ej. 1000
  unit: string; // p. ej. "por 1000 días de VM"
  reference?: number; // referencia / meta
}

/** Condición que dispara una recomendación automática. */
export type RecommendationTrigger = 'always' | 'below_goal' | 'at_or_above_goal';

/** Recomendación automática: se muestra según el resultado (meta) de la auditoría. */
export interface AutoRecommendation {
  when: RecommendationTrigger;
  text: string;
}

/**
 * Plantilla de exportación (Word y PDF) de una auditoría: títulos, notas
 * institucionales y qué secciones incluir. La consume el motor de exportación.
 */
export interface AuditReportTemplate {
  pdfTitle: string;
  wordTitle: string;
  headerNote: string;
  footerNote: string;
  includeExecutiveSummary: boolean;
  includeKpis: boolean;
  includeCharts: boolean;
  includeTables: boolean;
  includeRecommendations: boolean;
  includeSignature: boolean;
}

/** Plantilla de exportación por defecto (todas las secciones activas). */
export const DEFAULT_REPORT_TEMPLATE: AuditReportTemplate = {
  pdfTitle: '',
  wordTitle: '',
  headerNote: '',
  footerNote: '',
  includeExecutiveSummary: true,
  includeKpis: true,
  includeCharts: true,
  includeTables: true,
  includeRecommendations: true,
  includeSignature: true,
};

/**
 * Variante de auditoría dentro de un programa (p. ej. IAAS → Higiene de Manos,
 * NAVM, ITU/CUP, ITS/CVC, Bundle…). Cada variante define TODA su lógica por
 * configuración y se fusiona sobre el programa al analizar, sin duplicar el motor.
 */
export interface AuditVariant {
  id: string;
  name: string;
  description?: string;
  /** Modo de análisis: auditoría de prácticas o vigilancia epidemiológica. */
  mode: AuditMode;
  /** Indicadores obligatorios y complementarios (modo prácticas). */
  indicators: AuditIndicator[];
  /** Variables descriptivas (no forman parte del cumplimiento). */
  descriptiveVariables: string[];
  /** Meta o referencia de cumplimiento (modo prácticas). */
  goal?: number;
  /** Filtros de inclusión / exclusión (reglas por auditoría). */
  inclusion: string[];
  exclusion: string[];
  /** Tasas de vigilancia epidemiológica (numerador/denominador/factor). */
  rates: SurveillanceRate[];
  /** Fórmula de cálculo (descriptiva/configurable, propia de la auditoría). */
  formula?: string;
  /** KPIs, gráficos y tablas a destacar (identificadores, configurables). */
  kpis: string[];
  charts: string[];
  tables?: string[];
  /** Resumen ejecutivo y recomendaciones propias de la auditoría. */
  executiveText: string;
  recommendations: string[];
  /** Recomendaciones automáticas según el resultado (meta) de la auditoría. */
  autoRecommendations?: AutoRecommendation[];
  /** Plantilla de exportación (Word y PDF) propia de la auditoría. */
  template?: AuditReportTemplate;
  /** ¿Aplica filtro de riesgo? IAAS = false (no usa el filtro de NT 234). */
  riskFilter?: boolean;
}

/** Configuración completa de un programa (editable + lógica no editable). */
export interface ProgramConfig extends ProgramConfigEditable {
  reportType: ReportType;
  /** Sub-auditorías del programa (p. ej. IAAS). Ausente = programa simple. */
  audits?: AuditVariant[];
  /** Modo de la auditoría resuelta (lo fija resolveProgramConfig). */
  auditMode?: AuditMode;
  /**
   * ¿El cumplimiento se calcula solo sobre pacientes de riesgo alto/moderado?
   * Es un parámetro de lógica del programa, no editable desde la UI.
   */
  riskFilter: boolean;
  /** Canonicaliza el nombre de un indicador; null si no reconoce ninguno. */
  canonicalizeIndicator: (label: unknown) => string | null;
}

/** Canonicalizador genérico: compara contra la lista oficial por texto normalizado. */
function matchAgainstList(list: string[]): (label: unknown) => string | null {
  return (label: unknown) => {
    const n = normalize(label);
    if (!n) return null;
    for (const ind of list) {
      const ni = normalize(ind);
      if (ni && (ni === n || n.includes(ni) || ni.includes(n))) return ind;
    }
    return null;
  };
}

const DEFAULT_TRAFFIC: TrafficColors = { verde: '#66BB6A', amarillo: '#F59E0B', rojo: '#EF4444' };

/** Programa aún no operativo (plantilla para módulos futuros). */
function stubProgram(reportType: ReportType, programName: string): ProgramConfig {
  return {
    reportType,
    programName,
    institutionName: 'Institución de Salud',
    unitName: 'Unidad clínica',
    logo: '🏥',
    goal: 90,
    traffic: { ...DEFAULT_TRAFFIC },
    executiveBaseText: '',
    officialIndicators: [],
    descriptiveVariables: [],
    riskFilter: false,
    canonicalizeIndicator: () => null,
  };
}

/** Plantilla de auditoría IAAS: estructura completa vacía, lista para configurar. */
function auditTemplate(id: string, name: string, description: string, mode: AuditMode): AuditVariant {
  return {
    id,
    name,
    description,
    mode,
    indicators: [],
    descriptiveVariables: [],
    inclusion: [],
    exclusion: [],
    rates: [],
    formula: '',
    kpis: [],
    charts: [],
    tables: [],
    executiveText: '',
    recommendations: [],
    autoRecommendations: [],
    template: { ...DEFAULT_REPORT_TEMPLATE },
    riskFilter: false,
  };
}

/** Auditoría vacía lista para el asistente de configuración (id provisional). */
export function createEmptyAudit(mode: AuditMode = 'practicas'): AuditVariant {
  return auditTemplate('', '', '', mode);
}

/** Configuración por defecto de cada programa. Solo NT 234 está configurado. */
export const DEFAULT_PROGRAMS: Record<ReportType, ProgramConfig> = {
  NT234_LPP: {
    reportType: 'NT234_LPP',
    programName: 'NT 234 / LPP',
    institutionName: 'Institución de Salud',
    unitName: 'Unidad clínica',
    logo: '🛏️',
    goal: 90,
    traffic: { ...DEFAULT_TRAFFIC },
    executiveBaseText:
      'Informe de auditoría clínica del programa de prevención de lesiones por presión (NT 234 / LPP). El análisis considera únicamente a los pacientes de riesgo moderado y alto, conforme al alcance del protocolo.',
    officialIndicators: [...NT234_INDICATORS],
    descriptiveVariables: ['¿Tiene LPP?', 'Con LPP', 'Presencia de LPP'],
    riskFilter: true,
    canonicalizeIndicator: canonicalIndicatorNT234,
  },
  IAAS: {
    ...stubProgram('IAAS', 'IAAS'),
    logo: '🦠',
    executiveBaseText:
      'Informe de auditoría del programa de prevención y control de Infecciones Asociadas a la Atención en Salud (IAAS).',
    // Sub-auditorías IAAS: plantillas configurables. Aún sin indicadores ni
    // fórmulas específicas; cada una se completará por configuración sin tocar
    // el motor. IAAS nunca usa el filtro de riesgo ni la caracterización de LPP.
    audits: [
      auditTemplate('higiene_manos', 'Higiene de Manos', 'Adherencia a la higiene de manos (5 momentos de la OMS)', 'practicas'),
      auditTemplate('navm', 'NAVM', 'Neumonía asociada a ventilación mecánica', 'vigilancia'),
      auditTemplate('itu_cup', 'ITU asociada a CUP', 'Infección urinaria asociada a catéter urinario permanente', 'vigilancia'),
      auditTemplate('its_cvc', 'ITS asociada a CVC', 'Infección del torrente sanguíneo asociada a catéter venoso central', 'vigilancia'),
      auditTemplate('bundle', 'Bundle IAAS', 'Cumplimiento de paquetes de medidas (bundles) de prevención', 'practicas'),
      auditTemplate('otra', 'Otra auditoría IAAS', 'Auditoría IAAS genérica configurable', 'practicas'),
    ],
  },
  Dolor: stubProgram('Dolor', 'Dolor'),
  Caidas: stubProgram('Caidas', 'Caídas'),
  AccesosVasculares: stubProgram('AccesosVasculares', 'Accesos Vasculares'),
  Personalizado: stubProgram('Personalizado', 'Otro informe personalizado'),
};

/**
 * Rehidrata el canonicalizador de un programa a partir de su lista de
 * indicadores. Se usa cuando la configuración proviene de overrides guardados
 * (que no persisten funciones): NT 234 conserva su matcher difuso; el resto usa
 * la coincidencia genérica contra la lista oficial.
 */
export function canonicalizerFor(reportType: ReportType, officialIndicators: string[]): (label: unknown) => string | null {
  if (reportType === 'NT234_LPP') return canonicalIndicatorNT234;
  if (officialIndicators.length > 0) return matchAgainstList(officialIndicators);
  return () => null;
}
