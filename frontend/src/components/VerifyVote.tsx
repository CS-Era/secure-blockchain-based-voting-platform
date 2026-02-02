import { useState, useEffect } from 'react';
import { verifyVote } from '../contexts/api'; 
import SHA256 from 'crypto-js/sha256';

interface VerifyVoteProps {
    initialElectionId?: string;
    initialVoteHash?: string;
}

export const VerifyVote = ({ initialElectionId = '', initialVoteHash = '' }: VerifyVoteProps) => {
    const [electionId, setElectionId] = useState(initialElectionId);
    const [myHash, setMyHash] = useState(initialVoteHash);
    
    useEffect(() => {
        setElectionId(initialElectionId);
        setMyHash(initialVoteHash);
    }, [initialElectionId, initialVoteHash]);

    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'warning'>('idle');
    const [message, setMessage] = useState('');
    const [details, setDetails] = useState<any>(null);

    const handleVerify = async () => {
        if(!electionId || !myHash) return;
        
        try {
            setStatus('idle');
            setMessage("Verifica in corso...");
            
            // 1. Ottieni la prova dal server
            const data = await verifyVote(electionId, myHash);
            setDetails(data);

            // 2. VERIFICA MANUALE (Per evitare conflitti di libreria Buffer/CryptoJS)
            // L'idea è: Partiamo dalla nostra foglia e risaliamo l'albero usando la proof.
            
            // a. Calcola l'hash della foglia (esattamente come nel server)
            let computedHash = SHA256(myHash).toString();

            // b. Itera sulla proof
            for (const item of data.proof) {
                const proofElement = item.data; // Hex string dal server

                // Se l'elemento di prova è a sinistra, hash(proof + computed)
                // Se è a destra, hash(computed + proof)
                const pair = item.position === 'left' 
                    ? proofElement + computedHash 
                    : computedHash + proofElement;
                
                computedHash = SHA256(pair).toString();
            }

            // c. Il risultato finale deve essere la Root
            const isMathValid = computedHash === data.dbMerkleRoot;

            // 3. Verifica Blockchain
            const isChainValid = data.dbMerkleRoot === data.onChainMerkleRoot;

            if (isMathValid && isChainValid) {
                setStatus('success');
                setMessage(`✅ Voto verificato! La prova matematica conferma che il voto è incluso nella Blockchain.`);
            } else if (isMathValid && !isChainValid) {
                setStatus('warning');
                setMessage(`⚠️ ATTENZIONE: Il voto è presente nel Database, ma la Blockchain ha una Root diversa!`);
            } else {
                setStatus('error');
                setMessage("❌ ERRORE MATEMATICO: Impossibile ricostruire la Root con questa prova.");
            }

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setMessage(err.response?.data?.error || "Voto non trovato o errore server.");
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 mt-6 md:mt-0">
                         <h3 className="text-xl font-bold mb-4 text-gray-800">Verifica Integrità Voto</h3>
            <p className="text-sm text-gray-600 mb-4">
                Verifica che la tua ricevuta (VoteHash) sia inclusa crittograficamente nell'albero di Merkle salvato su Blockchain.
            </p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Elezione</label>
                    <input 
                        value={electionId}
                        onChange={e => setElectionId(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                        placeholder="ELEC-..."
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ricevuta (Vote Hash)</label>
                    <input 
                        value={myHash}
                        onChange={e => setMyHash(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-blue-500"
                        placeholder="Incolla l'hash ricevuto..."
                    />
                </div>

                <button 
                    onClick={handleVerify}
                    className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-medium transition"
                >
                    Verifica Ora
                </button>
                
                {status !== 'idle' && (
                    <div className={`p-4 rounded-lg border text-sm animate-in fade-in slide-in-from-top-2 ${
                        status === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                        status === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                        'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        <p className="font-bold mb-2">{message}</p>
                        
                        {details && (
                            <div className="mt-2 pt-2 border-t border-black/10 text-xs font-mono break-all opacity-90 space-y-1">
                                <div className="flex justify-between">
                                    <span>DB Root:</span>
                                    <span className="text-gray-600">{details.dbMerkleRoot.substring(0, 15)}...</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span>Chain Root:</span>
                                    <span>{details.onChainMerkleRoot ? details.onChainMerkleRoot.substring(0, 15) + '...' : 'N/A'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};