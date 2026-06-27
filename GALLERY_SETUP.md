# Sistema de Galerías para Pines - Configuración

## Instalación

### 1. Instalar LightGallery (Cuando npm funcione)

```bash
cd app-turismo
npm install lightgallery lg-thumbnail lg-zoom
# O con yarn
yarn add lightgallery lg-thumbnail lg-zoom
```

### 2. Incluir estilos en componentes web (opcional para avanzado)

Los estilos de LightGallery se cargan dinámicamente. Si necesitas customizar:

```html
<!-- En public/index.html o en _app.tsx -->
<link type="text/css" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/lightgallery-bundle.min.css" />
```

## Estructura

### Componentes

- **PinGallery.tsx** - Componente que renderiza galería
  - Web: Usa LightGallery con plugins (thumbnail, zoom)
  - Mobile: Usa ScrollView horizontal como fallback
  
- **pinGalleryApi.ts** - API de almacenamiento (localStorage)
  - `getGallery(pinId)` - Obtener imágenes de un pin
  - `setGallery(pinId, title, category, images)` - Crear/actualizar galería
  - `addImageToGallery(pinId, imageUrl)` - Agregar imagen
  - `removeImageFromGallery(pinId, imageUrl)` - Remover imagen
  - `getAllGalleries()` - Obtener todas
  - `searchGalleries(query)` - Buscar por nombre
  - `getGalleriesByCategory(category)` - Filtrar por categoría

### Página Dev

**Ruta:** `/dev/gallery-manager`

Interfaz para:
- Listar galerías creadas (búsqueda por nombre)
- Agregar/remover imágenes a galerías existentes
- Eliminar galerías completas
- Vista previa en grid

## Uso

### 1. Crear una Galería para un Pin

```typescript
import { pinGalleryApi } from '@/utils/pinGalleryApi';

// Crear galería con imágenes iniciales
await pinGalleryApi.setGallery(
  'parque-123', // pinId
  'Parque Central', // pinTitle
  'parque', // category
  [
    'https://example.com/img1.jpg',
    'https://example.com/img2.jpg',
    'https://example.com/img3.jpg'
  ],
  'Imágenes del parque principal' // description (opcional)
);
```

### 2. Agregar Imagen a Galería Existente

```typescript
await pinGalleryApi.addImageToGallery(
  'parque-123',
  'https://example.com/newimg.jpg'
);
```

### 3. En MiniModal (Automático)

El MiniModal carga automáticamente las imágenes:

```typescript
// En MiniModal.tsx ya está integrado
// Las imágenes se cargan de pinGalleryApi si existen
// Si no, usa event.galeria como fallback
```

### 4. Usar PinGallery en otro componente

```typescript
import { PinGallery } from '@/components/ui/PinGallery';

<PinGallery
  images={['https://...', 'https://...']}
  pinTitle="Mi Pin"
  isLightMode={false}
  onImageClick={(index) => console.log('Clicked', index)}
/>
```

## Categorías Soportadas

Ideales para galerías (turísticos/históricos):
- `fauna` - Fauna local
- `bosque` - Bosques y áreas forestales
- `agua` - Cuerpos de agua
- `humedal` - Humedales
- `parque` - Parques
- `museo` - Museos
- `teatro` - Teatros
- `escultura` - Esculturas
- `torreon` - Torreones
- `estatua` - Estatuas
- `arte` - Arte y murales

## Almacenamiento

### Actual (localStorage)

- Datos persistentes en el navegador
- Máx ~5-10MB por dominio
- Se pierden si se borra caché del navegador

### Futuro (Backend)

Cuando se implemente:
1. Crear tabla `pin_galleries` en DB
2. API endpoints:
   - `POST /api/pins/{pinId}/gallery` - Crear/actualizar
   - `GET /api/pins/{pinId}/gallery` - Obtener
   - `PUT /api/pins/{pinId}/gallery/{imageId}` - Actualizar imagen
   - `DELETE /api/pins/{pinId}/gallery/{imageId}` - Eliminar

3. Reemplazar `pinGalleryApi.ts` con llamadas a backend

## Ejemplo Completo

```typescript
// En un componente cualquiera
import { pinGalleryApi } from '@/utils/pinGalleryApi';

async function setupDemoGallery() {
  // Crear galería para fauna
  await pinGalleryApi.setGallery(
    'fauna-valdivia-1',
    'Fauna de Valdivia',
    'fauna',
    [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Pudu.jpg/640px-Pudu.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Condor_des_Andes_distribution.jpg/640px-Condor_des_Andes_distribution.jpg'
    ]
  );

  // Obtener
  const images = await pinGalleryApi.getGallery('fauna-valdivia-1');
  console.log('Images:', images);

  // Agregar más
  await pinGalleryApi.addImageToGallery(
    'fauna-valdivia-1',
    'https://example.com/newanimal.jpg'
  );
}
```

## Development

### Testing en Dev Dashboard

1. Abrir `/dev/` (God Mode Dashboard)
2. Click en "Pin Gallery"
3. Crear galería o agregar a existente
4. Ver en MiniModal en mapa

### Console Debug

```javascript
// En browser console
const { pinGalleryApi } = await import('@/utils/pinGalleryApi');

// Ver todas
pinGalleryApi.getAllGalleries();

// Limpiar (¡cuidado!)
pinGalleryApi.clearAllGalleries();

// Buscar
pinGalleryApi.searchGalleries('Fauna');

// Por categoría
pinGalleryApi.getGalleriesByCategory('fauna');
```

## Notas

- Las URLs de imágenes deben ser públicas/accesibles en la web
- Los emojis también se soportan como "imágenes" (ej: "🦅", "🌳")
- El componente detecta automáticamente si es imagen o emoji
- LightGallery en web solo se inicializa si hay >1 imagen
- Mobile siempre usa ScrollView (compatible con Expo)
