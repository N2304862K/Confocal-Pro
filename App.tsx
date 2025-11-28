import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, Download, Image as ImageIcon, Microscope, Settings2, 
  AlertCircle, Sliders, Scissors, Type, ChevronDown, ChevronRight,
  Maximize2, MoveHorizontal, Layout, Zap, GripHorizontal, X,
  RotateCcw, RotateCw, Minus, PanelTopClose, PanelTopOpen
} from 'lucide-react';
import { RowControl } from './components/RowControl';
import { ProcessedRow, ProcessingConfig } from './types';
import { decodeTiff, processRow } from './utils/imageProcessing';

// Helper component for collapsible sections
const ConfigSection = ({ 
  title, 
  icon: Icon, 
  isOpen, 
  onToggle, 
  children 
}: { 
  title: string; 
  icon: any; 
  isOpen: boolean; 
  onToggle: () => void; 
  children?: React.ReactNode 
}) => (
  <div className="border border-neutral-700/50 rounded-lg overflow-hidden bg-neutral-900/50 backdrop-blur-sm">
    <button 
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-xs font-semibold uppercase tracking-wider text-neutral-300"
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-blue-400" />
        {title}
      </div>
      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
    {isOpen && (
      <div className="p-3 space-y-3 bg-neutral-950/30">
        {children}
      </div>
    )}
  </div>
);

interface DraggablePanelProps {
    children?: React.ReactNode;
    position: {x: number, y: number};
    onDrag: (pos: {x: number, y: number}) => void;
}

const DraggablePanel = ({ 
    children, 
    position, 
    onDrag 
}: DraggablePanelProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isMinimized, setIsMinimized] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent drag if clicking buttons
        if ((e.target as HTMLElement).closest('button')) return;
        
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newX = e.clientX - dragStart.x;
                const newY = e.clientY - dragStart.y;
                const boundedX = Math.max(0, Math.min(window.innerWidth - 320, newX));
                const boundedY = Math.max(0, Math.min(window.innerHeight - 50, newY));
                
                onDrag({ x: boundedX, y: boundedY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, onDrag]);

    return (
        <div 
            style={{ left: position.x, top: position.y }}
            className={`fixed w-80 z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl border border-neutral-700 bg-neutral-900/90 backdrop-blur-md transition-all duration-200 ${isMinimized ? 'h-auto' : ''}`}
        >
            <div 
                onMouseDown={handleMouseDown}
                className="bg-neutral-800 p-2 cursor-move flex items-center justify-between select-none"
            >
                <div className="flex items-center gap-2 text-neutral-300 text-xs font-bold px-1">
                    <Sliders size={14} />
                    SETTINGS INSPECTOR
                </div>
                <div className="flex gap-2 items-center">
                    <button 
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors"
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? <Maximize2 size={12} /> : <Minus size={12} />}
                    </button>
                </div>
            </div>
            {!isMinimized && (
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export default function App() {
  const [config, setConfig] = useState<ProcessingConfig>({
    targetWidth: 494,
    targetHeight: 246,
    targetIntensity: 200,
    padding: 10,
    randomness: 0.05,
    clipBottom: 25,
    columnLabels: ["Channel 1", "Channel 2", "Merge"],
    showLabels: true,
    rowLabelFontSize: 24,
    columnLabelFontSize: 24,
    fontFamily: 'sans-serif'
  });

  const [rows, setRows] = useState<ProcessedRow[]>([]);
  
  // History State
  const [history, setHistory] = useState<{
    past: Array<{rows: ProcessedRow[], config: ProcessingConfig}>,
    future: Array<{rows: ProcessedRow[], config: ProcessingConfig}>
  }>({ past: [], future: [] });

  // UI State
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [sections, setSections] = useState({
    geometry: true,
    processing: true,
    typography: true
  });
  const [panelPos, setPanelPos] = useState({ x: window.innerWidth - 340, y: 70 });

  // History Management
  const pushToHistory = useCallback(() => {
    setHistory(prev => {
        // Create a snapshot. We strip processedCanvas to save memory/storage, 
        // as it can be regenerated from imgData + config.
        const currentSnapshot = {
            rows: rows.map(r => ({ ...r, processedCanvas: null })),
            config: { ...config }
        };
        const newPast = [...prev.past, currentSnapshot];
        // Limit history to 30 steps
        if (newPast.length > 30) newPast.shift();
        
        return {
            past: newPast,
            future: []
        };
    });
  }, [rows, config]);

  const undo = () => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    
    // Save current to future
    const currentSnapshot = {
        rows: rows.map(r => ({ ...r, processedCanvas: null })),
        config: { ...config }
    };
    
    setHistory({
        past: newPast,
        future: [currentSnapshot, ...history.future]
    });
    
    // Restore
    setConfig(previous.config);
    // Restoration of rows handles data, useEffect will handle canvas regeneration
    setRows(previous.rows);
  };

  const redo = () => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);
    
    const currentSnapshot = {
        rows: rows.map(r => ({ ...r, processedCanvas: null })),
        config: { ...config }
    };

    setHistory({
        past: [...history.past, currentSnapshot],
        future: newFuture
    });

    setConfig(next.config);
    setRows(next.rows);
  };

  // Resizing Logic
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(300, Math.min(mouseMoveEvent.clientX, window.innerWidth - 300));
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Initialize with one empty row
  useEffect(() => {
    if (rows.length === 0) {
      // No history push for initial load
      const newRow: ProcessedRow = {
        id: crypto.randomUUID(),
        file1: null,
        file2: null,
        imgData1: null,
        imgData2: null,
        processedCanvas: null,
        timestamp: Date.now(),
        rowLabel: ''
      };
      setRows([newRow]);
    }
  }, []);

  const handleAddRow = () => {
    pushToHistory();
    const newRow: ProcessedRow = {
      id: crypto.randomUUID(),
      file1: null,
      file2: null,
      imgData1: null,
      imgData2: null,
      processedCanvas: null,
      timestamp: Date.now(),
      rowLabel: ''
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    pushToHistory();
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = async (id: string, updates: Partial<ProcessedRow>) => {
    // Don't push history here, handled in wrapper or specific calls to avoid dups
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, ...updates };
      }
      return r;
    }));

    const row = rows.find(r => r.id === id);
    if (!row) return;

    if (updates.file1 && updates.file1 !== row.file1) {
      try {
        const data = await decodeTiff(updates.file1);
        setRows(prev => prev.map(r => r.id === id ? { ...r, imgData1: data } : r));
      } catch (e) {
        alert("Failed to decode TIFF 1. Ensure it is a valid format.");
      }
    }

    if (updates.file2 && updates.file2 !== row.file2) {
      try {
        const data = await decodeTiff(updates.file2);
        setRows(prev => prev.map(r => r.id === id ? { ...r, imgData2: data } : r));
      } catch (e) {
        alert("Failed to decode TIFF 2. Ensure it is a valid format.");
      }
    }
  };

  const handleSwap = (id: string) => {
    pushToHistory();
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          file1: r.file2,
          file2: r.file1,
          imgData1: r.imgData2,
          imgData2: r.imgData1
        };
      }
      return r;
    }));
  };

  // Main processing loop - Updates when Config changes
  useEffect(() => {
    setRows(prevRows => {
      let hasChanges = false;
      const newRows = prevRows.map((row, index) => {
        if (row.imgData1 && row.imgData2) {
            const isFirstRow = index === 0;
            // Always regenerate logic to check if we need update (processRow is relatively fast for single row)
            // Ideally we check if config changed, but this effect runs on config change.
            const newCanvas = processRow(row.imgData1, row.imgData2, config, row.rowLabel, isFirstRow);
            if (row.processedCanvas !== newCanvas) {
                hasChanges = true;
                return { ...row, processedCanvas: newCanvas };
            }
        }
        return row;
      });
      return hasChanges ? newRows : prevRows;
    });
  }, [config]); 

  // Restoration Repair Loop - Updates when Rows change (e.g. undo/redo) and canvas is missing
  useEffect(() => {
    const rowsNeedingProcess = rows.some((r, i) => r.imgData1 && r.imgData2 && !r.processedCanvas);
    if (rowsNeedingProcess) {
        setRows(prev => prev.map((r, i) => {
            if (r.imgData1 && r.imgData2 && !r.processedCanvas) {
                return { ...r, processedCanvas: processRow(r.imgData1, r.imgData2, config, r.rowLabel, i === 0) };
            }
            return r;
        }));
    }
  }, [rows, config]);

  const updateRowWithProcess = (id: string, updates: Partial<ProcessedRow>) => {
      setRows(prev => {
          const idx = prev.findIndex(r => r.id === id);
          if (idx === -1) return prev;
          
          const oldRow = prev[idx];
          const newRow = { ...oldRow, ...updates };
          
          if (newRow.imgData1 && newRow.imgData2) {
              if (updates.imgData1 || updates.imgData2 || updates.rowLabel !== undefined) {
                  newRow.processedCanvas = processRow(newRow.imgData1, newRow.imgData2, config, newRow.rowLabel, idx === 0);
              }
          }
          
          const newRows = [...prev];
          newRows[idx] = newRow;
          return newRows;
      });
  };

  const handleUpdateRowSmart = (id: string, updates: Partial<ProcessedRow>) => {
      // Save history for discrete updates (text typing handled here, debouncing history might be needed for heavy typers 
      // but for scientific tool precise steps are better).
      // However, we only push history if it's NOT a file load (file load is async and complex, handled separately or we push before)
      // For text input, we push.
      
      // Note: For file drop, we handle history in the wrapper that calls this.
      // For text input, we should probably push.
      // To avoid duplicate history pushes, we rely on the caller or check update type.
      // Simply: Push history before any state change.
      
      pushToHistory();

      if (updates.file1 || updates.file2) {
          handleUpdateRow(id, updates); 
          return;
      }
      updateRowWithProcess(id, updates);
  };

  const handleDownload = () => {
    if (rows.length === 0) return;
    const rowW = (config.targetWidth * 3) + (config.padding * 2);
    const rowH = config.targetHeight;
    const verticalGap = 10;
    const validRows = rows.filter(r => r.processedCanvas);
    if (validRows.length === 0) {
        alert("No complete rows to save.");
        return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = rowW;
    canvas.height = (rowH * validRows.length) + (verticalGap * (validRows.length - 1));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    validRows.forEach((row, idx) => {
        if (row.processedCanvas) {
            ctx.drawImage(row.processedCanvas, 0, idx * (rowH + verticalGap));
        }
    });
    canvas.toBlob((blob) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `montage_${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, 'image/png');
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 overflow-hidden select-none relative">
      
      {/* Floating Settings Inspector */}
      <DraggablePanel position={panelPos} onDrag={setPanelPos}>
         <div className="space-y-2">
              
              {/* Group 1: Geometry */}
              <ConfigSection 
                title="Geometry & Crop" 
                icon={Layout}
                isOpen={sections.geometry} 
                onToggle={() => setSections(p => ({...p, geometry: !p.geometry}))}
              >
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] text-neutral-500 mb-1">Dimensions (WxH)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                onFocus={pushToHistory}
                                value={config.targetWidth}
                                onChange={(e) => setConfig(prev => ({ ...prev, targetWidth: parseInt(e.target.value) || 100 }))}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:border-blue-500 outline-none transition-colors"
                            />
                            <span className="text-neutral-600 text-xs">x</span>
                            <input 
                                type="number" 
                                onFocus={pushToHistory}
                                value={config.targetHeight}
                                onChange={(e) => setConfig(prev => ({ ...prev, targetHeight: parseInt(e.target.value) || 100 }))}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:border-blue-500 outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
                            <Scissors size={10} /> 
                            Bottom Clip
                        </label>
                        <input 
                            type="number" 
                            onFocus={pushToHistory}
                            value={config.clipBottom}
                            onChange={(e) => setConfig(prev => ({ ...prev, clipBottom: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:border-blue-500 outline-none transition-colors"
                        />
                    </div>
                 </div>
              </ConfigSection>

              {/* Group 2: Processing */}
              <ConfigSection 
                title="Processing" 
                icon={Zap}
                isOpen={sections.processing} 
                onToggle={() => setSections(p => ({...p, processing: !p.processing}))}
              >
                  <div className="space-y-3">
                    <div>
                        <label className="block text-[10px] text-neutral-500 mb-1">Target Intensity</label>
                        <input 
                            type="number" 
                            onFocus={pushToHistory}
                            value={config.targetIntensity}
                            onChange={(e) => setConfig(prev => ({ ...prev, targetIntensity: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-neutral-500 mb-1 flex justify-between">
                            <span>Randomness Factor</span>
                            <span className="text-blue-400">{Math.round(config.randomness * 100)}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="0" max="0.2" step="0.01"
                            onPointerDown={pushToHistory}
                            value={config.randomness}
                            onChange={(e) => setConfig(prev => ({ ...prev, randomness: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                  </div>
              </ConfigSection>

              {/* Group 3: Typography */}
              <ConfigSection 
                title="Typography & Labels" 
                icon={Type}
                isOpen={sections.typography} 
                onToggle={() => setSections(p => ({...p, typography: !p.typography}))}
              >
                  <div className="space-y-3">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] text-neutral-500">Show Labels</label>
                        <button 
                           onClick={() => { pushToHistory(); setConfig(prev => ({ ...prev, showLabels: !prev.showLabels })); }}
                           className={`w-8 h-4 rounded-full transition-colors relative ${config.showLabels ? 'bg-blue-600' : 'bg-neutral-700'}`}
                        >
                           <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${config.showLabels ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                     </div>

                     <div>
                        <label className="block text-[10px] text-neutral-500 mb-1">Font Family</label>
                        <select 
                           onFocus={pushToHistory}
                           value={config.fontFamily}
                           onChange={(e) => setConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                           className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:border-blue-500 outline-none"
                        >
                            <option value="sans-serif">Sans Serif</option>
                            <option value="serif">Serif</option>
                            <option value="monospace">Monospace</option>
                            <option value="Arial, sans-serif">Arial</option>
                            <option value="'Times New Roman', serif">Times New Roman</option>
                            <option value="'Courier New', monospace">Courier New</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
                        </select>
                     </div>

                     <div className="space-y-2">
                        <div>
                            <label className="block text-[10px] text-neutral-500 mb-1 flex justify-between">
                                <span>Condition Size (Row)</span>
                                <span className="text-neutral-400">{config.rowLabelFontSize}px</span>
                            </label>
                            <input 
                                type="range" 
                                min="12" max="64" step="2"
                                onPointerDown={pushToHistory}
                                value={config.rowLabelFontSize}
                                onChange={(e) => setConfig(prev => ({ ...prev, rowLabelFontSize: parseInt(e.target.value) }))}
                                className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-neutral-500 mb-1 flex justify-between">
                                <span>Header Size (Column)</span>
                                <span className="text-neutral-400">{config.columnLabelFontSize}px</span>
                            </label>
                            <input 
                                type="range" 
                                min="12" max="64" step="2"
                                onPointerDown={pushToHistory}
                                value={config.columnLabelFontSize}
                                onChange={(e) => setConfig(prev => ({ ...prev, columnLabelFontSize: parseInt(e.target.value) }))}
                                className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800">
                         {config.columnLabels.map((label, idx) => (
                             <input 
                                key={idx}
                                type="text"
                                onFocus={pushToHistory}
                                value={label}
                                onChange={(e) => {
                                    const newLabels = [...config.columnLabels] as [string, string, string];
                                    newLabels[idx] = e.target.value;
                                    setConfig(prev => ({ ...prev, columnLabels: newLabels }));
                                }}
                                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[10px] text-neutral-300 focus:border-blue-500 outline-none"
                                placeholder={`Col ${idx + 1}`}
                             />
                         ))}
                     </div>
                  </div>
              </ConfigSection>
         </div>
      </DraggablePanel>

      {/* Left Panel - File Management */}
      <div 
        style={{ width: sidebarWidth }} 
        className="flex flex-col border-r border-neutral-800 bg-neutral-950 flex-shrink-0 relative z-0"
      >
        {/* Header */}
        <div className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
                  <Microscope className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white leading-tight">ConfocalAligner</h1>
                  <p className="text-[10px] text-neutral-400 font-mono">PRO EDITION v1.4</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                  <button 
                    onClick={undo}
                    disabled={history.past.length === 0}
                    className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors bg-neutral-800/50 rounded"
                    title="Undo"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button 
                    onClick={redo}
                    disabled={history.future.length === 0}
                    className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors bg-neutral-800/50 rounded"
                    title="Redo"
                  >
                    <RotateCw size={14} />
                  </button>
              </div>
            </div>

            <button 
                onClick={handleAddRow}
                className="w-full flex items-center justify-center gap-2 bg-neutral-100 text-neutral-900 px-3 py-2 rounded-md font-medium hover:bg-white transition-colors text-xs shadow-lg shadow-white/10"
            >
              <Plus size={14} />
              Add Experiment Row
            </button>
        </div>

        {/* Row List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-neutral-950 custom-scrollbar">
           {rows.length === 0 && (
             <div className="text-center py-20 text-neutral-600">
                <ImageIcon className="mx-auto mb-4 opacity-20" size={48} />
                <p className="text-sm">No rows added.</p>
                <p className="text-xs text-neutral-700 mt-2">Click "Add Experiment Row" to begin</p>
             </div>
           )}
           {rows.map((row, idx) => (
             <RowControl 
               key={row.id} 
               row={row} 
               index={idx} 
               onUpdate={handleUpdateRowSmart}
               onRemove={handleRemoveRow}
               onSwap={handleSwap}
             />
           ))}
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="w-1 hover:w-2 bg-neutral-800 hover:bg-blue-500 cursor-col-resize flex items-center justify-center transition-all z-40 flex-shrink-0"
        onMouseDown={startResizing}
      >
        <div className="h-8 w-1 bg-neutral-600 rounded-full" />
      </div>

      {/* Right Panel: Preview */}
      <div className="flex-1 flex flex-col bg-neutral-900 min-w-[300px] z-0">
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900 shadow-sm z-10 flex-shrink-0">
          <h2 className="font-semibold text-neutral-300 flex items-center gap-2 text-sm">
            <Settings2 size={16} />
            Live Preview
          </h2>
          <div className="flex items-center gap-4">
             <div className="text-xs text-neutral-500 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>Auto-updating</span>
             </div>
             <button 
                onClick={handleDownload}
                disabled={rows.filter(r => r.processedCanvas).length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
             >
               <Download size={14} />
               Export Montage
             </button>
          </div>
        </div>
        
        {/* Preview Area */}
        <div className="flex-1 overflow-auto p-8 bg-neutral-200 flex flex-col items-center">
          <div className="bg-white shadow-2xl p-8 min-h-[200px] w-full max-w-5xl flex flex-col gap-[10px] items-center transition-all">
             {rows.filter(r => r.processedCanvas).length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 text-sm gap-2">
                    <Maximize2 className="opacity-20" size={32} />
                    <span className="italic">Preview will appear here</span>
                </div>
             )}
             {rows.map((row) => (
               row.processedCanvas ? (
                 <div key={row.id} className="relative group">
                    <canvas 
                        ref={node => {
                            if (node && row.processedCanvas) {
                                node.width = row.processedCanvas.width;
                                node.height = row.processedCanvas.height;
                                const ctx = node.getContext('2d');
                                ctx?.drawImage(row.processedCanvas, 0, 0);
                            }
                        }}
                        className="max-w-full h-auto shadow-sm"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 text-white text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded backdrop-blur-sm">
                        {row.imgData1 ? `${row.imgData1.width}x${row.imgData1.height - config.clipBottom}` : 'N/A'}
                    </div>
                 </div>
               ) : null
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}