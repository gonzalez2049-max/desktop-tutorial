import type { ParsedWorkbook } from '../../types';
import { OTROS_COL_TYPES, type OtrosColType } from '../../utils/otros/types';

interface Props {
  workbook: ParsedWorkbook;
  mapping: Record<string, OtrosColType>;
  onChange: (mapping: Record<string, OtrosColType>) => void;
}

const TYPE_BADGE: Record<OtrosColType, string> = {
  resultado: 'bg-green-100 text-green-700',
  fecha: 'bg-blue-100 text-blue-700',
  numerica: 'bg-violet-100 text-violet-700',
  categoria: 'bg-amber-100 text-amber-700',
  unidad: 'bg-teal-100 text-teal-700',
  texto: 'bg-slate-100 text-slate-500',
  ignorar: 'bg-slate-100 text-slate-400',
};

/** Detección + corrección manual del tipo de cada columna. */
export default function OtrosMapping({ workbook, mapping, onChange }: Props) {
  const sample = (h: string) => workbook.rows.slice(0, 3).map((r) => r[h]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String).join(' · ') || '—';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">Columna</th>
            <th className="py-2 pr-3">Ejemplos</th>
            <th className="py-2 pr-3">Tipo detectado</th>
            <th className="py-2">Corregir tipo</th>
          </tr>
        </thead>
        <tbody>
          {workbook.headers.map((h) => {
            const t = mapping[h] ?? 'texto';
            return (
              <tr key={h} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 font-medium text-slate-700">{h}</td>
                <td className="py-2 pr-3 text-slate-400">{sample(h)}</td>
                <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE[t]}`}>{OTROS_COL_TYPES.find((x) => x.value === t)?.label}</span></td>
                <td className="py-2">
                  <select
                    value={t}
                    onChange={(e) => onChange({ ...mapping, [h]: e.target.value as OtrosColType })}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-nex-500 focus:outline-none focus:ring-2 focus:ring-nex-200"
                  >
                    {OTROS_COL_TYPES.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
