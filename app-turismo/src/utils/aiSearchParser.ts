import * as FileSystem from 'expo-file-system';
import { FileSystemUploadType } from 'expo-file-system/legacy';




// Define types based on index.tsx
export type ParsedSearch = {
  category: string;
  query: string;
  originalText: string;
};

/**
 * Envia el audio al servidor del usuario para transcribir.
 * Si el backend no está conectado, usa un mock para demostración de UI.
 */
export async function processAudioSearch(audioUri: string): Promise<ParsedSearch> {
  const backendUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (!backendUrl) {
    // ---- MOCK PARA PRUEBAS DE UI ----
    console.log('No EXPO_PUBLIC_API_URL found. Using mock transcription.');
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulamos que la IA entendió algo sobre comida
        resolve({
          category: 'gastronomia',
          query: 'comida rica',
          originalText: 'Quiero comer algo de comida rica cerca de mí',
        });
      }, 2000);
    });
  }

  // ---- INTEGRACIÓN REAL CON EL SERVIDOR ----
  try {
    const uploadResult = await FileSystem.uploadAsync(
      `${backendUrl}/api/transcribe`,
      audioUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a', // Dependiendo del OS puede ser m4a o caf
      }
    );

    if (uploadResult.status === 200) {
      // Se espera que el backend retorne JSON con { text, category, query }
      const data = JSON.parse(uploadResult.body);
      
      // Fallback manual en caso de que el backend solo retorne texto
      let category = data.category || 'todos';
      let query = data.query || data.text || '';

      if (!data.category) {
        // Simple NLP local fallback si el backend no clasifica
        const lowerText = query.toLowerCase();
        if (lowerText.includes('comer') || lowerText.includes('comida') || lowerText.includes('hambre')) {
          category = 'gastronomia';
        } else if (lowerText.includes('museo') || lowerText.includes('historia')) {
          category = 'cultura';
        } else if (lowerText.includes('parque') || lowerText.includes('naturaleza')) {
          category = 'naturaleza';
        } else if (lowerText.includes('musica') || lowerText.includes('concierto')) {
          category = 'musica';
        } else if (lowerText.includes('deporte') || lowerText.includes('futbol')) {
          category = 'deportes';
        }
      }

      return {
        category,
        query,
        originalText: data.text || '',
      };
    } else {
      throw new Error(`Server returned status ${uploadResult.status}`);
    }
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
}
