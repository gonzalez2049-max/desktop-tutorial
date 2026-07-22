interface ModuleIconProps {
  icon: string;
  /** Tamaño en px (para imagen); el emoji usa la clase de texto. */
  size?: number;
  className?: string;
}

/** Muestra el icono de un módulo: emoji (texto) o imagen (data URI). */
export default function ModuleIcon({ icon, size = 30, className }: ModuleIconProps) {
  if (icon.startsWith('data:')) {
    return <img src={icon} alt="" className={className} style={{ height: size, width: size, objectFit: 'contain' }} />;
  }
  return <span className={className} style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
}
