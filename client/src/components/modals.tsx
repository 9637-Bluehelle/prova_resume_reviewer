import { Download, Hand, Loader2, Move, RotateCw, Search, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from '@/components/ui/button'; 
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils'; 
import { supabase } from '@/lib/supabase';


interface ImageLightboxProps {
  src: string;
  onClose: () => void;
  onDownload?: () => void;
}

const ImageLightbox = ({ src, onClose, onDownload }: ImageLightboxProps) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  // Stato per la posizione dell'immagine
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  //zoom anche con rondella 
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
    
      const delta = e.deltaY;
      setZoom(prev => {
        const newZoom = delta < 0 ? Math.min(prev + 0.2, 4) : Math.max(prev - 0.2, 1);
        if (newZoom === 1) setPosition({ x: 0, y: 0 });
      
        return newZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);


  // Reset posizione quando si cambia zoom o rotazione (opzionale)
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.5, 1);
    if (newZoom === 1) setPosition({ x: 0, y: 0 });
    setZoom(newZoom);
  };
  
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // Gestione Inizio Trascinamento
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Gestione Movimento
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  // Fine Trascinamento
  const handleMouseUp = () => setIsDragging(false);

  // Reset posizione se si preme ESC o si chiude
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);


  //animazione messaggio
  const [showMessage, setShowMessage] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (zoom > 1 && !isDragging) {
      setIsExiting(false);
      setShowMessage(true);
    } else if (showMessage) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setShowMessage(false);
        setIsExiting(false);
      }, 800); 
      return () => clearTimeout(timer);
    }
  }, [zoom, isDragging]);


  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
      {/* Barra superiore Toolbar */}
      <div className="flex items-center justify-between p-4 text-white bg-black/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-full"><ZoomOut className="w-5 h-5" /></button>
          <span className="text-sm w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-full"><ZoomIn className="w-5 h-5" /></button>
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button onClick={handleRotate} className="p-2 hover:bg-white/10 rounded-full"><RotateCw className="w-5 h-5" /></button>
          {onDownload && (
            <button onClick={onDownload} className="p-2 hover:bg-white/10 rounded-full text-primary-foreground"><Download className="w-5 h-5" /></button>
          )}
        </div>
      </div>

      {/* Area Immagine */}
      <div
        ref={containerRef} 
        className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <div 
          className="transition-transform duration-200 ease-out flex items-center justify-center"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          <img 
            src={src} 
            alt="Dettaglio Scontrino" 
            className="max-h-[85vh] max-w-[95vw] object-contain shadow-2xl select-none"
            draggable={false}
          />
        </div>
      </div>
      <div className="p-4 h-[55px] flex items-center justify-center text-white/50 text-xs">
        {showMessage && (
          <div className="bottom-10 left-0 right-0 flex flex-col items-center gap-2 px-4 pointer-events-none">
            
            {/* visibile solo se il dispositivo ha un mouse */}
            <div className={`hidden [@media(hover:hover)]:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md text-white/80 text-xs ${isExiting ? 'animate-collapse' : 'animate-expand'}`}>
              <Move className="w-4 h-4" />
              <span>Tieni premuto il tasto sinistro del mouse e trascina per spostare • Puoi anche utilizzare la rotellina del mouse per lo zoom</span>
            </div>

            {/* visibile solo su dispositivi touch */}
            <div className={`flex [@media(hover:none)]:flex md:hidden items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md text-white/80 text-xs ${isExiting ? 'animate-collapse' : 'animate-expand'}`}>
              <div className="relative">
                <Hand className="w-5 h-5 text-primary animate-pulse" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
              </div>
              <span className="text-sm leading-tight">
                Puoi utilizzare le dita per zoomare o spostare l'immagine
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



interface ClosureDetailsModalProps {
  onClose: () => void;
  data: any;
  stores: any[] | undefined;
  isBlur?:boolean;
}

const ClosureDetailsModal = ({  onClose, data, stores, isBlur=true }: ClosureDetailsModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingImg, setIsLoadingImg] = useState(false);
  const { toast } = useToast()
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const storeName = stores?.find(s => s.id === data.storeId)?.name || 'Negozio non trovato';

  useEffect(() => {
    const getSecureLink = async () => {
      if (!data.receipt_image_url) return;
    
      setIsLoadingImg(true);
      const { data: sData, error } = await supabase.storage
        .from('receipt-bucket')
        .createSignedUrl(data.receipt_image_url, 3600);

      if (!error && sData) {
        setSignedUrl(sData.signedUrl);
      }
      setIsLoadingImg(false);
    };

    getSecureLink();
  }, [data.receipt_image_url]);


  const handleDownload = async () => {
    if (!signedUrl) return;

    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
    
      const link = document.createElement('a');
      link.href = url;
    
      // Nome del file per il download (usiamo il path originale o uno generico)
      const fileName = data.receipt_image_url.split('/').pop() || 'scontrino.jpg';
      link.download = fileName;
    
      document.body.appendChild(link);
      link.click();
    
      // Pulizia
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Errore durante il download:", error);
      toast({ title: "Errore", description: `Impossibile scaricare l'immagine: ${error}`, variant: "destructive" });
    }
  };

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", isBlur? "bg-black/40 backdrop-blur-sm": "")}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Dettaglio Chiusura</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Negozio</div>
            <div className="font-bold">{storeName}</div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Data</div>
            <div className="font-bold">
              {format(new Date(data.date), 'EEEE dd MMMM yyyy', { locale: it })}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Compilato da</div>
            <div className="font-bold">{data.compilerName}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Fondo Apertura</div>
              <div className="font-mono font-bold">€{Number(data.openingCashFund).toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Incasso Giorno</div>
              <div className="font-mono font-bold text-green-600">€{Number(data.totalSalesAmount).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Versamento Banca</div>
              <div className="font-mono font-bold text-red-600">€{Number(data.bankWithdrawalAmount).toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Fondo Teorico</div>
              <div className="font-mono font-bold">€{Number(data.theoreticalCashFund).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Conteggio Effettivo</div>
              <div className="font-mono font-bold">€{Number(data.actualCashFund).toFixed(2)}</div>
            </div>
            <div className={cn(
              "rounded-xl p-4",
              data.status === 'ok' ? "bg-green-100" :
              data.status === 'warning' ? "bg-amber-100" : "bg-red-100"
            )}>
              <div className="text-sm text-muted-foreground mb-1">Differenza</div>
              <div className={cn(
                "font-mono font-bold",
                data.status === 'ok' ? "text-green-700" :
                data.status === 'warning' ? "text-amber-700" : "text-red-700"
              )}>
                {Number(data.difference) > 0 ? "+" : ""}{Number(data.difference).toFixed(2)}€
              </div>
            </div>
          </div>

          {data.notes && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Note</div>
              <div className="whitespace-pre-wrap">{data.notes}</div>
            </div>
          )}
          {isLoadingImg && <Spinner/>}
          {signedUrl && (
            <div className="mt-8 mb-3">
              <div className="flex items-center justify-between px-1 mt-6 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Documento Allegato
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload}
                  className="h-8 gap-2 text-xs hover:bg-primary/100 hover:border-none hover:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  Scarica JPG
                </Button>
              </div>

              <div className="relative group overflow-hidden rounded-2xl border bg-gray-100 shadow-sm transition-all hover:shadow-md">
                <img 
                  src={signedUrl} 
                  alt="Scontrino" 
                  className="w-full h-56 object-contain bg-white cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                  onClick={() => setIsLightboxOpen(true)}
                />
      
                {/* Overlay informativo al passaggio del mouse */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Search className="w-5 h-5" />
                    <span>Clicca per ingrandire</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {isLightboxOpen && (
          <ImageLightbox 
            src={String(signedUrl)} 
            onClose={() => setIsLightboxOpen(false)} 
            onDownload={handleDownload}
          />
        )}
      </div>
    </div>
  );
};

export default ClosureDetailsModal;


export const Spinner =()=>{
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    </div>
  )
}