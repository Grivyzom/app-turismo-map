export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isBusy: boolean = false;
  private stream: MediaStream | null = null;
  private recordingUri: string | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
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
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      const options = { mimeType: 'audio/webm' };
      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error('Failed to start recording on web', err);
      this.stream = null;
      this.mediaRecorder = null;
      throw err;
    } finally {
      this.isBusy = false;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (this.isBusy || !this.mediaRecorder) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        this.isBusy = true;

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

            // Clear previous URI to avoid leaks
            if (this.recordingUri) {
              URL.revokeObjectURL(this.recordingUri);
            }

            this.recordingUri = URL.createObjectURL(audioBlob);

            // Stop stream tracks
            if (this.stream) {
              this.stream.getTracks().forEach((track) => track.stop());
              this.stream = null;
            }

            this.mediaRecorder = null;
            this.isBusy = false;
            resolve(this.recordingUri);
          };

          this.mediaRecorder.stop();
        } else {
          this.isBusy = false;
          resolve(null);
        }
      } catch (err) {
        console.error('Failed to stop recording on web', err);
        this.isBusy = false;
        resolve(null);
      }
    });
  }

  async clearAudioFile(uri: string): Promise<void> {
    try {
      if (uri === this.recordingUri) {
        URL.revokeObjectURL(uri);
        this.recordingUri = null;
      }
    } catch (err) {
      console.error('Failed to clear audio file on web', err);
    }
  }
}

export const audioRecorder = new AudioRecorder();
