import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../../types';
import { buildExecutiveReport } from '../../utils/executiveReport';
import { getProgramConfig } from '../../utils/programConfig';
import { copyReport } from '../../utils/reportExport';
import ReportPreview from './ReportPreview';

interface ExecutiveSummaryProps {
  analysis: AnalysisResult;
  fileName: string;
  /** Volver a editar la configuración desde la vista previa (opcional). */
  onEdit?: () => void;
}

/** Sección "Resumen ejecutivo del reporte": redacción automática + exportación. */
export default function ExecutiveSummary({ analysis, fileName, onEdit }: ExecutiveSummaryProps) {
  const report = useMemo(() => buildExecutiveReport(analysis), [analysis]);
  const baseText = getProgramConfig(analysis.config.reportType).executiveBaseText.trim();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'word'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

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
          <button className="btn-primary" onClick={() => setPreview(true)} disabled={busy !== null}>
            👁️ Vista previa del informe
          </button>
          <button className="btn-ghost" onClick={handleCopy} disabled={busy !== null}>
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

      <div className="space-y-6 p-5">
        {baseText && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm italic leading-relaxed text-slate-500">{baseText}</p>
        )}
        {report.sections.map((s) => (
          <div key={s.id}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-nex-700">{s.title}</h4>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-1.5 text-sm leading-relaxed text-slate-600">
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
            {s.actionPlan && <ActionPlanTable rows={s.actionPlan} />}
          </div>
        ))}
      </div>

      {preview && <ReportPreview analysis={analysis} fileName={fileName} onEdit={onEdit} onClose={() => setPreview(false)} />}
    </section>
  );
}

function ActionPlanTable({ rows }: { rows: import('../../types').ActionPlanRow[] }) {
  const badge = (p: 'Alta' | 'Media' | 'Baja') =>
    p === 'Alta' ? 'bg-red-100 text-red-700' : p === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3 font-semibold">Prioridad</th>
            <th className="py-2 px-3 font-semibold">Hallazgo</th>
            <th className="py-2 px-3 font-semibold">Acción propuesta</th>
            <th className="py-2 px-3 font-semibold">Responsable</th>
            <th className="py-2 px-3 font-semibold">Plazo</th>
            <th className="py-2 pl-3 font-semibold">Indicador esperado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 align-top last:border-0">
              <td className="py-2.5 pr-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge(r.priority)}`}>{r.priority}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-700">{r.finding}</td>
              <td className="py-2.5 px-3 text-slate-600">{r.action}</td>
              <td className="py-2.5 px-3 text-slate-600">{r.responsible}</td>
              <td className="py-2.5 px-3 text-slate-600">{r.deadline}</td>
              <td className="py-2.5 pl-3 font-semibold text-slate-700">{r.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
