# Lógicas para Algoritmos de Recomendación

En esta sección documentaremos las distintas reglas de negocio y lógicas en lenguaje natural para el motor de recomendaciones, organizadas por categorías para facilitar su gestión.

---

## 📍 Por Ubicación o Fecha
- **Regla:** SI el usuario está a menos de 5km de distancia AND el evento es hoy AND el usuario tiene la etiqueta "Música" -> **Mostrar evento**
- **Regla:** SI el evento ocurre en las próximas 2 horas AND está a menos de 1km -> **Notificar inmediatamente**

## 🌤️ Por Clima
- **Regla:** SI es fin de semana AND el clima es soleado AND el evento es al aire libre -> **Recomendar evento al aire libre**
- **Regla:** SI el pronóstico indica lluvia AND el evento es al aire libre -> **Ocultar evento o sugerir alternativa techada**

## ❤️ Por Preferencias
Aquí definimos las categorías de preferencias que el sistema debe consultar en la base de datos para filtrar y recomendar contenido personalizado:

### Subclases de Preferencias (Datos a buscar en BD)
- **Tipo de Actividad:** (Ej: Arte, Deporte, Música, Gastronomía, Historia). Indica qué tipo de eventos prefiere el usuario.
- **Rango de Precio:** (Ej: Gratuito, Económico, Medio, VIP/Premium). Filtra los eventos según la capacidad de gasto del usuario.
- **Accesibilidad:** (Ej: Apto para mascotas, Accesible para sillas de ruedas, Espacios silenciosos). Preferencias sobre las condiciones del lugar.
- **Ambiente:** (Ej: Familiar, Romántico, Festivo, Profesional). Define el tipo de atmósfera que busca el usuario.

### Reglas de Lógica
- **Regla:** SI el usuario ha mostrado interés en gastronomía local AND hay un evento gastronómico cerca (radio 2km) -> **Recomendar evento gastronómico**
- **Regla:** SI el usuario sigue a una categoría de "Arte" -> **Dar prioridad alta a exposiciones en el feed**

## 💰 Por Presupuesto
- **Regla:** SI el usuario tiene un presupuesto bajo marcado en preferencias AND el evento es gratuito -> **Priorizar evento en resultados**
- **Regla:** SI el usuario suele asistir a eventos VIP -> **Destacar eventos premium/exclusivos**

## 🕒 Por Historial
- **Regla:** SI el usuario visitó el "Museo X" recientemente AND el "Museo Y" está en la misma zona -> **Recomendar "Museo Y"**
- **Regla:** SI el usuario ha asistido a 3 eventos de "Teatro" en el último mes -> **Sugerir el próximo estreno teatral**
