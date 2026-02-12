import { useState, useMemo, useEffect , Fragment} from "react";
import { Layout } from "@/components/layout";
import { PageHeader, Card, Button, cn } from "@/components/ui-kit";
import { useCloses } from "@/hooks/use-closes";
import { useStores, useDashboardData } from "@/hooks/use-stores";
import { useAuth } from "@/hooks/use-auth";
import { 
  format, startOfMonth, endOfMonth, subYears, parseISO, 
  isSameDay, eachDayOfInterval 
} from "date-fns";
import { it } from "date-fns/locale";
import { 
  Download, TrendingUp, TrendingDown, Store, AlertCircle, Landmark, 
  ChevronLeft, ChevronRight, Wallet, CheckCircle, AlertTriangle, 
  XCircle, BarChart3, LayoutDashboard, Loader2, Plus,FileSpreadsheet,
  Image
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell,  
} from "recharts";
import { Link, useLocation } from "wouter";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import ClosureDetailsModal, { Spinner } from "@/components/modals";
import * as XLSX from 'xlsx';

// Helper per il numero della settimana
const getWeekNumber = (date: Date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [selectedDayData, setSelectedDayData] = useState<{ date: Date; closes: any[] } | null>(null);
  const [selectedClose, setSelectedClose] = useState<any>(null);
  const { data: allCloses } = useCloses({});
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState("");
  type ExportMode = "excel" | "images";
  const [exportMode, setExportMode] = useState<ExportMode>("excel");
  const [exportRange, setExportRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd")
  });
  const [exportStoreId, setExportStoreId] = useState<string>("all");
  const { data: aggregatedStats, isLoading } = useDashboardData(selectedStoreId, currentDate);

  const [analyticsMode, setAnalyticsMode] = useState<"split" | "aggregated">("aggregated");
  
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Redirect operatori
  useEffect(() => {
    if (user?.role === 'operatore' && !user?.isAdmin) {
      setLocation("/operatore");
    }
  }, [user, setLocation]);

  // DATA FETCHING
  const { data: stores } = useStores();
  
  const currentRange = {
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  };

  const lastYearRange = {
    start: startOfMonth(subYears(currentDate, 1)),
    end: endOfMonth(subYears(currentDate, 1))
  };

  const { data: currentCloses, isLoading: loadingCurrent , isError} = useCloses({
    storeId: selectedStoreId === "all" ? undefined : selectedStoreId,
    startDate: format(currentRange.start, "yyyy-MM-dd"),
    endDate: format(currentRange.end, "yyyy-MM-dd"),
  });

  const { data: previousCloses } = useCloses({
    storeId: selectedStoreId === "all" ? undefined : selectedStoreId,
    startDate: format(lastYearRange.start, "yyyy-MM-dd"),
    endDate: format(lastYearRange.end, "yyyy-MM-dd"),
  });

interface DailyAnalysisData {
  dateLabel: string;
  totalSalesAmount: number;
  prevAmount: number;
  [key: string]: string | number; 
}

  const reportData = useMemo(() => {
  if (!currentCloses || !aggregatedStats || !stores) return null;

  const dailyMap = new Map<string, any>();
  const weeklyMap = new Map();

  currentCloses.forEach(curr => {
    const dateObj = parseISO(curr.date);
    const dateLabel = format(dateObj, "dd/MM");
    const weekNum = getWeekNumber(dateObj);
    const amount = Number(curr.totalSalesAmount || 0);
    
    const store = stores.find(s => s.id === curr.storeId);
    const storeName = store?.name || `Store ${curr.storeId}`;

    if (!dailyMap.has(dateLabel)) {
      // Inizializzazione CRITICA: azzera esplicitamente TUTTI i negozi per questo giorno
      const initData: DailyAnalysisData = { 
        dateLabel, 
        totalSalesAmount: 0, 
        prevAmount: 0 
      };
      stores.forEach(s => {
        initData[s.name] = 0;
        initData[`prev_${s.name}`] = 0;
      });
      dailyMap.set(dateLabel, initData);
    }

    const dayData = dailyMap.get(dateLabel);
    
    // Assegnazione specifica: assicurati che non ci siano sovrapposizioni
    dayData[storeName] = amount; 
    dayData.totalSalesAmount += amount;

    // --- LOGICA SETTIMANALE ---
    if (!weeklyMap.has(weekNum)) {
      weeklyMap.set(weekNum, { week: `Sett. ${weekNum}`, current: 0, prev: 0 });
    }
    const weekData = weeklyMap.get(weekNum);
    weekData.current += amount;

    // --- CONFRONTO ANNO PRECEDENTE ---
    // Ottimizzazione: Filtra prima per storeId per evitare errori di corrispondenza
    const prevDay = previousCloses?.find(p => {
      const dPrev = parseISO(p.date);
      return p.storeId === curr.storeId && 
             dPrev.getDate() === dateObj.getDate() &&
             dPrev.getMonth() === dateObj.getMonth();
    });

    if (prevDay) {
      const prevAmt = Number(prevDay.totalSalesAmount || 0);
      dayData.prevAmount += prevAmt;
      dayData[`prev_${storeName}`] = prevAmt;
      weekData.prev += prevAmt;
    }
  });

  return {
    stats: aggregatedStats,
    dailyAnalysis: Array.from(dailyMap.values()).sort((a, b) => {
      // Sort migliorato per date (converte dd/MM in un valore numerico comparabile)
      const [d1, m1] = a.dateLabel.split('/').map(Number);
      const [d2, m2] = b.dateLabel.split('/').map(Number);
      return (m1 * 100 + d1) - (m2 * 100 + d2);
    }),
    weeklyAnalysis: Array.from(weeklyMap.values())
  };
}, [currentCloses, previousCloses, aggregatedStats, stores]);


const { paymentDetails, dynamicTotals, weeklyData } = useMemo(() => {
  const methodMap = new Map();
  const weeklyMap = new Map(); // Mappa per i dati settimanali
  const totals = {
    salesFromPayments: 0,
    expenses: 0,
    bankDeposits: 0,
    reportedTotalSales: 0,
    prevYearTotal: 0
  };

  if (!currentCloses) return { paymentDetails: [], dynamicTotals: totals, weeklyData: [] };

  currentCloses.forEach((close: any) => {
    totals.reportedTotalSales += Number(close.totalSalesAmount || 0);

    close.expenses?.forEach((exp: any) => {
      totals.expenses += Number(exp.amount || 0);
    });

    totals.bankDeposits += Number(close.bankWithdrawalAmount || 0);

    close.payments?.forEach((p: any) => {
      const name = p.paymentMethod?.name || "Altro";
      const amount = Number(p.amount || 0);
      totals.salesFromPayments += amount;
      methodMap.set(name, (methodMap.get(name) || 0) + amount);
    });

    const date = new Date(close.date);
    const weekNum = getWeekNumber(date); 
    const weekLabel = `Sett ${weekNum}`;
    
    const currentWeekly = weeklyMap.get(weekLabel) || { week: weekLabel, current: 0, prev: 0 };
    currentWeekly.current += Number(close.totalSalesAmount || 0);
    weeklyMap.set(weekLabel, currentWeekly);
  });
  
  if (previousCloses) {
    totals.prevYearTotal = previousCloses.reduce((acc, curr) => 
      acc + Number(curr.totalSalesAmount || 0), 0
    );
  }

  const paymentDetails = Array.from(methodMap.entries()).map(([name, value], index) => ({
    name,
    value,
    color: COLORS[index % COLORS.length]
  })).sort((a, b) => b.value - a.value);
   
  const weeklyData = Array.from(weeklyMap.values());

  return { paymentDetails, dynamicTotals: totals , weeklyData};
}, [currentCloses, previousCloses]);

  const days = eachDayOfInterval({ start: currentRange.start, end: currentRange.end });
  const emptyDays = startOfMonth(currentDate).getDay();
  const totalStores = stores?.length || 0;

  const getCloseStatus = (date: Date) => {
    const dayCloses = currentCloses?.filter(c => isSameDay(parseISO(c.date), date)) || [];
    const closedCount = new Set(dayCloses.map(c => c.storeId)).size;
    const isComplete = totalStores > 0 && closedCount === totalStores;
    const hasError = dayCloses.some(c => c.status === 'ko');
    const hasWarning = dayCloses.some(c => c.status === 'warning');

    return { dayCloses, closedCount, isComplete, status: hasError ? 'ko' : hasWarning ? 'warning' : 'ok' };
  };

  const getLatestClose = (storeId: string) => {
    if (!allCloses) return null;
    const storeCloses = allCloses.filter(c => c.storeId === storeId);
    if (storeCloses.length === 0) return null;
    return storeCloses.sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime())[0];
  };

  interface CloseData {
    id: any;
    date: any;
    notes: any;
    status: any;
    storeId: any;
    compilerName: any;
    totalSalesAmount: any;
    bankWithdrawalAmount: any;
    openingCashFund: any;
    theoreticalCashFund: any;
    actualCashFund: any;
    difference: any;
    createdAt: any;
    receipt_image_url: any;
    store: any[];
    payments: {
        id: any;
        amount: any;
        paymentMethodId: any;
        paymentMethod: any[];
    }[];
    expenses: any[];
  }
  const getCurrentFund = (storeId: string, key: keyof CloseData) => {
    const lastClose = getLatestClose(storeId);
    if (lastClose) {
      return Number(lastClose[key]);
    }
    const store = stores?.find(s => s.id === storeId);
    return Number(store?.openingCashFund || 0);
  };

  const handleExportExcel = () => {
    setIsDownloading(true);

    // Filtriamo i dati base
    const filteredData = allCloses?.filter(close => {
      const closeDate = format(new Date(close.date), "yyyy-MM-dd");
      return (
        closeDate >= exportRange.start && 
        closeDate <= exportRange.end && 
        (exportStoreId === "all" || String(close.storeId) === exportStoreId)
      );
    });

    if (!filteredData || filteredData.length === 0) {
      setIsDownloading(false);
      resetFilter();
      toast({title: "Attenzione !", description:"Nessun dato trovato", variant: "default"});
      return;
    }

    // Elaborazione righe Excel per analisi dettagliata
    const excelRows = filteredData.map(close => {
      const store = stores?.find(s => s.id === close.storeId);
    
      // Creiamo un oggetto base con i dati della chiusura
      const row: any = {
        'Data': format(new Date(close.date), "dd/MM/yyyy"),
        'Negozio': store?.name || `ID ${close.storeId}`,
        'Compilatore': close.compilerName,
        'Stato': close.status.toUpperCase(),
        'Vendite Totali (€)': Number(close.totalSalesAmount),
        'Versamento Banca (€)': Number(close.bankWithdrawalAmount),
        'Differenza Cassa (€)': Number(close.difference),
        'Fondo Cassa Apertura (€)': Number(close.openingCashFund),
        'Fondo Cassa Teorico (€)': Number(close.theoreticalCashFund),
        'Fondo Cassa Reale (€)': Number(close.actualCashFund),
      };

      // metodo di pagamento
      close.payments?.forEach((p: any) => {
        const methodName = p.paymentMethod?.name || `Metodo ${p.paymentMethodId}`;
        row[`Pag: ${methodName} (€)`] = Number(p.amount);
      });

      const totalExp = close.expenses?.reduce((acc: number, ex: any) => acc + Number(ex.amount), 0) || 0;
      row['Totale Spese (€)'] = totalExp;
      row['Dettaglio Spese'] = close.expenses?.map((ex: any) => `${ex.description}: ${ex.amount}€`).join(" | ") || "";
      row['Note'] = close.notes || "";
      row['Creato il'] = format(String(close.createdAt), 'yyyy-MM-dd HH:mm:ss')

      return row;
    });

    // colonne fisse iniziali
    const fixedStart = [
      'Data', 'Negozio', 'Compilatore', 'Stato', 
      'Vendite Totali (€)', 'Versamento Banca (€)', 'Differenza Cassa (€)', 
      'Fondo Cassa Apertura (€)', 'Fondo Cassa Teorico (€)', 'Fondo Cassa Reale (€)'
    ];

    // colonne fisse finali
    const fixedEnd = ['Totale Spese (€)', 'Dettaglio Spese', 'Creato il', 'Note'];

    // identifichiamo dinamicamente tutte le colonne "Pag: ..." 
    const dynamicPaymentCols = new Set<string>();
    excelRows.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key.startsWith('Pag:')) {
          dynamicPaymentCols.add(key);
        }
      });
    });

    //convertiamo in array e ordiniamo
    const sortedPaymentCols = Array.from(dynamicPaymentCols).sort();

    const finalHeader = [...fixedStart, ...sortedPaymentCols, ...fixedEnd];
    const worksheet = XLSX.utils.json_to_sheet(excelRows, { header: finalHeader });
  
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalColumnCount = range.e.c + 1;

    //larghezza colonne
    worksheet['!cols'] = Array(totalColumnCount).fill({ wch: 18 });

    const workbook = XLSX.utils.book_new();
    const store = stores?.find(s => s.id === exportStoreId);
    const name = exportStoreId === "all"? 'Tutti i negozzi' : store?.name;
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analisi Chiusure");
    XLSX.writeFile(workbook, `Chiusure_${name?.replace(/ /g, '_')}_${exportRange.start}_al_${exportRange.end}.xlsx`);
    
    setIsDownloading(false);
    resetFilter();
    setIsExportModalOpen(false);
  };

  const getFilteredCloses = async () => {
  let query = supabase
    .from("cash_closes")
    .select(`
      id,
      date,
      store_id,
      receipt_image_url,
      stores (
        id,
        name
      )
    `)
    .gte("date", exportRange.start)
    .lte("date", exportRange.end);

  if (exportStoreId !== "all") {
    query = query.eq("store_id", exportStoreId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
};

const sanitizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");

const getStoreName = (storeField: any): any => {
  if (!storeField) return undefined;
  if (Array.isArray(storeField)) {
    return storeField[0]?.name ?? undefined;
  }
  return storeField.name ?? undefined;
};

const handleExportImages = async () => {
  try {
    setDownloadProgress(0);
    setDownloadLabel("Recupero dati...");
    setIsDownloading(true);

    const closes = await getFilteredCloses();
    const images = closes.filter(c => c.receipt_image_url).sort((a, b) => a.date.localeCompare(b.date));

    if (!images.length) {
      toast({ title: "Nessuna immagine trovata" });
      return;
    }

    const zip = new JSZip();
    const isAllStores = exportStoreId === "all";

    const total = images.length;
    let completed = 0;

    const foldersMap = new Map<string, JSZip>();
    
    for (const close of images) {
      const storeName = getStoreName(close.stores) ?? `negozio_non_identificato`;
      const safeStoreName = sanitizeName(storeName);

      // scegli la cartella giusta
      let targetFolder: JSZip;

      if (isAllStores) {
        if (!foldersMap.has(safeStoreName)) {
          const folder = zip.folder(safeStoreName);
          if (!folder) continue;
          foldersMap.set(safeStoreName, folder);
        }
        targetFolder = foldersMap.get(safeStoreName)!;
      } else {
        targetFolder = zip;
      } 

      // signed url
      const { data: signed, error } = await supabase.storage
        .from("receipt-bucket")
        .createSignedUrl(close.receipt_image_url, 60);

      if (!error && signed) {
        const response = await fetch(signed.signedUrl);
        const blob = await response.blob();

        const fileName = `${close.date}_${close.id}.${blob.type.split("/")[1] || "jpg"}`;
        targetFolder.file(fileName, blob);
      }

      completed++;
      setDownloadProgress(Math.round((completed / total) * 100));
    }

    setDownloadLabel("Creazione archivio ZIP...");
    const content = await zip.generateAsync({ type: "blob" });

    const zipName = isAllStores
      ? `ricevute_Tutti_i_negozzi_${exportRange.start}_${exportRange.end}.zip`
      : `ricevute_${sanitizeName(getStoreName(images[0].stores) ?? "negozio")}_${exportRange.start}_${exportRange.end}.zip`;

    saveAs(content, zipName);
    setDownloadLabel("Download completato");
  } catch (err) {
    console.error(err);
    toast({
      title: "Errore",
      description: `Errore durante il download delle immagini : ${err}`,
      variant: "destructive",
    });
  } finally {
    setIsDownloading(false);
    resetFilter();
    setTimeout(() => setDownloadProgress(0), 500);
  }
};

  const resetFilter = () => {
    setExportRange({
      start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      end: format(endOfMonth(new Date()), "yyyy-MM-dd")
    }) ;
    setExportStoreId("all");
  }

  const pieData = useMemo(() => {
    if (!paymentDetails) return [];

    return paymentDetails.map((method, index) => {
    
      let color = COLORS[index % COLORS.length];
  
      return {
        name: method.name,
        value: method.value,
        color: color
      };
    });
  }, [paymentDetails]);

  const growth = dynamicTotals.prevYearTotal > 0 
  ? ((dynamicTotals.salesFromPayments - dynamicTotals.prevYearTotal) / dynamicTotals.prevYearTotal) * 100 
  : 0;

  return (
    <Layout>
      <PageHeader 
        title="Dashboard"
        description="Monitoraggio vendite, chiusure e flussi di cassa"
        action={
          <div className="flex gap-2">
            <Link href="/close/new">
              <Button size="sm" className="hidden sm:flex"><Plus className="w-4 h-4 mr-2" /> Nuova Chiusura</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} ><Download className="w-4 h-4 mr-2" /> Export</Button>
          </div>
        }
      />

      {/* FILTRI E TAB SWITCHER */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          <button 
            onClick={() => {setSelectedStoreId('all'); setActiveTab("overview")}}
            className={cn("flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all", activeTab === "overview" ? "bg-white shadow-sm text-primary" : "text-slate-500")}
          >
            <LayoutDashboard className="w-4 h-4" /> Operatività
          </button>
          <button 
            onClick={() => setActiveTab("analytics")}
            className={cn("flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all", activeTab === "analytics" ? "bg-white shadow-sm text-primary" : "text-slate-500")}
          >
            <BarChart3 className="w-4 h-4" /> Analisi
          </button>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Card className="p-2 flex items-center gap-2 min-w-[180px]">
            {/*<Calendar className="text-primary w-4 h-4 ml-1" />*/}
            <input 
              type="month" 
              className="pl-2 bg-transparent border-none focus:ring-0 text-sm font-bold w-full capitalize"
              value={format(currentDate, "yyyy-MM")}
              onClick={(e) => (e.target as HTMLInputElement).showPicker()}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
            />
          </Card>
          {activeTab==="analytics" && (
            <Card className="p-2 pl-4 flex items-center gap-2 min-w-[180px]">
              <select 
                className="bg-transparent border-none focus:ring-0 text-sm font-bold appearance-none w-full"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
              >
                <option value="all">Tutti i Negozi</option>
                {stores?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Store className="text-black-200 w-4 h-4 mr-1" />
            </Card>
          )}
        </div>
      </div>
      {!isError && (loadingCurrent || !reportData ) ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-8">
          
          {/* KPI */}
          {activeTab === "analytics" && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
    <Card className="relative overflow-hidden p-5 border-none shadow-md bg-white">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <TrendingUp className="w-12 h-12 text-blue-600" />
      </div>
      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Incasso Totale</p>
      
      <div className="flex flex-col mt-1">
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-slate-900">
            €{dynamicTotals.salesFromPayments.toLocaleString('it-IT')}
          </span>
          <span className={cn(
            "text-[11px] font-bold mb-1 px-1.5 py-0.5 rounded flex items-center",
            growth >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
          </span>
        </div>

        {/* CONFRONTO: Mostra solo se il totale dichiarato differisce dai pagamenti reali */}
        {Math.abs(dynamicTotals.salesFromPayments - dynamicTotals.reportedTotalSales) > 0.01 && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] text-amber-800 font-medium">
              Discrepanza: Il totale dichiarato è <strong>€{dynamicTotals.reportedTotalSales.toLocaleString('it-IT')}</strong> controlla errori e avvisi !
            </span>
          </div>
        )}
      </div>
    </Card>

    <Card className="p-5 border-none shadow-md bg-primary text-white">
      <p className="text-xs opacity-80 font-bold uppercase tracking-wider">Saldo Netto</p>
      <div className="text-2xl font-black mt-1">
        €{(dynamicTotals.salesFromPayments - dynamicTotals.expenses - dynamicTotals.bankDeposits).toLocaleString('it-IT')}
      </div>
      <p className="text-[10px] opacity-70 mt-2 italic font-medium">
      </p>
    </Card>
  </div>
)}

          {activeTab === "overview" ? (
            /* VISTA OPERATIVA (CALENDARIO + FONDI) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
              <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-black/5">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold font-display capitalize">{format(currentDate, "MMMM yyyy", {locale: it})}</h2>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border">
                  {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
                    <div key={day} className="bg-gray-50 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">{day}</div>
                  ))}
                  {Array.from({ length: emptyDays }).map((_, i) => <div key={i} className="bg-gray-50/50 min-h-[90px]" />)}
                  {days.map((day) => {
                    const { dayCloses, closedCount, isComplete, status } = getCloseStatus(day);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div 
                        key={day.toISOString()} 
                        onClick={() => setSelectedDayData({ date: day, closes: dayCloses })}
                        className="bg-white min-h-[90px] p-2 relative group hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <span className={cn("text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-primary text-white" : "text-slate-400")}>
                          {format(day, "d")}
                        </span>
                        {closedCount > 0 ? (
                          <div className="my-2 flex flex-col items-center">
                            <div 
                              title={
                                closedCount===totalStores ? 
                                  "Tutti i negozi hanno effetuato la chiusura"
                                  :
                                  `Solo ${closedCount} negozi${closedCount === 1 ? "o" :""} su ${totalStores} ha${closedCount === 1 ? "" :"nno"} effetuato la chiusura`
                              } 
                              className={cn("flex flex-col items-center text-[10px] font-black px-2 py-0.5 rounded-full select-none", isComplete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                              {closedCount}/{totalStores}
                            </div>
                            {status !== 'ok' && <div className={cn("w-1.5 h-1.5 rounded-full mt-1 animate-pulse", status === 'ko' ? "bg-red-500" : "bg-amber-500")} />}
                          </div>
                        ) : (
                          <Link href={`/close/new?date=${format(day, "yyyy-MM-dd")}`} className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-white/40 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full border bg-white shadow-sm">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
              </div>

              <div className="space-y-6">
                <Card>
             <h3 className="font-bold mb-4 flex items-center gap-2">
               <Wallet className="w-5 h-5 text-primary" />
               Fondo Cassa Negozi
             </h3>
             <div className="space-y-3">
               {stores?.map(store => {
                 const lastClose = getLatestClose(store.id);
                 const currentFund = getCurrentFund(store.id, 'actualCashFund');
                 const theoricalcurrentFund = getCurrentFund(store.id, 'theoreticalCashFund');
                 return (
                   <div key={store.id} className="p-3 bg-gray-50 rounded-xl">
                     <div className="flex items-center justify-between mb-1">
                       <span className="font-medium text-sm">{store.name}</span>
                       {lastClose && (
                         <span className={cn(
                           "w-2 h-2 rounded-full",
                           lastClose.status === 'ok' ? "bg-green-500" :
                           lastClose.status === 'warning' ? "bg-amber-500" : "bg-red-500"
                         )} />
                       )}
                     </div>
                     <div className="flex items-center justify-between">
                      <div>
                       <div className="font-mono font-bold text-lg text-primary">
                        €{currentFund.toFixed(2)}
                       </div>
                        {lastClose && (
                         <div className="text-xs text-muted-foreground mt-1">
                          Ultima chiusura: {format(new Date(lastClose.date), 'dd MMM', { locale: it })}
                         </div>
                        )}
                      </div>
                      {theoricalcurrentFund !== currentFund && (
                       <div className="flex flex-col items-center px-5 py-2 bg-amber-300/20 border rounded-lg border-amber-500">
                        <span className="font-medium text-xs">Fondo teorico : </span>
                        <div className="font-mono font-bold text-lg text-primary">
                         €{theoricalcurrentFund.toFixed(2)}
                        </div>
                       </div>
                      )}
                     </div>
                   </div>
                 );
               })}
             </div>
           </Card>

                <Card className="bg-gradient-to-br from-primary to-orange-600 text-white border-none shadow-xl">
             <h3 className="font-display font-bold text-lg opacity-90">Stato Rapido</h3>
             <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <CheckCircle className="w-5 h-5 text-green-300" />
                  <div className="flex flex-row gap-7 items-center">
                    <div className="text-ml font-medium opacity-80">Bilanciate</div>
                    <div className="text-xl font-bold">
                      {reportData?.stats.daysOk}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                  <div className="flex flex-row gap-7 items-center">
                    <div className="text-ml font-medium opacity-80">Avvisi</div>
                    <div className="text-xl font-bold">
                      {reportData?.stats.daysWarning}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                  <XCircle className="w-5 h-5 text-red-300" />
                  <div className="flex flex-row gap-7 items-center">
                    <div className="text-ml font-medium opacity-80">Errori</div>
                    <div className="text-xl font-bold">
                      {reportData?.stats.daysKo}
                    </div>
                  </div>
                </div>
             </div>
           </Card>
              </div>
            </div>
          ) : (
            /* VISTA ANALITICA (GRAFICI) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-6 border-0 shadow-sm">
                <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Andamento Vendite Giornaliere
                </h3>
                <div className="h-[350px]">
                  { selectedStoreId === "all" && (
                    <div className="flex bg-slate-100 p-1 rounded-lg border-none shadow-sm mb-7">
                      <button 
                        onClick={() => setAnalyticsMode("aggregated")}
                        className={cn("px-3 py-1 rounded-md text-[10px] font-bold transition-all", 
                          analyticsMode === "aggregated" ? "bg-white shadow-sm text-primary" : "text-slate-500")}
                      >
                        Aggregato
                      </button>
                      <button 
                        onClick={() => setAnalyticsMode("split")}
                        className={cn("px-3 py-1 rounded-md text-[10px] font-bold transition-all", 
                          analyticsMode === "split" ? "bg-white shadow-sm text-primary" : "text-slate-500")}
                      >
                        Per Negozio
                      </button>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
  <AreaChart 
    key={`chart-${selectedStoreId}-${analyticsMode}`}
    data={reportData?.dailyAnalysis}
  >
    <defs>
      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
    <XAxis dataKey="dateLabel" fontSize={10} axisLine={false} tickLine={false} />
    <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => `€${value}`} />
    <Tooltip />
    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />

    {/* SCENARIO 1: Singolo Negozio Selezionato */}
    {selectedStoreId !== "all" && (
      <>
        <Area 
          type="monotone" 
          dataKey="totalSalesAmount" 
          name="Vendite" 
          stroke="#3b82f6" 
          fill="url(#colorSales)" 
          strokeWidth={3} 
          connectNulls
        />
        <Area 
          type="monotone" 
          dataKey="prevAmount" 
          name="Anno Scorso" 
          stroke="#cbd5e1" 
          fill="transparent" 
          strokeDasharray="5 5" 
          connectNulls
        />
      </>
    )}

    {/* SCENARIO 2: Tutti i negozi - Vista Aggregata */}
    {selectedStoreId === "all" && analyticsMode === "aggregated" && (
      <>
        <Area 
          type="monotone" 
          dataKey="totalSalesAmount" 
          name="Totale Negozi" 
          stroke="#3b82f6" 
          fill="url(#colorSales)" 
          strokeWidth={3} 
          connectNulls
        />
        <Area 
          type="monotone" 
          dataKey="prevAmount" 
          name="Totale Anno Scorso" 
          stroke="#cbd5e1" 
          fill="transparent" 
          strokeDasharray="5 5" 
          connectNulls
        />
      </>
    )}

    {/* SCENARIO 3: Tutti i negozi - Vista Split (Linee multiple) */}
    {selectedStoreId === "all" && analyticsMode === "split" && (
      stores?.map((store, index) => {
        const color = COLORS[index % COLORS.length];
        return (
          <Fragment key={`split-${store.id}`}>
            <Area 
              type="monotone" 
              dataKey={store.name} 
              name={store.name} 
              stroke={color} 
              fill="transparent" 
              strokeWidth={2} 
              stackId={store.id.toString()}
              connectNulls
            />
            <Area 
              type="monotone" 
              dataKey={`prev_${store.name}`} 
              name={`${store.name} (Prec)`}
              stroke={color} 
              fill="transparent" 
              strokeDasharray="4 4" 
              strokeOpacity={0.3} 
              stackId={store.id.toString()}
              connectNulls
            />
          </Fragment>
        );
      })
    )}
  </AreaChart>
</ResponsiveContainer>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-6 border-0 shadow-sm">
                  <h3 className="text-sm font-bold mb-4">Ripartizione Incassi</h3>
                  <div className="h-[250px] relative">
                    {/* Centro della ciambella con il totale */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-[10px] text-slate-500 uppercase font-bold">Totale</span>
                       <span className="text-sm font-black text-slate-800 mb-10">€{dynamicTotals.salesFromPayments.toLocaleString('it-IT')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-6 border-0 shadow-sm bg-white overflow-hidden relative">
  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
  <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
    <Landmark className="w-4 h-4 text-primary"/> Saldi Teorici Cassa
  </h3>
  <div className="space-y-4">
    <div className="flex justify-between items-center group">
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-400 font-bold uppercase">Entrate</span>
        <span className="text-sm font-medium text-slate-600">Totale Incassi</span>
      </div>
      <span className="font-mono font-bold text-emerald-600">
        +€{dynamicTotals.salesFromPayments.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
      </span>
    </div>

    <div className="space-y-2 border-t border-b border-slate-50 py-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 italic">Spese (Uscite)</span>
        {/* USIAMO IL VALORE DINAMICO */}
        <span className="font-mono font-semibold text-red-400">
          -€{dynamicTotals.expenses.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 italic">Versamenti Banca</span>
        {/* USIAMO IL VALORE DINAMICO */}
        <span className="font-mono font-semibold text-amber-500">
          -€{dynamicTotals.bankDeposits.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>

    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
      <span className="text-sm font-bold text-slate-700">Saldo Netto Teorico</span>
      <span className="text-lg font-black text-primary">
        €{(dynamicTotals.salesFromPayments - dynamicTotals.expenses - dynamicTotals.bankDeposits).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
      </span>
    </div>
  </div>
</Card>
              </div>
           
              <Card className="p-6 border-0 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-sm font-bold">Confronto Mensile</h3>
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black",
                      growth >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {growth.toFixed(1)}%
                    </div>
                  </div>
  
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Anno scorso', value: dynamicTotals.prevYearTotal, fill: '#9fadc0' },
                          { name: 'Quest’anno', value:dynamicTotals.salesFromPayments, fill: growth >= 0 ? '#3b82f6' : '#ef4444' },
                        ]}
                        margin={{ top: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                          <LabelList 
                            dataKey="value" 
                            position="top" 
                            formatter={(v: number) => `€${Math.round(v).toLocaleString()}`} 
                            fontSize={11} 
                            fontFamily="monospace"
                            fontWeight="bold"
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6 border-0 shadow-sm">
                  <h3 className="text-sm font-bold mb-6">Performance Settimanale</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData?.weeklyAnalysis} layout="vertical" margin={{ left: 20, right: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="week" 
                        type="category" 
                        fontSize={10} 
                        axisLine={false} 
                        tickLine={false} 
                        width={60}
                      />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="current" name="Corrente" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10}>
                        <LabelList dataKey="current" position="right" formatter={(v: number) => `€${Math.round(v)}`} fontSize={9} fill="#64748b" offset={10} />
                      </Bar>
                      <Bar dataKey="prev" name="Precedente" fill="#b9cce2" radius={[0, 4, 4, 0]} barSize={10} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
            </div>
          )}
        </div>
      )}
      {/* EXPORT */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[580px] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between gap-9">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Esporta Dati</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    {exportMode === "excel"
                      ? "Seleziona il periodo e il negozio per il file Excel."
                      : "Seleziona il periodo e il negozio per scaricare le ricevute."
                    }
                  </p>
                </div>
                <div>
                  <div className="gap-3 flex p-1 bg-slate-100 rounded-xl mb-6">
                    <button
                      onClick={() => {resetFilter(); setExportMode("excel")}}
                      disabled={isDownloading}
                      className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 text-sm font-bold rounded-lg transition-all ${
                        exportMode === "excel" 
                          ? "bg-white text-primary shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> {/* Icona opzionale */}
                       Excel
                    </button>
                    <button
                      onClick={() => {resetFilter(); setExportMode("images")}}
                      disabled={isDownloading}
                      className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 text-sm font-bold rounded-lg transition-all ${
                        exportMode === "images" 
                          ? "bg-white text-primary shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Image className="w-4 h-4" /> 
                      Immagini
                    </button>
                  </div>
                </div>
              </div>
        
        
              <div className="space-y-4">
                {/* Selezione Data Inizio */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-400">Data Inizio</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={exportRange.start}
                    disabled={isDownloading}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                    onChange={(e) => setExportRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>

                {/* Selezione Data Fine */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-400">Data Fine</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={exportRange.end}
                    disabled={isDownloading}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                    onChange={(e) => setExportRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>

                {/* Selezione Negozio */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-400">Negozio</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20">
                    <select 
                      className="w-full bg-slate-50 rounded-lg pr-3 py-0 text-sm focus:outline-none focus:ring-0"
                      value={exportStoreId}
                      disabled={isDownloading}
                      onChange={(e) => setExportStoreId(e.target.value)}
                    >
                      <option value="all">Tutti i Negozi</option>
                      {stores?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
              {isDownloading && (
                <div className="px-6 pb-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>{downloadLabel || "Preparazione download..."}</span>
                    <span>{downloadProgress}%</span>
                  </div>

                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="bg-slate-50 p-4 flex gap-3 justify-end">
              <button 
                onClick={() => {resetFilter(); setIsExportModalOpen(false)}}
                disabled = {isDownloading}
                className={`px-4 py-2 text-sm font-bold text-slate-600 ${isDownloading? 'cursor-not-allowed hover:none' : 'hover:bg-slate-200'} rounded-lg transition-colors`}
              >
                Annulla
              </button>
              <button
                onClick={exportMode === "excel" ? handleExportExcel : handleExportImages}
                disabled={isDownloading}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${isDownloading ? "bg-gray-300 text-black/60 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90" }`} 
              >
                {isDownloading
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Download className="w-4 h-4" />
                }
                {exportMode === "excel" ? "Scarica Excel" : "Scarica Immagini"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODALI */}
      {selectedDayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDayData(null)}>
          <Card className="w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Dettaglio {format(selectedDayData.date, "dd MMM yyyy", { locale: it })}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Stato chiusure per punto vendita</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDayData(null)}>✕</Button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {stores?.map(store => {
                const storeCloses = selectedDayData.closes.filter(c => c.storeId === store.id);
                return (
                  <div key={store.id} className="p-3 border rounded-xl bg-white">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-black text-slate-700 uppercase">{store.name}</span>
                      {storeCloses.length === 0 && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black">MANCANTE</span>}
                    </div>
                    {storeCloses.map(close => (
                      <div key={close.id} className="flex items-center justify-between group">
                        <div className="grid grid-cols-2 gap-x-4">
                          <div>
                            <p className="text-[8px] text-slate-400 font-bold uppercase">Incasso</p>
                            <p className="text-xs font-mono font-bold">€{Number(close.totalSalesAmount).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-400 font-bold uppercase">Diff.</p>
                            <p className={cn("text-xs font-mono font-bold", Number(close.difference) < 0 ? "text-red-500" : "text-green-600")}>
                              {Number(close.difference) >= 0 ? "+" : ""}{Number(close.difference).toFixed(2)}€
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedClose(close)} className="h-8 w-8 p-0">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="p-4 bg-slate-50 border-t">
              <Link href={`/close/new?date=${format(selectedDayData.date, "yyyy-MM-dd")}`}>
                <Button className="w-full font-bold" size="sm" onClick={() => setSelectedDayData(null)}><Plus className="w-4 h-4 mr-2" /> Aggiungi Chiusura</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {selectedClose && (
        <ClosureDetailsModal 
          isBlur={true}
          onClose={() => setSelectedClose(null)} 
          data={selectedClose}
          stores={stores}
        />
      )}
    </Layout>
  );
}