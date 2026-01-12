import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { setUserReferralCode } from '@/lib/api';
import { getReferralCode, clearReferralCode } from '@/hooks/useReferral';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // On signup/signin, attach referral code if present
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.access_token) {
          const referralCode = getReferralCode();
          if (referralCode) {
            try {
              await setUserReferralCode(referralCode, session.access_token);
              clearReferralCode(); // Clear after successful attribution
              console.log('Referral code attributed successfully');
            } catch (error) {
              console.error('Failed to attribute referral code:', error);
            }
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } as AuthError, session: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    // Return session so caller knows if user was auto-confirmed
    return { error, session: data.session };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) {
      console.warn('[Auth] Cannot sign out - Supabase not configured');
      // Still clear local state
      setUser(null);
      setSession(null);
      return;
    }
    try {
      console.log('[Auth] Signing out...');
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('[Auth] Sign out error:', error);
      }
      // Always clear local state regardless of API response
      setUser(null);
      setSession(null);
      console.log('[Auth] Sign out complete, local state cleared');
    } catch (err) {
      console.error('[Auth] Sign out exception:', err);
      // Still clear local state on error
      setUser(null);
      setSession(null);
    }
  };

  const getAccessToken = async () => {
    if (!supabase) return null;
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[Auth] getSession error:', error);
        // Session is invalid - clear local state
        await supabase.auth.signOut();
        return null;
      }
      return session?.access_token ?? null;
    } catch (err) {
      console.error('[Auth] getAccessToken exception:', err);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isConfigured,
      signUp,
      signIn,
      signOut,
      getAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
