import { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import {CandidateResult, Election, getElectionResults} from '../contexts/api';

interface ResultsModalProps {
  election: Election;
  onClose: () => void;
}

export const ResultsModal = ({election, onClose }: ResultsModalProps) => {
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadResults();
  }, [election.id]);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError('');

      console.log(election);
      const data = await getElectionResults(election.id);

      console.log("DATI DAL API: " , data);
      if (!data || !data.results) {
        setResults([]);
        setTotalVotes(0);
        setTitle('Elezione');
        setDescription('');
        return;
      }

      setTitle(election.title);
      setDescription(election.description);

      const total = data.results.reduce((acc, r) => acc + Number(r.votes), 0);
      setTotalVotes(total);

      const ElectionResults: CandidateResult[] = data.results.map(r => ({
        candidate_id: r.candidate_id,
        candidate_name: r.candidate_name,
        candidate_description: r.candidate_description || '',
        votes: Number(r.votes),
        percentage: total > 0 ? (Number(r.votes) / total) * 100 : 0
      })).sort((a, b) => b.votes - a.votes);

      setResults(ElectionResults);

    } catch (err) {
      console.error('Errore caricamento risultati:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei risultati');
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

          {/* HEADER */}
          <div className="flex flex-col p-6 border-b border-gray-200 flex-none space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
                <h1 className="text-2xl text-gray-900 mb-2">{description}</h1>
                <p className="text-gray-600">
                  Risultati finali - {totalVotes} {totalVotes === 1 ? 'voto' : 'voti'} totali
                </p>
              </div>
              <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* BOX VINCITORE */}
            {winner && totalVotes > 0 && (
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6" />
                    <h3 className="text-xl font-bold">Vincitore</h3>
                  </div>
                  <p className="text-2xl font-bold mb-1">{winner.candidate_name}</p>
                  <p className="text-blue-100">
                    {winner.votes} {winner.votes === 1 ? 'voto' : 'voti'} ({winner.percentage.toFixed(1)}%)
                  </p>
                </div>
            )}
          </div>

          {/* CONTENUTO SCROLLABILE */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {totalVotes === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 text-lg">Nessun voto registrato per questa elezione</p>
                </div>
            ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Tutti i Candidati</h3>
                  {results.map((candidate, index) => (
                      <div key={candidate.candidate_id} className="bg-gray-50 rounded-xl p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 mb-1">{candidate.candidate_name}</h4>
                            <p className="text-gray-600 text-sm mb-3">{candidate.candidate_description}</p>
                            <div className="flex items-center gap-4">
                              <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${candidate.percentage}%` }}
                                />
                              </div>
                              <div className="text-right min-w-[120px]">
                                <p className="text-lg font-bold text-gray-900">
                                  {candidate.votes} {candidate.votes === 1 ? 'voto' : 'voti'}
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
          </div>

          {/* FOOTER */}
          <div className="p-6 border-t border-gray-200 flex-none">
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
