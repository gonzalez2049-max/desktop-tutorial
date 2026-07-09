import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../../types';
import { buildExecutiveReport } from '../../utils/executiveReport';
import { copyReport, downloadPdf, downloadWord } from '../../utils/reportExport';

/** Sección "Resumen ejecutivo del reporte": redacción automática + exportación. */
export default function ExecutiveSummary({ analysis }: { analysis: AnalysisResult }) {
  const report = useMemo(() => buildExecutiveReport(analysis), [analysis]);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCopy = async () => {
    const ok = await copyReport(report);
    setCopied(ok);
    setNotice(ok ? null : 'No se pudo copiar automáticamente. Selecciona el texto manualmente.');
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  const handlePdf = () => {
    const ok = downloadPdf(report);
    if (!ok) setNotice('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.');
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">📝 {report.title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {report.meta.reportTypeLabel} · Meta {report.meta.goal}% · {report.meta.generatedAt}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={handleCopy}>
            {copied ? '✓ Copiado' : '📋 Copiar resumen'}
          </button>
          <button className="btn-ghost" onClick={handlePdf} title="Se abre la vista de impresión: elige “Guardar como PDF”">
            📕 PDF <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">beta</span>
          </button>
          <button className="btn-ghost" onClick={() => downloadWord(report)}>
            📘 Word <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">beta</span>
          </button>
        </div>
      </header>

      {notice && <div className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-sm text-amber-800">⚠️ {notice}</div>}

      <div className="space-y-5 p-5">
        {report.sections.map((s) => (
          <div key={s.id}>
            <h4 className="text-sm font-bold text-nex-700">{s.title}</h4>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-1 text-sm leading-relaxed text-slate-600">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 space-y-1.5">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-nex-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
