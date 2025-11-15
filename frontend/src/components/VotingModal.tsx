import { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { supabase, Candidate, Election } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface VotingModalProps {
  electionId: string;
  onClose: () => void;
  onVoteSuccess: () => void;
}

export const VotingModal = ({ electionId, onClose, onVoteSuccess }: VotingModalProps) => {
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadElectionData();
  }, [electionId]);

  const loadElectionData = async () => {
    try {
      const [electionRes, candidatesRes] = await Promise.all([
        supabase.from('elections').select('*').eq('id', electionId).single(),
        supabase.from('candidates').select('*').eq('election_id', electionId).order('name')
      ]);

      if (electionRes.error) throw electionRes.error;
      if (candidatesRes.error) throw candidatesRes.error;

      setElection(electionRes.data);
      setCandidates(candidatesRes.data || []);
    } catch (error) {
      console.error('Error loading election data:', error);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCandidate || !user) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: voteError } = await supabase
        .from('votes')
        .insert([
          {
            election_id: electionId,
            student_id: user.id,
            candidate_id: selectedCandidate
          }
        ]);

      if (voteError) throw voteError;

      onVoteSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting vote:', error);
      setError('Errore durante il salvataggio del voto. Potresti aver già votato.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-8 max-w-3xl w-full my-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{election?.title}</h2>
            <p className="text-gray-600">Seleziona il candidato che vuoi votare</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-8">
          {candidates.map(candidate => (
            <button
              key={candidate.id}
              onClick={() => setSelectedCandidate(candidate.id)}
              className={`w-full p-6 rounded-xl border-2 transition text-left ${
                selectedCandidate === candidate.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedCandidate === candidate.id ? 'bg-blue-600' : 'bg-gray-200'
                }`}>
                  <User className={`w-6 h-6 ${
                    selectedCandidate === candidate.id ? 'text-white' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{candidate.name}</h3>
                  <p className="text-gray-600 leading-relaxed">{candidate.description}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 transition ${
                  selectedCandidate === candidate.id
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}>
                  {selectedCandidate === candidate.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-lg transition"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCandidate || submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Invio in corso...' : 'Conferma Voto'}
          </button>
        </div>
      </div>
    </div>
  );
};