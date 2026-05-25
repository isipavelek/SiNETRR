import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, Clock, Trash2, Plus, ListChecks, Camera } from 'lucide-react';
import AddSubjectModal from '../components/AddSubjectModal';

const parseProfiles = (orientationStr) => {
    let profilesList = ['Docente'];
    let specialtyArea = '';
    if (orientationStr && orientationStr.startsWith('{')) {
        try {
            const parsed = JSON.parse(orientationStr);
            profilesList = parsed.profiles || ['Docente'];
            specialtyArea = parsed.specialtyArea || '';
        } catch (e) {
            console.error(e);
        }
    } else if (orientationStr) {
        profilesList = [orientationStr];
    }
    return { profilesList, specialtyArea };
};

export default function TeacherProfile({ teacherId, onBack }) {
    const { role, userProfile, refreshProfile } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [evaluations, setEvaluations] = useState([]);
    const [activities, setActivities] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileBasic, setProfileBasic] = useState(null);
    const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
    const [subjectToDelete, setSubjectToDelete] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const targetId = teacherId || userProfile?.id;
    const isOwnProfile = targetId === userProfile?.id;

    useEffect(() => {
        if (targetId) {
            fetchMyData();
        }
    }, [targetId]);

    const handleAvatarUpload = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingAvatar(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `profiles/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
            const photoUrl = data.publicUrl;

            // Update database profile
            const { error: dbError } = await supabase
                .from('user_profiles')
                .update({ photo_url: photoUrl })
                .eq('id', targetId);

            if (dbError) throw dbError;

            // Refresh context if self profile
            if (isOwnProfile && refreshProfile) {
                await refreshProfile();
            }

            // Refresh local state
            fetchMyData();
            alert("Foto de perfil actualizada correctamente.");
        } catch (err) {
            console.error("Error updating avatar:", err);
            alert("Hubo un error al actualizar la foto de perfil: " + err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const fetchMyData = async () => {
        setLoading(true);
        try {
            if (teacherId) {
                const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', teacherId).single();
                setProfileBasic(profile);
            } else {
                setProfileBasic(userProfile);
            }

            const { data: subs } = await supabase
                .from('subjects')
                .select('*, courses(name)')
                .eq('teacher_id', targetId);

            const { data: evals } = await supabase
                .from('evaluations')
                .select('*, evaluator:coordinator_id(first_name, last_name)')
                .eq('teacher_id', targetId)
                .order('year', { ascending: false });

            const { data: acts } = await supabase
                .from('teacher_activities')
                .select('*, activities_catalog(name)')
                .eq('teacher_id', targetId);

            if (acts) {
                acts.sort((a, b) => {
                    const nameA = a.activities_catalog?.name || '';
                    const nameB = b.activities_catalog?.name || '';
                    return nameA.localeCompare(nameB);
                });
            }

            const { data: cat } = await supabase.from('activities_catalog').select('*').order('name');

            setSubjects(subs || []);
            setEvaluations(evals || []);
            setActivities(acts || []);
            setCatalog(cat || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const togglePlanning = async (id, currentVal) => {
        await supabase.from('subjects').update({ planning_submitted: !currentVal }).eq('id', id);
        fetchMyData();
    };

    const handleDeleteSubject = async () => {
        if (!subjectToDelete) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', subjectToDelete.id);
            if (error) throw error;
            setSubjectToDelete(null);
            fetchMyData();
        } catch (err) {
            console.error('Error deleting subject:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleActivity = async (id, currentVal) => {
        if (role !== 'coordinador' && role !== 'gerente') return;
        await supabase.from('teacher_activities').update({ completed: !currentVal }).eq('id', id);
        fetchMyData();
    };

    const addActivity = async (catalogId) => {
        if (role !== 'coordinador' && role !== 'gerente') return;
        if (!catalogId) return;
        await supabase.from('teacher_activities').insert([{ teacher_id: targetId, activity_id: catalogId, completed: false }]);
        fetchMyData();
    };

    const removeActivity = async (e, id) => {
        e.stopPropagation();
        if (role !== 'coordinador' && role !== 'gerente') return;
        if (!window.confirm("¿Seguro que deseas quitar esta actividad para este docente?")) return;
        await supabase.from('teacher_activities').delete().eq('id', id);
        fetchMyData();
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
    );

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-8 animate-fade-in-up">
            <header className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden group border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>

                <div className="absolute top-0 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mt-20 pointer-events-none"></div>

                <div className="relative z-10 flex items-center gap-5">
                    <div className="relative group w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-primary/20 shrink-0">
                        {uploadingAvatar ? (
                            <div className="w-full h-full bg-main/60 flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        ) : profileBasic?.photo_url ? (
                            <img src={profileBasic.photo_url} alt={`${profileBasic.first_name} ${profileBasic.last_name}`} className="w-full h-full object-cover border border-primary/20" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[var(--text-primary)] text-2xl font-black">
                                {profileBasic?.first_name?.charAt(0) || 'D'}
                            </div>
                        )}
                        {(isOwnProfile || role === 'coordinador' || role === 'gerente') && (
                            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[9px] font-bold">
                                <Camera size={14} className="mb-0.5" />
                                <span>Subir</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                            </label>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
                                {targetId === userProfile?.id ? 'Mi Perfil Docente' : `Perfil de ${profileBasic?.first_name || ''} ${profileBasic?.last_name || ''}`}
                            </h2>
                            <div className="flex flex-wrap gap-1.5">
                                {(() => {
                                    const { profilesList, specialtyArea } = parseProfiles(profileBasic?.orientation);
                                    return profilesList.map(prof => (
                                        <span key={prof} className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                                            prof === 'Docente' ? 'bg-primary/10 text-primary border-primary/20' :
                                            prof === 'Coordinador' ? 'bg-accent/10 text-accent border-accent/20' :
                                            prof === 'Gerente Técnico' ? 'bg-success/10 text-success border-success/20' :
                                            prof === 'Pañolero' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' :
                                            'bg-warning/10 text-warning border-warning/20'
                                        }`}>
                                            {prof === 'Especialista' && specialtyArea ? `Especialista en ${specialtyArea}` : prof}
                                        </span>
                                    ));
                                })()}
                            </div>
                        </div>
                        <p className="text-secondary font-medium mt-1">{isOwnProfile ? 'Tus cursos obligatorios, materias asignadas y evaluaciones.' : 'Cursos obligatorios, materias asignadas y evaluaciones.'}</p>
                    </div>
                </div>

            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Materias y Planificaciones */}
                <section className="glass-card flex flex-col shadow-sm">
                    <div className="p-6 border-b border-color/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20 shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">{isOwnProfile ? 'Mis Materias' : 'Materias'}</h3>
                        </div>
                        {(role === 'coordinador' || role === 'gerente') && (
                            <button
                                onClick={() => setIsAddSubjectOpen(true)}
                                className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center text-accent hover:bg-accent hover:text-[var(--text-primary)] hover:shadow-md transition-all shrink-0"
                                title="Asignar nueva materia"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>

                    <div className="p-6 flex-grow flex flex-col">
                        {subjects.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-dashed border-color/50 rounded-xl bg-main/30">
                                <div className="w-14 h-14 rounded-full bg-surface-hover border border-color flex items-center justify-center mb-4 shadow-inner">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                </div>
                                <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">Sin asignaciones</h4>
                                <p className="text-sm font-medium text-secondary">{isOwnProfile ? 'No tienes materias asignadas aún en este ciclo lectivo.' : 'El docente no tiene materias asignadas aún en este ciclo lectivo.'}</p>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-grow">
                                {subjects.map(sub => (
                                    <div key={sub.id} className="group relative overflow-hidden bg-main/40 border border-color/40 p-4 rounded-xl hover:bg-surface-hover/30 hover:border-color/60 transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-md">
                                        {/* Status Line Indicator */}
                                        {sub.planning_submitted
                                            ? <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                            : <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-warning"></div>
                                        }

                                        <div className="pl-3">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[10px] font-black px-2.5 py-0.5 bg-primary/10 text-primary rounded-lg border border-primary/20 uppercase tracking-widest shadow-inner">
                                                    {sub.courses?.name}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-primary transition-colors">{sub.name}</h4>
                                        </div>

                                        <div className="flex items-center justify-between pl-3 gap-2">
                                            <button
                                                onClick={() => togglePlanning(sub.id, sub.planning_submitted)}
                                                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 shadow-sm ${sub.planning_submitted
                                                    ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                                                    : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {sub.planning_submitted ? (
                                                    <><CheckCircle size={14} /> Planilla Entregada</>
                                                ) : (
                                                    <><Clock size={14} /> Planificación Pendiente</>
                                                )}
                                            </button>
                                            {(role === 'coordinador' || role === 'gerente') && (
                                                <button
                                                    onClick={() => setSubjectToDelete({ id: sub.id, name: sub.name, courseName: sub.courses?.name })}
                                                    className="w-8 h-8 bg-error/10 border border-error/20 rounded-xl flex items-center justify-center text-error hover:bg-error hover:text-white hover:shadow-md transition-all shrink-0"
                                                    title="Quitar materia al docente"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Actividades y Requisitos */}
                <section className="glass-card flex flex-col shadow-sm">
                    <div className="p-6 border-b border-color/40 flex items-center gap-3">
                        <div className="p-2 bg-success/10 rounded-xl text-success border border-success/20 shadow-inner">
                            <ListChecks size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Actividades</h3>
                    </div>

                    <div className="p-6 flex-grow flex flex-col">
                        {activities.length === 0 && role !== 'coordinador' && role !== 'gerente' ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-dashed border-color/50 rounded-xl bg-main/30">
                                <div className="w-14 h-14 rounded-full bg-surface-hover border border-color flex items-center justify-center mb-4 shadow-inner">
                                    <ListChecks size={24} className="text-tertiary" />
                                </div>
                                <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">Sin actividades</h4>
                                <p className="text-sm font-medium text-secondary">No hay requisitos o actividades asignadas.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-grow">
                                {activities.map(act => {
                                    const canEdit = role === 'coordinador' || role === 'gerente';
                                    return (
                                        <div key={act.id} 
                                             className="group relative overflow-hidden bg-main/40 border border-color/40 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="flex-1">
                                                <h4 className="font-bold text-[var(--text-primary)] mb-1.5">{act.activities_catalog?.name}</h4>
                                                <button
                                                    onClick={() => canEdit && toggleActivity(act.id, act.completed)}
                                                    disabled={!canEdit}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 shadow-sm w-fit ${act.completed ? 'bg-success/10 text-success border-success/30 hover:bg-success/20' : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning hover:text-[var(--text-primary)]'} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                                                >
                                                    {act.completed ? <><CheckCircle size={14} /> Completado</> : <><Clock size={14} /> Pendiente</>}
                                                </button>
                                            </div>
                                            {canEdit && (
                                                <button 
                                                    onClick={(e) => removeActivity(e, act.id)}
                                                    className="shrink-0 p-2 text-error/50 hover:text-error hover:bg-error/10 rounded-xl transition-colors"
                                                    title="Quitar de este docente"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                
                                {(role === 'coordinador' || role === 'gerente') && (
                                    <div className="mt-4 pt-4 border-t border-color/40">
                                        <div className="bg-main/30 border border-dashed border-color/60 p-4 rounded-xl flex flex-col gap-3">
                                            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase">
                                                <Plus size={16} /> Añadir Actividad
                                            </div>
                                            <select 
                                                onChange={(e) => addActivity(e.target.value)}
                                                value=""
                                                className="w-full bg-surface border border-color rounded-xl px-3 py-2 text-xs font-bold text-secondary focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                                            >
                                                <option value="" disabled>Seleccionar del catálogo...</option>
                                                {catalog.filter(c => !activities.some(a => a.activity_id === c.id)).map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Historial de Evaluaciones */}
                <section className="glass-card flex flex-col shadow-sm">
                    <div className="p-6 border-b border-color/40 flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-xl text-accent border border-accent/20 shadow-inner">
                            <Clock size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Últimas Evaluaciones</h3>
                    </div>

                    <div className="p-6 flex-grow flex flex-col">
                        {evaluations.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-dashed border-color/50 rounded-xl bg-main/30">
                                <div className="w-14 h-14 rounded-full bg-surface-hover border border-color flex items-center justify-center mb-4 shadow-inner">
                                    <Clock size={24} className="text-tertiary" />
                                </div>
                                <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">Sin historial</h4>
                                <p className="text-sm font-medium text-secondary">{isOwnProfile ? 'Aún no hay evaluaciones cargadas en tu legajo.' : 'Aún no hay evaluaciones cargadas en su legajo.'}</p>
                            </div>
                        ) : (
                            <div className="space-y-4 flex-grow">
                                {evaluations.map(ev => (
                                    <div key={ev.id} className="relative overflow-hidden bg-main/40 border border-color/40 p-5 rounded-xl hover:bg-surface-hover/30 transition-colors shadow-sm hover:shadow-md">
                                        {ev.archived && (
                                            <div className="absolute top-0 right-0 bg-secondary/10 text-tertiary text-[10px] font-bold px-3 py-1 rounded-bl-xl border-b border-l border-color/50 uppercase tracking-widest shadow-inner">
                                                Archivada
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-tertiary uppercase tracking-widest mb-1.5">Periodo Evaluativo</p>
                                                <h4 className="text-xl font-black text-[var(--text-primary)]">Ciclo {ev.year}</h4>
                                            </div>
                                            <div className="bg-surface-hover/50 border border-color/50 px-4 py-2 rounded-xl text-center shadow-inner mt-1">
                                                <span className="text-3xl font-black text-[var(--text-primary)] drop-shadow-md">{ev.score}</span>
                                                <span className="text-sm font-bold text-tertiary">/10</span>
                                            </div>
                                        </div>

                                        <div className="bg-surface/30 border border-color/30 rounded-xl p-4 my-4 shadow-inner relative">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-color absolute top-2 left-2 opacity-50"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></svg>
                                            <p className="text-sm italic text-secondary relative z-10 pl-6 leading-relaxed">"{ev.comments}"</p>
                                        </div>

                                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-color/40">
                                            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold border border-accent/20 shadow-inner">
                                                {ev.evaluator?.first_name?.charAt(0)}
                                            </div>
                                            <p className="text-xs text-tertiary font-bold uppercase tracking-wider">Evaluador: <span className="text-secondary tracking-normal capitalize">{ev.evaluator?.first_name} {ev.evaluator?.last_name}</span></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <AddSubjectModal
                isOpen={isAddSubjectOpen}
                onClose={() => setIsAddSubjectOpen(false)}
                teacher={profileBasic}
                onSubjectAdded={fetchMyData}
            />

            {/* Modal de Confirmación para Eliminar Materia */}
            {subjectToDelete && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-surface border border-error/50 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative z-[10000]">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4 border border-error/20">
                                <Trash2 size={32} className="text-error" />
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight mb-2">¿Quitar Materia?</h3>
                            <p className="text-secondary text-sm mb-6">
                                ¿Estás seguro que deseas desasignar <span className="font-bold text-[var(--text-primary)]">{subjectToDelete.name}</span> del curso <span className="font-bold text-[var(--text-primary)]">{subjectToDelete.courseName}</span>?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSubjectToDelete(null)}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-secondary bg-surface-hover border border-color hover:text-[var(--text-primary)] transition-all"
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteSubject}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-error hover:bg-error/90 shadow-lg shadow-error/20 transition-all flex justify-center items-center"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : 'Sí, Quitar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
