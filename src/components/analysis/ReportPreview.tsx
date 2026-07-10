import { useEffect, useState } from 'react';
import type { AnalysisResult } from '../../types';

interface ReportPreviewProps {
  analysis: AnalysisResult;
  fileName: string;
  onClose: () => void;
  /** Volver a editar la configuración (opcional). */
  onEdit?: () => void;
}

/**
 * Vista previa del informe completo tal como quedará exportado: renderiza el PDF
 * (con títulos, tablas, resumen ejecutivo, firma, saltos de página y pie de
 * página) y permite volver a editar o descargar en PDF / Word.
 */
export default function ReportPreview({ analysis, fileName, onClose, onEdit }: ReportPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'word'>(null);

  useEffect(() => {
    let active = true;
    let created: string | null = null;
    (async () => {
      try {
        const { pdfBlobUrl } = await import('../../utils/exportPdf');
        const u = pdfBlobUrl(analysis, fileName);
        created = u;
        if (active) setUrl(u);
      } catch {
        if (active) setError('No se pudo generar la vista previa.');
      }
    })();
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [analysis, fileName]);

  const downloadPdf = async () => {
    const { exportPdf } = await import('../../utils/exportPdf');
    exportPdf(analysis, fileName);
  };

  const downloadWord = async () => {
    setBusy('word');
    try {
      const { exportWord } = await import('../../utils/exportWord');
      await exportWord(analysis, fileName);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">👁️ Vista previa del informe</h3>
            <p className="text-xs text-slate-400">Así se verá el informe exportado (con saltos de página y pie de página).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-ghost"
              onClick={() => {
                onClose();
                onEdit?.();
              }}
            >
              ← Volver a editar
            </button>
            <button className="btn-ghost" onClick={downloadPdf}>
              📕 Descargar PDF
            </button>
            <button className="btn-ghost" onClick={downloadWord} disabled={busy === 'word'}>
              {busy === 'word' ? 'Generando…' : '📘 Descargar Word'}
            </button>
            <button className="btn-primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </header>
        <div className="flex-1 bg-slate-100">
          {error ? (
            <div className="p-8 text-center text-sm text-red-600">⚠️ {error}</div>
          ) : url ? (
            <iframe title="Vista previa del informe" src={url} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Generando vista previa…</div>
          )}
        </div>
      </div>
    </div>
  );
}
