import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BookOpen, User, CheckCircle, Clock, Search, ChevronRight, LayoutGrid, List } from 'lucide-react';

export default function CoursesList({ onSelectSubject }) {
    const { role } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select(`
                    id,
                    name,
                    planning_submitted,
                    courses (id, name, level),
                    user_profiles (id, first_name, last_name)
                `);
            if (error) throw error;
            setSubjects(data || []);
        } catch (err) {
            console.error('Error fetching subjects for courses:', err);
        } finally {
            setLoading(false);
        }
    };

    // Group subjects by course
    const groupedCourses = useMemo(() => {
        const groups = {};
        
        subjects.forEach(sub => {
            const courseName = sub.courses?.name || 'Sin Asignar';
            const level = sub.courses?.level || 99;
            
            if (!groups[courseName]) {
                groups[courseName] = {
                    name: courseName,
                    level: level,
                    subjects: []
                };
            }
            
            // Filter by search query (subject name or teacher name)
            const teacherName = sub.user_profiles 
                ? `${sub.user_profiles.first_name} ${sub.user_profiles.last_name}`.toLowerCase()
                : '';
            const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 teacherName.includes(searchQuery.toLowerCase()) ||
                                 courseName.toLowerCase().includes(searchQuery.toLowerCase());
                                 
            if (matchesSearch) {
                groups[courseName].subjects.push(sub);
            }
        });

        // Convert to array and sort by level/name
        return Object.values(groups)
            .filter(g => g.subjects.length > 0)
            .sort((a, b) => {
                if (a.level !== b.level) {
                    return a.level - b.level;
                }
                return a.name.localeCompare(b.name);
            });
    }, [subjects, searchQuery]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            {/* Header Section */}
            <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-2">Cursos & Divisiones</h2>
                    <p className="text-secondary font-medium">Visualización y organización de materias agrupadas por curso técnico y división.</p>
                </div>
                <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Buscar materia, docente o curso..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-main border border-color rounded-xl pl-4 pr-10 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
                        />
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                    </div>
                    <div className="flex bg-main/50 border border-color/50 rounded-xl p-1 shadow-inner shrink-0">
                        <button 
                            onClick={() => setViewMode('grid')} 
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`}
                            title="Vista Cuadrícula"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`}
                            title="Vista Lista"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Courses View Grid/List */}
            {groupedCourses.length === 0 ? (
                <div className="glass-card py-20 text-center border-dashed border-2 border-color flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-main flex items-center justify-center mb-4 border border-color shadow-inner text-tertiary">
                        <BookOpen size={28} />
                    </div>
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">No se encontraron materias o cursos</h3>
                    <p className="text-sm text-secondary max-w-sm mt-1">Intente ajustar su búsqueda para encontrar lo que busca.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {groupedCourses.map(course => (
                        <div key={course.name} className="glass-card overflow-hidden shadow-sm hover:shadow-xl border border-color/40 flex flex-col justify-between transition-all duration-300">
                            {/* Card Header */}
                            <div className="p-5 border-b border-color/40 bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                                <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                                    {course.name}
                                </h3>
                                <span className="text-[10px] font-black px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full uppercase tracking-wider">
                                    {course.subjects.length} {course.subjects.length === 1 ? 'Materia' : 'Materias'}
                                </span>
                            </div>

                            {/* Card Body */}
                            <div className="p-5 space-y-4 flex-grow">
                                {course.subjects.map(sub => (
                                    <div 
                                        key={sub.id} 
                                        onClick={() => onSelectSubject(sub.id)}
                                        className="group p-3.5 bg-main/30 hover:bg-primary/5 border border-color/30 hover:border-primary/20 rounded-xl transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-primary transition-colors truncate">
                                                    {sub.name}
                                                </h4>
                                                <div className="flex items-center gap-1.5 mt-1 text-xs text-secondary font-medium">
                                                    <User size={12} className="text-tertiary" />
                                                    <span className="truncate">
                                                        {sub.user_profiles 
                                                            ? `${sub.user_profiles.first_name} ${sub.user_profiles.last_name}`
                                                            : 'Sin docente asignado'
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="shrink-0 p-1 bg-surface border border-color rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                                                <ChevronRight size={14} />
                                            </span>
                                        </div>

                                        {/* Status Row */}
                                        <div className="flex justify-between items-center pt-2 border-t border-color/20 text-[10px] font-bold">
                                            <span className="text-tertiary uppercase tracking-wider">Planificación</span>
                                            {sub.planning_submitted ? (
                                                <span className="text-success flex items-center gap-1">
                                                    <CheckCircle size={12} /> Entregada
                                                </span>
                                            ) : (
                                                <span className="text-warning flex items-center gap-1">
                                                    <Clock size={12} /> Pendiente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card overflow-hidden shadow-sm border border-color/40 divide-y divide-color/40">
                    {groupedCourses.map(course => (
                        <div key={course.name} className="p-6">
                            <h3 className="text-lg font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                                {course.name}
                                <span className="text-xs font-semibold text-tertiary ml-2">
                                    ({course.subjects.length} {course.subjects.length === 1 ? 'materia' : 'materias'})
                                </span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {course.subjects.map(sub => (
                                    <div 
                                        key={sub.id}
                                        onClick={() => onSelectSubject(sub.id)}
                                        className="group p-4 bg-main/30 hover:bg-primary/5 border border-color/30 hover:border-primary/20 rounded-xl transition-all cursor-pointer flex justify-between items-center gap-4"
                                    >
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-primary transition-colors">
                                                {sub.name}
                                            </h4>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-secondary font-medium">
                                                <div className="flex items-center gap-1">
                                                    <User size={12} className="text-tertiary" />
                                                    <span>
                                                        {sub.user_profiles 
                                                            ? `${sub.user_profiles.first_name} ${sub.user_profiles.last_name}`
                                                            : 'Sin docente'
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {sub.planning_submitted ? (
                                                        <span className="text-success flex items-center gap-0.5 font-bold text-[10px] uppercase">
                                                            <CheckCircle size={12} /> Planilla Entregada
                                                        </span>
                                                    ) : (
                                                        <span className="text-warning flex items-center gap-0.5 font-bold text-[10px] uppercase">
                                                            <Clock size={12} /> Planilla Pendiente
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="p-1.5 bg-surface border border-color rounded-lg group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                                            <ChevronRight size={14} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
