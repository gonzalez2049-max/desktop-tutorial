import type { ParsedWorkbook, ReportConfig, ReportSummary } from '../types';
import { classifyCompliance, columnsForRole } from './columnDetection';

/**
 * Cálculo básico tras "Generar reporte": cuenta el cumplimiento global y
 * detecta qué dimensiones hay disponibles. Es intencionalmente simple; el
 * dashboard, PDF y Word llegan en una entrega posterior.
 */
export function buildSummary(workbook: ParsedWorkbook, config: ReportConfig): ReportSummary {
  const complianceCols = columnsForRole(workbook.columns, 'cumplimiento');

  let cumple = 0;
  let noCumple = 0;
  let noAplica = 0;

  for (const row of workbook.rows) {
    for (const col of complianceCols) {
      const c = classifyCompliance(row[col]);
      if (c === 'cumple') cumple++;
      else if (c === 'no_cumple') noCumple++;
      else if (c === 'no_aplica') noAplica++;
    }
  }

  const applicableRows = cumple + noCumple;
  const globalPercent = applicableRows === 0 ? 0 : Number(((cumple / applicableRows) * 100).toFixed(1));
  const roles = new Set(workbook.columns.map((c) => c.role));

  return {
    config,
    totalRows: workbook.rows.length,
    applicableRows,
    cumple,
    noCumple,
    noAplica,
    globalPercent,
    meetsGoal: globalPercent >= config.goal,
    detectedDimensions: {
      unidad: roles.has('unidad'),
      turno: roles.has('turno'),
      indicador: roles.has('indicador'),
      fecha: roles.has('fecha'),
      riesgo: roles.has('riesgo'),
    },
  };
}
