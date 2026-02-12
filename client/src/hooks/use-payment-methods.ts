import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storage } from "../lib/storage"; // Importiamo lo storage Supabase
import { type PaymentMethod } from "@shared/schema";

const PM_KEY = ["/api/payment-methods"];

export function usePaymentMethods() {
  return useQuery({
    queryKey: PM_KEY,
    queryFn: () => storage.getPaymentMethods(),
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PaymentMethod) => storage.createPaymentMethod(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PM_KEY });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<PaymentMethod>) =>
      storage.updatePaymentMethod(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PM_KEY });
    },
  });
}