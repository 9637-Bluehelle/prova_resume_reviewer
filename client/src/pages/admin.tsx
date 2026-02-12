import { Layout } from "@/components/layout";
import { PageHeader, Card, Button, Input, cn } from "@/components/ui-kit";
import { useStores, useCreateStore, useUpdateStore } from "@/hooks/use-stores";
import { usePaymentMethods, useCreatePaymentMethod, useUpdatePaymentMethod } from "@/hooks/use-payment-methods";
import { useCloses } from "@/hooks/use-closes";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/use-company-settings";
import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Edit2, Check, X, Wallet, Eye, AlertTriangle, CheckCircle, Upload, Building2, RotateCcw, Lock, LockOpen, Filter, SortDesc, SortAsc, Search, ChevronUp, ListFilter, ArrowDownAz, ArrowUpAZ, Clock, History, UploadCloud, AlertCircle, Trash2, MailCheck } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
//import * as XLSX from 'xlsx';
import ClosureDetailsModal, { Spinner } from "@/components/modals";
import { it } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
//import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsers, /*useCreateUser, useDeleteUser,*/ useUpdateUser } from "@/hooks/use-users";


export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'control' | 'stores' | 'payments' | 'users' | 'settings'>('control');
  
  return (
    <Layout>
      <PageHeader title="Amministrazione" description="Gestisci negozi e impostazioni" />
      
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'control', label: 'Controllo Cassa' },
          { id: 'stores', label: 'Negozi' }, 
          { id: 'payments', label: 'Pagamenti' },
          { id: 'users', label: 'Utenti' },
          //{id: 'settings', label: 'Impostazioni'}
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            data-testid={`tab-${tab.id}`}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors",
              activeTab === tab.id ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'control' && <ControlTab />}
        {activeTab === 'stores' && <StoresTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </Layout>
  );
}

// --- CONTROL TAB ---
function ControlTab() {
  const { data: stores } = useStores();
  const { data: closes } = useCloses();
  const updateStore = useUpdateStore();
  //const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  //const [newFund, setNewFund] = useState("");
  const storeRef = useRef<HTMLDivElement>(null);
  const operatorRef = useRef<HTMLDivElement>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [selectedClose, setSelectedClose] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCompilerSuggestions, setShowCompilerSuggestions] = useState(false);
  const CompilerOptions = useMemo(() => 
    Array.from(new Set(closes?.map(c => c.compilerName).filter(Boolean))), 
    [closes]
  );
  const [filters, setFilters] = useState({
    storeId: "all",
    status: [] as string[],
    dateFrom: "",
    dateTo: "",
    operator: "all"
  });

  const resetFilters = () => {
    setFilters({
      storeId: "all",
      status: [],
      dateFrom: "",
      dateTo: "",
      operator: "all"
    });
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Chiudi dropdown Negozio
      if (storeRef.current && !storeRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
      // Chiudi dropdown Operatore
      if (operatorRef.current && !operatorRef.current.contains(event.target as Node)) {
        setShowCompilerSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calcola il fondo cassa attuale per ogni negozio (dall'ultima chiusura)
  const getLatestClose = (storeId: string) => {
    if (!closes) return null;
    const storeCloses = closes.filter(c => c.storeId === storeId);
    if (storeCloses.length === 0) return null;
    return storeCloses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const getCurrentFund = (storeId: string) => {
    const lastClose = getLatestClose(storeId);
    if (lastClose) {
      return Number(lastClose.actualCashFund);
    }
    const store = stores?.find(s => s.id === storeId);
    return Number(store?.openingCashFund || 0);
  };

  /*const handleUpdateFund = async (storeId: string) => {
    if (!newFund) return;
    try {
      await updateStore.mutateAsync({ id: storeId, openingCashFund: newFund });
      setEditingStoreId(null);
      setNewFund("");
    } catch (err) {
      console.error(err);
    }
  };*/

  const filteredCloses = useMemo(() => {
    if (!closes) return [];
  
    return closes.filter(close => {
      const matchStore = filters.storeId === "all" || close.storeId === filters.storeId;
      const matchStatus = filters.status.length === 0 || filters.status.includes(close.status);
      const isAllOperators = !filters.operator || filters.operator === "all";
      const matchOperator = isAllOperators || 
        close.compilerName?.toLowerCase().includes(filters.operator.toLowerCase());
    
      // Filtro data
      const closeDate = new Date(close.date).setHours(0,0,0,0);
      const from = filters.dateFrom ? new Date(filters.dateFrom).setHours(0,0,0,0) : null;
      const to = filters.dateTo ? new Date(filters.dateTo).setHours(0,0,0,0) : null;
    
      const matchDate = (!from || closeDate >= from) && (!to || closeDate <= to);

      return matchStore && matchStatus && matchOperator && matchDate;
    }).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [closes, filters, sortOrder]);

  const filteredOptions = CompilerOptions.filter(opt => {
    if (filters.operator === 'all' || !filters.operator) return true;
    return opt.toLowerCase().includes(filters.operator.toLowerCase());
  });

  return (
    <>
      <Card>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Stato Fondo Cassa per Negozio
        </h3>
        
        <div className="grid gap-4">
          {stores?.map(store => {
            const lastClose = getLatestClose(store.id);
            const currentFund = getCurrentFund(store.id);
            //const isEditing = editingStoreId === store.id;

            return (
              <div key={store.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-lg">{store.name}</div>
                  {lastClose && (
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-bold",
                      lastClose.status === 'ok' ? "bg-green-100 text-green-700" :
                      lastClose.status === 'warning' ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {lastClose.status === 'ok' ? 'OK' : lastClose.status === 'warning' ? 'ATTENZIONE' : 'ERRORE'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fondo Iniziale Impostato:</span>
                    <div className="font-mono font-bold">€{Number(store.openingCashFund || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fondo Cassa Attuale:</span>
                    <div className="font-mono font-bold text-primary">€{currentFund.toFixed(2)}</div>
                  </div>
                </div>

                {lastClose && (
                  <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                    Ultima chiusura: {format(new Date(lastClose.date), 'dd MMMM yyyy', { locale: it })} 
                    {' - '} Differenza: 
                    <span className={cn(
                      "font-mono font-bold ml-1",
                      Number(lastClose.difference) === 0 ? "text-green-600" :
                      Math.abs(Number(lastClose.difference)) <= 2.5 ? "text-amber-600" : "text-red-600"
                    )}>
                      {Number(lastClose.difference) > 0 ? "+" : ""}{Number(lastClose.difference).toFixed(2)}€
                    </span>
                  </div>
                )}

                {/*<div className="mt-3 flex gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Nuovo fondo"
                        value={newFund}
                        onChange={(e) => setNewFund(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => handleUpdateFund(store.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingStoreId(null); setNewFund(""); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => { setEditingStoreId(store.id); setNewFund(String(store.openingCashFund || "")); }}
                        data-testid={`btn-edit-fund-${store.id}`}
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Modifica Fondo Iniziale
                      </Button>
                      {lastClose && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedClose(lastClose)}
                          data-testid={`btn-view-close-${store.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" /> Dettagli
                        </Button>
                      )}
                    </>
                  )}
                </div>*/}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="min-h-[80vh] max-h-[90vh] flex flex-col pr-2 pb-3">
        <div className="flex gap-[35px]">
          <h3 className="font-bold text-lg mb-4">Storico Chiusure</h3>
          <div className="flex flex-row gap-2 mb-3 max-w-[100px] ">
            {/* Bottone Ordinamento */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="h-8 font-semibold"
              title={sortOrder === 'desc' ? "Dal più recente" : "Dal più vecchio"}
            >
              {sortOrder === 'desc' ? (
                <SortDesc className="w-4 h-4 " />
              ) : (
                <SortAsc className="w-4 h-4 " />
              )}
            </Button>
            {/* Bottone Toggle Filtri */}
            <Button 
              variant={showFilters ? "secondary" : "outline"} 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="h-8"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? "Nascondi" : "Filtra"}
            </Button>
          </div>
        </div>
      
        {/* SEZIONE FILTRI (Condizionale) */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[2fr_2fr_2fr_2fr_1fr] gap-3 mb-5 mr-5 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
            
            {/* Filtro Negozio */}
            <div className="relative" ref={storeRef}>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Negozio</label>
              <div className="relative flex items-center">
                <Input 
                  readOnly
                  placeholder="Tutti i negozi" 
                  className="h-9 bg-white rounded-xl pr-8 cursor-pointer text-sm"
                  value={filters.storeId === "all" ? "Tutti i negozi" : stores?.find(s => s.id === filters.storeId)?.name || ""}
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                />
    
                <div 
                  className="absolute right-3 cursor-pointer text-black transition-transform duration-200"
                  style={{ transform: showStoreDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                >
                  <ChevronUp className="w-4 h-4" />
                </div>
              </div>

              {showStoreDropdown && (
                <div className="absolute z-50 w-5/6 mt-0 ml-5 bg-white border border-black shadow-xl max-h-[30vh] overflow-y-auto">
                  <div 
                    className={cn(
                      "px-3 py-1 text-sm cursor-pointer hover:bg-blue-700 hover:text-white",
                      filters.storeId === "all" && "bg-blue-700 text-white"
                    )}
                    onClick={() => {
                      setFilters({...filters, storeId: "all"});
                      setShowStoreDropdown(false);
                    }}
                  >
                    Tutti i negozi
                  </div>
                  {stores?.map(s => (
                    <div 
                      key={s.id}
                      className={cn(
                        "px-3 py-1 text-sm cursor-pointer border-none whitespace-normal break-words hover:bg-blue-700 hover:text-white",
                        filters.storeId === s.id && "bg-blue-700 text-white"
                      )}
                      onClick={() => {
                        setFilters({...filters, storeId: s.id});
                        setShowStoreDropdown(false);
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filtro Date */}
            <div className="col-span-1 md:col-span-1">
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Periodo (Dal / Al)</label>
              <div className="flex gap-1 items-center">
                <Input 
                  type="date" 
                  className="h-9 text-xs bg-white rounded-xl" 
                  value={filters.dateFrom}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})} 
                />
                <Input 
                  type="date" 
                  className="h-9 text-xs bg-white rounded-xl" 
                  value={filters.dateTo}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})} 
                />
              </div>
            </div>

            {/* Filtro Operatore con Suggerimenti */}
            <div className="relative" ref={operatorRef}>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">Compilatore</label>
              <div className="relative flex items-center">
                <Input 
                  placeholder="Tutti i compilatori" 
                  className="h-9 bg-white rounded-xl pr-8 placeholder:text-black placeholder:text-sm"
                  // Se il valore è "all", mostriamo stringa vuota per far vedere il placeholder
                  value={filters.operator === "all" ? "" : filters.operator}
                  onFocus={() => setShowCompilerSuggestions(true)}
                  onChange={(e) => {
                    setFilters({...filters, operator: e.target.value});
                    setShowCompilerSuggestions(true);
                  }}
                />
          
                <div className="absolute right-3 flex items-center gap-1">
                  {/* Mostra la X solo se l'utente ha scritto qualcosa o ha selezionato un nome specifico */}
                  {filters.operator !== "all" && filters.operator !== "" ? (
                    <X 
                      className="w-4 h-4 text-black-300 hover:text-red-600 cursor-pointer" 
                      onClick={() => {
                        setFilters({...filters, operator: "all"});
                        setShowCompilerSuggestions(true);
                      }} 
                    />
                  ) : (
                    <Search 
                      className="w-4 h-4 text-black-300 hover:text-blue-600 cursor-pointer" 
                      onClick={() => setShowCompilerSuggestions(!showCompilerSuggestions)} 
                    />
                  )}
                </div>
              </div>
      
              {/* Dropdown Opzioni */}
              {showCompilerSuggestions && (
                <div className="absolute z-50 w-5/6 mt-0 ml-5 bg-white border border-black rounded-none shadow-xl max-h-[40vh] overflow-y-auto">
                  <div 
                    className={cn(
                      "px-2 py-1 text-sm cursor-pointer transition-colors",
                      (filters.operator === "" || filters.operator === "all" )? "bg-blue-700 text-white" : "hover:bg-blue-700 hover:text-white"
                    )}
                    onClick={() => {
                      setFilters({...filters, operator: "all"});
                      setShowCompilerSuggestions(false);
                    }}
                  >
                    Tutti i compilatori
                  </div>
            
                  {filteredOptions.map((name, index) => (
                      <div
                        key={index}
                        className={cn(
                          "px-2 py-1 text-sm cursor-pointer border-none transition-colors",
                          "break-words overflow-wrap-anywhere whitespace-normal flex items-center min-h-[28px]",
                          filters.operator === name ? "bg-blue-700 text-white" : "hover:bg-blue-700 hover:text-white"
                        )}
                        onClick={() => {
                          setFilters({...filters, operator: name});
                          setShowCompilerSuggestions(false);
                        }}
                      >
                        {name}
                      </div>
                    ))}
                  {filteredOptions.length === 0 && filters.operator !== 'all' && filters.operator !== "" && (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic border-t">
                      Nessun risultato per "{filters.operator}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filtro Status */}
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Stato</label>
              <div className="flex gap-1">
                {['ok', 'warning', 'ko'].map(s => {
                  const isActive = filters.status.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        const newStatus = isActive
                          ? filters.status.filter(x => x !== s)
                          : [...filters.status, s];
                        setFilters({...filters, status: newStatus});
                      }}
                      className={cn(
                        "h-9 flex-1 rounded-xl border text-[10px] font-bold uppercase transition-all",
                        isActive 
                          ? "bg-primary text-white border-primary shadow-sm" 
                          : "bg-white text-black-200 border-input hover:bg-gray-100"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottone Reset (visibile solo se ci sono filtri attivi) */}
            {(filters.dateFrom || filters.dateTo || filters.storeId !== "all" || (filters.operator !== "" && filters.operator !== "all")) && (
              <div className="flex items-center justify-center">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="py-2 text-sm text-red-500 font-semibold h-8">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
              </div>
            )}
          </div>
        )}
        
        {filteredCloses.length > 0 ? (
          <div className="flex-1 overflow-y-auto px-4 divide-y">
            {filteredCloses.map(close => {
              const store = stores?.find(s => s.id === close.storeId);
                return (
                  <div 
                    key={close.id} 
                    className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded cursor-pointer"
                    onClick={() => setSelectedClose(close)}
                    data-testid={`close-row-${close.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        close.status === 'ok' ? "bg-green-100" :
                        close.status === 'warning' ? "bg-amber-100" : "bg-red-100"
                      )}>
                        {close.status === 'ok' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : close.status === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        ) : (
                          <X className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{store?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(close.date), 'EEEE dd MMMM yyyy', { locale: it })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">€{Number(close.totalSalesAmount).toFixed(2)}</div>
                      <div className={cn(
                        "text-sm font-mono",
                        Number(close.difference) === 0 ? "text-green-600" :
                        Math.abs(Number(close.difference)) <= 2.5 ? "text-amber-600" : "text-red-600"
                      )}>
                        Diff: {Number(close.difference) > 0 ? "+" : ""}{Number(close.difference).toFixed(2)}€
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna chiusura registrata
          </div>
        )}
        <h3 className="text-sm font-semibold text-muted-foreground bg-white px-3 pt-3 rounded-full border-none">
          Mostrando <span className="text-primary font-bold">{filteredCloses?.length || 0}</span> di <span className="font-bold">{closes?.length || 0}</span> chiusure
        </h3>
        {/* Modal Dettagli Chiusura */}
        {selectedClose && (
          <ClosureDetailsModal  
            onClose={() => setSelectedClose(null)} 
            data={selectedClose}
            stores={stores}
          />
        )}
        {(!closes || updateStore.isPending ) && <Spinner/>}
      </Card>
    </>
  );
}

// --- STORES TAB ---
function StoresTab() {
  const { data: stores, isLoading } = useStores();
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: String(formData.get("name")),
      emailDestinations: String(formData.get("emailDestinations")),
      openingCashFund: String(formData.get("openingCashFund")),
      active: true
    };

    try {
      if (editingStore) {
        await updateStore.mutateAsync({ id: editingStore.id, ...data });
      } else {
        await createStore.mutateAsync(data);
      }
      setIsDialogOpen(false);
      setEditingStore(null);
      setIsPending(false);
    } catch (err) {
      setIsPending(false);
      console.error(err);
    } 
  };

  return (
    <>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">Negozi</h3>
          <Button onClick={() => { setEditingStore(null); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Aggiungi Negozio
          </Button>
        </div>

        <div className="grid gap-4">
          {stores?.map(store => (
            <div key={store.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-bold text-lg">{store.name}</div>
                <div className="text-sm text-muted-foreground">{store.emailDestinations || 'Nessuna email configurata'}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setEditingStore(store); setIsDialogOpen(true); }}>
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Basic Modal Implementation - using fixed position for simplicity since I can't generate full shadcn Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
             <h2 className="text-xl font-bold mb-4">{editingStore ? 'Modifica Negozio' : 'Nuovo Negozio'}</h2>
             <form onSubmit={handleSubmit} className="space-y-4">
               <Input name="name" label="Nome Negozio" defaultValue={editingStore?.name} required />
               <Input name="emailDestinations" label="Email per ricevere Notifiche" defaultValue={editingStore?.emailDestinations} />
               <Input name="openingCashFund" label="Fondo Cassa Iniziale" type="number" step="0.01" defaultValue={editingStore?.openingCashFund} />
               
               <div className="flex gap-3 mt-6">
                 <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
                 <Button type="submit" className="flex-1">Salva</Button>
               </div>
             </form>
          </div>
        </div>
      )}
      {(isLoading || isPending) && <Spinner/>}
    </>
  );
}

// --- PAYMENTS TAB ---
function PaymentsTab() {
  const { data: methods = [], isLoading} = usePaymentMethods();
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const [newMethodName, setNewMethodName] = useState("");

  const handleCreate = async () => {
    if (!newMethodName) return;
    await createMethod.mutateAsync({ name: newMethodName, isCash: false, active: true });
    setNewMethodName("");
  };

  const toggleCash = async (id: string, current: boolean) => {
    await updateMethod.mutateAsync({ id, isCash: !current });
  };

  const sortedMethods = useMemo(() => {
    return [...methods].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      // Priority mapping
      const priority: Record<string, number> = { 'contanti': 1, 'pos': 2 };
      const priorityA = priority[nameA] || 3;
      const priorityB = priority[nameB] || 3;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return nameA.localeCompare(nameB);
    });
  }, [methods]);

  return (
    <Card>
      <div className="mb-6 flex gap-4">
        <Input 
          placeholder="Nome Nuovo Metodo di Pagamento" 
          value={newMethodName} 
          onChange={(e) => setNewMethodName(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={!newMethodName}>Aggiungi</Button>
      </div>

      <div className="divide-y">
        {sortedMethods.map(method => (
          <div key={method.id} className="py-4 flex items-center justify-between">
            <span className="font-medium">{method.name}</span>
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => toggleCash(String(method.id), method.isCash)}
                 className={cn(
                   "px-3 py-1 rounded-full text-xs font-bold border transition-colors",
                   method.isCash ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
                 )}
               >
                 {method.isCash ? "CONTANTI" : "NON CONTANTI"}
               </button>
               {/* Could add active toggle here */}
            </div>
          </div>
        ))}
      </div>
      {(isLoading || updateMethod.isPending || createMethod.isPending) && <Spinner/>}
    </Card>
  );
}

// --- SETTINGS TAB ---
function UsersTab() {
  const { user } = useAuth();
  const { data: stores, isLoading:storesLoading } = useStores();
  const { data: users, isLoading } = useUsers(); 
  //const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  type SortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [nameUserBlocked, setNameUserBlocked] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [modalBlockedUser, setModalBlockedUser] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [selectedRole, setSelectedRole] = useState("operatore");
  const [selectedShops, setSelectedShops] = useState<string[]>([]);

  const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const symbols = "!@#$%^&*()_+";
    let password = "";
  
    for (let i = 0; i < 7; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));

    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const openModal = async (user: any = null) => {
    setEditingUser(user);
    setSelectedRole(user?.role || "operatore");

    if (user) {
      const { data } = await supabase
      .from('profile_stores')
      .select('store_id')
      .eq('profile_id', user.id);
    
      setSelectedShops(data?.map(item => item.store_id) || []);
    } else {
      setSelectedShops([]);
      setGeneratedPassword(generateSecurePassword());
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  setIsPending(true);
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const username = String(formData.get("username"));
  const email = String(formData.get("email"));
  const role = selectedRole as "operatore" | "admin" | 'superAdmin';

  try {
    let targetUserId: string;

    if (editingUser) {
      targetUserId = editingUser.id;
      await updateUser.mutateAsync({ id: targetUserId, username, email, role, allowed_stores: role === 'operatore' ? selectedShops : [] });
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: generatedPassword,
        options: { data: { username, role, temp_password: generatedPassword, allowed_stores: role === 'operatore' ? selectedShops : []}}
      });
      if (authError) throw authError;
      targetUserId = authData.user!.id;
    }

    // Tabella di giunzione
    /*if (role === 'operatore') {
      const { error: deleteError } = await supabase
        .from('profile_stores')
        .delete()
        .eq('profile_id', targetUserId);
      
      if (deleteError) throw deleteError;
      //Inseriamo le nuove associazioni
      if (selectedShops.length > 0) {
        const inserts = selectedShops.map(storeId => ({
          profile_id: targetUserId,
          store_id: storeId
        }));

        const { error: insertError } = await supabase
          .from('profile_stores')
          .insert(inserts);

        if (insertError) throw insertError;
      }
    } else {
      await supabase.from('profile_stores').delete().eq('profile_id', targetUserId);
    }*/

    setIsPending(false);
    setIsDialogOpen(false);
  } catch (err: any) {
    setIsPending(false);
    alert(err.message || "Errore");
  }
};

const handleResendInvite = async (email: string) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });
    if (error) throw error;
    alert("Email di attivazione reinviata con successo!");
  } catch (err: any) {
    alert("Errore nel reinvio: " + err.message);
  }
};

  const sortedUsers = useMemo(() => {
    if (!users) return [];

    return [...users].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.username.localeCompare(b.username);
        case 'name-desc':
          return b.username.localeCompare(a.username);
        case 'date-newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });
  }, [users, sortBy]);

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-row items-center gap-2 w-full md:w-auto">
          <h3 className="font-bold text-lg">Gestione Utenti</h3>
          <div className="ml-7 relative">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                className={isSortMenuOpen ? "bg-gray-100" : ""}
              >
                <ListFilter className="w-4 h-4 mr-2" />
                Ordina
              </Button>

              {/* Menu a comparsa (Dropdown) */}
              {isSortMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsSortMenuOpen(false)} 
                  />
          
                  <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                    {[
                      { id: 'name-asc', label: 'Nome (A-Z)', icon: <ArrowDownAz className="w-4 h-4" /> },
                      { id: 'name-desc', label: 'Nome (Z-A)', icon: <ArrowUpAZ className="w-4 h-4" /> },
                      { id: 'date-newest', label: 'Più recenti', icon: <Clock className="w-4 h-4" /> },
                      { id: 'date-oldest', label: 'Meno recenti', icon: <History className="w-4 h-4" /> },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSortBy(option.id as SortOption);
                          setIsSortMenuOpen(false);
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
                          sortBy === option.id ? "text-blue-600 font-medium bg-blue-50" : "text-gray-700"
                        }`}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4 mr-2" /> Nuovo Utente
        </Button>
      </div>

      <div className="grid gap-4">
        {sortedUsers?.map(u => (
          <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <div className="font-bold">{u.username}</div>
              <div className="text-sm text-muted-foreground capitalize">Ruolo: {u.role}</div>
            </div>
            <div className="flex gap-2">
              <div>
                {!u.email_confirmed_at && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase font-bold">
                    In attesa
                  </span>
                )}
              </div>

              <div className="flex gap-2 mr-8">
                {/* TASTO REINVIO MAIL (Solo se non confermato) */}
                {!u.email_confirmed_at && (() => {
                  const createdDate = new Date(u.created_at);
                  const now = new Date();
                  const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
                  const isExpired = hoursDiff >= 24;
            
                  return (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!isExpired}
                      onClick={() => handleResendInvite(String(u.email))}
                      title={isExpired 
                        ? "Il link è scaduto (24h passate). Clicca per reinviare." 
                        : `Potrai reinviare il link tra ${Math.ceil(24 - hoursDiff)} ore.`
                      }
                      className={isExpired ? "border-orange-500 text-orange-600 hover:bg-orange-50" : "opacity-50 text-gray-600"}
                    >
                      <MailCheck className="w-4 h-4 mr-1" />
                      {isExpired ? "Reinvia Link" : "Link Valido"}
                    </Button>
                  );
                })()}
              </div>
              <Button variant="ghost" size="sm" onClick={() => openModal(u)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={u.id === user?.id}
                className={`${u.blocked? "text-red-500" : "text-green-500"}${u.id === user?.id ? "opacity-30 cursor-not-allowed" : ""}`} 
                onClick={() => {
                  setSelectedUserId(u.id);
                  setEditingUser(u);
                  setNameUserBlocked(u.username); 
                  setModalBlockedUser(true); 
                  setIsBlocked(u.blocked as boolean);
                  }}
                title={u.id === user?.id ? "Non puoi bloccare il tuo account" : u.blocked? "Utente Bloccato" : "Utente Attivo"}
                >
                  {u.blocked? <Lock  className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {modalBlockedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            {(() => {
              const actionText = isBlocked ? "sbloccare" : "bloccare";
              const actionConfirmation = isBlocked ? "potrà" : "non potrà";
              const oppositeAction = isBlocked ? "bloccare" : "sbloccare";

              return (
                <div>
                  <h2 className="text-xl font-bold mb-4">Stai per {actionText} <span className="text-red-500 capitalize">{nameUserBlocked}</span></h2>
                  <p className="ml-2 mb-1">
                    Sei sicuro di voler {actionText} questo account?<br/>
                    <span className="text-red-500 capitalize">{nameUserBlocked}</span> {actionConfirmation} accedere alla piattaforma!
                  </p>
                  <p className="text-sm ml-2 mb-10">Puoi {oppositeAction} l'utente in qualsiasi momento.</p>
      
                  <div className="flex justify-end">
                    <Button 
                      variant="secondary" 
                      className="mr-3" 
                      onClick={() => setModalBlockedUser(false)}
                    >
                      Annulla
                    </Button>
                    <Button 
                      variant="primary" 
                      className="capitalize" 
                      onClick={async () => {
                        if (selectedUserId) {
                          try {
                            const { blocked: _, ...rest } = editingUser;
                            const newBlockedStatus = !editingUser.blocked;
                            await updateUser.mutateAsync({ 
                              id: selectedUserId as string, 
                              ...rest,
                              blocked: newBlockedStatus
                            });
                            setModalBlockedUser(false);
                          } catch (err) {
                            alert(`Errore durante il blocco/sblocco:${err}`);
                          }
                        }
                      }}
                    >
                      {actionText}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{editingUser ? 'Modifica Utente' : 'Nuovo Utente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input name="username" label="Nome Utente" defaultValue={editingUser?.username} required />
              <Input name="email" label="Email" defaultValue={editingUser?.email} required />
              <div className="space-y-1">
                <label className="text-sm font-medium">Ruolo</label>
                <div className="w-full border rounded-md p-2 flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <select 
                    name="role" 
                    value={selectedRole} 
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full rounded-md bg-background p-0 focus:outline-none"
                  >
                    <option value="operatore">Operatore</option>
                    <option value="admin">Proprietario (Admin)</option>
                  </select>
                </div>
                {selectedRole === "operatore" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium ">
                      L'utente può inserire chiusure di cassa per i seguenti negozi:
                    </label>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 gap-2">
                      {stores?.map((shop) => (
                        <label key={shop.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded-md transition-colors">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedShops.includes(shop.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedShops([...selectedShops, shop.id]);
                              } else {
                                setSelectedShops(selectedShops.filter(id => id !== shop.id));
                              }
                            }}
                          />
                          <span className="text-sm">{shop.name}</span>
                        </label>
                      ))}
                    </div>
                    {selectedShops.length === 0 && (
                      <p className="text-[10px] text-amber-600 mt-2 font-medium">
                        * Seleziona almeno un negozio per l'operatore
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!editingUser && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <label className="text-xs font-bold text-blue-600 uppercase">Password Generata</label>
                  <div className="flex gap-2 mt-1">
                    <Input 
                      value={generatedPassword} 
                      onChange={(e) => setGeneratedPassword(e.target.value)}
                      className="bg-white"
                    />
                    <Button type="button" variant="outline" onClick={() => setGeneratedPassword(generateSecurePassword())}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[12px] text-blue-500 mt-2 italic">
                    <span className="font-bold text-[14px]">*</span> La password verrà inviata al nuovo utente tramite email.<br/><span className="ml-2">Avvisa l'utente di controllare anche nella <span className="font-bold"> cartella SPAM.</span></span>
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
                <Button type="submit" className="flex-1">Salva</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {(isLoading || storesLoading || isPending) && <Spinner />}
    </Card>
  );
}

// --- SETTINGS TAB ---
function SettingsTab() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [lastCompanyN, setLastCompanyN] =useState('');
  const [lastLogoUrl, setLastLogoUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isNewLogo = !(lastLogoUrl === logoUrl);
  const isNewName = !(lastCompanyN === companyName);

  // Sync state when settings load
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "");
      setLogoUrl(settings.logoUrl || "");
      setLastCompanyN(settings.companyName || "");
      setLastLogoUrl(settings.logoUrl || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({ companyName, logoUrl });
      setIsEditing(false);
      setIsSaving(false);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card>
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5" /> Impostazioni Azienda
      </h3>

      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">Logo Azienda</label>
          <div className="flex items-center gap-4">
            <div 
              className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoUrl || settings?.logoUrl ? (
                <img 
                  src={logoUrl || settings?.logoUrl || ""} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <Upload className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-testid="btn-upload-logo"
              >
                <Upload className="w-4 h-4 mr-2" /> Carica Logo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG fino a 2MB</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Nome Azienda</label>
          <Input
            placeholder="Inserisci il nome della tua azienda"
            value={companyName || settings?.companyName || ""}
            onChange={(e) => { setCompanyName(e.target.value); setIsEditing(true); }}
            data-testid="input-company-name"
          />
        </div>

        {(isEditing || logoUrl) && (
          <div className="flex gap-3">
            <Button 
              onClick={handleSave} 
              disabled={isNewLogo || isNewName || updateSettings.isPending} 
              className={isNewLogo || isNewName || updateSettings.isPending ? 'bg-gray-300' : ''} 
              data-testid="btn-save-settings">
              {companyName || logoUrl? "Modifica" : updateSettings.isPending ? "Salvataggio..." : "Salva Impostazioni"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                setLogoUrl("");
                setCompanyName(settings?.companyName || "");
              }}
            >
              Annulla
            </Button>
          </div>
        )}
      </div>
      {isSaving || isLoading && <Spinner/>}
    </Card>
  );
}

/*interface CashCloseRecord {
  store_id: string;
  date: string;
  compiler_name: string;
  notes: string;
  total_sales_amount: number;
  bank_withdrawal_amount: number;
  opening_cash_fund: number;
  theoretical_cash_fund: number;
  actual_cash_fund: number;
  difference: number;
  status: string;
}

function BulkImportCloses() {
  const [data, setData] = useState<Partial<CashCloseRecord>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const COLUMNS = [
    { key: 'store_id', label: 'Store UUID', type: 'text' },
    { key: 'date', label: 'Data', type: 'date' },
    { key: 'compiler_name', label: 'Compilatore', type: 'text' },
    { key: 'total_sales_amount', label: 'Tot. Vendite', type: 'number' },
    { key: 'bank_withdrawal_amount', label: 'Prelievo banca', type: 'number' },
    { key: 'difference', label: 'Differenza', type: 'number' },
    { key: 'status', label: 'Stato', type: 'text' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      // Trasformiamo in JSON e puliamo i dati minimamente
      const importedData = XLSX.utils.sheet_to_json(ws).map((row: any) => ({
        ...row,
        // Assicuriamoci che i numeri siano tali
        total_sales_amount: parseFloat(row.total_sales_amount) || 0,
        bank_withdrawal_amount: parseFloat(row.bank_withdrawal_amount) || 0,
        difference: parseFloat(row.difference) || 0,
        date: row.date || new Date().toISOString().split('T')[0]
      }));
      
      setData(importedData);
    };
    reader.readAsBinaryString(file);
  };

  const updateCell = (index: number, field: keyof CashCloseRecord, value: any) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    setData(updated);
  };

  const removeRow = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
  };

  const submitBulk = async () => {
    if (data.length === 0) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/closes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        alert("Importazione completata con successo!");
        setData([]); // Reset dopo successo
      } else {
        const err = await response.json();
        throw new Error(err.message || "Errore lato server");
      }
    } catch (error: any) {
      alert("Errore: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Area di Caricamento *}
      <Card 
        className="p-10 border-dashed border-2 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload} 
        />
        <h3 className="text-lg font-medium">Trascina o seleziona un file</h3>
        <p className="text-sm text-gray-500 mt-1">Excel o CSV (store_id, date, compiler_name, ecc.)</p>
      </Card>

      {/* Anteprima Tabella *}
      {data.length > 0 && (
        <div className="rounded-md border">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
                <TableRow>
                  {COLUMNS.map(col => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, idx) => (
                  <TableRow key={idx}>
                    {COLUMNS.map(col => (
                      <TableCell key={col.key} className="p-2">
                        <Input
                          type={col.type}
                          value={(row as any)[col.key] || ''}
                          className="h-8 text-sm"
                          onChange={(e) => updateCell(idx, col.key as keyof CashCloseRecord, e.target.value)}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button size="md" variant="ghost" onClick={() => removeRow(idx)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Verifica che i dati siano corretti prima di salvare.
            </div>
            <Button 
              size="lg"
              onClick={submitBulk} 
              disabled={isProcessing}
              className="px-8"
            >
              {isProcessing ? "Salvataggio..." : `Salva ${data.length} Record`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}*/
