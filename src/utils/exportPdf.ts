import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult, ClinicalCharacterization, ComplianceGroup, ExecutiveReport } from '../types';
import { buildExecutiveReport } from './executiveReport';
import { summaryKpis } from './reportModel';
import { PALETTE, complianceHex, hexToRgb, trafficHex, trafficLabel, trafficLightFor } from './palette';

interface Ctx {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  margin: number;
  y: number;
}

const BLUE = hexToRgb(PALETTE.blue);
const INK = hexToRgb(PALETTE.ink);
const MUTED = hexToRgb(PALETTE.muted);
const LINE = hexToRgb(PALETTE.line);

/** Asegura espacio vertical; añade página si hace falta. */
function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y + needed > ctx.pageH - ctx.margin) {
    ctx.doc.addPage();
    ctx.y = ctx.margin;
  }
}

function lastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Encabezado limpio: NEX Report + subtítulo + regla fina. Fondo blanco. */
function drawHeader(ctx: Ctx, report: ExecutiveReport, fileName: string, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BLUE);
  doc.text('NEX Report', margin, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(`Informe de auditoría clínica · ${report.meta.reportTypeLabel}`, margin, 72);

  doc.setFontSize(9);
  doc.text(`Archivo: ${fileName}`, margin, 90);
  doc.text(`Fecha: ${report.meta.generatedAt}    ·    Meta de cumplimiento: ${a.config.goal}%`, margin, 104);

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.line(margin, 116, pageW - margin, 116);
  ctx.y = 140;
}

/** Semáforo de cumplimiento: punto de color + estado + %. */
function drawTrafficLight(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin } = ctx;
  const light = trafficLightFor(a.global.percent, a.config.goal);
  const [r, g, b] = hexToRgb(trafficHex(light));
  ensure(ctx, 30);
  doc.setFillColor(r, g, b);
  doc.circle(margin + 6, ctx.y - 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`Semáforo de cumplimiento: ${trafficLabel(light)} — ${a.global.percent}% (meta ${a.config.goal}%)`, margin + 18, ctx.y);
  ctx.y += 24;
}

/** Tarjetas KPI en fila, con bordes suaves. */
function drawKpis(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  const kpis = summaryKpis(a);
  const gap = 8;
  const cols = kpis.length;
  const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = 54;
  ensure(ctx, cardH + 10);
  kpis.forEach((k, i) => {
    const x = margin + i * (cardW + gap);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.8);
    doc.setFillColor(...hexToRgb(PALETTE.soft));
    doc.roundedRect(x, ctx.y, cardW, cardH, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...hexToRgb(k.color));
    doc.text(k.value, x + 8, ctx.y + 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(k.label, cardW - 14), x + 8, ctx.y + 38);
    if (k.hint) doc.text(k.hint, x + 8, ctx.y + 48);
  });
  ctx.y += cardH + 22;
}

function sectionTitle(ctx: Ctx, title: string): void {
  ensure(ctx, 34);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(13);
  ctx.doc.setTextColor(...BLUE);
  ctx.doc.text(title, ctx.margin, ctx.y);
  ctx.y += 8;
}

/** Tabla de cumplimiento con bordes suaves y % coloreado por estado. */
function drawComplianceTable(ctx: Ctx, groups: ComplianceGroup[], firstHeader: string, goal: number): void {
  const { doc, margin, pageW } = ctx;
  autoTable(doc, {
    startY: ctx.y,
    head: [[firstHeader, 'Cumple', 'No cumple', '%', 'Estado']],
    body: groups.map((g) => [g.label, String(g.cumple), String(g.noCumple), `${g.percent}%`, g.meetsGoal ? 'Cumple' : 'Bajo meta']),
    theme: 'grid',
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontSize: 8.5, halign: 'center', lineColor: LINE, lineWidth: 0.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
        const g = groups[data.row.index];
        if (g) data.cell.styles.textColor = hexToRgb(complianceHex(g.percent, goal));
      }
    },
  });
  ctx.y = lastTableY(doc) + 22;
}

/** Tabla de caracterización clínica (NT 234 / LPP). */
function drawCharacterization(ctx: Ctx, c: ClinicalCharacterization): void {
  const { doc, margin, pageW } = ctx;
  autoTable(doc, {
    startY: ctx.y,
    head: [['Concepto', 'Valor']],
    body: [
      ['Registros originales', String(c.totalOriginal)],
      ['Incluidos (riesgo moderado + alto)', String(c.includedByRisk)],
      ['Excluidos (sin riesgo / bajo riesgo)', String(c.excludedByRisk)],
      ['Pacientes con LPP', c.lppPositive !== null ? String(c.lppPositive) : '—'],
      ['% pacientes con LPP', c.lppPrevalence !== null ? `${c.lppPrevalence}%` : '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontSize: 8.5, halign: 'center', lineColor: LINE, lineWidth: 0.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });
  ctx.y = lastTableY(doc) + 22;
}

/** Tabla de variables clínicas descriptivas (prevalencia). */
function drawDescriptiveTable(ctx: Ctx, a: AnalysisResult): void {
  const { doc, margin, pageW } = ctx;
  autoTable(doc, {
    startY: ctx.y,
    head: [['Variable clínica', 'Positivos', 'Negativos', 'Prevalencia']],
    body: a.descriptiveVariables.map((v) => [v.label, String(v.positive), String(v.negative), `${v.prevalence}% (${v.positive}/${v.answered})`]),
    theme: 'grid',
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontSize: 8.5, halign: 'center', lineColor: LINE, lineWidth: 0.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold', textColor: BLUE },
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });
  ctx.y = lastTableY(doc) + 22;
}

/** Resumen ejecutivo: títulos de sección, párrafos y viñetas, con paginación. */
function drawExecutive(ctx: Ctx, report: ExecutiveReport): void {
  const { doc, margin, pageW } = ctx;
  const width = pageW - margin * 2;
  for (const s of report.sections) {
    ensure(ctx, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...BLUE);
    doc.text(s.title, margin, (ctx.y += 6));
    ctx.y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    for (const p of s.paragraphs) {
      const lines = doc.splitTextToSize(p, width);
      ensure(ctx, lines.length * 12 + 4);
      doc.text(lines, margin, (ctx.y += 12));
      ctx.y += (lines.length - 1) * 12;
    }
    if (s.bullets) {
      for (const b of s.bullets) {
        const lines = doc.splitTextToSize(b, width - 14);
        ensure(ctx, lines.length * 12 + 2);
        doc.setFillColor(...BLUE);
        doc.circle(margin + 3, ctx.y + 10, 1.4, 'F');
        doc.text(lines, margin + 12, (ctx.y += 12));
        ctx.y += (lines.length - 1) * 12;
      }
    }
    ctx.y += 8;
  }
}

/** Pie de página con numeración, en todas las páginas. */
function drawFooters(doc: jsPDF, margin: number): void {
  const pages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('NEX Report · Informe de auditoría clínica', margin, pageH - 20);
    doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 20, { align: 'right' });
  }
}

/** Genera y descarga el informe ejecutivo en PDF con diseño institucional. */
export function exportPdf(a: AnalysisResult, fileName: string): void {
  const report = buildExecutiveReport(a);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ctx: Ctx = { doc, pageW: doc.internal.pageSize.getWidth(), pageH: doc.internal.pageSize.getHeight(), margin: 40, y: 0 };

  drawHeader(ctx, report, fileName, a);
  drawTrafficLight(ctx, a);
  drawKpis(ctx, a);

  if (a.config.reportType === 'NT234_LPP') {
    ensure(ctx, 60);
    sectionTitle(ctx, 'Caracterización clínica');
    drawCharacterization(ctx, a.characterization);
  }

  if (a.complianceByIndicator.length) {
    sectionTitle(ctx, 'Cumplimiento por indicador');
    drawComplianceTable(ctx, a.complianceByIndicator, 'Indicador', a.config.goal);
  }
  if (a.complianceByShift.length) {
    sectionTitle(ctx, 'Cumplimiento por turno');
    drawComplianceTable(ctx, a.complianceByShift, 'Turno', a.config.goal);
  }
  if (a.complianceByUnit.length) {
    sectionTitle(ctx, 'Cumplimiento por unidad');
    drawComplianceTable(ctx, a.complianceByUnit, 'Unidad', a.config.goal);
  }

  if (a.descriptiveVariables.length) {
    ensure(ctx, 60);
    sectionTitle(ctx, 'Variables clínicas descriptivas');
    drawDescriptiveTable(ctx, a);
  }

  ensure(ctx, 40);
  sectionTitle(ctx, 'Resumen ejecutivo');
  ctx.y += 4;
  drawExecutive(ctx, report);

  drawFooters(doc, ctx.margin);
  doc.save(fileName.replace(/\.[^.]+$/, '') + '_NEX-Report.pdf');
}
