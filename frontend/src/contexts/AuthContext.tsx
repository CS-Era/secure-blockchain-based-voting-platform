import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {User} from "../api.ts";

// Interfaccia per l'utente


interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (matricola: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// URL base della tua API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Recupera il token salvato al mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('auth_user');

      console.log('Checking saved auth...', { savedToken, savedUser });

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Error loading saved auth:', error);
      // Pulisci dati corrotti
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (matricola: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ matricola, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore durante il login');
    }

    const data = await response.json();

    // Salva il token e i dati utente
    const userData: User = {
      id: 0, // L'API non restituisce l'ID, potresti volerlo aggiungere
      matricola: matricola,
      full_name: data.full_name,
      role: data.role,
    };

    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(userData));

    setToken(data.token);
    setUser(userData);
  };

  const signOut = async () => {
    // Rimuovi i dati salvati
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');

    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
