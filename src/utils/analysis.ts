import type {
  AnalysisResult,
  BreakdownCompliance,
  DetectedColumn,
  ClinicalCharacterization,
  ComplianceGroup,
  DescriptiveVariable,
  EvolutionPoint,
  GlobalCompliance,
  GroupCount,
  ParsedWorkbook,
  RawRow,
  ReportConfig,
  TemporalAnalysis,
  UnitShiftMatrix,
} from '../types';
import type { AuditBreakdown, SurveillanceRate } from '../config/programs';
import type { SurveillanceAnalysis, SurveillanceRatePoint, ServiceReferenceOption } from '../types';
import { classifyCompliance, classifyRisk, columnForRole, columnsForRole, isDescriptiveVariable, matchesDescriptivePatterns, normalize } from './columnDetection';
import { classifyLppStage, isLppStageColumn, LPP_STAGES } from './lpp';
import { granularityFor } from '../config/options';
import { resolveProgramConfig } from './programConfig';
import { detectDateOrder, periodKey, periodLabel, type DateOrder, type Granularity } from './periods';

const UNGROUPED = 'Sin especificar';

/** ¿La celda está vacía? Un vacío en columna de cumplimiento cuenta como "no aplica". */
function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

/** ¿El valor es una variable descriptiva (nativa o configurada por el programa)? */
function isDescriptive(value: unknown, patterns: string[]): boolean {
  return isDescriptiveVariable(value) || matchesDescriptivePatterns(value, patterns);
}

/**
 * Filas de pacientes/registros reales. Descarta filas de resumen o totales (los
 * bloques al pie del Excel oficial) y filas vacías: una fila es válida si tiene
 * al menos un dato en las columnas clínicas (riesgo, indicador, cumplimiento,
 * variable descriptiva o clasificación/estadio de LPP). Las columnas ignoradas
 * (p. ej. "% Cumplimiento", "Semáforo") no cuentan para la validez.
 */
function validPatientRows(workbook: ParsedWorkbook): RawRow[] {
  const { rows, columns } = workbook;
  const clinical = columns
    .filter((c) => c.role === 'riesgo' || c.role === 'cumplimiento' || c.role === 'indicador' || c.role === 'descriptivo')
    .map((c) => c.original);
  const stageCols = columns.map((c) => c.original).filter((h) => isLppStageColumn(h));
  const cols = Array.from(new Set([...clinical, ...stageCols]));
  if (cols.length === 0) return rows.slice();
  return rows.filter((r) => cols.some((c) => !isEmpty(r[c])));
}

/** % de cumplimiento sobre casos aplicables (cumple / (cumple + no cumple)). */
function pct(cumple: number, aplicables: number): number {
  return aplicables === 0 ? 0 : Number(((cumple / aplicables) * 100).toFixed(1));
}

/**
 * Cuenta cumple / no cumple / no aplica de una fila sobre una o varias columnas
 * de cumplimiento. Las variables descriptivas (p. ej. "¿Tiene LPP?") NO se
 * incluyen aquí, porque no forman parte del cumplimiento.
 */
function tally(row: RawRow, cols: string[]): { cumple: number; noCumple: number; noAplica: number } {
  let cumple = 0;
  let noCumple = 0;
  let noAplica = 0;
  for (const col of cols) {
    const v = row[col];
    const c = classifyCompliance(v);
    if (c === 'cumple') cumple++;
    else if (c === 'no_cumple') noCumple++;
    else if (c === 'no_aplica') noAplica++;
    else if (isEmpty(v)) noAplica++; // vacío en columna de cumplimiento = no aplica
  }
  return { cumple, noCumple, noAplica };
}

/** Etiqueta legible del valor de una columna de agrupación. */
function labelOf(value: unknown): string {
  return isEmpty(value) ? UNGROUPED : String(value).trim();
}

/** Cuenta registros por categoría (total por unidad / por turno). */
function countBy(rows: RawRow[], dimCol: string | null): GroupCount[] {
  if (!dimCol) return [];
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = labelOf(row[dimCol]);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** Construye un grupo de cumplimiento a partir de conteos crudos. */
function makeGroup(label: string, cumple: number, noCumple: number, noAplica: number, goal: number): ComplianceGroup {
  const aplicables = cumple + noCumple;
  const percent = pct(cumple, aplicables);
  return {
    label,
    total: cumple + noCumple + noAplica,
    cumple,
    noCumple,
    noAplica,
    aplicables,
    percent,
    meetsGoal: aplicables > 0 && percent >= goal,
  };
}

/** Agrupa el cumplimiento por una columna dimensión (turno, unidad…). */
function complianceBy(
  rows: RawRow[],
  dimCol: string | null,
  complianceCols: string[],
  goal: number,
  mapLabel?: (label: string) => string,
): ComplianceGroup[] {
  if (!dimCol) return [];
  const acc = new Map<string, { cumple: number; noCumple: number; noAplica: number }>();
  for (const row of rows) {
    const raw = labelOf(row[dimCol]);
    const label = mapLabel ? mapLabel(raw) : raw;
    const t = tally(row, complianceCols);
    const g = acc.get(label) ?? { cumple: 0, noCumple: 0, noAplica: 0 };
    g.cumple += t.cumple;
    g.noCumple += t.noCumple;
    g.noAplica += t.noAplica;
    acc.set(label, g);
  }
  return Array.from(acc.entries())
    .map(([label, g]) => makeGroup(label, g.cumple, g.noCumple, g.noAplica, goal))
    .sort((a, b) => b.percent - a.percent);
}

/**
 * Cumplimiento por indicador. Si hay una columna "indicador", agrupa por su valor
 * (excluyendo variables descriptivas). Si no, cada columna de cumplimiento es un
 * indicador (formato ancho); las columnas descriptivas ya quedaron fuera.
 */
function complianceByIndicator(
  rows: RawRow[],
  indicatorCol: string | null,
  complianceCols: string[],
  goal: number,
  canonicalize: (label: unknown) => string | null,
  descriptivePatterns: string[],
): ComplianceGroup[] {
  // El programa define cómo canonicalizar sus indicadores (tolerando abreviaturas/errores).
  const canon = (label: string) => canonicalize(label) ?? label;
  if (indicatorCol) {
    return complianceBy(rows, indicatorCol, complianceCols, goal, canon).filter((g) => !isDescriptive(g.label, descriptivePatterns));
  }
  return complianceCols
    .map((col) => {
      let cumple = 0;
      let noCumple = 0;
      let noAplica = 0;
      for (const row of rows) {
        const one = tally(row, [col]);
        cumple += one.cumple;
        noCumple += one.noCumple;
        noAplica += one.noAplica;
      }
      return makeGroup(canon(col), cumple, noCumple, noAplica, goal);
    })
    .sort((a, b) => b.percent - a.percent);
}

/**
 * Cumplimiento por cada dimensión de desglose configurada (p. ej. estamento,
 * tipo de higiene, observador). La columna se localiza por coincidencia del
 * encabezado con los fragmentos `match` de la dimensión, ignorando las columnas
 * que ya son de cumplimiento/indicador/riesgo. Solo se devuelven los desgloses
 * cuya columna existe y tiene al menos un grupo con casos aplicables. Sin
 * dimensiones configuradas (NT 234) devuelve una lista vacía.
 */
function complianceByBreakdowns(
  columns: DetectedColumn[],
  breakdowns: AuditBreakdown[],
  rows: RawRow[],
  complianceCols: string[],
  goal: number,
): BreakdownCompliance[] {
  // No se usan columnas de cumplimiento/indicador como dimensión de desglose.
  // El rol 'riesgo' SÍ puede desglosarse cuando un programa lo configura
  // explícitamente (p. ej. LPP – Guía RNAO «Nivel de riesgo»); ningún otro módulo
  // define un desglose de riesgo, por lo que no se altera su comportamiento.
  const skipRoles = new Set<DetectedColumn['role']>(['cumplimiento', 'indicador']);
  const out: BreakdownCompliance[] = [];
  for (const bd of breakdowns) {
    const col = columns.find((c) => {
      if (skipRoles.has(c.role)) return false;
      const header = normalize(c.original);
      return header !== '' && bd.match.some((m) => {
        const nm = normalize(m);
        return nm !== '' && header.includes(nm);
      });
    });
    if (!col) continue;
    const groups = complianceBy(rows, col.original, complianceCols, goal);
    if (groups.some((g) => g.aplicables > 0)) out.push({ key: bd.key, label: bd.label, groups });
  }
  return out;
}

/**
 * Filas base para el cálculo de cumplimiento: excluye variables descriptivas
 * (formato largo) y, SOLO en NT 234 / LPP con columna de riesgo, deja únicamente
 * los pacientes de riesgo moderado y alto.
 */
function complianceRowsFor(workbook: ParsedWorkbook, config: ReportConfig): RawRow[] {
  const { columns } = workbook;
  const pc = resolveProgramConfig(config);
  const indicatorCol = columnForRole(columns, 'indicador');
  const riskCol = columnForRole(columns, 'riesgo');
  // Parte de las filas reales (sin resumen/vacías) y excluye variables descriptivas.
  const base = validPatientRows(workbook);
  let out = indicatorCol ? base.filter((r) => !isDescriptive(r[indicatorCol], pc.descriptiveVariables)) : base;
  if (pc.riskFilter && riskCol) {
    out = out.filter((r) => {
      const lvl = classifyRisk(r[riskCol]);
      return lvl === 'alto' || lvl === 'moderado';
    });
  }
  return out;
}

/**
 * Calcula las variables clínicas descriptivas (prevalencia). Considera:
 * - Columnas marcadas como 'descriptivo' (formato ancho, una fila por paciente).
 * - Valores de la columna indicador que son descriptivos (formato largo).
 */
function descriptiveVariables(
  rows: RawRow[],
  descriptiveCols: string[],
  descriptiveRows: RawRow[],
  indicatorCol: string | null,
  complianceCols: string[],
): DescriptiveVariable[] {
  const out: DescriptiveVariable[] = [];
  // La prevalencia se calcula sobre los pacientes evaluados para esa variable
  // (positivos + negativos), es decir el total de registros con respuesta.

  // 1) Columnas descriptivas (formato ancho).
  for (const col of descriptiveCols) {
    let positive = 0;
    let negative = 0;
    for (const row of rows) {
      const c = classifyCompliance(row[col]);
      if (c === 'cumple') positive++;
      else if (c === 'no_cumple') negative++;
    }
    const answered = positive + negative;
    if (answered > 0) {
      out.push({ label: col, positive, negative, answered, prevalence: pct(positive, answered) });
    }
  }

  // 2) Valores descriptivos dentro de la columna indicador (formato largo).
  if (indicatorCol) {
    const acc = new Map<string, { positive: number; negative: number }>();
    for (const row of descriptiveRows) {
      const label = labelOf(row[indicatorCol]);
      const t = tally(row, complianceCols);
      const g = acc.get(label) ?? { positive: 0, negative: 0 };
      g.positive += t.cumple;
      g.negative += t.noCumple;
      acc.set(label, g);
    }
    for (const [label, g] of acc) {
      const answered = g.positive + g.negative;
      if (answered > 0) {
        out.push({ label, positive: g.positive, negative: g.negative, answered, prevalence: pct(g.positive, answered) });
      }
    }
  }

  return out.sort((a, b) => b.positive - a.positive);
}

/**
 * Caracterización clínica de la base NT 234 / LPP calculada DIRECTAMENTE por
 * fila (metodología HUAP): cada fila del Excel es un paciente auditado, sin
 * deduplicar por N° Ficha ni por ningún otro identificador.
 */
function clinicalCharacterization(workbook: ParsedWorkbook, config: ReportConfig): ClinicalCharacterization {
  const { rows, columns } = workbook;
  const pc = resolveProgramConfig(config);
  const riskCol = columnForRole(columns, 'riesgo');
  const indicatorCol = columnForRole(columns, 'indicador');
  const complianceCols = columnsForRole(columns, 'cumplimiento');
  const descriptiveCols = columnsForRole(columns, 'descriptivo');
  // Columnas donde buscar la clasificación por estadio de LPP.
  const stageCols = columns
    .map((c) => c.original)
    .filter((h) => isLppStageColumn(h) || isDescriptive(h, pc.descriptiveVariables));

  // Fila válida = fila con algún dato de auditoría (descarta filas en blanco del Excel).
  const auditCols = [riskCol, ...complianceCols, ...descriptiveCols, ...stageCols].filter((c): c is string => !!c);
  const validRows = auditCols.length ? rows.filter((r) => auditCols.some((c) => !isEmpty(r[c]))) : rows.slice();

  let highRisk = 0;
  let moderateRisk = 0;
  let lowRisk = 0;
  let noRisk = 0;
  let lppPos = 0;
  const stageAcc = new Map<string, number>();

  for (const row of validRows) {
    // Nivel de riesgo contado por fila.
    if (riskCol) {
      const lvl = classifyRisk(row[riskCol]);
      if (lvl === 'alto') highRisk++;
      else if (lvl === 'moderado') moderateRisk++;
      else if (lvl === 'bajo') lowRisk++;
      else if (lvl === 'sin') noRisk++;
    }

    // LPP por fila: "¿Tiene LPP?" = Sí (columna descriptiva o valor de indicador)
    // o presencia de una clasificación por estadio.
    let hasLppRow = false;
    for (const col of descriptiveCols) {
      if (classifyCompliance(row[col]) === 'cumple') hasLppRow = true;
    }
    if (indicatorCol && isDescriptive(row[indicatorCol], pc.descriptiveVariables) && tally(row, complianceCols).cumple > 0) {
      hasLppRow = true;
    }
    for (const col of stageCols) {
      const st = classifyLppStage(row[col]);
      if (st) {
        stageAcc.set(st, (stageAcc.get(st) ?? 0) + 1);
        hasLppRow = true;
        break;
      }
    }
    if (hasLppRow) lppPos++;
  }

  const total = validRows.length; // pacientes auditados = filas válidas
  const included = highRisk + moderateRisk;
  const excluded = lowRisk + noRisk; // solo bajo + sin riesgo
  const riskColumnDetected = riskCol !== null;
  const riskFilterApplied = pc.riskFilter && riskColumnDetected;
  // Programa con filtro de riesgo pero sin columna: incluidos/excluidos "no determinado".
  const nt234NeedsRisk = pc.riskFilter && !riskColumnDetected;
  const stagesPresent = stageAcc.size > 0;
  const hasLpp = lppPos > 0;

  const lppStages = stagesPresent
    ? LPP_STAGES.map((stage) => {
        const count = stageAcc.get(stage) ?? 0;
        return { stage, count, percent: pct(count, lppPos) };
      })
    : [];

  return {
    totalOriginal: total,
    highRisk,
    moderateRisk,
    includedByRisk: nt234NeedsRisk ? null : riskFilterApplied ? included : total,
    excludedByRisk: nt234NeedsRisk ? null : riskFilterApplied ? excluded : 0,
    riskColumnDetected,
    riskFilterApplied,
    lppPositive: hasLpp ? lppPos : null,
    // Prevalencia = pacientes con LPP / pacientes auditados (metodología HUAP).
    lppAnswered: hasLpp ? total : null,
    lppPrevalence: hasLpp ? pct(lppPos, total) : null,
    lppStages,
  };
}

/**
 * Evolución del cumplimiento global agrupada por período (según la granularidad).
 * Usa la misma base de cumplimiento que el análisis global (respeta el filtro de
 * riesgo NT 234): NO filtra la base, solo la segmenta en el tiempo.
 */
function buildEvolution(
  complianceRows: RawRow[],
  dateCol: string | null,
  complianceCols: string[],
  gran: Granularity,
  goal: number,
  order: DateOrder,
): EvolutionPoint[] {
  if (!dateCol) return [];
  const acc = new Map<string, { cumple: number; noCumple: number }>();
  for (const row of complianceRows) {
    const key = periodKey(row[dateCol], gran, order);
    if (!key) continue;
    const t = tally(row, complianceCols);
    const g = acc.get(key) ?? { cumple: 0, noCumple: 0 };
    g.cumple += t.cumple;
    g.noCumple += t.noCumple;
    acc.set(key, g);
  }
  return Array.from(acc.entries())
    .map(([key, g]) => {
      const total = g.cumple + g.noCumple;
      const percent = pct(g.cumple, total);
      return { key, label: periodLabel(key, gran), total, cumple: g.cumple, percent, meetsGoal: total > 0 && percent >= goal };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Períodos disponibles en la base según la granularidad (ordenados). */
function listPeriodKeys(rows: RawRow[], dateCol: string | null, gran: Granularity, order: DateOrder): { key: string; label: string }[] {
  if (!dateCol) return [];
  const keys = new Set<string>();
  for (const row of rows) {
    const key = periodKey(row[dateCol], gran, order);
    if (key) keys.add(key);
  }
  return Array.from(keys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, label: periodLabel(key, gran) }));
}

/**
 * Construye el análisis temporal (evolución + períodos disponibles). No altera
 * el cálculo de cumplimiento: reutiliza la misma base filtrada por riesgo. El
 * orden de fecha (dd/mm vs mm/dd) se autodetecta de la propia columna.
 */
function buildTemporal(workbook: ParsedWorkbook, config: ReportConfig, complianceRows: RawRow[]): TemporalAnalysis {
  const { columns } = workbook;
  const dateCol = columnForRole(columns, 'fecha');
  const complianceCols = columnsForRole(columns, 'cumplimiento');
  const gran = granularityFor(config.analysisType);
  const order = dateCol ? detectDateOrder(complianceRows.map((r) => r[dateCol])) : 'dmy';
  const hasDate = dateCol !== null && listPeriodKeys(complianceRows, dateCol, gran, order).length > 0;
  return {
    hasDate,
    granularity: gran,
    evolution: hasDate ? buildEvolution(complianceRows, dateCol, complianceCols, gran, config.goal, order) : [],
    periods: hasDate ? listPeriodKeys(complianceRows, dateCol, gran, order) : [],
  };
}

/**
 * Devuelve un workbook filtrado a un único período (por clave de período).
 * Se usa en la comparación lado a lado, donde cada período se re-analiza completo.
 */
export function filterWorkbookByPeriod(workbook: ParsedWorkbook, key: string, gran: Granularity): ParsedWorkbook {
  const dateCol = columnForRole(workbook.columns, 'fecha');
  if (!dateCol) return workbook;
  const order = detectDateOrder(workbook.rows.map((r) => r[dateCol]));
  return { ...workbook, rows: workbook.rows.filter((r) => periodKey(r[dateCol], gran, order) === key) };
}

/** Convierte un valor de celda a número (tolera separadores). Null si no aplica. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.200,5 → 1200.5
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Localiza una columna por coincidencia de su encabezado con fragmentos. */
function findColumnByHeader(columns: DetectedColumn[], match: string[] | undefined): string | null {
  if (!match || match.length === 0) return null;
  const col = columns.find((c) => {
    const h = normalize(c.original);
    return h !== '' && match.some((m) => { const nm = normalize(m); return nm !== '' && h.includes(nm); });
  });
  return col ? col.original : null;
}

/** Redondea a n decimales devolviendo número. */
function roundN(x: number, n: number): number {
  const f = 10 ** n;
  return Math.round(x * f) / f;
}

/**
 * Motor de vigilancia epidemiológica (formato agregado unidad × período): lee el
 * numerador (casos) y el denominador (días de exposición) por sus encabezados,
 * agrega por unidad y por período, y calcula la tasa num/den × factor. NO usa la
 * fórmula de cumplimiento. Devuelve tasas por unidad, por período (evolución),
 * global, referencia y alertas.
 */
export function analyzeSurveillance(workbook: ParsedWorkbook, config: ReportConfig, rate: SurveillanceRate): SurveillanceAnalysis {
  const { columns } = workbook;
  const rows = validPatientRows(workbook);
  const unitCol = columnForRole(columns, 'unidad');
  const dateCol = columnForRole(columns, 'fecha');
  const numCol = findColumnByHeader(columns, rate.numeratorMatch);
  const denCol = findColumnByHeader(columns, rate.denominatorMatch);
  const pdCol = findColumnByHeader(columns, rate.patientDaysMatch);
  const factor = rate.factor || 1000;
  const gran = granularityFor(config.analysisType);
  const order = dateCol ? detectDateOrder(rows.map((r) => r[dateCol])) : 'dmy';
  const rateOf = (cases: number, days: number): number | null => (days > 0 ? roundN((cases / days) * factor, 2) : null);

  // Formato: si hay columna de numerador (Casos) → agregado (una fila por
  // unidad-período: se SUMAN casos y días). Si no → línea por caso (cada fila es
  // un caso: se CUENTAN por unidad-período y el denominador se toma como el valor
  // por unidad-período, sin sumarlo entre filas repetidas).
  const format: 'aggregated' | 'line_list' = numCol ? 'aggregated' : 'line_list';

  // Celdas (unidad × período): agrega según el formato.
  interface Cell { unit: string; period: string; cases: number; days: number; pdays: number; anyPd: boolean }
  const cells = new Map<string, Cell>();
  for (const row of rows) {
    const unit = unitCol ? labelOf(row[unitCol]) : UNGROUPED;
    const period = dateCol ? periodKey(row[dateCol], gran, order) ?? '' : '';
    const key = `${unit}||${period}`;
    const cell = cells.get(key) ?? { unit, period, cases: 0, days: 0, pdays: 0, anyPd: false };
    const den = denCol ? toNumber(row[denCol]) ?? 0 : 0;
    const pd = pdCol ? toNumber(row[pdCol]) : null;
    if (format === 'aggregated') {
      cell.cases += numCol ? toNumber(row[numCol]) ?? 0 : 0;
      cell.days += den;
      if (pd !== null) { cell.pdays += pd; cell.anyPd = true; }
    } else {
      cell.cases += 1; // cada fila = un caso
      cell.days = Math.max(cell.days, den); // denominador por unidad-período (no se suma)
      if (pd !== null) { cell.pdays = Math.max(cell.pdays, pd); cell.anyPd = true; }
    }
    cells.set(key, cell);
  }

  // ── Referencia por tipo de servicio ──────────────────────────────────
  const services: ServiceReferenceOption[] = (rate.serviceReferences ?? []).map((s) => ({ service: s.service, label: s.label, reference: s.reference }));
  const manual = config.serviceType ?? null;
  const manualRef = manual ? services.find((s) => s.service === manual)?.reference ?? null : null;
  /** Servicio detectado para una unidad por su nombre (o null). */
  const detectService = (unitLabel: string): { service: string; label: string; reference: number } | null => {
    const n = normalize(unitLabel);
    for (const s of rate.serviceReferences ?? []) {
      if (s.match.some((m) => { const nm = normalize(m); return nm !== '' && n.includes(nm); })) return { service: s.service, label: s.label, reference: s.reference };
    }
    return null;
  };
  /** Referencia aplicable a una unidad: manual > detectada por nombre > por defecto > única. */
  const referenceForUnit = (unitLabel: string): { reference: number | null; service?: string; serviceLabel?: string } => {
    if (manual) return { reference: manualRef, service: manual, serviceLabel: services.find((s) => s.service === manual)?.label };
    const det = detectService(unitLabel);
    if (det) return { reference: det.reference, service: det.service, serviceLabel: det.label };
    // Categoría por defecto (p. ej. "adultos" para HUAP), si está configurada.
    if (rate.defaultService) {
      const def = services.find((s) => s.service === rate.defaultService);
      if (def) return { reference: def.reference, service: def.service, serviceLabel: def.label };
    }
    return { reference: (rate.serviceReferences?.length ? null : rate.reference ?? null) };
  };

  // Agregación por unidad.
  const unitAgg = new Map<string, { cases: number; days: number }>();
  const periodAgg = new Map<string, { cases: number; days: number }>();
  let totalCases = 0, totalDays = 0, totalPatientDays = 0, anyPatientDays = false;
  for (const cell of cells.values()) {
    totalCases += cell.cases; totalDays += cell.days;
    if (cell.anyPd) { totalPatientDays += cell.pdays; anyPatientDays = true; }
    const u = unitAgg.get(cell.unit) ?? { cases: 0, days: 0 }; u.cases += cell.cases; u.days += cell.days; unitAgg.set(cell.unit, u);
    if (dateCol && cell.period) { const p = periodAgg.get(cell.period) ?? { cases: 0, days: 0 }; p.cases += cell.cases; p.days += cell.days; periodAgg.set(cell.period, p); }
  }

  let hasUnresolvedService = false;
  const byUnit: SurveillanceRatePoint[] = Array.from(unitAgg.entries())
    .map(([label, g]) => {
      const r = rateOf(g.cases, g.days);
      const ref = referenceForUnit(label);
      if (!manual && rate.serviceReferences?.length && ref.reference === null) hasUnresolvedService = true;
      return { key: label, label, cases: g.cases, deviceDays: g.days, rate: r, reference: ref.reference, exceedsReference: r !== null && ref.reference !== null && r > ref.reference, service: ref.service, serviceLabel: ref.serviceLabel };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  // Referencia global: manual, o única si todas las unidades comparten servicio,
  // o la referencia única del rate; si hay servicios mixtos → null (no se asume).
  const distinctRefs = new Set(byUnit.map((u) => u.reference).filter((v): v is number => v !== null));
  const allResolved = byUnit.every((u) => u.reference !== null);
  const overallReference: number | null = manual
    ? manualRef
    : rate.serviceReferences?.length
      ? (allResolved && distinctRefs.size === 1 ? [...distinctRefs][0] : null)
      : rate.reference ?? null;

  const byPeriod: SurveillanceRatePoint[] = Array.from(periodAgg.entries())
    .map(([key, g]) => { const r = rateOf(g.cases, g.days); return { key, label: periodLabel(key, gran), cases: g.cases, deviceDays: g.days, rate: r, reference: overallReference, exceedsReference: r !== null && overallReference !== null && r > overallReference }; })
    .sort((a, b) => a.key.localeCompare(b.key));

  const overallRate = rateOf(totalCases, totalDays);
  const granLabels: Record<typeof gran, string> = { mensual: 'mensual', trimestral: 'trimestral', semestral: 'semestral', anual: 'anual' };
  const referenceMode: SurveillanceAnalysis['referenceMode'] = manual
    ? 'manual'
    : !rate.serviceReferences?.length
      ? (rate.reference != null ? 'uniform' : 'none')
      : overallReference !== null
        ? 'uniform'
        : 'per_unit';

  return {
    rateName: rate.name,
    unitLabel: rate.unit,
    numeratorLabel: rate.numerator,
    denominatorLabel: rate.denominator,
    factor,
    reference: overallReference,
    totalCases,
    totalDeviceDays: totalDays,
    overallRate,
    exceedsReference: overallRate !== null && overallReference !== null && overallRate > overallReference,
    byUnit,
    byPeriod,
    hasDate: dateCol !== null && byPeriod.length > 0,
    granularityLabel: granLabels[gran],
    totalPatientDays: anyPatientDays ? totalPatientDays : null,
    utilizationRatio: anyPatientDays && totalPatientDays > 0 ? roundN(totalDays / totalPatientDays, 2) : null,
    numeratorFound: numCol !== null,
    denominatorFound: denCol !== null,
    format,
    services,
    referenceLabel: rate.referenceLabel ?? 'Servicio',
    selectedService: manual,
    referenceMode,
    hasUnresolvedService,
  };
}

/** Ejecuta el motor de análisis completo. */
export function analyze(workbook: ParsedWorkbook, config: ReportConfig): AnalysisResult {
  const goal = config.goal;

  // Base de trabajo: solo filas de pacientes reales (descarta resumen/totales y vacías).
  const dataRows = validPatientRows(workbook);
  const data: ParsedWorkbook = { ...workbook, rows: dataRows };
  const { columns } = data;

  const complianceCols = columnsForRole(columns, 'cumplimiento');
  const descriptiveCols = columnsForRole(columns, 'descriptivo');
  const unitCol = columnForRole(columns, 'unidad');
  const shiftCol = columnForRole(columns, 'turno');
  const indicatorCol = columnForRole(columns, 'indicador');
  const pc = resolveProgramConfig(config);

  // Filas descriptivas (formato largo) para la prevalencia.
  const isDescRow = (row: RawRow) => (indicatorCol ? isDescriptive(row[indicatorCol], pc.descriptiveVariables) : false);
  const descriptiveRows = indicatorCol ? dataRows.filter(isDescRow) : [];

  // Base de cumplimiento: sin descriptivas y, en NT 234 / LPP, solo riesgo moderado/alto.
  const complianceRows = complianceRowsFor(data, config);

  // Indicadores complementarios: se informan pero NO cuentan para el cumplimiento
  // oficial. Sin complementarios (NT 234, Higiene de Manos) todo esto es un no-op.
  const complementarySet = new Set((pc.complementaryIndicators ?? []).map((n) => normalize(pc.canonicalizeIndicator(n) ?? n)));
  const isComplementaryLabel = (label: unknown) => complementarySet.has(normalize(pc.canonicalizeIndicator(label) ?? String(label ?? '')));
  // Columnas de cumplimiento OFICIALES (formato ancho): excluye complementarias.
  const officialCols = complementarySet.size === 0 ? complianceCols : complianceCols.filter((c) => !isComplementaryLabel(c));

  // Cumplimiento global OFICIAL (solo obligatorios).
  let cumple = 0;
  let noCumple = 0;
  let noAplica = 0;
  for (const row of complianceRows) {
    // Formato largo: excluye las filas cuyo indicador es complementario.
    if (indicatorCol && complementarySet.size > 0 && isComplementaryLabel(row[indicatorCol])) continue;
    const t = tally(row, indicatorCol ? complianceCols : officialCols);
    cumple += t.cumple;
    noCumple += t.noCumple;
    noAplica += t.noAplica;
  }
  const aplicables = cumple + noCumple;
  const globalPercent = pct(cumple, aplicables);
  const global: GlobalCompliance = {
    cumple,
    noCumple,
    noAplica,
    aplicables,
    percent: globalPercent,
    meetsGoal: aplicables > 0 && globalPercent >= goal,
  };

  const byIndicatorRaw = complianceByIndicator(complianceRows, indicatorCol, complianceCols, goal, pc.canonicalizeIndicator, pc.descriptiveVariables);
  // Con complementarios: marca el tipo de cada indicador para separarlos en el
  // informe. Sin complementarios: se deja tal cual (kind indefinido) → sin cambios.
  const byIndicator =
    complementarySet.size === 0
      ? byIndicatorRaw
      : byIndicatorRaw.map((g) => ({ ...g, kind: isComplementaryLabel(g.label) ? ('complementario' as const) : ('obligatorio' as const) }));
  // Indicadores oficiales (obligatorios) para KPIs de críticos/destacados.
  const officialGroups = complementarySet.size === 0 ? byIndicator : byIndicator.filter((g) => g.kind !== 'complementario');
  const byBreakdown = complianceByBreakdowns(columns, pc.breakdowns ?? [], complianceRows, complianceCols, goal);
  const descriptiveVars = descriptiveVariables(dataRows, descriptiveCols, descriptiveRows, indicatorCol, complianceCols);

  // Caracterización clínica por paciente (filtro de riesgo solo en NT 234 / LPP).
  const characterization = clinicalCharacterization(data, config);

  // Análisis temporal (evolución + períodos disponibles) sobre la misma base.
  const temporal = buildTemporal(data, config, complianceRows);

  // Vigilancia epidemiológica (solo auditorías en modo 'vigilancia' con tasa).
  const audit = pc.audits?.find((x) => x.id === config.auditId);
  const surveillance =
    pc.auditMode === 'vigilancia' && audit && audit.rates.length > 0
      ? analyzeSurveillance(data, config, audit.rates[0])
      : undefined;

  return {
    config,
    totalRecords: dataRows.length,
    global,
    totalByUnit: countBy(dataRows, unitCol),
    totalByShift: countBy(dataRows, shiftCol),
    complianceByUnit: complianceBy(complianceRows, unitCol, complianceCols, goal),
    complianceByShift: complianceBy(complianceRows, shiftCol, complianceCols, goal),
    complianceByIndicator: byIndicator,
    complianceByBreakdown: byBreakdown,
    criticalIndicators: officialGroups.filter((i) => i.aplicables > 0 && !i.meetsGoal).sort((a, b) => a.percent - b.percent),
    highlightedIndicators: officialGroups.filter((i) => i.meetsGoal).sort((a, b) => b.percent - a.percent),
    descriptiveVariables: descriptiveVars,
    characterization,
    temporal,
    surveillance,
    detected: {
      unidad: unitCol !== null,
      turno: shiftCol !== null,
      indicador: indicatorCol !== null || complianceCols.length > 0,
    },
  };
}

/** Lista de unidades presentes (para el selector de unidad). */
/** Palabras que no son unidades (totales, resúmenes, etc.). */
const NON_UNIT_PREFIX = /^(total|totales|subtotal|sub total|general|promedio|suma|resumen)\b/;

/**
 * ¿El valor corresponde al nombre de una unidad? Excluye vacíos, números puros,
 * porcentajes y filas de totales/resumen.
 */
function isValidUnitValue(value: unknown): boolean {
  const norm = normalize(value);
  if (!norm) return false; // vacío
  if (!/[a-z]/.test(norm)) return false; // solo números / porcentajes
  if (NON_UNIT_PREFIX.test(norm)) return false; // totales / resúmenes
  return true;
}

/**
 * Clave canónica para agrupar variantes de una misma unidad
 * (p. ej. "UCM6", "UCM 6", "UCM 6°", "UCM 6 piso" → misma clave).
 */
export function unitCanonicalKey(value: unknown): string {
  return normalize(value)
    .replace(/\bpiso\b/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Opciones del selector de unidad: únicamente nombres de unidad tomados de la
 * columna "Unidad" (respetando la corrección manual del usuario), sin números,
 * porcentajes, totales, vacíos ni duplicados, con variantes normalizadas y
 * ordenadas alfabéticamente.
 */
export function listUnits(workbook: ParsedWorkbook): string[] {
  const unitCol = columnForRole(workbook.columns, 'unidad');
  if (!unitCol) return [];
  // clave canónica → forma de despliegue más completa (la más larga).
  const byKey = new Map<string, string>();
  for (const row of workbook.rows) {
    const raw = String(row[unitCol] ?? '').trim();
    if (!isValidUnitValue(raw)) continue;
    const key = unitCanonicalKey(raw);
    if (!key) continue;
    const current = byKey.get(key);
    if (!current || raw.length > current.length) byKey.set(key, raw);
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

/** Devuelve un workbook filtrado a una sola unidad (comparando por clave canónica). */
export function filterWorkbookByUnit(workbook: ParsedWorkbook, unit: string): ParsedWorkbook {
  const unitCol = columnForRole(workbook.columns, 'unidad');
  if (!unitCol) return workbook;
  const target = unitCanonicalKey(unit);
  return { ...workbook, rows: workbook.rows.filter((r) => unitCanonicalKey(r[unitCol]) === target) };
}

/**
 * Matriz de cumplimiento por turno dentro de cada unidad
 * (el global por turno y el desglose de cada unidad).
 */
export function unitShiftMatrix(workbook: ParsedWorkbook, config: ReportConfig): UnitShiftMatrix {
  const { columns } = workbook;
  const unitCol = columnForRole(columns, 'unidad');
  const shiftCol = columnForRole(columns, 'turno');
  const complianceCols = columnsForRole(columns, 'cumplimiento');
  if (!unitCol || !shiftCol) return { shifts: [], rows: [] };

  // Misma base de cumplimiento que el resto (respeta el filtro de riesgo NT 234).
  const dataRows = complianceRowsFor(workbook, config);

  const shiftSet = new Set<string>();
  for (const row of dataRows) {
    const s = labelOf(row[shiftCol]);
    if (s !== UNGROUPED) shiftSet.add(s);
  }
  const shifts = Array.from(shiftSet).sort((a, b) => a.localeCompare(b));

  // Acumula por unidad y por (unidad, turno).
  const perUnit = new Map<string, { cumple: number; noCumple: number }>();
  const perCell = new Map<string, { cumple: number; noCumple: number }>();
  for (const row of dataRows) {
    const unit = labelOf(row[unitCol]);
    if (unit === UNGROUPED) continue;
    const shift = labelOf(row[shiftCol]);
    const t = tally(row, complianceCols);
    const u = perUnit.get(unit) ?? { cumple: 0, noCumple: 0 };
    u.cumple += t.cumple;
    u.noCumple += t.noCumple;
    perUnit.set(unit, u);
    const key = `${unit}||${shift}`;
    const c = perCell.get(key) ?? { cumple: 0, noCumple: 0 };
    c.cumple += t.cumple;
    c.noCumple += t.noCumple;
    perCell.set(key, c);
  }

  const rowsOut = Array.from(perUnit.entries())
    .map(([unit, u]) => {
      const byShift: Record<string, number | null> = {};
      for (const s of shifts) {
        const cell = perCell.get(`${unit}||${s}`);
        byShift[s] = cell && cell.cumple + cell.noCumple > 0 ? pct(cell.cumple, cell.cumple + cell.noCumple) : null;
      }
      return { unit, overall: pct(u.cumple, u.cumple + u.noCumple), byShift };
    })
    .sort((a, b) => b.overall - a.overall);

  return { shifts, rows: rowsOut };
}
