// Exportación Word y PDF del módulo «Otros informes». Reutiliza jsPDF/docx.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { PALETTE, hexToRgb } from '../palette';
import type { OtrosResult, OtrosTable } from './types';

const BLUE = hexToRgb(PALETTE.blue);
const INK = hexToRgb(PALETTE.ink);
const MUTED = hexToRgb(PALETTE.muted);
const fileBase = (r: OtrosResult) => (r.config.name || 'informe').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'informe';

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function exportOtrosPdf(r: OtrosResult, recommendations: string[]): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BLUE);
  doc.text(r.config.name || 'Informe', margin, y); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
  if (r.config.objective) { const l = doc.splitTextToSize(r.config.objective, pageW - 2 * margin); doc.text(l, margin, y); y += l.length * 11 + 4; }
  doc.text(`Fórmula: ${r.formula}`, margin, y); y += 10;
  doc.setDrawColor(...hexToRgb(PALETTE.line)); doc.line(margin, y, pageW - margin, y); y += 14;

  // KPIs
  autoTable(doc, { startY: y, theme: 'grid', styles: { fontSize: 9, cellPadding: 5 }, headStyles: { fillColor: BLUE, textColor: [255, 255, 255] }, head: [r.kpis.map((k) => k.label)], body: [r.kpis.map((k) => k.value)], margin: { left: margin, right: margin } });
  y = lastY(doc) + 16;

  const table = (title: string, t: OtrosTable | null) => {
    if (!t || t.rows.length === 0) return;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = margin; }
    doc.text(title, margin, y); y += 6;
    autoTable(doc, { startY: y, theme: 'striped', styles: { fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: BLUE, textColor: [255, 255, 255] }, head: [t.headers], body: t.rows.map((row) => row.map(String)), margin: { left: margin, right: margin } });
    y = lastY(doc) + 16;
  };
  table('Resultado principal', r.mainTable);
  if (r.comparison && r.comparison !== r.mainTable) table('Comparación entre grupos', r.comparison);
  if (r.temporal.length) table('Evolución temporal', { headers: ['Período', 'Valor'], rows: r.temporal.map((p) => [p.label, p.value ?? 's/d']) });
  for (const b of r.breakdowns) table(`Desglose por ${b.label}`, b.table);
  if (r.descriptive.length) table('Caracterización', { headers: ['Variable', 'Positivos', 'Respondidos', 'Prevalencia'], rows: r.descriptive.map((d) => [d.label, d.positive, d.answered, `${d.percent}%`]) });

  const para = (title: string, items: string[]) => {
    if (items.length === 0) return;
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(title, margin, y); y += 12;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    for (const it of items) { const l = doc.splitTextToSize(`• ${it}`, pageW - 2 * margin); doc.text(l, margin, y); y += l.length * 11 + 2; }
    y += 6;
  };
  para('Hallazgos principales', r.findings);
  para('Brechas y alertas', [...r.gaps, ...r.alerts]);
  para('Resumen ejecutivo', r.summary);
  para('Recomendaciones', recommendations);

  doc.save(`${fileBase(r)}_NEX-Report.pdf`);
}

function wTable(t: OtrosTable): Table {
  const header = new TableRow({ tableHeader: true, children: t.headers.map((h) => new TableCell({ shading: { fill: PALETTE.blue.replace('#', '') }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 16 })] })] })) });
  const body = t.rows.map((row) => new TableRow({ children: row.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(c), size: 16 })] })] })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

export async function exportOtrosWord(r: OtrosResult, recommendations: string[]): Promise<void> {
  const children: (Paragraph | Table)[] = [];
  const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text: t, bold: true, color: PALETTE.blue.replace('#', '') })] });
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: r.config.name || 'Informe', bold: true, size: 30, color: PALETTE.blue.replace('#', '') })] }));
  if (r.config.objective) children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: r.config.objective, italics: true, size: 20 })] }));
  children.push(new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: `Fórmula: ${r.formula}`, size: 18, color: PALETTE.muted.replace('#', '') })] }));

  children.push(h2('Indicadores'));
  children.push(wTable({ headers: r.kpis.map((k) => k.label), rows: [r.kpis.map((k) => k.value)] }));
  if (r.mainTable) { children.push(h2('Resultado principal')); children.push(wTable(r.mainTable)); }
  if (r.comparison && r.comparison !== r.mainTable) { children.push(h2('Comparación entre grupos')); children.push(wTable(r.comparison)); }
  if (r.temporal.length) { children.push(h2('Evolución temporal')); children.push(wTable({ headers: ['Período', 'Valor'], rows: r.temporal.map((p) => [p.label, p.value ?? 's/d']) })); }
  for (const b of r.breakdowns) { children.push(h2(`Desglose por ${b.label}`)); children.push(wTable(b.table)); }
  if (r.descriptive.length) { children.push(h2('Caracterización')); children.push(wTable({ headers: ['Variable', 'Positivos', 'Respondidos', 'Prevalencia'], rows: r.descriptive.map((d) => [d.label, d.positive, d.answered, `${d.percent}%`]) })); }

  const bullets = (title: string, items: string[]) => { if (!items.length) return; children.push(h2(title)); for (const it of items) children.push(new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text: it, size: 20 })] })); };
  bullets('Hallazgos principales', r.findings);
  bullets('Brechas y alertas', [...r.gaps, ...r.alerts]);
  bullets('Resumen ejecutivo', r.summary);
  bullets('Recomendaciones', recommendations);

  const doc = new Document({ sections: [{ properties: {}, children }] });
  saveAs(await Packer.toBlob(doc), `${fileBase(r)}_NEX-Report.docx`);
}
