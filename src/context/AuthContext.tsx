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

  // Restore session on mount
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
        } else {
          // If a session token was previously saved but is now invalid/expired
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

    restoreSession();

    // Listen to storage events across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ucfm_active_session_v1' || e.key === 'ucfm_auth_user') {
        restoreSession();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshAvailableUsers]);

  const loginWithGoogle = async (): Promise<void> => {
    setSessionError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;
      // You can now use user.uid to link to your firestore records
      // and authenticate via authService to keep local session state consistent
      await authService.authenticateWithGoogle(user.email || undefined, user.displayName || undefined);
    } catch (err) {
      setSessionError('Google Sign-In failed.');
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<void> => {
    setSessionError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      await authService.authenticate(email, password);
    } catch (err) {
      setSessionError('Email login failed.');
      throw err;
    }
  };

  const signupWithEmail = async (email: string, password: string, name: string): Promise<void> => {
    setSessionError(null);
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await authService.register(email, password, name);
    } catch (err) {
      setSessionError('Signup failed.');
      throw err;
    }
  };

  const switchAccount = async (targetUserId: string): Promise<void> => {
    setSessionError(null);
    const result = await authService.switchAccount(targetUserId);
    setUser(result.user);
    setSession(result.session);
    refreshAvailableUsers();
  };

  const logout = async () => {
    try {
      await signOut(firebaseAuth);
      authService.logout();
      setUser(null);
      setSession(null);
      setSessionError(null);
      refreshAvailableUsers();
    } catch (err) {
      console.error('Logout failed:', err);
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
