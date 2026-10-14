import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { useMobileApp } from '../MobileAppContext';
import { useVoiceQuestion } from '../hooks/useVoiceQuestion';
import { MobileFont, MobileRadii } from '../theme';

import { IconButton, useColors } from './ui';

/** Caja "Escribe tu pregunta aquí" con dictado por voz y botón de envío. */
export function QuestionInput({
  onSubmit,
  placeholder = 'Escribe tu pregunta aquí',
}: {
  onSubmit: (text: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const { textScale } = useMobileApp();
  const colors = useColors();
  const voice = useVoiceQuestion((t) => onSubmit(t));

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSubmit(value);
    setText('');
  };

  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceMuted }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={voice.state === 'recording' ? 'Escuchando…' : placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={send}
        returnKeyType="send"
        style={[styles.input, { color: colors.text, fontSize: MobileFont.body * textScale }]}
        accessibilityLabel="Pregunta para la guía"
      />
      {voice.state === 'processing' ? (
        <ActivityIndicator color={colors.text} style={{ width: 40 }} />
      ) : (
        <IconButton
          icon={voice.state === 'recording' ? 'stop' : 'mic-outline'}
          size={40}
          onPress={voice.toggle}
          style={{ backgroundColor: colors.surfaceSunken }}
          accessibilityLabel={voice.state === 'recording' ? 'Detener dictado' : 'Dictar pregunta'}
        />
      )}
      <IconButton
        icon="arrow-up"
        size={40}
        filled
        onPress={send}
        accessibilityLabel="Enviar pregunta"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: MobileRadii.pill,
    paddingLeft: 16,
    paddingRight: 5,
    minHeight: 50,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 10 },
});
