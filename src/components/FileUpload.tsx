import { useCallback, useRef, useState } from 'react';
import { parseExcelFile } from '../utils/excelParser';
import type { ParsedWorkbook, ReportType } from '../types';
import { EXPECTED_COLUMNS, exampleCsv, templateCsv, csvToFile, downloadCsv } from '../utils/sampleData';

interface FileUploadProps {
  onParsed: (workbook: ParsedWorkbook) => void;
  onBack?: () => void;
  /** Programa seleccionado: activa su perfil de reconocimiento de columnas. */
  reportType?: ReportType;
  /** Sub-auditoría elegida: afina el perfil con sus indicadores oficiales. */
  auditId?: string;
}

/** Paso 2: carga del archivo Excel con soporte de arrastrar y soltar. */
export default function FileUpload({ onParsed, reportType, auditId }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const wb = await parseExcelFile(file, reportType, auditId);
        onParsed(wb);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
      } finally {
        setLoading(false);
      }
    },
    [onParsed, reportType, auditId],
  );

  const [showHelp, setShowHelp] = useState(false);

  const runExample = () => handleFile(csvToFile(exampleCsv(), 'ejemplo-nex-report.csv'));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Sube tu Excel de auditorías</h2>
        <p className="mt-2 text-slate-500">Yo leo las columnas automáticamente. No necesitas nombres exactos.</p>
      </div>

      {/* Atajo para primeras impresiones: ver un informe sin preparar un archivo. */}
      <div className="mb-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-nex-200 bg-gradient-to-br from-nex-50 to-white p-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="text-sm font-bold text-nex-800">¿Primera vez? Prueba con datos de ejemplo</p>
          <p className="text-xs text-slate-500">Genero un informe completo al instante para que veas cómo funciona.</p>
        </div>
        <button type="button" onClick={runExample} disabled={loading} className="btn-primary shrink-0 disabled:opacity-50">
          ✨ Probar con datos de ejemplo
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          'card flex flex-col items-center justify-center gap-3 border-2 border-dashed p-12 cursor-pointer transition',
          dragging ? 'border-nex-500 bg-nex-50' : 'border-slate-300 hover:border-nex-400',
        ].join(' ')}
        role="button"
        tabIndex={0}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-nex-100 text-3xl">📄</div>
        {loading ? (
          <p className="font-medium text-nex-700">Leyendo el archivo…</p>
        ) : (
          <>
            <p className="font-semibold text-slate-700">Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <p className="text-sm text-slate-400">Formatos: .xlsx, .xls, .csv</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* Ayuda operativa: qué archivo traer + plantilla descargable. */}
      <div className="mt-4 card p-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setShowHelp((s) => !s)} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span>📋</span> ¿Qué necesito subir?
            <span className={`text-xs text-slate-400 transition ${showHelp ? 'rotate-180' : ''}`}>▾</span>
          </button>
          <button type="button" onClick={() => downloadCsv(templateCsv(), 'plantilla-nex-report.csv')} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-nex-300 hover:text-nex-700">
            📥 Descargar plantilla
          </button>
        </div>
        {showHelp && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">
              Una fila por evaluación. No necesitas nombres exactos ni todas las columnas: yo reconozco lo que traigas.
            </p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
              {EXPECTED_COLUMNS.map((c) => (
                <li key={c.name} className="flex items-baseline justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{c.desc}</span>
                  </div>
                  <span className="shrink-0 rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{c.example}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
