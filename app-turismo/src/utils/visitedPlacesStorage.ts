import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlaceItem } from '../components/ui/BottomPlaceCarousel';

const STORAGE_KEY = 'app-turismo.visited-places';
const MAX_HISTORY = 50;

export async function addVisitedPlace(place: PlaceItem): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let items: PlaceItem[] = raw ? JSON.parse(raw) : [];
    // move to front if already exists
    items = items.filter((i) => String(i.id) !== String(place.id));
    items.unshift(place);
    if (items.length > MAX_HISTORY) items = items.slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('visitedPlaces.add:', e);
  }
}

export async function getVisitedPlaces(): Promise<PlaceItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('visitedPlaces.get:', e);
    return [];
  }
}

export async function clearVisitedPlaces(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('visitedPlaces.clear:', e);
  }
}
