import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CloseWizard from "@/pages/close-wizard";
import AdminPage from "@/pages/admin";
import OperatoreDashboard from "@/pages/operatore";
import ProfilePage from "@/pages/profile";
import EmailConfirmed from "@/pages/emailConfirmed";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "./components/modals";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStores } from "./hooks/use-stores";

export function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Route path={path}><Spinner /></Route>;

  if (!user) return <Redirect to="/login" />;

  return <Route path={path} component={Component} />;
}

export function AdminRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Route path={path}><Spinner /></Route>;
  if (!user) return <Route path={path}><Redirect to="/login" /></Route>;

  const isAdmin = user.role === 'admin' || user.role === 'superAdmin';
  
  if (!isAdmin) {
    return <Route path={path}><Redirect to="/operatore" /></Route>;
  }

  return <Route path={path} component={Component} />;
}

export function OperatorOnly({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Route path={path}><Spinner /></Route>;
  if (!user) return <Route path={path}><Redirect to="/login" /></Route>;

  const isAllowed = user.role === 'operatore' || user.role === 'superAdmin';

  if (!isAllowed) {
    return <Route path={path}><Redirect to="/dashboard" /></Route>;
  }

  return <Route path={path} component={Component} />;
}

export function useFilteredStores() {
  const { user } = useAuth();
  const { data: stores } = useStores();

  // negozi a cui l'utente ha accesso
  const availableStores = useMemo(() => {
    
    if (!stores) return [];
    if (user?.role === 'admin' || user?.role == 'superAdmin') {
      return stores;
    }

    const allowedIds = user?.allowed_stores || [];
    return stores.filter(store => allowedIds.includes(store.id));
  }, [stores, user]);

  // negozio selezionato (default)
  const selectedStore = useMemo(() => {
    return availableStores.find(s => s.id === user?.default_store_id);
  }, [availableStores, user?.default_store_id]);

  return {
    availableStores,
    selectedStore
  };
}



function Router() {
  const { user, isLoading, login } = useAuth();
  const [showConfirmation, setShowConfirmation] = useState(false);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    const urlParams = new URLSearchParams(window.location.search);
    const isConfirmType = urlParams.get('type') === 'signup' || urlParams.get('type') === 'recovery';

    if (event === 'SIGNED_IN' && session) {
       const confirmedAt = new Date(session.user.email_confirmed_at || 0).getTime();
       const now = new Date().getTime();
       const isJustConfirmed = (now - confirmedAt) < 10000;

       if (isJustConfirmed || isConfirmType) {
         localStorage.setItem("email_just_confirmed", "true");
       }
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
    
    if (event === 'SIGNED_OUT') {
      queryClient.clear();
      setShowConfirmation(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);
  
  
 return (
    <Switch>
      {/* 1. Rotta Radice: Gestisce l'atterraggio */}
      <Route path="/">
        {() => {
          const justConfirmed = localStorage.getItem("email_just_confirmed") === "true";
          
          if (justConfirmed) {
            // Se ha appena confermato, lo mandiamo a EmailConfirmed 
            return <EmailConfirmed />;
          }

          // Altrimenti, in base al ruolo
          if (user) {
            if (user.role === 'superAdmin') {
              return <Redirect to={"/admin"} />;
            } else {
              return <Redirect to={user.isAdmin ? "/dashboard" : "/operatore"} />;
            }
          }
          
          return <Redirect to="/login" />;
        }}
      </Route>

      {/* 2. Login: Mostra il disclaimer se c'è il flag nel localStorage */}
      <Route path="/login">
        {user && localStorage.getItem("email_just_confirmed") !== "true" 
          ? <Redirect to={user.isAdmin ? "/dashboard" : "/operatore"} /> 
          : <LoginPage onLogin={() => {}} />
        }
      </Route>
      
      {/* 3. Rotte protette Admin (ora su /dashboard) */}
      <AdminRoute path="/dashboard" component={Dashboard} />
      <AdminRoute path="/admin" component={AdminPage} />
      
      {/* 4. Rotte protette Operatore */}
      <OperatorOnly path="/operatore" component={OperatoreDashboard} />
      <ProtectedRoute path="/close/new" component={CloseWizard} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;