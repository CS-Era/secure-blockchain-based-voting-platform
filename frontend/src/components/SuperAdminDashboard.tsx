import { useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import { CreateElectionForm } from './CreateElectionForm';
import { ElectionsList } from './ElectionsList';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from './RegisterForm'; // path adattare se necessario

interface AdminDashboardProps {
    onVote: (electionId: string) => void;
    onViewResults: (electionId: string) => void;
    refreshKey: number;
}

export const SuperAdminDashboard = ({ onVote, onViewResults, refreshKey }: AdminDashboardProps) => {
    const { token } = useAuth();
    const [showCreateElectionForm, setShowCreateElectionForm] = useState(false);
    const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
    const [refresh, setRefresh] = useState(refreshKey);

    const handleElectionCreated = () => {
        setRefresh(prev => prev + 1);
    };

    const handleStudentCreated = () => {
        // chiudi modal e forziamo refresh di liste
        setShowCreateStudentModal(false);
        setRefresh(prev => prev + 1);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Gestione Elezioni</h2>
                    <p className="text-gray-600">Crea e gestisci le elezioni studentesche</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowCreateStudentModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
                    >
                        <UserPlus className="w-5 h-5" />
                        Crea Studente
                    </button>

                    <button
                        onClick={() => setShowCreateElectionForm(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Nuova Elezione
                    </button>
                </div>
            </div>

            <ElectionsList
                key={refresh}
                onVote={onVote}
                onViewResults={onViewResults}
            />

            {showCreateElectionForm && (
                <CreateElectionForm
                    onClose={() => setShowCreateElectionForm(false)}
                    onSuccess={handleElectionCreated}
                />
            )}

            {showCreateStudentModal && (
                // Il RegisterForm verrà mostrato come modal. Passiamo asAdmin + token + onSuccess.
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="relative w-full max-w-md">
                        {/* aggiungiamo una semplice "x" per poter chiudere anche rapidamente */}
                        <button
                            onClick={() => setShowCreateStudentModal(false)}
                            className="absolute -top-10 -right-2 text-white"
                            aria-label="Chiudi"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <RegisterForm
                            asAdmin={true}
                            token={token}
                            onSuccess={handleStudentCreated}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
