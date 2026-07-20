// Motor genérico del módulo «Otros informes». Calcula cualquiera de los 6 tipos
// de informe a partir de la configuración del asistente. Independiente del resto
// de módulos; reutiliza solo utilidades neutras (clasificación, períodos).

import type { ParsedWorkbook, RawRow } from '../../types';
import { classifyCompliance, looksLikeDate, normalize } from '../columnDetection';
import { detectDateOrder, periodKey, periodLabel } from '../periods';
import type { OtrosColType, OtrosConfig, OtrosResult, OtrosSeriesPoint } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/** Filas de datos reales (descarta filas totalmente vacías). */
function dataRows(wb: ParsedWorkbook): RawRow[] {
  return wb.rows.filter((r) => wb.headers.some((h) => !isEmpty(r[h])));
}

/** Detección automática del tipo de cada columna (corregible por el usuario). */
export function autoMapColumns(wb: ParsedWorkbook): Record<string, OtrosColType> {
  const rows = dataRows(wb).slice(0, 80);
  const out: Record<string, OtrosColType> = {};
  for (const h of wb.headers) {
    const vals = rows.map((r) => r[h]).filter((v) => !isEmpty(v));
    const n = vals.length || 1;
    const comp = vals.filter((v) => classifyCompliance(v) !== 'desconocido').length / n;
    const dates = vals.filter((v) => looksLikeDate(v)).length / n;
    const nums = vals.filter((v) => toNumber(v) !== null).length / n;
    const nh = normalize(h);
    const distinct = new Set(vals.map((v) => normalize(v))).size;
    if (comp >= 0.6) out[h] = 'resultado';
    else if (dates >= 0.6) out[h] = 'fecha';
    else if (/(unidad|servicio|sala|area|área|pabellon|pabellón|piso|centro)/.test(nh)) out[h] = 'unidad';
    else if (nums >= 0.8) out[h] = 'numerica';
    else if (distinct <= 15 && distinct < vals.length * 0.6) out[h] = 'categoria';
    else out[h] = 'texto';
  }
  return out;
}

// --- Cumplimiento ---
function tally(rows: RawRow[], cols: string[], naAsNo: boolean) {
  let cumple = 0, noCumple = 0, na = 0;
  for (const row of rows) for (const c of cols) {
    const v = row[c];
    if (isEmpty(v)) { na += 1; continue; }
    const k = classifyCompliance(v);
    if (k === 'cumple') cumple += 1;
    else if (k === 'no_cumple') noCumple += 1;
    else if (k === 'no_aplica') { if (naAsNo) noCumple += 1; else na += 1; }
    else na += 1;
  }
  const aplic = cumple + noCumple;
  return { cumple, noCumple, na, aplic, percent: aplic > 0 ? round1((cumple / aplic) * 100) : 0 };
}

/** Agrupa filas por el valor (normalizado) de una columna, preservando la etiqueta. */
function groupBy(rows: RawRow[], col: string): { label: string; rows: RawRow[] }[] {
  const map = new Map<string, { label: string; rows: RawRow[] }>();
  for (const r of rows) {
    const raw = String(r[col] ?? '').trim();
    if (!raw) continue;
    const key = normalize(raw);
    if (!map.has(key)) map.set(key, { label: raw, rows: [] });
    map.get(key)!.rows.push(r);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Métrica de un conjunto de filas según config. */
function metricOf(cfg: OtrosConfig, rows: RawRow[]): number | null {
  if (cfg.metric === 'cumplimiento') return tally(rows, cfg.complianceCols, cfg.naMode === 'no_cumple').percent;
  const vals = cfg.valueCol ? rows.map((r) => toNumber(r[cfg.valueCol!])).filter((n): n is number => n !== null) : [];
  if (cfg.metric === 'conteo') return rows.length;
  if (cfg.metric === 'suma') return round2(vals.reduce((a, b) => a + b, 0));
  if (cfg.metric === 'promedio') return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  return rows.length;
}

const metricLabel = (cfg: OtrosConfig) => (cfg.metric === 'cumplimiento' ? 'Cumplimiento %' : cfg.metric === 'promedio' ? `Promedio de ${cfg.valueCol ?? 'valor'}` : cfg.metric === 'suma' ? `Suma de ${cfg.valueCol ?? 'valor'}` : 'Conteo');

/** Serie temporal por período según la métrica elegida. */
function temporalSeries(cfg: OtrosConfig, rows: RawRow[], valueFn: (rs: RawRow[]) => number | null): OtrosSeriesPoint[] {
  if (!cfg.dateCol) return [];
  const order = detectDateOrder(rows.map((r) => r[cfg.dateCol!]));
  const byKey = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = periodKey(r[cfg.dateCol!], cfg.granularity, order);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }
  return Array.from(byKey.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, rs]) => ({ key: k, label: periodLabel(k, cfg.granularity), value: valueFn(rs) }));
}

/** Valida la configuración frente a los datos (para la pantalla de validación). */
export function validateOtros(cfg: OtrosConfig, wb: ParsedWorkbook): string[] {
  const w: string[] = [];
  const rows = dataRows(wb);
  if (rows.length === 0) w.push('El archivo no contiene filas de datos.');
  if (!cfg.name.trim()) w.push('Falta el nombre del informe.');
  const t = cfg.reportType;
  if (t === 'cumplimiento' && cfg.complianceCols.length === 0) w.push('Selecciona al menos una columna de resultado (Cumple/No cumple).');
  if (t === 'tasa') {
    if (!cfg.numeratorCol) w.push('Falta la columna del numerador.');
    if (!cfg.denominatorCol) w.push('Falta la columna del denominador.');
    if (cfg.denominatorCol) {
      const den = rows.reduce((a, r) => a + (toNumber(r[cfg.denominatorCol!]) ?? 0), 0);
      if (den === 0) w.push('El denominador suma cero: no es posible calcular la tasa.');
    }
    if (!cfg.factor || cfg.factor <= 0) w.push('El factor debe ser mayor que cero.');
  }
  if (t === 'frecuencia' && !cfg.dimensionCol) w.push('Selecciona la categoría o unidad a contar.');
  if (t === 'evolucion' && !cfg.dateCol) w.push('Selecciona la columna de fecha para la evolución.');
  if ((t === 'evolucion' || t === 'comparacion') && cfg.metric !== 'conteo' && cfg.metric !== 'cumplimiento' && !cfg.valueCol) w.push('Selecciona la columna numérica de la métrica (promedio/suma).');
  if ((t === 'evolucion' || t === 'comparacion') && cfg.metric === 'cumplimiento' && cfg.complianceCols.length === 0) w.push('Para la métrica de cumplimiento, selecciona columnas de resultado.');
  if (t === 'comparacion' && !cfg.dimensionCol) w.push('Selecciona la unidad o grupo a comparar.');
  if (t === 'descriptivo' && cfg.descriptiveCols.length === 0) w.push('Selecciona al menos una variable descriptiva.');
  if (cfg.dateCol) {
    const order = detectDateOrder(rows.map((r) => r[cfg.dateCol!]));
    const ok = rows.some((r) => periodKey(r[cfg.dateCol!], cfg.granularity, order));
    if (!ok) w.push(`La columna de fecha «${cfg.dateCol}» no produjo períodos reconocibles.`);
  }
  if (cfg.goal !== null && (cfg.goal < 0)) w.push('La meta/referencia no puede ser negativa.');
  return w;
}

/** Motor principal: calcula el informe según su tipo. */
export function analyzeOtros(cfg: OtrosConfig, wb: ParsedWorkbook): OtrosResult {
  const rows = dataRows(wb);
  const naAsNo = cfg.naMode === 'no_cumple';
  const goal = cfg.goal;
  const res: OtrosResult = {
    config: cfg, formula: '', totalRecords: rows.length, kpis: [], mainTable: null, temporal: [], comparison: null,
    breakdowns: [], descriptive: [], findings: [], gaps: [], alerts: [], summary: [], recommendations: [],
    warnings: validateOtros(cfg, wb),
  };

  // Desgloses (comunes): por cada columna de desglose, la métrica del tipo.
  const buildBreakdowns = (valueFn: (rs: RawRow[]) => number | null, header: string) => {
    for (const bcol of cfg.breakdowns) {
      const groups = groupBy(rows, bcol);
      if (groups.length === 0) continue;
      res.breakdowns.push({ label: bcol, table: { headers: [bcol, header], rows: groups.map((g) => [g.label, valueFn(g.rows) ?? 's/d']) } });
    }
  };

  if (cfg.reportType === 'cumplimiento') {
    res.formula = 'Cumplimiento = Cumple / (Cumple + No cumple) × 100' + (naAsNo ? ' (N/A cuenta como No cumple)' : ', excluyendo N/A');
    const g = tally(rows, cfg.complianceCols, naAsNo);
    const meets = goal !== null && g.percent >= goal;
    res.kpis = [
      { label: 'Cumplimiento global', value: `${g.percent}%`, tone: goal === null ? 'neutral' : meets ? 'ok' : 'alert', hint: goal !== null ? `Meta ${goal}%` : undefined },
      { label: 'Cumple', value: String(g.cumple), tone: 'neutral' },
      { label: 'No cumple', value: String(g.noCumple), tone: 'neutral' },
      { label: 'Registros', value: String(rows.length), tone: 'neutral' },
    ];
    res.mainTable = { headers: ['Indicador', 'Cumple', 'No cumple', 'Cumplimiento'], rows: cfg.complianceCols.map((c) => { const t = tally(rows, [c], naAsNo); return [c, t.cumple, t.noCumple, `${t.percent}%`]; }) };
    if (cfg.dimensionCol) res.comparison = { headers: [cfg.dimensionCol, 'Cumplimiento', 'Cumple', 'No cumple'], rows: groupBy(rows, cfg.dimensionCol).map((gr) => { const t = tally(gr.rows, cfg.complianceCols, naAsNo); return [gr.label, `${t.percent}%`, t.cumple, t.noCumple]; }) };
    res.temporal = temporalSeries(cfg, rows, (rs) => tally(rs, cfg.complianceCols, naAsNo).percent);
    buildBreakdowns((rs) => tally(rs, cfg.complianceCols, naAsNo).percent, 'Cumplimiento %');
    if (goal !== null && !meets) { res.gaps.push(`Cumplimiento global ${g.percent}% (${round1(goal - g.percent)} pp bajo la meta de ${goal}%).`); res.alerts.push(`El cumplimiento está bajo la meta de ${goal}%.`); }
    // hallazgos: peor indicador / grupo
    const worst = [...(res.mainTable.rows)].sort((a, b) => parseFloat(String(a[3])) - parseFloat(String(b[3])))[0];
    if (worst) res.findings.push(`El indicador con menor cumplimiento es «${worst[0]}» (${worst[3]}).`);
  } else if (cfg.reportType === 'frecuencia') {
    res.formula = 'Frecuencia = recuento de casos por categoría';
    const groups = cfg.dimensionCol ? groupBy(rows, cfg.dimensionCol) : [];
    res.kpis = [
      { label: 'Total registros', value: String(rows.length), tone: 'neutral' },
      { label: 'Categorías', value: String(groups.length), tone: 'neutral' },
      { label: 'Más frecuente', value: groups.length ? [...groups].sort((a, b) => b.rows.length - a.rows.length)[0].label : 's/d', tone: 'neutral' },
    ];
    res.mainTable = { headers: [cfg.dimensionCol ?? 'Categoría', 'Casos', '% del total'], rows: groups.map((g) => [g.label, g.rows.length, `${round1((g.rows.length / rows.length) * 100)}%`]) };
    res.comparison = res.mainTable;
    res.temporal = temporalSeries(cfg, rows, (rs) => rs.length);
    buildBreakdowns((rs) => rs.length, 'Casos');
    const top = groups.length ? [...groups].sort((a, b) => b.rows.length - a.rows.length)[0] : null;
    if (top) res.findings.push(`La categoría más frecuente es «${top.label}» con ${top.rows.length} casos (${round1((top.rows.length / rows.length) * 100)}%).`);
  } else if (cfg.reportType === 'tasa') {
    res.formula = `Tasa = ${cfg.numeratorCol ?? 'numerador'} / ${cfg.denominatorCol ?? 'denominador'} × ${cfg.factor}`;
    const sum = (rs: RawRow[], c: string | null) => (c ? rs.reduce((a, r) => a + (toNumber(r[c]) ?? 0), 0) : 0);
    const num = sum(rows, cfg.numeratorCol), den = sum(rows, cfg.denominatorCol);
    const rate = den > 0 ? round2((num / den) * cfg.factor) : null;
    const over = goal !== null && rate !== null && rate > goal;
    res.kpis = [
      { label: 'Numerador', value: String(num), tone: 'neutral' },
      { label: 'Denominador', value: String(den), tone: 'neutral' },
      { label: `Tasa (× ${cfg.factor})`, value: rate === null ? 's/d' : String(rate), tone: goal === null ? 'neutral' : over ? 'alert' : 'ok', hint: goal !== null ? `Referencia ${goal}` : undefined },
    ];
    const rateOf = (rs: RawRow[]) => { const d = sum(rs, cfg.denominatorCol); return d > 0 ? round2((sum(rs, cfg.numeratorCol) / d) * cfg.factor) : null; };
    if (cfg.dimensionCol) res.comparison = { headers: [cfg.dimensionCol, 'Numerador', 'Denominador', 'Tasa'], rows: groupBy(rows, cfg.dimensionCol).map((gr) => [gr.label, sum(gr.rows, cfg.numeratorCol), sum(gr.rows, cfg.denominatorCol), rateOf(gr.rows) ?? 's/d']) };
    res.temporal = temporalSeries(cfg, rows, rateOf);
    buildBreakdowns(rateOf, 'Tasa');
    if (over) { res.alerts.push(`La tasa (${rate}) supera la referencia de ${goal}.`); res.gaps.push(`Tasa ${rate} sobre la referencia ${goal}.`); }
    if (rate !== null) res.findings.push(`La tasa global es ${rate} por ${cfg.factor} (${num} / ${den}).`);
  } else if (cfg.reportType === 'evolucion') {
    res.formula = `Evolución de ${metricLabel(cfg)} por período (${cfg.granularity})`;
    res.temporal = temporalSeries(cfg, rows, (rs) => metricOf(cfg, rs));
    const first = res.temporal[0], last = res.temporal[res.temporal.length - 1];
    const delta = first && last && first.value !== null && last.value !== null ? round2(last.value - first.value) : null;
    res.kpis = [
      { label: 'Períodos', value: String(res.temporal.length), tone: 'neutral' },
      { label: `Inicial (${first?.label ?? 's/d'})`, value: first && first.value !== null ? String(first.value) : 's/d', tone: 'neutral' },
      { label: `Final (${last?.label ?? 's/d'})`, value: last && last.value !== null ? String(last.value) : 's/d', tone: 'neutral' },
      ...(delta !== null ? [{ label: 'Variación', value: `${delta >= 0 ? '+' : ''}${delta}`, tone: 'neutral' as const }] : []),
    ];
    res.mainTable = { headers: ['Período', metricLabel(cfg)], rows: res.temporal.map((p) => [p.label, p.value ?? 's/d']) };
    if (delta !== null) res.findings.push(`La métrica varió ${delta >= 0 ? '+' : ''}${delta} entre ${first!.label} y ${last!.label}.`);
  } else if (cfg.reportType === 'comparacion') {
    res.formula = `Comparación de ${metricLabel(cfg)} entre ${cfg.dimensionCol ?? 'grupos'}`;
    const groups = cfg.dimensionCol ? groupBy(rows, cfg.dimensionCol) : [];
    const withVal = groups.map((g) => ({ label: g.label, value: metricOf(cfg, g.rows) }));
    res.comparison = { headers: [cfg.dimensionCol ?? 'Grupo', metricLabel(cfg)], rows: withVal.map((g) => [g.label, g.value ?? 's/d']) };
    res.mainTable = res.comparison;
    const sorted = withVal.filter((g) => g.value !== null).sort((a, b) => (b.value as number) - (a.value as number));
    res.kpis = [
      { label: 'Grupos', value: String(groups.length), tone: 'neutral' },
      { label: 'Mayor', value: sorted[0] ? `${sorted[0].label}: ${sorted[0].value}` : 's/d', tone: 'neutral' },
      { label: 'Menor', value: sorted.length ? `${sorted[sorted.length - 1].label}: ${sorted[sorted.length - 1].value}` : 's/d', tone: 'neutral' },
    ];
    res.temporal = temporalSeries(cfg, rows, (rs) => metricOf(cfg, rs));
    if (sorted.length >= 2) res.findings.push(`«${sorted[0].label}» presenta el mayor valor (${sorted[0].value}) y «${sorted[sorted.length - 1].label}» el menor (${sorted[sorted.length - 1].value}).`);
  } else {
    // descriptivo
    res.formula = 'Prevalencia = positivos (Sí/Cumple) / respondidos × 100';
    for (const c of cfg.descriptiveCols) {
      let pos = 0, ans = 0;
      for (const r of rows) { const v = r[c]; if (isEmpty(v)) continue; ans += 1; const k = classifyCompliance(v); if (k === 'cumple') pos += 1; }
      res.descriptive.push({ label: c, positive: pos, answered: ans, percent: ans > 0 ? round1((pos / ans) * 100) : 0 });
    }
    res.kpis = [
      { label: 'Registros', value: String(rows.length), tone: 'neutral' },
      { label: 'Variables', value: String(cfg.descriptiveCols.length), tone: 'neutral' },
      ...(res.descriptive[0] ? [{ label: res.descriptive[0].label, value: `${res.descriptive[0].percent}%`, tone: 'neutral' as const, hint: 'prevalencia' }] : []),
    ];
    res.mainTable = { headers: ['Variable', 'Positivos', 'Respondidos', 'Prevalencia'], rows: res.descriptive.map((d) => [d.label, d.positive, d.answered, `${d.percent}%`]) };
    if (res.descriptive[0]) res.findings.push(`La prevalencia de «${res.descriptive[0].label}» es ${res.descriptive[0].percent}%.`);
  }

  // Complementarias (informativas): prevalencia/promedio, no alteran el resultado oficial.
  // (Se muestran como caracterización adicional si se definieron.)
  for (const c of cfg.complementaryCols) {
    let pos = 0, ans = 0;
    for (const r of rows) { const v = r[c]; if (isEmpty(v)) continue; ans += 1; if (classifyCompliance(v) === 'cumple') pos += 1; }
    if (ans > 0) res.descriptive.push({ label: `${c} (complementaria)`, positive: pos, answered: ans, percent: round1((pos / ans) * 100) });
  }

  // Resumen ejecutivo y recomendaciones (genéricos, editables en la vista).
  res.summary.push(`${cfg.name || 'Informe'} — ${cfg.objective || 'análisis configurado por el usuario'}. Se procesaron ${rows.length} registros.`);
  if (res.findings.length) res.summary.push(res.findings.join(' '));
  if (res.alerts.length) res.summary.push('Alertas: ' + res.alerts.join(' '));
  res.recommendations = res.gaps.length
    ? res.gaps.map((g) => `Intervenir la brecha detectada: ${g}`)
    : ['Mantener el desempeño observado y sostener el registro sistemático de los datos.'];

  return res;
}
