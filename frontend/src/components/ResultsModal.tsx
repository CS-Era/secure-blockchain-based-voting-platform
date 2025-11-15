import { useState, useEffect } from 'react';
import { X, User, TrendingUp } from 'lucide-react';
import { supabase, Candidate, Election } from '../lib/supabase';

interface VoteCount {
  candidate_id: string;
  count: number;
}

interface CandidateResult extends Candidate {
  voteCount: number;
  percentage: number;
}

interface ResultsModalProps {
  electionId: string;
  onClose: () => void;
}

export const ResultsModal = ({ electionId, onClose }: ResultsModalProps) => {
  const [election, setElection] = useState<Election | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [electionId]);

  const loadResults = async () => {
    try {
      const [electionRes, candidatesRes, votesRes] = await Promise.all([
        supabase.from('elections').select('*').eq('id', electionId).single(),
        supabase.from('candidates').select('*').eq('election_id', electionId),
        supabase.from('votes').select('candidate_id').eq('election_id', electionId)
      ]);

      if (electionRes.error) throw electionRes.error;
      if (candidatesRes.error) throw candidatesRes.error;
      if (votesRes.error) throw votesRes.error;

      setElection(electionRes.data);

      const voteCounts = new Map<string, number>();
      votesRes.data.forEach(vote => {
        voteCounts.set(vote.candidate_id, (voteCounts.get(vote.candidate_id) || 0) + 1);
      });

      const total = votesRes.data.length;
      setTotalVotes(total);

      const candidateResults: CandidateResult[] = (candidatesRes.data || []).map(candidate => {
        const voteCount = voteCounts.get(candidate.id) || 0;
        const percentage = total > 0 ? (voteCount / total) * 100 : 0;
        return {
          ...candidate,
          voteCount,
          percentage
        };
      }).sort((a, b) => b.voteCount - a.voteCount);

      setResults(candidateResults);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-8 max-w-3xl w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento risultati...</p>
          </div>
        </div>
      </div>
    );
  }

  const winner = results.length > 0 ? results[0] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-8 max-w-3xl w-full my-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{election?.title}</h2>
            <p className="text-gray-600">Risultati finali - {totalVotes} {totalVotes === 1 ? 'voto' : 'voti'} totali</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {winner && totalVotes > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 mb-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6" />
              <h3 className="text-xl font-bold">Vincitore</h3>
            </div>
            <p className="text-2xl font-bold mb-1">{winner.name}</p>
            <p className="text-blue-100">{winner.voteCount} {winner.voteCount === 1 ? 'voto' : 'voti'} ({winner.percentage.toFixed(1)}%)</p>
          </div>
        )}

        {totalVotes === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Nessun voto registrato per questa elezione</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tutti i Candidati</h3>
            {results.map((candidate, index) => (
              <div key={candidate.id} className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-1">{candidate.name}</h4>
                    <p className="text-gray-600 text-sm mb-3">{candidate.description}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${candidate.percentage}%` }}
                        />
                      </div>
                      <div className="text-right min-w-[120px]">
                        <p className="text-lg font-bold text-gray-900">
                          {candidate.voteCount} {candidate.voteCount === 1 ? 'voto' : 'voti'}
                        </p>
                        <p className="text-sm text-gray-600">{candidate.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-lg transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};