import type { ColumnRole, ComplianceValue, DetectedColumn, RawRow } from '../types';

/**
 * Normaliza texto para comparación difusa: minúsculas, sin acentos,
 * sin signos de puntuación y con espacios colapsados.
 */
export function normalize(input: unknown): string {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Palabras clave por rol. La detección busca coincidencias por token
 * para no depender del nombre exacto de la columna.
 */
/**
 * Reconoce variables clínicas descriptivas / de prevalencia (no cumplimiento).
 * Ejemplos: "¿Tiene LPP?", "Con LPP", "Paciente con LPP", "Presencia de LPP".
 * Estas NO deben tratarse como indicadores de cumplimiento.
 */
export function isDescriptiveVariable(name: unknown): boolean {
  const n = normalize(name);
  if (!n) return false;
  const patterns = [
    'tiene lpp', // "¿Tiene LPP?" -> "tiene lpp"
    'con lpp', // "Con LPP" / "Paciente con LPP"
    'presencia de lpp',
    'presencia lpp',
    'presenta lpp',
    'lpp presente',
  ];
  return patterns.some((p) => n.includes(p));
}

const ROLE_KEYWORDS: Record<Exclude<ColumnRole, 'desconocido' | 'valor' | 'descriptivo'>, string[]> = {
  unidad: ['unidad', 'servicio', 'area', 'area clinica', 'sala', 'departamento', 'seccion', 'piso', 'sector', 'ubicacion'],
  turno: ['turno', 'jornada', 'horario', 'shift'],
  indicador: ['indicador', 'item', 'criterio', 'pregunta', 'variable', 'parametro', 'medida', 'estandar', 'verificacion'],
  cumplimiento: ['cumple', 'cumplimiento', 'resultado', 'evaluacion', 'estado', 'conforme', 'adherencia', 'logro'],
  fecha: ['fecha', 'mes', 'periodo', 'dia', 'date', 'anio', 'ano', 'year'],
  paciente: ['paciente', 'rut', 'ficha', 'id paciente', 'nombre', 'cama', 'identificador'],
  riesgo: ['riesgo', 'braden', 'morse', 'nivel de riesgo', 'clasificacion', 'severidad', 'gravedad'],
};

/** Devuelve un puntaje de coincidencia entre un header y un rol. */
function scoreRole(header: string, keywords: string[]): number {
  const tokens = new Set(header.split(' '));
  let best = 0;
  for (const kw of keywords) {
    if (header === kw) return 1;
    if (header.includes(kw)) best = Math.max(best, 0.85);
    // coincidencia por token individual
    for (const t of kw.split(' ')) {
      if (tokens.has(t)) best = Math.max(best, 0.7);
    }
  }
  return best;
}

/**
 * Detecta el rol semántico de cada columna combinando el nombre del header
 * con el contenido de las primeras filas (heurística de valores de cumplimiento
 * y fechas).
 */
export function detectColumns(headers: string[], rows: RawRow[]): DetectedColumn[] {
  const sample = rows.slice(0, 50);

  const detected = headers.map<DetectedColumn>((original) => {
    const norm = normalize(original);
    let bestRole: ColumnRole = 'desconocido';
    let bestScore = 0;

    (Object.keys(ROLE_KEYWORDS) as (keyof typeof ROLE_KEYWORDS)[]).forEach((role) => {
      const s = scoreRole(norm, ROLE_KEYWORDS[role]);
      if (s > bestScore) {
        bestScore = s;
        bestRole = role;
      }
    });

    // Refuerzo por contenido: si los valores parecen cumplimiento (sí/no/na),
    // priorizamos ese rol aunque el header no lo indique.
    const values = sample.map((r) => r[original]);
    const complianceHits = values.filter((v) => classifyCompliance(v) !== 'desconocido').length;
    const complianceRatio = values.length ? complianceHits / values.length : 0;
    if (complianceRatio >= 0.6 && bestScore < 0.85) {
      bestRole = 'cumplimiento';
      bestScore = Math.max(bestScore, 0.75);
    }

    // Refuerzo por contenido de fechas.
    const dateHits = values.filter((v) => looksLikeDate(v)).length;
    if (bestRole === 'desconocido' && values.length && dateHits / values.length >= 0.6) {
      bestRole = 'fecha';
      bestScore = 0.7;
    }

    // Variable clínica descriptiva (prevalencia): tiene prioridad sobre cualquier
    // otra clasificación, aunque sus valores parezcan cumplimiento (Sí/No).
    if (isDescriptiveVariable(original)) {
      return { original, role: 'descriptivo', confidence: 1 };
    }

    return { original, role: bestRole, confidence: Number(bestScore.toFixed(2)) };
  });

  // Garantiza roles únicos para dimensiones donde solo tiene sentido una columna
  // principal (nos quedamos con la de mayor confianza).
  dedupeRole(detected, 'unidad');
  dedupeRole(detected, 'turno');
  dedupeRole(detected, 'fecha');

  return detected;
}

/** Mantiene solo la columna de mayor confianza para un rol dado; el resto pasa a 'desconocido'. */
function dedupeRole(cols: DetectedColumn[], role: ColumnRole): void {
  const candidates = cols.filter((c) => c.role === role);
  if (candidates.length <= 1) return;
  candidates.sort((a, b) => b.confidence - a.confidence);
  candidates.slice(1).forEach((c) => {
    c.role = 'desconocido';
    c.confidence = 0;
  });
}

const CUMPLE_TOKENS = new Set(['cumple', 'si', 'sí', 's', 'yes', 'y', 'ok', 'conforme', 'presente', 'realizado', 'adecuado', 'true', 'verdadero', 'v', '1', '100', '100%']);
const NO_CUMPLE_TOKENS = new Set(['no cumple', 'no', 'n', 'incumple', 'no conforme', 'ausente', 'no realizado', 'inadecuado', 'false', 'falso', 'f', '0', '0%']);
const NA_TOKENS = new Set(['na', 'n a', 'no aplica', 'no aplicable', 'nc', 'sin dato', 'sin informacion', 's i', 'null', 'nulo', 'ninguno']);

/**
 * Clasifica un valor de celda como cumple / no cumple / no aplica.
 * Reconoce variantes de texto y numéricas (1/0, sí/no, etc.).
 */
export function classifyCompliance(value: unknown): ComplianceValue {
  if (value === null || value === undefined || value === '') return 'desconocido';

  // Booleanos nativos
  if (typeof value === 'boolean') return value ? 'cumple' : 'no_cumple';

  const norm = normalize(value);
  if (norm === '') return 'desconocido';

  if (NA_TOKENS.has(norm)) return 'no_aplica';
  if (CUMPLE_TOKENS.has(norm)) return 'cumple';
  if (NO_CUMPLE_TOKENS.has(norm)) return 'no_cumple';

  // "no cumple" u otras frases: revisar prefijo negativo antes que afirmativo.
  if (/^no\b/.test(norm) || norm.startsWith('incumple') || norm.startsWith('ausen')) return 'no_cumple';
  if (norm.startsWith('cumpl') || norm.startsWith('si') || norm.startsWith('conform')) return 'cumple';
  if (norm.startsWith('no aplica') || norm.startsWith('na')) return 'no_aplica';

  // Numérico: porcentajes o proporciones.
  const num = Number(String(value).replace('%', '').replace(',', '.'));
  if (!Number.isNaN(num)) {
    if (num === 1 || num === 100) return 'cumple';
    if (num === 0) return 'no_cumple';
  }

  return 'desconocido';
}

/** Nivel de riesgo clínico normalizado (para el filtrado NT 234 / LPP). */
export type RiskLevel = 'alto' | 'moderado' | 'bajo' | 'sin' | 'desconocido';

/**
 * Clasifica el nivel de riesgo de un paciente. Reconoce texto
 * (alto/moderado/bajo/sin riesgo/no informado) y puntajes de escala de Braden
 * (≤12 alto, 13-14 moderado, 15-18 bajo, ≥19 sin riesgo). Vacío = desconocido.
 */
export function classifyRisk(value: unknown): RiskLevel {
  const n = normalize(value);
  if (!n) return 'desconocido';
  if (/(no informad|no reportad|sin informacion|sin dato|desconocid|no evaluad)/.test(n)) return 'desconocido';
  if (/(muy alto|alto|alta|severo|grave|elevado)/.test(n)) return 'alto';
  if (/(moderad|medio|media|intermedi)/.test(n)) return 'moderado';
  if (/(sin riesgo|no riesgo|ningun|nulo)/.test(n)) return 'sin';
  if (/(bajo|baja|leve|minim)/.test(n)) return 'bajo';

  const num = Number(n.replace(',', '.'));
  if (!Number.isNaN(num) && num >= 6 && num <= 23) {
    if (num <= 12) return 'alto';
    if (num <= 14) return 'moderado';
    if (num <= 18) return 'bajo';
    return 'sin';
  }
  return 'desconocido';
}

/** Heurística para saber si un valor luce como una fecha. */
export function looksLikeDate(value: unknown): boolean {
  if (value instanceof Date) return true;
  if (typeof value === 'number') {
    // Rango típico de serial de fecha de Excel (2000-01-01 en adelante).
    return value > 36000 && value < 60000;
  }
  const s = String(value ?? '').trim();
  if (!s) return false;
  return /\d{1,4}[/\-.]\d{1,2}([/\-.]\d{1,4})?/.test(s) || /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(s);
}

/** Devuelve el nombre original de la columna con un rol dado (la de mayor confianza). */
export function columnForRole(columns: DetectedColumn[], role: ColumnRole): string | null {
  const match = columns
    .filter((c) => c.role === role)
    .sort((a, b) => b.confidence - a.confidence)[0];
  return match ? match.original : null;
}

/** Devuelve todas las columnas con un rol dado. */
export function columnsForRole(columns: DetectedColumn[], role: ColumnRole): string[] {
  return columns.filter((c) => c.role === role).map((c) => c.original);
}
