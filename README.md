# NEX Report

**Versión actual: `v1.0` — NT 234 / LPP**

Plataforma web de **auditorías clínicas**. El usuario elige un Programa de Buenas
Prácticas Clínicas, sube un Excel de auditoría, la app lee las columnas
automáticamente y un asistente paso a paso configura el informe. Todo el
procesamiento ocurre **localmente en el navegador**: los datos no se envían a
ningún servidor y la aplicación **no depende de recursos externos** (sin fuentes
ni CDNs remotos).

> **Primero pregunta, luego analiza, luego genera.**

- 🌐 Demo en línea: **https://gonzalez2049-max.github.io/desktop-tutorial/**

## 🎯 Alcance de la v1.0

Esta versión implementa completo y validado el programa **NT 234 / LPP**
(prevención de lesiones por presión). En la pantalla inicial se muestran también
los módulos **IAAS, Dolor, Caídas, Accesos Vasculares** y **Personalizado** con la
etiqueta **«Próximamente»**; se incorporarán en próximas versiones.

### Flujo de la aplicación

1. **Pantalla inicial — selección de programa.** Solo NT 234 / LPP está
   **OPERATIVO**; el resto muestra «Próximamente» y un aviso al seleccionarlos.
   Desde aquí también se accede a la **Configuración del programa**.
2. **Carga de Excel** (`.xlsx`, `.xls`, `.csv`) con arrastrar y soltar.
3. **Lectura y revisión de columnas** (detección automática, corregible).
4. **Asistente de 3 preguntas**: tipo de análisis temporal, datos a destacar y
   meta de cumplimiento.
5. **Reporte**: dashboard clínico + resumen ejecutivo + exportaciones.

## ⚙️ Configuración del programa

Cada programa se configura de forma **independiente y sin tocar el código**
(los cambios se guardan en el navegador). En NT 234 se puede ajustar:

- Nombre del programa, de la institución y de la unidad.
- Meta institucional de cumplimiento.
- Colores del semáforo.
- Logo institucional.
- Texto base del resumen ejecutivo.
- Indicadores oficiales.
- Variables descriptivas (no forman parte del cumplimiento).

La arquitectura es **config-driven**: el motor de análisis lee la configuración
del programa (filtro de riesgo, canonicalización de indicadores y variables
descriptivas), de modo que crear un nuevo módulo solo requiere añadir su
configuración en `config/programs.ts`, sin modificar el motor.

## 🩺 Lógica clínica NT 234 / LPP

- **Filtro de riesgo.** El cumplimiento se calcula **solo** sobre pacientes de
  **riesgo alto y moderado**. Los de riesgo bajo, sin riesgo, no informado o
  vacío se excluyen.
- **Caracterización por paciente.** Los conteos son por paciente (deduplicados
  por la columna de paciente), no por fila de indicador.
- **Requiere columna de riesgo.** Si no se detecta, incluidos/excluidos aparecen
  como **«No determinado»**, se pide seleccionarla en *Revisar columnas* y **no se
  calcula el cumplimiento** hasta que exista.
- **LPP como variable descriptiva.** «¿Tiene LPP?» es prevalencia (no
  cumplimiento) y, si hay clasificación por estadio, se muestra su distribución.
- **Indicadores oficiales.** Los 8 indicadores de la NT 234 se canonizan tolerando
  erratas y abreviaturas (coincidencia difusa por distancia de edición).

### Reconocimiento de valores

| Concepto     | Valores reconocidos (sin distinguir mayúsculas ni acentos)              |
| ------------ | ----------------------------------------------------------------------- |
| Cumple       | `Sí`, `SI`, `Cumple`, `1`, `Verdadero`, `Conforme`                      |
| No cumple    | `No`, `No cumple`, `0`, `Falso`, `Incumple`                             |
| No aplica    | `N/A`, `NA`, `No aplica` y celdas **vacías** en columna de cumplimiento  |
| Riesgo alto  | `Alto`, `Riesgo alto`, `Alto riesgo`, Braden ≤ 12                       |
| Riesgo mod.  | `Moderado`, `Medio`, `Intermedio`, Braden 13–14                        |
| Riesgo bajo  | `Bajo`, Braden 15–18                                                    |
| Sin riesgo   | `Sin riesgo`, `No informado`, vacío, Braden ≥ 19                       |

## 📅 Análisis temporal

En el asistente se elige el tipo de análisis. **No modifica el cálculo**: solo
segmenta o compara la misma base.

- **Informe mensual** — sin sección temporal (foco en el mes).
- **Trimestral / semestral / anual** — muestra la **evolución del cumplimiento**
  por período (línea + tabla, con la variación Δ).
- **Comparación entre períodos** — contrasta dos períodos elegidos lado a lado
  (cumplimiento global, por indicador y prevalencia de LPP) con su variación Δ.

Requiere una columna de fecha; si no existe, se avisa.

## 📊 Dashboard NT 234 (orden lógico)

1. **Caracterización clínica** — pacientes auditados, riesgo alto, riesgo
   moderado, incluidos, excluidos, con LPP y prevalencia de LPP.
2. **Semáforo de cumplimiento** — global, meta y estado (Cumple / En observación
   / Crítico) con barra de progreso.
3. **Cumplimiento por indicador**
4. **Cumplimiento por turno**
5. **Indicadores críticos**
6. **Indicadores destacados**
7. **Total por turno**
8. **Resumen ejecutivo completo**

Sin datos repetidos (no se duplica «Pacientes auditados» como «Total de
registros»).

## 🧾 Resumen ejecutivo del reporte

Redacción automática en lenguaje institucional (cada frase se apoya en cifras
reales) con: análisis de resultados, principales hallazgos, fortalezas,
oportunidades de mejora, **plan de acción sugerido** (tabla) y conclusión
ejecutiva.

Acciones:
- **📋 Copiar resumen** al portapapeles.
- **📕 Descargar PDF** — nativo con **jsPDF** (diseño institucional).
- **📘 Descargar Word** — `.docx` editable nativo con **docx**.

Las librerías de exportación se cargan **bajo demanda**. Colores del semáforo por
defecto: verde `#66BB6A` · amarillo `#F59E0B` · rojo `#EF4444` · azul
institucional `#1E3A8A` (configurables por programa).

## 🔐 Modo auditor

Con `?admin=1` en la URL se habilita el panel de **trazabilidad de los cálculos**
(numerador, denominador y fórmula por indicador) y la exportación de un **Excel de
auditoría**.

## 🧱 Stack técnico

| Área          | Tecnología                                   |
| ------------- | -------------------------------------------- |
| UI            | React 18 + TypeScript                        |
| Estilos       | TailwindCSS (tipografía del sistema)         |
| Lectura Excel | SheetJS (`xlsx`)                             |
| Gráficos      | Recharts (carga diferida)                    |
| Exportación   | jsPDF + jspdf-autotable · docx · file-saver  |
| Build         | Vite                                         |

## 🚀 Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción (type-check + bundle)
npm run preview    # sirve el build de producción
npm run lint       # verificación de tipos (tsc --noEmit)
```

## 🌐 Despliegue (GitHub Pages)

Publicación automática en **GitHub Pages** mediante GitHub Actions en cada push a
`main` (workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
Requisito único: **Settings → Pages → Source: GitHub Actions**.

## 🗂️ Arquitectura modular

```
src/
├── config/
│   ├── options.ts           # opciones del asistente (programas, análisis, metas)
│   └── programs.ts          # configuración por programa (config-driven)
├── types/index.ts           # modelo de datos central
├── utils/
│   ├── columnDetection.ts   # detección difusa de columnas, riesgo y cumplimiento
│   ├── excelParser.ts       # lectura de Excel con SheetJS
│   ├── analysis.ts          # motor de análisis (KPIs, riesgo, temporal)
│   ├── periods.ts           # agrupación temporal (mensual…anual)
│   ├── nt234.ts             # indicadores oficiales NT 234 (canonización difusa)
│   ├── lpp.ts               # estadios de LPP
│   ├── executiveReport.ts   # redacción del resumen ejecutivo + plan de acción
│   ├── palette.ts           # paleta institucional y semáforo
│   ├── programConfig.ts     # lectura/persistencia de la configuración por programa
│   ├── reportModel.ts       # KPIs resumidos
│   ├── reportExport.ts      # copiar resumen al portapapeles
│   ├── admin.ts             # modo auditor (?admin=1)
│   ├── exportPdf.ts         # PDF nativo (jsPDF + autotable)
│   ├── exportWord.ts        # Word nativo (.docx)
│   └── exportAudit.ts       # Excel de auditoría
└── components/
    ├── Home.tsx             # pantalla inicial: selección de programa
    ├── ProgramSettings.tsx  # configuración del programa
    ├── FileUpload.tsx / DataPreview.tsx / ColumnReview.tsx
    ├── Stepper.tsx / OptionCard.tsx
    ├── wizard/              # asistente de 3 preguntas
    └── analysis/            # caracterización, semáforo, tablas, resumen ejecutivo
        └── charts/          # dashboard visual con Recharts
```

Todo el procesamiento ocurre **localmente en el navegador**; los datos no se
envían a ningún servidor.

## 🔖 Versiones

- **v1.0 — NT 234 / LPP** — versión estable actual: programa NT 234 completo
  (caracterización por riesgo, análisis temporal, dashboard ordenado, resumen
  ejecutivo, exportaciones PDF / Word / Excel y configuración por programa).
