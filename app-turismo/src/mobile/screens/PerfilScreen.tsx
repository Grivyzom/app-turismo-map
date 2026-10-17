import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import { useMobileApp } from '../MobileAppContext';
import { AppHeader } from '../components/AppHeader';
import { Option, SelectField } from '../components/OptionSheet';
import { Screen } from '../components/Screen';
import {
  Avatar,
  Card,
  Chip,
  FieldLabel,
  Hint,
  OutlineButton,
  PillButton,
  PrimaryButton,
  Segmented,
  T,
  ToggleRow,
  useColors,
} from '../components/ui';
import {
  Budget,
  CurrencyCode,
  DayRhythm,
  LanguageCode,
  LocationUse,
  TextSize,
  TransportKey,
} from '../hooks/useMobilePreferences';
import { removeOfflineSnapshot, saveOfflineSnapshot } from '../hooks/usePlacesData';
import { PlaceRow } from '../sections/PlaceRow';
import { MobileFont, MobileRadii } from '../theme';

const RHYTHMS: { key: DayRhythm; label: string }[] = [
  { key: 'tranquilo', label: 'Tranquilo' },
  { key: 'moderado', label: 'Moderado' },
  { key: 'intenso', label: 'Intenso' },
];
const BUDGETS: { key: Budget; label: string }[] = [
  { key: 'economico', label: 'Económico' },
  { key: 'medio', label: 'Medio' },
  { key: 'alto', label: 'Alto' },
];
const TRANSPORTS: { key: TransportKey; label: string }[] = [
  { key: 'a_pie', label: 'A pie' },
  { key: 'bicicleta', label: 'Bicicleta' },
  { key: 'micro', label: 'Micro o colectivo' },
  { key: 'auto', label: 'Auto' },
  { key: 'lancha', label: 'Lancha' },
];
const TEXT_SIZES: { key: TextSize; label: string; labelStyle: object }[] = [
  { key: 'sm', label: 'A', labelStyle: { fontSize: 13 } },
  { key: 'md', label: 'A', labelStyle: { fontSize: 16 } },
  { key: 'lg', label: 'A', labelStyle: { fontSize: 20 } },
];
const LANGUAGES: Option<LanguageCode>[] = [
  { key: 'es', label: 'Español' },
  { key: 'en', label: 'English' },
  { key: 'pt', label: 'Português' },
];
const CURRENCIES: Option<CurrencyCode>[] = [
  { key: 'CLP', label: 'CLP · Peso chileno' },
  { key: 'USD', label: 'USD · Dólar' },
  { key: 'EUR', label: 'EUR · Euro' },
  { key: 'ARS', label: 'ARS · Peso argentino' },
  { key: 'BRL', label: 'BRL · Real' },
];
const QUIET_HOURS: Option<string>[] = ['20:00', '21:00', '22:00', '23:00', '00:00', 'off'].map(
  (h) => ({
    key: h,
    label: h === 'off' ? 'Nunca' : h,
  }),
);
const LOCATION_USE: Option<LocationUse>[] = [
  { key: 'uso', label: 'Solo mientras uso la app' },
  { key: 'siempre', label: 'Siempre', hint: 'Necesario para avisos de eventos cercanos' },
  { key: 'nunca', label: 'Nunca', hint: 'Usarás el sector elegido a mano' },
];

const OFFLINE_RADIUS_M = 5000;

const ACCOUNT_PERKS = [
  'Guardar tu alojamiento y volver a él con un toque',
  'Ajustar ritmo, presupuesto, transporte y dieta',
  'Elegir qué avisos recibir',
  'Descargar el mapa de tu sector para usarlo sin conexión',
  'Configurar tu contacto de emergencia y compartir tu ruta',
  'Ver tus eventos guardados',
];

export function PerfilScreen() {
  const { prefs, updatePrefs, resetPrefs, places, sectorName, openOnMap, isGuest, requireAccount } =
    useMobileApp();
  const { isAuthenticated, openAuthModal, signOut } = useAuth();
  const colors = useColors();
  const [locating, setLocating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [offlineSize, setOfflineSize] = useState<number | null>(null);

  const offlineDone = prefs.offline.downloadedSectors.includes(sectorName);
  const saved = places.filter((p) => prefs.savedEventIds.includes(String(p.id)));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Fotos', 'Activa el acceso a tus fotos para cambiar la foto de perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) updatePrefs({ photoUri: result.assets[0].uri });
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Ubicación', 'Activa el permiso de ubicación para usar tu posición actual.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync(pos.coords).catch(() => []);
      const street = addr
        ? [[addr.street, addr.streetNumber].filter(Boolean).join(' '), addr.city]
            .filter(Boolean)
            .join(', ')
        : `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      updatePrefs({
        lodging: {
          ...prefs.lodging,
          street,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        },
      });
    } catch (err) {
      console.warn('[Perfil] ubicación', err);
      Alert.alert('Ubicación', 'No pudimos obtener tu ubicación. Intenta de nuevo.');
    } finally {
      setLocating(false);
    }
  };

  // Al terminar de escribir la dirección se geocodifica para "Volver a mi alojamiento"
  const geocodeLodging = async () => {
    const text = prefs.lodging.street.trim();
    if (!text) {
      updatePrefs({ lodging: { ...prefs.lodging, latitude: null, longitude: null } });
      return;
    }
    try {
      const [hit] = await Location.geocodeAsync(text);
      if (hit) {
        updatePrefs({
          lodging: { ...prefs.lodging, latitude: hit.latitude, longitude: hit.longitude },
        });
      }
    } catch (err) {
      console.warn('[Perfil] geocode', err);
    }
  };

  const toggleTransport = (key: TransportKey) => {
    const has = prefs.transport.includes(key);
    const next = has ? prefs.transport.filter((t) => t !== key) : [...prefs.transport, key];
    updatePrefs({ transport: next.length ? next : ['a_pie'] });
  };

  const downloadSector = async () => {
    if (offlineDone) {
      await removeOfflineSnapshot(sectorName);
      updatePrefs({
        offline: {
          ...prefs.offline,
          downloadedSectors: prefs.offline.downloadedSectors.filter((s) => s !== sectorName),
        },
      });
      setOfflineSize(null);
      return;
    }
    if (prefs.offline.wifiOnly) {
      const net = await NetInfo.fetch();
      if (net.type !== 'wifi') {
        Alert.alert('Sin wifi', 'Conéctate a una red wifi o desactiva «Descargar solo con wifi».');
        return;
      }
    }
    setDownloading(true);
    try {
      const nearby = places.filter((p) => p.distanceMeters <= OFFLINE_RADIUS_M);
      const bytes = await saveOfflineSnapshot(sectorName, nearby);
      setOfflineSize(bytes);
      updatePrefs({
        offline: {
          ...prefs.offline,
          downloadedSectors: [...prefs.offline.downloadedSectors, sectorName],
        },
      });
    } catch (err) {
      console.warn('[Perfil] offline', err);
      Alert.alert('Descarga', 'No se pudo guardar el sector. Revisa el espacio disponible.');
    } finally {
      setDownloading(false);
    }
  };

  const exportData = () => {
    const { photoUri, ...data } = prefs;
    Share.share({ message: JSON.stringify(data, null, 2), title: 'Mis datos' }).catch(
      () => undefined,
    );
  };

  const deleteData = () =>
    Alert.alert(
      'Eliminar mis datos',
      'Se borrarán tus preferencias, contacto de emergencia, guardados y sectores descargados de este teléfono, y se cerrará tu sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await Promise.all(prefs.offline.downloadedSectors.map(removeOfflineSnapshot));
            await resetPrefs();
            if (isAuthenticated) await signOut();
          },
        },
      ],
    );

  return (
    <Screen header={<AppHeader />}>
      <Card style={{ paddingVertical: 14 }}>
        <T variant="title" weight="700">
          Mi perfil
        </T>
      </Card>

      {isGuest ? (
        /* Identidad (invitado) */
        <Card>
          <View style={styles.photoRow}>
            <Avatar name="Visitante" uri={null} size={88} />
            <View style={{ flex: 1 }}>
              <T weight="700">Estás como invitado</T>
              <Hint>Crea una cuenta para personalizar tu perfil y guardar tus lugares.</Hint>
            </View>
          </View>
          <View style={{ gap: 10, marginTop: 14 }}>
            <PrimaryButton label="Crear cuenta" onPress={() => openAuthModal('register')} />
            <OutlineButton label="Iniciar sesión" onPress={() => openAuthModal('login')} />
          </View>
        </Card>
      ) : (
        <>
          {/* Identidad */}
          <Card>
            <View style={styles.photoRow}>
              <Avatar name={prefs.nick || 'Visitante'} uri={prefs.photoUri} size={88} />
              <View style={{ flex: 1 }}>
                <T weight="700">Foto de perfil</T>
                <Hint>Así te verán en tus reseñas y rutas compartidas.</Hint>
                <PillButton
                  label="Cambiar foto"
                  onPress={pickPhoto}
                  style={{ alignSelf: 'flex-start', marginTop: 8 }}
                />
              </View>
            </View>
            <FieldLabel>¿Cómo quieres que te llamemos?</FieldLabel>
            <Field
              value={prefs.nick}
              onChangeText={(nick) => updatePrefs({ nick })}
              placeholder="Tu nombre o apodo"
            />
            <Hint>Aparece en el saludo del inicio. Puede ser un apodo.</Hint>
            <View style={{ marginTop: 14 }}>
              <OutlineButton label="Cerrar sesión" onPress={signOut} />
            </View>
          </Card>

          {/* Alojamiento */}
          <Card>
            <T variant="title" weight="700">
              Dónde te alojas
            </T>
            <Hint>
              La guía lo usa para calcular distancias y para el botón «Volver a mi alojamiento».
            </Hint>
            <FieldLabel>Dirección</FieldLabel>
            <Field
              value={prefs.lodging.street}
              onChangeText={(street) => updatePrefs({ lodging: { ...prefs.lodging, street } })}
              onEndEditing={geocodeLodging}
              placeholder="Calle número, ciudad"
            />
            <FieldLabel>Referencia (opcional)</FieldLabel>
            <Field
              value={prefs.lodging.reference}
              onChangeText={(reference) =>
                updatePrefs({ lodging: { ...prefs.lodging, reference } })
              }
              placeholder="Depto, cabaña o nombre del hotel"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <PillButton
                label="Usar mi ubicación actual"
                icon="locate-outline"
                onPress={useCurrentLocation}
              />
              {locating ? <ActivityIndicator color={colors.text} /> : null}
            </View>
            {prefs.lodging.street && prefs.lodging.latitude === null ? (
              <Hint>No encontramos esa dirección en el mapa; prueba agregando la ciudad.</Hint>
            ) : null}
          </Card>

          {/* Preferencias */}
          <Card>
            <T variant="title" weight="700">
              Mis preferencias
            </T>
            <FieldLabel>Ritmo del día</FieldLabel>
            <Segmented
              options={RHYTHMS}
              value={prefs.rhythm}
              onChange={(rhythm) => updatePrefs({ rhythm })}
            />
            <FieldLabel>Presupuesto</FieldLabel>
            <Segmented
              options={BUDGETS}
              value={prefs.budget}
              onChange={(budget) => updatePrefs({ budget })}
            />
            <FieldLabel>Cómo me muevo</FieldLabel>
            <View style={styles.chips}>
              {TRANSPORTS.map((t) => (
                <Chip
                  key={t.key}
                  label={t.label}
                  selected={prefs.transport.includes(t.key)}
                  onPress={() => toggleTransport(t.key)}
                />
              ))}
            </View>
            <FieldLabel>Alimentación (opcional)</FieldLabel>
            <Field
              value={prefs.diet}
              onChangeText={(diet) => updatePrefs({ diet })}
              placeholder="Ej.: vegetariano, sin gluten"
            />
          </Card>
        </>
      )}

      {/* Accesibilidad */}
      <Card>
        <T variant="title" weight="700">
          Accesibilidad
        </T>
        <FieldLabel>Tamaño del texto</FieldLabel>
        <Segmented
          options={TEXT_SIZES}
          value={prefs.textSize}
          onChange={(textSize) => updatePrefs({ textSize })}
        />
        <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
          <T>Así se verá el texto en la app.</T>
        </View>
        <ToggleRow
          title="Alto contraste"
          subtitle="Bordes y textos más marcados"
          value={prefs.highContrast}
          onChange={(highContrast) => updatePrefs({ highContrast })}
        />
        <ToggleRow
          title="Movilidad reducida"
          subtitle="Rutas sin senderos ni pendientes fuertes"
          value={prefs.reducedMobility}
          onChange={(reducedMobility) => updatePrefs({ reducedMobility })}
        />
      </Card>

      {/* Idioma y moneda */}
      <Card>
        <T variant="title" weight="700">
          Idioma y moneda
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Idioma</FieldLabel>
            <SelectField
              title="Idioma"
              options={LANGUAGES}
              value={prefs.language}
              onChange={(language) => updatePrefs({ language })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>Ver precios en</FieldLabel>
            <SelectField
              title="Moneda"
              options={CURRENCIES}
              value={prefs.currency}
              onChange={(currency) => updatePrefs({ currency })}
            />
          </View>
        </View>
        <Hint>
          Los precios se muestran convertidos de forma aproximada. Se paga siempre en CLP.
        </Hint>
      </Card>

      {isGuest ? (
        <>
          {/* Resto del perfil: requiere cuenta */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text} />
              <T variant="title" weight="700" style={{ flex: 1 }}>
                Con una cuenta puedes…
              </T>
            </View>
            <View style={{ gap: 8, marginTop: 12 }}>
              {ACCOUNT_PERKS.map((perk) => (
                <View key={perk} style={{ flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="checkmark" size={18} color={colors.textSecondary} />
                  <T variant="small" style={{ flex: 1 }}>
                    {perk}
                  </T>
                </View>
              ))}
            </View>
            <PillButton
              label="Iniciar sesión o crear cuenta"
              onPress={() => requireAccount('perfil')}
              style={{ alignSelf: 'flex-start', marginTop: 14 }}
            />
          </Card>
        </>
      ) : (
        <>
          {/* Avisos */}
          <Card>
            <T variant="title" weight="700">
              Avisos
            </T>
            <ToggleRow
              title="Eventos cerca de mí"
              subtitle="Máximo uno al día"
              value={prefs.notifications.nearbyEvents}
              onChange={(v) =>
                updatePrefs({ notifications: { ...prefs.notifications, nearbyEvents: v } })
              }
            />
            <ToggleRow
              title="Alertas de clima y de la ciudad"
              subtitle="Lluvia fuerte, viento, cortes de calle"
              value={prefs.notifications.weatherAndCity}
              onChange={(v) =>
                updatePrefs({ notifications: { ...prefs.notifications, weatherAndCity: v } })
              }
            />
            <ToggleRow
              title="Cambios en mi ruta"
              subtitle="Si un lugar cierra o cambia su horario"
              value={prefs.notifications.routeChanges}
              onChange={(v) =>
                updatePrefs({ notifications: { ...prefs.notifications, routeChanges: v } })
              }
            />
            <ToggleRow
              title="Beneficios de comercios"
              value={prefs.notifications.businessBenefits}
              onChange={(v) =>
                updatePrefs({ notifications: { ...prefs.notifications, businessBenefits: v } })
              }
            />
            <FieldLabel>No molestar desde</FieldLabel>
            <SelectField
              title="No molestar desde"
              options={QUIET_HOURS}
              value={prefs.notifications.quietFrom}
              onChange={(quietFrom) =>
                updatePrefs({ notifications: { ...prefs.notifications, quietFrom } })
              }
            />
          </Card>

          {/* Sin conexión */}
          <Card>
            <T variant="title" weight="700">
              Usar sin conexión
            </T>
            <Hint>
              Descarga los lugares y rutas de tu sector para usarlos sin señal, por ejemplo en la
              costa o en el río.
            </Hint>
            <View style={styles.offlineRow}>
              <View style={{ flex: 1 }}>
                <T weight="600">Sector {sectorName}</T>
                <Hint>
                  {offlineDone
                    ? `Descargado${offlineSize ? ` · ${(offlineSize / 1024).toFixed(0)} KB` : ''}`
                    : 'No descargado'}
                </Hint>
              </View>
              {downloading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <PillButton
                  label={offlineDone ? 'Eliminar' : 'Descargar'}
                  onPress={downloadSector}
                />
              )}
            </View>
            <ToggleRow
              title="Descargar solo con wifi"
              value={prefs.offline.wifiOnly}
              onChange={(wifiOnly) => updatePrefs({ offline: { ...prefs.offline, wifiOnly } })}
            />
          </Card>

          {/* Seguridad */}
          <Card>
            <T variant="title" weight="700">
              Seguridad
            </T>
            <Hint>Tu contacto de emergencia aparece en el botón SOS del inicio.</Hint>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Contacto</FieldLabel>
                <Field
                  value={prefs.emergencyContact.name}
                  onChangeText={(name) =>
                    updatePrefs({ emergencyContact: { ...prefs.emergencyContact, name } })
                  }
                  placeholder="Nombre"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Teléfono</FieldLabel>
                <Field
                  value={prefs.emergencyContact.phone}
                  onChangeText={(phone) =>
                    updatePrefs({ emergencyContact: { ...prefs.emergencyContact, phone } })
                  }
                  placeholder="+56 9…"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <ToggleRow
              title="Compartir mi ruta en curso"
              subtitle="Al iniciar una ruta, le enviamos tu recorrido por SMS"
              value={prefs.shareActiveRoute}
              onChange={(shareActiveRoute) => updatePrefs({ shareActiveRoute })}
            />
          </Card>

          {/* Privacidad */}
          <Card>
            <T variant="title" weight="700">
              Privacidad y cuenta
            </T>
            <FieldLabel>Uso de mi ubicación</FieldLabel>
            <SelectField
              title="Uso de mi ubicación"
              options={LOCATION_USE}
              value={prefs.locationUse}
              onChange={(locationUse) => {
                updatePrefs({ locationUse });
                // El permiso real lo controla el sistema operativo
                Alert.alert(
                  'Permiso de ubicación',
                  'Confirma el cambio en los ajustes del teléfono.',
                  [
                    { text: 'Ahora no', style: 'cancel' },
                    { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
                  ],
                );
              }}
            />
            <ToggleRow
              title="Recomendaciones según mi historial"
              subtitle="Usa los lugares que visitaste"
              value={prefs.historyRecommendations}
              onChange={(historyRecommendations) => updatePrefs({ historyRecommendations })}
            />
            <View style={{ gap: 10, marginTop: 14, alignItems: 'flex-start' }}>
              <PillButton label="Descargar mis datos" onPress={exportData} />
              <OutlineButton label="Eliminar mis datos" onPress={deleteData} />
            </View>
          </Card>

          {/* Guardados */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T variant="title" weight="700" style={{ flex: 1 }}>
                Eventos guardados
              </T>
              <T color={colors.textSecondary}>{saved.length}</T>
            </View>
            {saved.length === 0 ? (
              <Hint>Aún no guardas eventos. Usa el botón «Guardar» en el inicio.</Hint>
            ) : (
              saved.map((p, i) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  onPress={() => openOnMap(p)}
                  divider={i < saved.length - 1}
                />
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  const colors = useColors();
  const { textScale } = useMobileApp();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        styles.field,
        {
          borderColor: colors.borderStrong,
          color: colors.text,
          backgroundColor: colors.surface,
          fontSize: MobileFont.body * textScale,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { marginTop: 10, padding: 14, borderRadius: MobileRadii.button, marginBottom: 4 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  field: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: MobileRadii.button,
    borderWidth: 1,
  },
});
