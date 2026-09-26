// Screen capture and frame snapshot service for Operation Manual generation

export class ScreenCaptureService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async startCapture(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: false,
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      await this.videoElement.play();

      return true;
    } catch (err: any) {
      console.warn('[HuskyNote] Screen capture permission denied or cancelled:', err?.message);
      return false;
    }
  }

  isCapturing(): boolean {
    return !!this.stream && this.stream.active;
  }

  takeSnapshot(): string | null {
    if (!this.videoElement || !this.videoElement.videoWidth) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  stopCapture(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }
}

export const screenCapture = new ScreenCaptureService();
