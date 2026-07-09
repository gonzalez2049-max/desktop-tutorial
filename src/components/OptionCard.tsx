interface OptionCardProps {
  label: string;
  description?: string;
  icon?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Tarjeta seleccionable usada en las preguntas del asistente. */
export default function OptionCard({ label, description, icon, selected, disabled, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'text-left rounded-2xl border p-4 transition w-full',
        selected ? 'border-nex-500 bg-nex-50 ring-2 ring-nex-200' : 'border-slate-200 bg-white hover:border-nex-300 hover:bg-slate-50',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="text-2xl leading-none">{icon}</span>}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-800">{label}</span>
            <span
              className={[
                'flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
                selected ? 'border-nex-500 bg-nex-500 text-white' : 'border-slate-300 text-transparent',
              ].join(' ')}
            >
              ✓
            </span>
          </div>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
    </button>
  );
}
