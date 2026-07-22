import { useId } from 'react';

interface NexLogoProps {
  /** Alto/ancho del logo en px. */
  size?: number;
  className?: string;
}

/**
 * Marca «NEX Report»: un nexo de nodos conectados (idea de conexión / «nexus»),
 * en degradado índigo→violeta→fucsia con un nodo cian de acento. Vector (SVG)
 * con fondo TRANSPARENTE, nítido a cualquier tamaño y adaptable a fondos claros
 * u oscuros.
 */
export default function NexLogo({ size = 36, className }: NexLogoProps) {
  const uid = useId();
  const grad = `nexNode-${uid}`;
  const line = `nexLine-${uid}`;
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
        <radialGradient id={grad} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#8b7cff" />
          <stop offset="0.6" stopColor="#a21caf" />
          <stop offset="1" stopColor="#7a1690" />
        </radialGradient>
        <linearGradient id={line} x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c6df8" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Enlaces desde el nodo central hacia los satélites. */}
      <g stroke={`url(#${line})`} strokeWidth="3" strokeLinecap="round">
        <line x1="24" y1="24" x2="11.5" y2="11.5" />
        <line x1="24" y1="24" x2="36.5" y2="11.5" />
        <line x1="24" y1="24" x2="11.5" y2="36.5" />
        <line x1="24" y1="24" x2="36.5" y2="36.5" />
      </g>
      {/* Nodos satélite. */}
      <circle cx="11.5" cy="11.5" r="3.6" fill="#7c6df8" />
      <circle cx="36.5" cy="11.5" r="3.6" fill="#ec4899" />
      <circle cx="11.5" cy="36.5" r="3.6" fill="#b04ce0" />
      <circle cx="36.5" cy="36.5" r="4" fill="#22d3ee" />
      {/* Nodo central. */}
      <circle cx="24" cy="24" r="6.6" fill={`url(#${grad})`} />
      <circle cx="21.8" cy="21.8" r="1.7" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
