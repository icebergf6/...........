import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase';
import { useAuth } from './AuthContext';

const PaymentAccountsContext = createContext(null);
const LOCAL_PAYMENT_ACCOUNTS_KEY = 'atier_crm_payment_accounts_v1';
export const MAX_PAYMENT_ACCOUNTS = 10;

export function PaymentAccountsProvider({ children }) {
  const { user, profile } = useAuth();
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPaymentAccounts([]);
      setLoading(false);
      return;
    }
    loadPaymentAccounts();

    // Live sync across accounts/tabs
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('public:payment_accounts_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payment_accounts' },
          () => {
            loadPaymentAccounts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      function handleStorageChange(e) {
        if (e.key === LOCAL_PAYMENT_ACCOUNTS_KEY && e.newValue) {
          try {
            setPaymentAccounts(JSON.parse(e.newValue));
          } catch (err) {
            console.error('Failed to sync payment accounts from storage:', err);
          }
        }
      }
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [user]);

  async function loadPaymentAccounts() {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase && user) {
        const { data, error } = await supabase
          .from('payment_accounts')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(MAX_PAYMENT_ACCOUNTS);

        if (error) throw error;
        setPaymentAccounts(data || []);
      } else {
        const saved = localStorage.getItem(LOCAL_PAYMENT_ACCOUNTS_KEY);
        if (saved) {
          setPaymentAccounts(JSON.parse(saved));
        } else {
          setPaymentAccounts([]);
        }
      }
    } catch (err) {
      console.error('Error loading payment accounts:', err);
    } finally {
      setLoading(false);
    }
  }

  function persistLocal(nextList) {
    setPaymentAccounts(nextList);
    localStorage.setItem(LOCAL_PAYMENT_ACCOUNTS_KEY, JSON.stringify(nextList));
  }

  async function addPaymentAccount(payload) {
    if (profile?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Admin yang dapat menambah rekening pembayaran.');
    }
    if (paymentAccounts.length >= MAX_PAYMENT_ACCOUNTS) {
      throw new Error(
        `Batas maksimal ${MAX_PAYMENT_ACCOUNTS} rekening pembayaran telah tercapai.`
      );
    }

    const newRecord = {
      user_id: user?.id,
      provider_type: payload.provider_type || 'local_bank',
      provider_name: payload.provider_name.trim(),
      account_name: payload.account_name.trim(),
      account_number: payload.account_number.trim(),
      notes: (payload.notes || '').trim(),
    };

    if (isSupabaseConfigured && supabase && user) {
      const { data, error } = await supabase
        .from('payment_accounts')
        .insert([newRecord])
        .select()
        .single();

      if (error) throw error;
      setPaymentAccounts((prev) => [...prev, data]);
      return data;
    }

    const localRecord = {
      ...newRecord,
      id: 'pay-' + Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextList = [...paymentAccounts, localRecord];
    persistLocal(nextList);
    return localRecord;
  }

  async function deletePaymentAccount(id) {
    if (profile?.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Admin yang dapat menghapus rekening pembayaran.');
    }
    if (isSupabaseConfigured && supabase && user) {
      const { error } = await supabase
        .from('payment_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setPaymentAccounts((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    const nextList = paymentAccounts.filter((item) => item.id !== id);
    persistLocal(nextList);
  }

  const isMaxAccounts = paymentAccounts.length >= MAX_PAYMENT_ACCOUNTS;

  return (
    <PaymentAccountsContext.Provider
      value={{
        paymentAccounts,
        loading,
        isMaxAccounts,
        maxAccounts: MAX_PAYMENT_ACCOUNTS,
        addPaymentAccount,
        deletePaymentAccount,
        refreshPaymentAccounts: loadPaymentAccounts,
      }}
    >
      {children}
    </PaymentAccountsContext.Provider>
  );
}

export function usePaymentAccounts() {
  const ctx = useContext(PaymentAccountsContext);
  if (!ctx) {
    throw new Error(
      'usePaymentAccounts must be used inside PaymentAccountsProvider'
    );
  }
  return ctx;
}
