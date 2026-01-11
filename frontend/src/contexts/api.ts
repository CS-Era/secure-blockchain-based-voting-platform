import axios, {AxiosError} from "axios";

/* ------------------------------------------------------------------
   CONFIGURAZIONE BASE
------------------------------------------------------------------- */

const API_BASE_URL = "http://localhost:3000/api";

export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

/* ------------------------------------------------------------------
   GESTIONE TOKEN JWT
------------------------------------------------------------------- */

export function setAuthToken(token: string | null) {
    if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        localStorage.setItem("token", token);
    } else {
        delete api.defaults.headers.common["Authorization"];
        localStorage.removeItem("token");
    }
}

// Carica token al refresh pagina
const savedToken = localStorage.getItem("token");
if (savedToken) {
    setAuthToken(savedToken);
}

/* ------------------------------------------------------------------
   INTERCEPTOR ERRORI GLOBALI
------------------------------------------------------------------- */

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<any>) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.warn("Token non valido o scaduto");
            setAuthToken(null);
        }

        return Promise.reject(
            error.response?.data?.error || "Errore di comunicazione con il server"
        );
    }
);

/* ------------------------------------------------------------------
   TIPI
------------------------------------------------------------------- */

export type Role = "student" | "admin" | "super_admin";

export interface User {
    id: number;
    matricola: string;
    full_name: string;
    role: Role;
}

export interface Student {
    id: number;
    matricola: string;
    full_name: string;
}

export interface Election {
    id: string;
    title: string;
    description: string;
    candidates: Candidate[]; // 👈
    is_active: boolean;
    status: "open" | "closed" | "upcoming";
    start_date: string;
    end_date: string;
    hasVoted?: boolean;
}

export interface Candidate {
    id: number;
    name: string;
    description: string;
}

export interface CandidateResult {
    candidate_id: number;
    candidate_name: string;
    candidate_description: string;
    votes: number;
    percentage: number;
}

/* ------------------------------------------------------------------
   AUTH
------------------------------------------------------------------- */

export async function login(matricola: string, password: string) {
    const res = await api.post("/login", { matricola, password });

    setAuthToken(res.data.token);

    return res.data as {
        token: string;
        role: Role;
        id: number;
        matricola: string;
    };
}

/* ------------------------------------------------------------------
   SUPER ADMIN
------------------------------------------------------------------- */

export async function createUserSuperAdmin(payload: {
    matricola: string;
    password: string;
    role: Role;
    fullName: string;
}) {
    return await api.post("/superadmin/create-user", payload);
}

/* ------------------------------------------------------------------
   STUDENTI
------------------------------------------------------------------- */

export async function getStudents() {
    const res = await api.get("/students");
    return res.data as {
        count: number;
        students: Pick<User, "id" | "matricola" | "full_name">[];
    };
}

/* ------------------------------------------------------------------
   ELEZIONI
------------------------------------------------------------------- */

export async function getElections() {
    const res = await api.get("/elections");
    return res.data as {
        count: number;
        elections: Election[];
    };
}

export async function createElection(payload: {
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    candidates: Candidate[];
}) {
    console.log(payload)
    return await api.post("/create-election", payload);
}

export async function closeElection(electionId: string) {
    const res = await api.post(`/elections/${electionId}/close`);
    return res.data as {
        message: string;
        results: { candidate_id: number; votes: number }[];
    };
}

export async function getElectionResults(electionId: string) {
    const res = await api.get(`/elections/${electionId}/results`);
    return res.data as {
        electionId: string;
        results: CandidateResult[];
    };
}

/* ------------------------------------------------------------------
   VOTAZIONE
------------------------------------------------------------------- */

export async function canVote(electionId: string) {
    const res = await api.get(`/elections/${electionId}/can-vote`);
    return res.data as {
        canVote: boolean;
        hasVoted: boolean;
        message: string;
    };
}

export async function vote(electionId: string, candidateId: number) {
    const res = await api.post(`/elections/${electionId}/vote`, {
        candidateId,
    });
    return res.data;
}

/* ------------------------------------------------------------------
   UTILITY
------------------------------------------------------------------- */

