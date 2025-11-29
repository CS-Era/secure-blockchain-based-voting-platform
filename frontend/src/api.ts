// lib/api.ts - Helper per fare chiamate API autenticate

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiOptions extends RequestInit {
    token?: string;
}

export interface ApiResponse<T> {
    message?: string;
    error?: string;
    token?: string;
    role?: string;
    data?: T;
}

export interface User {
    id: number;
    matricola: string;
    full_name: string;
    role: 'student' | 'admin' | 'super_admin';
}

export interface Election {
    id: string;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    status: 'upcoming' | 'open' | 'closed';
}

export interface Candidate {
    id: string;
    election_id: string;
    name: string;
    description: string;
    proposal?: string;
}

export interface Vote {
    id: string;
    election_id: string;
    student_id: string;
    candidate_id: string;
}

export interface ElectionResults {
    [candidateId: string]: number;
}

/**
 * Helper per fare chiamate API con gestione automatica del token
 */
export async function apiCall(endpoint: string, options: ApiOptions = {}) {
    const { token, ...fetchOptions } = options;

    // Recupera il token se non fornito
    const authToken = token || localStorage.getItem('auth_token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
    };

    // Aggiungi il token JWT se presente
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(error.error || `Errore HTTP ${response.status}`);
    }

    return response.json();
}

// ====================================
// AUTH API
// ====================================

export async function login(matricola: string, password: string) {
    return apiCall('/api/login', {
        method: 'POST',
        body: JSON.stringify({ matricola, password }),
    });
}

export async function register(matricola: string, password: string, fullName: string) {
    return apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify({ matricola, password, fullName }),
    });
}

export async function getStudents() {
    return apiCall('/api/students', {
        method: 'GET'
    });
}

// ====================================
// ELECTIONS API
// ====================================

export async function getElections() {
    return apiCall('/api/elections', {
        method: 'GET',
    });
}

export async function getElection(electionId: string) {
    return apiCall(`/api/election/${electionId}`, {
        method: 'GET',
    });
}

export async function getActiveElectionsNotVoted() {
    return apiCall('/api/active-elections-not-voted', {
        method: 'GET',
    });
}

export async function getActiveElectionsClosed() {
    return apiCall('/api/active-elections-closed', {
        method: 'GET',
    });
}

export async function getActiveElectionsToVote() {
    return apiCall('/api/active-elections-to-vote', {
        method: 'GET',
    });
}

export async function hasVoted(electionId: string) {
    return apiCall(`/api/has-voted/${electionId}`, {
        method: 'GET',
    });
}

export async function getResults(electionId: string) {
    return apiCall(`/api/results/${electionId}`, {
        method: 'GET',
    });
}

// ====================================
// VOTING API
// ====================================

export async function vote(electionID: string, proposal: string) {
    return apiCall('/api/vote', {
        method: 'POST',
        body: JSON.stringify({ electionID, proposal }),
    });
}

// ====================================
// ADMIN API
// ====================================

export async function createElection(id: string, title: string, proposals: string[]) {
    return apiCall('/api/create-election', {
        method: 'POST',
        body: JSON.stringify({ id, title, proposals }),
    });
}

export async function closeElection(electionID: string) {
    return apiCall('/api/close-election', {
        method: 'POST',
        body: JSON.stringify({ electionID }),
    });
}

export async function createUser(matricola: string, password: string, role: 'student' | 'admin' | 'super_admin') {
    return apiCall('/api/admin/create-user', {
        method: 'POST',
        body: JSON.stringify({ matricola, password, role }),
    });
}
