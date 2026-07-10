import type { ClinicalCharacterization } from '../../types';

/**
 * Caracterización clínica de la base (NT 234 / LPP): total, desglose por riesgo,
 * incluidos/excluidos y prevalencia de LPP.
 */
export default function CharacterizationSection({ c }: { c: ClinicalCharacterization }) {
  // NT 234 exige columna de riesgo para determinar incluidos/excluidos.
  const riskMissing = !c.riskColumnDetected;
  const noRiskPatients = c.riskColumnDetected && c.highRisk + c.moderateRisk === 0;

  const stats: { label: string; value: string; hint?: string; color?: string }[] = [
    { label: 'Pacientes auditados', value: String(c.totalOriginal) },
    { label: 'Pacientes con riesgo alto', value: String(c.highRisk), color: 'text-red-600' },
    { label: 'Pacientes con riesgo moderado', value: String(c.moderateRisk), color: 'text-amber-600' },
    {
      label: 'Pacientes incluidos',
      value: c.includedByRisk !== null ? String(c.includedByRisk) : 'No determinado',
      hint:
        c.includedByRisk !== null
          ? 'Base del cálculo de cumplimiento NT 234'
          : 'Debe seleccionar la columna de riesgo en Revisar columnas',
      color: c.includedByRisk !== null ? 'text-nex-700' : 'text-slate-400',
    },
    {
      label: 'Pacientes excluidos',
      value: c.excludedByRisk !== null ? String(c.excludedByRisk) : 'No determinado',
      hint:
        c.excludedByRisk !== null
          ? c.riskFilterApplied
            ? 'Sin riesgo · bajo · no informado · vacío'
            : 'Sin filtro de riesgo aplicado'
          : 'Debe seleccionar la columna de riesgo en Revisar columnas',
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

  const pctIncluidos =
    c.includedByRisk !== null && c.totalOriginal > 0 ? Number(((c.includedByRisk / c.totalOriginal) * 100).toFixed(1)) : 0;

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

      {riskMissing && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ No se ha seleccionado la columna de riesgo. <strong>Debe seleccionar la columna de riesgo en Revisar columnas</strong>{' '}
          para determinar los pacientes incluidos y calcular el cumplimiento NT 234.
        </div>
      )}

      {noRiskPatients && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          🚨 No se detectaron pacientes de riesgo alto o moderado. Revise la columna de riesgo.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 p-4">
            <p className={`text-2xl font-extrabold ${s.color ?? 'text-slate-800'}`}>{s.value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
            {s.hint && <p className="mt-0.5 text-[11px] text-slate-400">{s.hint}</p>}
          </div>
        ))}
      </div>

      {c.riskFilterApplied && c.includedByRisk !== null && (
        <p className="mt-4 rounded-xl bg-nex-50 px-4 py-3 text-sm text-nex-800">
          El cumplimiento de la NT 234 se calculó sobre <strong>{c.includedByRisk}</strong> pacientes con riesgo moderado y alto,
          correspondientes al <strong>{pctIncluidos}%</strong> del total de pacientes auditados.
        </p>
      )}
    </section>
  );
}
