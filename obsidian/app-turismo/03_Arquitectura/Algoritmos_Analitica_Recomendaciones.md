# Algoritmos de Analítica y Recomendaciones

Este documento describe la arquitectura y lógica detrás de los dos nuevos sistemas de análisis de datos implementados para mejorar la experiencia del administrador y del usuario final.

## 1. Algoritmo de Tendencias Globales (Global Trends)

### Objetivo
Proporcionar a los administradores una visión clara y en tiempo real de los intereses y comportamientos de la comunidad de usuarios.

### Flujo de Datos
1.  **Recolección:** Las preferencias se guardan como objetos `JSONB` en la tabla `citizen_profiles` (campo `preferences`).
2.  **Agregación:** El backend utiliza funciones nativas de PostgreSQL para expandir y contar las categorías dentro de los arreglos JSON.
3.  **Visualización:** Los datos se presentan en la Consola de Seguridad (Admin Dashboard) mediante gráficos de distribución.

### Métricas Analizadas
- **Top 10 Categorías:** Identificación de los intereses más populares (ej: Gastronomía, Naturaleza).
- **Estilos de Viaje:** Distribución de cómo prefieren viajar los usuarios (ej: Mochilero, Lujo, Familiar).
- **Duración de Estadía:** Tendencias de tiempo que los usuarios planean pasar en Valdivia.

---

## 2. Algoritmo de Recomendaciones Personalizadas

### Objetivo
Ofrecer sugerencias relevantes de lugares y eventos en Valdivia para incentivar la exploración de la ciudad.

### Lógica de Selección (Jerarquía de Relevancia)
El algoritmo utiliza una cascada de prioridades para asegurar que siempre haya contenido disponible:

1.  **Preferencias del Usuario:** Si el usuario ha configurado sus intereses, se filtran lugares y eventos que coincidan exactamente con sus categorías guardadas.
2.  **Fallback de Tendencias Globales:** Si el usuario no tiene preferencias seteadas, el sistema utiliza las 3 categorías más populares de la comunidad (calculadas dinámicamente) para realizar la recomendación.
3.  **Default Seguro:** Si el sistema es nuevo o no hay datos suficientes, se utilizan categorías base: *Naturaleza, Gastronomía y Cultura*.

### Implementación en el Feed
Las recomendaciones se inyectan en el "Feed de Experiencias" mediante un carrusel horizontal interactivo, separando las sugerencias algorítmicas del feed cronológico de la comunidad.

---

## Impacto en el Negocio
- **Engagement:** Aumenta el tiempo de permanencia en la app al ofrecer contenido relevante.
- **Toma de Decisiones:** Permite a los administradores y socios (Partners) ajustar su oferta según la demanda real detectada por las tendencias.
