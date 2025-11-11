// db.js (Versione Corretta)

// Non serve 'require('dotenv').config()' qui,
// perché server.js lo carica già prima di importare questo file.

const { Pool } = require('pg');

// 1. Metti la configurazione in un oggetto
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
};

// 2. CONTROLLA LE VARIABILI PRIMA DI CREARE IL POOL
if (!dbConfig.user || !dbConfig.host || !dbConfig.database || !dbConfig.password || !dbConfig.port) {
    console.error('ERRORE: Variabili DB non caricate correttamente. Controlla il file .env');
    // Logga per debug (ma mai la password)
    console.error(`DB_USER: ${dbConfig.user}`);
    console.error(`DB_HOST: ${dbConfig.host}`);
    console.error(`DB_DATABASE: ${dbConfig.database}`);
    console.error(`DB_PORT: ${dbConfig.port}`);
    console.error(`DB_PASSWORD: ${dbConfig.password ? '*** IMPOSTATA ***' : '!!! MANCANTE !!!'}`);
    process.exit(1);
}

// 3. Se il check passa, crea il pool
const pool = new Pool(dbConfig);

// 4. (Opzionale ma consigliato) Aggiungi un check sulla connessione
pool.connect((err) => {
    if (err) {
        console.error('ERRORE: Impossibile connettersi al database PostgreSQL.', err.stack);
        process.exit(1);
    } else {
        console.log('✅ Connessione al database PostgreSQL riuscita.');
    }
});

// Esportiamo la funzione 'query' per usarla nel server
module.exports = {
    query: (text, params) => pool.query(text, params),
};