import { saveAs } from 'file-saver';
import type { AnalysisResult, ComplianceGroup } from '../types';
import { rowsToWorkbookBlob } from './excelParser';
import { reportTypeLabel } from '../config/options';

/** Convierte grupos de cumplimiento en filas de auditoría con numerador/denominador/fórmula. */
function auditRows(groups: ComplianceGroup[]): Record<string, unknown>[] {
  return groups.map((g) => ({
    Categoría: g.label,
    'Pacientes incluidos': g.total,
    Cumple: g.cumple,
    'No cumple': g.noCumple,
    'N/A': g.noAplica,
    'Denominador (cumple + no cumple)': g.aplicables,
    'Numerador (cumple)': g.cumple,
    Fórmula: g.aplicables > 0 ? `${g.cumple} / ${g.aplicables} × 100` : 'Sin casos aplicables',
    'Resultado %': g.percent,
  }));
}

/**
 * Exporta un Excel de auditoría con la trazabilidad completa de los cálculos
 * (numerador, denominador, fórmula y resultado) por indicador, unidad y turno,
 * más el global y la caracterización clínica.
 */
export function exportAuditExcel(a: AnalysisResult): void {
  const g = a.global;
  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [
    {
      name: 'Global',
      rows: [
        {
          Categoría: 'CUMPLIMIENTO GLOBAL',
          'Pacientes incluidos': g.cumple + g.noCumple + g.noAplica,
          Cumple: g.cumple,
          'No cumple': g.noCumple,
          'N/A': g.noAplica,
          'Denominador (cumple + no cumple)': g.aplicables,
          'Numerador (cumple)': g.cumple,
          Fórmula: g.aplicables > 0 ? `${g.cumple} / ${g.aplicables} × 100` : 'Sin casos aplicables',
          'Resultado %': g.percent,
        },
      ],
    },
    { name: 'Por indicador', rows: auditRows(a.complianceByIndicator) },
  ];

  if (a.complianceByUnit.length) sheets.push({ name: 'Por unidad', rows: auditRows(a.complianceByUnit) });
  if (a.complianceByShift.length) sheets.push({ name: 'Por turno', rows: auditRows(a.complianceByShift) });

  const c = a.characterization;
  sheets.push({
    name: 'Caracterización',
    rows: [
      { Concepto: 'Pacientes auditados', Valor: c.totalOriginal },
      { Concepto: 'Pacientes incluidos (moderado + alto)', Valor: c.includedByRisk },
      { Concepto: 'Pacientes excluidos (sin / bajo riesgo)', Valor: c.excludedByRisk },
      { Concepto: 'Pacientes con LPP', Valor: c.lppPositive ?? '—' },
      { Concepto: '% pacientes con LPP', Valor: c.lppPrevalence ?? '—' },
      { Concepto: 'Filtro de riesgo aplicado (NT 234)', Valor: c.riskFilterApplied ? 'Sí' : 'No' },
    ],
  });

  const blob = rowsToWorkbookBlob(sheets);
  saveAs(blob, `NEX-Report_Auditoria_${reportTypeLabel(a.config.reportType).replace(/\s+/g, '-')}.xlsx`);
}
