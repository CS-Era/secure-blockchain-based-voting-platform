import { useState, useEffect } from 'react';
import { ElectionCard } from './ElectionCard';
import { useAuth } from '../contexts/AuthContext';
import {Election, getElections} from "../contexts/api.ts";

interface ElectionsListProps {
  onVote: (election: Election) => void;
  onViewResults: (election: Election) => void;
  isAdmin: boolean;
}

export const ElectionsList = ({ onVote, onViewResults, isAdmin }: ElectionsListProps) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'voted' | 'closed' | 'upcoming'>('all');
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    loadElections();
  }, [token]);

  const loadElections = async () => {
    try {
      setLoading(true);

      const { elections } = await getElections();

      const transformedElections: Election[] =
          elections.map(mapElectionFromApi);

      setElections(transformedElections);

    } catch (error) {
      console.error("Error loading elections:", error);
    } finally {
      setLoading(false);
    }
  };

  const mapElectionFromApi = (e: any): Election => {
    const status = getElectionStatus(e.start_date, e.end_date, e.is_active);

    return {
      id: e.id,
      title: e.title,
      description: e.description,
      candidates: e.candidates ?? [],
      is_active: e.is_active,
      status,
      start_date: e.start_date,
      end_date: e.end_date,
      hasVoted: e.hasVoted
    };
  };

  const getElectionStatus = (
      startDate: string,
      endDate: string,
      is_active: boolean
  ): "open" | "closed" | "upcoming" => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now > end || !is_active) return "closed";
    if (now < start) return "upcoming";

    return "open";
  };

  const getFilteredElections = () => {
    return elections.filter(election => {
      const { status, hasVoted } = election;

      if (filter === "open") return status === "open";
      if (filter === "upcoming") return status === "upcoming";
      if (filter === "closed") return status === "closed";
      if (filter === "voted") return hasVoted === true;

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
          <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === 'upcoming'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            In Arrivo
          </button>
        </div>

        {filteredElections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">Nessuna elezione trovata</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredElections.map(election => {
                  return (
                    <ElectionCard
                        key={election.id}
                        election={election}
                        hasVoted={election.hasVoted || false}
                        onVote={onVote}
                        onViewResults={onViewResults}
                        isAdmin={isAdmin}
                    />
                );
              })}
            </div>

        )}
      </div>
  );
};
