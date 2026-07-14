// Lectura y persistencia de la configuración por programa. Los valores por
// defecto viven en config/programs.ts; aquí se aplican los ajustes que el
// usuario guarda (localStorage), de forma independiente para cada programa.
import { DEFAULT_PROGRAMS, canonicalizerFor, type ProgramConfig, type ProgramConfigEditable } from '../config/programs';
import type { ReportConfig, ReportType } from '../types';

const storageKey = (rt: ReportType) => `nex-program-config:${rt}`;

/** ¿Hay localStorage disponible? (falso en Node / SSR / entornos restringidos). */
function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

/** Ajustes guardados para un programa (solo campos editables). */
function loadOverride(rt: ReportType): Partial<ProgramConfigEditable> {
  if (!hasStorage()) return {};
  try {
    const raw = localStorage.getItem(storageKey(rt));
    return raw ? (JSON.parse(raw) as Partial<ProgramConfigEditable>) : {};
  } catch {
    return {};
  }
}

/**
 * Configuración efectiva de un programa: valores por defecto combinados con los
 * ajustes guardados por el usuario. Reconstruye el canonicalizador a partir de
 * los indicadores oficiales (las funciones no se persisten).
 */
export function getProgramConfig(rt: ReportType): ProgramConfig {
  const base = DEFAULT_PROGRAMS[rt];
  const ov = loadOverride(rt);
  const officialIndicators = ov.officialIndicators ?? base.officialIndicators;
  return {
    ...base,
    ...ov,
    reportType: base.reportType,
    traffic: { ...base.traffic, ...(ov.traffic ?? {}) },
    officialIndicators,
    canonicalizeIndicator: canonicalizerFor(rt, officialIndicators),
  };
}

/** Guarda (fusiona) ajustes editables de un programa. */
export function saveProgramConfig(rt: ReportType, patch: Partial<ProgramConfigEditable>): void {
  if (!hasStorage()) return;
  try {
    const current = loadOverride(rt);
    localStorage.setItem(storageKey(rt), JSON.stringify({ ...current, ...patch }));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/** Restablece un programa a su configuración por defecto. */
export function resetProgramConfig(rt: ReportType): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(storageKey(rt));
  } catch {
    /* noop */
  }
}

/** Configuración por defecto (sin ajustes) de un programa. */
export function getProgramDefaults(rt: ReportType): ProgramConfig {
  return DEFAULT_PROGRAMS[rt];
}

/**
 * Configuración efectiva para un informe: la del programa con la variante de
 * auditoría elegida fusionada encima (indicadores, descriptivas, filtro de
 * riesgo, meta y canonicalizador). Si no hay variante, devuelve el programa tal
 * cual — por eso NT 234 (sin sub-auditorías) se comporta idéntico.
 */
export function resolveProgramConfig(config: ReportConfig): ProgramConfig {
  const base = getProgramConfig(config.reportType);
  const audit = config.auditId ? base.audits?.find((a) => a.id === config.auditId) : undefined;
  if (!audit) return base;
  return {
    ...base,
    officialIndicators: audit.officialIndicators,
    descriptiveVariables: audit.descriptiveVariables,
    riskFilter: audit.riskFilter,
    goal: audit.goal ?? base.goal,
    canonicalizeIndicator: canonicalizerFor(config.reportType, audit.officialIndicators),
  };
}
