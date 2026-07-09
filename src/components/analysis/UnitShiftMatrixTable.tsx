import type { UnitShiftMatrix } from '../../types';
import { complianceHex } from '../../utils/palette';

/** Matriz de cumplimiento por turno dentro de cada unidad. */
export default function UnitShiftMatrixTable({ matrix, goal }: { matrix: UnitShiftMatrix; goal: number }) {
  if (matrix.rows.length === 0 || matrix.shifts.length === 0) return null;

  const cell = (value: number | null) => {
    if (value === null) return <span className="text-slate-300">—</span>;
    return (
      <span className="font-semibold" style={{ color: complianceHex(value, goal) }}>
        {value}%
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3 font-semibold">Unidad</th>
            {matrix.shifts.map((s) => (
              <th key={s} className="py-2 px-3 text-center font-semibold">
                {s}
              </th>
            ))}
            <th className="py-2 pl-3 text-center font-semibold">Unidad (global)</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.unit} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-3 font-medium text-slate-700">{r.unit}</td>
              {matrix.shifts.map((s) => (
                <td key={s} className="py-2.5 px-3 text-center">
                  {cell(r.byShift[s])}
                </td>
              ))}
              <td className="py-2.5 pl-3 text-center">
                <span className="font-bold" style={{ color: complianceHex(r.overall, goal) }}>
                  {r.overall}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
