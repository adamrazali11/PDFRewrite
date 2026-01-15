
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  AlignLeft, AlignCenter, AlignRight, Trash2, Bold, Italic, Minus, Plus, Loader2
} from 'lucide-react';
import { PDFState, Modification, EditorMode, TextAlign } from '../types';

const getPdfJs = () => (window as any).pdfjsLib;

interface Props {
  state: PDFState;
  mode: EditorMode;
  showHighlights?: boolean;
  onUpdateModification: (mod: Modification) => void;
  onDeleteModification: (id: string) => void;
  onUpdateState: (updates: Partial<PDFState>) => void;
}

const PDFViewer: React.FC<Props> = ({ state, mode, showHighlights, onUpdateModification, onDeleteModification, onUpdateState }) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const textCache = useRef<Record<number, any>>({});

  useEffect(() => {
    const pdfjs = getPdfJs();
    if (!state.file || !pdfjs) return;
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const loadPDF = async () => {
      try {
        setLoading(true);
        textCache.current = {}; 
        const arrayBuffer = await state.file!.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        onUpdateState({ numPages: doc.numPages });
      } catch (err) {
        console.error("Error loading PDF:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPDF();
  }, [state.file, onUpdateState]);

  if (loading) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-slate-500 font-bold animate-pulse">Processing Document...</p>
    </div>
  );

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-300 p-4 sm:p-8 flex flex-col items-center gap-12 scroll-smooth">
      {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, i) => (
        <div key={i} id={`page-${i}`} className="shrink-0">
          <PDFPage 
            pageIndex={i}
            pdfDoc={pdfDoc}
            zoom={state.zoom}
            mode={mode}
            showHighlights={showHighlights}
            textCache={textCache}
            modifications={state.modifications.filter(m => m.pageIndex === i)}
            onUpdateModification={onUpdateModification}
            onDeleteModification={onDeleteModification}
          />
        </div>
      ))}
      <div className="h-32 shrink-0 w-full" />
    </div>
  );
};

interface PageProps {
  pageIndex: number;
  pdfDoc: any;
  zoom: number;
  mode: EditorMode;
  showHighlights?: boolean;
  textCache: React.MutableRefObject<Record<number, any>>;
  modifications: Modification[];
  onUpdateModification: (mod: Modification) => void;
  onDeleteModification: (id: string) => void;
}

const PDFPage: React.FC<PageProps> = ({ 
  pageIndex, pdfDoc, zoom, mode, showHighlights, textCache, modifications, onUpdateModification, onDeleteModification 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  const renderPage = useCallback(async () => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const vp = page.getViewport({ scale: zoom });
      const originalVp = page.getViewport({ scale: 1.0 });
      setViewport(vp);

      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d', { alpha: false });
        if (context) {
          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(vp.width * outputScale);
          canvas.height = Math.floor(vp.height * outputScale);
          canvas.style.width = `${vp.width}px`;
          canvas.style.height = `${vp.height}px`;
          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
          await page.render({ canvasContext: context, viewport: vp, transform: transform || undefined }).promise;
        }
      }

      const textLayer = textLayerRef.current;
      if (textLayer) {
        textLayer.innerHTML = '';
        textLayer.style.width = `${vp.width}px`;
        textLayer.style.height = `${vp.height}px`;
        let textContent = textCache.current[pageIndex];
        if (!textContent) { 
          textContent = await page.getTextContent(); 
          textCache.current[pageIndex] = textContent; 
        }
        
        textContent.items.forEach((item: any) => {
          const [scaleX, skewX, skewY, scaleY, tx, ty] = item.transform;
          const [vx, vy] = vp.convertToViewportPoint(tx, ty);
          const fontName = item.fontName || '';
          const isBold = /bold|black|w[6-9]00/i.test(fontName);
          const isItalic = /italic|oblique/i.test(fontName);
          let textAlign: TextAlign = 'left';
          const textCenterX = tx + (item.width / 2);
          const pageCenterX = originalVp.width / 2;
          if (Math.abs(textCenterX - pageCenterX) < originalVp.width * 0.05) textAlign = 'center';
          else if (tx + item.width > originalVp.width - (originalVp.width * 0.05)) textAlign = 'right';

          const span = document.createElement('span');
          span.textContent = item.str;
          span.style.left = `${vx}px`;
          span.style.top = `${vy - (item.height * zoom)}px`;
          span.style.fontSize = `${item.height * zoom}px`;
          span.className = 'edit-trigger';
          span.onclick = (e) => {
            e.stopPropagation();
            if (mode !== EditorMode.VIEW) return;
            const id = `orig-${pageIndex}-${tx}-${ty}`;
            onUpdateModification({
              id, pageIndex, x: tx, y: ty, width: item.width, height: item.height,
              originalText: item.str, text: item.str, fontSize: item.height, 
              fontName: 'sans-serif', isBold, isItalic, textAlign, type: 'edit'
            });
            setActiveEditId(id);
          };
          textLayer.appendChild(span);
        });
      }
    } catch (err) { console.error("Render error:", err); }
  }, [pdfDoc, pageIndex, zoom, mode, onUpdateModification, textCache]);

  useEffect(() => { renderPage(); }, [renderPage]);

  const handlePageClick = (e: React.MouseEvent) => {
    if (mode !== EditorMode.ADD) {
        if (activeEditId) setActiveEditId(null);
        return;
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || !viewport) return;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
    const id = `add-${Math.random().toString(36).substr(2, 9)}`;
    onUpdateModification({
      id, pageIndex, x: pdfX, y: pdfY, width: 120, height: 16,
      originalText: '', text: 'New Text', fontSize: 12, fontName: 'sans-serif',
      isBold: false, isItalic: false, textAlign: 'left', type: 'add'
    });
    setActiveEditId(id);
  };

  return (
    <div 
      ref={wrapperRef}
      className="relative bg-white border border-slate-300 shadow-2xl overflow-hidden"
      style={{ width: viewport?.width || 'auto', height: viewport?.height || 'auto' }}
      onClick={handlePageClick}
    >
      <canvas ref={canvasRef} className="block pointer-events-none" />
      <div 
        ref={textLayerRef} 
        className={`textLayer transition-opacity ${showHighlights ? 'show-highlights opacity-100' : (activeEditId ? 'pointer-events-none opacity-0' : 'opacity-20')}`} 
      />
      
      {viewport && modifications.map(mod => {
          const [vx, vy] = viewport.convertToViewportPoint(mod.x, mod.y);
          const isActive = activeEditId === mod.id;
          const isAtTop = vy < 80;

          return (
            <div 
              key={mod.id}
              className={`absolute flex flex-col ${isActive ? 'z-50 ring-2 ring-indigo-500 bg-white' : ''}`}
              style={{
                left: vx,
                top: vy - (mod.fontSize * zoom), 
                minWidth: Math.max(30, mod.width * zoom),
                height: (mod.height * zoom),
              }}
              onClick={(e) => { e.stopPropagation(); setActiveEditId(mod.id); }}
            >
              {isActive && (
                <div 
                  className={`absolute ${isAtTop ? 'top-full mt-2' : '-top-14'} left-1/2 -translate-x-1/2 bg-slate-900 shadow-xl rounded-xl p-1 flex items-center gap-1 z-[100] border border-slate-700 whitespace-nowrap`}
                  onMouseDown={(e) => e.preventDefault()}
                >
                    <button onClick={() => onUpdateModification({...mod, isBold: !mod.isBold})} className={`p-2 rounded-lg ${mod.isBold ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Bold className="w-4 h-4" /></button>
                    <button onClick={() => onUpdateModification({...mod, isItalic: !mod.isItalic})} className={`p-2 rounded-lg ${mod.isItalic ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Italic className="w-4 h-4" /></button>
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <button onClick={() => onUpdateModification({...mod, fontSize: (mod.fontSize || 12) + 1})} className="p-2 text-slate-400"><Plus className="w-4 h-4" /></button>
                    <span className="text-white text-xs font-bold w-6 text-center">{mod.fontSize}</span>
                    <button onClick={() => onUpdateModification({...mod, fontSize: Math.max(1, (mod.fontSize || 12) - 1)})} className="p-2 text-slate-400"><Minus className="w-4 h-4" /></button>
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <button onClick={() => onUpdateModification({...mod, textAlign: 'left'})} className={`p-2 rounded-lg ${mod.textAlign === 'left' ? 'text-indigo-400' : 'text-slate-400'}`}><AlignLeft className="w-4 h-4" /></button>
                    <button onClick={() => onUpdateModification({...mod, textAlign: 'center'})} className={`p-2 rounded-lg ${mod.textAlign === 'center' ? 'text-indigo-400' : 'text-slate-400'}`}><AlignCenter className="w-4 h-4" /></button>
                    <button onClick={() => onUpdateModification({...mod, textAlign: 'right'})} className={`p-2 rounded-lg ${mod.textAlign === 'right' ? 'text-indigo-400' : 'text-slate-400'}`}><AlignRight className="w-4 h-4" /></button>
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <button onClick={() => onDeleteModification(mod.id)} className="p-2 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}

              {isActive ? (
                <input
                  autoFocus
                  className="w-full h-full bg-transparent outline-none border-none p-0 m-0 text-slate-900"
                  style={{ 
                    fontSize: mod.fontSize * zoom, lineHeight: '1', fontFamily: 'sans-serif',
                    fontWeight: mod.isBold ? 'bold' : 'normal', fontStyle: mod.isItalic ? 'italic' : 'normal',
                    textAlign: mod.textAlign
                  }}
                  value={mod.text}
                  onChange={(e) => onUpdateModification({ ...mod, text: e.target.value })}
                  onBlur={() => setActiveEditId(null)}
                />
              ) : (
                <span 
                    className={`text-slate-950 whitespace-nowrap block w-full h-full overflow-hidden ${mod.type === 'edit' ? 'bg-white' : ''}`}
                    style={{ 
                        fontSize: mod.fontSize * zoom, lineHeight: '1', fontFamily: 'sans-serif',
                        fontWeight: mod.isBold ? 'bold' : 'normal', fontStyle: mod.isItalic ? 'italic' : 'normal',
                        textAlign: mod.textAlign
                    }}
                >
                    {mod.text || ' '}
                </span>
              )}
            </div>
          );
      })}
    </div>
  );
};

export default PDFViewer;
