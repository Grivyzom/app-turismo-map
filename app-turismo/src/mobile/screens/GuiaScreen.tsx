import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMobileApp } from '../MobileAppContext';
import { QuestionInput } from '../components/QuestionInput';
import { Card, EmptyState, PillButton, T, useColors } from '../components/ui';
import { answerQuestion, GUIDE_SUGGESTIONS, GuideAction, GuideAnswer } from '../data/guideBrain';
import { PlaceRow } from '../sections/PlaceRow';
import { openEmergencyMenu, searchNearbyInMaps } from '../utils/external';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { WIDE_CONTENT_MAX } from '../layout';
import { MobileRadii, MobileSpacing, TAB_BAR_HEIGHT } from '../theme';

type Message = { from: 'user'; text: string } | { from: 'guide'; answer: GuideAnswer };

/** Guía conversacional (botón central del dock). */
export function GuiaScreen() {
  const app = useMobileApp();
  const { guidePrompt, prefs, sectorName, setTab, setOverlay, openOnMap, origin } = app;
  const { isGuest, requireAccount } = app;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wide = useLayoutMode() === 'wide';
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const reply = (text: string): Message[] => [
    { from: 'user', text },
    {
      from: 'guide',
      answer: answerQuestion(text, {
        places: app.places,
        weather: app.weather,
        route: app.recommendedRoute,
        sectorName: app.sectorName,
        diet: app.prefs.diet,
      }),
    },
  ];

  const ask = (text: string) => {
    if (!requireAccount('guia')) return;
    setMessages((prev) => [...prev, ...reply(text)]);
  };

  // Preguntas que llegan desde el Inicio (se procesan una sola vez por nonce)
  const [handledPrompt, setHandledPrompt] = useState(0);
  if (guidePrompt && guidePrompt.nonce !== handledPrompt) {
    setHandledPrompt(guidePrompt.nonce);
    setMessages([...messages, ...reply(guidePrompt.text)]);
  }

  const runAction = (action: GuideAction) => {
    switch (action.type) {
      case 'route':
        return setTab('rutas');
      case 'weather':
        return setOverlay('clima');
      case 'map':
        return openOnMap(null, action.category);
      case 'services':
        return searchNearbyInMaps(action.query, origin);
      case 'sos':
        return openEmergencyMenu(prefs.emergencyContact);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
          wide && styles.column,
          wide && { paddingTop: 24 },
        ]}
      >
        <Card style={styles.headerCard}>
          <View style={[styles.spark, { backgroundColor: colors.accent }]}>
            <Ionicons name="sparkles" size={18} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="700">Guía</T>
            <T variant="caption" color={colors.textSecondary}>
              Te ayudo a planear tu día en {sectorName}
            </T>
          </View>
          {!isGuest && messages.length > 0 ? (
            <PillButton label="Limpiar" onPress={() => setMessages([])} />
          ) : null}
        </Card>
      </View>

      {isGuest ? (
        <View
          testID="guia-guest"
          style={[{ padding: MobileSpacing.screen }, wide && styles.column]}
        >
          <EmptyState
            icon="sparkles-outline"
            title="Inicia sesión para preguntarle a la guía"
            message="Te ayudará a encontrar comida, museos, parques y rutas según el clima y tu ritmo."
            actionLabel="Iniciar sesión o crear cuenta"
            onAction={() => requireAccount('guia')}
          />
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            testID="guia-scroll"
            style={{ flex: 1 }}
            contentContainerStyle={[
              { padding: MobileSpacing.screen, gap: 12 },
              wide && styles.column,
            ]}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <Card>
                <T variant="title" weight="700">
                  {prefs.nick ? `Hola, ${prefs.nick}.` : 'Hola.'} ¿Qué quieres hacer hoy?
                </T>
                <T variant="small" color={colors.textSecondary} style={{ marginTop: 6 }}>
                  Pregúntame por comida, museos, parques, el clima o una ruta a pie.
                </T>
                <View style={styles.suggestions}>
                  {GUIDE_SUGGESTIONS.map((s) => (
                    <PillButton key={s} label={s} onPress={() => ask(s)} />
                  ))}
                </View>
              </Card>
            ) : null}

            {messages.map((m, idx) =>
              m.from === 'user' ? (
                <View key={idx} style={[styles.userBubble, { backgroundColor: colors.accent }]}>
                  <T color={colors.onAccent}>{m.text}</T>
                </View>
              ) : (
                <Card key={idx} style={styles.guideBubble}>
                  <T>{m.answer.text}</T>
                  {m.answer.places.map((p, i) => (
                    <PlaceRow
                      key={p.id}
                      place={p}
                      onPress={() => openOnMap(p)}
                      divider={i < m.answer.places.length - 1}
                    />
                  ))}
                  {m.answer.action ? (
                    <PillButton
                      label={m.answer.action.label}
                      onPress={() => runAction(m.answer.action!.action)}
                      style={{ alignSelf: 'flex-start', marginTop: 8 }}
                    />
                  ) : null}
                </Card>
              ),
            )}
          </ScrollView>

          <View
            style={[
              {
                paddingHorizontal: MobileSpacing.screen,
                paddingBottom: wide ? 24 : insets.bottom + TAB_BAR_HEIGHT + 30,
                paddingTop: 8,
              },
              wide && styles.column,
            ]}
          >
            <Card style={{ padding: 8, borderRadius: MobileRadii.pill }}>
              <QuestionInput onSubmit={ask} />
            </Card>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: MobileSpacing.screen },
  column: { width: '100%', maxWidth: WIDE_CONTENT_MAX, alignSelf: 'center' },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: MobileRadii.pill,
  },
  spark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  guideBubble: { alignSelf: 'stretch', borderBottomLeftRadius: 6 },
});
