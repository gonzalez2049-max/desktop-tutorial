// Clasificación clínica de las Lesiones por Presión (LPP) por estadio/categoría.
import { normalize } from './columnDetection';

/** Categorías oficiales de clasificación de LPP. */
export const LPP_STAGES = [
  'Estadio I',
  'Estadio II',
  'Estadio III',
  'Estadio IV',
  'No clasificable',
  'Sospecha de lesión de tejido profundo',
  'LPP asociada a dispositivos médicos',
  'Lesión de mucosas',
] as const;

export type LppStage = (typeof LPP_STAGES)[number];

/**
 * Clasifica el valor de una celda en una categoría de LPP.
 * Tolera abreviaturas y variantes ("Estadio 2", "EII", "LTP", "dispositivo").
 */
export function classifyLppStage(value: unknown): LppStage | null {
  const n = normalize(value);
  if (!n) return null;

  if (n.includes('mucosa')) return 'Lesión de mucosas';
  if (n.includes('dispositivo')) return 'LPP asociada a dispositivos médicos';
  if (n.includes('tejido profundo') || n.includes('sospecha') || /\bltp\b/.test(n) || /\bstlp\b/.test(n)) {
    return 'Sospecha de lesión de tejido profundo';
  }
  if (n.includes('no clasificable') || n.includes('inclasificable') || n.includes('no clasif')) return 'No clasificable';

  // Estadios (romano o arábigo). \b evita que "iii" active "ii", etc.
  if (/\b(iv|4)\b/.test(n)) return 'Estadio IV';
  if (/\b(iii|3)\b/.test(n)) return 'Estadio III';
  if (/\b(ii|2)\b/.test(n)) return 'Estadio II';
  if (/\b(i|1)\b/.test(n)) return 'Estadio I';

  return null;
}

/** ¿El encabezado sugiere una columna de clasificación / estadio de LPP? */
export function isLppStageColumn(header: unknown): boolean {
  const n = normalize(header);
  if (!n) return false;
  if (n.includes('estadio')) return true;
  const lppish = n.includes('lpp') || n.includes('lesion por presion') || n.includes('lesion');
  return lppish && (n.includes('clasif') || n.includes('tipo') || n.includes('categoria') || n.includes('grado'));
}
