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
      {/* Fondo nocturno premium exclusivo de la portada. */}
      <div className="aurora-night" aria-hidden />
      {/* HERO de marca reutilizable: ancla la portada con identidad y profundidad. */}
      <HeroPanel className="mb-8">
        <div className="flex flex-col items-center">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-white/40">
              <NexLogo size={30} />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black leading-none tracking-tight text-white sm:text-3xl">NEX Report</h1>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-aqua-300">Plataforma de Auditorías Clínicas</p>
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-emerald-50/80">
            Seleccione el Programa de Buenas Prácticas Clínicas que desea analizar.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-[11px] font-semibold text-emerald-50 ring-1 ring-white/20 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-aqua-400" />
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
                operativo ? 'card-interactive' : 'border-white/10 bg-white/[0.06] shadow-soft backdrop-blur-sm transition hover:border-white/20',
              ].join(' ')}
            >
              {/* Filete de acento superior que aparece al pasar el cursor. */}
              {operativo && <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-nex-500 to-fuchsia-500 transition-transform duration-200 group-hover:scale-x-100" />}
              <div className="flex items-start justify-between gap-3">
                <span className={['flex h-14 w-14 items-center justify-center rounded-2xl ring-1 transition', operativo ? 'bg-nex-50 ring-nex-100 group-hover:bg-nex-100' : 'bg-white/10 ring-white/10'].join(' ')}>
                  <ModuleIcon icon={m.icon} size={30} className={operativo ? '' : 'opacity-50 grayscale'} />
                </span>
                <span className={['rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', operativo ? 'bg-nex-100 text-nex-700' : 'bg-white/10 text-slate-300'].join(' ')}>
                  {operativo ? 'Operativo' : 'Próximamente'}
                </span>
              </div>
              <div>
                <p className={['font-bold', operativo ? 'text-slate-800' : 'text-slate-200'].join(' ')}>{m.label}</p>
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
          <button type="button" onClick={onAdmin} className="text-xs font-semibold text-slate-300 transition hover:text-white">
            {admin ? '⚙️ Perfil de administrador' : '🔒 Acceso de administrador'}
          </button>
        </div>
      )}
    </div>
  );
}
