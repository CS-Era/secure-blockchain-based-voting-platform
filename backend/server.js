'use strict';

// --- 1. IMPORTAZIONI ---

require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');       
const bcrypt = require('bcryptjs');      
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

const PORT = process.env.PORT || 3000;
const ORG_ADMIN_USER = process.env.ORG_ADMIN_USER;
const ORG_ADMIN_PASS = process.env.ORG_ADMIN_PASS;
const CA_REGISTRAR_USER = process.env.CA_REGISTRAR_USER;
const CA_REGISTRAR_PASS = process.env.CA_REGISTRAR_PASS;
const JWT_SECRET = process.env.JWT_SECRET; 

// SALT SEGRETO PER ANONIMIZZARE GLI STUDENTI SULLA BLOCKCHAIN
const VOTER_SECRET_SALT = process.env.VOTER_SECRET_SALT

const CHANNEL_NAME = 'votingchannel';
const CONTRACT_NAME = 'votingcc'; 
const MSP_ID = 'Org1MSP';

const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
const walletPath = path.join(__dirname, 'wallet');

// Check Sicurezza Environment
if (!ORG_ADMIN_USER || !ORG_ADMIN_PASS || !CA_REGISTRAR_USER || !CA_REGISTRAR_PASS || !JWT_SECRET) {
    console.error('ERRORE CRITICO: Variabili d\'ambiente segrete mancanti.');
    process.exit(1);
}

// --- 3. MIDDLEWARE ---
const cors = require('cors');
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) return res.status(401).json({ error: 'Accesso negato: token mancante.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token non valido o scaduto.' });
        req.user = user;
        next();
    });
};

const isAdminOrSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato: richiesto admin.' });
    }
    next();
};

const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Accesso negato: richiesto super_admin.' });
    }
    next();
};

// --- 4. FUNZIONI HELPER BLOCKCHAIN ---

async function enrollAdmins() {
    try {
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(caInfo.url);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const orgAdminExists = await wallet.get(ORG_ADMIN_USER);
        if (!orgAdminExists) {
            const enrollment = await ca.enroll({ enrollmentID: ORG_ADMIN_USER, enrollmentSecret: ORG_ADMIN_PASS });
            const x509Identity = {
                credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
                mspId: MSP_ID, type: 'X.509',
            };
            await wallet.put(ORG_ADMIN_USER, x509Identity);
            console.log(`✅ Identità ${ORG_ADMIN_USER} iscritta`);
        }
    } catch (error) {
        console.error(`ERRORE CRITICO enrollAdmins: ${error}`);
        process.exit(1);
    }
}

async function connectToGateway(identityName) {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get(identityName);
    if (!identity) throw new Error(`Identità '${identityName}' non trovata nel wallet.`);

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

// --- 5. ENDPOINT API ---

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { matricola, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE matricola = $1', [matricola]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const token = jwt.sign({ id: user.id, matricola: user.matricola, role: user.role }, JWT_SECRET, { expiresIn: '10h' });
        res.json({ message: 'Login OK', token, role: user.role, id: user.id, matricola: user.matricola });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// CREATE USER (SuperAdmin)
app.post("/api/superadmin/create-user", verifyToken, isSuperAdmin, async (req, res) => {
    try {
        const { matricola, password, role, fullName } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);
        
        await db.query(`INSERT INTO users (matricola, password_hash, full_name, role) VALUES ($1,$2,$3,$4)`, 
            [matricola, passwordHash, fullName, role]);
            
        res.status(201).json({ message: "Utente creato" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET STUDENTS
app.get('/api/students', verifyToken, async (req, res) => {
    try {
        const result = await db.query('SELECT id, matricola, full_name FROM users WHERE role = $1', ['student']);
        res.json({ count: result.rows.length, students: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Errore server' });
    }
});

// GET ELECTIONS
app.get('/api/elections', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(`
            SELECT e.*, 
            EXISTS (SELECT 1 FROM voters_log v WHERE v.election_id = e.id AND v.user_id = $1) AS "hasVoted"
            FROM elections e ORDER BY e.start_date DESC
        `, [userId]);

        res.json({ count: result.rows.length, elections: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.toString() });
    }
});

// CREATE ELECTION
app.post('/api/create-election', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const { title, description, start_date, end_date, candidates } = req.body;
        const electionId = `ELEC-${uuidv4()}`;
        
        const electionData = JSON.stringify({ title, description, start_date, end_date, candidates });
        const electionHash = crypto.createHash('sha256').update(electionData).digest('hex');

        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
        await contract.submitTransaction('CreateElection', electionId, electionHash);
        gateway.disconnect();

        await db.query(`
            INSERT INTO elections (id, title, description, candidates, blockchain_hash, start_date, end_date, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [electionId, title, description, JSON.stringify(candidates), electionHash, start_date, end_date, req.user.id]);

        res.status(201).json({ message: `Elezione creata` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// CLOSE ELECTION
app.post('/api/elections/:id/close', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const electionId = req.params.id;

        // --- IMPORTANTE: ORDINAMENTO DETERMINISTICO ---
        const votesRes = await db.query(
            `SELECT vote_hash, candidate_id FROM ballot_box WHERE election_id=$1 ORDER BY vote_hash ASC`, 
            [electionId]
        );

        const voteHashes = votesRes.rows.map(v => v.vote_hash);
        
        // --- FIX: Assicuriamo che le foglie siano stringhe ---
        const leaves = voteHashes.map(vh => SHA256(vh).toString());
        const tree = new MerkleTree(leaves, SHA256);
        const merkleRoot = tree.getRoot().toString('hex');

        // Calcolo risultati
        const resultsMap = {};
        votesRes.rows.forEach(v => { resultsMap[v.candidate_id] = (resultsMap[v.candidate_id] || 0) + 1; });
        const resultsArray = Object.entries(resultsMap).map(([candidate_id, votes]) => ({ candidate_id, votes }));
        const resultsHash = crypto.createHash('sha256').update(JSON.stringify(resultsArray)).digest('hex');

        // Salvataggio su Blockchain
        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
        await contract.submitTransaction('CloseElection', electionId, merkleRoot, resultsHash);
        gateway.disconnect();

        // Aggiornamento DB
        await db.query(`UPDATE elections SET is_active=false, merkle_root=$1, results_hash=$2 WHERE id=$3`, 
            [merkleRoot, resultsHash, electionId]);

        res.status(200).json({ message: 'Elezione chiusa', results: resultsArray });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// GET RESULTS
app.get('/api/elections/:id/results', verifyToken, async (req, res) => {
    try {
        const electionId = req.params.id;
        const votesRes = await db.query(`
            SELECT (c->>'id')::int AS candidate_id, c->>'name' AS candidate_name, COUNT(v.candidate_id) AS votes
            FROM elections e
            JOIN LATERAL jsonb_array_elements(e.candidates) AS c ON TRUE
            LEFT JOIN ballot_box v ON v.candidate_id = (c->>'id')::int AND v.election_id = e.id
            WHERE e.id = $1
            GROUP BY c ORDER BY votes DESC;
        `, [electionId]);

        res.status(200).json({ electionId, results: votesRes.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CAN VOTE
app.get('/api/elections/:id/can-vote', verifyToken, async (req, res) => {
    try {
        const electionId = req.params.id;
        const studentId = req.user.id;

        const election = await db.query('SELECT * FROM elections WHERE id=$1 AND is_active=true', [electionId]);
        if (!election.rows.length) return res.status(400).json({ canVote: false, message: 'Elezione chiusa' });

        const rel = await db.query('SELECT 1 FROM voters_log WHERE user_id=$1 AND election_id=$2', [studentId, electionId]);
        const hasVoted = rel.rows.length > 0;

        res.json({ canVote: !hasVoted, hasVoted, message: hasVoted ? 'Hai già votato' : 'Puoi votare' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// VOTE
app.post('/api/elections/:id/vote', verifyToken, async (req, res) => {
    try {
        const electionId = req.params.id;
        const { candidateId } = req.body;
        const userId = req.user.id;

        if (!candidateId) return res.status(400).json({ error: 'CandidateId mancante' });

        const electionRes = await db.query(`SELECT * FROM elections WHERE id=$1`, [electionId]);
        if (electionRes.rows.length === 0) return res.status(404).json({ error: 'Elezione non trovata' });
        
        const now = new Date();
        const election = electionRes.rows[0];
        if (now < new Date(election.start_date) || now > new Date(election.end_date) || !election.is_active) {
            return res.status(400).json({ error: 'Elezione non attiva' });
        }

        const check = await db.query('SELECT 1 FROM voters_log WHERE election_id=$1 AND user_id=$2', [electionId, userId]);
        if (check.rows.length > 0) return res.status(400).json({ error: 'Hai già votato' });

        const voterDataString = `${userId}-${electionId}-${VOTER_SECRET_SALT}`;
        const voterIDHash = crypto.createHash('sha256').update(voterDataString).digest('hex');

        const voteNonce = uuidv4();
        const votePayload = JSON.stringify({ electionId, candidateId, nonce: voteNonce });
        const voteHash = crypto.createHash('sha256').update(votePayload).digest('hex');

        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
        try {
            await contract.submitTransaction('CastVote', electionId, voterIDHash, voteHash);
        } catch(bcError) {
             console.error("Blockchain Error:", bcError);
             if (bcError.message && bcError.message.includes('ha già votato')) {
                 return res.status(409).json({ error: 'Errore Integrità: Identità già presente su blockchain' });
             }
             throw bcError;
        } finally {
            gateway.disconnect();
        }

        await db.query('BEGIN');
        try {
            await db.query('INSERT INTO voters_log (election_id, user_id, voter_hash) VALUES ($1, $2, $3)', 
                [electionId, userId, voterIDHash]);
            
            await db.query('INSERT INTO ballot_box (election_id, candidate_id, vote_hash) VALUES ($1, $2, $3)', 
                [electionId, candidateId, voteHash]);

            await db.query('COMMIT');
        } catch (dbError) {
            await db.query('ROLLBACK');
            throw dbError;
        }

        res.status(201).json({ message: 'Voto registrato', receipt: voteHash });
    } catch (error) {
        console.error("Vote Error:", error);
        res.status(500).json({ error: error.message || 'Errore interno' });
    }
});

// ==========================================
// VERIFICA MERKLE (VERIFICABILITÀ INDIVIDUALE)
// ==========================================

app.get('/api/elections/:id/verify/:voteHash', async (req, res) => {
    try {
        const { id: electionId, voteHash } = req.params;

        const votesRes = await db.query(
            `SELECT vote_hash FROM ballot_box WHERE election_id=$1 ORDER BY vote_hash ASC`, 
            [electionId]
        );

        const voteHashes = votesRes.rows.map(v => v.vote_hash);
        
        if (!voteHashes.includes(voteHash)) {
            return res.status(404).json({ error: 'Voto non trovato in questa elezione.' });
        }

        // 1. Costruisci albero con foglie String
        const leaves = voteHashes.map(vh => SHA256(vh).toString());
        const tree = new MerkleTree(leaves, SHA256);
        
        // 2. Genera Proof
        const leaf = SHA256(voteHash).toString();
        const rawProof = tree.getProof(leaf);
        
        // 3. Normalizza Proof per Frontend (Buffer -> Hex String)
        const proof = rawProof.map(item => ({
            position: item.position,
            data: item.data.toString('hex') 
        }));

        const dbMerkleRoot = tree.getRoot().toString('hex');

        let onChainMerkleRoot = null;
        try {
            const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);
            const electionBytes = await contract.evaluateTransaction('QueryElection', electionId);
            const electionData = JSON.parse(electionBytes.toString());
            onChainMerkleRoot = electionData.merkle_root;
            gateway.disconnect();
        } catch (e) {
            console.warn("Impossibile recuperare dati on-chain:", e);
        }
        
        res.json({
            electionId,
            voteHash,
            dbMerkleRoot,
            onChainMerkleRoot,
            proof
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/elections/:id/audit', async (req, res) => {
    try {
        const votesRes = await db.query(
            `SELECT vote_hash FROM ballot_box WHERE election_id=$1 ORDER BY vote_hash ASC`, 
            [req.params.id]
        );
        res.json(votesRes.rows.map(r => r.vote_hash));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, async () => {
    console.log(`🚀 Server API in ascolto su http://localhost:${PORT}`);
    await enrollAdmins();
});