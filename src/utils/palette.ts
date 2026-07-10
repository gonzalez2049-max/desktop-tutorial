// Paleta institucional de NEX Report, compartida por las exportaciones PDF y Word.

export const PALETTE = {
  green: '#66BB6A', // cumplimiento
  amber: '#F59E0B', // observación
  red: '#EF4444', // crítico
  blue: '#1E3A8A', // azul institucional
  ink: '#1E293B', // texto principal
  muted: '#64748B', // texto secundario
  line: '#E2E8F0', // bordes suaves
  gray: '#E5E7EB', // gris institucional (no aplica / neutro)
  soft: '#F8FAFC', // fondos muy tenues
  white: '#FFFFFF',
};

export type TrafficLight = 'verde' | 'amarillo' | 'rojo';

/** Colores del semáforo (verde / amarillo / rojo); configurables por programa. */
export interface TrafficColors {
  verde: string;
  amarillo: string;
  rojo: string;
}

const DEFAULT_TRAFFIC: TrafficColors = { verde: PALETTE.green, amarillo: PALETTE.amber, rojo: PALETTE.red };

/** Color de cumplimiento según el % respecto de la meta. */
export function complianceHex(percent: number, goal: number, colors: TrafficColors = DEFAULT_TRAFFIC): string {
  if (percent >= goal) return colors.verde;
  if (percent >= goal - 10) return colors.amarillo;
  return colors.rojo;
}

/** Estado del semáforo según el % respecto de la meta. */
export function trafficLightFor(percent: number, goal: number): TrafficLight {
  if (percent >= goal) return 'verde';
  if (percent >= goal - 10) return 'amarillo';
  return 'rojo';
}

/** Etiqueta legible del semáforo. */
export function trafficLabel(light: TrafficLight): string {
  return light === 'verde' ? 'Cumple la meta' : light === 'amarillo' ? 'En observación' : 'Crítico';
}

/** Color hex del semáforo. */
export function trafficHex(light: TrafficLight, colors: TrafficColors = DEFAULT_TRAFFIC): string {
  return light === 'verde' ? colors.verde : light === 'amarillo' ? colors.amarillo : colors.rojo;
}

/** Convierte un hex (#RRGGBB) a tupla RGB para jsPDF. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Hex sin '#', como lo requiere docx. */
export function bare(hex: string): string {
  return hex.replace('#', '');
}
