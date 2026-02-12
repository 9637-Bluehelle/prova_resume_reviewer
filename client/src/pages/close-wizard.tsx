import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { ChangeEvent } from 'react';
import { Layout } from "@/components/layout";
import { Button, Input, Card, cn } from "@/components/ui-kit";
//import { useStores } from "@/hooks/use-stores";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useCreateClose, usePreviousClose } from "@/hooks/use-closes";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/modals";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, ArrowLeft, Save, Trash2, Plus, Calculator, Wallet, Receipt, Banknote, Check, AlertTriangle, Camera } from "lucide-react";
import { useFilteredStores } from "@/App";
import { useSendInvite } from "@/components/templateEmailJS";
import { useStores } from "@/hooks/use-stores";

// --- STEPS DEFINITION ---
const steps = [
  { id: 'setup', title: 'Configurazione', icon: Calculator },
  { id: 'sales', title: 'Vendite', icon: Receipt },
  { id: 'payments', title: 'Pagamenti', icon: Wallet },
  { id: 'expenses', title: 'Spese', icon: Banknote },
  { id: 'withdrawal', title: 'Banca', icon: ArrowRight },
  { id: 'count', title: 'Conteggio', icon: Check },
  { id: 'review', title: 'Riepilogo', icon: Save },
];

export default function CloseWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { data:stores } = useStores();
  const { toast } = useToast();
  const {sendMail, sent} = useSendInvite();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  //const { data: stores } = useStores();
  const { data: paymentMethods } = usePaymentMethods();
  const createClose = useCreateClose();
  const { availableStores, selectedStore } = useFilteredStores();
  //const selectedStore = stores?.find(s => s.id === user?.default_store_id);

  // Parse query params for default date
  const queryParams = new URLSearchParams(window.location.search);
  const defaultDate = queryParams.get("date") || new Date().toISOString().split('T')[0];

  // Form Setup
  // We'll treat all numeric inputs as strings initially for better UX, then coerce
  const form = useForm({
    defaultValues: {
      storeId: "",
      date: defaultDate,
      compilerName: "",
      notes: "",
      totalSalesAmount: "",
      bankWithdrawalAmount: "",
      openingCashFund: 0,
      actualCashFund: "",
      receipt_image_url: "",
      payments: [] as { paymentMethodId: string; amount: string }[],
      expenses: [] as { description: string; amount: string }[],
    }
  });

  const { watch, setValue, register, control, handleSubmit, formState: { errors } } = form;

  useEffect(() => {
    const urlStoreId = queryParams.get("storeId");
    if (user) {
      if (user.default_store_id) {
        setValue("storeId", String(user.default_store_id || urlStoreId));
      }
      if (user.username && user.username.trim() !== "") {
        setValue("compilerName", user.username);
      }
    }
    if(selectedStore){
      setValue("openingCashFund", Number(selectedStore.openingCashFund) )
    }
  }, [user, selectedStore, setValue]);
  
  // Watch values for calculations
  const values = watch();
  
  // Fetch opening fund when store/date changes
  const { data: prevClose } = usePreviousClose(
    values.storeId, 
    values.date
  );

  useEffect(() => {
    if (prevClose) {
      setValue("openingCashFund", Number(prevClose.actualCashFund));
    } /*else {
    }*/
  }, [prevClose, setValue]);

  const sortMethods = (methods:any[]) => {
    return [...methods].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      //Contanti in cima
      if (nameA === 'contanti') return -1;
      if (nameB === 'contanti') return 1;

      //POS 
      if (nameA === 'pos') return -1;
      if (nameB === 'pos') return 1;

      //Tutto il resto in ordine alfabetico
      return nameA.localeCompare(nameB);
    });
  };

  // Initializing payments array based on available methods
  useEffect(() => {
    if (paymentMethods && values.payments.length === 0) {
      const sortedMethods = sortMethods(paymentMethods);

      const initPayments = sortedMethods.map(pm => ({
        paymentMethodId: pm.id,
        amount: ""
      }));
      setValue("payments", initPayments);
    }
  }, [paymentMethods, setValue, values.payments.length]);

  // Calculations
  const totalPayments = values.payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalExpenses = values.expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const sales = Number(values.totalSalesAmount || 0);
  const opening = Number(values.openingCashFund || 0);
  const withdrawal = Number(values.bankWithdrawalAmount || 0);
  const actual = Number(values.actualCashFund || 0);
  
  const cashPaymentsMethods = paymentMethods?.filter(pm => pm.isCash).map(pm => pm.id) || [];
  
  // Calcola totale pagamenti non contanti (POS, Satispay, ecc.)
  const nonCashPaymentsDetails = values.payments
    .filter(p => !cashPaymentsMethods.includes(p.paymentMethodId))
    .map(p => {
      const method = paymentMethods?.find(pm => pm.id === p.paymentMethodId);
      return {
        name: method?.name || 'Altro',
        amount: Number(p.amount || 0)
      };
    })
    .filter(p => p.amount > 0);
  
  const nonCashPaymentsTotal = nonCashPaymentsDetails.reduce((acc, p) => acc + p.amount, 0);

  // Risultato Parziale = Fondo Apertura + Incasso del Giorno
  const partialResult = opening + sales;
  
  // Fondo Cassa Teorico = Risultato Parziale - Prelevato - Tutti i pagamenti non contanti - Spese
  const theoretical = partialResult - withdrawal - nonCashPaymentsTotal - totalExpenses;
  const difference = actual - theoretical;
  
  const status = Math.abs(difference) === 0 ? 'ok' : Math.abs(difference) <= 2.5 ? 'warning' : 'ko';

  const onSubmit = async (formData: any) => {
  try {
    setIsUploading(true);
    let finalImageUrl = "";

    if (selectedFile) {
      const cleanFileName = selectedFile.name.replace(/\s+/g, '_').toLowerCase();
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `sales-receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipt-bucket')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;
      finalImageUrl = filePath;
    }

    const payload = {
      // Dati base
      storeId: String(formData.storeId),
      date: formData.date,
      compilerName: formData.compilerName,
      notes: formData.notes || "",
      
      // Valori numerici (fondamentale: devono essere Number, non stringhe vuote)
      totalSalesAmount: Number(formData.totalSalesAmount || 0),
      bankWithdrawalAmount: Number(formData.bankWithdrawalAmount || 0),
      openingCashFund: Number(formData.openingCashFund || 0),
      actualCashFund: Number(formData.actualCashFund || 0),
      
      // Valori calcolati (devono essere inclusi qui per essere passati a closeData)
      theoreticalCashFund: Number(theoretical), 
      difference: Number(difference),
      status: status as "ok" | "warning" | "ko",
      receipt_image_url: finalImageUrl,

      // Array pagamenti mappati correttamente
      payments: formData.payments
        .filter((p: any) => p.amount !== "" && p.amount !== null)
        .map((p: any) => ({
          paymentMethodId: String(p.paymentMethodId),
          amount: Number(p.amount)
        })),

      // Array spese mappati correttamente
      expenses: formData.expenses
        .filter((e: any) => e.amount !== "" && e.amount !== null)
        .map((e: any) => ({
          description: e.description,
          amount: Number(e.amount)
        }))
    };
    
    //Chiamiamo la mutation
    await createClose.mutateAsync(payload);

    if(import.meta.env.VITE_EMAILJS_SERVICE || import.meta.env.VITE_EMAILJS_TEMPLATE || import.meta.env.VITE_EMAILJS_PUBLIC_KEY){
      const store = stores?.find(s => s.id === String(formData.storeId));
      await sendMail(String(store?.emailDestinations) , String(store?.name), formData, Number(theoretical), status);
    }
    
    setLocation("/dashboard");
  } catch (err) {
    console.error("Errore finale invio:", err);
    toast({ title: "Errore", description: `Impossibile salvare i dati o l'immagine: ${err}`, variant: "destructive"});
  } finally {
    setIsUploading(false);
  }
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      toast({ title: "Formato non valido", description: "Carica solo immagini.", variant: "destructive" });
    }
  }
};


  const nextStep = () => {
    // Basic validation per step could go here
    if (currentStep < steps.length - 1) setCurrentStep(c => c + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
  };

  const currentCompiler = watch("compilerName");

  // --- RENDER HELPERS ---
  const renderStepContent = () => {
    switch(currentStep) {
      case 0: // Setup
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Negozio</label>
                <div className={"w-full pr-3 py-0 bg-background border border-input rounded-xl focus-within:outline-none focus-within:ring-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-shadow"}>
                <select 
                  {...register("storeId", { required: true })}
                  className="w-full h-12 rounded-xl bg-background px-3 focus:outline-none"
                >
                  <option value="">Seleziona un negozio...</option>
                  {availableStores?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                </div>
              </div>
              <Input label="Data" style={{ WebkitAppearance: 'none'}} className="md:[&::-webkit-calendar-picker-indicator]:block [&::-webkit-calendar-picker-indicator]:hidden" type="date" onClick={(e) => (e.target as HTMLInputElement).showPicker()} {...register("date", { required: true })} />
              <Input 
                readOnly={!!currentCompiler} 
                className={cn(currentCompiler ? "text-gray-400 cursor-default bg-gray-50" : "")} 
                label="Compilatore" 
                onClick={() => {
                  if (currentCompiler) {
                    toast({ 
                      title: "Campo non modificabile", 
                      description: "Il nome del compilatore è impostato automaticamente dal tuo profilo.", 
                      variant: "destructive"
                    });
                  }
                }} 
                {...register("compilerName", { required: true })} 
              />
             
             
              {prevClose && (
                <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm">
                  Fondo cassa: <strong>€{Number(values.openingCashFund).toFixed(2)}</strong>
                </div>
              )}
          </div>
        );
      case 1: // Sales
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center py-8">
              <h3 className="text-2xl font-bold mb-2">Vendite Giornaliere Totali</h3>
              <p className="text-muted-foreground mb-8">Inserisci il totale in euro</p>
              
              <div className="relative max-w-xs mx-auto">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">€</span>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  {...register("totalSalesAmount", { required: true })}
                  className="w-full h-20 pl-10 text-4xl font-bold text-center rounded-2xl border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="max-w-xs mx-auto mt-10">
          <label className="text-muted-foreground mb-8">Inserisci una foto in cui siano<br/> visibili tutti gli scontrini</label>
          <div className="relative border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary transition-all mt-5">
            {previewUrl ? (
              <div className="relative w-full p-2">
                <img 
                  src={previewUrl} 
                  alt="Anteprima scontrino" 
                  className="w-full h-48 object-contain rounded-2xl shadow-sm" 
                />
                <button 
                  type="button"
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                  className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform active:scale-90"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
          ) : (
            <>
              {/* VERSIONE MOBILE (Due tasti grandi) */}
              <div className="grid grid-cols-2 gap-4 md:hidden">
                <label className="flex flex-col items-center justify-center aspect-square rounded-3xl bg-primary/5 active:scale-95 transition-transform shadow-sm">
                  <Camera className="w-10 h-10 text-primary mb-2" />
                  <span className="text-sm font-bold text-primary">Scatta</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageSelection} className="hidden" />
                </label>
                
                <label className="flex flex-col items-center justify-center aspect-square rounded-3xl bg-gray-50 active:scale-95 transition-transform shadow-sm">
                  <Receipt className="w-10 h-10 text-gray-400 mb-2" />
                  <span className="text-sm font-bold text-gray-500">Galleria</span>
                  <input type="file" accept="image/*" onChange={handleImageSelection} className="hidden" />
                </label>
              </div>

              {/* VERSIONE DESKTOP (Drag & Drop area) */}
              <div className="hidden md:block">
  <label 
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
    className={cn(
      "flex flex-col items-center justify-center w-full h-48 rounded-3xl transition-all cursor-pointer group",
      isDragging 
        ? "border-primary bg-primary/10 scale-[1.02] shadow-lg" 
        : "border-gray-300 bg-gray-50 hover:bg-white hover:border-primary"
    )}
  >
    <div className={cn(
      "p-4 rounded-full shadow-sm mb-3 transition-transform group-hover:scale-110",
      isDragging ? "bg-primary text-white scale-110" : "bg-white text-primary"
    )}>
      {isDragging ? <Save className="w-8 h-8" /> : <Receipt className="w-8 h-8" />}
    </div>
    
    <p className="font-semibold text-gray-700">
      {isDragging ? "Rilascia la foto" : "Clicca o trascina la foto"}
    </p>
    <p className="text-xs text-gray-400 mt-1">JPG, PNG o WEBP</p>
    
    <input type="file" accept="image/*" onChange={handleImageSelection} className="hidden" />
  </label>
</div>
            </>
          )}
          </div>
        </div>
      </div> 
      <p className="w-full flex justify-center text-[12px]">Tutti i campi sono obligatori per continuare.*</p>
    </div>
  );
      case 2: // Payments
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-bold text-lg mb-4">Dettaglio Pagamenti</h3>
            {values.payments.map((p, index) => {
              const methodInfo = paymentMethods?.find(m => m.id === p.paymentMethodId);
        
              return (
                <div key={p.paymentMethodId} className="flex items-center gap-4">
                  <div className="w-1/3 text-sm font-medium">{methodInfo?.name}</div>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register(`payments.${index}.amount` as const)}
                    className="text-right font-mono"
                  />
                  {/* Hidden field for ID */}
                  <input type="hidden" {...register(`payments.${index}.paymentMethodId` as const)} value={p.paymentMethodId} />
                </div>
              );
            })}
            <div className="pt-4 border-t flex justify-between font-bold">
              <span>Totale Pagamenti Inseriti</span>
              <span>€{totalPayments.toFixed(2)}</span>
            </div>
            {Math.abs(sales - totalPayments) > 0.01 && (
              <div className="flex flex-col gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>
                    Il totale pagamenti (€{totalPayments.toFixed(2)}) non corrisponde alle vendite (€{sales.toFixed(2)})
                  </p>
                </div>
                <div className="w-full">
                  <Input 
                    label="Note (Facoltativo)" 
                    className="bg-white"
                    {...register("notes")} 
                  />
                </div>
              </div>
            )}
          </div>
        );
      case 3: // Expenses
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg">Spese in Contanti</h3>
               <Button 
                 type="button" 
                 size="sm" 
                 variant="outline"
                 onClick={() => {
                   const currentExpenses = form.getValues("expenses");
                   setValue("expenses", [...currentExpenses, { description: "", amount: "" }]);
                 }}
               >
                 <Plus className="w-4 h-4 mr-2" /> Aggiungi
               </Button>
            </div>
            
            {values.expenses.map((_, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Input 
                  placeholder="Descrizione (es. Latte)" 
                  {...register(`expenses.${index}.description` as const)} 
                  className="flex-1"
                />
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00" 
                  {...register(`expenses.${index}.amount` as const)} 
                  className="w-28 text-right font-mono"
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="h-12 w-12 text-destructive"
                  onClick={() => {
                    const newExpenses = [...values.expenses];
                    newExpenses.splice(index, 1);
                    setValue("expenses", newExpenses);
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            ))}
            {values.expenses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                Nessuna spesa registrata
              </div>
            )}
             <div className="pt-4 text-right font-bold">
              Totale Spese: €{totalExpenses.toFixed(2)}
            </div>
          </div>
        );
      case 4: // Bank Withdrawal
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             <div className="text-center py-8">
              <h3 className="text-2xl font-bold mb-2">Versamento in Banca</h3>
              <p className="text-muted-foreground mb-8">Contanti prelevati dalla cassa e messi in busta per il deposito</p>
              
              <div className="relative max-w-xs mx-auto">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">€</span>
                <input 
                  key="input-withdrawal"
                  type="number" 
                  //step="0.01"
                  placeholder="0.00"
                  {...register("bankWithdrawalAmount")}
                  className="w-full h-20 pl-10 text-4xl font-bold text-center rounded-2xl border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        );
      case 5: // Count
        return (
           <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             <div className="text-center py-8">
              <h3 className="text-2xl font-bold mb-2">Conteggio Cassa Effettivo</h3>
              <p className="text-muted-foreground mb-8">Quanto contante c'è fisicamente nel cassetto?</p>
              
              <div className="relative max-w-xs mx-auto">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">€</span>
                <input 
                  key="input-actual"
                  type="number"
                  //step="0.01"
                  placeholder="0.00"
                  {...register("actualCashFund", { required: true })}
                  className="w-full h-20 pl-10 text-4xl font-bold text-center rounded-2xl border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        );
      case 6: // Review
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-2xl font-bold text-center mb-6">Riepilogo</h3>
            
            <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Fondo Cassa Apertura</span>
                 <span className="font-mono">€{opening.toFixed(2)}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">+ Incasso del Giorno</span>
                 <span className="font-mono text-green-600">+ €{sales.toFixed(2)}</span>
               </div>
               <div className="border-t pt-2 flex justify-between font-bold">
                 <span>= Risultato Parziale</span>
                 <span className="font-mono">€{partialResult.toFixed(2)}</span>
               </div>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">- Versato (Banca)</span>
                 <span className="font-mono text-red-600">- €{withdrawal.toFixed(2)}</span>
               </div>
               {nonCashPaymentsDetails.map((payment, idx) => (
                 <div key={idx} className="flex justify-between">
                   <span className="text-muted-foreground">- {payment.name}</span>
                   <span className="font-mono text-red-600">- €{payment.amount.toFixed(2)}</span>
                 </div>
               ))}
               {totalExpenses > 0 && (
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">- Spese</span>
                   <span className="font-mono text-red-600">- €{totalExpenses.toFixed(2)}</span>
                 </div>
               )}
               <div className="border-t pt-2 flex justify-between font-bold text-lg">
                 <span>= Fondo Cassa Teorico</span>
                 <span>€{theoretical.toFixed(2)}</span>
               </div>
               <div className="text-xs text-muted-foreground text-center">
                 (Questo sarà il fondo cassa per il giorno successivo)
               </div>
            </div>

            <div className="bg-white rounded-xl border p-4 shadow-sm text-center">
              <span className="text-muted-foreground text-sm uppercase tracking-wide">Conteggio Effettivo</span>
              <div className="text-3xl font-bold my-1">€{actual.toFixed(2)}</div>
            </div>

            <div className={cn(
              "rounded-xl p-6 text-center text-white shadow-lg transition-all",
              status === 'ok' ? 'bg-green-600' : status === 'warning' ? 'bg-amber-500' : 'bg-red-600'
            )}>
               <div className="text-sm uppercase font-bold opacity-80 mb-1">Differenza</div>
               <div className="text-4xl font-bold mb-2">
                 {difference > 0 ? "+" : ""}{difference.toFixed(2)} €
               </div>
               <div className="text-sm font-medium bg-white/20 inline-block px-3 py-1 rounded-full">
                 STATO: {status === 'ok' ? 'OK' : status === 'warning' ? 'ATTENZIONE' : 'ERRORE'}
               </div>
            </div>
            
            {previewUrl && (
              <div className="relative w-full p-2">
                <img 
                  src={previewUrl} 
                  alt="Anteprima scontrino" 
                  className="w-full h-48 object-contain rounded-2xl shadow-sm" 
                />
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Annulla
          </Button>
          <div className="text-sm font-medium text-muted-foreground">
            Passo {currentStep + 1} di {steps.length}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-100 rounded-full mb-8 overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step Title */}
        <div className="flex items-center gap-3 mb-6">
           {(() => {
             const Icon = steps[currentStep].icon;
             return (
               <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                 <Icon className="w-5 h-5" />
               </div>
             );
           })()}
           <h2 className="text-2xl font-bold font-display">{steps[currentStep].title}</h2>
        </div>

        {/* Content */}
        <Card className="mb-8 min-h-[400px] flex flex-col">
          <form id="wizard-form" className="flex-1" onSubmit={handleSubmit(onSubmit)}>
            {renderStepContent()}
          </form>
        </Card>

        {/* Footer Actions */}
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Indietro
          </Button>
          
          {currentStep === steps.length - 1 ? (
             <Button 
               className="flex-1" 
               size="lg" 
               onClick={handleSubmit(onSubmit)}
               isLoading={createClose.isPending}
             >
               Invia Chiusura
             </Button>
          ) : (
             <Button 
               className="flex-1" 
               size="lg" 
               onClick={nextStep}
               disabled={
                (currentStep === 0 && (!values.storeId || !values.date || !values.compilerName)) ||
                (currentStep === 1 && (!selectedFile || !values.totalSalesAmount))
               }
             >
               Avanti <ArrowRight className="w-4 h-4 ml-2" />
             </Button>
          )}
        </div>
      </div>
      {isUploading && <Spinner/> }
    </Layout>
  );
}