# Arquitectura NEX Report — IAAS

> Documento técnico de mantenimiento. Describe el motor de NEX Report, la
> estructura de configuración de auditorías, cómo crear una auditoría IAAS nueva
> sin duplicar código, el flujo de datos, las fórmulas, la generación del informe
> y las **reglas para no modificar auditorías ya liberadas**.
>
> Ámbito: módulo **IAAS** (Infecciones Asociadas a la Atención en Salud). El
> módulo **NT 234 / LPP** es el programa de referencia y **no debe modificarse**.

---

## 1. Principio de diseño

NEX Report es **config-driven**: un único **motor de análisis** procesa el Excel
y produce el informe; todo lo que cambia entre programas y auditorías vive en
**configuración**, no en el motor. Crear una auditoría nueva significa **añadir
una entrada de configuración**, no escribir lógica de cálculo.

- **Programa** (`ReportType`): NT 234 / LPP, IAAS, Dolor, Caídas, Accesos
  Vasculares, Personalizado.
- **Auditoría** (`AuditVariant`): sub-unidad dentro de un programa (p. ej. IAAS →
  Higiene de Manos, NAVM, ITU/CUP, ITS/CVC, Bundle, Otra).
- **Dos modos de análisis** (`AuditMode`):
  - `practicas` → **cumplimiento** = `Cumple / (Cumple + No cumple) × 100`
    (excluye N/A).
  - `vigilancia` → **tasas epidemiológicas** (`numerador / denominador × factor`).
    No aplica la fórmula de cumplimiento.

Todo el procesamiento ocurre **en el navegador** (sin servidor, sin CDNs). La
configuración del usuario se persiste en `localStorage`.

---

## 2. Motor de análisis

El motor es una función pura: recibe el Excel parseado y la configuración del
informe, y devuelve un `AnalysisResult`. No conoce ningún programa concreto: lee
la configuración resuelta y se comporta en consecuencia.

**Archivo:** `src/utils/analysis.ts` — función principal `analyze(workbook, config)`.

Piezas internas relevantes:

| Función | Rol |
|---|---|
| `validPatientRows(workbook)` | Descarta filas de resumen/totales y vacías; base común de todo el análisis. |
| `tally(row, cols)` | Cuenta `cumple` / `noCumple` / `noAplica` de una fila sobre columnas de cumplimiento. |
| `pct(cumple, aplicables)` | `cumple / aplicables × 100`, redondeado a 1 decimal. |
| `complianceBy(rows, dimCol, complianceCols, goal)` | Cumplimiento agrupado por una columna dimensión (turno, unidad, estamento…). |
| `complianceByIndicator(...)` | Por indicador (columna «indicador» en formato largo, o cada columna de cumplimiento en formato ancho). |
| `complianceByBreakdowns(columns, breakdowns, rows, complianceCols, goal)` | Desgloses **configurables** (p. ej. estamento), localizados por encabezado. |
| `complianceRowsFor(workbook, config)` | Base de filas para cumplimiento; aplica el filtro de riesgo **solo** en NT 234. |
| `buildTemporal(...)` | Evolución por período y períodos disponibles (autodetección dd/mm vs mm/dd). |
| `unitShiftMatrix(...)` | Matriz cumplimiento turno × unidad. |

El motor **no distingue programas por nombre**; toda especialización llega a
través de `resolveProgramConfig(config)` (ver §4). La única excepción histórica
es NT 234, cuyo comportamiento se conserva mediante gates explícitos
(`config.reportType === 'NT234_LPP'` y `program.riskFilter`).

---

## 3. Estructura de configuración

**Archivo:** `src/config/programs.ts`.

### 3.1 Programa (`ProgramConfig`)

Extiende `ProgramConfigEditable` (campos ajustables desde la UI y persistibles) y
añade lógica no editable:

```ts
ProgramConfigEditable = {
  programName, institutionName, unitName, logo, goal,
  traffic: { verde, amarillo, rojo },  // colores del semáforo
  executiveBaseText,                    // preámbulo del resumen
  officialIndicators: string[],
  descriptiveVariables: string[],
}

ProgramConfig extends ProgramConfigEditable = {
  reportType, audits?: AuditVariant[], auditMode?, breakdowns?,
  riskFilter: boolean,                  // true SOLO en NT 234
  canonicalizeIndicator: (label) => string | null,
}
```

Los programas por defecto viven en `DEFAULT_PROGRAMS`. IAAS declara sus
auditorías en `DEFAULT_PROGRAMS.IAAS.audits`.

### 3.2 Auditoría (`AuditVariant`)

Es el corazón de la configuración IAAS. **Todo** lo propio de una auditoría se
define aquí:

```ts
AuditVariant = {
  id, name, description?,
  mode: 'practicas' | 'vigilancia',
  indicators: { name, kind: 'obligatorio' | 'complementario' }[],
  descriptiveVariables: string[],
  goal?: number,
  inclusion: string[], exclusion: string[],
  rates: SurveillanceRate[],            // solo modo vigilancia
  formula?: string,                     // descriptiva (documenta el cálculo)
  breakdowns?: AuditBreakdown[],        // desgloses extra (p. ej. estamento)
  kpis: string[], charts: string[], tables?: string[],
  executiveText: string,                // resumen ejecutivo propio
  recommendations: string[],
  autoRecommendations?: AutoRecommendation[],
  template?: AuditReportTemplate,       // plantilla Word/PDF
  riskFilter?: boolean,                 // IAAS = false
}
```

Tipos auxiliares:

- `SurveillanceRate = { name, numerator, denominator, factor, unit, reference? }`
  — tasa de vigilancia (`numerador / denominador × factor`).
- `AuditBreakdown = { key, label, match: string[] }` — dimensión adicional de
  desglose del cumplimiento. `match` son fragmentos de encabezado (normalizados)
  para localizar la columna en el Excel.
- `AutoRecommendation = { when: 'always' | 'below_goal' | 'at_or_above_goal', text }`
  — recomendación que se muestra según el resultado frente a la meta.
- `AuditReportTemplate` — títulos PDF/Word, notas de encabezado/pie y qué
  secciones incluir. Valor por defecto: `DEFAULT_REPORT_TEMPLATE`.

### 3.3 Helpers de construcción

- `auditTemplate(id, name, description, mode)` → `AuditVariant` con todos los
  campos vacíos y `riskFilter: false`. Base para declarar una auditoría nueva.
- `createEmptyAudit(mode?)` → plantilla vacía para el asistente de UI.
- `canonicalizerFor(reportType, officialIndicators)` → función que reconoce el
  nombre de un indicador (NT 234 usa su matcher difuso; el resto usa
  `matchAgainstList` contra los indicadores oficiales de la auditoría).

### 3.4 Persistencia

**Archivo:** `src/utils/programConfig.ts`. Todo es SSR-safe (funciona sin
`localStorage`).

| Clave localStorage | Contenido |
|---|---|
| `nex-program-config:<reportType>` | Overrides editables del programa. |
| `nex-program-audits:<reportType>` | Lista completa de auditorías personalizadas (reemplaza a las de fábrica). |

Funciones: `getProgramConfig`, `saveProgramConfig`, `resetProgramConfig`,
`getProgramDefaults`, `getProgramAudits`, `saveAudit`, `deleteAudit`,
`resetAudits`. Las auditorías guardadas por el usuario (desde el **Asistente de
Configuración de Auditorías**) **shadowean** a las de código; «Restablecer
auditorías por defecto» borra el override.

---

## 4. `resolveProgramConfig` — el puente motor ↔ configuración

**Archivo:** `src/utils/programConfig.ts`.

```ts
resolveProgramConfig(config: ReportConfig): ProgramConfig
```

Toma la configuración del informe (`{ reportType, auditId, analysisType,
highlights, goal }`), busca la auditoría elegida y la **fusiona sobre el
programa**:

- `officialIndicators` ← nombres de `audit.indicators`
- `auditMode` ← `audit.mode`
- `breakdowns` ← `audit.breakdowns`
- `descriptiveVariables` ← `audit.descriptiveVariables`
- `riskFilter` ← `audit.riskFilter ?? false`
- `goal` ← `audit.goal ?? base.goal`
- `executiveBaseText` ← `audit.executiveText || base.executiveBaseText`
- `canonicalizeIndicator` ← reconstruido desde los indicadores

**Sin `auditId` (o sin auditoría) devuelve el programa tal cual.** Por eso
NT 234 —que no tiene sub-auditorías— se comporta idéntico. Todos los consumidores
(motor, exportadores, vistas) llaman a `resolveProgramConfig`, de modo que
configurar una auditoría propaga su lógica sin tocar el código.

---

## 5. Flujo de datos

```mermaid
flowchart TD
  A[Home · elegir programa] -->|programa con audits| B[AuditPicker · elegir auditoría]
  A -->|programa simple| D
  B --> D[FileUpload]
  D -->|parseExcelFile(file, reportType, auditId)| E[ColumnReview · detección + perfil, corregible]
  E --> F[Wizard · 3 preguntas: análisis, highlights, meta]
  F -->|ReportConfig con auditId| G[analyze(workbook, config)]
  G --> H[AnalysisView · dashboard]
  H --> I[ExecutiveSummary · resumen + exportación]
  I --> J[PDF / Word / Vista previa]
```

**Etapas de la app** (`src/App.tsx`): `home → audit → settings → upload → review
→ wizard → generating → result`. El estado clave es `reportType` + `auditId`; el
`auditId` viaja en `ReportConfig` y llega hasta `parseExcelFile` (para el perfil
de detección) y hasta el motor (vía `resolveProgramConfig`).

### 5.1 Lectura y detección de columnas

- `src/utils/excelParser.ts` → `parseExcelFile(file, reportType?, auditId?)`
  (SheetJS). Descarta columnas auxiliares/vacías (`__EMPTY`, encabezados en
  blanco, columnas sin datos).
- `src/utils/columnDetection.ts` → `detectColumns(headers, rows)`. Asigna un
  **rol** (`ColumnRole`) a cada columna combinando el encabezado (`scoreRole`,
  ignorando palabras vacías) con el contenido (Sí/No/N/A → `cumplimiento`;
  fechas → `fecha`).
- `src/utils/detectionProfiles.ts` → `applyDetectionProfile(reportType, columns,
  rows, auditId?)`. Afina la detección **por programa/auditoría**:
  - **NT 234 HUAP** (`applyNt234HuapProfile`): estructura oficial del HUAP.
  - **IAAS** (`applyAuditProfile`): reconoce los **indicadores oficiales de la
    auditoría** para asignarles el rol correcto sin intervención manual
    (formato ancho → `cumplimiento`; formato largo → `indicador`).
- La detección es **corregible** por el usuario en `ColumnReview`.

### 5.2 Roles de columna (`ColumnRole`)

`unidad`, `turno`, `indicador`, `cumplimiento`, `fecha`, `paciente`, `riesgo`,
`descriptivo`, `valor`, `desconocido`. Los desgloses (`AuditBreakdown`) se
localizan **por encabezado**, con independencia del rol (salvo que sean
`cumplimiento` / `indicador` / `riesgo`, que se excluyen).

---

## 6. Fórmulas

### 6.1 Auditoría de prácticas (cumplimiento)

Implementada en `tally` + `pct` (`src/utils/analysis.ts`):

```
Cumplimiento (%) = Cumple / (Cumple + No cumple) × 100
```

- **Excluye N/A** y los vacíos (un vacío en columna de cumplimiento cuenta como
  «no aplica», no como incumplimiento).
- Se aplica igual a: **global**, **por indicador**, **por unidad**, **por
  turno**, **por breakdown** (estamento…), **matriz turno × unidad** y
  **evolución** por período.
- `meetsGoal = aplicables > 0 && percent >= goal`.
- El `formula` del `AuditVariant` es **documental** (se muestra en la cabecera del
  informe); el cálculo real es esta fórmula del motor.

### 6.2 Vigilancia epidemiológica

```
Tasa = (numerador / denominador) × factor      // p. ej. × 1000 días dispositivo
```

Definida por `SurveillanceRate`. El motor **no** aplica la fórmula de
cumplimiento en modo `vigilancia`; `AnalysisView` muestra las tasas
configuradas. (Las auditorías de vigilancia están como plantillas; su cálculo se
implementará por configuración al construirlas.)

### 6.3 Filtro de riesgo (exclusivo de NT 234)

Solo cuando `program.riskFilter === true` (NT 234) el cumplimiento se calcula
**únicamente sobre pacientes de riesgo moderado y alto**. IAAS usa
`riskFilter: false`, por lo que considera todas las oportunidades observadas.

---

## 7. Generación del informe

### 7.1 En pantalla — `AnalysisView`

`src/components/analysis/AnalysisView.tsx` ramifica según el tipo:

- **NT 234** (`isNT234`): caracterización clínica + semáforo + indicadores +
  turno + LPP. (No tocar.)
- **Vigilancia** (`audit.mode === 'vigilancia'`): plantilla de tasas.
- **Prácticas** (genérico, incluye IAAS Higiene de Manos): KPIs, gráficos
  (Recharts), cumplimiento por indicador / turno / unidad / **breakdowns**,
  matriz turno × unidad, indicadores críticos/destacados, totales, variables
  descriptivas, resumen ejecutivo y firma. Muestra la **nota de fórmula** en la
  cabecera.

### 7.2 Resumen ejecutivo — `buildExecutiveReport`

`src/utils/executiveReport.ts` es un **despachador audit-aware**:

```ts
buildExecutiveReport(a) =
  a.config.reportType === 'NT234_LPP'
    ? buildNT234Report(a)      // redacción clínica LPP — NO modificar
    : buildPracticesReport(a)  // informe neutro de prácticas (IAAS y futuras)
```

`buildPracticesReport` redacta un informe **neutro** (sin vocabulario LPP)
dirigido por la configuración y los datos:

- Preámbulo desde `audit.executiveText`.
- Secciones: Resumen ejecutivo · Análisis de resultados · Principales hallazgos ·
  **Recomendaciones** · Plan de acción sugerido · Conclusión.
- **Recomendaciones automáticas**: `autoRecommendationTexts(a)` filtra
  `audit.autoRecommendations` por condición (`always` / `below_goal` /
  `at_or_above_goal`) según `global.meetsGoal`, y añade recomendaciones por
  brecha (`computeGenericGaps`, que incluye los breakdowns).

### 7.3 Gráficos y exportación

- `src/utils/reportCharts.ts` → `buildReportCharts(a, colors)`: gráficos
  institucionales renderizados a **PNG (canvas)** para incrustarlos igual en PDF
  y Word (velocímetro, barras por indicador/turno/unidad/**breakdown**, ranking,
  evolución). Los gráficos de unidad y de breakdown se generan **solo fuera de
  NT 234**.
- `src/utils/exportPdf.ts` → `buildPdfDoc` / `exportPdf` / `pdfBlobUrl` (jsPDF +
  autotable). Encabezado institucional, KPIs, gráficos, tablas (incluye
  **breakdowns**), resumen ejecutivo y firma.
- `src/utils/exportWord.ts` → `exportWord` (docx + file-saver). Misma estructura.
- `src/utils/reportModel.ts` → `summaryKpis(a, colors)` (KPIs comunes a pantalla
  y exportación).
- **Vista previa** = render del PDF real en un iframe (`ReportPreview`).

---

## 8. Cómo crear una auditoría IAAS nueva

> Regla de oro: **añadir configuración, no modificar el motor** ni las auditorías
> ya liberadas.

1. **Declarar la auditoría** en `DEFAULT_PROGRAMS.IAAS.audits`
   (`src/config/programs.ts`), partiendo de `auditTemplate(id, name, desc, mode)`
   y rellenando: `indicators` (obligatorio/complementario), `goal`, `formula`,
   `descriptiveVariables`, `breakdowns`, `inclusion`/`exclusion`, `kpis`,
   `charts`, `tables`, `executiveText`, `autoRecommendations`, `template`. Para
   vigilancia, definir `rates` en vez de indicadores de cumplimiento.

2. **Modo**:
   - `practicas` → el motor calcula cumplimiento automáticamente.
   - `vigilancia` → definir `rates`; no se aplica la fórmula de cumplimiento.

3. **Desgloses**: para «cumplimiento por X» (además de unidad/turno), añadir un
   `AuditBreakdown` con `match` (fragmentos del encabezado). Se renderiza solo si
   la columna existe y tiene casos aplicables.

4. **Detección**: los indicadores oficiales de la auditoría se reconocen solos
   vía `applyAuditProfile`. Si el Excel usa encabezados muy distintos, el usuario
   los corrige en `ColumnReview`.

5. **Verificar** (obligatorio antes de liberar):
   - `npm run build` limpio.
   - E2E de la auditoría con un Excel representativo (indicadores reconocidos,
     desgloses, resumen ejecutivo, PDF/Word, vista previa; **0 errores de
     consola**).
   - **NT 234 byte-idéntico**: 102 auditados · 60/42 riesgo · 9 LPP · 8,8 %
     prevalencia · 79 % cumplimiento · prosa LPP intacta.

6. **Liberar** con un PR por auditoría a `main` (auto-deploy a GitHub Pages).

No se necesita crear un `ReportType` nuevo salvo que sea un **programa** nuevo
(Dolor, Caídas…); en ese caso, añadir su entrada en `DEFAULT_PROGRAMS`,
`REPORT_TYPES` y, si aplica, un perfil de detección.

---

## 9. Componentes que se reutilizan

Una auditoría nueva reutiliza **todo** esto sin tocarlo:

- **Carga y lectura**: `FileUpload`, `parseExcelFile`, `detectColumns`,
  `applyDetectionProfile`, `ColumnReview`, `DataPreview`.
- **Asistente de informe**: `Wizard` (tipo de análisis, highlights, meta).
- **Motor**: `analyze` y todas sus agregaciones.
- **Resolución de configuración**: `resolveProgramConfig`.
- **Dashboard**: `AnalysisView` (rama de prácticas o de vigilancia), `KpiCards`,
  `ComplianceTable`, `CountTable`, `UnitShiftMatrixTable`, `VisualDashboard`,
  `EvolutionSection`, `SignatureBlock`.
- **Informe y exportación**: `buildExecutiveReport` (rama de prácticas),
  `buildReportCharts`, `exportPdf`, `exportWord`, `ReportPreview`, `summaryKpis`.
- **Configuración sin código**: `AuditBuilder` (Asistente de Configuración de
  Auditorías) + persistencia en `programConfig.ts`.

---

## 10. Reglas para NO modificar auditorías ya liberadas

Auditorías **liberadas y estables** (v1.0), **congeladas**:

- **NT 234 / LPP** — programa de referencia.
- **IAAS · Higiene de Manos** — primera auditoría IAAS.

Reglas obligatorias:

1. **No editar** la configuración de una auditoría liberada (sus `indicators`,
   `goal`, `formula`, `breakdowns`, `executiveText`, `autoRecommendations`,
   `template`). Una auditoría nueva es **otra entrada** en `audits`, nunca una
   mutación de una existente.
2. **No tocar el motor de cumplimiento** (`tally`, `pct`, `complianceBy`,
   `complianceByIndicator`) salvo cambios **aditivos y gated** que no alteren los
   resultados existentes.
3. **NT 234 es intocable.** Su comportamiento está protegido por gates
   (`reportType === 'NT234_LPP'`, `program.riskFilter`) y por `buildNT234Report`.
   Cualquier cambio transversal debe dejar NT 234 **byte-idéntico**.
4. **Cambios aditivos y gated.** Toda capacidad nueva (p. ej. `breakdowns`,
   informe de prácticas, perfil IAAS) debe estar inactiva por defecto y activarse
   solo mediante configuración, de modo que las auditorías previas no cambien.
5. **Verificación previa a liberar.** `npm run build` limpio + E2E de la nueva
   auditoría + **regresión de NT 234** (métricas exactas del §8.5). Si NT 234
   cambia, el cambio es incorrecto.
6. **Un PR por auditoría.** Las auditorías se construyen como **módulos
   independientes** que reutilizan el motor; no se apilan sobre auditorías
   finalizadas.

> Si una corrección obligara a cambiar una auditoría liberada, trátese como una
> **nueva versión** de esa auditoría (nuevo `id`/entrada), preservando la
> anterior, y documéntese en `RELEASE_NOTES.md`.

---

## 11. Mapa rápido de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/config/programs.ts` | Tipos y `DEFAULT_PROGRAMS`; auditorías IAAS; helpers. |
| `src/config/options.ts` | `REPORT_TYPES`, tipos de análisis, highlights, granularidad. |
| `src/utils/programConfig.ts` | Persistencia y `resolveProgramConfig`. |
| `src/utils/excelParser.ts` | Lectura del Excel (SheetJS). |
| `src/utils/columnDetection.ts` | Detección de roles y clasificación de valores. |
| `src/utils/detectionProfiles.ts` | Perfiles de reconocimiento (NT 234 HUAP, IAAS). |
| `src/utils/analysis.ts` | **Motor de análisis** (`analyze`). |
| `src/utils/executiveReport.ts` | Resumen ejecutivo (despachador NT 234 / prácticas). |
| `src/utils/reportCharts.ts` | Gráficos a PNG para PDF/Word. |
| `src/utils/exportPdf.ts` / `exportWord.ts` | Exportación PDF / Word. |
| `src/utils/reportModel.ts` | KPIs comunes. |
| `src/components/…` | Home, AuditPicker, ProgramSettings, AuditBuilder, FileUpload, ColumnReview, Wizard, analysis/*. |

---

_Última actualización: al liberar IAAS · Higiene de Manos v1.0. Mantener este
documento al día cuando se incorporen nuevas auditorías o capacidades del motor._
