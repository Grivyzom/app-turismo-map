import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { audioRecorder } from '../../utils/audioRecorder';
import { processAudioSearch } from '../../utils/aiSearchParser';

/**
 * Dictado por voz: un toque empieza a grabar, el segundo detiene y transcribe
 * con el mismo servicio que usa la búsqueda por voz del mapa.
 */
export function useVoiceQuestion(onTranscript: (text: string) => void) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');

  const toggle = useCallback(async () => {
    if (state === 'processing') return;

    if (state === 'idle') {
      const granted = await audioRecorder.requestPermissions();
      if (!granted) {
        Alert.alert('Micrófono', 'Activa el permiso de micrófono para dictar tu pregunta.');
        return;
      }
      await audioRecorder.startRecording();
      setState('recording');
      return;
    }

    setState('processing');
    try {
      const uri = await audioRecorder.stopRecording();
      if (!uri) return;
      const result = await processAudioSearch(uri);
      const text = (result.originalText || result.query || '').trim();
      if (text) onTranscript(text);
      audioRecorder.clearAudioFile(uri).catch(() => undefined);
    } catch (err) {
      console.warn('[VoiceQuestion]', err);
      Alert.alert('No te entendimos', 'Intenta de nuevo o escribe tu pregunta.');
    } finally {
      setState('idle');
    }
  }, [state, onTranscript]);

  return { state, toggle };
}
