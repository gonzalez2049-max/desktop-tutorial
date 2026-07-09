import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../../types';
import { buildExecutiveReport } from '../../utils/executiveReport';
import { copyReport } from '../../utils/reportExport';

interface ExecutiveSummaryProps {
  analysis: AnalysisResult;
  fileName: string;
}

/** Sección "Resumen ejecutivo del reporte": redacción automática + exportación. */
export default function ExecutiveSummary({ analysis, fileName }: ExecutiveSummaryProps) {
  const report = useMemo(() => buildExecutiveReport(analysis), [analysis]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'word'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCopy = async () => {
    const ok = await copyReport(report);
    setCopied(ok);
    setNotice(ok ? null : 'No se pudo copiar automáticamente. Selecciona el texto manualmente.');
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  // Los generadores nativos (jsPDF / docx) se cargan bajo demanda.
  const handlePdf = async () => {
    setBusy('pdf');
    setNotice(null);
    try {
      const { exportPdf } = await import('../../utils/exportPdf');
      exportPdf(analysis, fileName);
    } catch (e) {
      console.error(e);
      setNotice('No se pudo generar el PDF. Inténtalo nuevamente.');
    } finally {
      setBusy(null);
    }
  };

  const handleWord = async () => {
    setBusy('word');
    setNotice(null);
    try {
      const { exportWord } = await import('../../utils/exportWord');
      await exportWord(analysis, fileName);
    } catch (e) {
      console.error(e);
      setNotice('No se pudo generar el documento Word. Inténtalo nuevamente.');
    } finally {
      setBusy(null);
    }
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
          <button className="btn-primary" onClick={handleCopy} disabled={busy !== null}>
            {copied ? '✓ Copiado' : '📋 Copiar resumen'}
          </button>
          <button className="btn-ghost" onClick={handlePdf} disabled={busy !== null}>
            {busy === 'pdf' ? 'Generando…' : '📕 Descargar PDF'}
          </button>
          <button className="btn-ghost" onClick={handleWord} disabled={busy !== null}>
            {busy === 'word' ? 'Generando…' : '📘 Descargar Word'}
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
