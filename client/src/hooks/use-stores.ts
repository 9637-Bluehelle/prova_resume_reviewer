import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storage } from "../lib/storage";
import { format, startOfMonth, endOfMonth } from "date-fns";

const STORES_KEY = ["/api/stores"];

export function useStores() {
  return useQuery({
    queryKey: STORES_KEY,
    queryFn: () => storage.getStores(),
  });
}

export function useStore(id: string) {
  return useQuery({
    queryKey: [...STORES_KEY, id],
    queryFn: () => storage.getStore(id),
    enabled: !!id,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => storage.createStore(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STORES_KEY }),
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & any) => 
      storage.updateStore(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STORES_KEY }),
  });
}

// --- DASHBOARD DATA ---
export function useDashboardData(storeId: string, month: Date) {
  const startDate = format(startOfMonth(month), "yyyy-MM-dd");
  const endDate = format(endOfMonth(month), "yyyy-MM-dd");

  return useQuery({
    queryKey: ['dashboard-stats-v2', storeId, startDate, endDate],
    queryFn: () => storage.getDashboardStats(
      storeId === "all" ? undefined : storeId, 
      startDate, 
      endDate
    ),
  });
}

// --- STATO OPERATIVO NEGOZI (Ottimizzato) ---
export function useStoresOperatingStatus() {
  const { data: stores } = useStores();
  
  return useQuery({
    queryKey: ['stores-fund-status', stores?.length],
    queryFn: async () => {
      if (!stores) return [];

      const statusPromises = stores.map(async (store) => {
        const lastClose = await storage.getPreviousCashClose(
          store.id, 
          format(new Date(), 'yyyy-MM-dd')
        );
        
        return {
          ...store,
          currentFund: lastClose ? Number(lastClose.theoreticalCashFund) : Number(store.openingCashFund || 0),
          lastClose
        };
      });
      
      return Promise.all(statusPromises);
    },
    enabled: !!stores && stores.length > 0
  });
}