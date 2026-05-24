import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, AlertTriangle, Users, CheckSquare, Megaphone, Pin, Plus, Trash2, X, Calendar, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function GeneralDashboard({ onNavigate }) {
    const { role, userProfile } = useAuth();
    const [loading, setLoading] = useState(true);

    const [metrics, setMetrics] = useState({
        pendingCards: 0,
        subjectsWithPlanning: 0,
        totalSubjects: 0,
        teachersWithCourses: 0,
        totalTeachers: 0,
        coordinationTasksCount: 0,
        myActivitiesCompleted: 0,
        myActivitiesTotal: 0
    });

    const [announcements, setAnnouncements] = useState([]);
    const [showAnnModal, setShowAnnModal] = useState(false);
    const [annForm, setAnnForm] = useState({ title: '', content: '', is_pinned: false });
    const [editingAnn, setEditingAnn] = useState(null);

    const getDefaultAnnouncements = () => [
        {
            id: 'default-1',
            title: '📢 Bienvenidos al nuevo Nodo Tecnológico',
            content: 'Iniciamos el ciclo lectivo con el nuevo espacio digital de gestión. Recordá completar tus planificaciones y mantener al día las auditorías 5S en tus talleres.',
            is_pinned: true,
            created_by_name: 'Luis (Gerente)',
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'default-2',
            title: '⏰ Entrega de planificaciones extendida',
            content: 'Se extiende el plazo de carga de planificaciones hasta el próximo viernes a las 18:00hs. Ante cualquier duda, contactar a los coordinadores Israel o Alejandro.',
            is_pinned: false,
            created_by_name: 'Israel Pavelek (Coordinador)',
            created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
    ];

    const fetchAnnouncements = async () => {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*');
            
            if (error) throw error;
            
            // Get local overrides/additions
            const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
            const deletedDefaults = JSON.parse(localStorage.getItem('etrr-deleted-announcements') || '[]');
            
            let list = data || [];
            if (list.length === 0) {
                // Load defaults, but exclude any that were deleted locally
                const defaults = getDefaultAnnouncements().filter(d => !deletedDefaults.includes(d.id));
                // Apply any local edits to defaults
                const editedDefaults = JSON.parse(localStorage.getItem('etrr-edited-defaults') || '[]');
                const mergedDefaults = defaults.map(d => {
                    const edited = editedDefaults.find(e => e.id === d.id);
                    return edited ? { ...d, ...edited } : d;
                });
                
                list = [...local, ...mergedDefaults];
            } else {
                list = [...list, ...local];
            }
            
            // Sort: pinned first, then created_at descending
            list.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
            
            setAnnouncements(list);
        } catch {
            // Offline fallback
            const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
            const deletedDefaults = JSON.parse(localStorage.getItem('etrr-deleted-announcements') || '[]');
            const editedDefaults = JSON.parse(localStorage.getItem('etrr-edited-defaults') || '[]');
            
            const defaults = getDefaultAnnouncements().filter(d => !deletedDefaults.includes(d.id));
            const mergedDefaults = defaults.map(d => {
                const edited = editedDefaults.find(e => e.id === d.id);
                return edited ? { ...d, ...edited } : d;
            });
            
            const list = [...local, ...mergedDefaults];
            list.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
            
            setAnnouncements(list);
        }
    };

    const handleCreateAnnouncement = async (e) => {
        e.preventDefault();
        if (!annForm.title || !annForm.content) return;

        if (editingAnn) {
            const isDefault = String(editingAnn.id).startsWith('default-');
            const isLocal = String(editingAnn.id).startsWith('local-');

            if (isDefault) {
                const editedDefaults = JSON.parse(localStorage.getItem('etrr-edited-defaults') || '[]');
                const index = editedDefaults.findIndex(a => a.id === editingAnn.id);
                const updatedObj = {
                    id: editingAnn.id,
                    title: annForm.title,
                    content: annForm.content,
                    is_pinned: annForm.is_pinned
                };
                if (index > -1) {
                    editedDefaults[index] = updatedObj;
                } else {
                    editedDefaults.push(updatedObj);
                }
                localStorage.setItem('etrr-edited-defaults', JSON.stringify(editedDefaults));
                setShowAnnModal(false);
                setEditingAnn(null);
                setAnnForm({ title: '', content: '', is_pinned: false });
                await fetchAnnouncements();
                return;
            }

            if (isLocal) {
                const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
                const updated = local.map(a => a.id === editingAnn.id ? { ...a, title: annForm.title, content: annForm.content, is_pinned: annForm.is_pinned } : a);
                localStorage.setItem('etrr-announcements', JSON.stringify(updated));
                setShowAnnModal(false);
                setEditingAnn(null);
                setAnnForm({ title: '', content: '', is_pinned: false });
                await fetchAnnouncements();
                return;
            }

            // Database edit
            try {
                const { error } = await supabase
                    .from('announcements')
                    .update({
                        title: annForm.title,
                        content: annForm.content,
                        is_pinned: annForm.is_pinned
                    })
                    .eq('id', editingAnn.id);

                if (error) throw error;
                await fetchAnnouncements();
            } catch {
                const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
                const updated = local.map(a => a.id === editingAnn.id ? { ...a, title: annForm.title, content: annForm.content, is_pinned: annForm.is_pinned } : a);
                localStorage.setItem('etrr-announcements', JSON.stringify(updated));
                await fetchAnnouncements();
            } finally {
                setShowAnnModal(false);
                setEditingAnn(null);
                setAnnForm({ title: '', content: '', is_pinned: false });
            }
        } else {
            // Create mode
            const authorId = userProfile?.id || '95c78188-52a3-484c-807a-8e1e2079b76e';
            const authorName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Israel Pavelek';

            const newAnn = {
                title: annForm.title,
                content: annForm.content,
                is_pinned: annForm.is_pinned,
                created_by: authorId,
                created_by_name: authorName,
                created_at: new Date().toISOString()
            };

            try {
                const { error } = await supabase
                    .from('announcements')
                    .insert([newAnn]);
                
                if (error) throw error;
                await fetchAnnouncements();
            } catch {
                const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
                const completeAnn = {
                    id: `local-ann-${Date.now()}`,
                    ...newAnn
                };
                const updated = [completeAnn, ...local];
                localStorage.setItem('etrr-announcements', JSON.stringify(updated));
                await fetchAnnouncements();
            } finally {
                setShowAnnModal(false);
                setAnnForm({ title: '', content: '', is_pinned: false });
            }
        }
    };

    const handleEditAnnouncement = (ann) => {
        setEditingAnn(ann);
        setAnnForm({
            title: ann.title,
            content: ann.content,
            is_pinned: ann.is_pinned
        });
        setShowAnnModal(true);
    };

    const handleDeleteAnnouncement = async (id) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este comunicado?')) return;
        
        const isDefault = String(id).startsWith('default-');
        
        if (isDefault) {
            const deletedDefaults = JSON.parse(localStorage.getItem('etrr-deleted-announcements') || '[]');
            if (!deletedDefaults.includes(id)) {
                deletedDefaults.push(id);
                localStorage.setItem('etrr-deleted-announcements', JSON.stringify(deletedDefaults));
            }
            await fetchAnnouncements();
            return;
        }

        try {
            if (String(id).startsWith('local-')) {
                const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
                const updated = local.filter(a => a.id !== id);
                localStorage.setItem('etrr-announcements', JSON.stringify(updated));
                await fetchAnnouncements();
                return;
            }

            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            await fetchAnnouncements();
        } catch {
            const local = JSON.parse(localStorage.getItem('etrr-announcements') || '[]');
            const updated = local.filter(a => a.id !== id);
            localStorage.setItem('etrr-announcements', JSON.stringify(updated));
            await fetchAnnouncements();
        }
    };

    useEffect(() => {
        if (!userProfile) return;
        fetchMetrics();
        fetchAnnouncements();
    }, [userProfile]);

    const fetchMetrics = async () => {
        try {
            setLoading(true);

            // Fetch Red Cards
            let queryCards = supabase.from('red_cards').select('*', { count: 'exact' }).neq('status', 'Resuelta');
            if (role === 'docente') {
                queryCards = queryCards.eq('responsible_id', userProfile.id);
            }
            const { count: pendingCardsCount } = await queryCards;

            // Fetch Subjects
            let querySubjects = supabase.from('subjects').select('*', { count: 'exact' });
            let queryPlanning = supabase.from('subjects').select('*', { count: 'exact' }).eq('planning_submitted', true);

            if (role === 'docente') {
                querySubjects = querySubjects.eq('teacher_id', userProfile.id);
                queryPlanning = queryPlanning.eq('teacher_id', userProfile.id);
            }

            const { count: totalSubjectsCount } = await querySubjects;
            const { count: planningSubjectsCount } = await queryPlanning;

            // Fetch Teachers & Activities
            let totalTeachersCount = 0;
            let teachersWithCoursesCount = 0;
            let myActivitiesCompletedCount = 0;
            let myActivitiesTotalCount = 0;

            if (role === 'docente') {
                const { count: totalAct } = await supabase
                    .from('teacher_activities')
                    .select('*', { count: 'exact' })
                    .eq('teacher_id', userProfile.id);

                const { count: completedAct } = await supabase
                    .from('teacher_activities')
                    .select('*', { count: 'exact' })
                    .eq('teacher_id', userProfile.id)
                    .eq('completed', true);

                myActivitiesTotalCount = totalAct || 0;
                myActivitiesCompletedCount = completedAct || 0;
            } else {
                const { count: totalT } = await supabase
                    .from('user_profiles')
                    .select('*, user_roles!inner(role_name)', { count: 'exact' })
                    .eq('user_roles.role_name', 'docente');
                totalTeachersCount = totalT || 0;

                const { count: withCourses } = await supabase
                    .from('user_profiles')
                    .select('*, user_roles!inner(role_name)', { count: 'exact' })
                    .eq('user_roles.role_name', 'docente')
                    .eq('security_course_completed', true)
                    .eq('5s_course_completed', true);
                teachersWithCoursesCount = withCourses || 0;
            }

            // Fetch Coordination Tasks
            let myPendingTasksCount = 0;
            let totalActiveTasksCount = 0;

            try {
                let topicsData = [];
                const { data, error } = await supabase
                    .from('coordination_topics')
                    .select('*');

                if (error) throw error;
                topicsData = data || [];

                if (topicsData.length === 0) {
                    topicsData = JSON.parse(localStorage.getItem('etrr-coordination-topics') || '[]');
                }

                topicsData.forEach(t => {
                    let assignedList = [];
                    if (typeof t.assigned_teachers === 'string') {
                        try { assignedList = JSON.parse(t.assigned_teachers) || []; } catch { assignedList = []; }
                    } else if (Array.isArray(t.assigned_teachers)) {
                        assignedList = t.assigned_teachers;
                    }

                    const isAssigned = assignedList.includes(userProfile.id);
                    const isCreator = t.created_by === userProfile.id;

                    if (role === 'docente') {
                        if ((isAssigned || isCreator) && t.status !== 'Resuelto') {
                            myPendingTasksCount++;
                        }
                    } else {
                        if (t.status !== 'Resuelto') {
                            totalActiveTasksCount++;
                        }
                    }
                });
            } catch {
                const topicsData = JSON.parse(localStorage.getItem('etrr-coordination-topics') || '[]');
                topicsData.forEach(t => {
                    let assignedList = [];
                    if (typeof t.assigned_teachers === 'string') {
                        try { assignedList = JSON.parse(t.assigned_teachers) || []; } catch { assignedList = []; }
                    } else if (Array.isArray(t.assigned_teachers)) {
                        assignedList = t.assigned_teachers;
                    }

                    const isAssigned = assignedList.includes(userProfile.id);
                    const isCreator = t.created_by === userProfile.id;

                    if (role === 'docente') {
                        if ((isAssigned || isCreator) && t.status !== 'Resuelto') {
                            myPendingTasksCount++;
                        }
                    } else {
                        if (t.status !== 'Resuelto') {
                            totalActiveTasksCount++;
                        }
                    }
                });
            }

            setMetrics({
                pendingCards: pendingCardsCount || 0,
                subjectsWithPlanning: planningSubjectsCount || 0,
                totalSubjects: totalSubjectsCount || 0,
                teachersWithCourses: teachersWithCoursesCount || 0,
                totalTeachers: totalTeachersCount || 0,
                coordinationTasksCount: role === 'docente' ? myPendingTasksCount : totalActiveTasksCount,
                myActivitiesCompleted: myActivitiesCompletedCount || 0,
                myActivitiesTotal: myActivitiesTotalCount || 0
            });

        } catch (error) {
            console.error("Error fetching metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-secondary">Cargando métricas...</div>;
    }

    const planningPercentage = metrics.totalSubjects > 0
        ? Math.round((metrics.subjectsWithPlanning / metrics.totalSubjects) * 100)
        : 0;

    const coursesPercentage = role === 'docente'
        ? (metrics.myActivitiesTotal > 0 ? Math.round((metrics.myActivitiesCompleted / metrics.myActivitiesTotal) * 100) : 0)
        : (metrics.totalTeachers > 0 ? Math.round((metrics.teachersWithCourses / metrics.totalTeachers) * 100) : 0);

    const canManageAnnouncements = role === 'coordinador' || role === 'gerente';

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 tracking-tight">Panel General</h2>
                    <p className="text-secondary font-medium">Resumen de métricas, alertas y estado del Nodo Tecnológico.</p>
                </div>
                {canManageAnnouncements && (
                    <button
                        onClick={() => setShowAnnModal(true)}
                        className="py-2.5 px-4 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/10 self-start sm:self-auto shrink-0"
                    >
                        <Plus size={18} />
                        Nuevo Comunicado
                    </button>
                )}
            </header>

            {/* Announcements Board Container */}
            {announcements.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-extrabold text-sm uppercase tracking-wider pl-1">
                        <Megaphone size={16} />
                        <span>Novedades y Anuncios del Nodo</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {announcements.slice(0, 4).map((ann) => (
                            <div 
                                key={ann.id}
                                className={`glass-card relative overflow-hidden flex flex-col p-5 border-l-4 transition-all duration-200 ${
                                    ann.is_pinned 
                                        ? 'border-l-primary bg-primary/[0.02] hover:bg-primary/[0.04]' 
                                        : 'border-l-secondary/30 hover:bg-surface-hover/20'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {ann.is_pinned && (
                                            <span className="shrink-0 inline-flex items-center gap-1 py-0.5 px-1.5 rounded-full text-[9px] font-black bg-primary/20 text-primary border border-primary/20">
                                                <Pin size={8} className="fill-current" />
                                                Fijado
                                            </span>
                                        )}
                                        <h4 className="font-extrabold text-[15px] text-[var(--text-primary)] truncate">
                                            {ann.title}
                                        </h4>
                                    </div>
                                    {canManageAnnouncements && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleEditAnnouncement(ann)}
                                                className="p-1 text-tertiary hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                                title="Editar comunicado"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                                className="p-1 text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer"
                                                title="Eliminar comunicado"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-secondary leading-relaxed font-medium flex-1 mb-4 whitespace-pre-wrap">
                                    {ann.content}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-tertiary pt-3 border-t border-color/40">
                                    <span className="font-bold text-secondary">
                                        Por: {ann.created_by_name || 'Israel Pavelek'}
                                    </span>
                                    <span className="font-mono">
                                        {new Date(ann.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Create/Edit Announcement Modal */}
            {showAnnModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-color/80 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-5 border-b border-color flex justify-between items-center bg-surface-hover/20">
                            <h3 className="text-lg font-black text-[var(--text-primary)]">
                                {editingAnn ? 'Editar Comunicado' : 'Publicar Nuevo Comunicado'}
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowAnnModal(false);
                                    setEditingAnn(null);
                                    setAnnForm({ title: '', content: '', is_pinned: false });
                                }}
                                className="p-1 rounded-lg text-secondary hover:bg-surface-hover hover:text-[var(--text-primary)] transition-all cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAnnouncement} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-1.5">Título del Anuncio</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Entrega de Planificaciones"
                                    value={annForm.title}
                                    onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl bg-main/5 border border-color hover:border-color-hover focus:border-primary focus:bg-surface transition-all text-sm font-semibold outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-1.5">Contenido / Mensaje</label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Escribe el mensaje para los docentes aquí..."
                                    value={annForm.content}
                                    onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl bg-main/5 border border-color hover:border-color-hover focus:border-primary focus:bg-surface transition-all text-sm font-semibold outline-none resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-3.5 py-1">
                                <input
                                    type="checkbox"
                                    id="is_pinned"
                                    checked={annForm.is_pinned}
                                    onChange={(e) => setAnnForm({ ...annForm, is_pinned: e.target.checked })}
                                    className="w-4.5 h-4.5 text-primary border-color rounded focus:ring-primary focus:ring-offset-0"
                                />
                                <label htmlFor="is_pinned" className="text-xs font-bold text-secondary cursor-pointer select-none">
                                    Fijar este anuncio al principio del panel (Pin)
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 pt-3 border-t border-color">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAnnModal(false);
                                        setEditingAnn(null);
                                        setAnnForm({ title: '', content: '', is_pinned: false });
                                    }}
                                    className="py-2.5 px-4 bg-surface-hover hover:bg-surface text-secondary font-black rounded-xl border border-color transition-all text-sm cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="py-2.5 px-5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all text-sm cursor-pointer shadow-md shadow-primary/10"
                                >
                                    {editingAnn ? 'Guardar Cambios' : 'Publicar Anuncio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Red Cards Metric */}
                <div
                    onClick={() => onNavigate('5s')}
                    className="glass-card relative overflow-hidden group cursor-pointer hover:border-error/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-error/10"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertTriangle size={80} className="text-error" />
                    </div>
                    <div className="p-6 relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error border border-error/20">
                                <AlertTriangle size={20} />
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 bg-error/20 border border-error/30 text-error rounded-full uppercase tracking-widest">
                                Atención
                            </span>
                        </div>
                        <h3 className="text-sm font-bold text-secondary text-[var(--text-primary)]/70 mb-1">Tarjetas 5S Pendientes</h3>
                        <div className="flex items-end gap-3">
                            <p className="text-4xl font-black text-[var(--text-primary)]">{metrics.pendingCards}</p>
                        </div>
                        <p className="text-xs text-tertiary mt-2">anomalías sin resolver o en proceso</p>
                    </div>
                    <div className="h-1 w-full bg-error/20 absolute bottom-0 left-0">
                        <div className="h-full bg-error rounded-r-full" style={{ width: metrics.pendingCards > 0 ? '100%' : '0%' }}></div>
                    </div>
                </div>

                {/* Plannings Metric */}
                <div
                    onClick={() => onNavigate(role === 'docente' ? 'mi_perfil' : 'docentes')}
                    className="glass-card relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText size={80} className="text-primary" />
                    </div>
                    <div className="p-6 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 mb-4">
                            <FileText size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]/70 mb-1">
                            {role === 'docente' ? 'Mis Planificaciones' : 'Planificaciones al Día'}
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-black text-[var(--text-primary)]">{metrics.subjectsWithPlanning}</p>
                            <p className="text-lg text-secondary font-medium">/ {metrics.totalSubjects}</p>
                        </div>

                        <div className="w-full bg-surface-hover border border-color/40 rounded-full h-2.5 mt-4 overflow-hidden">
                            <div className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${planningPercentage}%` }}></div>
                        </div>
                        <p className="text-xs text-tertiary mt-2 text-right">{planningPercentage}% completado</p>
                    </div>
                </div>

                {/* Teacher Courses Metric */}
                <div
                    onClick={() => onNavigate(role === 'docente' ? 'mi_perfil' : 'docentes')}
                    className="glass-card relative overflow-hidden group cursor-pointer hover:border-success/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-success/10"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={80} className="text-success" />
                    </div>
                    <div className="p-6 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20 mb-4">
                            <Users size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]/70 mb-1">
                            {role === 'docente' ? 'Mis Actividades' : 'Docentes (Cursos 100%)'}
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-black text-[var(--text-primary)]">
                                {role === 'docente' ? metrics.myActivitiesCompleted : metrics.teachersWithCourses}
                            </p>
                            <p className="text-lg text-secondary font-medium">
                                / {role === 'docente' ? metrics.myActivitiesTotal : metrics.totalTeachers}
                            </p>
                        </div>

                        <div className="w-full bg-surface-hover border border-color/40 rounded-full h-2.5 mt-4 overflow-hidden">
                            <div className="bg-gradient-to-r from-success to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${coursesPercentage}%` }}></div>
                        </div>
                        <p className="text-xs text-tertiary mt-2 text-right">{coursesPercentage}% completado</p>
                    </div>
                </div>

                {/* Coordination Tasks Metric */}
                <div
                    onClick={() => onNavigate('coordinacion')}
                    className="glass-card relative overflow-hidden group cursor-pointer hover:border-accent/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/10"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckSquare size={80} className="text-accent" />
                    </div>
                    <div className="p-6 relative z-10 h-full flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                                <CheckSquare size={20} />
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 bg-surface-hover border border-color/50 text-secondary rounded-full">
                                {role === 'docente' ? 'Asignadas' : 'Institucional'}
                            </span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]/70 mb-1">
                            {role === 'docente' ? 'Mis Tareas (Coordinación)' : 'Tareas de Coordinación'}
                        </h3>
                        <p className="text-4xl font-black text-[var(--text-primary)] mt-1">{metrics.coordinationTasksCount}</p>

                        <div className="mt-auto pt-4">
                            <p className="text-xs text-tertiary flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                {role === 'docente' ? 'Tareas propuestas pendientes de resolución' : 'Total de tareas activas en debate o proceso'}
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="glass-card p-6">
                    <h3 className="text-lg font-bold mb-4 text-[var(--text-primary)] flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        Actividad Reciente (Tarjetas Rojas)
                    </h3>

                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                        <div className="w-12 h-12 rounded-full border border-color flex items-center justify-center mb-3">
                            <AlertTriangle size={20} className="text-tertiary" />
                        </div>
                        <p className="text-secondary text-sm">Próximamente: Historial detallado de movimientos y resoluciones 5S en tiempo real.</p>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="text-lg font-bold mb-4 text-[var(--text-primary)] flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        Estado de Entregas (Planificaciones)
                    </h3>

                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                        <div className="w-12 h-12 rounded-full border border-color flex items-center justify-center mb-3">
                            <FileText size={20} className="text-tertiary" />
                        </div>
                        <p className="text-secondary text-sm">Próximamente: Ranking de materias faltantes y progreso por perfil de docente.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
