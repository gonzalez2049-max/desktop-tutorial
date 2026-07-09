# NEX Report

Plataforma web para configurar **informes de auditorías clínicas** a partir de un
Excel. El usuario sube el archivo, la app lee las columnas automáticamente y un
asistente paso a paso (tipo copiloto) le hace preguntas simples para configurar el
informe.

> **Primero pregunta, luego analiza, luego genera.**

## 🎯 Alcance de esta primera versión

Esta entrega cubre el flujo base **funcional**:

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

> ⏭️ **Aún no incluido (próxima entrega):** dashboard visual con gráficos y
> exportación a PDF / Word. La base actual queda lista para construirlos encima.

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
│   └── analysis.ts         # motor de análisis (KPIs, agrupaciones, indicadores)
└── components/
    ├── FileUpload.tsx      # paso 1: carga
    ├── DataPreview.tsx     # vista previa de datos
    ├── ColumnReview.tsx    # lectura + revisión de columnas detectadas
    ├── Stepper.tsx / OptionCard.tsx
    ├── wizard/             # asistente de 3 preguntas
    └── analysis/           # tarjetas KPI y tablas de resultados
```

Todo el procesamiento ocurre **localmente en el navegador**; los datos no se
envían a ningún servidor.
