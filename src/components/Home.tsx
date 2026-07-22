import { useMemo, useState } from 'react';
import NexLogo from './NexLogo';
import ModuleIcon from './ModuleIcon';
import HeroPanel from './HeroPanel';
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

  const operativos = modules.filter((m) => m.status === 'operativo').length;

  return (
    <div className="mx-auto max-w-4xl">
      {/* HERO de marca reutilizable: ancla la portada con identidad y profundidad. */}
      <HeroPanel className="mb-8">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-white/40">
            <NexLogo size={48} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">NEX Report</h1>
          <p className="mt-1.5 text-base font-bold uppercase tracking-[0.2em] text-aqua-300">Plataforma de Auditorías Clínicas</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-emerald-50/80">
            Seleccione el Programa de Buenas Prácticas Clínicas que desea analizar.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-emerald-50 ring-1 ring-white/20 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-aqua-400" />
            {operativos} módulos operativos · Word y PDF · 100 % local
          </div>
        </div>
      </HeroPanel>

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
                'group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border p-5 text-left',
                operativo ? 'card-interactive' : 'border-slate-200/70 bg-white/60 shadow-soft transition hover:border-slate-300',
              ].join(' ')}
            >
              {/* Filete de acento superior que aparece al pasar el cursor. */}
              {operativo && <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-nex-500 to-nex-700 transition-transform duration-200 group-hover:scale-x-100" />}
              <div className="flex items-start justify-between gap-3">
                <span className={['flex h-14 w-14 items-center justify-center rounded-2xl ring-1 transition', operativo ? 'bg-nex-50 ring-nex-100 group-hover:bg-nex-100' : 'bg-slate-100 ring-slate-200'].join(' ')}>
                  <ModuleIcon icon={m.icon} size={30} className={operativo ? '' : 'opacity-40 grayscale'} />
                </span>
                <span className={['rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', operativo ? 'bg-nex-100 text-nex-700' : 'bg-slate-200 text-slate-500'].join(' ')}>
                  {operativo ? 'Operativo' : 'Próximamente'}
                </span>
              </div>
              <div>
                <p className={['font-bold', operativo ? 'text-slate-800' : 'text-slate-500'].join(' ')}>{m.label}</p>
                <p className={['mt-0.5 text-sm leading-relaxed', operativo ? 'text-slate-500' : 'text-slate-400'].join(' ')}>{m.description}</p>
              </div>
              {operativo && (
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-nex-700">
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
