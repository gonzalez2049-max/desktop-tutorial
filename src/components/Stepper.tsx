export interface Step {
  key: string;
  label: string;
}

interface StepperProps {
  steps: Step[];
  current: number;
}

/** Indicador de progreso del asistente paso a paso. */
export default function Stepper({ steps, current }: StepperProps) {
  return (
    <nav className="flex items-center gap-2 no-print" aria-label="Progreso">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition',
                  active ? 'bg-nex-600 text-white' : done ? 'bg-nex-100 text-nex-700' : 'bg-slate-200 text-slate-500',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={['hidden sm:block text-sm font-medium', active ? 'text-nex-700' : 'text-slate-500'].join(' ')}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-4 sm:w-8 bg-slate-200" />}
          </div>
        );
      })}
    </nav>
  );
}
