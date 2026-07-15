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

/**
 * Dimensión adicional de desglose del cumplimiento (además de unidad/turno, que
 * son roles nativos del motor). Permite, por configuración, calcular el
 * cumplimiento por estamento, tipo de higiene, observador, etc. La columna se
 * localiza en el Excel por coincidencia del encabezado con `match`.
 */
export interface AuditBreakdown {
  key: string;
  label: string;
  /** Fragmentos de encabezado (normalizados) que identifican la columna. */
  match: string[];
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
  /** Dimensiones adicionales de desglose del cumplimiento (p. ej. estamento). */
  breakdowns?: AuditBreakdown[];
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
  /** Dimensiones de desglose de la auditoría resuelta (lo fija resolveProgramConfig). */
  breakdowns?: AuditBreakdown[];
  /**
   * Indicadores complementarios de la auditoría resuelta: se informan pero NO
   * cuentan para el cumplimiento oficial (lo fija resolveProgramConfig).
   */
  complementaryIndicators?: string[];
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
    breakdowns: [],
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
      {
        ...auditTemplate('higiene_manos', 'Higiene de Manos', 'Adherencia a la higiene de manos (5 momentos de la OMS)', 'practicas'),
        goal: 90,
        formula: 'Cumplimiento = Cumple / (Cumple + No cumple) × 100, excluyendo N/A.',
        indicators: [
          { name: 'Antes del contacto con el paciente', kind: 'obligatorio' },
          { name: 'Antes de una tarea limpia/aséptica', kind: 'obligatorio' },
          { name: 'Después de exposición a fluidos', kind: 'obligatorio' },
          { name: 'Después del contacto con el paciente', kind: 'obligatorio' },
          { name: 'Después del contacto con el entorno', kind: 'obligatorio' },
        ],
        descriptiveVariables: ['Unidad', 'Turno', 'Estamento', 'Observador', 'Fecha', 'Tipo de higiene'],
        breakdowns: [
          { key: 'estamento', label: 'Estamento', match: ['estamento', 'profesion', 'cargo', 'categoria'] },
          { key: 'tipo_higiene', label: 'Tipo de higiene', match: ['tipo de higiene', 'tipo higiene', 'metodo de higiene', 'tecnica de higiene'] },
          { key: 'observador', label: 'Observador', match: ['observador', 'observadora', 'auditor'] },
        ],
        inclusion: ['Oportunidades de higiene de manos observadas en la atención directa de pacientes.'],
        exclusion: ['Registros sin momento de la OMS identificado o sin resultado (Cumple / No cumple / N/A).'],
        kpis: ['Cumplimiento global', 'Cumplimiento por momento de la OMS', 'Cumplimiento por estamento', 'Oportunidades observadas'],
        charts: ['Velocímetro de cumplimiento global', 'Barras por momento de la OMS', 'Barras por unidad', 'Barras por estamento'],
        tables: [
          'Cumplimiento por indicador (5 momentos)',
          'Cumplimiento por unidad',
          'Cumplimiento por turno',
          'Cumplimiento por estamento',
        ],
        executiveText:
          'Informe de auditoría de adherencia a la higiene de manos según los cinco momentos de la OMS. El cumplimiento se calcula sobre las oportunidades observadas —Cumple / (Cumple + No cumple)—, excluyendo las no aplicables.',
        autoRecommendations: [
          { when: 'below_goal', text: 'Reforzar la técnica y los cinco momentos de la OMS mediante capacitación breve en terreno y retroalimentación inmediata al equipo.' },
          { when: 'below_goal', text: 'Asegurar la disponibilidad y accesibilidad de alcohol gel en el punto de atención.' },
          { when: 'at_or_above_goal', text: 'Sostener el desempeño con observación periódica y reconocimiento al equipo; documentar las prácticas que explican el buen resultado.' },
          { when: 'always', text: 'Garantizar la representatividad de las oportunidades auditadas por unidad, turno y estamento, con observadores capacitados.' },
        ],
      },
      auditTemplate('navm', 'NAVM', 'Neumonía asociada a ventilación mecánica', 'vigilancia'),
      auditTemplate('itu_cup', 'ITU asociada a CUP', 'Infección urinaria asociada a catéter urinario permanente', 'vigilancia'),
      auditTemplate('its_cvc', 'ITS asociada a CVC', 'Infección del torrente sanguíneo asociada a catéter venoso central', 'vigilancia'),
      {
        ...auditTemplate('bundle_cvc', 'Bundle CVC', 'Cumplimiento del paquete de medidas (bundle) de catéter venoso central: inserción y mantención', 'practicas'),
        goal: 95,
        formula: 'Cumplimiento = Cumple / (Cumple + No cumple) × 100, excluyendo N/A.',
        indicators: [
          // Bundle de inserción (obligatorios)
          { name: 'Higiene de manos previa a la inserción', kind: 'obligatorio' },
          { name: 'Precauciones de barrera máxima estéril', kind: 'obligatorio' },
          { name: 'Antisepsia de piel con clorhexidina alcohólica ≥ 0,5 %', kind: 'obligatorio' },
          { name: 'Selección adecuada del sitio de inserción', kind: 'obligatorio' },
          // Bundle de mantención (obligatorios)
          { name: 'Higiene de manos antes de manipular el catéter', kind: 'obligatorio' },
          { name: 'Desinfección de conexiones y puertos (scrub the hub)', kind: 'obligatorio' },
          { name: 'Apósito estéril íntegro y limpio', kind: 'obligatorio' },
          { name: 'Evaluación diaria de la necesidad del catéter', kind: 'obligatorio' },
          // Complementarios (soporte y registro)
          { name: 'Uso de checklist de inserción', kind: 'complementario' },
          { name: 'Registro de fecha y hora de inserción', kind: 'complementario' },
          { name: 'Curación del sitio con técnica aséptica', kind: 'complementario' },
          { name: 'Registro de días de permanencia del catéter', kind: 'complementario' },
        ],
        descriptiveVariables: ['Unidad', 'Turno', 'Estamento', 'Fecha'],
        breakdowns: [
          { key: 'estamento', label: 'Estamento', match: ['estamento', 'profesion', 'cargo', 'categoria'] },
        ],
        inclusion: ['Pacientes con catéter venoso central instalado o en mantención, observados durante la atención.'],
        exclusion: ['Registros sin ítem del bundle identificado o sin resultado (Cumple / No cumple / N/A).'],
        kpis: ['Cumplimiento global del bundle', 'Cumplimiento por indicador', 'Cumplimiento por unidad', 'Cumplimiento por estamento'],
        charts: ['Velocímetro de cumplimiento global', 'Barras por indicador del bundle', 'Barras por unidad', 'Barras por estamento'],
        tables: [
          'Cumplimiento por indicador (bundle CVC)',
          'Cumplimiento por unidad',
          'Cumplimiento por turno',
          'Cumplimiento por estamento',
        ],
        executiveText:
          'Informe de auditoría de cumplimiento del paquete de medidas (bundle) para catéter venoso central, en sus fases de inserción y mantención. El cumplimiento se calcula sobre los ítems observados —Cumple / (Cumple + No cumple)—, excluyendo los no aplicables.',
        autoRecommendations: [
          { when: 'below_goal', text: 'Reforzar la técnica aséptica en inserción y mantención del CVC (barrera máxima estéril, clorhexidina y desinfección de conexiones) mediante capacitación y verificación en terreno.' },
          { when: 'below_goal', text: 'Implementar checklist de inserción y evaluación diaria de la necesidad del catéter para el retiro precoz de líneas innecesarias.' },
          { when: 'at_or_above_goal', text: 'Sostener el cumplimiento del bundle con auditorías periódicas y retroalimentación al equipo; documentar las prácticas que explican el buen resultado.' },
          { when: 'always', text: 'Asegurar la representatividad de las observaciones por unidad, turno y estamento, con observadores capacitados.' },
        ],
      },
      {
        ...auditTemplate('bundle_cup', 'Bundle CUP', 'Cumplimiento del paquete de medidas (bundle) de catéter urinario permanente: inserción y mantención', 'practicas'),
        goal: 95,
        formula: 'Cumplimiento = Cumple / (Cumple + No cumple) × 100, excluyendo N/A.',
        indicators: [
          // Núcleo del bundle CAUTI (obligatorios)
          { name: 'Indicación apropiada y justificada del catéter urinario', kind: 'obligatorio' },
          { name: 'Higiene de manos antes de la inserción y manipulación', kind: 'obligatorio' },
          { name: 'Técnica aséptica e insumos estériles en la inserción', kind: 'obligatorio' },
          { name: 'Antisepsia del meato uretral previa a la inserción', kind: 'obligatorio' },
          { name: 'Sistema de drenaje cerrado estéril, sin desconexiones', kind: 'obligatorio' },
          { name: 'Bolsa de drenaje bajo el nivel de la vejiga y sin contacto con el suelo', kind: 'obligatorio' },
          { name: 'Flujo de orina sin obstrucción (sistema no acodado)', kind: 'obligatorio' },
          { name: 'Evaluación diaria de la necesidad del catéter con retiro precoz', kind: 'obligatorio' },
          // Soporte y registro (complementarios)
          { name: 'Fijación/sujeción del catéter para evitar tracción', kind: 'complementario' },
          { name: 'Higiene diaria del meato / cuidado perineal', kind: 'complementario' },
          { name: 'Vaciamiento de la bolsa con técnica aséptica y recipiente individual', kind: 'complementario' },
          { name: 'Registro de fecha de inserción y días de permanencia', kind: 'complementario' },
        ],
        descriptiveVariables: ['Unidad', 'Turno', 'Estamento', 'Fecha'],
        breakdowns: [
          { key: 'estamento', label: 'Estamento', match: ['estamento', 'profesion', 'cargo', 'categoria'] },
        ],
        inclusion: ['Pacientes con catéter urinario permanente instalado o en mantención, observados durante la atención.'],
        exclusion: ['Registros sin ítem del bundle identificado o sin resultado (Cumple / No cumple / N/A).'],
        kpis: ['Cumplimiento global del bundle', 'Cumplimiento por indicador', 'Cumplimiento por unidad', 'Cumplimiento por estamento'],
        charts: ['Velocímetro de cumplimiento global', 'Barras por indicador del bundle', 'Barras por unidad', 'Barras por estamento'],
        tables: [
          'Cumplimiento por indicador (bundle CUP)',
          'Cumplimiento por unidad',
          'Cumplimiento por turno',
          'Cumplimiento por estamento',
        ],
        executiveText:
          'Informe de auditoría de cumplimiento del paquete de medidas (bundle) para catéter urinario permanente, en sus fases de inserción y mantención, orientado a la prevención de la infección urinaria asociada a catéter. El cumplimiento oficial se calcula sobre los ítems obligatorios observados —Cumple / (Cumple + No cumple)—, excluyendo los no aplicables; los indicadores complementarios se informan aparte.',
        autoRecommendations: [
          { when: 'below_goal', text: 'Reforzar la indicación apropiada del catéter urinario y su retiro precoz mediante evaluación diaria de la necesidad, para reducir los días de exposición.' },
          { when: 'below_goal', text: 'Asegurar la técnica aséptica de inserción, el sistema de drenaje cerrado sin desconexiones y la bolsa bajo el nivel de la vejiga, con capacitación y verificación en terreno.' },
          { when: 'at_or_above_goal', text: 'Sostener el cumplimiento del bundle con auditorías periódicas y retroalimentación al equipo; documentar las prácticas que explican el buen resultado.' },
          { when: 'always', text: 'Asegurar la representatividad de las observaciones por unidad, turno y estamento, con observadores capacitados.' },
        ],
      },
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
