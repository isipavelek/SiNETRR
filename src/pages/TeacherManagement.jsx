import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, Filter, Edit2, Trash2, LayoutGrid, List, ArrowUp, ArrowDown, ListChecks } from 'lucide-react';
import EvaluationsModal from '../components/EvaluationsModal';
import AddTeacherModal from '../components/AddTeacherModal';
import EditTeacherModal from '../components/EditTeacherModal';
import AddSubjectModal from '../components/AddSubjectModal';
import ActivityManagerModal from '../components/ActivityManagerModal';

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

export default function TeacherManagement({ onViewTeacher }) {
    const { role, userProfile } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const [subjectsCatalog, setSubjectsCatalog] = useState([]);
    const [selectedTeacherForEval, setSelectedTeacherForEval] = useState(null);
    const [filterOrientation, setFilterOrientation] = useState('all'); // 'all', 'Electromecánica', 'Electrónica'
    const [filterLevel, setFilterLevel] = useState('all'); // 'all', 'Básico', 'Superior'
    const [filterName, setFilterName] = useState('');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('teachersViewMode') || 'list'); // 'grid' or 'list'
    const [sortField, setSortField] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');

    useEffect(() => {
        localStorage.setItem('teachersViewMode', viewMode);
    }, [viewMode]);

    // Modal states
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [selectedTeacherForSubject, setSelectedTeacherForSubject] = useState(null);
    const [isEditTeacherOpen, setIsEditTeacherOpen] = useState(false);
    const [teacherToEdit, setTeacherToEdit] = useState(null);
    const [subjectToDelete, setSubjectToDelete] = useState(null);
    const [isActivityManagerOpen, setIsActivityManagerOpen] = useState(false);
    const [teacherActivities, setTeacherActivities] = useState([]);

    useEffect(() => {
        fetchData();
    }, [role, userProfile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all staff profiles to allow client-side filtering
            const { data: teachersData, error: teachersError } = await supabase
                .from('user_profiles')
                .select('*')
                .order('last_name');

            if (teachersError) throw teachersError;

            // 2. Fetch Subjects for those teachers
            const teacherIds = teachersData.map(t => t.id);
            const { data: subjectsData, error: subjectsError } = await supabase
                .from('subjects')
                .select('*, courses(name)')
                .in('teacher_id', teacherIds);

            if (subjectsError) throw subjectsError;

            // 3. Fetch Subjects Catalog for orientation/level derivation
            const { data: catalogData, error: catalogError } = await supabase
                .from('subjects_catalog')
                .select('*');

            if (catalogError) throw catalogError;

            // 4. Fetch Teacher Activities
            const { data: tActivitiesData, error: tActivitiesError } = await supabase
                .from('teacher_activities')
                .select('*')
                .in('teacher_id', teacherIds);

            if (tActivitiesError) throw tActivitiesError;

            setTeachers(teachersData);
            setSubjects(subjectsData);
            setSubjectsCatalog(catalogData || []);
            setTeacherActivities(tActivitiesData || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCourseStatus = async (teacherId, courseField, currentValue) => {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ [courseField]: !currentValue })
                .eq('id', teacherId);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('Error actualizando curso'); }
    };

    const togglePlanningStatus = async (subjectId, currentValue) => {
        try {
            const { error } = await supabase
                .from('subjects')
                .update({ planning_submitted: !currentValue })
                .eq('id', subjectId);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('Error actualizando planificación'); }
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
            fetchData();
        } catch (err) {
            console.error('Error deleting subject:', err);
            alert('Error al quitar la materia.');
            setLoading(false);
        }
    };


    const displayedTeachers = useMemo(() => {
        if (role !== 'coordinador' && role !== 'gerente') return teachers;
        return teachers.filter(t => {
            const teacherSubjects = subjects.filter(s => s.teacher_id === t.id);
            const tOrientations = new Set();
            const tLevels = new Set();

            teacherSubjects.forEach(ts => {
                const catalogMatch = subjectsCatalog.find(c => c.name === ts.name);
                if (catalogMatch) {
                    if (catalogMatch.orientation) tOrientations.add(catalogMatch.orientation);
                    if (catalogMatch.level) tLevels.add(catalogMatch.level);
                }
            });

            // 1. Orientation matching
            let matchesOrientation = true;
            if (filterOrientation !== 'all') {
                matchesOrientation = tOrientations.has(filterOrientation);
            }

            // 2. Level matching
            let matchesLevel = true;
            if (filterLevel !== 'all') {
                matchesLevel = tLevels.has(filterLevel) || tLevels.has(filterLevel === 'Básico' ? 'Básica' : '');
            }

            // 3. Name matching
            let matchesName = true;
            if (filterName.trim() !== '') {
                const searchStr = filterName.toLowerCase();
                const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
                matchesName = fullName.includes(searchStr);
            }

            return matchesOrientation && matchesLevel && matchesName;
        });
    }, [teachers, subjects, subjectsCatalog, role, filterOrientation, filterLevel, filterName]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedTeachers = useMemo(() => {
        return [...displayedTeachers].sort((a, b) => {
            let valA, valB;
            switch (sortField) {
                case 'name':
                    valA = `${a.last_name} ${a.first_name}`.toLowerCase();
                    valB = `${b.last_name} ${b.first_name}`.toLowerCase();
                    break;
                case 'activities': {
                    const tActsA = teacherActivities.filter(ta => ta.teacher_id === a.id);
                    const tActsB = teacherActivities.filter(ta => ta.teacher_id === b.id);
                    valA = tActsA.length > 0 ? tActsA.filter(ta => ta.completed).length / tActsA.length : 0;
                    valB = tActsB.length > 0 ? tActsB.filter(ta => ta.completed).length / tActsB.length : 0;
                    break;
                }
                case 'subjects':
                    valA = subjects.filter(s => s.teacher_id === a.id).length;
                    valB = subjects.filter(s => s.teacher_id === b.id).length;
                    break;
                default:
                    valA = a.last_name; valB = b.last_name;
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [displayedTeachers, sortField, sortDirection, subjects]);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
    );

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            {/* Header Section */}
            <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-2">Gestión de Docentes</h2>
                    <p className="text-secondary font-medium">Monitoreo de trayectoria, cursos de seguridad y entregas de planificaciones.</p>
                </div>
                <div className="flex items-center gap-4 relative z-10 w-full md:w-auto flex-wrap md:flex-nowrap">
                    <div className="flex bg-main/50 border border-color/50 rounded-xl p-1 shadow-inner shrink-0 hidden md:flex">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`} title="Vista de Cuadrícula"><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`} title="Vista de Lista"><List size={18} /></button>
                    </div>
                    {/* Filters Section (Moved down) */}
                    <div className="flex bg-main/50 border border-color/50 rounded-xl p-1 shadow-inner shrink-0 md:hidden">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`} title="Vista de Cuadrícula"><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`} title="Vista de Lista"><List size={18} /></button>
                    </div>
                    {(role === 'coordinador' || role === 'gerente') && (
                        <button
                            onClick={() => setIsActivityManagerOpen(true)}
                            className="btn bg-surface-hover/80 border border-color/50 text-[var(--text-primary)] hover:bg-surface hover:border-color shadow-sm transition-all w-full md:w-auto justify-center flex items-center gap-2 px-4 py-2 rounded-xl"
                        >
                            <ListChecks size={18} className="text-primary" />
                            <span className="font-bold text-sm tracking-wide">Gestionar Actividades</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsAddTeacherOpen(true)}
                        className="btn btn-primary shadow-lg shadow-primary/20 flex items-center gap-2 px-6 py-3 rounded-xl font-bold grow md:grow-0 justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>
                        <span>Nuevo Docente</span>
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            {(role === 'coordinador' || role === 'gerente') && (
                <div className="glass-card p-4 mx-2 md:mx-0">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-tertiary uppercase tracking-wider flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                            Filtros de Búsqueda
                        </h3>
                        {(filterOrientation !== 'all' || filterLevel !== 'all' || filterName) && (
                            <button onClick={() => { setFilterOrientation('all'); setFilterLevel('all'); setFilterName(''); }} className="text-xs text-error hover:text-error-hover font-bold transition-colors">
                                Limpiar Filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            type="text"
                            placeholder="Buscar por nombre o apellido..."
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                            className="bg-main border border-color rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary outline-none"
                        />
                        <select
                            value={filterOrientation}
                            onChange={(e) => setFilterOrientation(e.target.value)}
                            className="bg-main border border-color rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary appearance-none cursor-pointer outline-none"
                        >
                            <option value="all">Todas las Especialidades</option>
                            <option value="Electromecánica">Electromecánica</option>
                            <option value="Electrónica">Electrónica</option>
                        </select>
                        <select
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                            className="bg-main border border-color rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary appearance-none cursor-pointer outline-none"
                        >
                            <option value="all">Todos los Niveles</option>
                            <option value="Básico">Ciclo Básico</option>
                            <option value="Superior">Ciclo Superior</option>
                        </select>
                    </div>
                </div>
            )}

            <div className={viewMode === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 gap-8" : "flex flex-col gap-4 relative"}>
                {viewMode === 'list' && sortedTeachers.length > 0 && (
                    <div className="glass-card flex items-center justify-between p-3 px-5 gap-4 border-b-2 border-color bg-surface/80 backdrop-blur-md sticky top-0 z-20 shadow-sm rounded-none rounded-t-xl mb-[-8px]">
                        <div className="flex items-center gap-4 w-full sm:w-1/3 cursor-pointer group select-none" onClick={() => handleSort('name')}>
                            <span className="text-xs font-bold text-tertiary uppercase tracking-wider flex items-center gap-1 group-hover:text-[var(--text-primary)] transition-colors">
                                Docente
                                {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />)}
                            </span>
                        </div>
                        <div className="flex items-center justify-start sm:justify-center gap-6 w-full sm:w-1/3">
                            <div className="flex flex-col items-center gap-1 cursor-pointer group select-none" onClick={() => handleSort('activities')}>
                                <span className="text-[9px] font-bold text-tertiary uppercase flex items-center gap-1 group-hover:text-[var(--text-primary)] transition-colors">
                                    Actividades {sortField === 'activities' && (sortDirection === 'asc' ? <ArrowUp size={10} className="text-primary" /> : <ArrowDown size={10} className="text-primary" />)}
                                </span>
                            </div>
                            <div className="flex flex-col items-center gap-1 cursor-pointer group select-none" onClick={() => handleSort('subjects')}>
                                <span className="text-[9px] font-bold text-tertiary uppercase flex items-center gap-1 group-hover:text-[var(--text-primary)] transition-colors">
                                    Materias {sortField === 'subjects' && (sortDirection === 'asc' ? <ArrowUp size={10} className="text-primary" /> : <ArrowDown size={10} className="text-primary" />)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-start sm:justify-end w-full sm:w-1/3 gap-3">
                            <span className="text-xs font-bold text-tertiary uppercase tracking-wider">Acciones</span>
                        </div>
                    </div>
                )}
                {sortedTeachers.map(teacher => {
                    const teacherSubjects = subjects.filter(s => s.teacher_id === teacher.id);
                    const totalSubjects = teacherSubjects.length;
                    const planningsSubmitted = teacherSubjects.filter(s => s.planning_submitted).length;
                    
                    const tActs = teacherActivities.filter(ta => ta.teacher_id === teacher.id);
                    const totalActs = tActs.length;
                    const completedActs = tActs.filter(ta => ta.completed).length;

                    if (viewMode === 'list') {
                        return (
                            <div key={teacher.id} className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-color-hover transition-all shadow-sm hover:shadow-md border-l-4 border-l-primary">
                                <div className="flex items-center gap-4 w-full sm:w-1/3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-inner shrink-0">
                                        {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[var(--text-primary)] leading-tight">{teacher.last_name}, {teacher.first_name}</h3>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {(() => {
                                                const { profilesList, specialtyArea } = parseProfiles(teacher.orientation);
                                                return profilesList.map(prof => (
                                                    <span key={prof} className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                                        prof === 'Docente' ? 'bg-primary/10 text-primary border-primary/20' :
                                                        prof === 'Coordinador' ? 'bg-accent/10 text-accent border-accent/20' :
                                                        prof === 'Gerente Técnico' ? 'bg-success/10 text-success border-success/20' :
                                                        prof === 'Pañolero' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' :
                                                        'bg-warning/10 text-warning border-warning/20'
                                                    }`}>
                                                        {prof === 'Especialista' && specialtyArea ? `Esp. en ${specialtyArea}` : prof}
                                                    </span>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-start sm:justify-center gap-6 w-full sm:w-1/3">
                                    <div className="flex flex-col items-center gap-1" title="Actividades Asignadas">
                                        <span className="text-[9px] font-bold text-tertiary uppercase">Actividades</span>
                                        <span className={`text-xs font-bold ${completedActs === totalActs && totalActs > 0 ? 'text-success' : (completedActs > 0 ? 'text-warning' : 'text-error')}`}>{completedActs}/{totalActs}</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1" title="Materias Asignadas">
                                        <span className="text-[9px] font-bold text-tertiary uppercase">Materias</span>
                                        <span className="text-xs font-bold text-[var(--text-primary)]">{totalSubjects}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-start sm:justify-end w-full sm:w-1/3 gap-3">
                                    {(role === 'gerente' || role === 'coordinador') && (
                                        <button
                                            onClick={() => { setTeacherToEdit(teacher); setIsEditTeacherOpen(true); }}
                                            className="w-9 h-9 bg-surface border border-color rounded-xl flex items-center justify-center text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover hover:border-color-hover transition-all shadow-sm shrink-0"
                                            title="Editar Datos"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                    )}
                                    <button onClick={() => onViewTeacher(teacher.id)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-md transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                                        <span>Abrir Perfil</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={teacher.id} className="glass-card flex flex-col relative overflow-hidden group hover:border-color-hover transition-all duration-300 shadow-sm hover:shadow-xl">
                            {/* Card Header Background Decorator */}
                            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-surface-hover/80 to-transparent pointer-events-none"></div>

                            {/* Header info */}
                            <div className={`p-6 border-color/40 relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${viewMode === 'grid' ? 'border-b' : 'border-b lg:border-b-0 lg:border-r lg:w-[35%] shrink-0'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl shadow-inner shrink-0">
                                        {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-xl text-[var(--text-primary)] group-hover:text-primary transition-colors">{teacher.last_name}, {teacher.first_name}</h3>
                                            {(role === 'gerente' || role === 'coordinador') && (
                                                <button
                                                    onClick={() => { setTeacherToEdit(teacher); setIsEditTeacherOpen(true); }}
                                                    className="w-7 h-7 bg-surface border border-color rounded flex items-center justify-center text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover transition-colors shadow-inner"
                                                    title="Editar Datos"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {(() => {
                                                const { profilesList, specialtyArea } = parseProfiles(teacher.orientation);
                                                return profilesList.map(prof => (
                                                    <span key={prof} className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
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
                                            {teacher.coordinator_id === userProfile.id && (
                                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 self-center">Mi Coordinado</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Activities Progress */}
                                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-main/50 border border-color/50 shadow-inner min-w-[120px] grow">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-tertiary uppercase tracking-wider">
                                        <span>Actividades</span>
                                        <span className={completedActs === totalActs && totalActs > 0 ? 'text-success' : 'text-[var(--text-primary)]'}>{completedActs}/{totalActs}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                                        <div className={`h-full ${completedActs === totalActs && totalActs > 0 ? 'bg-success' : 'bg-primary'} transition-all`} style={{ width: totalActs > 0 ? `${(completedActs/totalActs)*100}%` : '0%' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Subjects & Planning list */}
                            <div className={`p-6 flex-grow flex flex-col ${viewMode === 'list' ? 'lg:w-[50%]' : ''}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>
                                        Materias Asignadas <span className="bg-surface-hover border border-color text-secondary px-2 py-0.5 rounded-full">{totalSubjects}</span>
                                    </h4>
                                    <div className="flex items-center gap-3">
                                        {totalSubjects > 0 && (
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-tertiary bg-main/50 px-2.5 py-1 rounded border border-color/40 hidden sm:inline-block">
                                                Entregas: <span className={planningsSubmitted === totalSubjects ? 'text-success font-black' : 'text-warning font-black'}>{planningsSubmitted}/{totalSubjects}</span>
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setSelectedTeacherForSubject(teacher)}
                                            className="w-7 h-7 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-center text-accent hover:bg-accent hover:text-[var(--text-primary)] hover:shadow-md transition-all group-hover:block"
                                            title="Asignar nueva materia"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                </div>

                                {teacherSubjects.length === 0 ? (
                                    <div className="flex-grow flex flex-col items-center justify-center py-8 text-tertiary border border-dashed border-color/50 rounded-xl bg-main/30">
                                        <span className="text-sm font-medium">No tiene materias asignadas</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 flex-grow">
                                        {teacherSubjects.map(sub => (
                                            <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-main/40 p-4 rounded-xl border border-color/40 hover:bg-surface-hover/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-lg text-xs tracking-widest shadow-inner">
                                                        {sub.courses?.name}
                                                    </span>
                                                    <span className="text-sm font-bold text-[var(--text-primary)]">{sub.name}</span>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-color/30">
                                                    <span className="text-[10px] sm:hidden text-secondary uppercase font-bold tracking-wider">Planificación</span>
                                                    <button
                                                        onClick={() => togglePlanningStatus(sub.id, sub.planning_submitted)}
                                                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${sub.planning_submitted
                                                            ? 'bg-success/10 text-success border border-success/30 hover:bg-success/20'
                                                            : 'bg-warning/10 text-warning border border-warning/30 hover:bg-warning hover:text-[var(--text-primary)]'
                                                            }`}
                                                    >
                                                        {sub.planning_submitted ? 'Entregada' : 'Pendiente'}
                                                    </button>
                                                    {(role === 'coordinador' || role === 'gerente') && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setSubjectToDelete({ id: sub.id, name: sub.name, courseName: sub.courses?.name });
                                                            }}
                                                            className="w-8 h-8 sm:w-7 sm:h-7 bg-error/10 border border-error/20 rounded-lg flex items-center justify-center text-error hover:bg-error hover:text-white hover:shadow-md transition-all shrink-0"
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

                            {/* Footer Action */}
                            <div className={`p-4 bg-surface-hover/30 border-color/40 mt-auto flex items-center ${viewMode === 'grid' ? 'border-t' : 'border-t lg:border-t-0 lg:border-l lg:w-[15%] shrink-0'}`}>
                                <button
                                    onClick={() => onViewTeacher(teacher.id)}
                                    className={`w-full py-3 rounded-xl text-sm font-bold text-[var(--text-primary)] bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group/btn ${viewMode === 'list' ? 'lg:h-full lg:flex-col lg:gap-1 lg:text-center px-2' : ''}`}
                                >
                                    <span>Ver Perfil</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover/btn:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6" /></svg>
                                </button>
                            </div>
                        </div>
                    )
                })}

                {displayedTeachers.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 glass-card text-center border-dashed border-2">
                        <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 border border-color text-tertiary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No hay docentes</h3>
                        <p className="text-secondary font-medium">No se encontraron docentes registrados para este filtro.</p>
                    </div>
                )}
            </div>

            {selectedTeacherForEval && (
                <EvaluationsModal
                    teacher={selectedTeacherForEval}
                    onClose={() => setSelectedTeacherForEval(null)}
                />
            )}

            <AddTeacherModal
                isOpen={isAddTeacherOpen}
                onClose={() => setIsAddTeacherOpen(false)}
                onTeacherAdded={fetchData}
            />

            <AddSubjectModal
                isOpen={!!selectedTeacherForSubject}
                teacher={selectedTeacherForSubject}
                onClose={() => setSelectedTeacherForSubject(null)}
                onSubjectAdded={fetchData}
            />

            <EditTeacherModal
                isOpen={isEditTeacherOpen}
                onClose={() => { setIsEditTeacherOpen(false); setTeacherToEdit(null); }}
                teacher={teacherToEdit}
                onTeacherUpdated={fetchData}
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

            {isActivityManagerOpen && (
                <ActivityManagerModal
                    isOpen={isActivityManagerOpen}
                    onClose={() => setIsActivityManagerOpen(false)}
                    onActivityAdded={fetchData}
                    teachers={teachers}
                    subjects={subjects}
                    subjectsCatalog={subjectsCatalog}
                />
            )}
        </div>
    );
}
