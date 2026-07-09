# NEX Report v0.1.0 MVP

Fecha: 2026-07-09 · Commit base: `e7327d4` (rama `main`)

---

## 1. Versión

**NEX Report v0.1.0 MVP** — primera versión estable (Producto Mínimo Viable).

## 2. Resumen del producto

NEX Report es una aplicación web que transforma un **Excel de auditorías clínicas**
en un **informe ejecutivo** con pocos clics. El usuario sube el archivo, un
asistente tipo copiloto le hace 3 preguntas simples y la aplicación **lee las
columnas automáticamente** (sin depender de nombres exactos), **analiza** los
datos y **genera** un informe ejecutivo con tablas, gráficos y documentos
descargables. Todo el procesamiento ocurre **localmente en el navegador**: los
datos no se envían a ningún servidor.

## 3. Funciones implementadas

- **Carga de Excel** (`.xlsx`, `.xls`, `.csv`) con arrastrar y soltar.
- **Detección inteligente de columnas** (heurística difusa, sin nombres exactos):
  unidad/servicio, turno/jornada, indicador/ítem, cumplimiento, fecha y nivel de
  riesgo — con revisión y corrección manual antes de continuar.
- **Vista previa** de las primeras filas del archivo.
- **Asistente (wizard) de 3 preguntas**: tipo de informe, datos a destacar y meta
  de cumplimiento.
- **Motor de análisis**: total de registros, total por unidad y por turno,
  cumplimiento global, cumplimiento por indicador y por turno, indicadores
  críticos (bajo la meta) e indicadores destacados (sobre la meta).
  - Reconoce como **cumple**: `Sí`, `SI`, `Si`, `Cumple`, `1`, `Verdadero`.
  - Reconoce como **no cumple**: `No`, `No cumple`, `0`, `Falso`.
  - Reconoce como **no aplica**: `N/A`, `NA`, `No aplica` y celdas vacías.
- **Resumen ejecutivo redactado automáticamente** (8 secciones, lenguaje
  institucional, basado solo en cifras reales): resumen general, interpretación
  del porcentaje global, brechas, indicadores críticos, unidades/turnos con menor
  cumplimiento, fortalezas, recomendaciones operativas y conclusión final.
- **Dashboard visual (Recharts)**: tarjeta de semáforo, donut de distribución
  (cumple / no cumple / no aplica) y gráficos de barras de cumplimiento por
  indicador, unidad y turno.
- **Exportación**:
  - **PDF** nativo (jsPDF) con diseño institucional.
  - **Word** editable nativo (`.docx`, docx).
  - **Copiar resumen ejecutivo** al portapapeles.

## 4. Flujo de uso

1. **Subir** el Excel de auditorías.
2. **Revisar** las columnas detectadas y la vista previa (ajustar si hace falta).
3. **Responder** las 3 preguntas del asistente (tipo, datos a destacar, meta).
4. **Generar** el reporte.
5. **Explorar** KPIs, dashboard visual, tablas y resumen ejecutivo.
6. **Descargar** en PDF o Word, o **copiar** el resumen.

## 5. Tecnologías utilizadas

| Área             | Tecnología                 |
| ---------------- | -------------------------- |
| UI               | React 18 + TypeScript      |
| Estilos          | TailwindCSS                |
| Lectura de Excel | SheetJS (`xlsx`)           |
| Gráficos         | Recharts                   |
| PDF              | jsPDF + jspdf-autotable    |
| Word             | `docx`                     |
| Build/dev        | Vite                       |

Las librerías pesadas (`jspdf`, `docx`, `recharts`) se cargan **bajo demanda**
para no penalizar la carga inicial.

## 6. Limitaciones actuales

- Los **gráficos del dashboard no se incrustan** aún en el PDF/Word (estos
  incluyen tablas, semáforo, KPIs y texto, pero no las imágenes de los gráficos).
- La opción **"Comparación mensual"** del asistente es seleccionable pero el
  motor de análisis **todavía no genera la serie temporal** correspondiente.
- La opción **"Pacientes de alto riesgo"** se detecta como dimensión, pero no
  hay aún una vista dedicada de casos de alto riesgo.
- La **detección de columnas es heurística**; en archivos poco estructurados
  puede requerir corrección manual.
- **Sin persistencia**: no se guarda historial de auditorías (todo vive en el
  navegador durante la sesión).
- **Sin pruebas automatizadas** en el repositorio (la validación de este MVP se
  hizo de forma manual y con recorridos end-to-end asistidos).
- El diseño del PDF es funcional y limpio, pero **perfectible** en maquetación.

## 7. Próximos pasos sugeridos

- Incrustar los **gráficos como imagen** dentro del PDF y el Word.
- Implementar la **comparación mensual** real (serie temporal de cumplimiento).
- Añadir una **vista de pacientes de alto riesgo**.
- Incorporar **pruebas automatizadas** (unitarias y end-to-end).
- **Persistencia / historial** de auditorías y comparación entre periodos.
- Mejoras de **accesibilidad** e internacionalización.

## 8. Checklist de validación

- [x] `npm run build` compila sin errores de TypeScript.
- [x] Carga de Excel y lectura automática de columnas.
- [x] Vista previa de datos.
- [x] Wizard de 3 preguntas.
- [x] Motor de análisis (KPIs, cumplimiento por indicador/unidad/turno,
      críticos y destacados) con reconocimiento de valores Sí/No/N-A y vacíos.
- [x] Resumen ejecutivo automático (8 secciones) y botón **Copiar** (portapapeles).
- [x] Dashboard visual con gráficos Recharts.
- [x] Exportación **Word** (`.docx` válido).
- [x] Exportación **PDF** (documento válido).
- [x] Sin errores de consola en el recorrido completo.
- [x] Código limpio (sin imports/variables muertas; restos de impresión retirados).
