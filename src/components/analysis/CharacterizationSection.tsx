import type { ClinicalCharacterization } from '../../types';

/**
 * Caracterización clínica de la base (NT 234 / LPP): total, desglose por riesgo,
 * incluidos/excluidos y prevalencia de LPP.
 */
export default function CharacterizationSection({ c }: { c: ClinicalCharacterization }) {
  const stats: { label: string; value: string; hint?: string; color?: string }[] = [
    { label: 'Pacientes auditados', value: String(c.totalOriginal) },
    { label: 'Pacientes con riesgo alto', value: String(c.highRisk), color: 'text-red-600' },
    { label: 'Pacientes con riesgo moderado', value: String(c.moderateRisk), color: 'text-amber-600' },
    {
      label: 'Pacientes incluidos',
      value: String(c.includedByRisk),
      hint: 'Base del cálculo de cumplimiento NT 234',
      color: 'text-nex-700',
    },
    {
      label: 'Pacientes excluidos',
      value: String(c.excludedByRisk),
      hint: c.riskFilterApplied ? 'Sin riesgo · bajo · no informado · vacío' : 'Sin filtro de riesgo aplicado',
      color: 'text-slate-500',
    },
    { label: 'Pacientes con LPP', value: c.lppPositive !== null ? String(c.lppPositive) : '—', color: 'text-amber-600' },
    {
      label: 'Prevalencia de LPP',
      value: c.lppPrevalence !== null ? `${c.lppPrevalence}%` : '—',
      hint: c.lppAnswered !== null ? `de ${c.lppAnswered} evaluados` : undefined,
      color: 'text-amber-600',
    },
  ];

  const pctIncluidos = c.totalOriginal > 0 ? Number(((c.includedByRisk / c.totalOriginal) * 100).toFixed(1)) : 0;

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 p-4">
            <p className={`text-2xl font-extrabold ${s.color ?? 'text-slate-800'}`}>{s.value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
            {s.hint && <p className="mt-0.5 text-[11px] text-slate-400">{s.hint}</p>}
          </div>
        ))}
      </div>

      {c.riskFilterApplied && (
        <p className="mt-4 rounded-xl bg-nex-50 px-4 py-3 text-sm text-nex-800">
          El cumplimiento de la NT 234 se calculó sobre <strong>{c.includedByRisk}</strong> pacientes con riesgo moderado y alto,
          correspondientes al <strong>{pctIncluidos}%</strong> del total de pacientes auditados.
        </p>
      )}
    </section>
  );
}
