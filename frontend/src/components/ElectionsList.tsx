import { useState, useEffect } from 'react';
import { supabase, Election } from '../lib/supabase';
import { ElectionCard } from './ElectionCard';
import { useAuth } from '../contexts/AuthContext';

interface ElectionsListProps {
  onVote: (electionId: string) => void;
  onViewResults: (electionId: string) => void;
}

export const ElectionsList = ({ onVote, onViewResults }: ElectionsListProps) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'open' | 'voted' | 'closed'>('all');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadElections();
    loadVotes();
  }, [user]);

  const loadElections = async () => {
    try {
      const { data, error } = await supabase
        .from('elections')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setElections(data || []);
    } catch (error) {
      console.error('Error loading elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('election_id')
        .eq('student_id', user.id);

      if (error) throw error;

      const votedIds = new Set(data?.map(v => v.election_id) || []);
      setVotedElectionIds(votedIds);
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  };

  const getFilteredElections = () => {
    const now = new Date();

    return elections.filter(election => {
      const isOpen = election.status === 'open' &&
                     new Date(election.start_date) <= now &&
                     new Date(election.end_date) >= now;
      const isClosed = election.status === 'closed' || new Date(election.end_date) < now;
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