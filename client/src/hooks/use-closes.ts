import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storage } from "@/lib/storage";
import type { CashCloseRequest } from "@shared/schema";

// Chiavi per React Query (manteniamo stringhe simili alle vecchie rotte per compatibilità)
const CLOSES_KEYS = {
  all: ["closes"] as const,
  list: (filters: any) => [...CLOSES_KEYS.all, "list", filters] as const,
  details: (id: string) => [...CLOSES_KEYS.all, "get", id] as const,
  previous: (storeId: string, date: string) => [...CLOSES_KEYS.all, "previous", storeId, date] as const,
};

export function useCloses(filters?: { storeId?: string; date?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: CLOSES_KEYS.list(filters),
    queryFn: () => storage.getCashCloses(
      filters?.storeId, 
      filters?.date, 
      filters?.startDate, 
      filters?.endDate
    ),
  });
}

export function useClose(id: string) {
  return useQuery({
    queryKey: CLOSES_KEYS.details(id),
    queryFn: () => storage.getCashClose(id),
    enabled: !!id,
  });
}

export function usePreviousClose(storeId: string, date: string) {
  return useQuery({
    queryKey: CLOSES_KEYS.previous(storeId, date),
    queryFn: () => storage.getPreviousCashClose(storeId, date),
    enabled: !!storeId && !!date,
  });
}

export function useCreateClose() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CashCloseRequest) => {
      const { payments, expenses, ...closeData } = data;
      return storage.createCashClose(closeData, payments, expenses);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLOSES_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}