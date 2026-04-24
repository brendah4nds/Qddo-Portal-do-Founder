import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { X, ZoomIn, ZoomOut, RotateCcw, RotateCw, Check, Crop } from 'lucide-react';

type Area = { x: number; y: number; width: number; height: number };

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation: number): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = Math.floor(image.width * cos + image.height * sin);
  const rotH = Math.floor(image.width * sin + image.height * cos);

  // Draw rotated image onto an intermediate canvas
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext('2d')!;
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(radians);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // Draw crop onto the final canvas
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    rotCanvas,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas is empty')),
      'image/jpeg',
      0.93
    )
  );
}

type Props = {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
};

export function ImageCropModal({ imageSrc, onConfirm, onClose }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onConfirm(blob);
    } catch {
      // silently fail — parent handles errors
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Crop size={18} className="text-primary" />
            <h3 className="font-sans font-bold text-stone-900">Ajustar imagem de capa</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative w-full bg-stone-900" style={{ height: 360 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={16 / 6}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-5 space-y-4 bg-white">

          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.1))}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors shrink-0"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary h-1.5 rounded-full cursor-pointer"
            />
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors shrink-0"
            >
              <ZoomIn size={16} />
            </button>
            <span className="text-xs text-stone-400 font-bold w-10 text-right shrink-0">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRotation(r => r - 90)}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors shrink-0"
            >
              <RotateCcw size={16} />
            </button>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 accent-primary h-1.5 rounded-full cursor-pointer"
            />
            <button
              onClick={() => setRotation(r => r + 90)}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors shrink-0"
            >
              <RotateCw size={16} />
            </button>
            <span className="text-xs text-stone-400 font-bold w-10 text-right shrink-0">
              {rotation}°
            </span>
          </div>

          {/* Reset */}
          <div className="flex justify-end">
            <button
              onClick={() => { setZoom(1); setRotation(0); setCrop({ x: 0, y: 0 }); }}
              className="text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors"
            >
              Resetar ajustes
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-stone-200 rounded-lg text-sm font-bold text-stone-600 hover:bg-stone-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} />
            {isProcessing ? 'Processando...' : 'Confirmar corte'}
          </button>
        </div>
      </div>
    </div>
  );
}
