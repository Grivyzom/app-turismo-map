/** Textos del saludo del Inicio (sin dependencias de React Native, testeables con node). */

/** Saludo según la hora: mañana hasta las 12, tarde hasta las 20, noche después. */
export function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "Sáb, 17 oct": fecha corta en español con la primera letra en mayúscula. */
export function formatToday(date: Date): string {
  const s = date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
