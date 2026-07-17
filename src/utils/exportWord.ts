import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
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
import type { ActionPlanRow, AnalysisResult, ClinicalCharacterization, ComplianceGroup, DescriptiveVariable, EvolutionPoint, ExecutiveReport } from '../types';
import { buildExecutiveReport } from './executiveReport';
import { analysisTypeLabel, showsEvolution } from '../config/options';
import { buildReportCharts, buildSurveillanceCharts } from './reportCharts';
import { resolveProgramConfig } from './programConfig';
import { summaryKpis } from './reportModel';

/** Convierte un data URL PNG en bytes para incrustar como imagen en Word. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** Gráficos institucionales incrustados como imágenes. */
function chartParagraphs(a: AnalysisResult, colors: TrafficColors): Paragraph[] {
  const charts = buildReportCharts(a, colors);
  if (!charts.length) return [];
  const out: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 }, children: [new TextRun({ text: 'Gráficos institucionales', bold: true, color: bare(PALETTE.blue), size: 24 })] }),
  ];
  for (const ch of charts) {
    out.push(
      new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: ch.title, bold: true, color: bare(PALETTE.blue), size: 20 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: dataUrlToBytes(ch.dataUrl), transformation: { width: ch.width, height: ch.height } })],
      }),
    );
  }
  return out;
}
import { PALETTE, bare, complianceHex, trafficHex, trafficLabel, trafficLightFor, type TrafficColors } from './palette';

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
function complianceTable(groups: ComplianceGroup[], firstHeader: string, goal: number, colors?: TrafficColors): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell(firstHeader), headerCell('Cumple'), headerCell('No cumple'), headerCell('%'), headerCell('Estado')],
    }),
  ];
  for (const g of groups) {
    const color = complianceHex(g.percent, goal, colors);
    rows.push(
      new TableRow({
        children: [
          bodyCell([text(g.label)]),
          bodyCell([text(String(g.cumple))], AlignmentType.CENTER),
          bodyCell([text(String(g.noCumple))], AlignmentType.CENTER),
          bodyCell([text(`${g.percent}%`, { bold: true, color })], AlignmentType.CENTER),
          bodyCell([text(g.meetsGoal ? 'Cumple' : 'Bajo meta', { bold: true, color })], AlignmentType.CENTER),
        ],
      }),
    );
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/** Tabla de caracterización clínica (NT 234 / LPP). */
function characterizationTable(c: ClinicalCharacterization): Table {
  const rowsData: [string, string][] = [
    ['Pacientes auditados', String(c.totalOriginal)],
    ['Pacientes con riesgo alto', String(c.highRisk)],
    ['Pacientes con riesgo moderado', String(c.moderateRisk)],
    ['Pacientes incluidos (riesgo moderado + alto)', c.includedByRisk !== null ? String(c.includedByRisk) : 'No determinado'],
    ['Pacientes excluidos (sin riesgo / bajo riesgo)', c.excludedByRisk !== null ? String(c.excludedByRisk) : 'No determinado'],
    ['Pacientes con LPP', c.lppPositive !== null ? String(c.lppPositive) : '—'],
    ['% pacientes con LPP', c.lppPrevalence !== null ? `${c.lppPrevalence}%` : '—'],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [headerCell('Concepto'), headerCell('Valor')] }),
      ...rowsData.map(([k, v]) => new TableRow({ children: [bodyCell([text(k)]), bodyCell([text(v, { bold: true })], AlignmentType.CENTER)] })),
    ],
  });
}

/** Tabla de distribución de LPP por estadio/categoría. */
function lppStageTable(c: ClinicalCharacterization): Table {
  const stages = c.lppStages.filter((s) => s.count > 0);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [headerCell('Clasificación de LPP'), headerCell('Cantidad'), headerCell('Porcentaje')] }),
      new TableRow({
        children: [
          bodyCell([text('Total de pacientes con LPP', { bold: true })]),
          bodyCell([text(String(c.lppPositive ?? 0), { bold: true })], AlignmentType.CENTER),
          bodyCell([text('100%', { bold: true })], AlignmentType.CENTER),
        ],
      }),
      ...stages.map(
        (s) =>
          new TableRow({
            children: [bodyCell([text(s.stage)]), bodyCell([text(String(s.count))], AlignmentType.CENTER), bodyCell([text(`${s.percent}%`, { color: PALETTE.blue })], AlignmentType.CENTER)],
          }),
      ),
    ],
  });
}

/** Tabla de variables clínicas descriptivas (prevalencia, no cumplimiento). */
function descriptiveTable(vars: DescriptiveVariable[]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('Variable clínica'), headerCell('Positivos'), headerCell('Negativos'), headerCell('Prevalencia')],
    }),
  ];
  for (const v of vars) {
    rows.push(
      new TableRow({
        children: [
          bodyCell([text(v.label)]),
          bodyCell([text(String(v.positive))], AlignmentType.CENTER),
          bodyCell([text(String(v.negative))], AlignmentType.CENTER),
          bodyCell([text(`${v.prevalence}% (${v.positive}/${v.answered})`, { bold: true, color: PALETTE.blue })], AlignmentType.CENTER),
        ],
      }),
    );
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/** Tabla de evolución del cumplimiento por período. */
function evolutionTable(points: EvolutionPoint[], goal: number, colors?: TrafficColors): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('Período'), headerCell('Cumple'), headerCell('Aplicables'), headerCell('Cumplimiento'), headerCell('Estado')],
    }),
  ];
  for (const p of points) {
    const color = complianceHex(p.percent, goal, colors);
    rows.push(
      new TableRow({
        children: [
          bodyCell([text(p.label)]),
          bodyCell([text(String(p.cumple))], AlignmentType.CENTER),
          bodyCell([text(String(p.total))], AlignmentType.CENTER),
          bodyCell([text(`${p.percent}%`, { bold: true, color })], AlignmentType.CENTER),
          bodyCell([text(p.meetsGoal ? 'Cumple' : 'Bajo meta', { bold: true, color })], AlignmentType.CENTER),
        ],
      }),
    );
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/** Fila de tarjetas KPI como tabla de una fila. */
function kpiTable(a: AnalysisResult, colors?: TrafficColors): Table {
  const kpis = summaryKpis(a, colors);
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

/** Tabla del plan de acción sugerido. */
function actionPlanTable(rows: ActionPlanRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [headerCell('Prioridad'), headerCell('Hallazgo'), headerCell('Acción propuesta'), headerCell('Responsable'), headerCell('Plazo'), headerCell('Indicador esperado')],
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [
              bodyCell([text(r.priority, { bold: true })]),
              bodyCell([text(r.finding)]),
              bodyCell([text(r.action)]),
              bodyCell([text(r.responsible)]),
              bodyCell([text(r.deadline)]),
              bodyCell([text(r.target, { bold: true, color: PALETTE.blue })]),
            ],
          }),
      ),
    ],
  });
}

/** Renderiza el resumen ejecutivo (párrafos, viñetas y tabla de plan de acción). */
function executiveParagraphs(report: ExecutiveReport): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const s of report.sections) {
    out.push(sectionHeading(s.title));
    for (const p of s.paragraphs) out.push(new Paragraph({ spacing: { after: 60 }, children: [text(p)] }));
    if (s.bullets) for (const b of s.bullets) out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [text(b)] }));
    if (s.actionPlan) out.push(actionPlanTable(s.actionPlan));
  }
  return out;
}

/** Secciones de vigilancia epidemiológica (tasas por unidad/período) para Word. */
function surveillanceWordSections(a: AnalysisResult, colors: TrafficColors): (Paragraph | Table)[] {
  const s = a.surveillance!;
  const fmt = (r: number | null) => (r === null ? 's/d' : String(r));
  const out: (Paragraph | Table)[] = [];

  const mixed = s.referenceMode === 'per_unit';
  const alert = s.exceedsReference;
  const estado = s.overallRate === null
    ? 'tasa no calculable (sin días de exposición)'
    : mixed
      ? `${s.overallRate} — referencia por ${s.referenceLabel.toLowerCase()} (ver por unidad)`
      : alert
        ? `ALERTA: ${s.overallRate} sobre la referencia ${s.reference}`
        : `${s.overallRate} en o bajo la referencia ${s.reference ?? '—'}`;
  out.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: '● ', color: bare(alert ? colors.rojo : mixed ? colors.amarillo : colors.verde), size: 30 }), text(`${s.rateName} (${s.unitLabel}) — ${estado}`, { bold: true })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [text(`Formato detectado: ${s.format === 'aggregated' ? 'agregado (unidad × período)' : 'línea por caso'}${s.selectedService ? ` · servicio: ${s.services.find((x) => x.service === s.selectedService)?.label ?? s.selectedService}` : ''}`, { color: PALETTE.muted, size: 16 })],
    }),
  );

  out.push(heading('Indicadores de vigilancia'));
  const kpiRows: [string, string][] = [
    [s.numeratorLabel, String(s.totalCases)],
    [`${s.denominatorLabel} (denominador)`, String(s.totalDeviceDays)],
    [`Tasa global (${s.unitLabel})`, fmt(s.overallRate)],
    ['Referencia', s.reference !== null ? String(s.reference) : mixed ? `por ${s.referenceLabel.toLowerCase()}` : '—'],
  ];
  if (s.utilizationRatio !== null) kpiRows.push(['Razón de utilización', String(s.utilizationRatio)]);
  out.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [headerCell('Indicador de vigilancia'), headerCell('Valor')] }),
        ...kpiRows.map(([k, v]) => new TableRow({ children: [bodyCell([text(k)]), bodyCell([text(v, { bold: true })], AlignmentType.CENTER)] })),
      ],
    }),
  );

  const charts = buildSurveillanceCharts(s, colors);
  if (charts.length) {
    out.push(heading('Gráficos de vigilancia'));
    for (const ch of charts) {
      out.push(
        new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: ch.title, bold: true, color: bare(PALETTE.blue), size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: dataUrlToBytes(ch.dataUrl), transformation: { width: ch.width, height: ch.height } })] }),
      );
    }
  }

  const rateTable = (title: string, points: typeof s.byUnit, firstHeader: string) => {
    if (!points.length) return;
    out.push(heading(title));
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: [headerCell(firstHeader), headerCell('Casos'), headerCell('Días'), headerCell('Tasa'), headerCell('Ref.'), headerCell('Estado')] }),
          ...points.map(
            (p) =>
              new TableRow({
                children: [
                  bodyCell([text(p.label)]),
                  bodyCell([text(String(p.cases))], AlignmentType.CENTER),
                  bodyCell([text(String(p.deviceDays))], AlignmentType.CENTER),
                  bodyCell([text(fmt(p.rate), { bold: true, color: p.exceedsReference ? colors.rojo : undefined })], AlignmentType.CENTER),
                  bodyCell([text(p.reference !== null ? String(p.reference) : '—')], AlignmentType.CENTER),
                  bodyCell([text(p.rate === null ? 'Sin datos' : p.reference === null ? 'Sin referencia' : p.exceedsReference ? 'Sobre referencia' : 'En referencia', { bold: true, color: p.exceedsReference ? colors.rojo : p.reference === null ? PALETTE.amber : PALETTE.green })], AlignmentType.CENTER),
                ],
              }),
          ),
        ],
      }),
    );
  };
  rateTable('Resultado por unidad', s.byUnit, 'Unidad');
  if (s.hasDate) rateTable(`Resultado por período (${s.granularityLabel})`, s.byPeriod, 'Período');
  return out;
}

/** Genera y descarga el informe en Word editable (.docx) con diseño ejecutivo. */
export async function exportWord(a: AnalysisResult, fileName: string): Promise<void> {
  const report = buildExecutiveReport(a);
  const program = resolveProgramConfig(a.config);
  const colors = program.traffic;
  const g = a.global;
  const light = trafficLightFor(g.percent, a.config.goal);

  const isSurv = Boolean(a.surveillance);
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: `${program.logo} ${program.institutionName}`.trim(), bold: true, size: 40, color: bare(PALETTE.blue) })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `Informe ${isSurv ? 'de vigilancia' : 'de auditoría clínica'} · ${program.programName || report.meta.reportTypeLabel} · Unidad: ${program.unitName}`, size: 22, color: bare(PALETTE.muted) })],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [text(`Archivo analizado: ${fileName}`, { color: PALETTE.muted, size: 18 })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [text(`Fecha de generación: ${report.meta.generatedAt}`, { color: PALETTE.muted, size: 18 })],
    }),
  ];

  // ── Vigilancia epidemiológica: informe de tasas (sin semáforo/cumplimiento) ──
  if (isSurv) {
    children.push(...surveillanceWordSections(a, colors));
    children.push(heading('Resumen ejecutivo'));
    const baseTextV = program.executiveBaseText.trim();
    if (baseTextV) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: baseTextV, italics: true, color: bare(PALETTE.muted), size: 19 })] }));
    children.push(...executiveParagraphs(report));
    children.push(
      new Paragraph({ spacing: { before: 700 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [text('_____________________________________')] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [text('Firma y Timbre', { bold: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20 }, children: [text('Responsable de la Estrategia', { color: PALETTE.muted })] }),
    );
    const docV = new Document({
      styles: { default: { document: { run: { font: 'Calibri', color: bare(PALETTE.ink) } } } },
      sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
    });
    saveAs(await Packer.toBlob(docV), fileName.replace(/\.[^.]+$/, '') + '_NEX-Report.docx');
    return;
  }

  // Semáforo de cumplimiento + KPIs (auditorías de cumplimiento).
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: '● ', color: bare(trafficHex(light, colors)), size: 30 }),
        text(`Semáforo de cumplimiento: ${trafficLabel(light)} — ${g.percent}% (meta ${a.config.goal}%)`, { bold: true }),
      ],
    }),
    heading('Resumen de indicadores (KPIs)'),
    kpiTable(a, colors),
  );

  if (a.config.reportType === 'NT234_LPP') {
    children.push(heading('Caracterización clínica'), characterizationTable(a.characterization));
    if (a.characterization.lppStages.some((s) => s.count > 0)) {
      children.push(heading('Caracterización de pacientes con LPP'), lppStageTable(a.characterization));
    }
  }

  children.push(...chartParagraphs(a, colors));

  if (a.complianceByIndicator.length) {
    const compl = a.complianceByIndicator.filter((g) => g.kind === 'complementario');
    if (compl.length) {
      const mand = a.complianceByIndicator.filter((g) => g.kind !== 'complementario');
      children.push(heading('Cumplimiento por indicador obligatorio (oficial)'), complianceTable(mand, 'Indicador obligatorio', a.config.goal, colors));
      children.push(
        heading('Indicadores complementarios (no alteran el cumplimiento oficial)'),
        complianceTable(compl, 'Indicador complementario', a.config.goal, colors),
      );
    } else {
      children.push(heading('Cumplimiento por indicador'), complianceTable(a.complianceByIndicator, 'Indicador', a.config.goal, colors));
    }
  }
  if (a.complianceByShift.length) {
    children.push(heading('Cumplimiento por turno'), complianceTable(a.complianceByShift, 'Turno', a.config.goal, colors));
  }
  if (a.complianceByUnit.length) {
    children.push(heading('Cumplimiento por unidad'), complianceTable(a.complianceByUnit, 'Unidad', a.config.goal, colors));
  }
  // Desgloses configurados (p. ej. estamento). Vacío en NT 234.
  for (const bd of a.complianceByBreakdown) {
    children.push(heading(`Cumplimiento por ${bd.label.toLowerCase()}`), complianceTable(bd.groups, bd.label, a.config.goal, colors));
  }

  if (showsEvolution(a.config.analysisType) && a.temporal.hasDate && a.temporal.evolution.length > 0) {
    const pts = a.temporal.evolution;
    const delta = pts.length >= 2 ? Number((pts[pts.length - 1].percent - pts[0].percent).toFixed(1)) : null;
    children.push(
      heading(`Evolución del cumplimiento (${analysisTypeLabel(a.config.analysisType).toLowerCase()})`),
      evolutionTable(pts, a.config.goal, colors),
    );
    if (delta !== null) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [
            text(`Variación entre ${pts[0].label} y ${pts[pts.length - 1].label}: `, { size: 18, color: PALETTE.muted }),
            text(`${delta >= 0 ? '+' : ''}${delta} puntos porcentuales`, { bold: true, color: delta >= 0 ? PALETTE.green : PALETTE.red }),
          ],
        }),
      );
    }
  }

  if (a.descriptiveVariables.length) {
    children.push(
      heading('Variables clínicas descriptivas'),
      new Paragraph({
        spacing: { after: 80 },
        children: [text('Prevalencia sobre el total de registros. No forman parte del cálculo de cumplimiento.', { color: PALETTE.muted, size: 18 })],
      }),
      descriptiveTable(a.descriptiveVariables),
    );
  }

  children.push(heading('Resumen ejecutivo'));
  const baseText = program.executiveBaseText.trim();
  if (baseText) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: baseText, italics: true, color: bare(PALETTE.muted), size: 19 })] }));
  }
  children.push(...executiveParagraphs(report));

  // Firma y timbre al final del informe.
  children.push(
    new Paragraph({ spacing: { before: 700 }, children: [] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [text('_____________________________________')] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [text('Firma y Timbre', { bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 20 }, children: [text('Responsable de la Estrategia', { color: PALETTE.muted })] }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', color: bare(PALETTE.ink) } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName.replace(/\.[^.]+$/, '') + '_NEX-Report.docx');
}
