import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {login, Role, User} from "./api.ts";

// Interfaccia per l'utente


interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (matricola: string, password: string) => Promise<{
    token: string;
    role: Role;
    id: number;
    matricola: string;
  }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    try {
      // 1️⃣ Chiamata alla tua API centralizzata
      const data = await login(matricola, password);

      // 2️⃣ Costruzione oggetto User basato sulla risposta del backend
      const userData: User = {
        full_name: "",
        id: data.id,
        matricola: data.matricola,
        role: data.role
      };

      // 3️⃣ Salvataggio dati nel localStorage
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(userData));

      // 4️⃣ Aggiorna stato globale (es. React state o context)
      setToken(data.token);
      setUser(userData);

      return data;
    } catch (error: any) {
      // 5️⃣ Gestione errore coerente
      let message = "Errore durante il login";

      // Axios style
      if (error?.response?.data?.error) {
        message = error.response.data.error;
      } else if (error?.message) {
        message = error.message;
      }

      throw new Error(message);
    }
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
