interface BackBarProps {
  onBack: () => void;
  onHome: () => void;
  /** Oculta «Volver atrás» si no hay pantalla anterior. */
  canBack: boolean;
  /** Muestra «Volver al inicio» (por defecto sí, salvo que ya estemos en el inicio). */
  showHome?: boolean;
}

/**
 * Barra de navegación consistente (arriba a la izquierda) presente en todas las
 * pantallas. «Volver atrás» regresa a la pantalla anterior real conservando el
 * estado; «Volver al inicio» lleva al selector de programas.
 */
export default function BackBar({ onBack, onHome, canBack, showHome = true }: BackBarProps) {
  if (!canBack && !showHome) return null;
  return (
    <div className="mb-4 flex items-center gap-2">
      {canBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-nex-300 hover:text-nex-700"
        >
          ← Volver atrás
        </button>
      )}
      {showHome && (
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-400 transition hover:text-nex-700"
        >
          🏠 Volver al inicio
        </button>
      )}
    </div>
  );
}
