import { Vote as VoteIcon, CheckCircle, Clock } from 'lucide-react';
import {Election} from "../api.ts";

interface ElectionCardProps {
  election: Election;
  hasVoted: boolean;
  onVote: (electionId: string) => void;
  onViewResults: (electionId: string) => void;
}

export const ElectionCard = ({ election, hasVoted, onVote, onViewResults }: ElectionCardProps) => {
  const startDate = new Date(election.start_date);
  const endDate = new Date(election.end_date);
  const now = new Date();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOpen = election.status === 'open' && startDate <= now && endDate >= now;
  const isClosed = election.status === 'closed' || endDate < now;
  const isUpcoming = election.status === 'upcoming' || startDate > now;

  const getStatusBadge = () => {
    if (isOpen) {
      return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Aperta</span>;
    }
    if (isClosed) {
      return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Chiusa</span>;
    }
    return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">In arrivo</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex-1">{election.title}</h3>
        {getStatusBadge()}
      </div>

      <p className="text-gray-600 mb-4 leading-relaxed">{election.description}</p>

      <div className="space-y-2 mb-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Inizio: {formatDate(startDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Fine: {formatDate(endDate)}</span>
        </div>
      </div>

      {hasVoted && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Hai già votato</span>
        </div>
      )}

      <div className="flex gap-3">
        {isOpen && !hasVoted && (
          <button
            onClick={() => onVote(election.id)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <VoteIcon className="w-5 h-5" />
            Vota Ora
          </button>
        )}

        {isClosed && (
          <button
            onClick={() => onViewResults(election.id)}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition"
          >
            Vedi Risultati
          </button>
        )}

        {isUpcoming && (
          <button
            disabled
            className="flex-1 bg-gray-200 text-gray-500 font-medium py-3 rounded-lg cursor-not-allowed"
          >
            Disponibile dal {formatDate(startDate)}
          </button>
        )}
      </div>
    </div>
  );
};
