import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export class AudioRecorder {
  private recording: Audio.Recording | null = null;
  private isBusy: boolean = false;

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;
        const hasGetUserMedia =
          typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

        if (!hasGetUserMedia) {
          console.error('Microphone permission API not available in this browser.');
          return false;
        }

        if (!isSecureContext) {
          console.error('Microphone permission requires HTTPS or localhost.');
          return false;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }

      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.error('Failed to request audio permissions:', err);
      return false;
    }
  }

  async startRecording(): Promise<void> {
    if (this.isBusy) {
      console.warn('AudioRecorder is already busy with another operation');
      return;
    }

    try {
      this.isBusy = true;

      // Ensure any existing recording is stopped and unloaded
      if (this.recording) {
        await this.stopRecordingInternal();
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      this.recording = recording;
    } catch (err) {
      console.error('Failed to start recording', err);
      this.recording = null;
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (this.isBusy && !this.recording) {
      return null;
    }

    try {
      this.isBusy = true;
      return await this.stopRecordingInternal();
    } finally {
      this.isBusy = false;
    }
  }

  private async stopRecordingInternal(): Promise<string | null> {
    if (!this.recording) {
      return null;
    }

    try {
      const rec = this.recording;
      this.recording = null;

      const status = await rec.getStatusAsync();
      if (status.canRecord) {
        await rec.stopAndUnloadAsync();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      return rec.getURI();
    } catch (err) {
      console.error('Failed to stop recording internal', err);
      return null;
    }
  }

  async clearAudioFile(uri: string): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri);
      }
    } catch (err) {
      console.error('Failed to delete audio file', err);
    }
  }
}

export const audioRecorder = new AudioRecorder();
