import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { X, Save, Archive } from 'lucide-react';

export default function EvaluationsModal({ teacher, onClose }) {
    const { userProfile } = useAuth();
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newEval, setNewEval] = useState({ year: new Date().getFullYear(), score: '', comments: '' });

    useEffect(() => {
        fetchEvaluations();
    }, [teacher]);

    const fetchEvaluations = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('evaluations')
                .select('*, evaluator:coordinator_id(first_name, last_name)')
                .eq('teacher_id', teacher.id)
                .order('year', { ascending: false });

            if (error) throw error;
            setEvaluations(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('evaluations').insert([{
                teacher_id: teacher.id,
                coordinator_id: userProfile.id,
                year: parseInt(newEval.year),
                score: parseFloat(newEval.score),
                comments: newEval.comments
            }]);

            if (error) throw error;

            setNewEval({ year: new Date().getFullYear(), score: '', comments: '' });
            fetchEvaluations();
        } catch (err) {
            alert('Error guardando evaluación');
        }
    };

    const handeArchive = async (id, currentArchiveState) => {
        try {
            const { error } = await supabase.from('evaluations').update({ archived: !currentArchiveState }).eq('id', id);
            if (error) throw error;
            fetchEvaluations();
        } catch (err) {
            alert('Error archivando evaluación');
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in-up">
            <div className="glass-card w-full max-w-4xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-color/40 flex flex-col max-h-[90vh] overflow-hidden relative">

                {/* Decorative background blur inside modal */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mt-20 -mr-20 pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-color/40 bg-surface-hover/30 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[var(--text-primary)] text-xl font-black shadow-lg shadow-primary/20 shrink-0">
                            {teacher.first_name?.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Evaluaciones Docentes</h2>
                            <p className="text-secondary font-medium mt-0.5">Prof. {teacher.first_name} {teacher.last_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-[var(--text-primary)] p-2 rounded-xl hover:bg-error/80 hover:shadow-lg hover:shadow-error/20 transition-all focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 focus:ring-offset-surface">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col md:flex-row gap-8 relative z-10 w-full">

                    {/* List of past evaluations */}
                    <div className="flex-1 flex flex-col rounded-xl border border-color/30 bg-main/40 p-5 shadow-inner min-h-[400px]">
                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-color/40">
                            <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                Historial de Desempeño
                            </h3>
                            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">
                                {evaluations.length} Registros
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        ) : evaluations.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 py-10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary mb-3"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
                                <p className="text-secondary font-medium">No hay evaluaciones cargadas para este docente.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {evaluations.map(ev => (
                                    <div key={ev.id} className={`p-5 rounded-xl border relative shadow-sm transition-colors ${ev.archived ? 'bg-surface-hover/30 border-color/30 opacity-75' : 'bg-surface border-color/50 hover:border-primary/30 hover:shadow-md'}`}>

                                        {ev.archived && (
                                            <div className="absolute top-0 right-0 bg-secondary/10 text-tertiary text-[10px] font-bold px-3 py-1 rounded-bl-xl border-b border-l border-color/40 uppercase tracking-widest">
                                                Archivada
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-tertiary uppercase tracking-widest mb-1.5">Periodo Evaluativo</p>
                                                <span className="font-black text-xl text-[var(--text-primary)]">Ciclo {ev.year}</span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="bg-main/50 border border-color/50 px-3 py-1.5 rounded-lg text-center shadow-inner pt-2">
                                                    <span className="text-2xl font-black text-[var(--text-primary)] leading-none">{ev.score}</span>
                                                    <span className="text-xs font-bold text-tertiary ml-0.5">/10</span>
                                                </div>
                                                <button
                                                    onClick={() => handeArchive(ev.id, ev.archived)}
                                                    title={ev.archived ? "Desarchivar" : "Archivar"}
                                                    className={`p-2 rounded-lg transition-colors border ${ev.archived ? 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/20' : 'text-tertiary bg-main/50 border-color/40 hover:text-[var(--text-primary)] hover:bg-surface-hover'}`}
                                                >
                                                    <Archive size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-main/30 border border-color/30 rounded-lg p-3 my-3 shadow-inner">
                                            <p className="text-sm italic text-secondary leading-relaxed">"{ev.comments}"</p>
                                        </div>

                                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-color/30">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent text-[9px] font-bold border border-accent/30">
                                                    {ev.evaluator?.first_name?.charAt(0)}
                                                </div>
                                                <span className="text-xs text-tertiary font-medium">Evaluador: <span className="text-secondary">{ev.evaluator?.first_name} {ev.evaluator?.last_name}</span></span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* New Evaluation Form */}
                    <div className="w-full md:w-[320px] bg-surface/80 p-5 rounded-xl border border-color/50 shadow-lg h-fit flex flex-col backdrop-blur-md">
                        <h3 className="flex items-center gap-2 font-black text-lg text-[var(--text-primary)] mb-5 border-b border-color/40 pb-3">
                            <Save size={18} className="text-success" />
                            Nueva Evaluación
                        </h3>
                        <form onSubmit={handleSave} className="flex flex-col gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-secondary block">Año / Ciclo</label>
                                <input type="number" value={newEval.year} onChange={e => setNewEval({ ...newEval, year: e.target.value })} required className="input w-full font-medium" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-secondary block">Calificación (1-10)</label>
                                <input type="number" step="0.5" min="1" max="10" value={newEval.score} onChange={e => setNewEval({ ...newEval, score: e.target.value })} required className="input w-full font-bold text-[var(--text-primary)] text-lg placeholder:text-sm placeholder:font-normal" placeholder="Ej. 8.5" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-secondary block">Comentarios / Observaciones</label>
                                <textarea rows="5" value={newEval.comments} onChange={e => setNewEval({ ...newEval, comments: e.target.value })} required className="input w-full resize-none text-sm placeholder:text-tertiary/70" placeholder="Redacte el feedback general devuelto al docente..."></textarea>
                            </div>
                            <button type="submit" className="btn btn-primary w-full shadow-lg shadow-primary/20 mt-2 py-3 font-bold text-sm tracking-wide">
                                Guardar Evaluación
                            </button>
                        </form>
                    </div>

                </div>
            </div>
        </div>,
        document.body
    );
}
