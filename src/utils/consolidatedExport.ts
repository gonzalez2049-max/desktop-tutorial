// Exportación institucional del Dashboard Consolidado IAAS (Word y PDF).
// Reutiliza las mismas librerías que los exportadores por auditoría (jsPDF y
// docx) y los resultados YA calculados por cada módulo; no recalcula fórmulas.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import { PALETTE, hexToRgb } from './palette';
import {
  complianceGaps,
  criticalAlerts,
  vigilanciaModules,
  type DashExecutive,
  type DashModule,
  type InstitutionalSummary,
} from './consolidatedDashboard';

const dec = (n: number | null) => (n === null ? 's/d' : String(n).replace('.', ','));
const pct = (n: number | null) => (n === null ? 's/d' : `${dec(n)}%`);

const BLUE = hexToRgb('#0f3d2e');
const INK = hexToRgb(PALETTE.ink);
const MUTED = hexToRgb(PALETTE.muted);

function vigRows(mods: DashModule[]): string[][] {
  return vigilanciaModules(mods).map((m) => {
    const s = m.analysis.surveillance!;
    const estado = s.exceedsReference ? 'Sobre referencia' : s.reference !== null ? 'En referencia' : 'Ref. por unidad';
    return [m.name, dec(s.overallRate), s.reference !== null ? dec(s.reference) : `por ${s.referenceLabel.toLowerCase()}`, estado, String(s.totalCases), String(s.totalDeviceDays)];
  });
}

function pracRows(mods: DashModule[]): string[][] {
  return complianceGaps(mods).map((g) => [g.name, g.actual === null ? 's/d' : pct(g.actual), `${g.goal}%`, g.gap === null ? 's/d' : `${g.gap > 0 ? '+' : ''}${dec(g.gap)} pp`, g.actual === null ? 's/d' : g.meets ? 'Cumple' : 'Bajo meta']);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export function exportConsolidatedPdf(mods: DashModule[], exec: DashExecutive, summary: InstitutionalSummary): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BLUE);
  doc.text('Dashboard Consolidado IAAS', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`NEX Report · Informe institucional · Generado el ${exec.generatedAt}`, margin, y);
  y += 10;
  doc.setDrawColor(...hexToRgb(PALETTE.line));
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // KPIs institucionales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Resumen institucional', margin, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255] },
    head: [['Auditorías', 'Alertas críticas', 'Prácticas bajo meta', 'Cumplim. prácticas', 'Unidades en alerta']],
    body: [[
      `${summary.integrated}/${summary.total}`,
      String(summary.criticalAlerts),
      String(summary.bundlesUnderGoal),
      summary.practiceCompliance === null ? 's/d' : pct(summary.practiceCompliance),
      String(summary.unitsInAlert),
    ]],
    margin: { left: margin, right: margin },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // Vigilancia
  const vrows = vigRows(mods);
  if (vrows.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text('Vigilancia epidemiológica', margin, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255] },
      head: [['Auditoría', 'Tasa', 'Referencia', 'Estado', 'Casos', 'Días']],
      body: vrows,
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // Prácticas
  const prows = pracRows(mods);
  if (prows.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text('Prácticas clínicas · brechas de cumplimiento', margin, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255] },
      head: [['Práctica', 'Cumplimiento', 'Meta', 'Brecha', 'Estado']],
      body: prows,
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  // Alertas
  const alerts = criticalAlerts(mods);
  if (alerts.length) {
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { textColor: BLUE, fontStyle: 'bold' },
      head: [['Alertas críticas']],
      body: alerts.map((a) => [`${a.severity === 'crit' ? '⚠ ' : '▼ '}${a.title}`]),
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // Resumen ejecutivo
  const addPara = (label: string, text: string) => {
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(label, margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(text, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 8;
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = margin; }
  doc.text('Resumen ejecutivo institucional', margin, y);
  y += 16;
  addPara('', exec.lead);
  addPara('Vigilancia', exec.vigilanciaText);
  addPara('Prácticas', exec.practicasText);
  addPara('Recomendaciones priorizadas', exec.recommendations.map((r) => `• ${r}`).join('\n'));

  doc.save('Dashboard-Consolidado-IAAS_NEX-Report.pdf');
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

function wTable(head: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: head.map((h) => new TableCell({ shading: { fill: '0f3d2e' }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18 })] })] })),
  });
  const bodyRows = rows.map((r) => new TableRow({ children: r.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, size: 18 })] })] })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

export async function exportConsolidatedWord(mods: DashModule[], exec: DashExecutive, summary: InstitutionalSummary): Promise<void> {
  const children: (Paragraph | Table)[] = [];
  const heading = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 }, children: [new TextRun({ text, bold: true, color: '0f3d2e' })] });
  const para = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, size: 20, ...opts })] });

  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'Dashboard Consolidado IAAS', bold: true, size: 32, color: '0f3d2e' })] }));
  children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: `NEX Report · Informe institucional · Generado el ${exec.generatedAt}`, size: 18, color: PALETTE.muted.replace('#', '') })] }));

  children.push(heading('Resumen institucional'));
  children.push(wTable(
    ['Auditorías', 'Alertas críticas', 'Prácticas bajo meta', 'Cumplim. prácticas', 'Unidades en alerta'],
    [[`${summary.integrated}/${summary.total}`, String(summary.criticalAlerts), String(summary.bundlesUnderGoal), summary.practiceCompliance === null ? 's/d' : pct(summary.practiceCompliance), String(summary.unitsInAlert)]],
  ));

  const vrows = vigRows(mods);
  if (vrows.length) {
    children.push(heading('Vigilancia epidemiológica'));
    children.push(wTable(['Auditoría', 'Tasa', 'Referencia', 'Estado', 'Casos', 'Días'], vrows));
  }

  const prows = pracRows(mods);
  if (prows.length) {
    children.push(heading('Prácticas clínicas · brechas de cumplimiento'));
    children.push(wTable(['Práctica', 'Cumplimiento', 'Meta', 'Brecha', 'Estado'], prows));
  }

  const alerts = criticalAlerts(mods);
  if (alerts.length) {
    children.push(heading('Alertas críticas'));
    for (const a of alerts) children.push(new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text: a.title, size: 19 })] }));
  }

  children.push(heading('Resumen ejecutivo institucional'));
  children.push(para(exec.lead, { italics: true }));
  children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Vigilancia. ', bold: true, size: 20 }), new TextRun({ text: exec.vigilanciaText, size: 20 })] }));
  children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Prácticas. ', bold: true, size: 20 }), new TextRun({ text: exec.practicasText, size: 20 })] }));
  children.push(para('Recomendaciones priorizadas:', { bold: true }));
  for (const r of exec.recommendations) children.push(new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text: r, size: 20 })] }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'Dashboard-Consolidado-IAAS_NEX-Report.docx');
}
