import type { ClinicalCharacterization } from '../../types';

// Colores por categoría (escala clínica, del más leve al más severo + especiales).
const STAGE_COLORS: Record<string, string> = {
  'Estadio I': '#fbbf24',
  'Estadio II': '#f59e0b',
  'Estadio III': '#ef4444',
  'Estadio IV': '#b91c1c',
  'No clasificable': '#94a3b8',
  'Sospecha de lesión de tejido profundo': '#7c3aed',
  'LPP asociada a dispositivos médicos': '#0ea5e9',
  'Lesión de mucosas': '#ec4899',
};

/** Caracterización clínica de los pacientes con LPP: total y distribución por estadio. */
export default function LppCharacterization({ c }: { c: ClinicalCharacterization }) {
  const total = c.lppPositive ?? 0;
  if (total === 0) return null;

  const stages = [...c.lppStages].sort((a, b) => b.count - a.count);
  const staged = stages.reduce((s, x) => s + x.count, 0);
  const hasStages = staged > 0;

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🩹 Caracterización de pacientes con Lesión por Presión</h3>
        <p className="mt-0.5 text-sm text-slate-400">
          Corresponde a una caracterización clínica; no forma parte del cálculo de cumplimiento de la NT 234.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Total */}
        <div className="flex flex-col justify-center rounded-2xl bg-nex-50 p-5 text-center">
          <span className="text-4xl font-extrabold text-nex-700">{total}</span>
          <span className="mt-1 text-sm font-medium text-slate-600">pacientes con LPP</span>
          {c.lppPrevalence !== null && <span className="mt-0.5 text-xs text-slate-400">{c.lppPrevalence}% de los evaluados</span>}
        </div>

        {/* Distribución por estadio */}
        <div>
          {hasStages ? (
            <ul className="space-y-2.5">
              {stages
                .filter((s) => s.count > 0)
                .map((s) => (
                  <li key={s.stage}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700">{s.stage}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {s.count} · <span className="font-semibold text-slate-700">{s.percent}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full rounded-full bg-slate-100">
                      <div className="h-2.5 rounded-full" style={{ width: `${Math.max(2, s.percent)}%`, backgroundColor: STAGE_COLORS[s.stage] ?? '#64748b' }} />
                    </div>
                  </li>
                ))}
              {stages.some((s) => s.count === 0) && (
                <li className="pt-1 text-xs text-slate-400">
                  Sin casos: {stages.filter((s) => s.count === 0).map((s) => s.stage).join(' · ')}.
                </li>
              )}
            </ul>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
              No se registró clasificación por estadio para los pacientes con LPP.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
