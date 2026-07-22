import { useMemo, useRef, useState } from 'react';
import type { ReportType } from '../../types';
import { buildShareLink, logout as adminLogout, resetModuleOverrides, resolveModules, saveModuleOverride } from '../../utils/adminConfig';
import ProgramSettings from '../ProgramSettings';
import ModuleIcon from '../ModuleIcon';
import HeroPanel from '../HeroPanel';

interface Props {
  onExit: () => void;
  onLogout: () => void;
}

type Tab = 'programas' | 'modulos';
const inputCls = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200';

/** Panel del perfil de administrador: configura programas, módulos y accesos. */
export default function AdminPanel({ onExit, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('programas');
  const [configuring, setConfiguring] = useState<ReportType | null>(null);
  const [mods, setMods] = useState(() => resolveModules());
  const [share, setShare] = useState<ReportType[]>([]);
  const [copied, setCopied] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = () => setMods(resolveModules());
  const patch = (rt: ReportType, p: Parameters<typeof saveModuleOverride>[1]) => { saveModuleOverride(rt, p); refresh(); };

  const uploadIcon = (rt: ReportType, file: File) => {
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') patch(rt, { icon: reader.result }); };
    reader.readAsDataURL(file);
  };

  const link = useMemo(() => buildShareLink(share), [share]);
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } };

  // Configurando un programa concreto: reutiliza ProgramSettings.
  if (configuring) {
    return (
      <div className="mx-auto max-w-3xl">
        <ProgramSettings reportType={configuring} onBack={() => { setConfiguring(null); refresh(); }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <HeroPanel compact>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/25 backdrop-blur">⚙️</span>
            <div>
              <h1 className="text-2xl font-black text-white">Perfil de administrador</h1>
              <p className="text-sm text-emerald-50/80">Configura los módulos, sus nombres, logos y accesos.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25" onClick={onExit}>Salir</button>
            <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25" onClick={() => { adminLogout(); onLogout(); }}>Cerrar sesión</button>
          </div>
        </div>
      </HeroPanel>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        <button onClick={() => setTab('programas')} className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === 'programas' ? 'bg-white text-nex-700 shadow-sm' : 'text-slate-500'}`}>🩺 Programas</button>
        <button onClick={() => setTab('modulos')} className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === 'modulos' ? 'bg-white text-nex-700 shadow-sm' : 'text-slate-500'}`}>🧩 Módulos y acceso</button>
      </div>

      {tab === 'programas' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {mods.map((m) => (
            <div key={m.value} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex min-w-0 items-center gap-3">
                <ModuleIcon icon={m.icon} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{m.label}</p>
                  <p className="truncate text-xs text-slate-400">{m.description}</p>
                </div>
              </div>
              <button className="shrink-0 rounded-xl border border-nex-300 bg-nex-50 px-3 py-1.5 text-xs font-bold text-nex-700 hover:bg-nex-100" onClick={() => setConfiguring(m.value)}>Configurar</button>
            </div>
          ))}
          <p className="text-xs text-slate-400 sm:col-span-2">En «Configurar» editas nombre, institución, unidad, meta, colores del semáforo, indicadores, variables y auditorías de cada programa.</p>
        </div>
      )}

      {tab === 'modulos' && (
        <div className="space-y-5">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Módulos: nombre, logo y visibilidad</h2>
              <button className="text-xs font-semibold text-slate-400 hover:text-red-600" onClick={() => { if (confirm('¿Restablecer nombres, logos y visibilidad de todos los módulos?')) { resetModuleOverrides(); refresh(); } }}>Restablecer</button>
            </div>
            <div className="space-y-3">
              {mods.map((m) => (
                <div key={m.value} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <ModuleIcon icon={m.icon} size={28} />
                    <input className={`${inputCls} max-w-[110px]`} value={m.icon.startsWith('data:') ? '' : m.icon} placeholder="emoji" onChange={(e) => patch(m.value, { icon: e.target.value })} title="Emoji del módulo" />
                    <input className={inputCls} value={m.label} onChange={(e) => patch(m.value, { label: e.target.value })} title="Nombre del módulo" />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <input type="checkbox" checked={!m.hidden} onChange={(e) => patch(m.value, { hidden: !e.target.checked })} /> Visible
                    </label>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input className={inputCls} value={m.description} onChange={(e) => patch(m.value, { description: e.target.value })} placeholder="Descripción" />
                    <button className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => fileRefs.current[m.value]?.click()}>Subir logo</button>
                    {m.icon.startsWith('data:') && <button className="shrink-0 text-xs font-semibold text-slate-400 hover:text-red-600" onClick={() => patch(m.value, { icon: '' })} title="Quitar imagen (volver a emoji)">Quitar</button>}
                    <input ref={(el) => { fileRefs.current[m.value] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadIcon(m.value, f); e.target.value = ''; }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-bold text-slate-800">Compartir acceso a otros</h2>
            <p className="mb-3 text-xs text-slate-400">Genera un enlace que abre NEX Report mostrando <strong>solo los módulos que elijas</strong>. Ideal para dar acceso a una persona a un módulo específico, no a todos.</p>
            <div className="flex flex-wrap gap-2">
              {mods.map((m) => {
                const on = share.includes(m.value);
                return (
                  <button key={m.value} onClick={() => setShare(on ? share.filter((x) => x !== m.value) : [...share, m.value])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-nex-500 bg-nex-50 text-nex-700' : 'border-slate-200 bg-white text-slate-500 hover:border-nex-300'}`}>
                    {on ? '✓ ' : ''}{m.label}
                  </button>
                );
              })}
            </div>
            {share.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <input readOnly value={link} className={`${inputCls} font-mono text-[11px]`} onFocus={(e) => e.target.select()} />
                <button className="shrink-0 btn-primary py-1.5" onClick={copy}>{copied ? '✓ Copiado' : 'Copiar enlace'}</button>
              </div>
            )}
            {share.length === 0 && <p className="mt-3 text-xs text-slate-400">Selecciona uno o más módulos para generar el enlace.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
