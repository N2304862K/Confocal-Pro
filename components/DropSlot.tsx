import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface DropSlotProps {
  file: File | null;
  imageData: ImageData | null;
  onDrop: (file: File) => void;
  onRemove: () => void;
  label: string;
}

export const DropSlot: React.FC<DropSlotProps> = ({ file, imageData, onDrop, onRemove, label }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (!file) inputRef.current?.click();
  };

  return (
    <div className="relative group flex-1">
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept=".tif,.tiff"
        onChange={(e) => {
          if (e.target.files?.[0]) onDrop(e.target.files[0]);
        }}
      />
      
      {file && imageData ? (
        <div className="relative aspect-square w-full h-full bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
          <canvas 
            className="w-full h-full object-contain"
            ref={(canvas) => {
                if (canvas && imageData) {
                    canvas.width = imageData.width;
                    canvas.height = imageData.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.putImageData(imageData, 0, 0);
                }
            }}
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 bg-red-500/80 text-white rounded-full hover:bg-red-600"
            >
              <X size={14} />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-white p-1 truncate px-2">
            {file.name}
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            aspect-square w-full h-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors
            ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800'}
          `}
        >
          <Upload className="text-neutral-400 mb-2" size={24} />
          <span className="text-xs text-neutral-400 font-medium">{label}</span>
          <span className="text-[10px] text-neutral-500 mt-1">Drop TIFF here</span>
        </div>
      )}
    </div>
  );
};
