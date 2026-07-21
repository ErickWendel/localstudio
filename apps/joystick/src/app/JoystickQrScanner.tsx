import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface JoystickQrScannerProps {
  onScan: (value: string) => void;
  runtime?: JoystickQrScannerRuntime | undefined;
}

type ScannerStatus = 'idle' | 'scanning' | 'unsupported';
type QrDecoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data?: string | undefined } | null | undefined;

interface JoystickQrScannerRuntime {
  canUseCameraScanner?: (() => boolean) | undefined;
  getUserMedia?:
    | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
    | undefined;
  loadQrDecoder?: (() => Promise<QrDecoder>) | undefined;
}

function canUseCameraScanner(runtime: JoystickQrScannerRuntime | undefined) {
  if (runtime?.canUseCameraScanner) return runtime.canUseCameraScanner();
  return Boolean(navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices);
}

export function JoystickQrScanner({ onScan, runtime }: JoystickQrScannerProps) {
  const animationFrameRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrDecoderRef = useRef<QrDecoder | undefined>(undefined);
  const scannerActiveRef = useRef(false);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [status, setStatus] = useState<ScannerStatus>('idle');

  useEffect(
    () => () => {
      stopScanner();
    },
    [],
  );

  async function startScanner() {
    if (!canUseCameraScanner(runtime)) {
      setStatus('unsupported');
      setErrorMessage('Camera scanning is not available in this browser.');
      return;
    }
    setErrorMessage('');
    scannerActiveRef.current = true;
    setStatus('scanning');
    try {
      qrDecoderRef.current ??= runtime?.loadQrDecoder
        ? await runtime.loadQrDecoder()
        : (await import('jsqr')).default;
      const getUserMedia =
        runtime?.getUserMedia ??
        ((constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints));
      const stream = await getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      /* c8 ignore next */
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      scanNextFrame();
    } catch {
      stopScanner();
      setStatus('unsupported');
      setErrorMessage('Camera permission was blocked or unavailable.');
    }
  }

  function stopScanner() {
    scannerActiveRef.current = false;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = 0;
    /* c8 ignore next */
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }

  function scanNextFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const qrDecoder = qrDecoderRef.current;
    /* c8 ignore next */
    if (!video || !canvas || !qrDecoder || !scannerActiveRef.current) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width > 0 && height > 0) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        const result = qrDecoder(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          onScan(result.data);
          stopScanner();
          return;
        }
      }
    }
    animationFrameRef.current = window.requestAnimationFrame(scanNextFrame);
  }

  if (status === 'scanning') {
    return (
      <section className="joystick-scanner" aria-label="Scan remote QR code">
        <video ref={videoRef} muted playsInline />
        <span className="joystick-scanner-frame" aria-hidden="true" />
        <button
          type="button"
          className="joystick-scanner-close"
          onClick={stopScanner}
          aria-label="Stop scanning"
        >
          <X size={20} />
        </button>
        <canvas ref={canvasRef} aria-hidden="true" />
      </section>
    );
  }

  return (
    <div className="joystick-scan-actions">
      <button type="button" className="joystick-scan-button" onClick={() => void startScanner()}>
        <Camera size={18} />
        Scan QR
      </button>
      {errorMessage ? <p className="joystick-help">{errorMessage}</p> : null}
    </div>
  );
}
