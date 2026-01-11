'use strict';

// --- 1. IMPORTAZIONI ---

// Carica prima le variabili .env
require('dotenv').config();

// Moduli di Sicurezza e API
const express = require('express');
const jwt = require('jsonwebtoken');       // Per creare e verificare i token di sessione
const bcrypt = require('bcryptjs');      // Per hashing e "salting" delle password
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Moduli Hyperledger Fabric
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');

// Moduli Node.js
const fs = require('fs');
const path = require('path');

const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');
// --- 2. CONFIGURAZIONE E COSTANTI ---

const app = express();

// Carica le variabili da .env
const PORT = process.env.PORT || 3000;
const ORG_ADMIN_USER = process.env.ORG_ADMIN_USER;
const ORG_ADMIN_PASS = process.env.ORG_ADMIN_PASS;
const CA_REGISTRAR_USER = process.env.CA_REGISTRAR_USER;
const CA_REGISTRAR_PASS = process.env.CA_REGISTRAR_PASS;
const DEFAULT_VOTER_PASS = process.env.DEFAULT_VOTER_PASS;
const JWT_SECRET = process.env.JWT_SECRET; // Segreto per firmare i token

// Costanti fabric-network e chaincode
const CHANNEL_NAME = 'votingchannel';
const CONTRACT_NAME = 'votingcc'; // Il nome del tuo chaincode
const MSP_ID = 'Org1MSP';

// Path ai file critici
const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
const walletPath = path.join(__dirname, 'wallet');

// All'inizio del file server, dopo gli import


// Check di sicurezza all'avvio: verifica che le variabili d'ambiente critiche siano caricate
if (!ORG_ADMIN_USER || !ORG_ADMIN_PASS || !CA_REGISTRAR_USER || !CA_REGISTRAR_PASS || !DEFAULT_VOTER_PASS || !JWT_SECRET) {
    console.error('ERRORE CRITICO: Variabili d\'ambiente segrete mancanti.');
    console.error('Assicurati di aver creato e configurato il file .env nella cartella /backend');
    process.exit(1); // Esce se i segreti non sono caricati
}
console.log(`✅ Variabili di environment caricate correttamente`);

// --- 3. MIDDLEWARE DI SICUREZZA ---
const cors = require('cors');

// AGGIUNGI QUESTA CONFIGURAZIONE CORS
app.use(cors({
    origin: 'http://localhost:5173', // URL del tuo frontend Vite
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Permette al server di leggere JSON dal body delle richieste
app.use(express.json());

/**
 * Middleware: Verifica il Token JWT (Autenticazione)
 *
 * Controlla l'header 'Authorization'. Se il token è valido,
 * aggiunge il payload del token (i dati dell'utente) a 'req.user'.
 * Se non è valido, blocca la richiesta.
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (token == null) {
        // 401 Unauthorized (Non autenticato)
        return res.status(401).json({ error: 'Accesso negato: token mancante.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // 403 Forbidden (Autenticato ma token non valido/scaduto)
            return res.status(403).json({ error: 'Token non valido o scaduto.' });
        }

        // Il token è valido. Allega i dati dell'utente alla richiesta
        req.user = user;
        next(); // Prosegui alla funzione dell'endpoint
    });
};

/**
 * Middleware: Verifica Ruolo Admin (Autorizzazione)
 *
 * Controlla che l'utente (allegato da 'verifyToken') abbia il ruolo 'admin'.
 * DA USARE SEMPRE *DOPO* 'verifyToken'.
 */
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        // 403 Forbidden (Non autorizzato a compiere questa azione)
        return res.status(403).json({ error: 'Accesso negato: questa azione richiede privilegi di amministratore.' });
    }
    next();
};

const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Accesso negato: questa azione richiede privilegi di amministratore.' });
    }
    next();
};

const isAdminOrSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato: questa azione richiede privilegi di amministratore.' });
    }
    next();
};
// --- 4. FUNZIONI HELPER (BLOCKCHAIN) ---

/**
 * Iscrive ENTRAMBI gli Admin (Ledger e Registrar) nel wallet all'avvio.
 */
async function enrollAdmins() {
    try {
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(caInfo.url);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // 1. Iscrivi l'admin del LEDGER (org1admin)
        const orgAdminExists = await wallet.get(ORG_ADMIN_USER);
        if (!orgAdminExists) {
            const enrollment = await ca.enroll({ enrollmentID: ORG_ADMIN_USER, enrollmentSecret: ORG_ADMIN_PASS });
            const x509Identity = {
                credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
                mspId: MSP_ID, type: 'X.509',
            };
            await wallet.put(ORG_ADMIN_USER, x509Identity);
            console.log(`✅ Identità ${ORG_ADMIN_USER} (Ledger Admin) iscritta e salvata nel wallet`);
        } else {
            console.log(`✅ Identità ${ORG_ADMIN_USER} (Ledger Admin) già presente nel wallet`);
        }

        // 2. Iscrivi l'admin della CA (Registrar)
        const caRegistrarExists = await wallet.get(CA_REGISTRAR_USER);
        if (!caRegistrarExists) {
            const enrollment = await ca.enroll({ enrollmentID: CA_REGISTRAR_USER, enrollmentSecret: CA_REGISTRAR_PASS });
            const x509Identity = {
                credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
                mspId: MSP_ID, type: 'X.509',
            };
            await wallet.put(CA_REGISTRAR_USER, x509Identity);
            console.log(`✅ Identità ${CA_REGISTRAR_USER} (CA Registrar) iscritta e salvata nel wallet`);
        } else {
            console.log(`✅ Identità ${CA_REGISTRAR_USER} (CA Registrar) già presente nel wallet`);
        }

    } catch (error) {
        console.error(`ERRORE CRITICO nell'iscrizione degli Admin. Controlla la rete Fabric: ${error}`);
        process.exit(1);
    }
}

/**
 * Connette al gateway Fabric usando una specifica identità dal wallet.
 */
async function connectToGateway(identityName) {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get(identityName);
    if (!identity) {
        throw new Error(`Identità '${identityName}' non trovata nel wallet locale. Assicurati che l'utente sia stato registrato.`);
    }

    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: identityName,
        discovery: { enabled: true, asLocalhost: true }
    });

    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CONTRACT_NAME);
    return { gateway, contract };
}

// --- 1. ENDPOINT DELL'API ACCESSO ---
/**
 * [PROTETTO: SUPERADMIN] Crea un nuovo utente (studente, admin o super_admin) nel DB
 * NOTA: Solo super_admin può creare altri admin o super_admin
 */
app.post(
    "/api/superadmin/create-user",
    verifyToken,
    isSuperAdmin,
    async (req, res) => {

        try {
            const { matricola, password, role, fullName } = req.body;

            // 1️⃣ Validazione input
            if (!matricola || !password || !role || !fullName) {
                return res.status(400).json({
                    error: "Matricola, password, nome completo e ruolo richiesti",
                });
            }

            if (!["student", "admin", "super_admin"].includes(role)) {
                return res.status(400).json({
                    error: 'Ruolo non valido. Usare "student", "admin" o "super_admin".',
                });
            }

            // 2️⃣ Controllo ruolo (ridondante ma sicuro)
            if (req.user.role !== "super_admin") {
                return res.status(403).json({
                    error: "Solo i super admin possono creare un nuovo elettore!",
                });
            }

            // 3️⃣ Controllo ESISTENZA matricola (PRIMA dell’insert)
            const existingUser = await db.query(
                "SELECT id FROM users WHERE matricola = $1",
                [matricola]
            );

            if (existingUser.rowCount > 0) {
                return res.status(409).json({
                    error: "Matricola già presente nel sistema",
                });
            }

            // 4️⃣ Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // 5️⃣ Transazione
            await db.query("BEGIN");

            const insert = await db.query(
                `INSERT INTO users (matricola, password_hash, full_name, role)
         VALUES ($1,$2,$3,$4)
         RETURNING id, matricola, full_name, role`,
                [matricola, passwordHash, fullName, role]
            );

            /*
            try {
              await registerVoterOnBlockchain(matricola);
            } catch (bcErr) {
              await client.query("ROLLBACK");
              return res.status(500).json({
                error: "Registrazione blockchain fallita — operazione annullata",
              });
            }
            */

            await db.query("COMMIT");

            return res.status(201).json({
                message: "Utente creato con successo"
            });
        } catch (error) {
            await db.query("ROLLBACK").catch(() => {});

            // 6️⃣ Gestione errori Postgres (fallback)
            if (error.code === "23505") {
                return res.status(409).json({
                    error: "Matricola già esistente",
                });
            }

            console.error("Errore in /api/superadmin/create-user:", error);
            return res.status(500).json({
                error: "Errore interno del server",
            });
        }
    }
);

/**
 * [PUBBLICO] Login
 */
app.post('/api/login', async (req, res) => {
    try {
        const { matricola, password } = req.body;
        if (!matricola || !password) {
            return res.status(400).json({ error: 'Matricola e password richiesti' });
        }

        const result = await db.query('SELECT * FROM users WHERE matricola = $1', [matricola]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const payload = {
            id: user.id,
            matricola: user.matricola,
            role: user.role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10h' });

        res.json({
            message: 'Login effettuato con successo',
            token,
            role: user.role,
            id: user.id,
            matricola: user.matricola
        });

    } catch (error) {
        console.error("Errore in /api/login:", error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});


// --- 2. ENDPOINT DELL'API ELEZIONE ---
/**
 * [PRIVATO] Ottieni tutti gli studenti
 */
app.get('/api/students', verifyToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, matricola, full_name FROM users WHERE role = $1 and state = true',
            ['student']
        );

        res.json({
            count: result.rows.length,
            students: result.rows
        });

    } catch (error) {
        console.error("Errore in GET /api/students:", error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

/**
 * [PROTETTO: TUTTI] Ritorna lista di tutte le elezioni
 */
app.get('/api/elections', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            `
                SELECT
                    e.*,
                    EXISTS (
                        SELECT 1
                        FROM votes v
                        WHERE v.election_id = e.id
                          AND v.user_id = $1
                    ) AS "hasVoted"
                FROM elections e
                ORDER BY e.start_date DESC
            `,
            [userId]
        );

        res.json({
            count: result.rows.length,
            elections: result.rows
        });

    } catch (error) {
        console.error("Errore in /api/elections:", error);
        res.status(500).json({ error: error.toString() });
    }
});

/**
 * [PROTETTO: ADMIN] Crea una nuova elezione
 */
app.post('/api/create-election', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const { title, description, start_date, end_date, candidates } = req.body;

        // --- VALIDAZIONE ---
        if (!title || typeof title !== 'string' || title.length > 255) {
            return res.status(400).json({ error: 'Titolo non valido' });
        }
        if (!description || typeof description !== 'string') {
            return res.status(400).json({ error: 'Descrizione non valida' });
        }
        if (!start_date || !end_date || isNaN(Date.parse(start_date)) || isNaN(Date.parse(end_date))) {
            return res.status(400).json({ error: 'Date non valide' });
        }
        if (new Date(start_date) >= new Date(end_date)) {
            return res.status(400).json({ error: 'La data di inizio deve essere prima della fine' });
        }
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ error: 'Deve esserci almeno un candidato' });
        }
        for (const c of candidates) {
            if (!c.name || !c.description) {
                return res.status(400).json({ error: 'Ogni candidato deve avere nome e descrizione' });
            }
        }

        // --- CREAZIONE ID ELEZIONE ---
        const electionId = `ELEC-${uuidv4()}`;

        // --- HASH dei dati per blockchain ---
        const electionData = JSON.stringify({ title, description, start_date, end_date, candidates });
        const electionHash = crypto.createHash('sha256').update(electionData).digest('hex');

        // --- TRANSAZIONE BLOCKCHAIN ---
        //const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
        //await contract.submitTransaction('CreateElection', electionId, electionHash);
        //gateway.disconnect();

        // --- TRANSAZIONE DB ---
        await db.query('BEGIN');
        const candidatesJSON = JSON.stringify(candidates);
        const dbResult = await db.query(`
            INSERT INTO elections (id, title, description, candidates, blockchain_hash, start_date, end_date, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [electionId, title, description, candidatesJSON, electionHash, start_date, end_date, req.user.id]);
        await db.query('COMMIT');

        res.status(201).json({
            message: `Elezione "${title}" creata con successo`,
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Errore in /api/create-election:", error);
        res.status(500).json({ error: error.message || 'Errore interno del server' });
    }
});

/**
 * [PROTETTO: ADMIN] Aggiorna lo stato di un'elezione (aperta/chiusa)
 */
app.post('/api/elections/:id/close', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const electionId = req.params.id;

        // --- Recupera tutti i voti ---
        const votesRes = await db.query(`SELECT vote_hash, candidate_id FROM votes WHERE election_id=$1`, [electionId]);

        // --- Genera Merkle Tree ---
        const voteHashes = votesRes.rows.map(v => v.vote_hash);
        const leaves = voteHashes.map(vh => Buffer.from(vh, 'hex'));
        const tree = new MerkleTree(leaves, SHA256);
        const merkleRoot = tree.getRoot().toString('hex');

        // --- Calcolo risultati per candidato ---
        const resultsMap = {};
        votesRes.rows.forEach(v => {
            resultsMap[v.candidate_id] = (resultsMap[v.candidate_id] || 0) + 1;
        });
        const resultsArray = Object.entries(resultsMap).map(([candidate_id, votes]) => ({ candidate_id, votes }));
        const resultsJSON = JSON.stringify(resultsArray);
        const resultsHash = crypto.createHash('sha256').update(resultsJSON).digest('hex');

        // --- Salvataggio hash sulla blockchain ---
        //const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
        //await contract.submitTransaction('CloseElection', electionId, merkleRoot, resultsHash);
        //gateway.disconnect();

        // --- Aggiornamento DB ---
        await db.query('BEGIN');
        await db.query(`
            UPDATE elections
            SET is_active=false, merkle_root=$1, results_hash=$2
            WHERE id=$3
        `, [merkleRoot, resultsHash, electionId]);
        await db.query('COMMIT');

        res.status(200).json({
            message: 'Elezione chiusa con successo',
            results: resultsArray
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Errore in /api/elections/:id/close:", error);
        res.status(500).json({ error: error.message || 'Errore interno' });
    }
});

/**
 * [PROTETTO] Recupera i risultati di un'elezione dalla blockchain
 */
app.get('/api/elections/:id/results', verifyToken, async (req, res) => {
    try {
        const electionId = req.params.id;

        const votesRes = await db.query(
            `
                SELECT
                    (c->>'id')::int AS candidate_id,
                    c->>'name' AS candidate_name,
                    c->>'description' AS candidate_description,
                    COUNT(v.candidate_id) AS votes
                FROM elections e
                    JOIN LATERAL jsonb_array_elements(e.candidates) AS c ON TRUE
                    LEFT JOIN votes v
                    ON v.candidate_id = (c->>'id')::int
                    AND v.election_id = e.id
                WHERE e.id = $1
                GROUP BY c
                ORDER BY votes DESC;
            `,
            [electionId]
        );

        const results = votesRes.rows.map(row => ({
            candidate_id: row.candidate_id,
            candidate_name: row.candidate_name,
            candidate_description: row.candidate_description,
            votes: row.votes
        }));

        res.status(200).json({ electionId, results });

    } catch (error) {
        console.error("Errore in /api/elections/:id/results:", error);
        res.status(500).json({ error: error.message || 'Errore interno' });
    }
});


// --- 3. ENDPOINT DELL'API VOTAZIONE ---
/**
 * [PROTETTO] Verifica se lo studente può votare in un'elezione
 */
app.get('/api/elections/:id/can-vote', verifyToken, async (req, res) => {
    try {
        const electionId = req.params.id;
        const studentId = req.user.id;

        // Controlla esistenza e stato elezione nel DB
        const election = await db.query(
            'SELECT * FROM elections WHERE id=$1 AND is_active=true',
            [electionId]
        );
        if (!election.rows.length) {
            return res.status(400).json({ canVote: false, message: 'Elezione non attiva o inesistente' });
        }

    // Controlla se lo studente ha già votato
        const rel = await db.query(
            'SELECT 1 FROM votes WHERE user_id=$1 AND election_id=$2',
            [studentId, electionId]
        );

        const hasVoted = rel.rows.length > 0;

        res.json({
            canVote: !hasVoted,
            hasVoted,
            message: hasVoted ? 'Hai già votato' : 'Puoi votare'
        });


    } catch (error) {
        console.error("Errore in /api/elections/:id/can-vote:", error);
        res.status(500).json({ error: error.toString() });
    }
});

/**
 * [PROTETTO] Vota per un candidato
 */
app.post('/api/elections/:id/vote', verifyToken, async (req, res) => {
    try {
        const electionId = req.params.id;
        const { candidateId } = req.body;
        const userId = req.user.id;

        if (!candidateId) {
            return res.status(400).json({ error: 'CandidateId mancante' });
        }

        // --- Controllo se elezione esiste e attiva ---
        const electionRes = await db.query(`
            SELECT * FROM elections WHERE id=$1
        `, [electionId]);
        if (electionRes.rows.length === 0) return res.status(404).json({ error: 'Elezione non trovata' });

        const election = electionRes.rows[0];
        const now = new Date();
        if (now < new Date(election.start_date) || now > new Date(election.end_date)) {
            return res.status(400).json({ error: 'Elezione non attiva' });
        }

        // --- Controllo se utente ha già votato ---
        const voteCheck = await db.query(`
            SELECT * FROM votes WHERE election_id=$1 AND user_id=$2
        `, [electionId, userId]);
        if (voteCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Hai già votato' });
        }

        // --- Preparazione voto ---
        const voteData = JSON.stringify({ electionId, candidateId, userId });
        const voteHash = crypto.createHash('sha256').update(voteData).digest('hex');

        // --- Salvataggio blockchain ---
        //const { gateway, contract } = await connectToGateway(ORG_USER);
        //await contract.submitTransaction('CastVote', electionId, voteHash);
        //gateway.disconnect();

        // --- Salvataggio DB ---
        await db.query('BEGIN');
        await db.query(`
            INSERT INTO votes (election_id, user_id, candidate_id, vote_hash)
            VALUES ($1,$2,$3,$4)
        `, [electionId, userId, candidateId, voteHash]);
        await db.query('COMMIT');

        res.status(201).json({ message: 'Voto registrato con successo' });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Errore in /api/elections/:id/vote:", error);
        res.status(500).json({ error: error.message || 'Errore interno' });
    }
});










// FUORI USO
/**
 * Crea l'identità di un elettore sulla blockchain (CA + Ledger).
 * Questa funzione è chiamata internamente da /api/admin/create-user.
 */
async function registerVoterOnBlockchain(voterID) {
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Controlla se è già nel wallet locale (non dovrebbe succedere se il DB è allineato)
    const voterExists = await wallet.get(voterID);
    if (voterExists) {
        throw new Error(`L'elettore ${voterID} è già nel wallet locale.`);
    }

    // 1. Contatta la CA (come Registrar) per registrare l'identità
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const ca = new FabricCAServices(ccp.certificateAuthorities['ca.org1.example.com'].url);
    const registrarIdentity = await wallet.get(CA_REGISTRAR_USER);
    if (!registrarIdentity) {
        throw new Error(`Identità Registrar (${CA_REGISTRAR_USER}) non trovata. Riavvia il server.`);
    }
    const provider = wallet.getProviderRegistry().getProvider(registrarIdentity.type);
    const registrarUser = await provider.getUserContext(registrarIdentity, CA_REGISTRAR_USER);

    await ca.register({
        affiliation: 'org1.department1',
        enrollmentID: voterID,
        enrollmentSecret: DEFAULT_VOTER_PASS, // Usa la password di default dal .env
        role: 'client',
        attrs: [
            { name: 'role', value: 'voter', ecert: true },
            { name: 'voterID', value: voterID, ecert: true }
        ]
    }, registrarUser);

    // 2. Iscrivi (enroll) l'elettore per ottenere il suo certificato e salvarlo nel wallet
    const enrollment = await ca.enroll({ enrollmentID: voterID, enrollmentSecret: DEFAULT_VOTER_PASS });
    const x509Identity = {
        credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
        mspId: MSP_ID, type: 'X.509',
    };
    await wallet.put(voterID, x509Identity);

    // 3. Chiama il chaincode (come Ledger Admin) per registrare l'elettore sul Ledger
    const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
    try {
        console.log(`Sto registrando ${voterID} sul ledger...`);
        await contract.submitTransaction('RegisterVoter', voterID);
    } finally {
        gateway.disconnect();
    }

    return `Elettore ${voterID} registrato con successo (CA, Wallet, Ledger).`;
}

function parseBooleanResult(buf) {
    if (!buf) return false;
    const s = buf.toString();
    // prova a fare JSON.parse (gestisce true/false booleani e stringhe "true"/"false")
    try {
        const parsed = JSON.parse(s);
        if (typeof parsed === 'boolean') return parsed;
        if (typeof parsed === 'string') return parsed === 'true' || parsed === '1';
    } catch (e) {
        // JSON.parse ha fallito: valuta come stringa semplice
        return s === 'true' || s === '1';
    }
    return false;
}

async function isVoterOnLedger(matricola) {
    if (!matricola) throw new Error('matricola richiesta');

    // opzionale: verifica wallet locale (solo per debug)
    try {
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const id = await wallet.get(ORG_ADMIN_USER);
        if (!id) {
            // non throw qui: preferisco lasciare che connectToGateway fallisca con più info
            console.warn(`Attenzione: identità ${ORG_ADMIN_USER} non trovata nel wallet ${walletPath}`);
        }
    } catch (e) {
        console.warn('Impossibile accedere al wallet locale:', e.message || e);
    }

    const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
    try {
        // Primary: funzione che ritorna boolean (IsVoterRegistered)
        try {
            const ledgerResult = await contract.evaluateTransaction('IsVoterRegistered', matricola);
            return parseBooleanResult(ledgerResult);
        } catch (errA) {
            // Se IsVoterRegistered non esiste o fallisce, fallback a ReadVoter (che ritorna dati)
            try {
                const readRes = await contract.evaluateTransaction('ReadVoter', matricola);
                // se ReadVoter restituisce un buffer non vuoto => esiste
                if (!readRes) return false;
                const s = readRes.toString();
                return s.length > 0;
            } catch (errB) {
                // entrambe le strade fallite: rilancia l'errore originale per debugging
                const e = new Error(`Errore verificando ledger: ${errA.message || errA}`);
                e.cause = errA;
                throw e;
            }
        }
    } finally {
        try { gateway.disconnect(); } catch (e) { /* ignore */ }
    }
}



// --- 6. AVVIO SERVER ---

app.listen(PORT, async () => {
    console.log(`🚀 Server API in ascolto su http://localhost:${PORT}`);
    
    // All'avvio, assicurati che il wallet abbia le identità admin
    // Questo è FONDAMENTALE per far funzionare il server.
    await enrollAdmins();
});