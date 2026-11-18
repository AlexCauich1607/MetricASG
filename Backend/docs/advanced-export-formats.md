# HU-045 — Especificación de exportación avanzada

## 1. Objetivo

Definir los formatos de exportación disponibles en MetricASG para reportes, historiales, comparativas y planes de mejora, conservando la integridad de los datos y los permisos de acceso.

## 2. Matriz de exportación

| Recurso | PDF | XLSX | CSV |

|---|---|---|---|

| Reporte ASG completo | Sí | No | No |

| Historial de evaluaciones | No | Sí | Sí |

| Comparativa de evaluaciones | No | Sí | Sí |

| Plan de mejora | No | Sí | Sí |

## 3. Fuentes de información

- Reporte ASG: AsgReportService.

- Historial: EvaluationService.getEvaluationHistory().

- Comparativa: EvaluationService.getEvaluationComparison().

- Plan de mejora: ImprovementActionService.getActions().

Los datos deben proceder de consultas autorizadas por el backend.

## 4. Estructura de exportaciones

### 4.1. Reporte ASG — PDF

Se conservará la generación PDF existente mediante AsgPdfService, AsgReportService y AsgReportPaginatorService.

El reporte debe respetar los resultados históricos y la estructura definida en asg-report-structure.md.

### 4.2. Historial — XLSX y CSV

Una fila por evaluación.

Columnas:

- ID de evaluación.

- Fecha de evaluación.

- Puntuación global.

- Una columna de puntuación por cada ámbito disponible.

Las columnas de ámbitos se obtendrán dinámicamente del historial.

### 4.3. Comparativa — XLSX y CSV

Una fila por evaluación seleccionada.

Columnas:

- ID de evaluación.

- Fecha.

- ID de metodología.

- Versión metodológica.

- Puntuación global.

- Puntuaciones por ámbito.

- Diferencia global.

- Diferencias por ámbito.

La exportación debe conservar la condición de comparabilidad y cualquier advertencia metodológica.

Cuando las evaluaciones no sean comparables, no deben presentarse diferencias inexistentes o inválidas como resultados oficiales.

### 4.4. Plan de mejora — XLSX y CSV

Una fila por acción.

Columnas:

- ID de acción.

- ID de evaluación.

- ID de indicador.

- Brecha identificada.

- Descripción de la acción.

- Prioridad.

- Responsable.

- Fecha objetivo.

- Estado.

- Fecha de creación.

- Fecha de actualización.

## 5. Reglas de generación

### 5.1. PDF

Reutilizar la infraestructura existente basada en jsPDF y html2canvas.

### 5.2. XLSX

Generar archivos de hoja de cálculo con encabezados descriptivos y tipos de datos apropiados.

La biblioteca de implementación se determinará durante HU-045-T02.

### 5.3. CSV

- Utilizar codificación UTF-8 con BOM.

- Escapar correctamente delimitadores, comillas y saltos de línea.

- Mantener un orden estable de columnas.

- Utilizar encabezados descriptivos.

- Documentar y mantener un delimitador consistente.

## 6. Integridad y seguridad

- No recalcular las puntuaciones oficiales durante la exportación.

- Conservar identificadores, fechas y precisión numérica.

- Aplicar los filtros correspondientes al contexto de empresa y evaluación.

- Validar identidad, membresía y autorización en el backend.

- No confiar exclusivamente en controles del frontend.

- Evitar la exposición de información de otras empresas.

- Proteger los valores de texto frente a inyección de fórmulas en CSV y XLSX.

- No presentar diferencias metodológicas inválidas como comparables.

## 7. Criterios de validación

- Los formatos corresponden a los casos de uso definidos.

- Los archivos contienen los encabezados y datos esperados.

- Se conservan caracteres especiales, acentos y fechas.

- Los resultados coinciden con los datos autorizados de origen.

- Las exportaciones no modifican evaluaciones ni planes de mejora.

- Los usuarios no pueden exportar información fuera de su alcance.

## 8. Alcance de HU-045-T01

Esta tarea define el contrato funcional de exportación.

La generación de servicios, integración con componentes Angular, pruebas de archivos y validaciones de autorización se implementarán en las tareas posteriores de HU-045.
