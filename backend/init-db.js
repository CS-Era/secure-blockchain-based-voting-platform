// Script per ripulire e ricreare il database PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'voting_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askConfirmation(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'y');
        });
    });
}

async function resetDatabase() {
    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        // ============================
        // DROP
        // ============================
        console.log('🗑️  Eliminazione tabelle esistenti...');
        await client.query('DROP TABLE IF EXISTS votes CASCADE');
        await client.query('DROP TABLE IF EXISTS elections CASCADE');
        await client.query('DROP TABLE IF EXISTS users CASCADE');

        await client.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column()');

        // ============================
        // USERS
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

        // Trigger updated_at
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
        // ELECTIONS
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
        // votes
        // ============================
        console.log('🔗 Creazione tabella votes...');
        await client.query(`
            CREATE TABLE votes (
               user_id INTEGER NOT NULL REFERENCES users(id),
               election_id VARCHAR(255) NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
               candidate_id INTEGER NOT NULL REFERENCES users(id),
               vote_hash TEXT NOT NULL,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               PRIMARY KEY (user_id, election_id)
            )
        `);


        // ============================
        // UTENTI DI DEFAULT
        // ============================
        console.log('👥 Creazione utenti di default...');

        const superAdminPassword = await bcrypt.hash('superadmin123', 10);
        const adminPassword = await bcrypt.hash('admin123', 10);
        const studentPassword = await bcrypt.hash('student123', 10);

        await client.query(`
            INSERT INTO users (full_name, matricola, password_hash, role)
            VALUES
            ('UniSa Admin', 'superadmin', $1, 'super_admin'),
            ('Segreteria Studenti', 'admin', $2, 'admin'),
            ('Mario Rossi', 'N86001234', $3, 'student')
        `, [superAdminPassword, adminPassword, studentPassword]);

        await client.query('COMMIT');

        console.log('\n✅ Database inizializzato correttamente!');
        console.log('📌 Tabelle create: users, elections, votes');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Errore:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        rl.close();
    }
}

resetDatabase();
