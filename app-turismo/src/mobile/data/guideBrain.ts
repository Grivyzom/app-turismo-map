import type { MobileWeather } from '../hooks/useMobileWeather';
import { formatMeters, PlaceWithDistance, walkMinutes } from '../hooks/usePlacesData';

import { formatDurationShort, RecommendedRoute } from './routes';
import { categoryLabel, matchesQuickCategory, QuickCategory } from './categories';

export type GuideAction =
  | { type: 'route' }
  | { type: 'weather' }
  | { type: 'map'; category: QuickCategory }
  | { type: 'services'; query: string }
  | { type: 'sos' };

export interface GuideAnswer {
  text: string;
  places: PlaceWithDistance[];
  action?: { label: string; action: GuideAction };
}

interface GuideContext {
  places: PlaceWithDistance[];
  weather: MobileWeather | null;
  route: RecommendedRoute | null;
  sectorName: string;
  diet: string;
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const INTENTS: { category: QuickCategory; words: string[]; intro: string }[] = [
  {
    category: 'comer',
    words: [
      'comer',
      'comida',
      'restaurant',
      'almorz',
      'cenar',
      'cafe',
      'cerveza',
      'hambre',
      'mercado',
      'once',
    ],
    intro: 'Para comer cerca tienes estas opciones',
  },
  {
    category: 'naturaleza',
    words: [
      'parque',
      'naturaleza',
      'bosque',
      'humedal',
      'rio',
      'caminar',
      'aire libre',
      'sendero',
      'fauna',
      'lobo',
    ],
    intro: 'Para disfrutar la naturaleza te sugiero',
  },
  {
    category: 'cultura',
    words: [
      'museo',
      'cultura',
      'historia',
      'arte',
      'teatro',
      'torreon',
      'patrimonio',
      'bajo techo',
      'llueve',
      'lluvia',
    ],
    intro: 'Para un panorama cultural te recomiendo',
  },
  {
    category: 'transporte',
    words: [
      'lancha',
      'bote',
      'navegar',
      'muelle',
      'transporte',
      'embarca',
      'puerto',
      'micro',
      'bus',
    ],
    intro: 'Para moverte por el río y la ciudad',
  },
];

/**
 * Guía conversacional local: interpreta la pregunta por palabras clave y responde
 * con lugares reales del catálogo, el clima y la ruta del día. No requiere conexión a un LLM.
 */
export function answerQuestion(question: string, ctx: GuideContext): GuideAnswer {
  const q = normalize(question);
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has('emergencia', 'sos', 'ayuda urgente', 'ambulancia', 'carabinero', 'robo', 'accidente')) {
    return {
      text: 'Si es una emergencia, llama de inmediato. Ambulancia 131, Bomberos 132, Carabineros 133.',
      places: [],
      action: { label: 'Abrir emergencias', action: { type: 'sos' } },
    };
  }

  if (has('farmacia', 'cajero', 'banco', 'bano', 'wc')) {
    const query = has('farmacia')
      ? 'farmacia de turno'
      : has('cajero', 'banco')
        ? 'cajero automático'
        : 'baño público';
    return {
      text: `Busco ${query} cerca de ti en tu app de mapas.`,
      places: [],
      action: { label: `Buscar ${query}`, action: { type: 'services', query } },
    };
  }

  if (has('clima', 'tiempo', 'temperatura', 'llover', 'paraguas', 'frio', 'calor')) {
    const w = ctx.weather;
    if (!w)
      return {
        text: 'Aún estoy cargando el clima de tu sector. Intenta en un momento.',
        places: [],
      };
    const umbrella = w.isRainy ? ' Lleva paraguas.' : '';
    return {
      text: `En ${ctx.sectorName} hay ${w.temp}° y ${w.condition.toLowerCase()} (máx ${w.max}°, mín ${w.min}°). Lluvia ${w.rainProb}%.${umbrella} ${w.recommendation}`,
      places: [],
      action: { label: 'Ver clima completo', action: { type: 'weather' } },
    };
  }

  if (has('ruta', 'recorrido', 'itinerario', 'que hago', 'que hacer', 'plan', 'hoy')) {
    const r = ctx.route;
    if (!r) {
      return {
        text: 'No encontré suficientes lugares cerca para armar una ruta. Prueba cambiando de sector.',
        places: [],
      };
    }
    return {
      text: `Te armé "${r.title}": ${r.stops.length} paradas en unas ${formatDurationShort(r.totalMinutes)}, todo a pie.`,
      places: r.stops.map((s) => s.place),
      action: { label: 'Ver ruta', action: { type: 'route' } },
    };
  }

  for (const intent of INTENTS) {
    if (has(...intent.words)) {
      const list = ctx.places.filter((p) => matchesQuickCategory(p, intent.category)).slice(0, 3);
      if (list.length === 0) {
        return {
          text: 'No encontré lugares de ese tipo cerca. Prueba en otro sector.',
          places: [],
        };
      }
      const diet =
        intent.category === 'comer' && ctx.diet.trim()
          ? ` Ojo: consulta en el local por opciones ${ctx.diet.trim()}.`
          : '';
      return {
        text: `${intent.intro}. ${list[0].title} está a ${formatMeters(list[0].distanceMeters)} (${walkMinutes(list[0].distanceMeters)} min a pie).${diet}`,
        places: list,
        action: { label: 'Ver en el mapa', action: { type: 'map', category: intent.category } },
      };
    }
  }

  // Búsqueda libre por nombre
  const byName =
    q.length < 3
      ? []
      : ctx.places.filter((p) => {
          const title = normalize(p.title ?? '');
          return title.length >= 3 && (title.includes(q) || q.includes(title));
        });
  if (byName.length > 0) {
    const p = byName[0];
    return {
      text: `${p.title} (${categoryLabel(p.category)}) está a ${formatMeters(p.distanceMeters)} de ti.${p.openingHours ? ` Horario: ${p.openingHours}.` : ''}`,
      places: byName.slice(0, 3),
    };
  }

  const top = ctx.places.slice(0, 3);
  return {
    text: 'No estoy seguro de haber entendido. Puedes preguntarme por comida, museos, parques, el clima o una ruta para hoy. Mientras, esto es lo más cercano:',
    places: top,
  };
}

export const GUIDE_SUGGESTIONS = [
  '¿Qué hago hoy?',
  '¿Dónde comer cerca?',
  '¿Va a llover?',
  'Museos cerca',
  'Paseo en lancha',
];
