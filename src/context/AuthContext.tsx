import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  createdAt: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loginWithGoogle: (email?: string, name?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('ucfm_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('ucfm_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ucfm_auth_user');
    }
  }, [user]);

  const loginWithGoogle = async (customEmail?: string, customName?: string): Promise<void> => {
    // Simulate Google Sign-In with slight delay
    await new Promise((r) => setTimeout(r, 600));

    const email = customEmail || 'mohamedarman536@gmail.com';
    const name = customName || (email.split('@')[0]);

    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      email,
      name,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1a73e8`,
      provider: 'google',
      createdAt: Date.now(),
    };

    setUser(newUser);
  };

  const loginWithEmail = async (email: string, _password: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 500));

    const name = email.split('@')[0];
    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      email,
      name,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0078d4`,
      provider: 'email',
      createdAt: Date.now(),
    };

    setUser(newUser);
  };

  const signupWithEmail = async (email: string, _password: string, name: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600));

    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0061ff`,
      provider: 'email',
      createdAt: Date.now(),
    };

    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
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
