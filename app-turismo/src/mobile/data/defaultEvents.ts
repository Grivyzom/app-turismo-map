import type { TurismoEvent } from '../../components/Map/types';

/**
 * Eventos destacados por defecto, con ilustraciones originales empaquetadas en la app.
 * Se muestran mientras la agenda del backend no traiga eventos propios.
 *
 * Las fechas son recurrentes: cada evento se ubica en su próxima ocurrencia semanal
 * (o en la actual, si está en curso), así la ficha nunca muestra un evento vencido.
 */

const DAY_MS = 24 * 3600_000;

/** Próxima ocurrencia (o la que está en curso) de un evento semanal. weekday: 0 = domingo. */
function weekly(
  weekday: number,
  hour: number,
  minute: number,
  durationMin: number,
  now: Date,
): { startTime: string; endTime: string } {
  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  start.setDate(start.getDate() + ((weekday - now.getDay() + 7) % 7));
  const duration = durationMin * 60_000;
  // La ocurrencia de la semana pasada podría seguir en curso (eventos que cruzan la medianoche)
  const previous = new Date(start.getTime() - 7 * DAY_MS);
  if (previous.getTime() + duration > now.getTime()) start.setTime(previous.getTime());
  else if (start.getTime() + duration <= now.getTime()) start.setTime(start.getTime() + 7 * DAY_MS);
  return {
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + duration).toISOString(),
  };
}

export function buildDefaultEvents(now = new Date()): TurismoEvent[] {
  return [
    {
      id: 'destacado-kayak-rio-valdivia',
      title: 'Travesía en kayak por el río Valdivia',
      description:
        'Rema por el corazón de Valdivia y descubre la ciudad desde el agua. Salimos desde la costanera, ' +
        'cruzamos bajo el puente Pedro de Valdivia y seguimos el río entre lobos marinos, garzas y ' +
        'cisnes. Guías certificados acompañan al grupo en todo momento y la ruta se adapta al nivel ' +
        'de cada participante, así que no necesitas experiencia previa: solo ganas de mojarte un poco.',
      latitude: -39.8141,
      longitude: -73.245,
      category: 'deportes',
      status: 'agendado',
      organizer: 'Río Vivo Kayak',
      organizerType: 'Operador turístico',
      organizerVerified: true,
      time: 'Sábados 10:00 – 13:00',
      imageAsset: require('../../../assets/events/kayak-rio-valdivia.webp'),
      imageWidth: 2000,
      imageHeight: 1333,
      address: 'Muelle de la Costanera Arturo Prat, frente a la Feria Fluvial',
      sectorName: 'Centro',
      ...weekly(6, 10, 0, 180, now),
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
        'Vuela entre los árboles nativos del Parque Saval en una jornada gratuita de canopy para toda ' +
        'la familia. Hay un circuito familiar a baja altura y un circuito alto con tirolesas sobre el ' +
        'bosque, ambos con monitores e instructores certificados. Entre turnos puedes recorrer los ' +
        'senderos del parque, visitar la laguna y disfrutar de un picnic en las áreas verdes.',
      latitude: -39.8065,
      longitude: -73.2545,
      category: 'naturaleza',
      status: 'agendado',
      organizer: 'Municipalidad de Valdivia',
      organizerType: 'Municipalidad',
      organizerVerified: true,
      website: 'www.munivaldivia.cl',
      time: 'Domingos 11:00 – 17:00',
      imageAsset: require('../../../assets/events/canopy-parque-saval.webp'),
      imageWidth: 2000,
      imageHeight: 1333,
      address: 'Parque Saval, Isla Teja',
      sectorName: 'Isla Teja',
      ...weekly(0, 11, 0, 360, now),
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
      title: 'Noche en Esmeralda',
      description:
        'La calle Esmeralda se enciende cuando cae la noche. Grado 13 abre su terraza bajo las ' +
        'estrellas con música en vivo, DJ hasta la madrugada y la mejor coctelería y cerveza artesanal ' +
        'valdiviana. Un plan perfecto para cerrar el día conociendo la vida nocturna de la ciudad, ' +
        'en el barrio bohemio a pasos del centro.',
      latitude: -39.8177,
      longitude: -73.2399,
      category: 'musica',
      status: 'agendado',
      organizer: 'Grado 13',
      organizerType: 'Bar y terraza · Calle Esmeralda',
      organizerVerified: true,
      time: 'Viernes 21:00 – 03:00',
      imageAsset: require('../../../assets/events/noche-esmeralda.webp'),
      imageWidth: 2000,
      imageHeight: 1333,
      address: 'Calle Esmeralda, barrio bohemio de Valdivia',
      sectorName: 'Centro',
      ...weekly(5, 21, 0, 360, now),
      schedule: [
        { label: 'Apertura de terraza y happy hour', time: '21:00' },
        { label: 'Música en vivo', time: '22:30' },
        { label: 'DJ set', time: '00:30' },
        { label: 'Cierre', time: '03:00' },
      ],
      price: 5000,
      priceLabel: 'Cover $5.000',
      capacity: 120,
      likesCount: 164,
      ageRestriction: 'Solo mayores de 18 años; se pide carnet en la entrada',
      tips: [
        'El cover incluye un trago de bienvenida',
        'Terraza techada y calefaccionada',
        'Reserva de mesas para grupos en el local',
        'Para volver, prefiere taxi o colectivo',
      ],
      tags: ['nocturno', 'musica', 'esmeralda'],
    },
  ];
}
