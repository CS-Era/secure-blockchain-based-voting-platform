import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { ElectionsList } from './components/ElectionsList';
import { VotingModal } from './components/VotingModal';
import { ResultsModal } from './components/ResultsModal';
// 1. IMPORTIAMO IL NUOVO COMPONENTE E LE ICONE AGGIUNTIVE
import { VerifyVote } from './components/VerifyVote'; 
import { LogOut, Vote, Settings, ShieldCheck, X } from 'lucide-react'; 
import { Election } from "./contexts/api.ts";

function AppContent() {
  const { user, loading, signOut } = useAuth();

  const [votingElection, setVotingElection] = useState<Election | null>(null);
  const [resultsElection, setResultsElection] = useState<Election | null>(null);

  // 2. STATO PER GESTIRE LA VISIBILITÀ DEL MODALE DI VERIFICA
  const [showVerify, setShowVerify] = useState(false);

  // forzare refresh dei figli quando necessario
  const [refreshKey] = useState(0);

  // ruoli locali calcolati
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // considera i ruoli possibili: 'student', 'admin', 'super_admin'
      setIsAdmin(user.role === 'admin');
      setIsSuperAdmin(user.role === 'super_admin');
    } else {
      setIsAdmin(false);
      setIsSuperAdmin(false);
    }
    setRoleLoading(false);
  }, [user]);

  if (loading || roleLoading) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento...</p>
          </div>
        </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // Header + body condivisi; la parte centrale cambia in base ai ruoli
  return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
        
        {/* 3. MODALE DI VERIFICA (Renderizzato sopra tutto se attivo) */}
        {showVerify && (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="relative w-full max-w-lg">
                <button 
                  onClick={() => setShowVerify(false)}
                  className="absolute -top-10 right-0 text-white hover:text-gray-200 transition"
                  title="Chiudi"
                >
                  <X className="w-8 h-8" />
                </button>
                {/* Il componente VerifyVote viene renderizzato qui */}
                <VerifyVote />
              </div>
            </div>
        )}

        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Vote className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Elezioni Studentesche</h1>
                  <p className="text-sm text-gray-600">Matricola: {user.matricola}</p>
                </div>

                {/* badge ruolo */}
                {isSuperAdmin ? (
                    <span className="hidden md:flex ml-4 items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  <Settings className="w-4 h-4" />
                  SuperAdmin
                </span>
                ) : isAdmin ? (
                    <span className="hidden md:flex ml-4 items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  <Settings className="w-4 h-4" />
                  Admin
                </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                {/* 4. PULSANTE PER APRIRE LA VERIFICA */}
                <button
                    onClick={() => setShowVerify(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition font-medium border border-purple-200"
                    title="Verifica la validità del tuo voto sulla Blockchain"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Verifica Voto</span>
                </button>

                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Esci</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isSuperAdmin ? (
              // SuperAdminDashboard: spazio per funzioni globali
              <SuperAdminDashboard
                  onVote={(election) => setVotingElection(election)}
                  onViewResults={(election) => setResultsElection(election)}
                  refreshKey={refreshKey}
              />
          ) : isAdmin ? (
              // AdminDashboard per normali permessi da admin
              <AdminDashboard
                  onVote={(election) => setVotingElection(election)}
                  onViewResults={(election) => setResultsElection(election)}
                  refreshKey={refreshKey}
              />
          ) : (
              // Utente studente
              <>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Le tue Elezioni</h2>
                  <p className="text-gray-600">Gestisci le tue votazioni e visualizza i risultati</p>
                </div>

                <ElectionsList
                    key={refreshKey}
                    onVote={(election) => setVotingElection(election)}
                    onViewResults={(election) => setResultsElection(election)}
                    isAdmin={false}
                />
              </>
          )}
        </main>

        {votingElection && (
            <VotingModal
                election={votingElection}
                onClose={() => setVotingElection(null)}
                onVoteSuccess={() => {
                  setVotingElection(null);
                }}
            />
        )}

        {resultsElection && (
            <ResultsModal
                election={resultsElection}
                onClose={() => setResultsElection(null)}
            />
        )}
      </div>
  );
}

function App() {
  return (
      <AuthProvider>
        <AppContent />
      </AuthProvider>
  );
}

export default App;