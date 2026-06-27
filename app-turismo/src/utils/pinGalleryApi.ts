import { TurismoEvent } from '../components/Map/types';

// Storage key para persistencia local de galerías
const GALLERY_STORAGE_KEY = 'pin_galleries';

export interface PinGalleryData {
  pinId: string;
  pinTitle: string;
  category: string;
  images: string[];
  uploadedAt: number;
  description?: string;
}

class PinGalleryApi {
  /**
   * Obtener galería de un pin específico
   */
  async getGallery(pinId: string): Promise<string[]> {
    const galleries = this.getAllGalleries();
    const gallery = galleries.find((g) => g.pinId === pinId);
    return gallery?.images || [];
  }

  /**
   * Agregar/actualizar galería para un pin
   */
  async setGallery(
    pinId: string,
    pinTitle: string,
    category: string,
    images: string[],
    description?: string,
  ): Promise<PinGalleryData> {
    const galleries = this.getAllGalleries();
    const existingIndex = galleries.findIndex((g) => g.pinId === pinId);

    const galleryData: PinGalleryData = {
      pinId,
      pinTitle,
      category,
      images,
      uploadedAt: Date.now(),
      description,
    };

    if (existingIndex >= 0) {
      galleries[existingIndex] = galleryData;
    } else {
      galleries.push(galleryData);
    }

    this.saveGalleries(galleries);
    return galleryData;
  }

  /**
   * Agregar una imagen a la galería existente
   */
  async addImageToGallery(pinId: string, imageUrl: string): Promise<string[]> {
    const galleries = this.getAllGalleries();
    const gallery = galleries.find((g) => g.pinId === pinId);

    if (!gallery) {
      throw new Error(`Gallery not found for pin ${pinId}`);
    }

    if (!gallery.images.includes(imageUrl)) {
      gallery.images.push(imageUrl);
      this.saveGalleries(galleries);
    }

    return gallery.images;
  }

  /**
   * Remover imagen de galería
   */
  async removeImageFromGallery(pinId: string, imageUrl: string): Promise<string[]> {
    const galleries = this.getAllGalleries();
    const gallery = galleries.find((g) => g.pinId === pinId);

    if (!gallery) {
      throw new Error(`Gallery not found for pin ${pinId}`);
    }

    gallery.images = gallery.images.filter((img) => img !== imageUrl);
    this.saveGalleries(galleries);

    return gallery.images;
  }

  /**
   * Obtener todas las galerías
   */
  getAllGalleries(): PinGalleryData[] {
    if (typeof window === 'undefined') return [];

    try {
      const data = localStorage.getItem(GALLERY_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading galleries from localStorage:', error);
      return [];
    }
  }

  /**
   * Guardar galerías en localStorage
   */
  private saveGalleries(galleries: PinGalleryData[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(galleries));
    } catch (error) {
      console.error('Error saving galleries to localStorage:', error);
    }
  }

  /**
   * Enriquecer evento con imágenes de su galería
   */
  async enrichEventWithGallery(event: TurismoEvent): Promise<TurismoEvent> {
    const images = await this.getGallery(event.id);
    return {
      ...event,
      galeria: images.length > 0 ? images : event.galeria,
    };
  }

  /**
   * Obtener galerías filtradas por categoría
   */
  getGalleriesByCategory(category: string): PinGalleryData[] {
    return this.getAllGalleries().filter((g) => g.category === category);
  }

  /**
   * Buscar galerías por título de pin
   */
  searchGalleries(query: string): PinGalleryData[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllGalleries().filter((g) => g.pinTitle.toLowerCase().includes(lowerQuery));
  }

  /**
   * Limpiar todas las galerías (dev only)
   */
  clearAllGalleries(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(GALLERY_STORAGE_KEY);
  }
}

export const pinGalleryApi = new PinGalleryApi();
