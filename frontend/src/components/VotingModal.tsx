import { useState, useEffect } from 'react';
import { X, User, CheckCircle, AlertTriangle, Copy, FileText, Fingerprint } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Election, vote } from "../contexts/api.ts";

interface VotingModalProps {
  election: Election;
  onClose: () => void;
  onVoteSuccess: () => void;
}

export const VotingModal = ({
                              election,
                              onClose,
                              onVoteSuccess
                            }: VotingModalProps) => {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // NUOVO STATO: Per gestire la ricevuta
  const [receipt, setReceipt] = useState<string | null>(null);
  
  const { user } = useAuth();

  useEffect(() => {
    console.log("🗳️ [VotingModal] Election ricevuta:", election);
  }, [election]);

  const handleSubmit = async () => {
    if (!selectedCandidate || !user) return;

    setSubmitting(true);
    setError('');

    try {
      // Chiamata API
      const response = await vote(election.id, selectedCandidate);

      // MODIFICA: Invece di chiudere, salviamo la ricevuta mostriamo la schermata di successo
      // Assumiamo che response.receipt contenga l'hash (come configurato nel backend)
      setReceipt(response.receipt);
      
    } catch (err) {
      setError(
          err instanceof Error
              ? err.message
              : 'Errore durante il salvataggio del voto. Potresti aver già votato.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Funzione per chiudere definitivamente dopo aver visto la ricevuta
  const handleFinalClose = () => {
    onVoteSuccess(); // Aggiorna la lista elezioni nella dashboard
    onClose();       // Chiude il modale
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiato negli appunti!");
  };

  // ---------------------------------------------------------
  // SCENARIO 1: VOTO COMPLETATO (Mostra Ricevuta)
  // ---------------------------------------------------------
  if (receipt) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full my-8 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            
            {/* Icona Successo */}
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Voto Registrato!</h2>
            <p className="text-gray-600 mb-6 text-sm">
              La tua preferenza è stata anonimizzata e salvata sulla Blockchain.
            </p>

            {/* Warning Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-800 text-sm">IMPORTANTE</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Il sistema <strong>NON può recuperare</strong> questa ricevuta in futuro per garantire il tuo anonimato.
                    Copiala ora se vuoi verificare il voto successivamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Dati Tecnici */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-left space-y-4 mb-8">
              
              {/* ID Elezione */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3 h-3 text-gray-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase">ID Elezione</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="block w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-700 truncate">
                    {election.id}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(election.id)}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition text-gray-600"
                    title="Copia ID"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Hash Ricevuta */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Fingerprint className="w-3 h-3 text-gray-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase">La tua Ricevuta (Hash)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="block w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-mono text-blue-700 break-all">
                    {receipt}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(receipt)}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition text-gray-600"
                    title="Copia Hash"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <button
                onClick={handleFinalClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Ho salvato i dati, Chiudi
            </button>
          </div>
        </div>
    );
  }

  // ---------------------------------------------------------
  // SCENARIO 2: VOTO IN CORSO (Tua UI Originale)
  // ---------------------------------------------------------
  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 max-w-3xl w-full my-8 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{election?.title}</h2>
              <p className="text-gray-600">Seleziona il candidato che vuoi votare</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-100 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm border border-red-100">{error}</div>}

          <div className="space-y-4 mb-8">
            {election.candidates.map(candidate => (
                <button
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate.id)}
                    className={`w-full p-6 rounded-xl border-2 transition text-left group relative overflow-hidden ${
                        selectedCandidate === candidate.id
                            ? 'border-blue-600 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 bg-white hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        selectedCandidate === candidate.id ? 'bg-blue-600' : 'bg-gray-200 group-hover:bg-gray-300'
                    }`}>
                      <User className={`w-6 h-6 ${selectedCandidate === candidate.id ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold mb-1 transition-colors ${
                          selectedCandidate === candidate.id ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {candidate.name}
                      </h3>
                      <p className="text-gray-600 leading-relaxed text-sm">{candidate.description}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 transition flex items-center justify-center ${
                        selectedCandidate === candidate.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400'
                    }`}>
                      {selectedCandidate === candidate.id && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>
                </button>
            ))}
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <button
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3.5 rounded-xl transition"
            >
              Annulla
            </button>
            <button
                onClick={handleSubmit}
                disabled={!selectedCandidate || submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
            >
              {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Invio in corso...
                  </>
              ) : 'Conferma Voto'}
            </button>
          </div>
        </div>
      </div>
  );
};