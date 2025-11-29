import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard'; // NUOVO: componente per superadmin
import { ElectionsList } from './components/ElectionsList';
import { VotingModal } from './components/VotingModal';
import { ResultsModal } from './components/ResultsModal';
import { LogOut, Vote, Settings } from 'lucide-react';

function AppContent() {
  const { user, loading, signOut } = useAuth();

  // id per i modal
  const [votingElectionId, setVotingElectionId] = useState<string | null>(null);
  const [resultsElectionId, setResultsElectionId] = useState<string | null>(null);

  // forzare refresh dei figli quando necessario
  const [refreshKey, setRefreshKey] = useState(0);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <header className="bg-white shadow-sm border-b border-gray-200">
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
                    <span className="ml-4 flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  <Settings className="w-4 h-4" />
                  SuperAdmin
                </span>
                ) : isAdmin ? (
                    <span className="ml-4 flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  <Settings className="w-4 h-4" />
                  Admin
                </span>
                ) : null}
              </div>

              <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
              >
                <LogOut className="w-4 h-4" />
                Esci
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isSuperAdmin ? (
              // SuperAdminDashboard: spazio per funzioni globali (es. gestione amministratori, auditing)
              <SuperAdminDashboard
                  onVote={(electionId) => setVotingElectionId(electionId)}
                  onViewResults={(electionId) => setResultsElectionId(electionId)}
                  refreshKey={refreshKey}
              />
          ) : isAdmin ? (
              // AdminDashboard per normali permessi da admin
              <AdminDashboard
                  onVote={(electionId) => setVotingElectionId(electionId)}
                  onViewResults={(electionId) => setResultsElectionId(electionId)}
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
                    onVote={(electionId) => setVotingElectionId(electionId)}
                    onViewResults={(electionId) => setResultsElectionId(electionId)}
                />
              </>
          )}
        </main>

        {votingElectionId && (
            <VotingModal
                electionId={votingElectionId}
                onClose={() => setVotingElectionId(null)}
                onVoteSuccess={() => {
                  setVotingElectionId(null);
                  setRefreshKey(prev => prev + 1);
                }}
            />
        )}

        {resultsElectionId && (
            <ResultsModal
                electionId={resultsElectionId}
                onClose={() => setResultsElectionId(null)}
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
