// Utilidades de agrupación temporal (mensual / trimestral / semestral / anual).
import { normalize } from './columnDetection';

export type Granularity = 'mensual' | 'trimestral' | 'semestral' | 'anual';

/** Orden de las fechas numéricas: día/mes/año o mes/día/año. */
export type DateOrder = 'dmy' | 'mdy';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Detecta el orden de las fechas numéricas (dd/mm/aa vs mm/dd/aa) mirando toda
 * la columna: si algún valor tiene el primer campo > 12 es día (dmy); si el
 * segundo campo > 12 es día (mdy). En caso de empate/ambigüedad usa dd/mm (es).
 */
export function detectDateOrder(values: unknown[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    if (v instanceof Date) continue;
    const s = String(v ?? '').trim();
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.]\d{2,4}/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) dmy++;
    else if (b > 12 && a <= 12) mdy++;
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

/** Extrae { año, mes } de un valor de fecha. mes va de 1 a 12. */
export function parseYearMonth(value: unknown, order: DateOrder = 'dmy'): { year: number; month: number } | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  }
  const s = String(value ?? '').trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD / YYYY/MM
  const iso = s.match(/(\d{4})[/\-.](\d{1,2})/);
  if (iso) return { year: Number(iso[1]), month: Math.min(12, Math.max(1, Number(iso[2]))) };

  // dd/mm/aaaa o mm/dd/aaaa según el orden detectado.
  const num = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (num) {
    const month = order === 'mdy' ? Number(num[1]) : Number(num[2]);
    const year = num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]);
    return { year, month: Math.min(12, Math.max(1, month)) };
  }

  // Nombre de mes + año (p. ej. "Marzo 2026", "mar-26")
  const norm = normalize(s);
  const idx = MONTHS.findIndex((m) => norm.includes(m));
  if (idx >= 0) {
    const y = norm.match(/\b(\d{4})\b/) ?? norm.match(/\b(\d{2})\b/);
    if (y) {
      const yy = y[1].length === 2 ? 2000 + Number(y[1]) : Number(y[1]);
      return { year: yy, month: idx + 1 };
    }
  }
  return null;
}

/** Clave ordenable del período según la granularidad. */
export function periodKey(value: unknown, gran: Granularity, order: DateOrder = 'dmy'): string | null {
  const ym = parseYearMonth(value, order);
  if (!ym) return null;
  const { year, month } = ym;
  switch (gran) {
    case 'mensual':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'trimestral':
      return `${year}-Q${Math.ceil(month / 3)}`;
    case 'semestral':
      return `${year}-S${month <= 6 ? 1 : 2}`;
    case 'anual':
      return `${year}`;
  }
}

/** Etiqueta legible a partir de la clave de período. */
export function periodLabel(key: string, gran: Granularity): string {
  switch (gran) {
    case 'mensual': {
      const [y, m] = key.split('-');
      const name = MONTHS_LONG[Number(m) - 1] ?? m;
      return `${name.charAt(0).toUpperCase() + name.slice(1)} ${y}`;
    }
    case 'trimestral': {
      const [y, q] = key.split('-');
      return `${q} ${y}`;
    }
    case 'semestral': {
      const [y, s] = key.split('-');
      return `${s === 'S1' ? '1.er' : '2.º'} semestre ${y}`;
    }
    case 'anual':
      return key;
  }
}
