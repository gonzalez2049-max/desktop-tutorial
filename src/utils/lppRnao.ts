// Módulo independiente «LPP – Guía RNAO»: adherencia a las buenas prácticas
// RNAO para prevención y manejo de lesiones por presión. NO reutiliza las
// variables de NT 234; define su propio set de indicadores por dominio.

/** Un dominio clínico RNAO con sus indicadores obligatorios y complementarios. */
export interface RnaoDomainDef {
  key: string;
  label: string;
  obligatorios: string[];
  complementarios: string[];
  /** Cuando true, todos sus indicadores son N/A si el paciente no tiene LPP. */
  conditionalOnLpp?: boolean;
}

/** Los 8 dominios de la guía RNAO y sus indicadores. */
export const LPP_RNAO_DOMAINS: RnaoDomainDef[] = [
  {
    key: 'riesgo',
    label: 'Valoración del riesgo',
    obligatorios: ['Valoración del riesgo con escala validada al ingreso', 'Reevaluación del riesgo según condición clínica'],
    complementarios: ['Registro del puntaje y categoría de riesgo'],
  },
  {
    key: 'piel',
    label: 'Evaluación integral de la piel',
    obligatorios: ['Inspección de la piel al ingreso', 'Reevaluación periódica de la integridad cutánea'],
    complementarios: ['Registro estructurado de integridad cutánea'],
  },
  {
    key: 'presion',
    label: 'Prevención y redistribución de presión',
    obligatorios: ['Plan de reposicionamiento según riesgo', 'Superficie de redistribución de presión adecuada', 'Protección de talones y prominencias óseas'],
    complementarios: ['Apósitos profilácticos en zonas de alto riesgo'],
  },
  {
    key: 'humedad',
    label: 'Manejo de la humedad',
    obligatorios: ['Evaluación y manejo de la humedad e incontinencia', 'Uso de productos barrera cuando corresponde'],
    complementarios: ['Plan de cuidado de la piel perineal'],
  },
  {
    key: 'nutricion',
    label: 'Nutrición',
    obligatorios: ['Tamizaje nutricional del paciente en riesgo', 'Derivación o plan nutricional cuando corresponde'],
    complementarios: ['Registro de ingesta e hidratación'],
  },
  {
    key: 'educacion',
    label: 'Educación al paciente y familia',
    obligatorios: ['Educación al paciente y familia sobre prevención de LPP'],
    complementarios: ['Entrega de material educativo y verificación de comprensión'],
  },
  {
    key: 'registro',
    label: 'Registro y continuidad de cuidados',
    obligatorios: ['Registro completo de valoración e intervenciones', 'Plan de cuidados individualizado documentado'],
    complementarios: ['Comunicación de continuidad en entrega de turno'],
  },
  {
    key: 'manejo_lpp',
    label: 'Manejo de LPP existente',
    obligatorios: ['Estadificación de la LPP registrada', 'Plan de tratamiento acorde al estadio', 'Evaluación de la evolución de la LPP'],
    complementarios: ['Evaluación del dolor asociado a la LPP'],
    conditionalOnLpp: true,
  },
];

/** Todos los nombres de indicadores obligatorios (cumplimiento oficial). */
export const LPP_RNAO_OBLIGATORIOS = LPP_RNAO_DOMAINS.flatMap((d) => d.obligatorios);
/** Todos los nombres de indicadores complementarios (se informan aparte). */
export const LPP_RNAO_COMPLEMENTARIOS = LPP_RNAO_DOMAINS.flatMap((d) => d.complementarios);
/** Todos los indicadores (obligatorios + complementarios). Alimenta el canonicalizador. */
export const LPP_RNAO_ALL_INDICATORS = [...LPP_RNAO_OBLIGATORIOS, ...LPP_RNAO_COMPLEMENTARIOS];

/** Variables descriptivas (prevalencia/caracterización; no son cumplimiento). */
export const LPP_RNAO_DESCRIPTIVE = ['Presencia de LPP', 'Tiene LPP', 'Con LPP', 'Estadio LPP', 'Categoría LPP', 'Localización LPP'];
