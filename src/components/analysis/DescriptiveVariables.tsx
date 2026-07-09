import type { DescriptiveVariable } from '../../types';

/**
 * Sección de variables clínicas descriptivas / de prevalencia
 * (p. ej. "¿Tiene LPP?"). No son indicadores de cumplimiento.
 */
export default function DescriptiveVariables({ variables, totalRecords }: { variables: DescriptiveVariable[]; totalRecords: number }) {
  if (variables.length === 0) return null;

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🩺 Variables clínicas descriptivas</h3>
        <p className="mt-0.5 text-sm text-slate-400">
          Prevalencia sobre los pacientes evaluados (total de registros: {totalRecords}). No se comparan contra la meta ni cuentan como incumplimiento.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {variables.map((v) => (
          <div key={v.label} className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">{v.label}</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-extrabold text-nex-700">{v.prevalence}%</span>
              <span className="pb-1 text-sm text-slate-500">
                {v.positive} de {v.answered}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-nex-500" style={{ width: `${Math.min(100, v.prevalence)}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Positivos: <strong className="text-slate-600">{v.positive}</strong> · Negativos: {v.negative} · Respondidos: {v.answered}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
