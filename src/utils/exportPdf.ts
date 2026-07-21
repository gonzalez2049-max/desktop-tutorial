import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult, ClinicalCharacterization, ComplianceGroup, ExecutiveReport } from '../types';
import { buildExecutiveReport } from './executiveReport';
import { analysisTypeLabel, showsEvolution } from '../config/options';
import { buildReportCharts, buildSurveillanceCharts } from './reportCharts';
import { resolveProgramConfig } from './programConfig';
import type { ProgramConfig } from '../config/programs';
import { summaryKpis } from './reportModel';
import { complianceHex, hexToRgb, trafficHex, trafficLightFor, type TrafficColors } from './palette';

interface Ctx {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  margin: number;
  y: number;
  colors: TrafficColors;
  program: ProgramConfig;
  folio: string;
}

// Identidad de documento: verde institucional NEX (masthead + acentos).
const FOREST = hexToRgb('#0f3d2e');
const ACCENT = hexToRgb('#0f7a4f');
const TINT = hexToRgb('#e9f3ec');
const INK = hexToRgb('#14211c');
const MUTED = hexToRgb('#63736b');
const FAINT = hexToRgb('#8a988f');
const LINE = hexToRgb('#dbe4de');
const WHITE: [number, number, number] = [255, 255, 255];

/** Asegura espacio vertical; añade página si hace falta. */
function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > ctx.pageH - ctx.margin - 8) {
    ctx.doc.addPage();
    ctx.y = ctx.margin;
  }
}

function lastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Estilos base de las tablas (encabezado verde, cuerpo con líneas finas). */
function tableTheme(extra?: Record<string, unknown>) {
  return {
    theme: 'grid' as const,
    headStyles: { fillColor: FOREST, textColor: WHITE, fontSize: 8.5, halign: 'center' as const, lineColor: LINE, lineWidth: 0.5, cellPadding: 4.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4.5, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    alternateRowStyles: { fillColor: hexToRgb('#f7faf8') },
    ...extra,
  };
}

/** Masthead institucional (franja verde a todo el ancho, solo en la página 1). */
function drawMasthead(ctx: Ctx, report: ExecutiveReport): void {
  const { doc, pageW, margin, program } = ctx;
  const h = 48;
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, pageW, h, 'F');
  // Marca
  doc.setFillColor(...hexToRgb('#57d38b'));
  doc.circle(margin + 7, 24, 8.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...FOREST);
  doc.text('N', margin + 4.4, 27.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(234, 243, 238);
  doc.text('NEX Report', margin + 22, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(169, 200, 186);
  doc.text('AUDITORÍAS CLÍNICAS', margin + 22, 33);
  // Tipo de informe (derecha)
  doc.setFontSize(7.5);
  doc.setTextColor(169, 200, 186);
  doc.text('INFORME DE AUDITORÍA', pageW - margin, 20, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text((program.programName || report.meta.reportTypeLabel).toUpperCase(), pageW - margin, 33, { align: 'right' });
  ctx.y = h + 26;
}

/** Bloque de título + ficha (dos columnas) bajo el masthead. */
function drawTitleBlock(ctx: Ctx, report: ExecutiveReport, fileName: string, a: AnalysisResult): void {
  const { doc, pageW, margin, program } = ctx;
  const metaW = 176;
  const titleW = pageW - margin * 2 - metaW - 20;
  // Título (serif) + subtítulo
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(report.title.replace(/^Resumen ejecutivo (de |del )?/i, '') || program.programName, titleW);
  const title = program.programName && program.programName.length > 3 ? program.programName : report.meta.reportTypeLabel;
  const headline = doc.splitTextToSize(title, titleW);
  doc.text(headline, margin, ctx.y);
  let leftY = ctx.y + headline.length * 20 + 4;
  void titleLines;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const sub = doc.splitTextToSize(program.executiveBaseText.split('.').slice(0, 1).join('.') + '.', titleW);
  doc.text(sub.slice(0, 3), margin, leftY);
  leftY += Math.min(sub.length, 3) * 11;

  // Ficha (derecha)
  const mx = pageW - margin - metaW;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(mx - 12, ctx.y - 8, mx - 12, ctx.y + 74);
  const meta: [string, string][] = [
    ['INSTITUCIÓN', program.institutionName || '—'],
    ['UNIDAD', program.unitName || '—'],
    ['PERÍODO', analysisTypeLabel(a.config.analysisType)],
    ['EMITIDO', report.meta.generatedAt],
    ['META', `${a.config.goal}%`],
    ['FOLIO', ctx.folio],
  ];
  let my = ctx.y - 1;
  meta.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...FAINT);
    doc.text(k, mx, my);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(v, pageW - margin, my, { align: 'right' });
    my += 12.5;
  });
  void fileName;
  ctx.y = Math.max(leftY, my) + 6;
  // Regla gruesa
  doc.setDrawColor(...FOREST);
  doc.setLineWidth(1.6);
  doc.line(margin, ctx.y, pageW - margin, ctx.y);
  ctx.y += 20;
}

/** Franja de resumen: conclusión + % grande + barra frente a la meta (cumplimiento). */
function drawResumenBand(ctx: Ctx, a: AnalysisResult): void {
  const { doc, pageW, margin } = ctx;
  const g = a.global;
  const light = trafficLightFor(g.percent, a.config.goal);
  const col = hexToRgb(trafficHex(light, ctx.colors));
  const h = 78;
  ensure(ctx, h + 8);
  // Fondo tenue + filo de acento
  doc.setFillColor(...TINT);
  doc.rect(margin, ctx.y, pageW - margin * 2, h, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(margin, ctx.y, 4, h, 'F');
  const rightW = 150;
  const textW = pageW - margin * 2 - rightW - 30;
  // Texto conclusión (izquierda)
  const meets = g.meetsGoal;
  const diff = Math.abs(Math.round((g.percent - a.config.goal) * 10) / 10);
  const lead = g.aplicables === 0
    ? `La medición no registró casos aplicables, por lo que no es posible emitir un juicio de cumplimiento en este período.`
    : `El cumplimiento global alcanzó ${g.percent}% sobre ${g.aplicables} oportunidades aplicables, ${diff} puntos ${meets ? 'por sobre' : 'bajo'} la meta institucional de ${a.config.goal}%.`;
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(lead, textW);
  doc.text(lines.slice(0, 4), margin + 18, ctx.y + 22);
  // % grande + barra (derecha)
  const rx = pageW - margin - rightW + 6;
  doc.setFont('times', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...col);
  doc.text(`${g.percent}%`, rx + rightW - 6, ctx.y + 34, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`meta ${a.config.goal}%`, rx + rightW - 6, ctx.y + 46, { align: 'right' });
  // Barra
  const barY = ctx.y + 56, barW = rightW - 6, barX = rx;
  doc.setFillColor(...hexToRgb('#dbe7df'));
  doc.roundedRect(barX, barY, barW, 7, 2, 2, 'F');
  doc.setFillColor(...col);
  doc.roundedRect(barX, barY, Math.max(3, (Math.min(g.percent, 100) / 100) * barW), 7, 2, 2, 'F');
  ctx.y += h + 20;
}

/** Tira de KPIs con separadores finos y valor coloreado. */
function drawKpis(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  const kpis = summaryKpis(a, ctx.colors);
  const cols = kpis.length;
  const totalW = pageW - margin * 2;
  const cardW = totalW / cols;
  const cardH = 52;
  ensure(ctx, cardH + 16);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.rect(margin, ctx.y, totalW, cardH, 'S');
  kpis.forEach((k, i) => {
    const x = margin + i * cardW;
    if (i > 0) { doc.setDrawColor(...LINE); doc.line(x, ctx.y, x, ctx.y + cardH); }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...hexToRgb(k.color));
    doc.text(k.value, x + 10, ctx.y + 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(k.label, cardW - 16), x + 10, ctx.y + 36);
    if (k.hint) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...FAINT); doc.text(k.hint, x + 10, ctx.y + 45); }
  });
  ctx.y += cardH + 22;
}

let sectionNo = 0;
/** Título de sección: número en círculo + título serif + regla. */
function sectionTitle(ctx: Ctx, title: string, numbered = true): void {
  const { doc, margin, pageW } = ctx;
  ensure(ctx, 30);
  ctx.y += 8;
  const cy = ctx.y - 3;
  if (numbered) {
    sectionNo += 1;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.2);
    doc.circle(margin + 8, cy, 8, 'S');
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ACCENT);
    doc.text(String(sectionNo), margin + 8, cy + 3.4, { align: 'center' });
  }
  const tx = numbered ? margin + 24 : margin;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, tx, cy + 4);
  const tw = doc.getTextWidth(title);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  doc.line(tx + tw + 12, cy, pageW - margin, cy);
  ctx.y += 14;
}

function drawComplianceTable(ctx: Ctx, groups: ComplianceGroup[], firstHeader: string, goal: number): void {
  const { doc, margin, pageW } = ctx;
  autoTable(doc, {
    startY: ctx.y,
    head: [[firstHeader, 'Cumple', 'No cumple', '%', 'Estado']],
    body: groups.map((g) => [g.label, String(g.cumple), String(g.noCumple), `${g.percent}%`, g.meetsGoal ? 'Cumple' : 'Bajo meta']),
    ...tableTheme(),
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
        const g = groups[data.row.index];
        if (g) data.cell.styles.textColor = hexToRgb(complianceHex(g.percent, goal, ctx.colors));
      }
    },
  });
  ctx.y = lastTableY(doc) + 18;
}

function drawCharacterization(ctx: Ctx, c: ClinicalCharacterization): void {
  const { doc, margin, pageW } = ctx;
  autoTable(doc, {
    startY: ctx.y,
    head: [['Concepto', 'Valor']],
    body: [
      ['Pacientes auditados', String(c.totalOriginal)],
      ['Pacientes con riesgo alto', String(c.highRisk)],
      ['Pacientes con riesgo moderado', String(c.moderateRisk)],
      ['Pacientes incluidos (riesgo moderado + alto)', c.includedByRisk !== null ? String(c.includedByRisk) : 'No determinado'],
      ['Pacientes excluidos (sin riesgo / bajo riesgo)', c.excludedByRisk !== null ? String(c.excludedByRisk) : 'No determinado'],
      ['Pacientes con LPP', c.lppPositive !== null ? String(c.lppPositive) : '—'],
      ['% pacientes con LPP', c.lppPrevalence !== null ? `${c.lppPrevalence}%` : '—'],
    ],
    ...tableTheme(),
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });
  ctx.y = lastTableY(doc) + 18;
}

function drawLppStages(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  const stages = a.characterization.lppStages.filter((s) => s.count > 0);
  autoTable(doc, {
    startY: ctx.y,
    head: [['Clasificación de LPP', 'Cantidad', 'Porcentaje']],
    body: [
      ['Total de pacientes con LPP', String(a.characterization.lppPositive ?? 0), '100%'],
      ...stages.map((s) => [s.stage, String(s.count), `${s.percent}%`]),
    ],
    ...tableTheme(),
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });
  ctx.y = lastTableY(doc) + 18;
}

function drawDescriptiveTable(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  autoTable(doc, {
    startY: ctx.y,
    head: [['Variable clínica', 'Positivos', 'Negativos', 'Prevalencia']],
    body: a.descriptiveVariables.map((v) => [v.label, String(v.positive), String(v.negative), `${v.prevalence}% (${v.positive}/${v.answered})`]),
    ...tableTheme(),
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold', textColor: ACCENT } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });
  ctx.y = lastTableY(doc) + 18;
}

function drawEvolution(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  const pts = a.temporal.evolution;
  const goal = a.config.goal;
  autoTable(doc, {
    startY: ctx.y,
    head: [['Período', 'Cumple', 'Aplicables', '%', 'Estado']],
    body: pts.map((p) => [p.label, String(p.cumple), String(p.total), `${p.percent}%`, p.meetsGoal ? 'Cumple' : 'Bajo meta']),
    ...tableTheme(),
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
        const p = pts[data.row.index];
        if (p) data.cell.styles.textColor = hexToRgb(complianceHex(p.percent, goal, ctx.colors));
      }
    },
  });
  ctx.y = lastTableY(doc) + 6;
  if (pts.length >= 2) {
    const delta = Number((pts[pts.length - 1].percent - pts[0].percent).toFixed(1));
    ensure(ctx, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Variación entre ${pts[0].label} y ${pts[pts.length - 1].label}: ${delta >= 0 ? '+' : ''}${delta} puntos porcentuales`, margin, (ctx.y += 12));
    ctx.y += 10;
  }
  ctx.y += 10;
}

/** Resumen ejecutivo: títulos de sección, párrafos y viñetas, con paginación. */
function drawExecutive(ctx: Ctx, report: ExecutiveReport): void {
  const { doc, margin, pageW } = ctx;
  const width = pageW - margin * 2;
  for (const s of report.sections) {
    sectionTitle(ctx, s.title);
    ctx.y += 2;
    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    for (const p of s.paragraphs) {
      const lines = doc.splitTextToSize(p, width);
      ensure(ctx, lines.length * 13 + 4);
      doc.text(lines, margin, (ctx.y += 13));
      ctx.y += (lines.length - 1) * 13;
    }
    if (s.bullets) {
      for (const b of s.bullets) {
        const lines = doc.splitTextToSize(b, width - 16);
        ensure(ctx, lines.length * 13 + 2);
        doc.setFillColor(...ACCENT);
        doc.circle(margin + 4, ctx.y + 11, 1.6, 'F');
        doc.setFont('times', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...INK);
        doc.text(lines, margin + 14, (ctx.y += 13));
        ctx.y += (lines.length - 1) * 13;
      }
    }
    if (s.actionPlan) {
      ensure(ctx, 60);
      autoTable(doc, {
        startY: ctx.y + 6,
        head: [['Prioridad', 'Hallazgo', 'Acción propuesta', 'Responsable', 'Plazo', 'Meta']],
        body: s.actionPlan.map((r) => [r.priority, r.finding, r.action, r.responsible, r.deadline, r.target]),
        ...tableTheme({ bodyStyles: { fontSize: 7.5, cellPadding: 3.5, textColor: INK, lineColor: LINE, lineWidth: 0.5, valign: 'top' }, headStyles: { fillColor: FOREST, textColor: WHITE, fontSize: 7.5, halign: 'left', lineColor: LINE, lineWidth: 0.5, cellPadding: 3.5 } }),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 46 }, 4: { cellWidth: 44 }, 5: { cellWidth: 40, fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
        tableWidth: width,
      });
      ctx.y = lastTableY(doc) + 6;
    }
    ctx.y += 6;
  }
}

function drawSurveillance(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  const s = a.surveillance!;
  const fmt = (r: number | null) => (r === null ? 's/d' : String(r));
  const mixed = s.referenceMode === 'per_unit';
  const alert = s.exceedsReference;

  // Franja de resumen de vigilancia.
  const col = hexToRgb(alert ? ctx.colors.rojo : mixed ? ctx.colors.amarillo : ctx.colors.verde);
  const h = 74;
  ensure(ctx, h + 8);
  doc.setFillColor(...TINT);
  doc.rect(margin, ctx.y, pageW - margin * 2, h, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(margin, ctx.y, 4, h, 'F');
  const estado = s.overallRate === null ? 'Tasa no calculable (sin días de exposición)'
    : mixed ? `referencia por ${s.referenceLabel.toLowerCase()} (ver por unidad)`
      : alert ? `sobre la referencia de ${s.reference}` : `en o bajo la referencia de ${s.reference ?? '—'}`;
  const lead = `${s.rateName}: ${fmt(s.overallRate)} ${s.unitLabel}, ${estado}. ${s.totalCases} casos sobre ${s.totalDeviceDays} ${s.denominatorLabel.toLowerCase()}.`;
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(lead, pageW - margin * 2 - 150), margin + 18, ctx.y + 22);
  doc.setFont('times', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...col);
  doc.text(fmt(s.overallRate), pageW - margin - 12, ctx.y + 34, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(s.unitLabel, pageW - margin - 12, ctx.y + 46, { align: 'right' });
  ctx.y += h + 18;

  // KPIs de vigilancia (tabla).
  const kpiRows: string[][] = [
    [s.numeratorLabel, String(s.totalCases)],
    [`${s.denominatorLabel} (denominador)`, String(s.totalDeviceDays)],
    [`Tasa global (${s.unitLabel})`, fmt(s.overallRate)],
    ['Referencia', s.reference !== null ? String(s.reference) : mixed ? `por ${s.referenceLabel.toLowerCase()}` : '—'],
  ];
  if (s.utilizationRatio !== null) kpiRows.push(['Razón de utilización', String(s.utilizationRatio)]);
  sectionTitle(ctx, 'Indicadores de vigilancia');
  autoTable(doc, {
    startY: ctx.y,
    head: [['Indicador', 'Valor']],
    body: kpiRows,
    ...tableTheme(),
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });
  ctx.y = lastTableY(doc) + 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text(`Formato detectado: ${s.format === 'aggregated' ? 'agregado (unidad × período)' : 'línea por caso'}${s.selectedService ? ` · ${s.referenceLabel.toLowerCase()}: ${s.services.find((x) => x.service === s.selectedService)?.label ?? s.selectedService}` : ''}`, margin, ctx.y - 6);

  const charts = buildSurveillanceCharts(s, ctx.colors);
  if (charts.length) {
    sectionTitle(ctx, 'Gráficos de vigilancia');
    for (const ch of charts) {
      ensure(ctx, ch.height + 20);
      doc.addImage(ch.dataUrl, 'PNG', margin, ctx.y + 2, ch.width, ch.height, undefined, 'FAST');
      ctx.y += ch.height + 14;
    }
  }

  const rateTable = (title: string, points: typeof s.byUnit, firstHeader: string) => {
    if (!points.length) return;
    sectionTitle(ctx, title);
    autoTable(doc, {
      startY: ctx.y,
      head: [[firstHeader, 'Casos', 'Días', 'Tasa', 'Ref.', 'Estado']],
      body: points.map((p) => [p.label, String(p.cases), String(p.deviceDays), fmt(p.rate), p.reference !== null ? String(p.reference) : '—', p.rate === null ? 'Sin datos' : p.reference === null ? 'Sin referencia' : p.exceedsReference ? 'Sobre referencia' : 'En referencia']),
      ...tableTheme(),
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
      tableWidth: pageW - margin * 2,
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === 3 || data.column.index === 5)) {
          const p = points[data.row.index];
          if (p && p.exceedsReference) data.cell.styles.textColor = hexToRgb(ctx.colors.rojo);
        }
      },
    });
    ctx.y = lastTableY(doc) + 18;
  };
  rateTable('Resultado por unidad', s.byUnit, 'Unidad');
  if (s.hasDate) rateTable(`Resultado por período (${s.granularityLabel})`, s.byPeriod, 'Período');
}

function drawCharts(ctx: Ctx, a: AnalysisResult): void {
  const charts = buildReportCharts(a, ctx.colors);
  if (!charts.length) return;
  const { doc, margin } = ctx;
  sectionTitle(ctx, 'Gráficos institucionales');
  for (const ch of charts) {
    ensure(ctx, ch.height + 20);
    doc.addImage(ch.dataUrl, 'PNG', margin, ctx.y + 2, ch.width, ch.height, undefined, 'FAST');
    ctx.y += ch.height + 14;
  }
}

/** Bloque de firmas a dos columnas. */
function drawSignature(ctx: Ctx): void {
  const { doc, pageW, margin } = ctx;
  ensure(ctx, 70);
  ctx.y += 34;
  const colW = (pageW - margin * 2 - 60) / 2;
  const cols = [
    { x: margin, name: 'Responsable de la Estrategia', role: 'Prevención y control clínico' },
    { x: margin + colW + 60, name: 'Unidad de Calidad', role: 'Calidad y Seguridad del Paciente' },
  ];
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  for (const c of cols) {
    doc.line(c.x, ctx.y, c.x + colW, ctx.y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(c.name, c.x, ctx.y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(c.role, c.x, ctx.y + 25);
  }
  ctx.y += 30;
}

/** Pie de página con numeración y folio, en todas las páginas. */
function drawFooters(ctx: Ctx): void {
  const { doc, margin, folio } = ctx;
  const pages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT);
    doc.text('NEX Report · Documento confidencial de uso interno', margin, pageH - 18);
    doc.text(`Folio ${folio} · Página ${i} de ${pages}`, pageW - margin, pageH - 18, { align: 'right' });
  }
}

/** Genera un folio corto y estable a partir del programa y la fecha. */
function makeFolio(program: ProgramConfig): string {
  const prefix = (program.programName || 'NEX').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'NEX';
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** Construye el documento PDF del informe (sin guardarlo). */
function buildPdfDoc(a: AnalysisResult, fileName: string): jsPDF {
  sectionNo = 0;
  const report = buildExecutiveReport(a);
  const program = resolveProgramConfig(a.config);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const ctx: Ctx = { doc, pageW: doc.internal.pageSize.getWidth(), pageH: doc.internal.pageSize.getHeight(), margin: 44, y: 0, colors: program.traffic, program, folio: makeFolio(program) };

  drawMasthead(ctx, report);
  drawTitleBlock(ctx, report, fileName, a);

  // Vigilancia epidemiológica: sección propia de tasas (sin semáforo/cumplimiento).
  if (a.surveillance) {
    drawSurveillance(ctx, a);
    drawExecutive(ctx, report);
    drawSignature(ctx);
    drawFooters(ctx);
    return doc;
  }

  drawResumenBand(ctx, a);
  drawKpis(ctx, a);

  if (a.config.reportType === 'NT234_LPP') {
    sectionTitle(ctx, 'Caracterización clínica');
    drawCharacterization(ctx, a.characterization);
    if (a.characterization.lppStages.some((s) => s.count > 0)) {
      sectionTitle(ctx, 'Caracterización de pacientes con LPP');
      drawLppStages(ctx, a);
    }
  }

  if (a.complianceByIndicator.length) {
    const compl = a.complianceByIndicator.filter((g) => g.kind === 'complementario');
    if (compl.length) {
      const mand = a.complianceByIndicator.filter((g) => g.kind !== 'complementario');
      sectionTitle(ctx, 'Cumplimiento por indicador obligatorio (oficial)');
      drawComplianceTable(ctx, mand, 'Indicador obligatorio', a.config.goal);
      sectionTitle(ctx, 'Indicadores complementarios (informativos)');
      drawComplianceTable(ctx, compl, 'Indicador complementario', a.config.goal);
    } else {
      sectionTitle(ctx, 'Cumplimiento por indicador');
      drawComplianceTable(ctx, a.complianceByIndicator, 'Indicador', a.config.goal);
    }
  }
  if (a.complianceByShift.length) {
    sectionTitle(ctx, 'Cumplimiento por turno');
    drawComplianceTable(ctx, a.complianceByShift, 'Turno', a.config.goal);
  }
  if (a.complianceByUnit.length) {
    sectionTitle(ctx, 'Cumplimiento por unidad');
    drawComplianceTable(ctx, a.complianceByUnit, 'Unidad', a.config.goal);
  }
  for (const bd of a.complianceByBreakdown) {
    sectionTitle(ctx, `Cumplimiento por ${bd.label.toLowerCase()}`);
    drawComplianceTable(ctx, bd.groups, bd.label, a.config.goal);
  }

  drawCharts(ctx, a);

  if (showsEvolution(a.config.analysisType) && a.temporal.hasDate && a.temporal.evolution.length > 0) {
    sectionTitle(ctx, `Evolución del cumplimiento (${analysisTypeLabel(a.config.analysisType).toLowerCase()})`);
    drawEvolution(ctx, a);
  }

  if (a.descriptiveVariables.length) {
    sectionTitle(ctx, 'Variables clínicas descriptivas');
    drawDescriptiveTable(ctx, a);
  }

  drawExecutive(ctx, report);
  drawSignature(ctx);
  drawFooters(ctx);
  return doc;
}

/** Genera y descarga el informe ejecutivo en PDF con diseño institucional. */
export function exportPdf(a: AnalysisResult, fileName: string): void {
  buildPdfDoc(a, fileName).save(fileName.replace(/\.[^.]+$/, '') + '_NEX-Report.pdf');
}

/** URL de blob del PDF para la vista previa en pantalla (liberar con URL.revokeObjectURL). */
export function pdfBlobUrl(a: AnalysisResult, fileName: string): string {
  return URL.createObjectURL(buildPdfDoc(a, fileName).output('blob'));
}
