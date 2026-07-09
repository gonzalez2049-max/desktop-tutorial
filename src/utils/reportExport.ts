import type { ExecutiveReport } from '../types';

/** Serializa el informe ejecutivo a texto plano (para copiar al portapapeles). */
export function toPlainText(report: ExecutiveReport): string {
  const lines: string[] = [];
  lines.push(report.title.toUpperCase());
  lines.push(`${report.meta.reportTypeLabel} · Meta ${report.meta.goal}% · ${report.meta.generatedAt}`);
  lines.push('');
  for (const s of report.sections) {
    lines.push(s.title);
    for (const p of s.paragraphs) lines.push(p);
    if (s.bullets) for (const b of s.bullets) lines.push(`  - ${b}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Cuerpo HTML del informe (compartido por la exportación a Word y PDF). */
export function toHtmlBody(report: ExecutiveReport): string {
  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(report.title)}</h1>`);
  parts.push(
    `<p class="meta">${escapeHtml(report.meta.reportTypeLabel)} · Meta ${report.meta.goal}% · ${escapeHtml(report.meta.generatedAt)}</p>`,
  );
  for (const s of report.sections) {
    parts.push(`<h2>${escapeHtml(s.title)}</h2>`);
    for (const p of s.paragraphs) parts.push(`<p>${escapeHtml(p)}</p>`);
    if (s.bullets && s.bullets.length) {
      parts.push('<ul>');
      for (const b of s.bullets) parts.push(`<li>${escapeHtml(b)}</li>`);
      parts.push('</ul>');
    }
  }
  return parts.join('\n');
}

const DOC_STYLES = `
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; max-width: 800px; margin: 24px auto; padding: 0 16px; }
  h1 { color: #1d3a80; font-size: 22px; margin-bottom: 4px; }
  h2 { color: #2447c7; font-size: 15px; margin-top: 22px; margin-bottom: 6px; }
  p { margin: 6px 0; }
  .meta { color: #64748b; font-size: 12px; margin-top: 0; }
  ul { margin: 6px 0 6px 18px; }
  li { margin: 3px 0; }
`;

/** Documento HTML completo, con estilos, para Word/PDF. */
export function toFullHtml(report: ExecutiveReport): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>${DOC_STYLES}</style></head><body>${toHtmlBody(report)}</body></html>`;
}

/** Descarga un Blob con el nombre indicado (sin dependencias externas). */
function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

/**
 * Exporta el informe a Word editable (.doc). Estructura preparada: genera un
 * documento HTML compatible con Word; el formato se refinará más adelante.
 */
export function downloadWord(report: ExecutiveReport, fileName = 'NEX-Report_Resumen-ejecutivo.doc'): void {
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>";
  const html = `${header}<head><meta charset="utf-8"><title>${report.title}</title><style>${DOC_STYLES}</style></head><body>${toHtmlBody(report)}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  triggerDownload(blob, fileName);
}

/**
 * Exporta el informe a PDF. Estructura preparada: abre una vista de impresión
 * del navegador (Guardar como PDF). Se reemplazará por una generación nativa.
 * Devuelve false si el navegador bloquea la ventana emergente.
 */
export function downloadPdf(report: ExecutiveReport): boolean {
  const win = window.open('', '_blank', 'width=880,height=1000');
  if (!win) return false;
  win.document.write(toFullHtml(report));
  win.document.close();
  win.focus();
  // Espera breve para que el documento renderice antes de imprimir.
  setTimeout(() => win.print(), 350);
  return true;
}
