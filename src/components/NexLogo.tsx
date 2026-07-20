import logoUrl from '../assets/nex-logo.png';

interface NexLogoProps {
  /** Alto del logo en px (el ancho se ajusta manteniendo la proporción). */
  size?: number;
  className?: string;
}

/**
 * Marca «N» de NEX Report: el logo original (cinta entrelazada en verde con el
 * punto) con fondo TRANSPARENTE, por lo que se adapta a cualquier fondo.
 */
export default function NexLogo({ size = 36, className }: NexLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="NEX Report"
      className={className}
      style={{ height: size, width: 'auto' }}
      draggable={false}
    />
  );
}
