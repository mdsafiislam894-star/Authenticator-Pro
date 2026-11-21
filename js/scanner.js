// QR scanning: live camera (BarcodeDetector, jsQR fallback) and image upload.
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

function loadJsQR() {
  return new Promise((resolve, reject) => {
    if (globalThis.jsQR) return resolve(globalThis.jsQR);
    const s = document.createElement('script');
    s.src = JSQR_URL;
    s.onload = () => resolve(globalThis.jsQR);
    s.onerror = () => reject(new Error('QR লাইব্রেরি লোড হয়নি (ইন্টারনেট দরকার)'));
    document.head.appendChild(s);
  });
}

async function makeDecoder() {
  if ('BarcodeDetector' in globalThis) {
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      return async (source, canvas) => {
        const r = await det.detect(source);
        return r[0]?.rawValue || null;
      };
    } catch { /* fall through */ }
  }
  const jsQR = await loadJsQR();
  return async (_source, canvas) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height)?.data || null;
  };
}

// Starts the camera in <video>. onText is called for each newly found QR text.
// Returns { stop }.
export async function startCamera(video, onText) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  const decode = await makeDecoder();
  const canvas = document.createElement('canvas');
  let running = true;
  const seen = new Set();

  (async function loop() {
    while (running) {
      if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0);
        try {
          const text = await decode(video, canvas);
          if (text && !seen.has(text)) { seen.add(text); onText(text); }
        } catch { /* ignore frame errors */ }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  })();

  return {
    stop() {
      running = false;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

// Decode QR from an image File (screenshot of an export QR works too).
export async function scanImageFile(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  // Upscale small images a bit; downscale huge ones.
  const scale = Math.min(1600 / Math.max(bmp.width, bmp.height), 2);
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const decode = await makeDecoder();
  const text = await decode(canvas, canvas);
  if (!text) throw new Error('ছবিতে QR পাওয়া যায়নি');
  return text;
}
