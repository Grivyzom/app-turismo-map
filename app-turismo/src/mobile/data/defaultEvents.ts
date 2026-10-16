import type { TurismoEvent } from '../../components/Map/types';

/**
 * Eventos destacados por defecto, con ilustraciones originales empaquetadas en la app.
 * Se muestran mientras la agenda del backend no traiga eventos propios.
 *
 * Hay tres tipos (ver `eventKind`):
 * - diario: la experiencia se repite todos los días (travesía en kayak).
 * - dias: solo ocurre algunos días de la semana (canopy los fines de semana).
 * - publicitario: un local avisa que hoy abre como siempre (Grado 13).
 *
 * Las fechas se calculan a partir de los días de la semana: cada evento se ubica en su
 * próxima ocurrencia (o en la actual, si está en curso), así nunca aparece vencido.
 */

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Próxima ocurrencia (o la que está en curso) de un evento recurrente. weekdays: 0 = domingo. */
function recurring(
  weekdays: number[],
  hour: number,
  minute: number,
  durationMin: number,
  now: Date,
): { weekdays: number[]; startTime: string; endTime: string } {
  const duration = durationMin * 60_000;
  // Desde ayer: la ocurrencia de ayer podría seguir en curso (eventos que cruzan la medianoche)
  for (let offset = -1; offset <= 7; offset++) {
    const start = new Date(now);
    start.setHours(hour, minute, 0, 0);
    start.setDate(start.getDate() + offset);
    if (!weekdays.includes(start.getDay())) continue;
    if (start.getTime() + duration <= now.getTime()) continue;
    return {
      weekdays,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + duration).toISOString(),
    };
  }
  throw new Error('recurring: weekdays vacío');
}

export function buildDefaultEvents(now = new Date()): TurismoEvent[] {
  return [
    {
      id: 'destacado-kayak-rio-valdivia',
      title: 'Travesía en kayak por el río Valdivia',
      description:
        'Rema por el corazón de Valdivia y descubre la ciudad desde el agua. Todos los días salimos ' +
        'desde la costanera, ' +
        'cruzamos bajo el puente Pedro de Valdivia y seguimos el río entre lobos marinos, garzas y ' +
        'cisnes. Guías certificados acompañan al grupo en todo momento y la ruta se adapta al nivel ' +
        'de cada participante, así que no necesitas experiencia previa: solo ganas de mojarte un poco.',
      latitude: -39.8141,
      longitude: -73.245,
      category: 'deportes',
      status: 'agendado',
      eventKind: 'diario',
      organizer: 'Río Vivo Kayak',
      organizerType: 'Operador turístico',
      organizerVerified: true,
      time: 'Todos los días 10:00 – 13:00',
      imageAsset: require('../../../assets/events/kayak-rio-valdivia.webp'),
      imageWidth: 2000,
      imageHeight: 1333,
      address: 'Muelle de la Costanera Arturo Prat, frente a la Feria Fluvial',
      sectorName: 'Centro',
      ...recurring(EVERY_DAY, 10, 0, 180, now),
      schedule: [
        { label: 'Charla de seguridad y entrega de equipo', time: '09:45' },
        { label: 'Salida desde el muelle', time: '10:15' },
        { label: 'Paso bajo el puente Pedro de Valdivia', time: '11:00' },
        { label: 'Avistamiento de lobos marinos', time: '11:45' },
        { label: 'Regreso a la costanera', time: '12:45' },
      ],
      price: 25000,
      capacity: 16,
      attendeesCount: 9,
      likesCount: 87,
      ageRestriction: 'Desde 12 años; menores acompañados por un adulto',
      tips: [
        'Incluye kayak, remo, chaleco salvavidas y casco',
        'No se requiere experiencia previa',
        'Lleva ropa de cambio, protector solar y una botella de agua',
        'Se reprograma si hay viento fuerte o crecida del río',
      ],
      tags: ['kayak', 'rio', 'aventura'],
    },
    {
      id: 'destacado-canopy-parque-saval',
      title: 'Canopy en el Parque Saval',
      description:
        'Solo los fines de semana: vuela entre los árboles nativos del Parque Saval en una jornada ' +
        'gratuita de canopy para toda la familia. Hay un circuito familiar a baja altura y un circuito alto con tirolesas sobre el ' +
        'bosque, ambos con monitores e instructores certificados. Entre turnos puedes recorrer los ' +
        'senderos del parque, visitar la laguna y disfrutar de un picnic en las áreas verdes.',
      latitude: -39.8065,
      longitude: -73.2545,
      category: 'naturaleza',
      status: 'agendado',
      eventKind: 'dias',
      organizer: 'Municipalidad de Valdivia',
      organizerType: 'Municipalidad',
      organizerVerified: true,
      website: 'www.munivaldivia.cl',
      time: 'Sábados y domingos 11:00 – 17:00',
      imageAsset: require('../../../assets/events/canopy-parque-saval.webp'),
      imageWidth: 2000,
      imageHeight: 1333,
      address: 'Parque Saval, Isla Teja',
      sectorName: 'Isla Teja',
      ...recurring([6, 0], 11, 0, 360, now),
      schedule: [
        { label: 'Apertura e inscripción por turnos', time: '11:00' },
        { label: 'Circuito familiar', time: '11:30' },
        { label: 'Circuito alto sobre el bosque', time: '13:00' },
        { label: 'Último turno del día', time: '16:30' },
      ],
      price: 0,
      priceLabel: 'Gratis',
      capacity: 200,
      attendeesCount: 134,
      likesCount: 212,
      ageRestriction: 'Desde 8 años y 1,20 m de estatura; peso máximo 100 kg',
      accessibility: ['Baños accesibles en el parque', 'Senderos principales aptos para coches'],
      tips: [
        'Cupos por orden de llegada: inscríbete al llegar al parque',
        'Arnés y casco certificados incluidos',
        'Usa zapatillas cerradas y ropa cómoda; amarra el pelo largo',
        'Se suspende con lluvia intensa o viento fuerte',
      ],
      tags: ['canopy', 'naturaleza', 'familia'],
    },
    {
      id: 'destacado-noche-esmeralda',
      title: 'Hoy en Grado 13',
      description:
        'Grado 13 abre sus puertas como siempre en plena calle Esmeralda, el barrio bohemio de ' +
        'Valdivia. Terraza bajo las estrellas, coctelería de autor, cerveza artesanal valdiviana y ' +
        'una carta para picar o cenar. Los viernes y sábados la noche sigue con música en vivo y DJ. ' +
        'Un buen lugar para cerrar el día y conocer la vida nocturna de la ciudad.',
      latitude: -39.8177,
      longitude: -73.2399,
      category: 'musica',
      status: 'agendado',
      eventKind: 'publicitario',
      organizer: 'Grado 13',
      organizerType: 'Restobar · Calle Esmeralda',
      organizerVerified: true,
      time: 'Martes a sábado desde las 19:00',
      imageAsset: require('../../../assets/events/noche-esmeralda.webp'),
      imageWidth: 2000,
      imageHeight: 1333,
      address: 'Calle Esmeralda, barrio bohemio de Valdivia',
      sectorName: 'Centro',
      ...recurring([2, 3, 4, 5, 6], 19, 0, 480, now),
      schedule: [
        { label: 'Apertura y happy hour', time: '19:00' },
        { label: 'Cocina abierta', time: '19:00 – 01:00' },
        { label: 'Música en vivo (vie y sáb)', time: '22:30' },
        { label: 'Cierre', time: '03:00' },
      ],
      price: 0,
      priceLabel: 'Entrada liberada',
      capacity: 120,
      likesCount: 164,
      ageRestriction: 'Solo mayores de 18 años; se pide carnet en la entrada',
      tips: [
        'Happy hour de 19:00 a 21:00',
        'Carta para picar o cenar, con opciones vegetarianas',
        'Terraza techada y calefaccionada',
        'Reserva de mesas para grupos en el local',
        'Para volver, prefiere taxi o colectivo',
      ],
      tags: ['restobar', 'nocturno', 'esmeralda'],
    },
  ];
}
