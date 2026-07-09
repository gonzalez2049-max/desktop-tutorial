import type { ClinicalCharacterization } from '../../types';

/**
 * Caracterización clínica de la base (NT 234 / LPP): total original, registros
 * incluidos/excluidos por riesgo y prevalencia de LPP.
 */
export default function CharacterizationSection({ c }: { c: ClinicalCharacterization }) {
  const stats: { label: string; value: string; hint?: string; color?: string }[] = [
    { label: 'Pacientes auditados', value: String(c.totalOriginal) },
    {
      label: 'Pacientes incluidos (moderado + alto)',
      value: String(c.includedByRisk),
      hint: 'Base del cálculo de cumplimiento',
      color: 'text-nex-700',
    },
    {
      label: 'Pacientes excluidos (sin/bajo riesgo)',
      value: String(c.excludedByRisk),
      hint: c.riskFilterApplied ? undefined : 'Sin filtro de riesgo aplicado',
      color: 'text-slate-500',
    },
    { label: 'Pacientes con LPP', value: c.lppPositive !== null ? String(c.lppPositive) : '—', color: 'text-amber-600' },
    {
      label: '% pacientes con LPP',
      value: c.lppPrevalence !== null ? `${c.lppPrevalence}%` : '—',
      hint: c.lppAnswered !== null ? `de ${c.lppAnswered} evaluados` : undefined,
      color: 'text-amber-600',
    },
  ];

  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🧬 Caracterización clínica</h3>
        <p className="mt-0.5 text-sm text-slate-400">
          {c.riskFilterApplied
            ? 'El cumplimiento se calcula solo sobre pacientes de riesgo moderado y alto (NT 234 / LPP).'
            : 'Resumen de la base analizada.'}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 p-4">
            <p className={`text-2xl font-extrabold ${s.color ?? 'text-slate-800'}`}>{s.value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
            {s.hint && <p className="mt-0.5 text-[11px] text-slate-400">{s.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
