import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  icon?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/** Contenedor de tarjeta con encabezado para los gráficos (fondo blanco, bordes suaves). */
export default function ChartCard({ title, icon, subtitle, children, className = '' }: ChartCardProps) {
  return (
    <section className={`card p-5 ${className}`}>
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
          {icon && <span>{icon}</span>}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
