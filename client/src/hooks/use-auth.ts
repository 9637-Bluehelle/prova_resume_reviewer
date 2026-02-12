import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase"; 
import { storage } from "@/lib/storage";
import { useLocation } from "wouter";

// Chiave unica per TanStack Query
const AUTH_QUERY_KEY = ["/api/auth/me"];

export function useAuth() {
  const queryClient = useQueryClient();
  const [_, setLocation] = useLocation();

  // Recupero Utente
  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) return null;

      const profile = await storage.getUser(session.user.id);
      
      if (!profile || profile.blocked === true) {
        await supabase.auth.signOut();
        return null; 
      }

      return profile;
    },
    staleTime: Infinity, 
    retry: false,
  });

  // login mutation
 const loginMutation = useMutation({
    mutationFn: async ({ email, password }: any) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = await storage.getUser(data.user.id);
      if (!profile) throw new Error("Profilo non trovato dopo il login");
      
      if (profile.blocked === true) {
        await supabase.auth.signOut();
        throw new Error("Il tuo account è stato bloccato. Contatta l'amministratore.");
      }

      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, profile);
      if (profile.role === 'admin' || profile.role === 'superAdmin') {
        setLocation("/dashboard");
      } else {
        setLocation("/operatore");
      }
    },
  });

  // Logout Mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear(); 
      setLocation("/login");
    },
  });

  return {
    user,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: (loginMutation.error as Error)?.message,
    logout: logoutMutation.mutate,
  };
}

export function useUpdateDefaultStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { default_store_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', session.user.id)
        .select()
        .single();

      if (error) throw error;
      return updatedProfile;
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, updatedUser);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}