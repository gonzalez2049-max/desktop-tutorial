import type {
  AnalysisResult,
  ClinicalCharacterization,
  ComplianceGroup,
  DescriptiveVariable,
  GlobalCompliance,
  GroupCount,
  ParsedWorkbook,
  RawRow,
  ReportConfig,
  UnitShiftMatrix,
} from '../types';
import { classifyCompliance, classifyRisk, columnForRole, columnsForRole, isDescriptiveVariable, type RiskLevel } from './columnDetection';
import { canonicalIndicatorNT234 } from './nt234';
import { classifyLppStage, isLppStageColumn, LPP_STAGES, type LppStage } from './lpp';

const UNGROUPED = 'Sin especificar';

/** ¿La celda está vacía? Un vacío en columna de cumplimiento cuenta como "no aplica". */
function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
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
  isNT234: boolean,
): ComplianceGroup[] {
  // Solo NT 234 / LPP reconoce los nombres oficiales (tolerando errores/abreviaturas).
  const canon = (label: string) => (isNT234 ? canonicalIndicatorNT234(label) ?? label : label);
  if (indicatorCol) {
    return complianceBy(rows, indicatorCol, complianceCols, goal, canon).filter((g) => !isDescriptiveVariable(g.label));
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
 * Filas base para el cálculo de cumplimiento: excluye variables descriptivas
 * (formato largo) y, SOLO en NT 234 / LPP con columna de riesgo, deja únicamente
 * los pacientes de riesgo moderado y alto.
 */
function complianceRowsFor(workbook: ParsedWorkbook, config: ReportConfig): RawRow[] {
  const { rows, columns } = workbook;
  const indicatorCol = columnForRole(columns, 'indicador');
  const riskCol = columnForRole(columns, 'riesgo');
  let out = indicatorCol ? rows.filter((r) => !isDescriptiveVariable(r[indicatorCol])) : rows.slice();
  if (config.reportType === 'NT234_LPP' && riskCol) {
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
 * Caracterización clínica POR PACIENTE (no por fila de indicador). Deduplica por
 * la columna de paciente cuando existe; si no, cada registro cuenta como uno.
 */
function clinicalCharacterization(workbook: ParsedWorkbook, config: ReportConfig): ClinicalCharacterization {
  const { rows, columns } = workbook;
  const patientCol = columnForRole(columns, 'paciente');
  const riskCol = columnForRole(columns, 'riesgo');
  const indicatorCol = columnForRole(columns, 'indicador');
  const complianceCols = columnsForRole(columns, 'cumplimiento');
  const descriptiveCols = columnsForRole(columns, 'descriptivo');
  const isNT234 = config.reportType === 'NT234_LPP';
  // Columnas donde buscar la clasificación por estadio de LPP.
  const stageCols = columns
    .map((c) => c.original)
    .filter((h) => isLppStageColumn(h) || isDescriptiveVariable(h));

  interface PInfo {
    risk: RiskLevel;
    lppPos: boolean;
    lppAns: boolean;
    stage: LppStage | null;
  }
  const patients = new Map<string, PInfo>();

  rows.forEach((row, idx) => {
    const key = patientCol ? labelOf(row[patientCol]) : `registro-${idx}`;
    const info = patients.get(key) ?? { risk: 'desconocido', lppPos: false, lppAns: false, stage: null };

    if (riskCol) {
      const lvl = classifyRisk(row[riskCol]);
      if (info.risk === 'desconocido' && lvl !== 'desconocido') info.risk = lvl;
    }

    // LPP como columna descriptiva (formato ancho).
    for (const col of descriptiveCols) {
      const c = classifyCompliance(row[col]);
      if (c === 'cumple') {
        info.lppPos = true;
        info.lppAns = true;
      } else if (c === 'no_cumple') info.lppAns = true;
    }
    // LPP como valor de la columna indicador (formato largo).
    if (indicatorCol && isDescriptiveVariable(row[indicatorCol])) {
      const t = tally(row, complianceCols);
      if (t.cumple > 0) {
        info.lppPos = true;
        info.lppAns = true;
      } else if (t.noCumple > 0) info.lppAns = true;
    }

    // Clasificación por estadio (una lesión clasificada implica LPP presente).
    // No cuenta como "respuesta Sí/No"; el denominador se ajusta más abajo.
    if (!info.stage) {
      for (const col of stageCols) {
        const st = classifyLppStage(row[col]);
        if (st) {
          info.stage = st;
          info.lppPos = true;
          break;
        }
      }
    }

    patients.set(key, info);
  });

  let included = 0;
  let lppPos = 0;
  let explicitAns = 0; // pacientes con respuesta explícita Sí/No de LPP
  const stageAcc = new Map<string, number>();
  for (const info of patients.values()) {
    if (info.risk === 'alto' || info.risk === 'moderado') included++;
    if (info.lppPos) lppPos++;
    if (info.lppAns) explicitAns++;
    if (info.stage) stageAcc.set(info.stage, (stageAcc.get(info.stage) ?? 0) + 1);
  }
  const total = patients.size;
  const riskFilterApplied = isNT234 && riskCol !== null;
  const stagesPresent = stageAcc.size > 0;
  // Con clasificación por estadio, todos los pacientes fueron evaluados para LPP
  // (la ausencia de estadio equivale a "sin LPP"); si solo hay Sí/No, se usan las
  // respuestas explícitas.
  const answered = stagesPresent ? total : explicitAns;
  const hasLpp = lppPos > 0;

  const lppStages = stagesPresent
    ? LPP_STAGES.map((stage) => {
        const count = stageAcc.get(stage) ?? 0;
        return { stage, count, percent: pct(count, lppPos) };
      })
    : [];

  return {
    totalOriginal: total,
    includedByRisk: riskFilterApplied ? included : total,
    excludedByRisk: riskFilterApplied ? total - included : 0,
    riskFilterApplied,
    lppPositive: hasLpp ? lppPos : null,
    lppAnswered: hasLpp ? answered : null,
    lppPrevalence: hasLpp ? pct(lppPos, answered) : null,
    lppStages,
  };
}

/** Ejecuta el motor de análisis completo. */
export function analyze(workbook: ParsedWorkbook, config: ReportConfig): AnalysisResult {
  const { rows, columns } = workbook;
  const goal = config.goal;

  const complianceCols = columnsForRole(columns, 'cumplimiento');
  const descriptiveCols = columnsForRole(columns, 'descriptivo');
  const unitCol = columnForRole(columns, 'unidad');
  const shiftCol = columnForRole(columns, 'turno');
  const indicatorCol = columnForRole(columns, 'indicador');
  const isNT234 = config.reportType === 'NT234_LPP';

  // Filas descriptivas (formato largo) para la prevalencia.
  const isDescRow = (row: RawRow) => (indicatorCol ? isDescriptiveVariable(row[indicatorCol]) : false);
  const descriptiveRows = indicatorCol ? rows.filter(isDescRow) : [];

  // Base de cumplimiento: sin descriptivas y, en NT 234 / LPP, solo riesgo moderado/alto.
  const complianceRows = complianceRowsFor(workbook, config);

  // Cumplimiento global.
  let cumple = 0;
  let noCumple = 0;
  let noAplica = 0;
  for (const row of complianceRows) {
    const t = tally(row, complianceCols);
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

  const byIndicator = complianceByIndicator(complianceRows, indicatorCol, complianceCols, goal, isNT234);
  const descriptiveVars = descriptiveVariables(rows, descriptiveCols, descriptiveRows, indicatorCol, complianceCols);

  // Caracterización clínica por paciente (filtro de riesgo solo en NT 234 / LPP).
  const characterization = clinicalCharacterization(workbook, config);

  return {
    config,
    totalRecords: rows.length,
    global,
    totalByUnit: countBy(rows, unitCol),
    totalByShift: countBy(rows, shiftCol),
    complianceByUnit: complianceBy(complianceRows, unitCol, complianceCols, goal),
    complianceByShift: complianceBy(complianceRows, shiftCol, complianceCols, goal),
    complianceByIndicator: byIndicator,
    criticalIndicators: byIndicator.filter((i) => i.aplicables > 0 && !i.meetsGoal).sort((a, b) => a.percent - b.percent),
    highlightedIndicators: byIndicator.filter((i) => i.meetsGoal).sort((a, b) => b.percent - a.percent),
    descriptiveVariables: descriptiveVars,
    characterization,
    detected: {
      unidad: unitCol !== null,
      turno: shiftCol !== null,
      indicador: indicatorCol !== null || complianceCols.length > 0,
    },
  };
}

/** Lista de unidades presentes (para el selector de unidad). */
export function listUnits(workbook: ParsedWorkbook): string[] {
  const unitCol = columnForRole(workbook.columns, 'unidad');
  if (!unitCol) return [];
  const set = new Set<string>();
  for (const row of workbook.rows) {
    const label = labelOf(row[unitCol]);
    if (label !== UNGROUPED) set.add(label);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Devuelve un workbook filtrado a una sola unidad. */
export function filterWorkbookByUnit(workbook: ParsedWorkbook, unit: string): ParsedWorkbook {
  const unitCol = columnForRole(workbook.columns, 'unidad');
  if (!unitCol) return workbook;
  return { ...workbook, rows: workbook.rows.filter((r) => labelOf(r[unitCol]) === unit) };
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
