// Lógica específica del módulo NT 234 / LPP: indicadores oficiales y su
// reconocimiento tolerante a abreviaturas y errores de escritura.
import { normalize } from './columnDetection';

/** Indicadores oficiales del protocolo NT 234 / LPP. */
export const NT234_INDICATORS = [
  'Valoración de Riesgo al ingreso',
  'Valoración de la Piel',
  'Cambio de posición según riesgo',
  'Superficie de apoyo según riesgo',
  'Protección de prominencias óseas',
  'Manejo de humedad e higiene cutánea',
  'Evaluación nutricional al ingreso',
  'Registro responsable: hora, fecha y firma',
] as const;

/**
 * Reglas de reconocimiento. Cada indicador tiene una o más "firmas": una firma
 * coincide si TODOS sus tokens están presentes de forma difusa en el nombre.
 * El orden importa (los más específicos primero).
 */
const MATCHERS: { name: string; signatures: string[][] }[] = [
  { name: 'Valoración de la Piel', signatures: [['piel']] },
  { name: 'Cambio de posición según riesgo', signatures: [['cambio'], ['posicion']] },
  { name: 'Superficie de apoyo según riesgo', signatures: [['superficie', 'apoyo'], ['sup', 'apoyo'], ['apoyo']] },
  { name: 'Protección de prominencias óseas', signatures: [['prominencias'], ['oseas']] },
  { name: 'Manejo de humedad e higiene cutánea', signatures: [['humedad'], ['higiene'], ['cutanea']] },
  { name: 'Evaluación nutricional al ingreso', signatures: [['nutricional'], ['nutric']] },
  { name: 'Registro responsable: hora, fecha y firma', signatures: [['firma'], ['responsable'], ['hora', 'fecha']] },
  { name: 'Valoración de Riesgo al ingreso', signatures: [['valoracion', 'riesgo'], ['val', 'riesgo'], ['valoracion', 'ingreso']] },
];

/** Distancia de edición (Levenshtein) entre dos cadenas. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * ¿El nombre normalizado contiene (de forma difusa) el stem? Tolera:
 * - inclusión directa,
 * - abreviaturas (prefijo, p. ej. "sup" ↔ "superficie", "val" ↔ "valoracion"),
 * - errores de escritura (distancia de edición pequeña, p. ej. "cmabio" ↔ "cambio").
 */
function fuzzyStem(nameTokens: string[], name: string, stem: string): boolean {
  if (name.includes(stem)) return true;
  const threshold = stem.length <= 4 ? 1 : 2;
  for (const token of nameTokens) {
    if (token === stem) return true;
    if (token.length >= 3 && (stem.startsWith(token) || token.startsWith(stem))) return true;
    if (editDistance(token, stem) <= threshold) return true;
  }
  return false;
}

/**
 * Devuelve el nombre oficial NT 234 si el texto reconoce uno de los indicadores;
 * si no, devuelve null (se conserva el nombre original).
 */
export function canonicalIndicatorNT234(label: unknown): string | null {
  const name = normalize(label);
  if (!name) return null;
  const tokens = name.split(' ');
  for (const matcher of MATCHERS) {
    for (const sig of matcher.signatures) {
      if (sig.every((stem) => fuzzyStem(tokens, name, stem))) return matcher.name;
    }
  }
  return null;
}
