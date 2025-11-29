'use strict';

// --- 1. IMPORTAZIONI ---

// Carica prima le variabili .env
require('dotenv').config();

// Moduli di Sicurezza e API
const express = require('express');
const jwt = require('jsonwebtoken');       // Per creare e verificare i token di sessione
const bcrypt = require('bcryptjs');      // Per hashing e "salting" delle password
const db = require('./db');               

// Moduli Hyperledger Fabric
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');

// Moduli Node.js
const fs = require('fs');
const path = require('path');

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


// --- 5. ENDPOINT DELL'API ---

// --- API PROTETTE (Amministrazione) ---
// ====================================
// API PUBBLICHE (Autenticazione)
// ====================================

/**
 * [PUBBLICO] Registrazione nuovo utente
 */
app.post('/api/register', async (req, res) => {
    try {
        const { matricola, password, fullName } = req.body;

        if (!matricola || !password || !fullName) {
            return res.status(400).json({ error: 'Matricola, password e nome completo richiesti' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Inserisci nel DB
        const result = await db.query(
            'INSERT INTO users (matricola, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, matricola, role',
            [matricola, passwordHash, fullName, 'student']
        );

        // Registra sulla blockchain
        await registerVoterOnBlockchain(matricola);

        // Genera token JWT
        const payload = {
            id: result.rows[0].id,
            matricola: result.rows[0].matricola,
            role: result.rows[0].role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'Registrazione completata con successo',
            token: token,
            role: result.rows[0].role
        });

    } catch (error) {
        console.error("Errore in /api/register:", error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Matricola già esistente' });
        }
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

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

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        res.json({
            message: 'Login effettuato con successo',
            token: token,
            role: user.role
        });

    } catch (error) {
        console.error("Errore in /api/login:", error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

/**
 * [PRIVATO] Ottieni tutti gli studenti
 */
app.get('/api/students', async (req, res) => {
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

// ====================================
// API PROTETTE - ELEZIONI
// ====================================

/**
 * [PROTETTO: TUTTI] Ritorna lista di tutte le elezioni
 */
app.get('/api/elections', verifyToken, async (req, res) => {
    try {
        const voterID = req.user.matricola;
        const { gateway, contract } = await connectToGateway(voterID);

        const result = await contract.evaluateTransaction('GetAllElections');

        gateway.disconnect();
        res.status(200).json(JSON.parse(result.toString()));
    } catch (error) {
        console.error("Errore in /api/elections:", error);
        res.status(500).json({ error: error.toString() });
    }
});

/**
 * [PROTETTO: TUTTI] Ottiene i dettagli di una singola elezione
 */
app.get('/api/election/:electionID', verifyToken, async (req, res) => {
    try {
        const { electionID } = req.params;
        const voterID = req.user.matricola;

        const { gateway, contract } = await connectToGateway(voterID);

        const result = await contract.evaluateTransaction('GetElection', electionID);

        gateway.disconnect();
        res.status(200).json(JSON.parse(result.toString()));
    } catch (error) {
        console.error("Errore in /api/election:", error);
        res.status(500).json({ error: error.toString() });
    }
});

/**
 * [PROTETTO: TUTTI] Verifica se l'utente ha votato in un'elezione
 */
app.get('/api/has-voted/:electionID', verifyToken, async (req, res) => {
    try {
        const { electionID } = req.params;
        const voterID = req.user.matricola;

        const { gateway, contract } = await connectToGateway(voterID);

        const result = await contract.evaluateTransaction('HasVoted', electionID, voterID);

        gateway.disconnect();
        res.status(200).json({ hasVoted: result.toString() === 'true' });
    } catch (error) {
        console.error("Errore in /api/has-voted:", error);
        res.status(500).json({ error: error.toString() });
    }
});

/**
 * [PROTETTO: ADMIN] Crea una nuova elezione
 */
app.post('/api/create-election', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id, title, proposals } = req.body;
        if (!id || !title || !proposals || !Array.isArray(proposals)) {
            return res.status(400).json({ error: 'Body richiesta non valido' });
        }
        const proposalsJSON = JSON.stringify(proposals);

        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);

        await contract.submitTransaction('CreateElection', id, title, proposalsJSON);

        gateway.disconnect();
        res.status(201).json({ message: `Elezione ${id} creata con successo` });
    } catch (error) {
        console.error("Errore in /api/create-election:", error);
        const errorString = error.toString();
        if (errorString.includes('Accesso negato')) {
            return res.status(403).json({ error: errorString });
        }
        res.status(500).json({ error: errorString });
    }
});

/**
 * [PROTETTO: TUTTI] Esprime un voto
 */
app.post('/api/vote', verifyToken, async (req, res) => {
    try {
        const { electionID, proposal } = req.body;
        const voterID = req.user.matricola;

        if (!electionID || !proposal) {
            return res.status(400).json({ error: 'electionID e proposal richiesti' });
        }

        const { gateway, contract } = await connectToGateway(voterID);

        const transaction = contract.createTransaction('CastVote');
        transaction.setTransient({
            vote_choice: Buffer.from(proposal)
        });

        await transaction.submit(electionID);

        gateway.disconnect();
        res.status(200).json({ message: `Voto di ${voterID} per ${proposal} registrato con successo!` });
    } catch (error) {
        console.error("Errore in /api/vote:", error);
        const errorString = error.toString();
        if (errorString.includes('ha già votato') ||
            errorString.includes('Accesso negato') ||
            errorString.includes('non trovata') ||
            errorString.includes('è chiusa') ||
            errorString.includes('non registrato')
        ) {
            return res.status(403).json({ error: errorString });
        }
        res.status(500).json({ error: errorString });
    }
});

/**
 * [PROTETTO: TUTTI] Legge i risultati di un'elezione
 */
app.get('/api/results/:electionID', verifyToken, async (req, res) => {
    try {
        const { electionID } = req.params;
        const queryUser = req.user.matricola;

        const { gateway, contract } = await connectToGateway(queryUser);

        const result = await contract.evaluateTransaction('GetResults', electionID);

        gateway.disconnect();
        res.status(200).json(JSON.parse(result.toString()));
    } catch (error) {
        console.error("Errore in /api/results:", error);
        const errorString = error.toString();
        if (errorString.includes('è ancora aperta')) {
            return res.status(403).json({ error: errorString });
        }
        res.status(500).json({ error: errorString });
    }
});

/**
 * [PROTETTO: ADMIN] Chiude un'elezione
 */
app.post('/api/close-election', verifyToken, isAdmin, async (req, res) => {
    try {
        const { electionID } = req.body;
        if (!electionID) {
            return res.status(400).json({ error: 'electionID richiesto' });
        }

        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);

        await contract.submitTransaction('CloseElection', electionID);

        gateway.disconnect();
        res.status(200).json({ message: `Elezione ${electionID} chiusa con successo` });
    } catch (error) {
        console.error("Errore in /api/close-election:", error);
        const errorString = error.toString();
        if (errorString.includes('è già chiusa')) {
            return res.status(409).json({ error: errorString });
        }
        res.status(500).json({ error: errorString });
    }
});

/**
 * [PROTETTO: ADMIN] Crea un nuovo utente (studente, admin o super_admin) nel DB
 * e crea la sua identità sulla blockchain.
 * NOTA: Solo super_admin può creare altri admin o super_admin
 */
app.post('/api/admin/create-user', verifyToken, isAdmin, async (req, res) => {
    try {
        const { matricola, password, role, fullName } = req.body;
        if (!matricola || !password || !role) {
            return res.status(400).json({ error: 'Matricola, password e ruolo richiesti' });
        }
        if (role !== 'student' && role !== 'admin' && role !== 'super_admin') {
            return res.status(400).json({ error: 'Ruolo non valido. Usare "student", "admin" o "super_admin".' });
        }

        // SICUREZZA: Solo super_admin può creare admin o super_admin
        if ((role === 'admin' || role === 'super_admin') && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Solo i super admin possono creare admin o super admin' });
        }

        // SICUREZZA: Genera HASH e SALT
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 1. Inserisci l'utente nel DB (PostgreSQL)
        const result = await db.query(
            'INSERT INTO users (matricola, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, matricola, full_name, role',
            [matricola, passwordHash, fullName || 'Utente', role]
        );

        // 2. Crea l'identità sulla Blockchain (CA + Wallet + Ledger)
        await registerVoterOnBlockchain(matricola);

        res.status(201).json({
            message: 'Utente creato con successo (DB e Blockchain)',
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Errore in /api/admin/create-user:", error);
        if (error.code === '23505') { // Codice errore Postgres per "unique_violation"
            return res.status(409).json({ error: 'Matricola già esistente' });
        }
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// --- 6. AVVIO SERVER ---

app.listen(PORT, async () => {
    console.log(`🚀 Server API in ascolto su http://localhost:${PORT}`);
    
    // All'avvio, assicurati che il wallet abbia le identità admin
    // Questo è FONDAMENTALE per far funzionare il server.
    await enrollAdmins();
});