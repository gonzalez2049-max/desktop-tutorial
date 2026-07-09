import type { AnalysisResult } from '../types';
import { PALETTE, complianceHex } from './palette';

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  color: string; // hex
}

/** KPIs resumidos para las exportaciones (mismo criterio que las tarjetas en pantalla). */
export function summaryKpis(a: AnalysisResult): Kpi[] {
  const g = a.global;
  return [
    { label: 'Registros', value: String(a.totalRecords), hint: `${g.aplicables} aplicables`, color: PALETTE.ink },
    { label: 'Cumplimiento global', value: `${g.percent}%`, hint: `Meta ${a.config.goal}%`, color: complianceHex(g.percent, a.config.goal) },
    { label: 'Cumple', value: String(g.cumple), color: PALETTE.green },
    { label: 'No cumple', value: String(g.noCumple), color: PALETTE.red },
    { label: 'No aplica', value: String(g.noAplica), color: PALETTE.muted },
    { label: 'Indicadores críticos', value: String(a.criticalIndicators.length), hint: `${a.highlightedIndicators.length} sobre la meta`, color: a.criticalIndicators.length ? PALETTE.red : PALETTE.green },
  ];
}
