import type { AnalysisResult, ComplianceGroup, ExecutiveReport, ReportSection } from '../types';
import { reportTypeLabel } from '../config/options';

const UNGROUPED = 'Sin especificar';

function round1(n: number): number {
  return Number(n.toFixed(1));
}

/** Grupos con casos aplicables, ignorando la categoría "sin especificar". */
function named(groups: ComplianceGroup[]): ComplianceGroup[] {
  return groups.filter((g) => g.aplicables > 0 && g.label !== UNGROUPED);
}

/** El grupo con menor cumplimiento (o null). */
function lowest(groups: ComplianceGroup[]): ComplianceGroup | null {
  const list = named(groups);
  if (list.length === 0) return null;
  return list.reduce((min, g) => (g.percent < min.percent ? g : min));
}

interface Gap {
  dimension: 'indicador' | 'unidad' | 'turno';
  label: string;
  percent: number;
  gap: number;
}

/** Brechas (categorías bajo la meta) ordenadas de mayor a menor. */
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

const DIM_ARTICLE: Record<Gap['dimension'], string> = { indicador: 'el indicador', unidad: 'la unidad', turno: 'el turno' };

/** Acción concreta sugerida para un indicador crítico (rota para evitar repetición). */
function actionFor(index: number): string {
  const actions = [
    'reforzar la capacitación del equipo mediante refuerzo educativo dirigido',
    'establecer supervisión dirigida en terreno sobre este ítem',
    'revisar el proceso asistencial asociado para identificar la causa del incumplimiento',
  ];
  return actions[index % actions.length];
}

/**
 * Genera el resumen ejecutivo del reporte a partir de los resultados calculados.
 * Toda la redacción se apoya en cifras reales del análisis; no se inventan datos.
 */
export function buildExecutiveReport(a: AnalysisResult): ExecutiveReport {
  const goal = a.config.goal;
  const g = a.global;
  const sections: ReportSection[] = [];
  const gaps = computeGaps(a);
  const gapPoints = round1(goal - g.percent);

  // 1. Resumen general del cumplimiento
  const s1: string[] = [];
  if (g.aplicables === 0) {
    s1.push(
      `Se auditaron ${a.totalRecords} registros del ámbito ${reportTypeLabel(a.config.reportType)}. No se registraron casos aplicables, por lo que no es posible calcular un porcentaje de cumplimiento sobre esta medición.`,
    );
  } else {
    s1.push(
      `Se auditaron ${a.totalRecords} registros del ámbito ${reportTypeLabel(a.config.reportType)}, de los cuales ${g.aplicables} correspondieron a casos aplicables (${g.cumple} cumple, ${g.noCumple} no cumple). El cumplimiento global alcanzó ${g.percent}%, frente a una meta institucional de ${goal}%.`,
    );
  }
  // Filtrado por riesgo (NT 234 / LPP): se informa la base incluida/excluida.
  if (a.characterization.riskFilterApplied) {
    const c = a.characterization;
    s1.push(
      `Conforme al protocolo NT 234 / LPP, el cumplimiento se calculó únicamente sobre pacientes de riesgo moderado y alto: se incluyeron ${c.includedByRisk} paciente(s) y se excluyeron ${c.excludedByRisk} por sin riesgo o bajo riesgo, de ${c.totalOriginal} paciente(s) auditados.`,
    );
  }

  // Hallazgos clínicos descriptivos (prevalencia): se informan como hallazgo,
  // nunca como incumplimiento.
  if (a.descriptiveVariables.length > 0) {
    const parts = a.descriptiveVariables.map((d) => `${d.label} — ${d.positive} de ${d.answered} evaluados (${d.prevalence}%)`);
    s1.push(
      `Como hallazgo clínico descriptivo, y no como incumplimiento, se registró la siguiente prevalencia: ${parts.join('; ')}. Esta(s) variable(s) no forma(n) parte del cálculo de cumplimiento.`,
    );
  }
  sections.push({ id: 'resumen-general', title: '1. Resumen general del cumplimiento', paragraphs: s1 });

  // 2. Interpretación del porcentaje global
  const s2: string[] = [];
  if (g.aplicables === 0) {
    s2.push('Sin casos aplicables no es posible interpretar el nivel de cumplimiento global de este periodo.');
  } else if (g.meetsGoal) {
    const over = round1(g.percent - goal);
    s2.push(
      `El resultado global cumple la meta establecida, ubicándose ${over} punto(s) porcentual(es) por sobre el umbral de ${goal}%. El desempeño general de la auditoría es conforme.`,
    );
  } else {
    let severidad: string;
    if (gapPoints < 5) severidad = `se ubica marginalmente bajo la meta (${gapPoints} punto(s) porcentual(es) de diferencia) y requiere intervención`;
    else if (gapPoints <= 15) severidad = `se encuentra ${gapPoints} puntos porcentuales bajo la meta de ${goal}% y requiere intervención`;
    else severidad = `se encuentra ${gapPoints} puntos porcentuales bajo la meta de ${goal}%, una distancia relevante que requiere intervención prioritaria`;
    s2.push(`El cumplimiento global ${severidad}.`);
  }
  sections.push({ id: 'interpretacion', title: '2. Interpretación del porcentaje global', paragraphs: s2 });

  // 3. Principales brechas detectadas
  const s3: string[] = [];
  const b3: string[] = [];
  if (gaps.length === 0) {
    s3.push(`No se detectaron brechas: todas las categorías evaluadas alcanzan o superan la meta de ${goal}%.`);
  } else {
    s3.push(`Se identificaron ${gaps.length} categoría(s) bajo la meta de ${goal}%. Las principales brechas, ordenadas por magnitud, son:`);
    gaps.slice(0, 5).forEach((gp) => {
      b3.push(`${DIM_ARTICLE[gp.dimension]} "${gp.label}": ${gp.percent}% de cumplimiento, a ${gp.gap} puntos de la meta.`);
    });
  }
  sections.push({ id: 'brechas', title: '3. Principales brechas detectadas', paragraphs: s3, bullets: b3.length ? b3 : undefined });

  // 4. Indicadores críticos bajo la meta
  const s4: string[] = [];
  const b4: string[] = [];
  if (a.criticalIndicators.length === 0) {
    s4.push(`No se identificaron indicadores bajo la meta de ${goal}%.`);
  } else {
    s4.push(`Se identificaron ${a.criticalIndicators.length} indicador(es) críticos, con cumplimiento inferior a la meta de ${goal}%:`);
    a.criticalIndicators.forEach((ind) => {
      b4.push(`"${ind.label}": ${ind.percent}% (${ind.cumple} de ${ind.aplicables} casos aplicables), a ${round1(goal - ind.percent)} puntos de la meta.`);
    });
  }
  sections.push({ id: 'criticos', title: '4. Indicadores críticos bajo la meta', paragraphs: s4, bullets: b4.length ? b4 : undefined });

  // 5. Unidades o turnos con menor cumplimiento
  const s5: string[] = [];
  const worstUnit = lowest(a.complianceByUnit);
  const worstShift = lowest(a.complianceByShift);
  if (!worstUnit && !worstShift) {
    s5.push('El archivo no contiene columnas de unidad ni de turno con casos aplicables, por lo que no es posible desglosar el cumplimiento por estas dimensiones.');
  } else {
    if (worstUnit) {
      const estado = worstUnit.percent >= goal ? 'aun así alcanza la meta' : `${round1(goal - worstUnit.percent)} puntos bajo la meta`;
      s5.push(`La unidad con menor cumplimiento es "${worstUnit.label}", con ${worstUnit.percent}% (${estado}).`);
    }
    if (worstShift) {
      const estado = worstShift.percent >= goal ? 'aun así alcanza la meta' : `${round1(goal - worstShift.percent)} puntos bajo la meta`;
      s5.push(`El turno con menor cumplimiento es "${worstShift.label}", con ${worstShift.percent}% (${estado}).`);
    }
  }
  sections.push({ id: 'menor-cumplimiento', title: '5. Unidades o turnos con menor cumplimiento', paragraphs: s5 });

  // 6. Fortalezas identificadas
  const s6: string[] = [];
  const b6: string[] = [];
  if (a.highlightedIndicators.length === 0) {
    s6.push(`No se identificaron indicadores que alcancen la meta de ${goal}%, por lo que no se registran fortalezas destacables en esta medición.`);
  } else {
    s6.push(`Destacan por alcanzar o superar la meta de ${goal}% los siguientes indicadores:`);
    a.highlightedIndicators.slice(0, 6).forEach((ind) => {
      b6.push(`"${ind.label}": ${ind.percent}% de cumplimiento.`);
    });
    const bestUnit = named(a.complianceByUnit).find((u) => u.meetsGoal);
    if (bestUnit) s6.push(`En el desglose por unidad, "${bestUnit.label}" sostiene un cumplimiento de ${bestUnit.percent}%, en línea con la meta.`);
  }
  sections.push({ id: 'fortalezas', title: '6. Fortalezas identificadas', paragraphs: s6, bullets: b6.length ? b6 : undefined });

  // 7. Recomendaciones operativas concretas
  const s7: string[] = [];
  const b7: string[] = [];
  if (!g.meetsGoal && g.aplicables > 0) {
    b7.push(`Definir un plan de intervención para elevar el cumplimiento global desde ${g.percent}% hasta la meta de ${goal}%, con seguimiento en la próxima auditoría.`);
  }
  a.criticalIndicators.slice(0, 4).forEach((ind, i) => {
    b7.push(`Indicador "${ind.label}" (${ind.percent}%): ${actionFor(i)}.`);
  });
  if (worstUnit && !worstUnit.meetsGoal) {
    b7.push(`Focalizar la supervisión en la unidad "${worstUnit.label}" (${worstUnit.percent}%), que concentra la menor adherencia.`);
  }
  if (worstShift && !worstShift.meetsGoal) {
    b7.push(`Reforzar el turno "${worstShift.label}" (${worstShift.percent}%) mediante acompañamiento clínico en terreno.`);
  }
  if (b7.length === 0) {
    s7.push(`El cumplimiento alcanza la meta de ${goal}% en todas las categorías evaluadas. Se recomienda sostener las prácticas actuales, documentar los flujos de las unidades destacadas y mantener el monitoreo periódico.`);
  } else {
    s7.push('Se proponen las siguientes acciones, priorizadas según los hallazgos:');
  }
  sections.push({ id: 'recomendaciones', title: '7. Recomendaciones operativas concretas', paragraphs: s7, bullets: b7.length ? b7 : undefined });

  // 8. Conclusión final
  const s8: string[] = [];
  if (g.aplicables === 0) {
    s8.push('La medición no registró casos aplicables. Se recomienda revisar el instrumento de auditoría y repetir la evaluación para obtener resultados interpretables.');
  } else if (g.meetsGoal && a.criticalIndicators.length === 0) {
    s8.push(
      `El proceso auditado alcanza un cumplimiento global de ${g.percent}%, superando la meta de ${goal}%, sin indicadores bajo el umbral. Se recomienda sostener el desempeño, estandarizar las buenas prácticas y mantener el monitoreo periódico.`,
    );
  } else {
    const criticosTxt = a.criticalIndicators.length > 0 ? `${a.criticalIndicators.length} indicador(es) crítico(s) que requieren acción` : 'sin indicadores críticos';
    const estadoGlobal = g.meetsGoal
      ? `El cumplimiento global (${g.percent}%) alcanza la meta`
      : `El cumplimiento global (${g.percent}%) se encuentra ${gapPoints} puntos bajo la meta de ${goal}% y requiere intervención`;
    s8.push(
      `${estadoGlobal}, con ${criticosTxt}. El foco inmediato debe orientarse a las categorías con mayor brecha, con reevaluación en la próxima auditoría para verificar el efecto de las medidas adoptadas.`,
    );
  }
  sections.push({ id: 'conclusion', title: '8. Conclusión final', paragraphs: s8 });

  return {
    title: 'Resumen ejecutivo del reporte',
    meta: {
      reportTypeLabel: reportTypeLabel(a.config.reportType),
      goal,
      generatedAt: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
    },
    sections,
  };
}
