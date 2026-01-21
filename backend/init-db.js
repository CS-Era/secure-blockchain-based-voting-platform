// init_db.js
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs'); // Assicurati di usare bcryptjs come nel server.js, oppure bcrypt
const readline = require('readline');

// Configurazione Pool
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'voting_db', // Nota: ho corretto DB_NAME in DB_DATABASE per coerenza col tuo db.js
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function resetDatabase() {
    const client = await pool.connect();

    try {
        console.log('🔌 Connesso al database...');
        await client.query('BEGIN');

        // ============================
        // DROP (Pulizia)
        // ============================
        console.log('🗑️  Eliminazione tabelle esistenti...');
        // Rimuoviamo le nuove tabelle se esistono, e anche la vecchia 'votes' per compatibilità
        await client.query('DROP TABLE IF EXISTS voters_log CASCADE');
        await client.query('DROP TABLE IF EXISTS ballot_box CASCADE');
        await client.query('DROP TABLE IF EXISTS votes CASCADE'); 
        await client.query('DROP TABLE IF EXISTS elections CASCADE');
        await client.query('DROP TABLE IF EXISTS users CASCADE');

        // Pulizia funzioni e trigger
        await client.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column()');

        // ============================
        // 1. TABELLA USERS
        // ============================
        console.log('📝 Creazione tabella users...');
        await client.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                matricola VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'student'
                    CHECK (role IN ('student', 'admin', 'super_admin')),
                state BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Trigger per updated_at
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        await client.query(`
            CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);

        // ============================
        // 2. TABELLA ELECTIONS
        // ============================
        console.log('🗳️  Creazione tabella elections...');
        await client.query(`
            CREATE TABLE elections (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                candidates JSONB NOT NULL,
                blockchain_hash VARCHAR(255) NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                merkle_root TEXT,
                results_hash TEXT
            )
        `);

        // ============================
        // 3. SEZIONE VOTING (MODIFICATA PER PRIVACY)
        // ============================
        
        // 3a. voters_log: Chi ha votato? (Registro)
        console.log('📖 Creazione tabella voters_log (Registro Elettorale)...');
        await client.query(`
            CREATE TABLE voters_log (
               election_id VARCHAR(255) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
               user_id INTEGER NOT NULL REFERENCES users(id),
               voter_hash VARCHAR(255), -- Opzionale: per salvare l'hash identità inviato alla blockchain
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               PRIMARY KEY (election_id, user_id) -- VINCOLO FONDAMENTALE: Un utente, un voto per elezione
            )
        `);

        // 3b. ballot_box: Cosa è stato votato? (Urna)
        console.log('🗳️  Creazione tabella ballot_box (Urna Anonima)...');
        await client.query(`
            CREATE TABLE ballot_box (
               id SERIAL PRIMARY KEY,
               election_id VARCHAR(255) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
               candidate_id INTEGER NOT NULL, 
               vote_hash TEXT NOT NULL,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // NOTA: Ho rimosso "REFERENCES users(id)" da candidate_id nella ballot_box.
        // I candidati sono definiti nel JSON dell'elezione. Disaccoppiarlo aumenta la privacy
        // e permette di avere candidati che non sono necessariamente utenti registrati.

        // ============================
        // 4. UTENTI DI DEFAULT
        // ============================
        console.log('👥 Creazione utenti di default...');

        const superAdminPassword = await bcrypt.hash('superadmin123', 10);
        const adminPassword = await bcrypt.hash('admin123', 10);
        const studentPassword = await bcrypt.hash('student123', 10);
        // Aggiungo altri studenti per testare l'anonimato
        const student2Password = await bcrypt.hash('student123', 10);

        await client.query(`
            INSERT INTO users (full_name, matricola, password_hash, role)
            VALUES
            ('UniSa SuperAdmin', 'superadmin', $1, 'super_admin'),
            ('Segreteria Studenti', 'admin', $2, 'admin'),
            ('Mario Rossi', 'N86001234', $3, 'student'),
            ('Luigi Verdi', 'N86005678', $4, 'student')
        `, [superAdminPassword, adminPassword, studentPassword, student2Password]);

        await client.query('COMMIT');

        console.log('\n✅ Database inizializzato correttamente!');
        console.log('📌 Struttura Voting aggiornata per Privacy:');
        console.log('   - voters_log (Chi ha votato)');
        console.log('   - ballot_box (Voti anonimi)');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Errore durante l\'inizializzazione:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        rl.close();
        process.exit(0);
    }
}

// Avvio diretto
resetDatabase();