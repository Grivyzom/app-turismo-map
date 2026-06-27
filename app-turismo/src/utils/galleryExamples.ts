import { pinGalleryApi } from './pinGalleryApi';

/**
 * Ejemplos de galerías predefinidas para categorías turísticas/históricas.
 * Usa URLs públicas de Wikimedia Commons / Unsplash
 */

export const GALLERY_EXAMPLES = {
  fauna: [
    {
      pinId: 'fauna-valdivia-puma',
      pinTitle: 'Puma de Valdivia',
      category: 'fauna',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Puma_451.jpg/800px-Puma_451.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Mountain_lion.jpg/800px-Mountain_lion.jpg',
      ],
      description: 'Grandes felinos nativos de la Región de Los Ríos',
    },
    {
      pinId: 'fauna-valdivia-huemul',
      pinTitle: 'Huemul del Sur',
      category: 'fauna',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Hippocamelus_bisulcus.jpg/800px-Hippocamelus_bisulcus.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Huemul_%28cropped%29.jpg/640px-Huemul_%28cropped%29.jpg',
      ],
      description: 'Ciervo endémico en peligro de extinción',
    },
    {
      pinId: 'fauna-valdivia-condor',
      pinTitle: 'Cóndor Andino',
      category: 'fauna',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Vultur_gryphus_in_Huachuca_Mountains.jpg/800px-Vultur_gryphus_in_Huachuca_Mountains.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Condor_des_Andes_distribution.jpg/800px-Condor_des_Andes_distribution.jpg',
      ],
      description: 'Ave icónica de Los Andes',
    },
  ],
  bosque: [
    {
      pinId: 'bosque-valdivia-nothofagus',
      pinTitle: 'Bosque Nothofagus',
      category: 'bosque',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Southern_beech_forest%2C_Chilean_Patagonia.jpg/800px-Southern_beech_forest%2C_Chilean_Patagonia.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Beeches_in_Argentina_04.jpg/800px-Beeches_in_Argentina_04.jpg',
      ],
      description: 'Bosques templados con hayas del sur',
    },
    {
      pinId: 'bosque-valdivia-rainforest',
      pinTitle: 'Bosque Húmedo Templado',
      category: 'bosque',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Chilean_temperate_rainforest_in_the_Lake_District.jpg/800px-Chilean_temperate_rainforest_in_the_Lake_District.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Valdivian_temperate_rainforest.jpg/800px-Valdivian_temperate_rainforest.jpg',
      ],
      description: 'Selva templada sudamericana, Patrimonio Mundial UNESCO',
    },
  ],
  agua: [
    {
      pinId: 'agua-valdivia-rio',
      pinTitle: 'Río Valdivia',
      category: 'agua',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Rio_Valdivia_2.jpg/800px-Rio_Valdivia_2.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Valdivia_river.jpg/800px-Valdivia_river.jpg',
      ],
      description: 'Principal río de la región',
    },
  ],
  humedal: [
    {
      pinId: 'humedal-valdivia-carampangue',
      pinTitle: 'Humedal Carampangue',
      category: 'humedal',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Wetland_ecosystem.jpg/800px-Wetland_ecosystem.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Marsh_habitat.jpg/800px-Marsh_habitat.jpg',
      ],
      description: 'Ecosistema de importancia internacional (Ramsar)',
    },
  ],
  museo: [
    {
      pinId: 'museo-valdivia-fortified-city',
      pinTitle: 'Museo de la Ciudad Fortificada',
      category: 'museo',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Colonial_Valdivia_fortification.jpg/800px-Colonial_Valdivia_fortification.jpg',
      ],
      description: 'Historia colonial de Valdivia',
    },
  ],
  escultura: [
    {
      pinId: 'escultura-valdivia-general',
      pinTitle: 'Monumento General Liberador',
      category: 'escultura',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Monument_in_plaza.jpg/800px-Monument_in_plaza.jpg',
      ],
      description: 'Escultura pública histórica',
    },
  ],
  parque: [
    {
      pinId: 'parque-valdivia-saval',
      pinTitle: 'Parque Saval',
      category: 'parque',
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Urban_park_in_city.jpg/800px-Urban_park_in_city.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Green_space_urban.jpg/800px-Green_space_urban.jpg',
      ],
      description: 'Parque urbano principal',
    },
  ],
};

/**
 * Inicializar galerías de ejemplo (para dev/testing)
 * Llamar una sola vez para poblar localStorage con ejemplos
 */
export async function initializeExampleGalleries() {
  const allGalleries = pinGalleryApi.getAllGalleries();

  // Solo inicializar si no hay galerías existentes
  if (allGalleries.length > 0) {
    console.log('Galleries already exist, skipping initialization');
    return;
  }

  console.log('Initializing example galleries...');

  try {
    for (const category in GALLERY_EXAMPLES) {
      const examples = (GALLERY_EXAMPLES as any)[category];

      for (const example of examples) {
        await pinGalleryApi.setGallery(
          example.pinId,
          example.pinTitle,
          example.category,
          example.images,
          example.description,
        );
      }
    }

    console.log('✓ Example galleries initialized successfully');
  } catch (error) {
    console.error('Error initializing galleries:', error);
  }
}

/**
 * Limpiar todas las galerías (dev only)
 */
export function clearDemoGalleries() {
  pinGalleryApi.clearAllGalleries();
  console.log('✓ All galleries cleared');
}

/**
 * Log de galerías actuales (dev debug)
 */
export function logCurrentGalleries() {
  const galleries = pinGalleryApi.getAllGalleries();
  console.table(galleries);
  return galleries;
}
