import React, { useState, useEffect } from 'react';
import { X, Users } from 'lucide-react';
import {Candidate, createElection, getStudents, Student} from "../contexts/api.ts";

interface CreateElectionFormProps {
  onClose: () => void;
  onSuccess: () => void;
  token?: string | null;
}

export const CreateElectionForm = ({ onClose, onSuccess }: CreateElectionFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showStudents, setShowStudents] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    // Aggiorna automaticamente i candidati quando cambiano gli studenti selezionati
    const newCandidates = Array.from(selectedStudents).map(studentId => {
      const existing = candidates.find(c => c.id === studentId);
      return {
        id: studentId,
        name: allStudents.find(s => s.id === Number(studentId))?.full_name || '',
        description: existing?.description || ''
      };
    });
    setCandidates(newCandidates);
  }, [selectedStudents, allStudents]);

  const loadStudents = async () => {
    setLoading(true);
    setError("");

    try {
      // ✅ Chiama la funzione centralizzata dell'API
      const data = await getStudents(); // ritorna { students: User[] }

      // Aggiorna lo stato con gli studenti
      setAllStudents(data.students || []);

    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (studentId: number) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) newSelected.delete(studentId);
    else newSelected.add(studentId);
    setSelectedStudents(newSelected);
  };

  const updateCandidate = (index: number, value: string) => {
    const updated = [...candidates];
    updated[index].description = value;
    setCandidates(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !description.trim()) {
      setError("Titolo e descrizione sono obbligatori");
      return;
    }

    if (!startDate || !endDate) {
      setError("Data e ora di inizio e fine obbligatorie");
      return;
    }

    if (selectedStudents.size === 0) {
      setError("Seleziona almeno uno studente eleggibile");
      return;
    }

    setSubmitting(true);

    try {
      const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
      const endDateTime = new Date(`${endDate}T${endTime}`).toISOString();

      if (new Date(startDateTime) >= new Date(endDateTime)) {
        setError("La data di fine deve essere successiva alla data di inizio");
        return;
      }

      // ✅ Chiama la funzione centralizzata dell'API
      await createElection({
        title: title.trim(),
        description: description.trim(),
        start_date: startDateTime,
        end_date: endDateTime,
        candidates: candidates.map(c => ({ name: c.name.trim(), id: c.id, description: c.description }))
      });

      onSuccess();
      onClose();

    } catch (err: any) {
      setError(err);
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* HEADER FISSO */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-none">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Crea Nuova Elezione</h2>
              {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mt-2 text-sm">{error}</div>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-6 h-6"/>
            </button>
          </div>

          {/* FORM SCROLLABILE */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
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
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ora Inizio</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ora Fine</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                       className="w-full px-4 py-3 border border-gray-300 rounded-lg"/>
              </div>
            </div>

            {/* Selezione studenti eleggibili */}
            <div>
              <button type="button" onClick={() => setShowStudents(!showStudents)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5"/>
                  <span>Studenti Eleggibili</span>
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
                              <label key={student.id}
                                     className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                                <input type="checkbox"
                                       checked={selectedStudents.has(student.id)}
                                       onChange={() => toggleStudent(student.id)}
                                       className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"/>
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

            {/* Candidati derivati dagli studenti */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Candidati</label>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {candidates.map((candidate, index) => (
                    <div key={candidate.id} className="bg-gray-50 p-4 rounded-lg">
                      <input
                          type="text"
                          value={candidate.name}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 bg-gray-100 cursor-not-allowed"
                      />
                      <textarea
                          value={candidate.description}
                          onChange={e => updateCandidate(index, e.target.value)}
                          placeholder="Breve descrizione"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm"
                      />
                    </div>
                ))}
              </div>
            </div>
            {/* FOOTER BOTTONI */}
            <div className="flex gap-3 p-6 border-t border-gray-200 flex-none">
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
