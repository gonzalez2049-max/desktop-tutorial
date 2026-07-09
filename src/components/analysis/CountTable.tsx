import type { GroupCount } from '../../types';

interface CountTableProps {
  groups: GroupCount[];
  firstHeader: string;
  total: number;
}

/** Tabla simple de conteo de registros por categoría (total por unidad / turno). */
export default function CountTable({ groups, firstHeader, total }: CountTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3 font-semibold">{firstHeader}</th>
            <th className="py-2 px-3 text-right font-semibold">Registros</th>
            <th className="py-2 pl-3 text-right font-semibold">% del total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium text-slate-700">{g.label}</td>
              <td className="py-2 px-3 text-right text-slate-600">{g.count}</td>
              <td className="py-2 pl-3 text-right text-slate-400">{total ? Math.round((g.count / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
