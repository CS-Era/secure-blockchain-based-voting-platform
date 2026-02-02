import { useState, useEffect } from 'react';
import { verifyVote } from '../contexts/api'; 
import SHA256 from 'crypto-js/sha256';
import encHex from 'crypto-js/enc-hex';

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
        // 1. PULIZIA INPUT
        // Rimuoviamo spazi e caratteri illegali (come la 'L' accidentale)
        let cleanHash = myHash.trim();
        // Fix automatico comune: se inizia con L per errore di copia, rimuoviamola
        if (cleanHash.startsWith('L') && cleanHash.length > 64) {
             cleanHash = cleanHash.substring(1);
        }
        
        const cleanElectionId = electionId.trim();

        if(!cleanElectionId || !cleanHash) {
            setStatus('error');
            setMessage("Inserisci ID Elezione e Vote Hash.");
            return;
        }

        // Check formato Hex
        const isHex = /^[0-9a-fA-F]+$/.test(cleanHash);
        if (!isHex) {
            setStatus('error');
            setMessage("❌ Il formato dell'hash non è valido (contiene caratteri non esadecimali).");
            return;
        }
        
        try {
            setStatus('idle');
            setMessage("Verifica in corso...");
            
            // 2. RECUPERO PROOF DAL SERVER
            const data = await verifyVote(cleanElectionId, cleanHash);
            setDetails(data);

            console.log("--- DEBUG VERIFICA ---");
            console.log("Vote Hash (Input):", cleanHash);
            
            // 3. CALCOLO DELLA FOGLIA (LEAF)
            // IMPORTANTE: Il server costruisce l'albero su SHA256(voteHash), non su voteHash puro.
            // Dobbiamo fare l'hash dell'input per ottenere la foglia di partenza.
            const leaf = SHA256(cleanHash).toString(encHex);
            console.log("Leaf calcolata:", leaf);

            // 4. RISALITA DELL'ALBERO (VERIFICA MATEMATICA)
            let computedRoot = leaf;

            for (const item of data.proof) {
                const proofElementHex = item.data; 
                
                // Convertiamo le stringhe Hex in Byte Reali (WordArrays) per concatenazione corretta
                const computedBytes = encHex.parse(computedRoot);
                const proofBytes = encHex.parse(proofElementHex);

                let combinedBytes;
                
                // Concatenazione byte-to-byte (come fa merkletreejs sul server)
                if (item.position === 'left') {
                    combinedBytes = proofBytes.concat(computedBytes);
                } else {
                    combinedBytes = computedBytes.concat(proofBytes);
                }
                
                // Hash del risultato combinato
                computedRoot = SHA256(combinedBytes).toString(encHex);
            }

            console.log("Root Calcolata:", computedRoot);
            console.log("Root Attesa (DB):", data.dbMerkleRoot);

            // 5. CONFRONTO FINALE
            const isMathValid = computedRoot === data.dbMerkleRoot;
            const isChainValid = data.dbMerkleRoot === data.onChainMerkleRoot;

            if (isMathValid && isChainValid) {
                setStatus('success');
                setMessage(`✅ Voto verificato! La prova matematica conferma l'inclusione nella Blockchain.`);
            } else if (isMathValid && !isChainValid) {
                setStatus('warning');
                setMessage(`⚠️ ATTENZIONE: Matematica OK, ma la Root su Blockchain è diversa (Possibile elezione non chiusa o manomissione).`);
            } else {
                setStatus('error');
                setMessage("❌ ERRORE MATEMATICO: La prova fornita non porta alla Root del server.");
            }

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setMessage(err.response?.data?.error || "Errore: Voto non trovato o server non raggiungibile.");
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 mt-6 md:mt-0 max-h-[90vh] overflow-y-auto">
             <h3 className="text-xl font-bold mb-4 text-gray-800">Verifica Integrità Voto</h3>
            <p className="text-sm text-gray-600 mb-4">
                Inserisci i dati della tua ricevuta per verificare l'inclusione nell'albero di Merkle.
            </p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Elezione</label>
                    <input 
                        value={electionId}
                        onChange={e => setElectionId(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 font-mono text-xs"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ricevuta (Vote Hash)</label>
                    <textarea 
                        value={myHash}
                        onChange={e => setMyHash(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-purple-500 h-20 break-all"
                        placeholder="Incolla l'hash ricevuto..."
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Assicurati di non incollare spazi extra.</p>
                </div>

                <button 
                    onClick={handleVerify}
                    className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 font-medium transition"
                >
                    Verifica Ora
                </button>
                
                {status !== 'idle' && (
                    <div className={`p-4 rounded-lg border text-sm mt-4 ${
                        status === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                        status === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                        'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        <p className="font-bold mb-2">{message}</p>
                        

                    </div>
                )}
            </div>
        </div>
    );
};