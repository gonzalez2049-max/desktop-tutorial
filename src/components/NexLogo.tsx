interface NexLogoProps {
  size?: number;
  className?: string;
  /** id único del degradado (evita colisiones si hay varios logos en la página). */
  gradientId?: string;
}

/**
 * Monograma «N» de NEX Report: cinta geométrica en verde con degradado (aspecto
 * innovador) y fondo TRANSPARENTE, por lo que se adapta a cualquier fondo (claro
 * u oscuro). Sustituye a la antigua «N» en caja azul.
 */
export default function NexLogo({ size = 36, className, gradientId = 'nexLogoGrad' }: NexLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="NEX Report"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="18" y1="10" x2="46" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="0.5" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      {/* Cinta en «N»: dos postes + diagonal, con uniones suavizadas. */}
      <path
        d="M14 50 V14 h9 l18 22 V14 h9 v36 h-9 L23 30 v20 z"
        fill={`url(#${gradientId})`}
        strokeLinejoin="round"
      />
      {/* Punto/acento superior derecho (como el logo original). */}
      <circle cx="54" cy="12" r="4.2" fill="#6ee7b7" />
    </svg>
  );
}
