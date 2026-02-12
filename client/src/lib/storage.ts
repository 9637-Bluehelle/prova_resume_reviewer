import { supabase } from "@/lib/supabase";
import type { Profile, Store, InsertStore, CashClose, CashClosePayment, CashCloseExpense, PaymentMethod, CompanySettings } from "@shared/schema";

export const storage = {
  // --- USERS ---
  async getUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_stores (
        store_id
      )
    `)
    .order('username');

  if (error) throw error;

  return (data || []).map(profile => ({
    ...profile,
    allowed_stores: profile.profile_stores?.map((ps: any) => ps.store_id) || []
  }));
},

async getUser(id: string): Promise<Profile | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_stores (
        store_id
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  return {
    ...data,
    allowed_stores: data.profile_stores?.map((ps: any) => ps.store_id) || []
  };
},

  /*async createUser(user: any): Promise<any> {     
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_admin: user.role === 'admin' ? true : false,
        blocked: false
      })
      .select()
      .single();

    if (error) throw error;

    if (user.role === 'operatore' && user.allowed_stores && user.allowed_stores.length > 0) {
    const storeInserts = user.allowed_stores.map((storeId: string) => ({
      profile_id: user.id,
      store_id: storeId,
    }));

    const { error: insertError } = await supabase
      .from('profile_stores')
      .insert(storeInserts);

    if (insertError) throw insertError;
  }

  return newProfile;
  },*/

  async updateUser(id: string, data: any): Promise<any> {
    const payload = {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role,
        is_admin: data.role === 'admin' || data.role === 'superAdmin',
        blocked: data.blocked
    };
    const { data: updated, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Sincronizzazione tabella PROFILE_STORES
  if (data.allowed_stores !== undefined) {
    //Cancelliamo tutte le associazioni esistenti 
    const { error: deleteError } = await supabase
      .from('profile_stores')
      .delete()
      .eq('profile_id', id);

    if (deleteError) throw deleteError;

    // aggiungiamo i nuovi negozi 
    if (data.allowed_stores && data.allowed_stores.length > 0) {
      const storeInserts = data.allowed_stores.map((storeId: string) => ({
        profile_id: id,
        store_id: storeId,
      }));

      const { error: insertError } = await supabase
        .from('profile_stores')
        .insert(storeInserts);

      if (insertError) throw insertError;
    }
  }
    return updated;
  },

  /*async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },*/

  // --- STORES ---
  async getStores(): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        active,
        emailDestinations:email_destinations,
        openingCashFund:opening_cash_fund
      `)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createStore(store: InsertStore): Promise<Store> {
  const payload = {
    name: store.name,
    active: store.active,
    email_destinations: store.emailDestinations, 
    opening_cash_fund: store.openingCashFund 
  };

  const { data, error } = await supabase
    .from('stores')
    .insert(payload)
    .select(`
        id, name, active, 
        emailDestinations:email_destinations, 
        openingCashFund:opening_cash_fund
    `)
    .single();
    
  if (error) throw error;
  return data;
},

  async getStore(id: string): Promise<Store | undefined> {
    const { data, error } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        active,
        emailDestinations:email_destinations,
        openingCashFund:opening_cash_fund
      `)
      .eq('id', id)
      .single();

    if (error) return undefined;
    return data;
  },

  async updateStore(id: string, store: Partial<Store>): Promise<Store> {
    const payload: any = { ...store };
  
    if (store.emailDestinations) {
      payload.email_destinations = store.emailDestinations;
      delete payload.emailDestinations;
    }
    if (store.openingCashFund) {
      payload.opening_cash_fund = store.openingCashFund;
      delete payload.openingCashFund;
    }

    const { data, error } = await supabase
      .from('stores')
      .update(payload)
      .eq('id', id)
      .select(`
        id,
        name,
        active,
        emailDestinations:email_destinations,
        openingCashFund:opening_cash_fund
      `)
      .single();

    if (error) {
      console.error("Errore durante l'update:", error.message);
      throw error;
    }
  
    return data;
  },

  // --- PAYMENT METHODS ---
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select(`
        id,
        name,
        isCash:is_cash,
        active
      `)
      .eq('active', true)
      .order('id');
    if (error) throw error;
    return data || [];
  },

  async createPaymentMethod(pm: PaymentMethod): Promise<PaymentMethod> {
  const payload = {
    name: pm.name,
    active: pm.active,
    is_cash: pm.isCash 
  };

  const { data, error } = await supabase
    .from('payment_methods')
    .insert(payload)
    .select(`
      id,
      name,
      isCash:is_cash,
      active
    `) 
    .single();

  if (error) throw error;
  return data;
},

  async updatePaymentMethod(id: string, pm: Partial<PaymentMethod>): Promise<PaymentMethod> {
  const payload: any = { ...pm };

  if (pm.isCash !== undefined) {
    payload.is_cash = pm.isCash;
    delete payload.isCash;
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .update(payload)
    .eq('id', id)
    .select(`
      id,
      name,
      isCash:is_cash,
      active
    `)
    .single();

  if (error) throw error;
  return data;
},

  // --- CASH CLOSES (Lettura Complessa con Join) ---
  async getCashCloses(storeId?: string, date?: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('cash_closes')
      .select(`
      id,
      date,
      notes,
      status,
      storeId:store_id,
      compilerName:compiler_name,
      totalSalesAmount:total_sales_amount,
      bankWithdrawalAmount:bank_withdrawal_amount,
      openingCashFund:opening_cash_fund,
      theoreticalCashFund:theoretical_cash_fund,
      actualCashFund:actual_cash_fund,
      difference,
      createdAt:created_at,
      receipt_image_url,
      store:stores(*),
      payments:cash_close_payments(
        id,
        amount,
        paymentMethodId:payment_method_id,
        paymentMethod:payment_methods(*)
      ),
      expenses:cash_close_expenses(*)
    `)
      .order('date', { ascending: false });

    if (storeId) query = query.eq('store_id', storeId);
    if (date) query = query.eq('date', date);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // --- PREVIOUS CASH CLOSE (Logica per saldo iniziale) ---
  async getPreviousCashClose(storeId: string, date: string): Promise<CashClose | undefined> {
  const { data, error } = await supabase
    .from('cash_closes')
    .select(`
      id, date, notes, status,
      storeId:store_id,
      compilerName:compiler_name,
      totalSalesAmount:total_sales_amount,
      bankWithdrawalAmount:bank_withdrawal_amount,
      openingCashFund:opening_cash_fund,
      theoreticalCashFund:theoretical_cash_fund,
      actualCashFund:actual_cash_fund,
      difference,
      receipt_image_url,
      createdAt:created_at
    `)
    .eq('store_id', storeId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || undefined;
},

  // --- CREATE CASH CLOSE (Transazione Atomica via RPC) ---
  async getCashClose(id: string) {
    const { data, error } = await supabase
      .from('cash_closes')
      .select(`
        id, date, notes, status,
        storeId:store_id,
        compilerName:compiler_name,
        totalSalesAmount:total_sales_amount,
        bankWithdrawalAmount:bank_withdrawal_amount,
        openingCashFund:opening_cash_fund,
        theoreticalCashFund:theoretical_cash_fund,
        actualCashFund:actual_cash_fund,
        difference,
        receipt_image_url,
        createdAt:created_at,
        store:stores(*),
        payments:cash_close_payments(
          id, amount, 
          paymentMethodId:payment_method_id,
          paymentMethod:payment_methods(*)
        ),
        expenses:cash_close_expenses(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createCashClose(data: any, payments: any[], expenses: any[]): Promise<any> {
  const mappedData = {
    date: data.date,
    status: data.status || 'ok',
    storeId: data.storeId,         
    openingCashFund: data.openingCashFund,
    compilerName: data.compilerName,
    totalSalesAmount: data.totalSalesAmount,
    bankWithdrawalAmount: data.bankWithdrawalAmount,
    theoreticalCashFund: data.theoreticalCashFund,
    actualCashFund: data.actualCashFund,
    difference: data.difference,
    notes: data.notes,
    receipt_image_url: data.receipt_image_url,
  };

  const mappedPayments = payments.map(p => ({
    amount: p.amount,
    paymentMethodId: p.paymentMethodId 
  }));

  const { data: newId, error } = await supabase.rpc('create_cash_close_full', {
    p_close_data: mappedData,
    p_payments: mappedPayments,
    p_expenses: expenses 
  });

  if (error) throw error;
  return { ...data, id: newId };
},

  // --- DASHBOARD STATS ---
  async getDashboardStats(storeId?: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_store_id: (storeId && storeId !== "") ? storeId : null,
      p_start_date: (startDate && startDate !== "") ? startDate : null,
      p_end_date: (endDate && endDate !== "") ? endDate : null
    });

    if (error) {
      console.error("Errore RPC stats:", error.message);
      throw error;
    }
    return data;
  },

  // --- COMPANY SETTINGS ---
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || undefined;
  },

  async updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
  // Recuperiamo leimpostazioni (se è solo una riga)
  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .maybeSingle();

  if (existing) {
    // Se esistono, aggiorniamo quella riga
    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    // Se non esistono, le creiamo
    const { data, error } = await supabase
      .from('company_settings')
      .insert(settings)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
},
};