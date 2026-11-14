import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth as firebaseAuth } from '../firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
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
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
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

  useEffect(() => {
    let isMounted = true;

    const unsubscribeFirebase = onAuthStateChanged(firebaseAuth, async (fbUser: User | null) => {
      if (!isMounted) return;
      try {
        await authService.ensureVaultInitialized();
        if (fbUser && fbUser.email) {
          const idToken = await fbUser.getIdToken();
          const res = await authService.authenticateFromVerifiedOAuth({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            idToken,
            photoUrl: fbUser.photoURL,
          });
          if (isMounted) {
            setUser(res.user);
            setSession(res.session);
            setSessionError(null);
            refreshAvailableUsers();
            void databaseService.syncUserProfile(res.user).catch((err) => {
              console.warn('Profile sync warning:', err);
            });
          }
        } else {
          const active = await authService.validateSession();
          if (isMounted) {
            if (active) {
              setUser(active.user);
              setSession(active.session);
              setSessionError(null);
            } else {
              setUser(null);
              setSession(null);
            }
          }
        }
      } catch (err) {
        console.error('Auth state initialization failed:', err);
        if (isMounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (isMounted) {
          refreshAvailableUsers();
          setIsInitializing(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFirebase();
    };
  }, [refreshAvailableUsers]);

  const loginWithGoogle = async (): Promise<void> => {
    setSessionError(null);
    try {
      const isAndroidWebView =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'appassets.androidplatform.net' ||
          /wv|Version\/\d+\.\d+.*Chrome/.test(navigator.userAgent));

      if (isAndroidWebView) {
        throw new Error(
          'Google OAuth browser popups are blocked inside embedded Android WebView (RFC 8252). Please sign in using Email & Password below.'
        );
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(firebaseAuth, provider);
      if (!result.user.email) {
        throw new Error('Google OAuth did not return a verified account email.');
      }
      const idToken = await result.user.getIdToken();
      const res = await authService.authenticateFromVerifiedOAuth({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        idToken,
        photoUrl: result.user.photoURL,
      });
      setUser(res.user);
      setSession(res.session);
      refreshAvailableUsers();
      await databaseService.syncUserProfile(res.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      let msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        msg = 'Google Sign-In popup was closed before completing authentication.';
      } else if (
        code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        msg =
          'Google OAuth popup is not authorized for this domain in Firebase Console. Please sign in or register using Email & Password below.';
      }
      setSessionError(msg);
      throw new Error(msg);
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<void> => {
    setSessionError(null);
    try {
      const normalizedEmail = authService.validateEmail(email);
      let res: { user: AuthUser; session: AuthSession };
      try {
        const fbCred = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        const idToken = await fbCred.user.getIdToken();
        res = await authService.authenticateFromVerifiedOAuth({
          uid: fbCred.user.uid,
          email: fbCred.user.email || normalizedEmail,
          displayName: fbCred.user.displayName || normalizedEmail.split('@')[0],
          idToken,
        });
      } catch (fbErr: unknown) {
        const fbCode = (fbErr as { code?: string })?.code || '';
        if (fbCode === 'auth/network-request-failed') {
          res = await authService.authenticate(normalizedEmail, password);
        } else if (
          fbCode === 'auth/invalid-credential' ||
          fbCode === 'auth/wrong-password' ||
          fbCode === 'auth/user-not-found' ||
          fbCode === 'auth/invalid-email'
        ) {
          throw new Error('Invalid email or password.');
        } else if (fbCode === 'auth/user-disabled') {
          throw new Error('This account has been disabled.');
        } else if (fbCode === 'auth/too-many-requests') {
          throw new Error('Too many failed sign-in attempts. Please wait and try again.');
        } else if (fbCode) {
          throw fbErr instanceof Error ? fbErr : new Error(String(fbErr));
        } else {
          res = await authService.authenticate(normalizedEmail, password);
        }
      }

      setUser(res.user);
      setSession(res.session);
      refreshAvailableUsers();
      if (firebaseAuth.currentUser?.uid === res.user.id) {
        void databaseService.syncUserProfile(res.user).catch((err) => {
          console.warn('Profile sync warning:', err);
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Email login failed.';
      setSessionError(msg);
      throw err instanceof Error ? err : new Error(msg);
    }
  };

  const signupWithEmail = async (email: string, password: string, name: string): Promise<void> => {
    setSessionError(null);
    try {
      const normalizedEmail = authService.validateEmail(email);
      authService.validatePassword(password);

      let firebaseUid: string | undefined;
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        firebaseUid = cred.user.uid;
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } catch (fbErr: unknown) {
        const fbCode = (fbErr as { code?: string })?.code || '';
        if (fbCode === 'auth/email-already-in-use') {
          throw new Error('An account with this email address is already registered.');
        }
        if (fbCode && fbCode !== 'auth/network-request-failed') {
          throw fbErr instanceof Error ? fbErr : new Error(String(fbErr));
        }
      }

      const res = await authService.register(normalizedEmail, password, name, firebaseUid);
      setUser(res.user);
      setSession(res.session);
      refreshAvailableUsers();
      if (firebaseAuth.currentUser?.uid === res.user.id) {
        void databaseService.syncUserProfile(res.user).catch((err) => {
          console.warn('Profile sync warning:', err);
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed.';
      setSessionError(msg);
      throw err;
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    setSessionError(null);
    const normalizedEmail = authService.validateEmail(email);
    await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
  };

  const switchAccount = async (targetUserId: string): Promise<void> => {
    setSessionError(null);
    if (firebaseAuth.currentUser && firebaseAuth.currentUser.uid !== targetUserId) {
      try {
        await signOut(firebaseAuth);
      } catch (err) {
        console.warn('Firebase signOut during account switch warning:', err);
      }
    }
    const result = await authService.switchAccount(targetUserId);
    setUser(result.user);
    setSession(result.session);
    refreshAvailableUsers();
    if (firebaseAuth.currentUser?.uid === result.user.id) {
      void databaseService.syncUserProfile(result.user).catch((err) => {
        console.warn('Profile sync warning:', err);
      });
    }
  };

  const logout = async () => {
    try {
      await signOut(firebaseAuth);
    } catch (err) {
      console.warn('Firebase signOut error:', err);
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
        sendPasswordReset,
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
