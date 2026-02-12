import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storage } from "@/lib/storage"; // Importiamo lo storage Supabase
import type { CompanySettings } from "@shared/schema";

const SETTINGS_KEY = ["/api/company-settings"];

export function useCompanySettings() {
  return useQuery<CompanySettings | undefined>({
    queryKey: SETTINGS_KEY,
    queryFn: () => storage.getCompanySettings(),
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<CompanySettings>) => 
      storage.updateCompanySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}