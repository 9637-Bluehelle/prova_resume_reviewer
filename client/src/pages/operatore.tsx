import { Layout } from "@/components/layout";
import { PageHeader, Card, Button, cn } from "@/components/ui-kit";
//import { useStores } from "@/hooks/use-stores";
import { useAuth , useUpdateDefaultStore} from "@/hooks/use-auth";
import { Plus, CheckCircle } from "lucide-react";
import { Link, /*useLocation*/ } from "wouter";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { navigate } from "wouter/use-browser-location";
import { useState, useEffect } from "react";
import { Spinner } from "@/components/modals";
import { useToast } from "@/hooks/use-toast";
import { useFilteredStores } from "@/App";

export default function OperatoreDashboard() {
  const { user } = useAuth();
  //const { data: stores } = useStores();
  const { toast } = useToast();
  const defaultStore = useUpdateDefaultStore();
  const [isPending, setIsPending] = useState(false);

  const today = format(new Date(), 'EEEE dd MMMM yyyy', { locale: it });

  // negozi disponibili e negozio selezionato
  const { availableStores, selectedStore } = useFilteredStores();

  // Se l'utente non ha un default impostato o è diverso dall'unico disponibile
  useEffect(() => {
    const autoSelectStore = async () => {
      if (availableStores.length === 1) {
        const singleStoreId = availableStores[0].id;
        
        if (user && user.default_store_id !== singleStoreId) {
          try {
            await defaultStore.mutateAsync({ default_store_id: singleStoreId });
          } catch (err) {
            toast({title:'Errore', description:`"Errore nell'impostazione automatica del negozio: ${err}`, variant:'destructive'});
          }
        }
      }
    };

    autoSelectStore();
  }, [availableStores, user?.default_store_id]);

  const handleStoreSelection = async (storeId: string) => {
    // Se l'utente clicca un negozio diverso da quello attuale, aggiorniamo il DB
    if (user && user.default_store_id !== storeId) {
      try {
        await defaultStore.mutateAsync({ default_store_id: storeId });
      } catch (err) {
        console.error("Errore nel salvataggio della preferenza:", err);
      }
    }
  };

  const handleClick = async (e:React.MouseEvent, id:string) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await defaultStore.mutateAsync({ default_store_id: id });
      navigate(`/close/new?storeId=${id}`);
    } catch (err) {
      toast({ title: "Errore", description: "Impossibile cambiare negozio", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

 return (
    <Layout>
      <PageHeader 
        title={`Ciao, ${user?.username || 'Operatore'}`}
        description={today}
        storeName={selectedStore? selectedStore.name : ''}
      />
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Sezione Azione Rapida */}
        {selectedStore && (
          <Card className="text-center py-8 border-2 border-transparent">
            <div className="mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Nuova Chiusura Cassa</h2>
              <p className="text-muted-foreground">
                {selectedStore 
                  ? `Inserisci i dati della chiusura giornaliera di ${selectedStore.name}` 
                  : "Inserisci i dati della chiusura giornaliera"}
              </p>
            </div>

            <Link href={selectedStore ? `/close/new?storeId=${selectedStore.id}` : "#"}>
              <Button 
                size="lg" 
                className={cn("shadow-xl px-12")}
              >
                <Plus className="w-5 h-5 mr-2" />
                Inizia Chiusura
              </Button>
            </Link>
          </Card>
        )}

        {!selectedStore && (
          <div className="flex flex-col ml-3">
            <span className="flex items-center text-primary animate-in fade-in slide-in-from-top-1">
              Seleziona un negozio per inserire la chiusura di cassa:
            </span>
          </div>
        )}

        {/* Elenco Negozi */}
        {availableStores.length > 1 && (
        <Card>
          <h3 className="font-bold mb-4 text-lg">Negozi Disponibili</h3>
          <div className="grid gap-3">
            {availableStores.map(store => {
              const isDefault = store.id === user?.default_store_id;
              
                return (
                  <div 
                    key={store.id} 
                    role="button"
                    onClick={(e) => handleClick(e, store.id)}
                  >
                    <div 
                      className={cn(
                        "p-4 rounded-xl transition-all cursor-pointer flex items-center justify-between border-2",
                        isDefault 
                          ? "bg-primary/5 border-primary shadow-sm" 
                          : "bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200"
                      )}
                    >
                      <div>
                        <div className="flex items-center font-bold text-gray-900">
                          {store.name}
                          {isDefault && (
                            <span className="ml-2 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full uppercase">
                              Selezionato
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Fondo cassa: €{Number(store.openingCashFund || 0).toFixed(2)}
                        </div>
                      </div>
                    
                      {isDefault ? (
                        <CheckCircle className="w-6 h-6 text-primary" />
                      ) : (
                        <Button size="sm" variant="ghost" className="rounded-full">
                          Seleziona
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
            )} 
            {availableStores.length === 0 && !isPending && (
              <div className="text-center p-8 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-amber-700 font-medium">Nessun negozio assegnato al tuo profilo.<br/>Ricarica la pagina o contatta l'amministratore.</p>
              </div>
            )}
      </div>
      {isPending && (<Spinner/>)}
    </Layout>
  );
}