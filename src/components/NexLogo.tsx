import { useId } from 'react';

interface NexLogoProps {
  /** Alto/ancho del logo en px. */
  size?: number;
  className?: string;
}

/**
 * Marca «NEX Report»: monograma «N» con un trazo ascendente que sugiere
 * progreso y «next», en degradado índigo→violeta→fucsia (identidad Aurora), con
 * una chispa cian de innovación. Vector (SVG) con fondo transparente, nítido a
 * cualquier tamaño y adaptable a fondos claros u oscuros.
 */
export default function NexLogo({ size = 36, className }: NexLogoProps) {
  const uid = useId();
  const grad = `nexGrad-${uid}`;
  const glow = `nexGlow-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="NEX Report"
      className={className}
    >
      <defs>
        <linearGradient id={grad} x1="8" y1="42" x2="40" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b3df0" />
          <stop offset="0.52" stopColor="#a21caf" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#22d3ee" />
        </radialGradient>
      </defs>
      {/* Monograma «N»: trazo ascendente (progreso / next). */}
      <path
        d="M11 37.5 V13 L37 37.5 V16"
        stroke={`url(#${grad})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Chispa cian de innovación, en la punta superior derecha. */}
      <circle cx="39.4" cy="9.4" r="4.1" fill={`url(#${glow})`} />
      <circle cx="39.4" cy="9.4" r="4.1" fill="#22d3ee" opacity="0.25" />
    </svg>
  );
}
