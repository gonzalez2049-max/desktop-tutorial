import { useMemo, useState } from 'react';
import type { ReportType } from '../types';
import type { ProgramConfigEditable } from '../config/programs';
import { getProgramConfig, saveProgramConfig, resetProgramConfig } from '../utils/programConfig';

interface ProgramSettingsProps {
  reportType: ReportType;
  onBack: () => void;
}

/** Convierte una lista a texto (una línea por elemento) y viceversa. */
const toLines = (arr: string[]) => arr.join('\n');
const fromLines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '');

/**
 * Configuración del programa: permite ajustar, sin tocar el código, los valores
 * de cada programa clínico (nombre, institución, unidad, logo, meta, colores del
 * semáforo, texto base del resumen, indicadores oficiales y variables
 * descriptivas). Los cambios se guardan por programa en el navegador.
 */
export default function ProgramSettings({ reportType, onBack }: ProgramSettingsProps) {
  const initial = useMemo(() => getProgramConfig(reportType), [reportType]);
  const [form, setForm] = useState<ProgramConfigEditable>({
    programName: initial.programName,
    institutionName: initial.institutionName,
    unitName: initial.unitName,
    logo: initial.logo,
    goal: initial.goal,
    traffic: { ...initial.traffic },
    executiveBaseText: initial.executiveBaseText,
    officialIndicators: [...initial.officialIndicators],
    descriptiveVariables: [...initial.descriptiveVariables],
  });
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof ProgramConfigEditable>(key: K, value: ProgramConfigEditable[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveProgramConfig(reportType, form);
    setSaved(true);
  };

  const handleReset = () => {
    resetProgramConfig(reportType);
    const d = getProgramConfig(reportType);
    setForm({
      programName: d.programName,
      institutionName: d.institutionName,
      unitName: d.unitName,
      logo: d.logo,
      goal: d.goal,
      traffic: { ...d.traffic },
      executiveBaseText: d.executiveBaseText,
      officialIndicators: [...d.officialIndicators],
      descriptiveVariables: [...d.descriptiveVariables],
    });
    setSaved(false);
  };

  const label = 'block text-sm font-semibold text-slate-700';
  const input =
    'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">⚙️ Configuración del programa</h2>
          <p className="mt-1 text-sm text-slate-500">
            {initial.programName} · los cambios se aplican a los próximos reportes de este programa.
          </p>
        </div>
        <button className="btn-ghost shrink-0" onClick={onBack}>
          ← Volver
        </button>
      </div>

      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">Identidad</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre del programa</label>
            <input className={input} value={form.programName} onChange={(e) => set('programName', e.target.value)} />
          </div>
          <div>
            <label className={label}>Meta institucional (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              className={input}
              value={form.goal}
              onChange={(e) => set('goal', Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Nombre de la institución</label>
            <input className={input} value={form.institutionName} onChange={(e) => set('institutionName', e.target.value)} />
          </div>
          <div>
            <label className={label}>Nombre de la unidad</label>
            <input className={input} value={form.unitName} onChange={(e) => set('unitName', e.target.value)} />
          </div>
          <div>
            <label className={label}>Logo institucional (emoji o URL)</label>
            <input className={input} value={form.logo} onChange={(e) => set('logo', e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Ej.: 🛏️ · 🏥 · o una URL de imagen.</p>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">Colores del semáforo</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {(['verde', 'amarillo', 'rojo'] as const).map((k) => (
            <div key={k}>
              <label className={`${label} capitalize`}>{k}</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200"
                  value={form.traffic[k]}
                  onChange={(e) => set('traffic', { ...form.traffic, [k]: e.target.value })}
                />
                <input
                  className={input}
                  value={form.traffic[k]}
                  onChange={(e) => set('traffic', { ...form.traffic, [k]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">Resumen ejecutivo</h3>
        <div>
          <label className={label}>Texto base del resumen ejecutivo</label>
          <textarea
            rows={3}
            className={input}
            value={form.executiveBaseText}
            onChange={(e) => set('executiveBaseText', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">Preámbulo institucional que encabeza el resumen del programa.</p>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h3 className="text-base font-bold text-slate-800">Indicadores y variables</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Indicadores oficiales (uno por línea)</label>
            <textarea
              rows={8}
              className={`${input} font-mono text-xs`}
              value={toLines(form.officialIndicators)}
              onChange={(e) => set('officialIndicators', fromLines(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Variables descriptivas (una por línea)</label>
            <textarea
              rows={8}
              className={`${input} font-mono text-xs`}
              value={toLines(form.descriptiveVariables)}
              onChange={(e) => set('descriptiveVariables', fromLines(e.target.value))}
            />
            <p className="mt-1 text-xs text-slate-400">No forman parte del cumplimiento (p. ej. prevalencia de LPP).</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={handleSave}>
          💾 Guardar configuración
        </button>
        <button className="btn-ghost" onClick={handleReset}>
          ↺ Restablecer valores por defecto
        </button>
        {saved && <span className="text-sm font-semibold text-green-600">✓ Configuración guardada</span>}
      </div>
    </div>
  );
}
