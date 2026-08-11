import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

/* Minimal auth gate for BGTS-OS. The app has no login today — this is the
   single, explicitly-approved UI addition needed so Row Level Security has
   any meaning (see supabase/migrations/0003_rls.sql: every table requires an
   authenticated user). There's no self-serve sign-up screen on purpose —
   this is a single shared company account model, not a public product, so
   accounts are created by you via the Supabase Dashboard
   (Authentication -> Users -> Add user) rather than anyone being able to
   register themselves from the login screen. */

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setAuthError(error.message); return false; }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ session, loading: session === undefined, authError, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() { return useContext(Ctx); }
