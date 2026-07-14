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
 * Variante de auditoría dentro de un programa (p. ej. IAAS → Higiene de Manos,
 * NAVM, ITU/CUP, ITS/CVC). Cada variante aporta sus propios indicadores y reglas
 * sin duplicar el motor: se fusiona sobre el programa al analizar.
 */
export interface AuditVariant {
  id: string;
  name: string;
  description?: string;
  /** Indicadores oficiales de la variante (vacío = detección genérica). */
  officialIndicators: string[];
  /** Variables descriptivas (no cumplimiento) de la variante. */
  descriptiveVariables: string[];
  /** ¿Filtra por riesgo alto/moderado? (como NT 234). */
  riskFilter: boolean;
  /** Meta específica; si se omite usa la del programa. */
  goal?: number;
}

/** Configuración completa de un programa (editable + lógica no editable). */
export interface ProgramConfig extends ProgramConfigEditable {
  reportType: ReportType;
  /** Sub-auditorías del programa (p. ej. IAAS). Ausente = programa simple. */
  audits?: AuditVariant[];
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
    // Sub-auditorías IAAS: por ahora plantillas sin indicadores (se completan
    // más adelante sin modificar el motor).
    audits: [
      { id: 'higiene_manos', name: 'Higiene de Manos', description: 'Adherencia a la higiene de manos (5 momentos)', officialIndicators: [], descriptiveVariables: [], riskFilter: false },
      { id: 'navm', name: 'NAVM', description: 'Neumonía asociada a ventilación mecánica', officialIndicators: [], descriptiveVariables: [], riskFilter: false },
      { id: 'itu_cup', name: 'ITU / CUP', description: 'Infección urinaria asociada a catéter urinario permanente', officialIndicators: [], descriptiveVariables: [], riskFilter: false },
      { id: 'its_cvc', name: 'ITS / CVC', description: 'Infección del torrente sanguíneo asociada a catéter venoso central', officialIndicators: [], descriptiveVariables: [], riskFilter: false },
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
