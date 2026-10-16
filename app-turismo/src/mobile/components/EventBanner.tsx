import React, { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IoniconName } from '../data/categories';

import { IconButton, Tap, useColors } from './ui';

/** Proporción mientras no se conocen las dimensiones reales (4:3). */
const FALLBACK_RATIO = 4 / 3;
/** Límites del alto del banner: fuera de ellos la obra se muestra entera (contain), nunca recortada. */
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 21 / 9;

function isRemote(uri?: string): uri is string {
  return !!uri && /^https?:\/\//.test(uri);
}

/**
 * Banner de la ilustración del evento.
 *
 * Las ilustraciones son piezas únicas de los diseñadores, así que se muestran tal cual:
 * - Sin degradados, desenfoques, sombras ni texto encima: ningún control se superpone a la obra.
 * - Proporción original: el alto se ajusta al ancho de pantalla y la imagen nunca se recorta.
 * - Sin fundido de entrada (`fadeDuration={0}`) ni carga progresiva borrosa.
 * - En Android se decodifica al tamaño físico del banner (`resizeMethod="resize"`): nitidez completa
 *   a la densidad de la pantalla sin pagar memoria por píxeles que no se ven.
 * Tocarla abre el visor a pantalla completa con la resolución original.
 */
export function EventBanner({
  uri,
  title,
  width: intrinsicWidth,
  height: intrinsicHeight,
  fallbackIcon,
}: {
  uri?: string;
  title: string;
  width?: number;
  height?: number;
  fallbackIcon: IoniconName;
}) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [ratio, setRatio] = useState<number | null>(() =>
    intrinsicWidth && intrinsicHeight ? intrinsicWidth / intrinsicHeight : null,
  );
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  if (!isRemote(uri) || failed) {
    return (
      <View
        style={[
          styles.placeholder,
          { width, height: width / FALLBACK_RATIO, backgroundColor: colors.placeholder },
        ]}
        accessibilityLabel="Evento sin ilustración"
      >
        <Ionicons name={fallbackIcon} size={40} color={colors.textMuted} />
      </View>
    );
  }

  const shown = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio ?? FALLBACK_RATIO));

  return (
    <>
      <Tap
        onPress={() => setViewerOpen(true)}
        pressedOpacity={0.92}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Ilustración de ${title}. Toca para verla en pantalla completa`}
        style={{ width, height: width / shown, backgroundColor: colors.placeholder }}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
          onLoad={(e) => {
            if (ratio) return;
            const source = e.nativeEvent?.source;
            if (source?.width > 0 && source?.height > 0) {
              setRatio(source.width / source.height);
            } else {
              // Algunas plataformas no informan dimensiones en onLoad: la imagen ya está en caché
              Image.getSize(
                uri,
                (w, h) => w > 0 && h > 0 && setRatio(w / h),
                () => undefined,
              );
            }
          }}
          onError={() => setFailed(true)}
        />
      </Tap>
      <ArtViewer
        uri={uri}
        title={title}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

/** Visor a pantalla completa: fondo negro liso, obra completa a resolución original (zoom en iOS). */
function ArtViewer({
  uri,
  title,
  visible,
  onClose,
}: {
  uri: string;
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.viewer}>
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width, height }}
        >
          <Image
            source={{ uri }}
            style={{ width, height }}
            resizeMode="contain"
            resizeMethod="scale"
            fadeDuration={0}
            accessibilityLabel={`Ilustración de ${title}`}
          />
        </ScrollView>
        <IconButton
          icon="close"
          onPress={onClose}
          accessibilityLabel="Cerrar ilustración"
          style={[styles.viewerClose, { top: insets.top + 12 }]}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerClose: { position: 'absolute', right: 16 },
});
