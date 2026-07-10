import { useCallback, useRef, useState } from 'react';
import { parseExcelFile } from '../utils/excelParser';
import type { ParsedWorkbook, ReportType } from '../types';

interface FileUploadProps {
  onParsed: (workbook: ParsedWorkbook) => void;
  onBack?: () => void;
  /** Programa seleccionado: activa su perfil de reconocimiento de columnas. */
  reportType?: ReportType;
}

/** Paso 2: carga del archivo Excel con soporte de arrastrar y soltar. */
export default function FileUpload({ onParsed, onBack, reportType }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const wb = await parseExcelFile(file, reportType);
        onParsed(wb);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
      } finally {
        setLoading(false);
      }
    },
    [onParsed, reportType],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Sube tu Excel de auditorías</h2>
        <p className="mt-2 text-slate-500">Yo leo las columnas automáticamente. No necesitas nombres exactos.</p>
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

      {onBack && (
        <div className="mt-6 text-center">
          <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-nex-700">
            ← Volver a los programas
          </button>
        </div>
      )}
    </div>
  );
}
