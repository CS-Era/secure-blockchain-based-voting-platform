'use strict';

// 1. CARICA LE VARIABILI D'AMBIENTE DAL FILE .env
require('dotenv').config();

const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

// --- Configurazione Globale ---
// 2. LEGGI LE VARIABILI DA process.env
const PORT = process.env.PORT || 3000;
const ORG_ADMIN_USER = process.env.ORG_ADMIN_USER;
const ORG_ADMIN_PASS = process.env.ORG_ADMIN_PASS;
const CA_REGISTRAR_USER = process.env.CA_REGISTRAR_USER;
const CA_REGISTRAR_PASS = process.env.CA_REGISTRAR_PASS;
const DEFAULT_VOTER_PASS = process.env.DEFAULT_VOTER_PASS;

// Costanti fabric-network e chaincode
const CHANNEL_NAME = 'votingchannel';
const CONTRACT_NAME = 'votingcc';
const MSP_ID = 'Org1MSP';

// Path ai file critici
const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
const walletPath = path.join(__dirname, 'wallet');

// Check variabili .env caricate
if (!ORG_ADMIN_USER || !ORG_ADMIN_PASS || !CA_REGISTRAR_USER || !CA_REGISTRAR_PASS || !DEFAULT_VOTER_PASS) {
    console.error('ERRORE: Variabili d\'ambiente segrete mancanti.');
    console.error('Assicurati di aver creato e configurato il file .env nella cartella /backend');
    process.exit(1);
}
console.log(`✅ Variabili di environment caricate correttamente`);


// --- Funzioni Helper ---

/**
 * Connette al gateway Fabric usando una specifica identità.
 */
async function connectToGateway(identityName) {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get(identityName);
    if (!identity) {
        throw new Error(`Identità '${identityName}' non trovata nel wallet.`);
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
 * Iscrive ENTRAMBI gli Admin (da eseguire solo una volta all'avvio)
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
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: MSP_ID,
                type: 'X.509',
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
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: MSP_ID,
                type: 'X.509',
            };
            await wallet.put(CA_REGISTRAR_USER, x509Identity);
            console.log(`✅ Identità ${CA_REGISTRAR_USER} (CA Registrar) iscritta e salvata nel wallet`);
        } else {
            console.log(`✅ Identità ${CA_REGISTRAR_USER} (CA Registrar) già presente nel wallet`);
        }

    } catch (error) {
        console.error(`Errore nell'iscrizione degli Admin: ${error}`);
        process.exit(1);
    }
}

/**
 * Registra e iscrive un nuovo ELETTORE (voter)
 */
async function registerAndEnrollVoter(voterID) {
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // 1. Controlla se l'elettore esiste già nel wallet
    const voterExists = await wallet.get(voterID);
    if (voterExists) {
        throw new Error(`L'elettore ${voterID} è già nel wallet`);
    }

    // 2. Carica l'identità del REGISTRAR (admin) per registrare il nuovo elettore
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const ca = new FabricCAServices(ccp.certificateAuthorities['ca.org1.example.com'].url);
    const registrarIdentity = await wallet.get(CA_REGISTRAR_USER);
    if (!registrarIdentity) {
        throw new Error(`Identità Registrar (${CA_REGISTRAR_USER}) non trovata. Avvia il server.`);
    }
    const provider = wallet.getProviderRegistry().getProvider(registrarIdentity.type);
    const registrarUser = await provider.getUserContext(registrarIdentity, CA_REGISTRAR_USER);

    // 3. Registra il nuovo elettore con la CA (usando il REGISTRAR)
    await ca.register({
        affiliation: 'org1.department1',
        enrollmentID: voterID,
        // 3. USA LA VARIABILE D'AMBIENTE
        enrollmentSecret: DEFAULT_VOTER_PASS,
        role: 'client',
        attrs: [
            { name: 'role', value: 'voter', ecert: true },
            { name: 'voterID', value: voterID, ecert: true }
        ]
    }, registrarUser); // <-- USA L'UTENTE REGISTRAR

    // 4. Iscrivi (enroll) il nuovo elettore e salva il suo certificato nel wallet
    const enrollment = await ca.enroll({ enrollmentID: voterID, enrollmentSecret: DEFAULT_VOTER_PASS });
    const x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId: MSP_ID,
        type: 'X.509',
    };
    await wallet.put(voterID, x509Identity);

    // 5. ORA, registra l'elettore sul LEDGER usando l'identità ADMIN DEL LEDGER
    const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER); 
    try {
        console.log(`Sto registrando ${voterID} sul ledger...`);
        await contract.submitTransaction('RegisterVoter', voterID);
    } finally {
        gateway.disconnect();
    }

    return `Elettore ${voterID} registrato con la CA, iscritto nel wallet e abilitato sul ledger.`;
}

// --- Setup del Server API ---

app.use(express.json());

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Il server di voto è attivo' });
});

app.post('/api/register-voter', async (req, res) => {
    try {
        const { voterID } = req.body;
        if (!voterID) {
            return res.status(400).json({ error: 'voterID mancante' });
        }
        const message = await registerAndEnrollVoter(voterID);
        res.status(201).json({ message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/create-election', async (req, res) => {
    try {
        const { id, title, proposals } = req.body;
        const proposalsJSON = JSON.stringify(proposals);

        // Usa l'admin del LEDGER
        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);

        await contract.submitTransaction('CreateElection', id, title, proposalsJSON);

        gateway.disconnect();
        res.status(201).json({ message: `Elezione ${id} creata con successo` });
    } catch (error) {
        console.error(error);
        const errorString = error.toString();
        if (errorString.includes('Accesso negato')) {
            return res.status(403).json({ error: errorString });
        }
        res.status(500).json({ error: errorString });
    }
});

app.post('/api/vote', async (req, res) => {
    try {
        const { voterID, electionID, proposal } = req.body;
        if (!voterID || !electionID || !proposal) {
            return res.status(400).json({ error: 'Body incompleto' });
        }

        // Usa l'identità dell'ELETTORE
        const { gateway, contract } = await connectToGateway(voterID);

        await contract.submitTransaction('CastVote', electionID, proposal);

        gateway.disconnect();
        res.status(200).json({ message: `Voto di ${voterID} per ${proposal} registrato!` });
    } catch (error) {
        console.error(error);
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

app.get('/api/results/:electionID', async (req, res) => {
    try {
        const { electionID } = req.params;

        // Usa l'admin del LEDGER per le query
        const { gateway, contract } = await connectToGateway(ORG_ADMIN_USER);

        const result = await contract.evaluateTransaction('GetResults', electionID);

        gateway.disconnect();
        res.status(200).json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// --- Avvio Server ---
app.listen(PORT, async () => {
    console.log(`🚀 Server API in ascolto su http://localhost:${PORT}`);
    // All'avvio, iscrivi ENTRAMBI gli admin
    await enrollAdmins();
});