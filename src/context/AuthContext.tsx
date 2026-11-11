import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth as firebaseAuth } from '../firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { authService, AuthUser, AuthSession } from '../services/authService';
import { databaseService } from '../services/databaseService';

export type { AuthUser, AuthSession };

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  sessionError: string | null;
  availableUsers: AuthUser[];
  loginWithGoogle: (email?: string, name?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  logout: () => void;
  clearSessionError: () => void;
  refreshAvailableUsers: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AuthUser[]>([]);

  const refreshAvailableUsers = useCallback(() => {
    try {
      const users = authService.getAvailableUsers();
      setAvailableUsers(users);
    } catch (e) {
      console.warn('Failed to refresh available users:', e);
    }
  }, []);

  // Restore session on mount and listen to Firebase Auth state changes
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        await authService.ensureVaultInitialized();
        const active = await authService.validateSession();

        if (!isMounted) return;

        if (active) {
          setUser(active.user);
          setSession(active.session);
          setSessionError(null);
          void databaseService.syncUserProfile(active.user);
        } else {
          const rawSession = localStorage.getItem('ucfm_active_session_v1');
          if (rawSession) {
            setSessionError('Your security session has expired. Please sign in again.');
            authService.logout();
          }
          setUser(null);
          setSession(null);
        }
      } catch (err: unknown) {
        console.error('Session restoration failed:', err);
        if (isMounted) {
          setUser(null);
          setSession(null);
          setSessionError('Security session invalid. Please log in.');
        }
      } finally {
        if (isMounted) {
          refreshAvailableUsers();
          setIsInitializing(false);
        }
      }
    };

    void restoreSession();

    const unsubscribeFirebase = onAuthStateChanged(firebaseAuth, async (fbUser: User | null) => {
      if (!isMounted || !fbUser) return;
      try {
        const currentActive = await authService.validateSession();
        if (!currentActive && fbUser.email) {
          const res = await authService.authenticateWithGoogle(
            fbUser.email,
            fbUser.displayName || undefined
          );
          if (isMounted) {
            setUser(res.user);
            setSession(res.session);
            setSessionError(null);
            refreshAvailableUsers();
            void databaseService.syncUserProfile(res.user);
          }
        }
      } catch (e) {
        console.warn('Firebase auth state sync warning:', e);
      }
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ucfm_active_session_v1' || e.key === 'ucfm_auth_user') {
        void restoreSession();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      unsubscribeFirebase();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshAvailableUsers]);

  const loginWithGoogle = async (email?: string, name?: string): Promise<void> => {
    setSessionError(null);
    try {
      let resolvedEmail = email;
      let resolvedName = name;

      // Attempt Firebase Google popup when no explicit email is passed and not restricted by WebView
      const isAndroidWebView =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'appassets.androidplatform.net' ||
          /wv|Version\/\d+\.\d+.*Chrome/.test(navigator.userAgent));

      if (!resolvedEmail && !isAndroidWebView) {
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(firebaseAuth, provider);
          resolvedEmail = result.user.email || undefined;
          resolvedName = result.user.displayName || undefined;
        } catch (popupErr: unknown) {
          const code = (popupErr as { code?: string })?.code || '';
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            throw new Error('Google Sign-In popup was closed before completing authentication.');
          }
          // For WebView / unauthorized-domain / environment restrictions, fall back to local Google OAuth vault
          console.warn('Firebase popup unavailable in this environment, using local Google session vault:', code);
        }
      }

      const res = await authService.authenticateWithGoogle(resolvedEmail, resolvedName);
      setUser(res.user);
      setSession(res.session);
      refreshAvailableUsers();
      void databaseService.syncUserProfile(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setSessionError(msg);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<void> => {
    setSessionError(null);
    try {
      // Authenticate against cryptographic local vault first (supports pre-seeded owner & enterprise accounts + registered users)
      let res: { user: AuthUser; session: AuthSession };
      try {
        res = await authService.authenticate(email, password);
      } catch (vaultErr) {
        // If user exists in Firebase Auth from another device, verify with Firebase Auth and register locally
        const fbCred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        res = await authService.authenticateWithGoogle(
          fbCred.user.email || email,
          fbCred.user.displayName || email.split('@')[0]
        );
        void vaultErr;
      }

      // Best-effort Firebase Auth session synchronization for Firestore rules
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      } catch {
        try {
          await createUserWithEmailAndPassword(firebaseAuth, email, password);
        } catch {
          // Ignore if offline or email already linked to Google provider
        }
      }

      setUser(res.user);
      setSession(res.session);
      refreshAvailableUsers();
      void databaseService.syncUserProfile(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Email login failed.';
      setSessionError(msg);
      throw err;
    }
  };

  const signupWithEmail = async (email: string, password: string, name: string): Promise<void> => {
    setSessionError(null);
    try {
      const res = await authService.register(email, password, name);

      // Best-effort Firebase Auth user creation for Firestore sync
      try {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      } catch {
        // Ignore if offline or restricted in Android WebView
      }

      setUser(res.user);
      setSession(res.session);
      refreshAvailableUsers();
      void databaseService.syncUserProfile(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed.';
      setSessionError(msg);
      throw err;
    }
  };

  const switchAccount = async (targetUserId: string): Promise<void> => {
    setSessionError(null);
    const result = await authService.switchAccount(targetUserId);
    setUser(result.user);
    setSession(result.session);
    refreshAvailableUsers();
    void databaseService.syncUserProfile(result.user);
  };

  const logout = async () => {
    try {
      await signOut(firebaseAuth).catch(() => undefined);
    } finally {
      authService.logout();
      setUser(null);
      setSession(null);
      setSessionError(null);
      refreshAvailableUsers();
    }
  };

  const clearSessionError = () => {
    setSessionError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user && !!session && Date.now() < session.expiresAt,
        isInitializing,
        sessionError,
        availableUsers,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        switchAccount,
        logout,
        clearSessionError,
        refreshAvailableUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
