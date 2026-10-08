import { useEffect, useRef, useState } from 'react';
import { CameraOff, X } from 'lucide-react';

type DetectedCode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export function QrCameraScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState('');
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;

  useEffect(() => {
    let stopped = false;
    let frameId = 0;

    async function startCamera() {
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) {
        setError('QR scanning is not supported by this browser. Enter the access code manually.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot access a camera. Enter the access code manually.');
        return;
      }

      try {
        const detector = new Detector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const scanFrame = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              const [code] = await detector.detect(video);
              if (code?.rawValue) {
                onDetectedRef.current(code.rawValue);
                onCloseRef.current();
                return;
              }
            }
          } catch {
            setError('The QR code could not be read. Try again or enter the code manually.');
            return;
          }
          if (!stopped) frameId = window.requestAnimationFrame(() => { void scanFrame(); });
        };

        frameId = window.requestAnimationFrame(() => { void scanFrame(); });
      } catch {
        if (!stopped) setError('Camera access was denied or unavailable. Allow camera access or enter the code manually.');
      }
    }

    void startCamera();
    return () => {
      stopped = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div className="camera-scanner" aria-label="QR code camera scanner">
      <div className="camera-scanner-head">
        <strong>Scan visitor QR</strong>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close camera scanner"><X className="icon" /></button>
      </div>
      <video ref={videoRef} className="camera-scanner-video" autoPlay playsInline muted aria-label="Camera preview for QR scanning" />
      {error
        ? <p className="camera-scanner-message" role="status"><CameraOff className="icon" />{error}</p>
        : <p className="camera-scanner-message" role="status">Point the camera at the visitor’s QR code. The scan stays on this device.</p>}
    </div>
  );
}
