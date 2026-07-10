import type { AnalysisResult } from '../types';
import { PALETTE, complianceHex, type TrafficColors } from './palette';

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  color: string; // hex
}

/** KPIs resumidos para las exportaciones (mismo criterio que las tarjetas en pantalla). */
export function summaryKpis(a: AnalysisResult, colors?: TrafficColors): Kpi[] {
  const g = a.global;
  const green = colors?.verde ?? PALETTE.green;
  const red = colors?.rojo ?? PALETTE.red;
  return [
    { label: 'Registros', value: String(a.totalRecords), hint: `${g.aplicables} aplicables`, color: PALETTE.ink },
    { label: 'Cumplimiento global', value: `${g.percent}%`, hint: `Meta ${a.config.goal}%`, color: complianceHex(g.percent, a.config.goal, colors) },
    { label: 'Cumple', value: String(g.cumple), color: green },
    { label: 'No cumple', value: String(g.noCumple), color: red },
    { label: 'Indicadores críticos', value: String(a.criticalIndicators.length), hint: `${a.highlightedIndicators.length} sobre la meta`, color: a.criticalIndicators.length ? red : green },
  ];
}
