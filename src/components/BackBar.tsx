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
    // Barra fija bajo el encabezado: «Volver atrás» siempre visible al hacer
    // scroll, arriba a la izquierda, en todas las pantallas.
    <div className="sticky top-[60px] z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-slate-200/50 bg-white/70 px-4 py-2 backdrop-blur sm:top-[64px]">
      <button
        type="button"
        onClick={onBack}
        disabled={!canBack}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-nex-300 hover:text-nex-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Volver atrás
      </button>
      {showHome && (
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:text-nex-700"
        >
          🏠 Volver al inicio
        </button>
      )}
      {/* Sello de confianza: procesamiento 100% local (relevante en salud). */}
      <span
        title="Tus datos se procesan en tu navegador; no se suben a ningún servidor."
        className="ml-auto hidden items-center gap-1.5 rounded-full border border-nex-200 bg-nex-50 px-3 py-1 text-xs font-semibold text-nex-700 sm:inline-flex"
      >
        🔒 100% local
      </span>
    </div>
  );
}
