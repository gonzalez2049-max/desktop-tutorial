import type { ReactNode } from 'react';

interface HeroPanelProps {
  children: ReactNode;
  /** Menos alto: para encabezados internos (admin, selector de auditorías). */
  compact?: boolean;
  className?: string;
}

/**
 * Panel hero de marca reutilizable: degradado teal-turquesa con resplandores y
 * un patrón de puntos sutil. Da identidad y profundidad a las pantallas
 * principales sin repetir el mismo bloque decorativo en cada una.
 */
export default function HeroPanel({ children, compact = false, className = '' }: HeroPanelProps) {
  return (
    <section
      className={[
        'hero-gradient relative overflow-hidden rounded-3xl text-white shadow-lift ring-1 ring-white/10',
        compact ? 'px-6 py-5 sm:px-8' : 'px-6 py-7 text-center sm:px-10',
        className,
      ].join(' ')}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-aqua-400/25 blur-3xl" />
        <div className="absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', backgroundSize: '22px 22px' }}
        />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
