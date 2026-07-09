import type { ExecutiveReport } from '../types';

/** Serializa el informe ejecutivo a texto plano (para copiar al portapapeles). */
export function toPlainText(report: ExecutiveReport): string {
  const lines: string[] = [];
  lines.push(report.title.toUpperCase());
  lines.push(`${report.meta.reportTypeLabel} · Meta ${report.meta.goal}% · ${report.meta.generatedAt}`);
  lines.push('');
  for (const s of report.sections) {
    lines.push(s.title.toUpperCase());
    for (const p of s.paragraphs) lines.push(p);
    if (s.bullets) for (const b of s.bullets) lines.push(`  • ${b}`);
    if (s.actionPlan) {
      for (const r of s.actionPlan) {
        lines.push(`  [${r.priority}] ${r.finding}`);
        lines.push(`     Acción: ${r.action}`);
        lines.push(`     Responsable: ${r.responsible} · Plazo: ${r.deadline} · Meta: ${r.target}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Copia el resumen ejecutivo al portapapeles. Devuelve true si tuvo éxito. */
export async function copyReport(report: ExecutiveReport): Promise<boolean> {
  const text = toPlainText(report);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cae al método alternativo
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
