
import React, { useState, useRef, useCallback } from 'react';
import { 
  FileUp, 
  Plus, 
  MousePointer2, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Undo2,
  Trash2,
  PanelLeft,
  Loader2,
  ScanText
} from 'lucide-react';
import PDFViewer from './components/PDFViewer';
import { Modification, EditorMode, PDFState } from './types';
import { saveEditedPDF } from './services/pdfService';

const App: React.FC = () => {
  const [state, setState] = useState<PDFState>({
    file: null,
    numPages: 0,
    currentPage: 1,
    zoom: 1.0,
    modifications: []
  });

  const [mode, setMode] = useState<EditorMode>(EditorMode.VIEW);
  const [showHighlights, setShowHighlights] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setState(prev => ({
        ...prev,
        file,
        modifications: [],
        currentPage: 1,
        zoom: 1.0
      }));
    }
  };

  const handleUpdateModification = useCallback((mod: Modification) => {
    setState(prev => {
      const exists = prev.modifications.find(m => m.id === mod.id);
      if (exists) {
        return {
          ...prev,
          modifications: prev.modifications.map(m => m.id === mod.id ? mod : m)
        };
      }
      return {
        ...prev,
        modifications: [...prev.modifications, mod]
      };
    });
  }, []);

  const handleDeleteModification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      modifications: prev.modifications.filter(m => m.id !== id)
    }));
  }, []);

  const handleUpdateState = useCallback((updates: Partial<PDFState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleUndo = () => {
    setState(prev => ({
      ...prev,
      modifications: prev.modifications.slice(0, -1)
    }));
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all edits? This cannot be undone.')) {
      setState(prev => ({ ...prev, modifications: [] }));
    }
  };

  const handleExport = async () => {
    if (!state.file) return;
    setIsExporting(true);
    try {
      const editedBytes = await saveEditedPDF(state.file, state.modifications);
      const blob = new Blob([editedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rewritten_${state.file.name}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] font-sans text-slate-900 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => state.file ? setShowSidebar(!showSidebar) : fileInputRef.current?.click()}
            className="flex items-center gap-2 group text-left"
          >
            <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-200 shadow-lg group-active:scale-95 transition-transform">
              <FileUp className="text-white w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black text-sm tracking-tight text-slate-800 leading-none">PDFRewrite</h1>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Pro Editor</span>
            </div>
          </button>

          {state.file && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 ml-2">
              <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-1.5 rounded-lg transition-all ${showSidebar ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-300 mx-1" />
              <button onClick={() => setState(p => ({ ...p, zoom: Math.max(0.3, p.zoom - 0.1) }))} className="p-1.5 hover:bg-white rounded-lg text-slate-600"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-[10px] font-black text-slate-500 min-w-[45px] text-center select-none">{Math.round(state.zoom * 100)}%</span>
              <button onClick={() => setState(p => ({ ...p, zoom: Math.min(4, p.zoom + 0.1) }))} className="p-1.5 hover:bg-white rounded-lg text-slate-600"><ZoomIn className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {state.file ? (
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md disabled:opacity-50 active:scale-95 text-xs sm:text-sm"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Download</span>
            </button>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 text-xs sm:text-sm"
            >
              <FileUp className="w-4 h-4" />
              <span>Upload PDF</span>
            </button>
          )}
        </div>
      </header>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" className="hidden" />

      <div className="flex-1 flex overflow-hidden">
        {state.file && showSidebar && (
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Pages</h2>
              <div className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{state.numPages}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Array.from({ length: state.numPages }).map((_, i) => (
                <button 
                  key={i}
                  onClick={() => document.getElementById(`page-${i}`)?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full group flex flex-col gap-2 p-2 rounded-2xl border-2 border-transparent hover:border-indigo-100 hover:bg-indigo-50 transition-all text-left"
                >
                  <div className="aspect-[3/4] bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center text-slate-300 font-bold">
                    {i + 1}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Page {i + 1}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
               <button onClick={handleClearAll} className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Clear All Edits
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 relative bg-slate-200 overflow-hidden">
          {!state.file ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white w-full">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6">
                <FileUp className="w-8 h-8 text-indigo-500" />
              </div>
              <h2 className="text-2xl font-black mb-2 text-slate-800">PDFRewrite Editor</h2>
              <p className="text-slate-500 max-w-sm mb-8 font-medium">Stable text editor. Edit existing content or add new text layers.</p>
              <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl active:scale-95 flex items-center gap-2">
                <Plus className="w-5 h-5" /> Select File
              </button>
            </div>
          ) : (
             <PDFViewer 
                state={state} 
                mode={mode}
                showHighlights={showHighlights}
                onUpdateModification={handleUpdateModification}
                onDeleteModification={handleDeleteModification}
                onUpdateState={handleUpdateState}
             />
          )}
        </main>
      </div>

      {state.file && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-1.5 gap-1">
          <button 
            onClick={() => setMode(EditorMode.VIEW)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${mode === EditorMode.VIEW ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <MousePointer2 className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Select & Edit</span>
          </button>

          <button 
            onClick={() => setMode(EditorMode.ADD)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${mode === EditorMode.ADD ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Insert Text</span>
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <button 
            onClick={() => setShowHighlights(!showHighlights)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${showHighlights ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <ScanText className={`w-4 h-4 ${showHighlights ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Scan</span>
          </button>

          <button onClick={handleUndo} disabled={state.modifications.length === 0} className={`p-3 rounded-xl transition-all ${state.modifications.length > 0 ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200'}`}>
            <Undo2 className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
