import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

export type RealtimeSearchResult = {
  category: string;
  query: string;
  originalText: string;
  isFinal: boolean;
};

export function useRealtimeSearch() {
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef<((res: RealtimeSearchResult) => void) | null>(null);

  const partialTextRef = useRef('');
  const resultCalledRef = useRef(false);

  const startRecording = useCallback(
    async (onResult: (res: RealtimeSearchResult) => void) => {
      if (Platform.OS !== 'web') {
        console.warn('Real-time chunking via MediaRecorder is primarily supported on Web.');
        return;
      }

      // Evitar múltiples grabaciones simultáneas
      if (isRecording || socketRef.current) {
        console.log('Recording or socket already active, skipping start');
        return;
      }

      onResultRef.current = onResult;
      resultCalledRef.current = false;
      partialTextRef.current = '';

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/whisper-stream`;

        console.log('Connecting to Whisper service at:', wsUrl);
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = async () => {
          console.log('WebSocket connected to Whisper service');

          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(e.data);
              }
            };

            // Chunks de 1000ms para mayor estabilidad
            mediaRecorder.start(1000);
            setIsRecording(true);
          } catch (err) {
            console.error('Microphone access error:', err);
            socket.close();
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        socket.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);

          if (!resultCalledRef.current && onResultRef.current) {
            resultCalledRef.current = true;
            onResultRef.current({
              category: 'todos',
              query: partialTextRef.current,
              originalText: partialTextRef.current,
              isFinal: true,
            });
          }

          setIsRecording(false);
          socketRef.current = null;
          mediaRecorderRef.current = null;
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WS Message received:', data);
            if (data.text) {
              setPartialText(data.text);
              partialTextRef.current = data.text;
            }
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };
      } catch (err) {
        console.error('Error starting real-time recording:', err);
        setIsRecording(false);
        socketRef.current = null;
      }
    },
    [isRecording],
  );

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (!resultCalledRef.current && onResultRef.current) {
      resultCalledRef.current = true;
      onResultRef.current({
        category: 'todos',
        query: partialTextRef.current || '',
        originalText: partialTextRef.current || '',
        isFinal: true,
      });
    }

    setIsRecording(false);
    setPartialText('');
    partialTextRef.current = '';
  }, []);

  return {
    isRecording,
    partialText,
    startRecording,
    stopRecording,
  };
}
