import { useState } from 'react';

interface RegisterFormProps {
  asAdmin?: boolean; // se true usa l'endpoint protetto per creare studenti senza fare login
  token?: string | null; // token del superadmin, necessario quando asAdmin = true
  onSuccess?: () => void; // callback chiamata dopo la corretta registrazione (modal caller chiuderà)
}

export const RegisterForm = ({ token = null, onSuccess}: RegisterFormProps) => {
  const [matricola, setMatricola] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

  try {
      // Modalità superadmin: chiamiamo endpoint protetto che crea lo studente
      // Endpoint consigliato: POST /api/admin/register-student
      const res = await fetch(`${API_BASE_URL}/api/admin/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ matricola, password, fullName }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        setSuccess('Registrazione completata con successo');
        setError('');
        // lasciare un attimo il messaggio, poi notifica il caller
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 700);
      } else {
        // mostra messaggio di errore restituito dal server
        const errMsg = data?.error || `Errore (${res.status}) durante la registrazione`;
        setError(errMsg);
        setSuccess('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Si è verificato un errore';
      setError(msg);
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  return (
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Elezioni Studentesche
            </h1>
            <p className="text-gray-600">
              {'Crea un nuovo account studente!'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo
              </label>
              <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Mario Rossi"
              />
            </div>

            <div>
              <label htmlFor="matricola" className="block text-sm font-medium text-gray-700 mb-1">
                Matricola
              </label>
              <input
                  id="matricola"
                  type="text"
                  value={matricola}
                  onChange={(e) => setMatricola(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="es. 12345"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••"
              />
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Caricamento...' : 'Registra Studente'}
            </button>
          </form>
        </div>
  );
};
