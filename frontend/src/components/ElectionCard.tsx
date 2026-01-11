import {Vote as VoteIcon, CheckCircle, Clock} from 'lucide-react';
import {closeElection, Election} from "../contexts/api.ts";
import {useState} from "react";

interface ElectionCardProps {
  election: Election;
  hasVoted: boolean;
  onVote: (election: Election) => void;
  onViewResults: (election: Election) => void;
  isAdmin: boolean;
}

export const ElectionCard = ({election, hasVoted, onVote, onViewResults, isAdmin}: ElectionCardProps) => {
  const [closing, setClosing] = useState(false);

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

  const isOpen =  startDate <= now && endDate >= now && election.is_active;
  const isClosed = endDate < now || !election.is_active;
  const isUpcoming = startDate > now;

  const getStatusBadge = () => {
    if (isOpen) {
      return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Aperta</span>;
    }
    if (isClosed) {
      return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Chiusa</span>;
    }
    return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">In arrivo</span>;
  };

  const handleCloseElection = async () => {
    if (!confirm("Sei sicuro di voler chiudere questa elezione?")) return;
    try {
      setClosing(true);
      const res = await closeElection(election.id);
      alert(res.message); // messaggio di conferma
      window.location.reload(); // oppure aggiorna lo stato nel parent
    } catch (err) {
      console.error(err);
      alert("Errore durante la chiusura dell'elezione.");
    } finally {
      setClosing(false);
    }
  };
  return (
      <div
          className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 border border-gray-100 flex flex-col h-full">
        {/* Titolo e descrizione */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex-1">{election.title}</h3>
            {getStatusBadge()}
          </div>

          <p className="text-gray-600 mb-4 leading-relaxed">{election.description}</p>

          <div className="space-y-2 mb-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4"/>
              <span>Inizio: {formatDate(startDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4"/>
              <span>Fine: {formatDate(endDate)}</span>
            </div>
          </div>

          {hasVoted && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4"/>
                <span>Hai già votato</span>
              </div>
          )}
        </div>

        {/* Bottoni principali (Vota / Risultati / In arrivo) */}
        <div className="flex gap-3 mt-4">
          {isOpen && !hasVoted && (
              <button
                  onClick={() => onVote(election)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <VoteIcon className="w-5 h-5"/>
                Vota Ora
              </button>
          )}

          {isClosed && (
              <button
                  onClick={() => {
                    if (election.is_active) {
                      alert("Risultati non ancora disponibili");
                    } else {
                      onViewResults(election);
                    }
                  }}
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

        {/* Bottone superadmin allineato al bottom */}
        <div className="flex gap-3 mt-4">
          {isAdmin && election.is_active && (
              <button
                  onClick={handleCloseElection}
                  disabled={closing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {closing ? "Chiusura..." : "Chiudi Elezione"}
              </button>
          )}
        </div>

      </div>
  );
};
