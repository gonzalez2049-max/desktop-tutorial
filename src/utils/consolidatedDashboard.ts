// Núcleo del Dashboard Consolidado IAAS.
//
// NO recalcula ni redefine ninguna fórmula: reutiliza el motor `analyze()` de
// cada auditoría (cumplimiento para prácticas, tasas para vigilancia) y sólo
// AGREGA y PRESENTA los resultados ya calculados. No modifica ningún módulo
// liberado; es puramente aditivo.

import type { AnalysisResult, ParsedWorkbook, ReportConfig } from '../types';
import type { AuditMode } from '../config/programs';
import { analyze, filterWorkbookByPeriod, filterWorkbookByUnit, listUnits, unitCanonicalKey } from './analysis';
import { getProgramConfig } from './programConfig';

/** Auditorías IAAS que integra el dashboard (excluye la genérica «otra»). */
export const DASHBOARD_AUDIT_IDS = [
  'its_cvc',
  'itu_cup',
  'navm',
  'higiene_manos',
  'bundle_cvc',
  'bundle_cup',
  'bundle_navm',
] as const;

export type DashboardAuditId = (typeof DASHBOARD_AUDIT_IDS)[number];

export interface DashboardAudit {
  id: string;
  name: string;
  mode: AuditMode;
  goal: number;
}

/** Metadatos (nombre, modo, meta) de las auditorías del dashboard, desde su config. */
export function dashboardAudits(): DashboardAudit[] {
  const pc = getProgramConfig('IAAS');
  return DASHBOARD_AUDIT_IDS.map((id) => {
    const a = pc.audits?.find((x) => x.id === id);
    return { id, name: a?.name ?? id, mode: (a?.mode ?? 'practicas') as AuditMode, goal: a?.goal ?? pc.goal };
  });
}

export function auditName(id: string): string {
  return dashboardAudits().find((a) => a.id === id)?.name ?? id;
}

/** Datos crudos de un módulo cargado (una auditoría). */
export interface RawModule {
  auditId: string;
  fileName: string;
  workbook: ParsedWorkbook;
}

/** Módulo ya analizado, listo para el dashboard. */
export interface DashModule {
  auditId: string;
  name: string;
  mode: AuditMode;
  goal: number;
  fileName: string;
  analysis: AnalysisResult;
}

export interface DashboardFilters {
  unit: string | null; // null = todas las unidades
  period: string | null; // clave de período mensual; null = todos
}

/** Config del motor para una auditoría (mensual: habilita evolución por mes). */
function configFor(auditId: string, goal: number): ReportConfig {
  return { reportType: 'IAAS', auditId, analysisType: 'mensual', highlights: [], goal };
}

/**
 * Ejecuta el motor `analyze()` por cada módulo, aplicando los filtros de unidad
 * y período reutilizando los mismos helpers de filtrado del motor.
 */
export function analyzeModules(raw: RawModule[], filters: DashboardFilters = { unit: null, period: null }): DashModule[] {
  const audits = dashboardAudits();
  const out: DashModule[] = [];
  for (const r of raw) {
    const meta = audits.find((a) => a.id === r.auditId);
    if (!meta) continue; // ignora ids desconocidos
    let wb = r.workbook;
    if (filters.unit) wb = filterWorkbookByUnit(wb, filters.unit);
    if (filters.period) wb = filterWorkbookByPeriod(wb, filters.period, 'mensual');
    out.push({
      auditId: r.auditId,
      name: meta.name,
      mode: meta.mode,
      goal: meta.goal,
      fileName: r.fileName,
      analysis: analyze(wb, configFor(r.auditId, meta.goal)),
    });
  }
  // Orden estable: primero vigilancias, luego prácticas, según DASHBOARD_AUDIT_IDS.
  const order = new Map(DASHBOARD_AUDIT_IDS.map((id, i) => [id, i] as const));
  return out.sort((a, b) => (order.get(a.auditId as DashboardAuditId) ?? 99) - (order.get(b.auditId as DashboardAuditId) ?? 99));
}

export const vigilanciaModules = (mods: DashModule[]) => mods.filter((m) => m.mode === 'vigilancia' && m.analysis.surveillance);
export const practiceModules = (mods: DashModule[]) => mods.filter((m) => m.mode === 'practicas');

/** Opciones de unidad (unión de las unidades presentes en todos los módulos). */
export function unitOptions(raw: RawModule[]): string[] {
  const byKey = new Map<string, string>();
  for (const r of raw) {
    for (const u of listUnits(r.workbook)) {
      const k = unitCanonicalKey(u);
      const cur = byKey.get(k);
      if (!cur || u.length > cur.length) byKey.set(k, u);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

/** Opciones de período (unión de los períodos mensuales de todos los módulos). */
export function periodOptions(raw: RawModule[]): { key: string; label: string }[] {
  const audits = dashboardAudits();
  const byKey = new Map<string, string>();
  for (const r of raw) {
    const meta = audits.find((a) => a.id === r.auditId);
    const a = analyze(r.workbook, configFor(r.auditId, meta?.goal ?? 90));
    for (const p of a.temporal.periods) byKey.set(p.key, p.label);
  }
  return Array.from(byKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------------------
// Resumen institucional (KPIs)
// ---------------------------------------------------------------------------

export interface InstitutionalSummary {
  integrated: number;
  total: number;
  vigilancias: number;
  practicas: number;
  criticalAlerts: number; // tasas de vigilancia sobre referencia (global)
  bundlesUnderGoal: number; // prácticas bajo meta
  practiceCompliance: number | null; // cumplimiento oficial ponderado de prácticas
  unitsInAlert: number; // unidades con ≥1 alerta (tasa sobre ref o práctica bajo meta)
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function institutionalSummary(mods: DashModule[]): InstitutionalSummary {
  const vig = vigilanciaModules(mods);
  const prac = practiceModules(mods);

  let criticalAlerts = 0;
  for (const m of vig) if (m.analysis.surveillance!.exceedsReference) criticalAlerts += 1;

  let bundlesUnderGoal = 0;
  for (const m of prac) if (m.analysis.global.aplicables > 0 && !m.analysis.global.meetsGoal) bundlesUnderGoal += 1;

  // Cumplimiento de prácticas: promedio ponderado por aplicables (lee cumple/aplicables ya calculados).
  let cumple = 0;
  let aplic = 0;
  for (const m of prac) {
    cumple += m.analysis.global.cumple;
    aplic += m.analysis.global.aplicables;
  }
  const practiceCompliance = aplic > 0 ? round1((cumple / aplic) * 100) : null;

  // Unidades en alerta: unión de unidades con tasa sobre ref (vig) o bajo meta (prac).
  const flagged = new Set<string>();
  for (const m of vig) for (const p of m.analysis.surveillance!.byUnit) if (p.exceedsReference) flagged.add(unitCanonicalKey(p.label));
  for (const m of prac) for (const g of m.analysis.complianceByUnit) if (g.aplicables > 0 && !g.meetsGoal) flagged.add(unitCanonicalKey(g.label));

  return {
    integrated: mods.length,
    total: DASHBOARD_AUDIT_IDS.length,
    vigilancias: vig.length,
    practicas: prac.length,
    criticalAlerts,
    bundlesUnderGoal,
    practiceCompliance,
    unitsInAlert: flagged.size,
  };
}

// ---------------------------------------------------------------------------
// Alertas y brechas
// ---------------------------------------------------------------------------

export interface DashAlert {
  severity: 'crit' | 'warn';
  title: string;
  detail: string;
  sortValue: number; // magnitud de la desviación (para ordenar)
}

export function criticalAlerts(mods: DashModule[]): DashAlert[] {
  const alerts: DashAlert[] = [];
  for (const m of vigilanciaModules(mods)) {
    const s = m.analysis.surveillance!;
    if (s.exceedsReference && s.overallRate !== null && s.reference !== null) {
      alerts.push({
        severity: 'crit',
        title: `${m.name} · global: ${s.overallRate} supera la referencia de ${s.reference}`,
        detail: `Vigilancia · ${s.totalCases} casos / ${s.totalDeviceDays} ${s.denominatorLabel.toLowerCase()} · ${s.unitLabel}`,
        sortValue: s.overallRate - s.reference,
      });
    }
    for (const p of s.byUnit) {
      if (p.exceedsReference && p.rate !== null && p.reference !== null) {
        alerts.push({
          severity: 'crit',
          title: `${m.name} · ${p.label}: ${p.rate} supera la referencia de ${p.reference}`,
          detail: `Vigilancia · ${p.cases} casos / ${p.deviceDays} días · ${m.name}`,
          sortValue: p.rate - p.reference,
        });
      }
    }
  }
  for (const m of practiceModules(mods)) {
    const g = m.analysis.global;
    if (g.aplicables > 0 && !g.meetsGoal) {
      alerts.push({
        severity: 'warn',
        title: `${m.name}: ${g.percent}% bajo la meta de ${m.goal}%`,
        detail: `Práctica · brecha ${round1(g.percent - m.goal)} pp${m.analysis.criticalIndicators[0] ? ` · indicador crítico: ${m.analysis.criticalIndicators[0].label}` : ''}`,
        sortValue: m.goal - g.percent,
      });
    }
  }
  // Críticas primero; dentro de cada grupo, por magnitud de desviación.
  return alerts.sort((a, b) => (a.severity === b.severity ? b.sortValue - a.sortValue : a.severity === 'crit' ? -1 : 1));
}

export interface GapRow {
  auditId: string;
  name: string;
  actual: number | null;
  goal: number;
  gap: number | null;
  meets: boolean;
}

export function complianceGaps(mods: DashModule[]): GapRow[] {
  return practiceModules(mods).map((m) => {
    const g = m.analysis.global;
    const actual = g.aplicables > 0 ? g.percent : null;
    return {
      auditId: m.auditId,
      name: m.name,
      actual,
      goal: m.goal,
      gap: actual === null ? null : round1(actual - m.goal),
      meets: g.meetsGoal,
    };
  });
}

// ---------------------------------------------------------------------------
// Comparación entre unidades (matriz unidad × módulo)
// ---------------------------------------------------------------------------

export type CellState = 'good' | 'warn' | 'crit' | 'none';

export interface MatrixCell {
  value: number | null;
  state: CellState;
}

export interface MatrixRow {
  unit: string;
  cells: Record<string, MatrixCell>;
}

export interface UnitMatrix {
  columns: { id: string; name: string; mode: AuditMode }[];
  rows: MatrixRow[];
}

export function unitMatrix(mods: DashModule[]): UnitMatrix {
  const columns = mods.map((m) => ({ id: m.auditId, name: m.name, mode: m.mode }));

  // Unión de unidades (por clave canónica) preservando la forma más larga.
  const unitByKey = new Map<string, string>();
  for (const m of mods) {
    const src = m.mode === 'vigilancia' ? m.analysis.surveillance!.byUnit.map((p) => p.label) : m.analysis.complianceByUnit.map((g) => g.label);
    for (const label of src) {
      const k = unitCanonicalKey(label);
      if (!k) continue;
      const cur = unitByKey.get(k);
      if (!cur || label.length > cur.length) unitByKey.set(k, label);
    }
  }

  const rows: MatrixRow[] = Array.from(unitByKey.entries())
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .map(([key, unit]) => {
      const cells: Record<string, MatrixCell> = {};
      for (const m of mods) {
        if (m.mode === 'vigilancia') {
          const p = m.analysis.surveillance!.byUnit.find((x) => unitCanonicalKey(x.label) === key);
          if (!p || p.rate === null) cells[m.auditId] = { value: null, state: 'none' };
          else cells[m.auditId] = { value: p.rate, state: p.reference === null ? 'warn' : p.exceedsReference ? 'crit' : 'good' };
        } else {
          const g = m.analysis.complianceByUnit.find((x) => unitCanonicalKey(x.label) === key);
          if (!g || g.aplicables === 0) cells[m.auditId] = { value: null, state: 'none' };
          else cells[m.auditId] = { value: g.percent, state: g.meetsGoal ? 'good' : 'warn' };
        }
      }
      return { unit, cells };
    });

  return { columns, rows };
}

// ---------------------------------------------------------------------------
// Evolución mensual
// ---------------------------------------------------------------------------

export interface EvoSeries {
  auditId: string;
  name: string;
  reference: number | null;
}

export interface EvolutionData {
  labels: { key: string; label: string }[];
  series: EvoSeries[];
  /** Filas listas para Recharts: { label, [auditId]: value }. */
  rows: Record<string, string | number | null>[];
}

function buildEvolution(mods: DashModule[], kind: 'vigilancia' | 'practicas'): EvolutionData {
  const chosen = kind === 'vigilancia' ? vigilanciaModules(mods) : practiceModules(mods);
  // Unión de períodos (key ordenable → label).
  const labelByKey = new Map<string, string>();
  for (const m of chosen) {
    const pts = kind === 'vigilancia' ? m.analysis.surveillance!.byPeriod : m.analysis.temporal.evolution;
    for (const p of pts) labelByKey.set(p.key, p.label);
  }
  const labels = Array.from(labelByKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const series: EvoSeries[] = chosen.map((m) => ({
    auditId: m.auditId,
    name: m.name,
    reference: kind === 'vigilancia' ? m.analysis.surveillance!.reference : m.goal,
  }));

  const rows = labels.map(({ key, label }) => {
    const row: Record<string, string | number | null> = { label };
    for (const m of chosen) {
      if (kind === 'vigilancia') {
        const p = m.analysis.surveillance!.byPeriod.find((x) => x.key === key);
        row[m.auditId] = p ? p.rate : null;
      } else {
        const p = m.analysis.temporal.evolution.find((x) => x.key === key);
        row[m.auditId] = p ? p.percent : null;
      }
    }
    return row;
  });

  return { labels, series, rows };
}

export const rateEvolution = (mods: DashModule[]) => buildEvolution(mods, 'vigilancia');
export const complianceEvolution = (mods: DashModule[]) => buildEvolution(mods, 'practicas');

// ---------------------------------------------------------------------------
// Resumen ejecutivo institucional
// ---------------------------------------------------------------------------

export interface DashExecutive {
  title: string;
  generatedAt: string;
  lead: string;
  vigilanciaText: string;
  practicasText: string;
  recommendations: string[];
}

const fmtRate = (r: number | null) => (r === null ? 's/d' : String(r).replace('.', ','));
const fmtPct = (p: number | null) => (p === null ? 's/d' : `${String(p).replace('.', ',')}%`);

export function institutionalExecutive(mods: DashModule[]): DashExecutive {
  const summary = institutionalSummary(mods);
  const vig = vigilanciaModules(mods);
  const prac = practiceModules(mods);
  const generatedAt = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

  const lead = `El programa de prevención de IAAS integró ${summary.integrated} de ${summary.total} auditorías (${summary.vigilancias} de vigilancia epidemiológica y ${summary.practicas} de prácticas clínicas)${summary.practiceCompliance !== null ? `, con un cumplimiento promedio ponderado de prácticas de ${fmtPct(summary.practiceCompliance)} sobre los indicadores obligatorios` : ''}.`;

  const over = vig.filter((m) => m.analysis.surveillance!.exceedsReference);
  const inRef = vig.filter((m) => !m.analysis.surveillance!.exceedsReference);
  const vigParts: string[] = [];
  if (over.length) {
    vigParts.push(
      `${over.length === 1 ? 'Una tasa supera' : `${over.length} tasas superan`} su referencia institucional: ${over
        .map((m) => `${m.name} (${fmtRate(m.analysis.surveillance!.overallRate)} vs. ${fmtRate(m.analysis.surveillance!.reference)} ${m.analysis.surveillance!.unitLabel})`)
        .join('; ')}.`,
    );
  }
  if (inRef.length) {
    vigParts.push(`${inRef.map((m) => m.name).join(', ')} se ${inRef.length === 1 ? 'mantiene' : 'mantienen'} en referencia.`);
  }
  const vigilanciaText = vigParts.join(' ') || 'Sin auditorías de vigilancia cargadas.';

  const under = prac.filter((m) => m.analysis.global.aplicables > 0 && !m.analysis.global.meetsGoal);
  const meet = prac.filter((m) => m.analysis.global.meetsGoal);
  const pracParts: string[] = [];
  if (meet.length) pracParts.push(`${meet.map((m) => `${m.name} (${fmtPct(m.analysis.global.percent)})`).join(', ')} ${meet.length === 1 ? 'cumple' : 'cumplen'} la meta.`);
  if (under.length) {
    pracParts.push(
      `${under.map((m) => `${m.name} (${fmtPct(m.analysis.global.percent)}, brecha ${round1(m.analysis.global.percent - m.goal)} pp)`).join('; ')} se ${under.length === 1 ? 'ubica' : 'ubican'} bajo la meta.`,
    );
  }
  const practicasText = pracParts.join(' ') || 'Sin auditorías de prácticas cargadas.';

  const recommendations: string[] = [];
  for (const m of over) recommendations.push(`Reforzar las medidas de prevención en ${m.name} en las unidades con tasa sobre referencia.`);
  for (const m of under) {
    const worst = m.analysis.criticalIndicators[0];
    recommendations.push(`Cerrar la brecha de ${m.name}${worst ? ` con foco en «${worst.label}»` : ''}.`);
  }
  if (recommendations.length === 0) recommendations.push('Mantener las medidas vigentes; todos los indicadores están dentro de sus referencias y metas.');

  return {
    title: 'Resumen ejecutivo institucional · IAAS',
    generatedAt,
    lead,
    vigilanciaText,
    practicasText,
    recommendations,
  };
}
