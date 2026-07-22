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
        'hero-gradient relative overflow-hidden rounded-3xl text-white shadow-lift',
        compact ? 'px-6 py-6 sm:px-8' : 'px-6 py-10 text-center sm:px-10 sm:py-12',
        className,
      ].join(' ')}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-aqua-300/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', backgroundSize: '22px 22px' }}
        />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
