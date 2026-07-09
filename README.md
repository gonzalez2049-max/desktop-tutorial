# NEX Report

**Versión actual: `v0.1.0` (MVP)** · Notas de versión: [`RELEASE_NOTES.md`](RELEASE_NOTES.md)

Plataforma web para configurar **informes de auditorías clínicas** a partir de un
Excel. El usuario sube el archivo, la app lee las columnas automáticamente y un
asistente paso a paso (tipo copiloto) le hace preguntas simples para configurar el
informe.

> **Primero pregunta, luego analiza, luego genera.**

## 🎯 Alcance del MVP (v0.1.0)

Esta versión cubre el flujo completo **funcional**:

1. **Pantalla de inicio** con carga de archivo.
2. **Carga de Excel** (`.xlsx`, `.xls`, `.csv`) con arrastrar y soltar.
3. **Lectura automática de columnas** sin depender de nombres exactos.
4. **Vista previa de datos** (primeras filas de la hoja).
5. **Asistente (wizard) de 3 preguntas**:
   - Tipo de informe.
   - Indicadores / datos a destacar.
   - Meta de cumplimiento.
6. Botón **"Generar reporte"** que ejecuta el **motor de análisis** y muestra
   los resultados en **tarjetas KPI** y **tablas simples**.

### 📈 Motor de análisis

Al generar el reporte se calcula:

- **Total de registros** y **total por unidad** / **por turno**.
- **Cumplimiento global** (cumple / casos aplicables).
- **Cumplimiento por indicador** y **cumplimiento por turno**.
- **Indicadores críticos** (bajo la meta) e **indicadores destacados** (en o sobre la meta).

Reconocimiento de valores (sin distinguir mayúsculas ni acentos):

| Resultado   | Valores reconocidos                                    |
| ----------- | ------------------------------------------------------ |
| Cumple      | `Sí`, `SI`, `Si`, `Cumple`, `1`, `Verdadero`           |
| No cumple   | `No`, `No cumple`, `0`, `Falso`                         |
| No aplica   | `N/A`, `NA`, `No aplica`, y celdas **vacías** en columna de cumplimiento |

### 🧾 Resumen ejecutivo del reporte (Fase 3)

A partir de los resultados calculados, la app **redacta automáticamente** un
informe ejecutivo en lenguaje institucional (sin frases genéricas y sin inventar
datos: cada frase se apoya en cifras reales). Incluye 8 secciones:

1. Resumen general del cumplimiento
2. Interpretación del porcentaje global
3. Principales brechas detectadas
4. Indicadores críticos bajo la meta
5. Unidades o turnos con menor cumplimiento
6. Fortalezas identificadas
7. Recomendaciones operativas concretas
8. Conclusión final

Reglas aplicadas: si el cumplimiento está bajo la meta se indica que **requiere
intervención**; para cada indicador crítico se sugiere **refuerzo educativo**,
**supervisión dirigida** o **revisión del proceso**; si ningún indicador alcanza
la meta, se explicita.

Acciones disponibles:
- **📋 Copiar resumen** al portapapeles (texto plano).
- **📕 Descargar PDF** — generación nativa con **jsPDF** (diseño institucional).
- **📘 Descargar Word** — `.docx` editable nativo con **docx**.

### 🖨️ Exportación profesional de informes

Ambos documentos comparten una paleta institucional y una estructura ejecutiva:
encabezado limpio, semáforo de cumplimiento, tarjetas KPI, tablas de cumplimiento
por indicador / turno / unidad (con bordes suaves y % coloreado por estado) y el
resumen ejecutivo completo (brechas, recomendaciones y conclusión).

| Uso                    | Color     |
| ---------------------- | --------- |
| Verde (cumplimiento)   | `#66BB6A` |
| Amarillo (observación) | `#F59E0B` |
| Rojo (crítico)         | `#EF4444` |
| Azul institucional     | `#1E3A8A` |

Las librerías de exportación (`jspdf`, `docx`) se cargan **bajo demanda** para no
penalizar la carga inicial de la aplicación.

### 📊 Dashboard visual (Recharts)

En la vista de resultados se muestra una sección visual con estilo ejecutivo
clínico (fondo blanco, bordes suaves, colores institucionales):

- **Tarjeta de semáforo** de cumplimiento (verde / amarillo / rojo) con barra de progreso hacia la meta.
- **Gráfico donut** con la distribución de resultados (cumple / no cumple / no aplica).
- **Gráfico de barras** de cumplimiento por indicador.
- **Gráfico de barras** de cumplimiento por unidad.
- **Gráfico de barras** de cumplimiento por turno.

Las barras se colorean según la meta (verde ≥ meta, amarillo cercano, rojo bajo)
y muestran la línea de meta. **Recharts** se carga de forma **diferida**
(`React.lazy`) para no penalizar la pantalla inicial.

## 🧠 Detección inteligente de columnas

No hace falta que las columnas se llamen de una forma exacta. La app reconoce
sinónimos y variantes, y permite **corregir** cualquier asignación antes de
continuar:

| Rol detectado        | Ejemplos de nombres reconocidos                     |
| -------------------- | --------------------------------------------------- |
| Unidad               | `Unidad`, `Servicio`, `Área clínica`, `Sala`        |
| Turno                | `Turno`, `Jornada`, `Horario`                       |
| Indicador            | `Indicador`, `Ítem`, `Criterio`, `Pregunta`         |
| Cumplimiento         | `Cumple`, `Sí`, `SI`, `1`, `No`, `0`, `N/A`         |
| Fecha / Periodo      | `Fecha`, `Mes`, `Periodo`                            |
| Nivel de riesgo      | `Riesgo`, `Braden`, `Morse`                         |

También clasifica los **valores** de cada celda:
`Cumple / Sí / SI / 1` → cumple · `No cumple / No / 0` → no cumple · `N/A / No aplica` → no aplica.

## 🧱 Stack técnico

| Área          | Tecnología            |
| ------------- | --------------------- |
| UI            | React 18 + TypeScript |
| Estilos       | TailwindCSS           |
| Lectura Excel | SheetJS (`xlsx`)      |
| Build         | Vite                  |

## 🌐 Demo en línea (GitHub Pages)

La app se publica automáticamente en **GitHub Pages** mediante GitHub Actions en
cada push a `main` (workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

- URL pública: **https://gonzalez2049-max.github.io/desktop-tutorial/**
- Requisito único (una sola vez): en el repositorio, **Settings → Pages →
  Build and deployment → Source: GitHub Actions**.

No necesitas instalar nada: el build ocurre en la nube.

## 🚀 Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción (type-check + bundle)
npm run preview    # sirve el build de producción
```

Hay un archivo de ejemplo en [`examples/auditoria-ejemplo.xlsx`](examples/auditoria-ejemplo.xlsx)
con nombres de columna "difusos" (`Servicio`, `Jornada`, `Ítem evaluado`, `Cumple`…)
para probar la detección automática.

## 🗂️ Arquitectura modular

```
src/
├── config/
│   └── options.ts          # opciones del asistente (tipos, highlights, metas)
├── types/
│   └── index.ts            # modelo de datos central
├── utils/
│   ├── columnDetection.ts  # detección difusa de columnas y clasificación de valores
│   ├── excelParser.ts      # lectura de Excel con SheetJS
│   ├── analysis.ts         # motor de análisis (KPIs, agrupaciones, indicadores)
│   ├── executiveReport.ts  # redacción automática del resumen ejecutivo
│   ├── reportExport.ts     # copiar resumen al portapapeles
│   ├── palette.ts          # paleta institucional compartida
│   ├── reportModel.ts      # KPIs resumidos para exportación
│   ├── exportPdf.ts        # PDF nativo (jsPDF + autotable)
│   └── exportWord.ts       # Word nativo (.docx con docx)
└── components/
    ├── FileUpload.tsx      # paso 1: carga
    ├── DataPreview.tsx     # vista previa de datos
    ├── ColumnReview.tsx    # lectura + revisión de columnas detectadas
    ├── Stepper.tsx / OptionCard.tsx
    ├── wizard/             # asistente de 3 preguntas
    └── analysis/           # KPIs, tablas, resumen ejecutivo
        └── charts/         # dashboard visual con Recharts (barras, donut, semáforo)
```

Todo el procesamiento ocurre **localmente en el navegador**; los datos no se
envían a ningún servidor.

## 🔖 Versiones

- **v0.1.0 (MVP)** — versión estable actual. Ver [`RELEASE_NOTES.md`](RELEASE_NOTES.md)
  para el detalle de funciones, limitaciones conocidas y próximos pasos.
