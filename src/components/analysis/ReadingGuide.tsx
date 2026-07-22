import type { AnalysisResult } from '../../types';
import { trafficLightFor } from '../../utils/palette';

/**
 * Guía didáctica de lectura del resultado global: traduce el % de cumplimiento
 * a un lenguaje simple (estado, brecha respecto de la meta y qué hacer) y
 * explica cómo se calcula y qué significa cada color del semáforo. Pensada para
 * quien no domina la estadística.
 */
export default function ReadingGuide({ a }: { a: AnalysisResult }) {
  const pct = a.global.percent;
  const goal = a.config.goal;
  const light = trafficLightFor(pct, goal);
  const gap = Math.round(Math.abs(goal - pct) * 10) / 10;

  const state =
    light === 'verde'
      ? {
          emoji: '🟢',
          title: 'Cumple la meta',
          box: 'border-green-200 bg-green-50',
          strong: 'text-green-800',
          msg: `Con ${pct}% alcanzas o superas la meta de ${goal}%. Mantén el estándar y vigila que no baje en los próximos períodos.`,
        }
      : light === 'amarillo'
        ? {
            emoji: '🟡',
            title: 'En observación',
            box: 'border-amber-200 bg-amber-50',
            strong: 'text-amber-800',
            msg: `Con ${pct}% estás a ${gap} punto(s) de la meta de ${goal}%. Estás cerca: refuerza los indicadores más bajos para cerrar la brecha.`,
          }
        : {
            emoji: '🔴',
            title: 'Crítico',
            box: 'border-red-200 bg-red-50',
            strong: 'text-red-800',
            msg: `Con ${pct}% estás ${gap} punto(s) bajo la meta de ${goal}%. Requiere un plan de mejora enfocado en los indicadores críticos.`,
          };

  return (
    <section className="card p-5">
      <header className="mb-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">🧭 ¿Cómo leer este resultado?</h3>
        <p className="mt-0.5 text-sm text-slate-400">Una lectura en simple del cumplimiento global y del semáforo.</p>
      </header>

      <div className={`flex items-start gap-3 rounded-xl border p-4 ${state.box}`}>
        <span className="text-2xl leading-none" aria-hidden>{state.emoji}</span>
        <p className="text-sm leading-relaxed text-slate-700">
          <span className={`font-bold ${state.strong}`}>{state.title}.</span> {state.msg}
        </p>
      </div>

      <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-slate-600">
        <li>🧮 <strong>Cómo se calcula:</strong> % de cumplimiento = (casos que cumplen ÷ total evaluado) × 100. Los «No aplica» no penalizan.</li>
        <li><span className="font-semibold text-green-700">🟢 Verde</span> — igual o sobre la meta (≥ {goal}%).</li>
        <li><span className="font-semibold text-amber-700">🟡 Amarillo</span> — cerca de la meta (entre {Math.max(goal - 10, 0)}% y {goal}%).</li>
        <li><span className="font-semibold text-red-700">🔴 Rojo</span> — bajo {Math.max(goal - 10, 0)}%: brecha importante.</li>
      </ul>
    </section>
  );
}
