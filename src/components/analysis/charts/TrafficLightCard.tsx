import type { AnalysisResult } from '../../../types';
import type { TrafficColors } from '../../../config/programs';
import { PALETTE, trafficLightFor } from '../../../utils/palette';

/** Tarjeta visual de semáforo de cumplimiento. Los colores pueden configurarse por programa. */
export default function TrafficLightCard({ a, colors }: { a: AnalysisResult; colors?: TrafficColors }) {
  const light = trafficLightFor(a.global.percent, a.config.goal);
  const c = colors ?? { verde: PALETTE.green, amarillo: PALETTE.amber, rojo: PALETTE.red };

  const lights: { key: 'rojo' | 'amarillo' | 'verde'; color: string; label: string }[] = [
    { key: 'rojo', color: c.rojo, label: 'Bajo la meta' },
    { key: 'amarillo', color: c.amarillo, label: 'Cercano a la meta' },
    { key: 'verde', color: c.verde, label: 'Cumple la meta' },
  ];
  const active = lights.find((l) => l.key === light)!;

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center gap-5">
        {/* Carcasa del semáforo */}
        <div className="flex flex-col gap-2.5 rounded-2xl bg-slate-800 p-3">
          {lights.map((l) => {
            const on = l.key === light;
            return (
              <span
                key={l.key}
                className="h-8 w-8 rounded-full transition"
                style={{
                  backgroundColor: on ? l.color : '#475569',
                  opacity: on ? 1 : 0.28,
                  boxShadow: on ? `0 0 14px ${l.color}` : 'none',
                }}
              />
            );
          })}
        </div>
        <div>
          <p className="text-2xl font-extrabold" style={{ color: active.color }}>
            {active.label}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cumplimiento global de <strong className="text-slate-700">{a.global.percent}%</strong> frente a una meta de{' '}
            <strong className="text-slate-700">{a.config.goal}%</strong>.
          </p>
        </div>
      </div>

      {/* Barra de progreso hacia la meta */}
      <div className="mt-5">
        <div className="h-2.5 w-full rounded-full" style={{ backgroundColor: PALETTE.gray }}>
          <div
            className="h-2.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, a.global.percent)}%`, backgroundColor: active.color }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-slate-400">
          <span>0%</span>
          <span style={{ color: PALETTE.blue }}>Meta {a.config.goal}%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
