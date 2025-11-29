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

// Interfaccia per conferma
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
        console.log('⚠️  ATTENZIONE: Questo script cancellerà TUTTI i dati esistenti!\n');

        const confirm = await askConfirmation('Sei sicuro di voler continuare? (s/n): ');

        if (!confirm) {
            console.log('❌ Operazione annullata.');
            rl.close();
            process.exit(0);
        }

        console.log('\n🔄 Connessione al database...');

        await client.query('BEGIN');

        // DROP tabella esistente
        console.log('🗑️  Eliminazione tabella users esistente...');
        await client.query('DROP TABLE IF EXISTS users CASCADE');

        // DROP funzioni e trigger esistenti
        console.log('🗑️  Eliminazione funzioni e trigger...');
        await client.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column()');

        // Crea la nuova tabella users
        console.log('📝 Creazione nuova tabella users...');
        await client.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                matricola VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super_admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                state BOOLEAN NOT NULL DEFAULT true
            )
        `);

        // Crea gli indici
        console.log('📇 Creazione indici...');
        await client.query(`
            CREATE INDEX idx_users_matricola ON users(matricola)
        `);

        await client.query(`
            CREATE INDEX idx_users_role ON users(role)
        `);

        // Crea la funzione per updated_at
        console.log('⚙️  Creazione funzione trigger per updated_at...');
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Crea il trigger
        await client.query(`
            CREATE TRIGGER update_users_updated_at 
                BEFORE UPDATE ON users 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column()
        `);

        // Inserisci utenti di default
        console.log('👥 Creazione utenti di default...');

        // Super Admin
        const superAdminPassword = await bcrypt.hash('superadmin123', 10);
        await client.query(`
            INSERT INTO users (full_name, matricola, password_hash, role) 
            VALUES ($1, $2, $3, $4)
        `, ['UniSa Admin', 'superadmin', superAdminPassword, 'super_admin']);

        // Admin
        const adminPassword = await bcrypt.hash('admin123', 10);
        await client.query(`
            INSERT INTO users (full_name, matricola, password_hash, role) 
            VALUES ($1, $2, $3, $4)
        `, ['Segreteria Studenti', 'admin', adminPassword, 'admin']);

        // Student di test
        const studentPassword = await bcrypt.hash('student123', 10);
        await client.query(`
            INSERT INTO users (full_name, matricola, password_hash, role) 
            VALUES ($1, $2, $3, $4)
        `, ['Mario Rossi', 'N86001234', studentPassword, 'student']);

        await client.query('COMMIT');

        console.log('\n✅ Database ripulito e ricreato con successo!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 STRUTTURA TABELLA:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   - id (SERIAL PRIMARY KEY)');
        console.log('   - full_name (VARCHAR 255)');
        console.log('   - matricola (VARCHAR 50 UNIQUE)');
        console.log('   - password_hash (VARCHAR 255)');
        console.log('   - role (student | admin | super_admin)');
        console.log('   - created_at (TIMESTAMP)');
        console.log('   - updated_at (TIMESTAMP)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('👥 UTENTI CREATI:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🔴 SUPER ADMIN:');
        console.log('   Nome:      Super Amministratore');
        console.log('   Matricola: superadmin');
        console.log('   Password:  superadmin123');
        console.log('   Ruolo:     super_admin');

        console.log('\n🟡 ADMIN:');
        console.log('   Nome:      Amministratore');
        console.log('   Matricola: admin');
        console.log('   Password:  admin123');
        console.log('   Ruolo:     admin');

        console.log('\n🟢 STUDENT (Test):');
        console.log('   Nome:      Mario Rossi');
        console.log('   Matricola: N86001234');
        console.log('   Password:  student123');
        console.log('   Ruolo:     student');

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  IMPORTANTE: Cambia queste password in produzione!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Errore durante il reset del database:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        rl.close();
    }
}

// Esegui lo script
resetDatabase().then(() => {
    console.log('🎉 Reset completato con successo!\n');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Errore fatale:', error);
    process.exit(1);
});