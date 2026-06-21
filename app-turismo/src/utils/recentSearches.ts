import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_KEY = 'app-turismo.recent-searches';
const MAX_RECENT_SEARCHES = 10;

export interface RecentSearch {
  id: string;
  query: string;
  category: string;
  timestamp: number;
}

/**
 * Agrega una búsqueda al historial reciente de forma ultra ligera.
 */
export async function addRecentSearch(query: string, category: string = 'todos'): Promise<void> {
  if (!query.trim()) return;

  try {
    const currentStr = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    let searches: RecentSearch[] = currentStr ? JSON.parse(currentStr) : [];

    // Filtrar la búsqueda exacta si ya existe (para moverla al principio y no duplicarla)
    searches = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase().trim());

    // Agregar nueva búsqueda al inicio
    const newSearch: RecentSearch = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      query: query.trim(),
      category,
      timestamp: Date.now(),
    };

    searches.unshift(newSearch);

    // Mantener la lista ultra ligera limitando al máximo establecido
    if (searches.length > MAX_RECENT_SEARCHES) {
      searches = searches.slice(0, MAX_RECENT_SEARCHES);
    }

    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    console.error('Error saving recent search:', error);
  }
}

/**
 * Obtiene el historial de búsquedas recientes.
 */
export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const currentStr = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (currentStr) {
      return JSON.parse(currentStr);
    }
  } catch (error) {
    console.error('Error getting recent searches:', error);
  }
  return [];
}

/**
 * Elimina una búsqueda específica del historial.
 */
export async function removeRecentSearch(id: string): Promise<void> {
  try {
    const currentStr = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (currentStr) {
      let searches: RecentSearch[] = JSON.parse(currentStr);
      searches = searches.filter((s) => s.id !== id);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    }
  } catch (error) {
    console.error('Error removing recent search:', error);
  }
}

/**
 * Limpia todo el historial de búsquedas recientes de inmediato.
 */
export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch (error) {
    console.error('Error clearing recent searches:', error);
  }
}
