// Utilidades de agrupación temporal (mensual / trimestral / semestral / anual).
import { normalize } from './columnDetection';

export type Granularity = 'mensual' | 'trimestral' | 'semestral' | 'anual';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Extrae { año, mes } de un valor de fecha. mes va de 1 a 12. */
export function parseYearMonth(value: unknown): { year: number; month: number } | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  }
  const s = String(value ?? '').trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD / YYYY/MM
  const iso = s.match(/(\d{4})[/\-.](\d{1,2})/);
  if (iso) return { year: Number(iso[1]), month: Math.min(12, Math.max(1, Number(iso[2]))) };

  // dd/mm/yyyy
  const dmy = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return { year, month: Math.min(12, Math.max(1, Number(dmy[2]))) };
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
export function periodKey(value: unknown, gran: Granularity): string | null {
  const ym = parseYearMonth(value);
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
