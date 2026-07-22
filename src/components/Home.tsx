import { useMemo, useState } from 'react';
import NexLogo from './NexLogo';
import ModuleIcon from './ModuleIcon';
import { isAdmin, scopedModules, visibleModules } from '../utils/adminConfig';
import type { ReportType } from '../types';

interface HomeProps {
  onSelect: (reportType: ReportType) => void;
  /** Abre el perfil de administrador. */
  onAdmin: () => void;
}

/**
 * Pantalla inicial: selección del Programa de Buenas Prácticas Clínicas. La lista
 * respeta los ajustes del administrador (nombres, logos, visibilidad) y el alcance
 * del enlace de acceso (?only=…).
 */
export default function Home({ onSelect, onAdmin }: HomeProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const admin = useMemo(() => isAdmin(), []);
  const scoped = useMemo(() => scopedModules() !== null, []);
  const modules = useMemo(() => visibleModules(admin), [admin]);

  const handleClick = (value: ReportType, operativo: boolean) => {
    if (operativo) onSelect(value);
    else setNotice('Este módulo estará disponible en una próxima versión.');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <NexLogo size={56} className="mx-auto mb-3" />
        <h1 className="text-3xl font-black tracking-tight text-slate-900">NEX Report</h1>
        <p className="mt-1 text-lg font-semibold text-nex-700">Plataforma de Auditorías Clínicas</p>
        <p className="mt-3 text-slate-500">Seleccione el Programa de Buenas Prácticas Clínicas que desea analizar.</p>
      </div>

      {notice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>🔒 {notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-semibold text-amber-700 hover:underline">Cerrar</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => {
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
                <ModuleIcon icon={m.icon} size={30} className={operativo ? '' : 'opacity-50 grayscale'} />
                <span className={['rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', operativo ? 'bg-nex-100 text-nex-700' : 'bg-slate-200 text-slate-500'].join(' ')}>
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

      {/* Acceso al perfil de administrador (oculto cuando el enlace es de alcance limitado). */}
      {!scoped && (
        <div className="mt-8 text-center">
          <button type="button" onClick={onAdmin} className="text-xs font-semibold text-slate-400 transition hover:text-nex-700">
            {admin ? '⚙️ Perfil de administrador' : '🔒 Acceso de administrador'}
          </button>
        </div>
      )}
    </div>
  );
}
