import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users } from 'lucide-react';
import { User } from "../api.ts";

interface CreateElectionFormProps {
  onClose: () => void;
  onSuccess: () => void;
  token?: string | null;
}

export const CreateElectionForm = ({ onClose, onSuccess, token }: CreateElectionFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [candidates, setCandidates] = useState([{ name: '', description: '' }]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showStudents, setShowStudents] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  // Recupera studenti dall'API
  const loadStudents = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/students'); // metti l'URL corretto del backend
      if (!res.ok) throw new Error('Errore nel caricamento degli studenti');
      const data = await res.json();
      setAllStudents(data.students || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento degli studenti');
    } finally {
      setLoading(false);
    }
  };


  const toggleStudent = (studentId: number) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(String(studentId))) {
      newSelected.delete(String(studentId));
    } else {
      newSelected.add(String(studentId));
    }
    setSelectedStudents(newSelected);
  };

  const addCandidate = () => setCandidates([...candidates, { name: '', description: '' }]);
  const removeCandidate = (index: number) => setCandidates(candidates.filter((_, i) => i !== index));
  const updateCandidate = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...candidates];
    updated[index][field] = value;
    setCandidates(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim()) {
      setError('Titolo e descrizione sono obbligatori');
      return;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      setError('Data e ora di inizio e fine obbligatorie');
      return;
    }

    if (candidates.some(c => !c.name.trim())) {
      setError('Tutti i candidati devono avere un nome');
      return;
    }

    if (selectedStudents.size === 0) {
      setError('Seleziona almeno uno studente eleggibile');
      return;
    }

    setSubmitting(true);

    try {
      const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
      const endDateTime = new Date(`${endDate}T${endTime}`).toISOString();

      if (new Date(startDateTime) >= new Date(endDateTime)) {
        setError('La data di fine deve essere successiva alla data di inizio');
        return;
      }

      // Creazione elezione
      const res = await fetch('http://localhost:3000/api/create-election', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: `election-${Date.now()}`,
          title: title.trim(),
          proposals: candidates.map(c => ({ name: c.name.trim(), description: c.description.trim() })),
          start_date: startDateTime,
          end_date: endDateTime,
          eligible_students: Array.from(selectedStudents)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nella creazione dell\'elezione');

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore nella creazione dell\'elezione');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Caricamento...</p>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Crea Nuova Elezione</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

          {/* Form elezione */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titolo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Titolo Elezione</label>
              <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Descrizione */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
              <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Date/time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Inizio</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ora Inizio</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ora Fine</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg" />
              </div>
            </div>

            {/* Candidati */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">Candidati</label>
                <button type="button" onClick={addCandidate}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium transition">
                  <Plus className="w-4 h-4" /> Aggiungi
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {candidates.map((candidate, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <input type="text" value={candidate.name}
                             onChange={e => updateCandidate(index, 'name', e.target.value)}
                             placeholder="Nome del candidato"
                             className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2" />
                      <textarea value={candidate.description}
                                onChange={e => updateCandidate(index, 'description', e.target.value)}
                                placeholder="Breve descrizione"
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm" />
                      {candidates.length > 1 && (
                          <button type="button" onClick={() => removeCandidate(index)}
                                  className="flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-sm">
                            <Trash2 className="w-4 h-4" /> Rimuovi
                          </button>
                      )}
                    </div>
                ))}
              </div>
            </div>

            {/* Selezione studenti eleggibili */}
            <div>
              <button type="button" onClick={() => setShowStudents(!showStudents)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span>Studenti Eleggibili ({selectedStudents.size})</span>
                </div>
                <span className="text-gray-500">{showStudents ? '▼' : '▶'}</span>
              </button>

              {showStudents && (
                  <div className="mt-3 border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                    {allStudents.length === 0 ? (
                        <p className="text-gray-600 text-sm">Nessuno studente disponibile</p>
                    ) : (
                        <div className="space-y-2">
                          {allStudents.map(student => (
                              <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                                <input type="checkbox"
                                       checked={selectedStudents.has(String(student.id))}
                                       onChange={() => toggleStudent(student.id)}
                                       className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer" />
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{student.full_name}</p>
                                  <p className="text-sm text-gray-600">{student.matricola}</p>
                                </div>
                              </label>
                          ))}
                        </div>
                    )}
                  </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-lg transition">
                Annulla
              </button>
              <button type="submit" disabled={submitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? 'Creazione...' : 'Crea Elezione'}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};
