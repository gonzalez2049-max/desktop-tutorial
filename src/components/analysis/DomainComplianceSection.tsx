import type { DomainComplianceRow } from '../../utils/domains';

interface Props {
  rows: DomainComplianceRow[];
  goal: number;
}

function barColor(percent: number, goal: number): string {
  if (percent >= goal) return '#16a34a';
  if (percent >= goal - 10) return '#d97706';
  return '#dc2626';
}

/** Cumplimiento oficial por dominio clínico (obligatorios) + % complementario aparte. */
export default function DomainComplianceSection({ rows, goal }: Props) {
  return (
    <section className="card p-5">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🧩 Cumplimiento por dominio</h3>
        <p className="mt-0.5 text-sm text-slate-400">Cumplimiento oficial (solo obligatorios) agrupado por dominio clínico. El % complementario se informa aparte.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 font-semibold">Dominio</th>
              <th className="py-2 px-3 text-center font-semibold">Cumple</th>
              <th className="py-2 px-3 text-center font-semibold">No cumple</th>
              <th className="py-2 px-3 font-semibold">Cumplimiento oficial</th>
              <th className="py-2 px-3 text-center font-semibold">Complementarios</th>
              <th className="py-2 pl-3 text-center font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const color = barColor(r.percent, goal);
              const noData = r.aplicables === 0;
              return (
                <tr key={r.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{r.label}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{r.cumple}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{r.noCumple}</td>
                  <td className="py-2.5 px-3">
                    {noData ? (
                      <span className="text-slate-400">sin datos</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 flex-1 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full" style={{ width: `${r.percent}%`, backgroundColor: color }} />
                        </div>
                        <span className="w-12 text-right font-semibold" style={{ color }}>{r.percent}%</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-500">{r.complementaryPercent === null ? '—' : `${r.complementaryPercent}%`}</td>
                  <td className="py-2.5 pl-3 text-center">
                    {noData ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.meetsGoal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.meetsGoal ? 'Cumple' : 'Bajo meta'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
