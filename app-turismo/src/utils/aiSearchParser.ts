import * as FileSystem from 'expo-file-system';
import { FileSystemUploadType } from 'expo-file-system/legacy';

// Define types based on index.tsx
export type ParsedSearch = {
  category: string;
  query: string;
  originalText: string;
  isFinal?: boolean;
  eventId?: string;
};

/**
 * Envia el audio a la API del transcriptor para convertir voz a texto.
 * Si el backend no está conectado, usa un mock para demostración de UI.
 */
export async function processAudioSearch(audioUri: string): Promise<ParsedSearch> {
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL;

  if (!backendUrl) {
    // ---- MOCK PARA PRUEBAS DE UI ----
    console.log(
      'No EXPO_PUBLIC_BACKEND_URL or EXPO_PUBLIC_API_URL found. Using mock transcription.',
    );
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
    const normalizedBaseUrl = backendUrl.replace(/\/$/, '');
    const audioUriLower = audioUri.toLowerCase();
    const isWhatsappAudio = audioUriLower.includes('whatsapp') || audioUriLower.endsWith('.opus');
    const mimeType = audioUriLower.endsWith('.wav')
      ? 'audio/wav'
      : audioUriLower.endsWith('.mp3')
        ? 'audio/mpeg'
        : audioUriLower.endsWith('.opus')
          ? 'audio/opus'
          : audioUriLower.endsWith('.caf')
            ? 'audio/x-caf'
            : 'audio/m4a';

    const uploadResult = await FileSystem.uploadAsync(
      `${normalizedBaseUrl}/transcribir`,
      audioUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType,
        parameters: {
          modelo: 'medium',
          whatsapp: String(isWhatsappAudio),
          formato_salida: 'json',
          usar_cache: 'true',
        },
      },
    );

    if (uploadResult.status === 200) {
      // Se espera que el backend retorne JSON con { transcripcion: { limpia, literal } }
      const data = JSON.parse(uploadResult.body);

      const transcript =
        data?.transcripcion?.limpia ||
        data?.transcripcion?.literal ||
        data?.text ||
        data?.originalText ||
        '';

      // Fallback manual en caso de que el backend solo retorne texto sin clasificar
      let category = data.category || 'todos';
      let query = data.query || transcript || '';

      if (!data.category) {
        // Simple NLP local fallback si el backend no clasifica
        const lowerText = query.toLowerCase();
        if (
          lowerText.includes('comer') ||
          lowerText.includes('comida') ||
          lowerText.includes('hambre')
        ) {
          category = 'gastronomia';
        } else if (lowerText.includes('museo') || lowerText.includes('historia')) {
          category = 'cultura';
        } else if (lowerText.includes('parque') || lowerText.includes('naturaleza')) {
          category = 'naturaleza';
        } else if (lowerText.includes('musica') || lowerText.includes('concierto')) {
          category = 'musica';
        } else if (lowerText.includes('deporte') || lowerText.includes('futbol')) {
          category = 'deportes';
        } else if (
          lowerText.includes('choque') ||
          lowerText.includes('incendio') ||
          lowerText.includes('fuego') ||
          lowerText.includes('accidente') ||
          lowerText.includes('calle cortada') ||
          lowerText.includes('cortada') ||
          lowerText.includes('bloqueo') ||
          lowerText.includes('transito') ||
          lowerText.includes('bomberos') ||
          lowerText.includes('emergencia')
        ) {
          category = 'emergencia';
        }
      }

      return {
        category,
        query,
        originalText: transcript || '',
      };
    } else {
      throw new Error(`Server returned status ${uploadResult.status}`);
    }
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
}
