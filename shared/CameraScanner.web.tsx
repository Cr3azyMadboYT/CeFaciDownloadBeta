import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
export function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const callback = useRef(onScan);
  callback.current = onScan;
  useEffect(() => {
    let stopped = false,
      frame = 0,
      stream: MediaStream | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const scan = () => {
      const v = video.current;
      if (!stopped && v && ctx && v.readyState >= 2) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(data.data, data.width, data.height);
        if (code) {
          stopped = true;
          stream?.getTracks().forEach((t) => t.stop());
          callback.current(code.data);
          return;
        }
      }
      if (!stopped) frame = requestAnimationFrame(scan);
    };
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = s;
          void video.current
            .play()
            .then(scan)
            .catch((e) => setError(String(e)));
        }
      })
      .catch(() =>
        setError("Permite camera. Pentru acces ai nevoie de HTTPS."),
      );
    if (!navigator.mediaDevices)
      setError("Camera necesită HTTPS. Poți introduce codul manual.");
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <div>
      <video
        ref={video}
        playsInline
        muted
        style={{ width: "100%", maxHeight: 340, borderRadius: 16 }}
      />
      {error && <p role="alert">{error}</p>}
      <button onClick={onClose}>Închide camera</button>
    </div>
  );
}
