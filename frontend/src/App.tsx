import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { ElectionsList } from './components/ElectionsList';
import { VotingModal } from './components/VotingModal';
import { ResultsModal } from './components/ResultsModal';
import { LogOut, Vote } from 'lucide-react';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [votingElectionId, setVotingElectionId] = useState<string | null>(null);
  const [resultsElectionId, setResultsElectionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
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
    return <AuthForm />;
  }

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
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Le tue Elezioni</h2>
          <p className="text-gray-600">Gestisci le tue votazioni e visualizza i risultati</p>
        </div>

        <ElectionsList
          key={refreshKey}
          onVote={(electionId) => setVotingElectionId(electionId)}
          onViewResults={(electionId) => setResultsElectionId(electionId)}
        />
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
