// Gráficos institucionales del informe, renderizados a imagen (PNG) para poder
// incrustarlos igual en el PDF y en el Word (y, por tanto, en la vista previa).
// Estilo limpio y ejecutivo; sin dependencias externas.
import type { AnalysisResult, ComplianceGroup } from '../types';
import { PALETTE, complianceHex, type TrafficColors } from './palette';
import { analysisTypeLabel, showsEvolution } from '../config/options';

const DEFAULT_TRAFFIC: TrafficColors = { verde: PALETTE.green, amarillo: PALETTE.amber, rojo: PALETTE.red };

export interface ReportChart {
  title: string;
  dataUrl: string;
  /** Ancho/alto lógicos (en puntos) para el layout del PDF/Word. */
  width: number;
  height: number;
}

const SCALE = 2; // renderizado nítido (alta densidad)
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';
  // Fondo blanco (institucional).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Velocímetro (gauge) de cumplimiento global con zonas de color y aguja. */
function gaugeChart(a: AnalysisResult, colors: TrafficColors): ReportChart {
  const w = 340;
  const h = 210;
  const { canvas, ctx } = makeCanvas(w, h);
  const cx = w / 2;
  const cy = 150;
  const r = 110;
  const goal = a.config.goal;
  const pct = a.global.percent;
  const ang = (v: number) => Math.PI + (Math.min(100, Math.max(0, v)) / 100) * Math.PI;

  // Zonas: rojo [0, goal-10), ámbar [goal-10, goal), verde [goal, 100].
  const zones: [number, number, string][] = [
    [0, Math.max(0, goal - 10), colors.rojo],
    [Math.max(0, goal - 10), goal, colors.amarillo],
    [goal, 100, colors.verde],
  ];
  ctx.lineWidth = 24;
  ctx.lineCap = 'butt';
  for (const [from, to, color] of zones) {
    if (to <= from) continue;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.arc(cx, cy, r, ang(from), ang(to));
    ctx.stroke();
  }

  // Aguja.
  const a2 = ang(pct);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a2) * (r - 6), cy + Math.sin(a2) * (r - 6));
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
  ctx.fill();

  // Valor y meta.
  ctx.textAlign = 'center';
  ctx.fillStyle = complianceHex(pct, goal, colors);
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(`${pct}%`, cx, cy - 34);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(`Cumplimiento global · Meta ${goal}%`, cx, cy + 34);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'left';
  ctx.fillText('0%', cx - r - 6, cy + 12);
  ctx.textAlign = 'right';
  ctx.fillText('100%', cx + r + 6, cy + 12);

  return { title: 'Cumplimiento global', dataUrl: canvas.toDataURL('image/png'), width: 260, height: 160 };
}

/** Barras horizontales de cumplimiento por categoría, con línea de meta. */
function barsChart(title: string, groups: ComplianceGroup[], goal: number, colors: TrafficColors, opts: { labelW?: number } = {}): ReportChart {
  const labelW = opts.labelW ?? 150;
  const rowH = 26;
  const padT = 14;
  const padB = 24;
  const barMaxW = 300;
  const w = labelW + barMaxW + 60;
  const h = padT + groups.length * rowH + padB;
  const { canvas, ctx } = makeCanvas(w, h);
  const x0 = labelW + 8;

  // Línea de meta.
  const goalX = x0 + (goal / 100) * barMaxW;
  ctx.strokeStyle = PALETTE.blue;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(goalX, padT - 4);
  ctx.lineTo(goalX, padT + groups.length * rowH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PALETTE.blue;
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`Meta ${goal}%`, goalX, h - 10);

  groups.forEach((g, i) => {
    const y = padT + i * rowH + rowH / 2;
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(truncate(ctx, g.label, labelW - 4), 4, y);
    // Pista.
    ctx.fillStyle = PALETTE.gray;
    ctx.fillRect(x0, y - 8, barMaxW, 16);
    // Barra.
    ctx.fillStyle = complianceHex(g.percent, goal, colors);
    ctx.fillRect(x0, y - 8, (g.percent / 100) * barMaxW, 16);
    // Valor.
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${g.percent}%`, x0 + barMaxW + 8, y);
  });

  return { title, dataUrl: canvas.toDataURL('image/png'), width: Math.min(360, w), height: (Math.min(360, w) / w) * h };
}

/** Dona de distribución de LPP por clasificación/estadio. */
function lppDonut(a: AnalysisResult): ReportChart | null {
  const stages = a.characterization.lppStages.filter((s) => s.count > 0);
  const total = stages.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;
  const w = 360;
  const h = 200;
  const { canvas, ctx } = makeCanvas(w, h);
  const cx = 100;
  const cy = 100;
  const rO = 78;
  const rI = 46;
  const colors = [PALETTE.blue, PALETTE.amber, PALETTE.green, PALETTE.red, '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6'];
  let start = -Math.PI / 2;
  stages.forEach((s, i) => {
    const frac = s.count / total;
    const end = start + frac * 2 * Math.PI;
    ctx.beginPath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rO, start, end);
    ctx.closePath();
    ctx.fill();
    start = end;
  });
  // Agujero.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, rI, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(String(total), cx, cy - 6);
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('con LPP', cx, cy + 14);
  // Leyenda.
  ctx.textAlign = 'left';
  stages.forEach((s, i) => {
    const y = 24 + i * 20;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(200, y - 6, 12, 12);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(truncate(ctx, `${s.stage} (${s.count})`, 150), 218, y);
  });
  return { title: 'Distribución de pacientes con LPP', dataUrl: canvas.toDataURL('image/png'), width: 320, height: 178 };
}

/** Evolución del cumplimiento por período (línea). */
function evolutionChart(a: AnalysisResult, colors: TrafficColors): ReportChart | null {
  const pts = a.temporal.evolution;
  if (!pts.length) return null;
  const w = 380;
  const h = 200;
  const { canvas, ctx } = makeCanvas(w, h);
  const goal = a.config.goal;
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const x = (i: number) => padL + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW);
  const y = (v: number) => padT + (1 - v / 100) * plotH;

  // Ejes / grilla.
  ctx.strokeStyle = PALETTE.gray;
  ctx.lineWidth = 1;
  [0, 25, 50, 75, 100].forEach((g) => {
    ctx.beginPath();
    ctx.moveTo(padL, y(g));
    ctx.lineTo(w - padR, y(g));
    ctx.stroke();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${g}`, padL - 4, y(g));
  });
  // Meta.
  ctx.strokeStyle = PALETTE.blue;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, y(goal));
  ctx.lineTo(w - padR, y(goal));
  ctx.stroke();
  ctx.setLineDash([]);
  // Línea.
  ctx.strokeStyle = PALETTE.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.percent)) : ctx.lineTo(x(i), y(p.percent))));
  ctx.stroke();
  pts.forEach((p, i) => {
    ctx.fillStyle = complianceHex(p.percent, goal, colors);
    ctx.beginPath();
    ctx.arc(x(i), y(p.percent), 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(truncate(ctx, p.label, 70), x(i), h - 14);
  });
  return { title: `Evolución del cumplimiento (${analysisTypeLabel(a.config.analysisType).toLowerCase()})`, dataUrl: canvas.toDataURL('image/png'), width: 340, height: 179 };
}

/**
 * Construye los gráficos institucionales aplicables al informe. Devuelve solo
 * los que aportan valor (omite los que no tienen datos).
 */
export function buildReportCharts(a: AnalysisResult, colors: TrafficColors = DEFAULT_TRAFFIC): ReportChart[] {
  const charts: ReportChart[] = [];
  charts.push(gaugeChart(a, colors));
  if (a.complianceByIndicator.length) charts.push(barsChart('Cumplimiento por indicador', a.complianceByIndicator, a.config.goal, colors, { labelW: 170 }));
  if (a.complianceByShift.length) charts.push(barsChart('Cumplimiento por turno', a.complianceByShift, a.config.goal, colors, { labelW: 90 }));
  if (a.criticalIndicators.length) charts.push(barsChart('Indicadores bajo la meta (ranking)', a.criticalIndicators, a.config.goal, colors, { labelW: 170 }));
  const donut = lppDonut(a);
  if (donut) charts.push(donut);
  if (showsEvolution(a.config.analysisType) && a.temporal.hasDate) {
    const ev = evolutionChart(a, colors);
    if (ev) charts.push(ev);
  }
  return charts;
}
