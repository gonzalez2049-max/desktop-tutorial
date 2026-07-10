import { useState } from 'react';
import { REPORT_TYPES } from '../config/options';
import type { ReportType } from '../types';

interface HomeProps {
  onSelect: (reportType: ReportType) => void;
}

/**
 * Pantalla inicial: selección del Programa de Buenas Prácticas Clínicas.
 * Solo NT 234 / LPP está operativo; el resto de los módulos permanecen visibles
 * con la etiqueta "Próximamente" y no permiten continuar.
 */
export default function Home({ onSelect }: HomeProps) {
  const [notice, setNotice] = useState<string | null>(null);

  const handleClick = (value: ReportType, operativo: boolean) => {
    if (operativo) {
      onSelect(value);
    } else {
      setNotice('Este módulo estará disponible en una próxima versión.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">NEX Report</h1>
        <p className="mt-1 text-lg font-semibold text-nex-700">Plataforma de Auditorías Clínicas</p>
        <p className="mt-3 text-slate-500">Seleccione el Programa de Buenas Prácticas Clínicas que desea analizar.</p>
      </div>

      {notice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>🔒 {notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-semibold text-amber-700 hover:underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_TYPES.map((m) => {
          const operativo = m.status === 'operativo';
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => handleClick(m.value, operativo)}
              title={operativo ? undefined : 'Este módulo estará disponible en una próxima versión.'}
              className={[
                'group relative flex cursor-pointer flex-col gap-2 rounded-2xl border p-5 text-left transition',
                operativo ? 'border-slate-200 bg-white hover:border-nex-400 hover:shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={['text-3xl leading-none', operativo ? '' : 'opacity-50 grayscale'].join(' ')}>{m.icon}</span>
                <span
                  className={[
                    'rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                    operativo ? 'bg-nex-100 text-nex-700' : 'bg-slate-200 text-slate-500',
                  ].join(' ')}
                >
                  {operativo ? 'Operativo' : 'Próximamente'}
                </span>
              </div>
              <div>
                <p className={['font-bold', operativo ? 'text-slate-800' : 'text-slate-500'].join(' ')}>{m.label}</p>
                <p className={['mt-0.5 text-sm', operativo ? 'text-slate-500' : 'text-slate-400'].join(' ')}>{m.description}</p>
              </div>
              {operativo && (
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-nex-700">
                  Comenzar análisis <span className="transition group-hover:translate-x-0.5">→</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Nuevos programas de auditoría se incorporarán en próximas versiones.
      </p>
    </div>
  );
}
