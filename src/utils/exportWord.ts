import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { AnalysisResult, ComplianceGroup, ExecutiveReport } from '../types';
import { buildExecutiveReport } from './executiveReport';
import { summaryKpis } from './reportModel';
import { PALETTE, bare, complianceHex, trafficHex, trafficLabel, trafficLightFor } from './palette';

const SOFT = bare(PALETTE.line);
const softBorder = { style: BorderStyle.SINGLE, size: 4, color: SOFT };
const cellBorders = { top: softBorder, bottom: softBorder, left: softBorder, right: softBorder };

function text(t: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun {
  return new TextRun({ text: t, bold: opts.bold, color: opts.color ? bare(opts.color) : undefined, size: opts.size ?? 20 });
}

function headerCell(label: string): TableCell {
  return new TableCell({
    borders: cellBorders,
    shading: { type: ShadingType.CLEAR, fill: bare(PALETTE.blue), color: 'auto' },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: 'FFFFFF', size: 18 })] })],
  });
}

function bodyCell(runs: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    borders: cellBorders,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ alignment: align, children: runs })],
  });
}

/** Tabla de cumplimiento por categoría (indicador / turno / unidad). */
function complianceTable(groups: ComplianceGroup[], firstHeader: string, goal: number): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell(firstHeader), headerCell('Cumple'), headerCell('No cumple'), headerCell('N/A'), headerCell('%'), headerCell('Estado')],
    }),
  ];
  for (const g of groups) {
    const color = complianceHex(g.percent, goal);
    rows.push(
      new TableRow({
        children: [
          bodyCell([text(g.label)]),
          bodyCell([text(String(g.cumple))], AlignmentType.CENTER),
          bodyCell([text(String(g.noCumple))], AlignmentType.CENTER),
          bodyCell([text(String(g.noAplica), { color: PALETTE.muted })], AlignmentType.CENTER),
          bodyCell([text(`${g.percent}%`, { bold: true, color })], AlignmentType.CENTER),
          bodyCell([text(g.meetsGoal ? 'Cumple' : 'Bajo meta', { bold: true, color })], AlignmentType.CENTER),
        ],
      }),
    );
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/** Fila de tarjetas KPI como tabla de una fila. */
function kpiTable(a: AnalysisResult): Table {
  const kpis = summaryKpis(a);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: kpis.map(
          (k) =>
            new TableCell({
              borders: cellBorders,
              shading: { type: ShadingType.CLEAR, fill: bare(PALETTE.soft), color: 'auto' },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({ children: [new TextRun({ text: k.value, bold: true, color: bare(k.color), size: 28 })] }),
                new Paragraph({ children: [new TextRun({ text: k.label, color: bare(PALETTE.muted), size: 15 })] }),
                ...(k.hint ? [new Paragraph({ children: [new TextRun({ text: k.hint, color: bare(PALETTE.muted), size: 13 })] })] : []),
              ],
            }),
        ),
      }),
    ],
  });
}

function heading(t: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text: t, bold: true, color: bare(PALETTE.blue), size: 24 })],
  });
}

function sectionHeading(t: string): Paragraph {
  return new Paragraph({ spacing: { before: 180, after: 60 }, children: [new TextRun({ text: t, bold: true, color: bare(PALETTE.blue), size: 20 })] });
}

/** Renderiza el resumen ejecutivo (8 secciones) como párrafos y viñetas. */
function executiveParagraphs(report: ExecutiveReport): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const s of report.sections) {
    out.push(sectionHeading(s.title));
    for (const p of s.paragraphs) out.push(new Paragraph({ spacing: { after: 60 }, children: [text(p)] }));
    if (s.bullets) for (const b of s.bullets) out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [text(b)] }));
  }
  return out;
}

/** Genera y descarga el informe en Word editable (.docx) con diseño ejecutivo. */
export async function exportWord(a: AnalysisResult, fileName: string): Promise<void> {
  const report = buildExecutiveReport(a);
  const g = a.global;
  const light = trafficLightFor(g.percent, a.config.goal);

  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: 'NEX Report', bold: true, size: 44, color: bare(PALETTE.blue) })] }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `Informe de auditoría clínica · ${report.meta.reportTypeLabel}`, size: 24, color: bare(PALETTE.muted) })],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [text(`Archivo analizado: ${fileName}`, { color: PALETTE.muted, size: 18 })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [text(`Fecha de generación: ${report.meta.generatedAt}    ·    Meta de cumplimiento: ${a.config.goal}%`, { color: PALETTE.muted, size: 18 })],
    }),
    // Semáforo de cumplimiento
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: '● ', color: bare(trafficHex(light)), size: 30 }),
        text(`Semáforo de cumplimiento: ${trafficLabel(light)} — ${g.percent}% (meta ${a.config.goal}%)`, { bold: true }),
      ],
    }),

    heading('Resumen de indicadores (KPIs)'),
    kpiTable(a),
  ];

  if (a.complianceByIndicator.length) {
    children.push(heading('Cumplimiento por indicador'), complianceTable(a.complianceByIndicator, 'Indicador', a.config.goal));
  }
  if (a.complianceByShift.length) {
    children.push(heading('Cumplimiento por turno'), complianceTable(a.complianceByShift, 'Turno', a.config.goal));
  }
  if (a.complianceByUnit.length) {
    children.push(heading('Cumplimiento por unidad'), complianceTable(a.complianceByUnit, 'Unidad', a.config.goal));
  }

  children.push(heading('Resumen ejecutivo'), ...executiveParagraphs(report));

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', color: bare(PALETTE.ink) } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName.replace(/\.[^.]+$/, '') + '_NEX-Report.docx');
}
