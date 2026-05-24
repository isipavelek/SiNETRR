import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Trash2, Plus, X, ListChecks, Edit2, Save } from 'lucide-react';

export default function ActivityManagerModal({ isOpen, onClose, onActivityAdded, teachers, subjects, subjectsCatalog }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [newActivityName, setNewActivityName] = useState('');
    const [newActivityDesc, setNewActivityDesc] = useState('');
    const [targetAudience, setTargetAudience] = useState('all');

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editAudience, setEditAudience] = useState('all');

    useEffect(() => {
        if (isOpen) {
            fetchActivities();
        }
    }, [isOpen]);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('activities_catalog')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setActivities(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddActivity = async (e) => {
        e.preventDefault();
        if (!newActivityName.trim()) return;
        setSubmitting(true);

        try {
            // 1. Insert into catalog
            const { data: newActivity, error: catalogError } = await supabase
                .from('activities_catalog')
                .insert([{ name: newActivityName, description: newActivityDesc, target_audience: targetAudience }])
                .select()
                .single();

            if (catalogError) throw catalogError;

            // 2. Determine target teachers
            let targetTeacherIds = [];
            
            if (targetAudience === 'all') {
                targetTeacherIds = teachers.map(t => t.id);
            } else if (targetAudience === 'none') {
                targetTeacherIds = [];
            } else {
                targetTeacherIds = teachers.filter(t => {
                    const teacherSubjects = subjects.filter(s => s.teacher_id === t.id);
                    const tOrientations = new Set();
                    const tLevels = new Set();
                    
                    teacherSubjects.forEach(ts => {
                        const catalogMatch = subjectsCatalog.find(c => c.name === ts.name);
                        if (catalogMatch) {
                            if (catalogMatch.orientation) tOrientations.add(catalogMatch.orientation);
                            if (catalogMatch.level) {
                                tLevels.add(catalogMatch.level);
                                if (catalogMatch.level === 'Básico') tLevels.add('Básica');
                            }
                        }
                    });

                    if (targetAudience === 'Electromecánica' || targetAudience === 'Electrónica') {
                        return tOrientations.has(targetAudience);
                    }
                    if (targetAudience === 'Básico' || targetAudience === 'Superior') {
                        return tLevels.has(targetAudience) || (targetAudience === 'Básico' && tLevels.has('Básica'));
                    }
                    return false;
                }).map(t => t.id);
            }

            // 3. Assign to target teachers
            if (targetTeacherIds.length > 0) {
                const assignments = targetTeacherIds.map(tid => ({
                    teacher_id: tid,
                    activity_id: newActivity.id,
                    completed: false
                }));

                const { error: assignError } = await supabase
                    .from('teacher_activities')
                    .insert(assignments);

                if (assignError) throw assignError;
            }

            // Reset and refresh
            setNewActivityName('');
            setNewActivityDesc('');
            setTargetAudience('all');
            await fetchActivities();
            if (onActivityAdded) onActivityAdded();
            
        } catch (err) {
            console.error('Error adding activity:', err);
            alert('Error al agregar la actividad.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveEdit = async (id) => {
        if (!editName.trim()) return;
        try {
            const { error } = await supabase
                .from('activities_catalog')
                .update({ name: editName, target_audience: editAudience })
                .eq('id', id);
            
            if (error) throw error;
            setEditingId(null);
            await fetchActivities();
            if (onActivityAdded) onActivityAdded();
        } catch (err) {
            console.error(err);
            alert('Error al guardar los cambios.');
        }
    };

    const handleDeleteActivity = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar esta actividad? Se eliminará de todos los perfiles asignados.")) return;
        
        try {
            const { error } = await supabase
                .from('activities_catalog')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            await fetchActivities();
            if (onActivityAdded) onActivityAdded();
        } catch (err) {
            console.error(err);
            alert('Error al eliminar la actividad.');
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-[9999]">
            <div className="bg-main border border-color rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]" style={{ zIndex: 10000 }}>
                
                {/* Header */}
                <div className="p-6 border-b border-color/50 bg-surface/80 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                            <ListChecks size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">Gestor de Actividades</h2>
                            <p className="text-xs text-secondary font-medium">Administra cursos y requisitos obligatorios</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-tertiary hover:bg-error/10 hover:text-error transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* Formulario de Nueva Actividad */}
                    <div className="glass-card p-5 border border-primary/20 shadow-inner bg-primary/5">
                        <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Plus size={16} /> Crear Nueva Actividad
                        </h3>
                        <form onSubmit={handleAddActivity} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1">Nombre de la Actividad</label>
                                <input
                                    type="text"
                                    required
                                    value={newActivityName}
                                    onChange={(e) => setNewActivityName(e.target.value)}
                                    className="w-full bg-surface border border-color rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="Ej: Entrega de Libreta Sanitaria"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-1">Público Objetivo (Asignación Automática)</label>
                                <select
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    className="w-full bg-surface border border-color rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary appearance-none outline-none transition-all cursor-pointer"
                                >
                                    <option value="none">No asignar a nadie (Solo catálogo)</option>
                                    <option value="all">Todos los Docentes</option>
                                    <option value="Electromecánica">Solo Docentes de Electromecánica</option>
                                    <option value="Electrónica">Solo Docentes de Electrónica</option>
                                    <option value="Básico">Solo Docentes de Ciclo Básico</option>
                                    <option value="Superior">Solo Docentes de Ciclo Superior</option>
                                </select>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? 'Creando...' : 'Crear y Asignar Actividad'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Lista de Actividades Existentes */}
                    <div>
                        <h3 className="text-sm font-bold text-tertiary uppercase tracking-wider mb-4">Actividades Vigentes</h3>
                        
                        {loading ? (
                            <div className="flex justify-center p-8"><svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
                        ) : activities.length === 0 ? (
                            <div className="text-center py-8 text-tertiary bg-surface-hover/30 rounded-xl border border-dashed border-color/50">
                                No hay actividades creadas.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activities.map(act => (
                                    <div key={act.id} className="flex items-center justify-between p-4 bg-surface border border-color rounded-xl hover:border-color-hover transition-colors shadow-sm">
                                        {editingId === act.id ? (
                                            <div className="flex-1 mr-4 space-y-2">
                                                <input 
                                                    type="text" 
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-main border border-color/50 rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-primary outline-none"
                                                />
                                                <select
                                                    value={editAudience}
                                                    onChange={(e) => setEditAudience(e.target.value)}
                                                    className="w-full bg-main border border-color/50 rounded-lg px-3 py-1.5 text-xs text-secondary focus:ring-1 focus:ring-primary outline-none"
                                                >
                                                    <option value="none">No asignar a nadie (Solo catálogo)</option>
                                                    <option value="all">Todos los Docentes</option>
                                                    <option value="Electromecánica">Solo Docentes de Electromecánica</option>
                                                    <option value="Electrónica">Solo Docentes de Electrónica</option>
                                                    <option value="Básico">Solo Docentes de Ciclo Básico</option>
                                                    <option value="Superior">Solo Docentes de Ciclo Superior</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex-1">
                                                <h4 className="font-bold text-[var(--text-primary)]">{act.name}</h4>
                                                <span className="text-[10px] font-bold text-secondary uppercase bg-surface-hover px-2 py-0.5 rounded border border-color/50 mt-1 inline-block">
                                                    Target: {act.target_audience === 'all' ? 'Todos' : act.target_audience === 'none' ? 'Sin Asignación Automática' : act.target_audience}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1">
                                            {editingId === act.id ? (
                                                <button 
                                                    onClick={() => handleSaveEdit(act.id)}
                                                    className="p-2 text-success/70 hover:text-success hover:bg-success/10 rounded-lg transition-colors"
                                                    title="Guardar"
                                                >
                                                    <Save size={18} />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => { setEditingId(act.id); setEditName(act.name); setEditAudience(act.target_audience); }}
                                                    className="p-2 text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    title="Editar Actividad"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteActivity(act.id)}
                                                className="p-2 text-error/70 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                                                title="Eliminar Actividad"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
