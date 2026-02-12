import { z } from "zod";

// === TYPESCRIPT INTERFACES (Per l'uso in tutta l'app) ===

export interface Store {
  id: string;
  name: string;
  active: boolean;
  emailDestinations: string | null;
  openingCashFund: number;
}

export interface PaymentMethod {
  id?: string;
  name: string;
  isCash: boolean;
  active: boolean;
}

export interface CashClose {
  id: string;
  storeId: string;
  date: string;
  compilerName: string;
  notes: string | null;
  totalSalesAmount: number;
  bankWithdrawalAmount: number;
  openingCashFund: number;
  theoreticalCashFund: number;
  actualCashFund: number;
  difference: number;
  status: 'ok' | 'warning' | 'ko';
  createdAt: string;
  receipt_image_url: string;
}

export interface CashClosePayment {
  id: string;
  cashCloseId: string;
  paymentMethodId: string;
  amount: number;
}

export interface CashCloseExpense {
  id: string;
  cashCloseId: string;
  description: string;
  amount: number;
}

export interface Profile {
  id: string; // Collegato a auth.users.id di Supabase
  username: string;
  email: string | null;
  isAdmin: boolean;
  role: 'operatore' | 'admin' | 'superAdmin';
  allowed_stores?: string[];
  blocked: boolean;
  default_store_id: string;
  created_at: Date | string;
  email_confirmed_at: Date | string;
}

export interface ProfileStores {
  profile_id:string;
  store_id:string;
}

export interface CompanySettings {
  id: string;
  companyName: string;
  logoUrl: string | null;
  updatedAt: string;
}

// === ZOD SCHEMAS (Per la validazione dei Form e Input) ===

// Helper per gestire i numeri che arrivano come stringhe dai form (decimali)
const coerceNumber = z.preprocess((val) => Number(val), z.number());

export const storeSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  active: z.boolean().default(true),
  emailDestinations: z.string().optional().nullable(),
  openingCashFund: coerceNumber.default(0),
});

export const cashCloseRequestSchema = z.object({
  storeId: z.string().uuid(),
  date: z.string(),
  compilerName: z.string().min(1, "Nome compilatore obbligatorio"),
  notes: z.string().optional().nullable(),
  totalSalesAmount: coerceNumber,
  bankWithdrawalAmount: coerceNumber,
  openingCashFund: coerceNumber,
  theoreticalCashFund: coerceNumber,
  actualCashFund: coerceNumber,
  difference: coerceNumber,
  status: z.enum(['ok', 'warning', 'ko']),
  payments: z.array(z.object({
    paymentMethodId: z.string().uuid(),
    amount: coerceNumber
  })),
  expenses: z.array(z.object({
    description: z.string().min(1),
    amount: coerceNumber
  }))
});

export const profileUpdateSchema = z.object({
  username: z.string().min(3).optional(),
  role: z.enum(['operatore', 'admin', 'superAdmin']).optional(), 
  allowed_stores: z.array(z.string().uuid()).optional(),
  blocked: z.boolean().optional(),
});

// === TYPES PER LE INSERT (Derivati da Zod) ===

export type InsertStore = z.infer<typeof storeSchema>;
export type CashCloseRequest = z.infer<typeof cashCloseRequestSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;