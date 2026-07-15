// Lectura y persistencia de la configuración por programa. Los valores por
// defecto viven en config/programs.ts; aquí se aplican los ajustes que el
// usuario guarda (localStorage), de forma independiente para cada programa.
import { DEFAULT_PROGRAMS, canonicalizerFor, type AuditVariant, type ProgramConfig, type ProgramConfigEditable } from '../config/programs';
import type { ReportConfig, ReportType } from '../types';

const storageKey = (rt: ReportType) => `nex-program-config:${rt}`;
const auditsKey = (rt: ReportType) => `nex-program-audits:${rt}`;

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
 * Auditorías guardadas de un programa (lista completa que reemplaza a las de
 * fábrica). Null si el usuario no ha personalizado ninguna → se usan las
 * plantillas por defecto. Las auditorías son datos puros (sin funciones), por lo
 * que se serializan directamente.
 */
function loadAudits(rt: ReportType): AuditVariant[] | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(auditsKey(rt));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuditVariant[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
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
  // Auditorías personalizadas (si las hay) reemplazan a las de fábrica; si no,
  // se mantienen las plantillas por defecto del programa.
  const audits = loadAudits(rt) ?? base.audits;
  return {
    ...base,
    ...ov,
    reportType: base.reportType,
    traffic: { ...base.traffic, ...(ov.traffic ?? {}) },
    officialIndicators,
    audits,
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

/** Auditorías efectivas de un programa (personalizadas o por defecto). */
export function getProgramAudits(rt: ReportType): AuditVariant[] {
  return getProgramConfig(rt).audits ?? [];
}

/** Persiste la lista completa de auditorías de un programa. */
function saveAudits(rt: ReportType, audits: AuditVariant[]): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(auditsKey(rt), JSON.stringify(audits));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/**
 * Crea o actualiza una auditoría del programa (upsert por id). Parte de la lista
 * efectiva actual (personalizada o de fábrica) para no perder las demás.
 */
export function saveAudit(rt: ReportType, audit: AuditVariant): void {
  const current = getProgramAudits(rt);
  const idx = current.findIndex((a) => a.id === audit.id);
  const next = idx >= 0 ? current.map((a) => (a.id === audit.id ? audit : a)) : [...current, audit];
  saveAudits(rt, next);
}

/** Elimina una auditoría del programa por id. */
export function deleteAudit(rt: ReportType, id: string): void {
  const next = getProgramAudits(rt).filter((a) => a.id !== id);
  saveAudits(rt, next);
}

/** Restablece las auditorías del programa a las plantillas por defecto. */
export function resetAudits(rt: ReportType): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(auditsKey(rt));
  } catch {
    /* noop */
  }
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
  // Indicadores de la auditoría (obligatorios + complementarios) por nombre.
  const officialIndicators = audit.indicators.map((i) => i.name);
  return {
    ...base,
    auditMode: audit.mode,
    breakdowns: audit.breakdowns ?? [],
    officialIndicators,
    descriptiveVariables: audit.descriptiveVariables,
    // IAAS no usa el filtro de riesgo de NT 234 (salvo que una variante lo pida).
    riskFilter: audit.riskFilter ?? false,
    goal: audit.goal ?? base.goal,
    executiveBaseText: audit.executiveText || base.executiveBaseText,
    canonicalizeIndicator: canonicalizerFor(config.reportType, officialIndicators),
  };
}
