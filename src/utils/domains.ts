// Cumplimiento por DOMINIO clínico (capa de presentación). Agrupa el
// cumplimiento YA calculado por indicador (analyze) según los dominios del
// programa (p. ej. los 8 dominios RNAO). No recalcula la fórmula: reagrega
// cumple/no cumple de los indicadores del dominio. El cumplimiento oficial del
// dominio usa solo los indicadores obligatorios; los complementarios se informan
// aparte.

import type { AnalysisResult, ComplianceGroup } from '../types';
import type { ProgramConfig } from '../config/programs';
import { normalize } from './columnDetection';

export interface DomainComplianceRow extends ComplianceGroup {
  key: string;
  /** Indicadores obligatorios contabilizados en el dominio. */
  obligatorios: number;
  /** % de los indicadores complementarios del dominio (informativo). */
  complementaryPercent: number | null;
  complementarios: number;
}

const pct = (c: number, a: number) => (a > 0 ? Math.round((c / a) * 1000) / 10 : 0);

/**
 * Cumplimiento por dominio a partir de `a.complianceByIndicator`. Devuelve una
 * fila por dominio del programa (vacía si el dominio no tiene datos), con el %
 * oficial (obligatorios) y, aparte, el % de complementarios.
 */
export function domainCompliance(a: AnalysisResult, program: ProgramConfig, goal: number): DomainComplianceRow[] {
  if (!program.domains || program.domains.length === 0) return [];

  // Índice: nombre de indicador normalizado → grupo de cumplimiento.
  const byLabel = new Map<string, ComplianceGroup>();
  for (const g of a.complianceByIndicator) byLabel.set(normalize(g.label), g);

  const complementarySet = new Set((program.complementaryIndicators ?? []).map((n) => normalize(n)));

  const rows: DomainComplianceRow[] = [];
  for (const domain of program.domains) {
    let oc = 0, onc = 0, ona = 0, obl = 0;
    let cc = 0, cnc = 0, comp = 0;
    for (const name of domain.indicators) {
      const g = byLabel.get(normalize(name));
      if (!g) continue;
      if (complementarySet.has(normalize(name))) {
        cc += g.cumple; cnc += g.noCumple; comp += 1;
      } else {
        oc += g.cumple; onc += g.noCumple; ona += g.noAplica; obl += 1;
      }
    }
    const aplic = oc + onc;
    const percent = pct(oc, aplic);
    const compAplic = cc + cnc;
    rows.push({
      key: domain.key,
      label: domain.label,
      total: oc + onc + ona,
      cumple: oc,
      noCumple: onc,
      noAplica: ona,
      aplicables: aplic,
      percent,
      meetsGoal: aplic > 0 && percent >= goal,
      obligatorios: obl,
      complementarios: comp,
      complementaryPercent: compAplic > 0 ? pct(cc, compAplic) : null,
    });
  }
  return rows;
}
