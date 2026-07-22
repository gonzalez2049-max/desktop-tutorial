// Datos de ejemplo y plantilla descargable para que cualquier persona pueda
// probar NEX Report al instante, sin tener que preparar un Excel. Se generan en
// el navegador como CSV (compatible con la carga normal).

/** Estructura esperada, en simple, para orientar al usuario. */
export const EXPECTED_COLUMNS: { name: string; desc: string; example: string }[] = [
  { name: 'Unidad', desc: 'Servicio o unidad donde se auditó', example: 'UCI' },
  { name: 'Fecha', desc: 'Fecha o período de la evaluación', example: '2026-01-10' },
  { name: 'Turno', desc: 'Jornada (opcional)', example: 'Mañana' },
  { name: 'Nivel de riesgo', desc: 'Riesgo del paciente (opcional)', example: 'Alto' },
  { name: 'Indicador', desc: 'Práctica evaluada', example: 'Higiene de manos' },
  { name: 'Cumple', desc: 'Sí / No (o N/A si no aplica)', example: 'Sí' },
];

const HEADERS = EXPECTED_COLUMNS.map((c) => c.name);

const UNIDADES = ['UCI', 'UCM'];
const TURNOS = ['Mañana', 'Tarde', 'Noche'];
const RIESGOS = ['Alto', 'Medio', 'Bajo'];
const INDICADORES = ['Higiene de manos', 'Uso de guantes', 'Registro de cambios de posición', 'Valoración de riesgo'];
const FECHAS = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'];

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: string[][]): string {
  return [HEADERS, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
}

/** Plantilla vacía: encabezados + una fila de ejemplo para guiar el formato. */
export function templateCsv(): string {
  const example = EXPECTED_COLUMNS.map((c) => c.example);
  return toCsv([example]);
}

/**
 * Set de ejemplo realista (~96 filas): varias unidades, turnos, niveles de
 * riesgo e indicadores, con un cumplimiento alto y algunas fallas, para que el
 * informe muestre semáforo, desgloses y brechas de forma didáctica.
 */
export function exampleCsv(): string {
  const rows: string[][] = [];
  let n = 0;
  for (const unidad of UNIDADES) {
    for (const fecha of FECHAS) {
      for (const turno of TURNOS) {
        for (const indicador of INDICADORES) {
          // Cumplimiento ~85%: determinístico para que el ejemplo sea estable.
          const cumple = n % 7 === 0 ? 'No' : 'Sí';
          const riesgo = RIESGOS[n % RIESGOS.length];
          rows.push([unidad, fecha, turno, riesgo, indicador, cumple]);
          n++;
        }
      }
    }
  }
  return toCsv(rows);
}

// BOM UTF-8: garantiza que el lector (SheetJS) y Excel interpreten los acentos
// (Sí, Mañana, posición…) correctamente y no como caracteres corruptos.
const BOM = '﻿';

/** Convierte un CSV en un File para reutilizar la carga normal. */
export function csvToFile(csv: string, name: string): File {
  return new File([BOM + csv], name, { type: 'text/csv;charset=utf-8' });
}

/** Dispara la descarga de un CSV en el navegador. */
export function downloadCsv(csv: string, name: string): void {
  const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
