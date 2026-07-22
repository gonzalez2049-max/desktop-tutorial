import { useState } from 'react';

interface HelpTipProps {
  /** Texto de ayuda que se muestra al pasar el cursor o tocar. */
  text: string;
  label?: string;
}

/**
 * Ícono de ayuda «?» con una burbuja explicativa. Se muestra al pasar el cursor
 * (escritorio) y al tocar (móvil), para aclarar términos sin recargar la
 * interfaz. Pensado para usuarios que no dominan la jerga clínica/estadística.
 */
export default function HelpTip({ text, label = 'Ayuda' }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-500 transition hover:border-nex-400 hover:text-nex-700"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`${open ? 'block' : 'hidden'} absolute left-1/2 top-7 z-30 w-64 max-w-[16rem] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-600 shadow-lift group-hover:block`}
      >
        {text}
      </span>
    </span>
  );
}
