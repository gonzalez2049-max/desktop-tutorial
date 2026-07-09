import type { ActionPlanRow, AnalysisResult, ComplianceGroup, ExecutiveReport, ReportSection } from '../types';
import { reportTypeLabel } from '../config/options';
import { normalize } from './columnDetection';

const UNGROUPED = 'Sin especificar';

function round1(n: number): number {
  return Number(n.toFixed(1));
}

/** Grupos con casos aplicables, ignorando la categoría "sin especificar". */
function named(groups: ComplianceGroup[]): ComplianceGroup[] {
  return groups.filter((g) => g.aplicables > 0 && g.label !== UNGROUPED);
}

function lowest(groups: ComplianceGroup[]): ComplianceGroup | null {
  const list = named(groups);
  return list.length ? list.reduce((m, g) => (g.percent < m.percent ? g : m)) : null;
}

function highest(groups: ComplianceGroup[]): ComplianceGroup | null {
  const list = named(groups);
  return list.length ? list.reduce((m, g) => (g.percent > m.percent ? g : m)) : null;
}

interface Gap {
  dimension: 'indicador' | 'unidad' | 'turno';
  label: string;
  percent: number;
  gap: number;
}

function computeGaps(a: AnalysisResult): Gap[] {
  const goal = a.config.goal;
  const out: Gap[] = [];
  const add = (dimension: Gap['dimension'], groups: ComplianceGroup[]) => {
    named(groups).forEach((g) => {
      if (g.percent < goal) out.push({ dimension, label: g.label, percent: g.percent, gap: round1(goal - g.percent) });
    });
  };
  add('indicador', a.complianceByIndicator);
  add('unidad', a.complianceByUnit);
  add('turno', a.complianceByShift);
  return out.sort((x, y) => y.gap - x.gap);
}

/** Indicador de valoración de riesgo al ingreso, si existe. */
function findValoracion(a: AnalysisResult): ComplianceGroup | null {
  return a.complianceByIndicator.find((g) => /valoracion de riesgo|valoracion riesgo/.test(normalize(g.label))) ?? null;
}

/** Descriptor cualitativo del estado del servicio. */
function estadoServicio(percent: number, goal: number): string {
  if (percent >= goal + 5) return 'un desempeño sólido y consolidado en la prevención del daño';
  if (percent >= goal) return 'un desempeño conforme al estándar institucional';
  if (percent >= goal - 10) return 'un desempeño cercano al estándar, con brechas acotadas y abordables';
  return 'un desempeño por debajo del estándar institucional, con brechas que requieren intervención';
}

/** Acción, responsable y plazo sugeridos según el hallazgo. */
function actionFor(gp: Gap, goal: number): ActionPlanRow {
  const n = normalize(gp.label);
  const priority: ActionPlanRow['priority'] = gp.gap >= 15 ? 'Alta' : gp.gap >= 7 ? 'Media' : 'Baja';
  const deadline = priority === 'Alta' ? '30 días' : priority === 'Media' ? '45 días' : '60 días';
  const target = `≥ ${goal}%`;

  let action = 'Refuerzo educativo dirigido y supervisión focalizada.';
  let responsible = 'Enfermera clínica / Champion Clínico.';
  let finding = `Baja adherencia en «${gp.label}».`;

  if (gp.dimension === 'unidad') {
    action = 'Plan de mejora focalizado, con metas por corte y seguimiento semanal.';
    responsible = 'Jefatura de la unidad.';
    finding = `Rezago de cumplimiento en la unidad «${gp.label}».`;
  } else if (gp.dimension === 'turno') {
    action = 'Acompañamiento clínico en terreno y verificación de registros en el turno.';
    responsible = 'Supervisión de turno.';
    finding = `Menor desempeño en el turno ${gp.label}.`;
  } else if (/cambio de posicion|posicion/.test(n)) {
    action = 'Entrenamiento clínico in situ y verificación de cumplimiento por turno.';
    responsible = 'Jefatura + Champion Clínico.';
    finding = 'Baja adherencia a cambios de posición según riesgo.';
  } else if (/valoracion/.test(n)) {
    action = 'Estandarizar la valoración de riesgo al ingreso y su registro obligatorio.';
    responsible = 'Jefatura de enfermería + Referente NT 234.';
    finding = 'Valoración de riesgo al ingreso incompleta.';
  } else if (/superficie|apoyo/.test(n)) {
    action = 'Asegurar disponibilidad y uso de superficies de apoyo según nivel de riesgo.';
    responsible = 'Jefatura + Abastecimiento clínico.';
    finding = 'Uso insuficiente de superficies de apoyo.';
  } else if (/piel/.test(n)) {
    action = 'Reforzar la valoración diaria de la piel y su registro.';
    responsible = 'Enfermera clínica.';
    finding = 'Valoración de la piel bajo estándar.';
  } else if (/prominencias|oseas/.test(n)) {
    action = 'Protocolizar la protección de prominencias óseas en pacientes de riesgo.';
    responsible = 'Enfermera clínica / Champion.';
    finding = 'Protección de prominencias óseas insuficiente.';
  } else if (/humedad|higiene|cutanea/.test(n)) {
    action = 'Reforzar el manejo de humedad e higiene cutánea.';
    responsible = 'Equipo de enfermería.';
    finding = 'Manejo de humedad e higiene cutánea bajo meta.';
  } else if (/nutric/.test(n)) {
    action = 'Activar la evaluación e interconsulta nutricional al ingreso.';
    responsible = 'Enfermera + Nutricionista.';
    finding = 'Evaluación nutricional al ingreso pendiente.';
  } else if (/firma|registro|responsable/.test(n)) {
    action = 'Estandarizar el registro responsable (hora, fecha y firma).';
    responsible = 'Jefatura + Calidad.';
    finding = 'Registro responsable incompleto.';
  }

  return { priority, finding, action, responsible, deadline, target };
}

/**
 * Redacta el informe ejecutivo clínico a partir de los resultados calculados.
 * Estilo de Referente Técnico de Buenas Prácticas Clínicas; sin repetir cifras
 * entre secciones y sin inventar datos.
 */
export function buildExecutiveReport(a: AnalysisResult): ExecutiveReport {
  const goal = a.config.goal;
  const g = a.global;
  const c = a.characterization;
  const tipo = reportTypeLabel(a.config.reportType);
  const gap = round1(goal - g.percent);
  const over = round1(g.percent - goal);
  const meets = g.meetsGoal;

  const worstUnit = lowest(a.complianceByUnit);
  const bestUnit = highest(a.complianceByUnit);
  const worstShift = lowest(a.complianceByShift);
  const worstInd = a.criticalIndicators[0] ?? null;
  const valoracion = findValoracion(a);
  const gaps = computeGaps(a);

  const sections: ReportSection[] = [];

  // ── RESUMEN EJECUTIVO (máx. 2 párrafos) ─────────────────────────────
  const resumen: string[] = [];
  if (c.riskFilterApplied) {
    resumen.push(
      `La auditoría del programa ${tipo} abarcó ${c.totalOriginal} pacientes, de los cuales ${c.includedByRisk} —clasificados en riesgo moderado y alto— constituyeron la población efectivamente evaluada, en concordancia con el alcance del protocolo NT 234 / LPP.`,
    );
  } else {
    resumen.push(
      `La auditoría del programa ${tipo} consideró la totalidad de ${c.totalOriginal} registros auditados, sobre los cuales se evaluó la adherencia a las prácticas definidas por el estándar institucional.`,
    );
  }
  if (g.aplicables === 0) {
    resumen.push('La medición no registró casos aplicables, por lo que no es posible emitir un juicio de cumplimiento en este periodo.');
  } else {
    const comparacion = meets
      ? `situándose ${over} puntos por sobre la meta institucional de ${goal}%`
      : `${gap} puntos por debajo de la meta institucional de ${goal}%`;
    resumen.push(
      `El cumplimiento global de las prácticas de prevención alcanzó ${g.percent}%, ${comparacion}. En su conjunto, el servicio evidencia ${estadoServicio(g.percent, goal)}.`,
    );
  }
  sections.push({ id: 'resumen', title: 'Resumen ejecutivo', paragraphs: resumen });

  // ── ANÁLISIS DE RESULTADOS (interpretación, sin repetir cifras) ─────
  const analisis: string[] = [];
  if (g.aplicables === 0) {
    analisis.push('Sin casos aplicables no es posible interpretar el nivel de adherencia; se sugiere revisar el instrumento de auditoría y repetir la medición.');
  } else if (meets) {
    analisis.push(
      'El resultado obtenido da cuenta de un proceso asistencial consolidado, en el que las prácticas preventivas se han incorporado a la rutina clínica. El foco de gestión se desplaza así desde la instalación de la práctica hacia su mantención en el tiempo, resguardando que la rotación de personal o la carga asistencial no erosionen los estándares alcanzados.',
    );
  } else {
    analisis.push(
      'El nivel de adherencia alcanzado indica que una parte relevante de los cuidados críticos para la prevención de lesiones por presión no se ejecuta de manera sistemática en la población de mayor riesgo. Más que una falla transversal, el patrón observado apunta a debilidades concentradas en prácticas puntuales, susceptibles de intervención focalizada de alto rendimiento.',
    );
    analisis.push(
      'De sostenerse la brecha, el principal impacto operacional es el aumento de la probabilidad de lesiones prevenibles, con el consiguiente incremento de días cama, carga asistencial y exposición medicolegal para el servicio.',
    );
  }
  sections.push({ id: 'analisis', title: 'Análisis de resultados', paragraphs: analisis });

  // ── PRINCIPALES HALLAZGOS (máx. 5, por importancia) ─────────────────
  const findings: { text: string; score: number }[] = [];
  if (valoracion && valoracion.percent < goal) {
    findings.push({
      text: `La valoración de riesgo al ingreso, puerta de entrada del proceso preventivo, se cumple en ${valoracion.percent}% de los casos, lo que condiciona la pertinencia de todas las medidas posteriores.`,
      score: round1(goal - valoracion.percent) + 8,
    });
  }
  if (worstInd && (!valoracion || worstInd.label !== valoracion.label)) {
    findings.push({
      text: `El indicador con menor adherencia corresponde a «${worstInd.label}», que alcanza ${worstInd.percent}% de cumplimiento.`,
      score: round1(goal - worstInd.percent) + 3,
    });
  }
  if (worstUnit && worstUnit.percent < goal) {
    findings.push({ text: `La unidad «${worstUnit.label}» concentra la mayor oportunidad de mejora, con ${worstUnit.percent}% de adherencia.`, score: round1(goal - worstUnit.percent) });
  }
  if (worstShift && worstShift.percent < goal) {
    findings.push({ text: `El turno ${worstShift.label} presenta el desempeño más descendido, con ${worstShift.percent}% de cumplimiento.`, score: round1(goal - worstShift.percent) - 1 });
  }
  if (c.lppPrevalence !== null && c.lppPositive) {
    findings.push({
      text: `La prevalencia de LPP en la población evaluada asciende a ${c.lppPrevalence}%, dato clínico que refuerza la vigilancia sobre las medidas de prevención.`,
      score: c.lppPrevalence >= 15 ? 12 : 6,
    });
  }
  const hallazgos = findings.sort((x, y) => y.score - x.score).slice(0, 5).map((f) => f.text);
  if (hallazgos.length === 0) hallazgos.push('El proceso auditado no presenta hallazgos críticos: la adherencia se distribuye de manera homogénea y sobre el estándar definido.');
  sections.push({ id: 'hallazgos', title: 'Principales hallazgos', paragraphs: [], bullets: hallazgos });

  // ── FORTALEZAS ──────────────────────────────────────────────────────
  const fortalezas: string[] = [];
  if (a.highlightedIndicators.length === 0 && !bestUnit) {
    fortalezas.push(
      `En la presente medición ninguna práctica alcanza el estándar institucional de ${goal}%, por lo que no se consolidan fortalezas destacables; el esfuerzo debe orientarse íntegramente a la instalación de los cuidados básicos de prevención.`,
    );
  } else {
    if (a.highlightedIndicators.length > 0) {
      const nombres = a.highlightedIndicators.slice(0, 3).map((i) => `«${i.label}»`).join(', ');
      fortalezas.push(`Entre las prácticas mejor consolidadas destacan ${nombres}, que superan el estándar definido y reflejan competencias instaladas en el equipo.`);
    }
    if (bestUnit && bestUnit.meetsGoal) {
      fortalezas.push(`La unidad «${bestUnit.label}» sostiene el mejor desempeño del servicio (${bestUnit.percent}%), constituyendo un referente replicable hacia el resto de las unidades.`);
    }
    fortalezas.push(
      'Mantener estos resultados es prioritario, pues constituyen la base sobre la cual estandarizar el resto de las prácticas y contribuyen de forma directa a reducir la incidencia de lesiones prevenibles y a fortalecer la cultura de seguridad del paciente.',
    );
  }
  sections.push({ id: 'fortalezas', title: 'Fortalezas', paragraphs: fortalezas });

  // ── OPORTUNIDADES DE MEJORA (qué ocurre · causa · riesgo) ───────────
  const oportunidades: string[] = [];
  const queOcurre = [
    'La práctica no se ejecuta ni se registra de manera sistemática',
    'La ejecución del cuidado resulta intermitente y su registro, incompleto',
    'La adherencia decae de forma marcada respecto del resto del proceso',
  ];
  const causas = [
    'un patrón habitualmente asociado a sobrecarga asistencial, rotación de personal o falta de estandarización del registro',
    'lo que suele reflejar debilidades en la continuidad del cuidado entre turnos y en la supervisión clínica',
    'situación que puede originarse en la disponibilidad de insumos, brechas de capacitación o baja priorización de la práctica en la rutina diaria',
  ];
  const riesgos = [
    'Esto eleva la exposición de los pacientes de mayor riesgo a lesiones prevenibles y compromete la trazabilidad del cuidado',
    'De persistir, aumenta la probabilidad de progresión del daño en pacientes vulnerables y se pierde continuidad asistencial',
    'El resultado es un mayor riesgo de eventos adversos evitables y un debilitamiento de la defensa clínica del servicio',
  ];
  gaps.slice(0, 3).forEach((gp, i) => {
    const donde = gp.dimension === 'unidad' ? `la unidad «${gp.label}»` : gp.dimension === 'turno' ? `el turno ${gp.label}` : `«${gp.label}»`;
    oportunidades.push(
      `En ${donde} la adherencia se ubica ${gp.gap} puntos bajo la meta. ${queOcurre[i % queOcurre.length]}, ${causas[i % causas.length]}. ${riesgos[i % riesgos.length]}.`,
    );
  });
  if (oportunidades.length === 0) {
    oportunidades.push('No se observan brechas relevantes respecto de la meta; la oportunidad de mejora se orienta a sostener el desempeño y a documentar las prácticas que explican el buen resultado.');
  }
  sections.push({ id: 'oportunidades', title: 'Oportunidades de mejora', paragraphs: oportunidades });

  // ── PLAN DE ACCIÓN SUGERIDO (tabla) ─────────────────────────────────
  const seen = new Set<string>();
  const actionPlan: ActionPlanRow[] = [];
  for (const gp of gaps) {
    const row = actionFor(gp, goal);
    if (seen.has(row.finding)) continue;
    seen.add(row.finding);
    actionPlan.push(row);
    if (actionPlan.length >= 5) break;
  }
  if (actionPlan.length === 0) {
    actionPlan.push({
      priority: 'Baja',
      finding: 'Cumplimiento conforme al estándar.',
      action: 'Sostener supervisión periódica y estandarizar las buenas prácticas.',
      responsible: 'Jefatura + Referente de calidad.',
      deadline: 'Continuo',
      target: `≥ ${goal}%`,
    });
  }
  sections.push({ id: 'plan', title: 'Plan de acción sugerido', paragraphs: [], actionPlan });

  // ── CONCLUSIÓN EJECUTIVA (un párrafo) ───────────────────────────────
  let conclusion: string;
  if (g.aplicables === 0) {
    conclusion =
      'En síntesis, la medición no arroja resultados interpretables. Se recomienda revisar el instrumento y repetir la auditoría antes de emitir conclusiones, asegurando la calidad del dato como condición previa a cualquier plan de mejora.';
  } else if (meets && a.criticalIndicators.length === 0) {
    conclusion =
      `En síntesis, el servicio exhibe un cumplimiento conforme al estándar institucional, resultado que refleja un trabajo sistemático del equipo. La prioridad se orienta ahora a sostener y estandarizar las buenas prácticas, evitando su deterioro ante la rotación de personal o la carga asistencial. Antes de la próxima auditoría, la unidad debiese documentar los flujos exitosos y mantener la supervisión periódica. Se recomienda formalizar estas medidas en el comité local de calidad, consolidando la seguridad del paciente como política permanente del servicio.`;
  } else {
    const foco = worstInd ? `en «${worstInd.label}»` : worstUnit ? `en la unidad «${worstUnit.label}»` : 'en las prácticas de mayor rezago';
    conclusion =
      `En síntesis, el servicio se sitúa bajo el estándar institucional definido para la prevención de lesiones por presión, con brechas concentradas ${foco}. La prioridad inmediata es asegurar la valoración de riesgo al ingreso y reforzar la continuidad del cuidado en los turnos de menor desempeño. Antes de la próxima auditoría, la unidad debiese implementar el plan de acción propuesto y verificar su avance mediante cortes intermedios. Se recomienda elevar estas medidas al comité local de calidad y comprometer el respaldo de la jefatura para garantizar su cumplimiento.`;
  }
  sections.push({ id: 'conclusion', title: 'Conclusión ejecutiva', paragraphs: [conclusion] });

  return {
    title: 'Resumen ejecutivo del reporte',
    meta: {
      reportTypeLabel: tipo,
      goal,
      generatedAt: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
    },
    sections,
  };
}
