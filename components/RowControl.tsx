import React from 'react';
import { Trash2, GripVertical, ArrowLeftRight, Tag } from 'lucide-react';
import { DropSlot } from './DropSlot';
import { ProcessedRow } from '../types';

interface RowControlProps {
  row: ProcessedRow;
  index: number;
  onUpdate: (id: string, updates: Partial<ProcessedRow>) => void;
  onRemove: (id: string) => void;
  onSwap: (id: string) => void;
}

export const RowControl: React.FC<RowControlProps> = ({ row, index, onUpdate, onRemove, onSwap }) => {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4 shadow-sm transition-all hover:border-neutral-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="text-neutral-600 cursor-grab" size={16} />
          <h3 className="text-sm font-semibold text-neutral-300">Row {index + 1}</h3>
          
          <div className="h-4 w-px bg-neutral-700 mx-2"></div>
          
          <div className="flex items-center gap-2 bg-neutral-950/50 px-2 py-1 rounded border border-neutral-800 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
             <Tag size={12} className="text-neutral-500" />
             <input 
               type="text"
               value={row.rowLabel || ''}
               onChange={(e) => onUpdate(row.id, { rowLabel: e.target.value })}
               placeholder="Condition Label (e.g. WT)"
               className="bg-transparent border-none outline-none text-xs text-neutral-200 placeholder-neutral-600 w-32"
             />
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onSwap(row.id)}
            className="p-1.5 text-neutral-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
            title="Swap Images"
          >
            <ArrowLeftRight size={16} />
          </button>
          <button 
            onClick={() => onRemove(row.id)}
            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
            title="Remove Row"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <DropSlot 
          file={row.file1} 
          imageData={row.imgData1}
          label="Channel 1 (Green)"
          onDrop={(file) => onUpdate(row.id, { file1: file })}
          onRemove={() => onUpdate(row.id, { file1: null, imgData1: null })}
        />
        
        <div className="w-px bg-neutral-800 my-2"></div>

        <DropSlot 
          file={row.file2} 
          imageData={row.imgData2}
          label="Channel 2 (Red)"
          onDrop={(file) => onUpdate(row.id, { file2: file })}
          onRemove={() => onUpdate(row.id, { file2: null, imgData2: null })}
        />
      </div>
    </div>
  );
};