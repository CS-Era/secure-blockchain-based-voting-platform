import { useState, useEffect } from 'react';
import { ElectionCard } from './ElectionCard';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Election {
  id: string;
  title: string;
  description?: string;
  proposals: string[];
  isOpen: boolean;
  status: 'open' | 'closed' | 'upcoming';
  start_date?: string;
  end_date?: string;
}

interface ElectionsListProps {
  onVote: (electionId: string) => void;
  onViewResults: (electionId: string) => void;
}

export const ElectionsList = ({ onVote, onViewResults }: ElectionsListProps) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'open' | 'voted' | 'closed'>('all');
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    loadFakeElections();
  }, [token]);


  const loadFakeElections = async () => {
    try {
      // Dati fittizi
      const fakeData: Election[] = [
        {
          id: 'election-1',
          title: 'Elezione del Presidente',
          description: 'Elezione per scegliere il nuovo presidente del consiglio studentesco',
          proposals: [
            { name: 'Mario Rossi', description: 'Studente di ingegneria' },
            { name: 'Luigi Bianchi', description: 'Studente di economia' },
          ],
          isOpen: true,
          status: 'open',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 giorni dopo
        },
        {
          id: 'election-2',
          title: 'Elezione Rappresentante Classe',
          description: 'Elezione per il rappresentante della classe 4B',
          proposals: [
            { name: 'Anna Verdi', description: 'Studente di matematica' },
            { name: 'Paolo Neri', description: 'Studente di fisica' },
          ],
          isOpen: false,
          status: 'closed',
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 giorni fa
          end_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 giorni fa
        },
      ];

      // Trasforma i dati se serve (come facevi prima)
      const transformedElections: Election[] = fakeData.map(e => ({
        ...e,
        proposals: e.proposals || [],
      }));

      setElections(transformedElections);

      // Se avevi bisogno di caricare lo stato dei voti, puoi simulare anche quello
      // await loadVotesStatus(transformedElections);

    } catch (error) {
      console.error('Error loading elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadElections = async () => {

    try {
      const response = await fetch(`${API_BASE_URL}/api/elections`, {
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento delle elezioni');
      }

      const data = await response.json();

      // Trasforma i dati dalla blockchain al formato del componente
      const transformedElections: Election[] = data.map((e: Election) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        proposals: e.proposals || [],
        isOpen: e.isOpen,
        status: e.isOpen ? 'open' : 'closed',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      }));

      setElections(transformedElections);

      // Carica lo stato dei voti per ogni elezione
      await loadVotesStatus(transformedElections);
    } catch (error) {
      console.error('Error loading elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVotesStatus = async (electionsData: Election[]) => {
    if (!token) return;

    try {
      const votedIds = new Set<string>();

      for (const election of electionsData) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/has-voted/${election.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.hasVoted) {
              votedIds.add(election.id);
            }
          }
        } catch (error) {
          console.error(`Error checking vote status for ${election.id}:`, error);
        }
      }

      setVotedElectionIds(votedIds);
    } catch (error) {
      console.error('Error loading votes status:', error);
    }
  };

  const getFilteredElections = () => {
    return elections.filter(election => {
      const isOpen = election.status === 'open';
      const isClosed = election.status === 'closed';
      const hasVoted = votedElectionIds.has(election.id);

      if (filter === 'open') return isOpen;
      if (filter === 'voted') return hasVoted;
      if (filter === 'closed') return isClosed;
      return true;
    });
  };

  const filteredElections = getFilteredElections();

  if (loading) {
    return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento elezioni...</p>
          </div>
        </div>
    );
  }

  return (
      <div>
        <div className="flex flex-wrap gap-3 mb-8">
          <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Tutte
          </button>
          <button
              onClick={() => setFilter('open')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'open'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Aperte
          </button>
          <button
              onClick={() => setFilter('voted')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'voted'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Votate
          </button>
          <button
              onClick={() => setFilter('closed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'closed'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Chiuse
          </button>
        </div>

        {filteredElections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">Nessuna elezione trovata</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredElections.map(election => (
                  <ElectionCard
                      key={election.id}
                      election={election}
                      hasVoted={votedElectionIds.has(election.id)}
                      onVote={onVote}
                      onViewResults={onViewResults}
                  />
              ))}
            </div>
        )}
      </div>
  );
};
