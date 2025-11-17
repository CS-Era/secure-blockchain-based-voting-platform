import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CreateElectionForm } from './CreateElectionForm';
import { ElectionsList } from './ElectionsList';

interface AdminDashboardProps {
  onVote: (electionId: string) => void;
  onViewResults: (electionId: string) => void;
  refreshKey: number;
}

export const AdminDashboard = ({ onVote, onViewResults, refreshKey }: AdminDashboardProps) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refresh, setRefresh] = useState(refreshKey);

  const handleElectionCreated = () => {
    setRefresh(prev => prev + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Gestione Elezioni</h2>
          <p className="text-gray-600">Crea e gestisci le elezioni studentesche</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
        >
          <Plus className="w-5 h-5" />
          Nuova Elezione
        </button>
      </div>

      <ElectionsList
        key={refresh}
        onVote={onVote}
        onViewResults={onViewResults}
      />

      {showCreateForm && (
        <CreateElectionForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleElectionCreated}
        />
      )}
    </div>
  );
};