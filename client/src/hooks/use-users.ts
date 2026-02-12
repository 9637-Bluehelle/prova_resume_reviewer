import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storage } from "../lib/storage"; 
import { Profile } from "@shared/schema";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const USERS_KEY = ["/api/users"];

export function useUsers() {
  const queryClient = useQueryClient();

  const query = useQuery<Profile[]>({
    queryKey: USERS_KEY,
    queryFn: () => storage.getUsers(),
    select: (users) => users.filter(user => user.role !== 'superAdmin'),
  });

  useEffect(() => {
    // Sottoscrizione al canale Realtime
    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        {
          event: '*', // Ascolta 
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          // Forza React la query getUsers()
          queryClient.invalidateQueries({ queryKey: USERS_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/*export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newUser: any) => storage.createUser(newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}*/

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Profile>) => 
      storage.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}

/*export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storage.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}*/