import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Edit2, Trash2, Plus, Filter, AlertTriangle, BookOpen, X, Check, Users } from 'lucide-react';

export default function SubjectManagement() {
    const { role } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterLevel, setFilterLevel] = useState('all');
    const [filterOrientation, setFilterOrientation] = useState('all');
    const [pageError, setPageError] = useState(null);
    const [seedSuccess, setSeedSuccess] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [formData, setFormData] = useState({ name: '', abbreviation: '', orientation: '', level: '' });
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    // Cross-reference view state
    const [viewingSubject, setViewingSubject] = useState(null);
    const [subjectDetails, setSubjectDetails] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [newAssignment, setNewAssignment] = useState({ courseId: '', teacherId: '' });
    const [assigning, setAssigning] = useState(false);

    const SEED_DATA = [
        { name: 'Aplicaciones de Electrónica Analógica', abbreviation: 'TE-AEA', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Aplicaciones de Electrónica Digital', abbreviation: 'TE-AED', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Automación', abbreviation: 'TE-AUT', orientation: 'General', level: 'Básico' },
        { name: 'Circuitos Eléctricos 4', abbreviation: 'TE-CE4', orientation: 'General', level: 'Superior' },
        { name: 'Circuitos Eléctricos 5', abbreviation: 'TE-CE5', orientation: 'General', level: 'Superior' },
        { name: 'Dibujo Tecnológico', abbreviation: 'TE-DITEC', orientation: 'General', level: 'Superior' },
        { name: 'Diseño Asistido y Simulación Electrónica', abbreviation: 'TE-DASE', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Electrónica Aplicada', abbreviation: 'TE-EA', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Electrónica Gral', abbreviation: 'TE-ELG', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Electrónica Industrial', abbreviation: 'TE-EI', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Grippers Robóticos', abbreviation: 'TE-GR', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Instalaciones Industriales', abbreviation: 'TE-II', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Instalaciones y Aplicaciones de la Energía', abbreviation: 'TE-IAE', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Instalaciones y Máquinas Eléctricas', abbreviation: 'TE-IME', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Inteligencia Artificial', abbreviation: 'TE-IA', orientation: 'General', level: 'Superior' },
        { name: 'Laboratorio de Mediciones Eléctricas', abbreviation: 'TE-LME', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Laboratorio de Metrología y Control de Calidad', abbreviation: 'TE-LMEyCC', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Lenguajes Electrónicos', abbreviation: 'TE-LE', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Lenguajes Tecnológicos', abbreviation: 'TE-LT', orientation: 'General', level: 'Básico' },
        { name: 'Mantenimiento Electrónico', abbreviation: 'TE-ME', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Mantenimiento y Montaje Electromecánico', abbreviation: 'TE-MyME', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Máquinas Eléctricas', abbreviation: 'TE-ME', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Máquinas Eléctricas 5', abbreviation: 'TE-ME5', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Máquinas Eléctricas y Automatismos', abbreviation: 'TE-MEyA', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Mecánica y Mecanismos', abbreviation: 'TE-MyM', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Montaje de Proyectos Electrónicos', abbreviation: 'TE-MPE', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Prácticas Profesionalizantes', abbreviation: 'TE-PP', orientation: 'General', level: 'Superior' },
        { name: 'Programación', abbreviation: 'TE-PROG', orientation: 'General', level: 'Superior' },
        { name: 'Proyecto y Diseño de Instalaciones Eléctricas', abbreviation: 'TE-PDIE', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Proyecto y Diseño Electromecánico', abbreviation: 'TE-PyDEM', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Proyecto y Diseño Electrónico', abbreviation: 'TE-PyDE', orientation: 'Electrónica', level: 'Superior' },
        { name: 'PT - Ajustes y Estructuras', abbreviation: 'TE-PT_AyE', orientation: 'General', level: 'Básico' },
        { name: 'PT - Electricidad', abbreviation: 'TE-PT_ELEC', orientation: 'General', level: 'Básico' },
        { name: 'PT - Electrónica', abbreviation: 'TE-PT_E', orientation: 'General', level: 'Básico' },
        { name: 'PT - Máquina Herramienta', abbreviation: 'TE-PT_MH', orientation: 'General', level: 'Básico' },
        { name: 'PT - Materiales', abbreviation: 'TE-PT_M', orientation: 'General', level: 'Básico' },
        { name: 'PT - Metrología', abbreviation: 'TE-PT_Met', orientation: 'General', level: 'Básico' },
        { name: 'Resistencia y Ensayo de los Materiales', abbreviation: 'TE-REM', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'SHyPA', abbreviation: 'TE-SHyPA', orientation: 'General', level: 'Superior' },
        { name: 'Sistema de Control', abbreviation: 'TE-SCRL', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Sistemas de Comunicación', abbreviation: 'TE-SCOM', orientation: 'Electrónica', level: 'Superior' },
        { name: 'Sistemas Mecánicos', abbreviation: 'TE-SM', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Sistemas Productivos', abbreviation: 'TE-SP', orientation: 'General', level: 'Superior' },
        { name: 'Sistemas Tecnológicos', abbreviation: 'TE-ST', orientation: 'General', level: 'Básico' },
        { name: 'STEM', abbreviation: 'STEM', orientation: 'General', level: 'Superior' },
        { name: 'STEM.2', abbreviation: 'STEM.2', orientation: 'General', level: 'Superior' },
        { name: 'Tecnología de los Materiales', abbreviation: 'TE-TecMAT', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'TE-Diseño y Procesamiento Mecánico', abbreviation: 'TE-DPM', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Termodinámica y Máquinas Térmicas', abbreviation: 'TE-TYMT', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'TE-Robótica Industrial', abbreviation: 'TE-RI', orientation: 'General', level: 'Superior' },
        { name: 'Electromecánica Gral', abbreviation: 'TE-EMG', orientation: 'Electromecánica', level: 'Superior' },
        { name: 'Coordinación FACT', abbreviation: 'TE-CF', orientation: 'General', level: 'Superior' }
    ];

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        setLoading(true);
        setPageError(null);
        try {
            const { data, error } = await supabase
                .from('subjects_catalog')
                .select('*')
                .order('name');

            if (error) {
                if (error.code === '42P01') {
                    setPageError('La tabla "subjects_catalog" no existe en la base de datos. Por favor, ejecuta el script SQL provisto en el panel de Supabase antes de continuar.');
                }
                throw error;
            }
            setSubjects(data || []);
            setSeedSuccess(false);
        } catch (error) {
            console.error('Error fetching subjects catalog:', error);
            if (error.code !== '42P01') {
                setPageError(`Error al contactar con Supabase: ${error.message || JSON.stringify(error)} (Código: ${error.code || 'Desconocido'})`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar esta materia del catálogo oficial? Solo se debe hacer si ninguna asignatura actual depende de ella.')) return;

        try {
            const { error } = await supabase.from('subjects_catalog').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') {
                    alert('No se puede eliminar: Esta materia está siendo utilizada por un docente o en un registro.');
                } else {
                    throw error;
                }
            } else {
                fetchSubjects();
            }
        } catch (error) {
            console.error('Error deleting subject:', error);
            alert('Error al eliminar la materia.');
        }
    };

    const handleSeedData = async () => {
        setLoading(true);
        setPageError(null);
        setSeedSuccess(false);
        try {
            // First check if table exists by doing a dummy select
            const check = await supabase.from('subjects_catalog').select('id').limit(1);
            if (check.error && check.error.code === '42P01') {
                setPageError('No se puede cargar: La tabla "subjects_catalog" no existe. Debes crearla primero ejecutando el script SQL en Supabase.');
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('subjects_catalog').insert(SEED_DATA);
            if (error) {
                throw error;
            } else {
                setSeedSuccess(true);
                fetchSubjects();
            }
        } catch (error) {
            console.error('Error seeding data:', error);
            setPageError('Error al cargar las materias: ' + (error.message || 'Desconocido'));
        } finally {
            setLoading(false);
        }
    };

    const openModal = (subject = null) => {
        if (subject) {
            setEditingSubject(subject);
            setFormData({
                name: subject.name || '',
                abbreviation: subject.abbreviation || '',
                orientation: subject.orientation || '',
                level: subject.level || ''
            });
        } else {
            setEditingSubject(null);
            setFormData({ name: '', abbreviation: '', orientation: '', level: '' });
        }
        setModalError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalSubmitting(true);
        setModalError('');

        try {
            if (editingSubject) {
                const { error } = await supabase
                    .from('subjects_catalog')
                    .update({
                        name: formData.name,
                        abbreviation: formData.abbreviation,
                        orientation: formData.orientation,
                        level: formData.level
                    })
                    .eq('id', editingSubject.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('subjects_catalog')
                    .insert([{
                        name: formData.name,
                        abbreviation: formData.abbreviation,
                        orientation: formData.orientation,
                        level: formData.level
                    }]);
                if (error) throw error;
            }
            fetchSubjects();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Save error:', error);
            setModalError('Error al guardar la materia. Por favor reintente.');
        } finally {
            setModalSubmitting(false);
        }
    };

    const openDetails = async (subject) => {
        setViewingSubject(subject);
        setDetailsLoading(true);
        setSubjectDetails([]);
        setNewAssignment({ courseId: '', teacherId: '' });

        try {
            const { data, error } = await supabase
                .from('subjects')
                .select(`
                    id,
                    courses(name),
                    user_profiles(first_name, last_name)
                `)
                .eq('name', subject.name);

            if (error) throw error;
            setSubjectDetails(data || []);

            // Lazy fetch courses and teachers list if not loaded yet
            if (courses.length === 0) {
                const { data: coursesData } = await supabase.from('courses').select('id, name').order('level');
                setCourses(coursesData || []);
            }
            if (teachers.length === 0) {
                const { data: teachersData } = await supabase.from('user_profiles').select('id, first_name, last_name').order('last_name');
                setTeachers(teachersData || []);
            }
        } catch (error) {
            console.error('Error fetching subject details:', error);
            alert('Error al cargar los docentes y cursos.');
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleCreateAssignment = async () => {
        if (!newAssignment.courseId || !newAssignment.teacherId || !viewingSubject) return;
        setAssigning(true);
        try {
            const { error } = await supabase.from('subjects').insert([{
                name: viewingSubject.name,
                course_id: newAssignment.courseId,
                teacher_id: newAssignment.teacherId
            }]);
            if (error) throw error;

            // Refresh details list
            const { data, error: refetchError } = await supabase
                .from('subjects')
                .select(`
                    id,
                    courses(name),
                    user_profiles(first_name, last_name)
                `)
                .eq('name', viewingSubject.name);
            if (refetchError) throw refetchError;
            setSubjectDetails(data || []);

            // Reset form
            setNewAssignment({ courseId: '', teacherId: '' });
        } catch (error) {
            console.error('Error creating assignment:', error);
            alert('Error al asignar la materia.');
        } finally {
            setAssigning(false);
        }
    };

    const handleDeleteAssignment = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta asignación?')) return;
        setDetailsLoading(true);
        try {
            const { error } = await supabase.from('subjects').delete().eq('id', id);
            if (error) throw error;

            // Refresh details list
            const { data, error: refetchError } = await supabase
                .from('subjects')
                .select(`
                    id,
                    courses(name),
                    user_profiles(first_name, last_name)
                `)
                .eq('name', viewingSubject.name);
            if (refetchError) throw refetchError;
            setSubjectDetails(data || []);
        } catch (error) {
            console.error('Error deleting assignment:', error);
            alert('Error al eliminar la asignación.');
        } finally {
            setDetailsLoading(false);
        }
    };

    const displayedSubjects = useMemo(() => {
        return subjects.filter(s => {
            let matchLevel = filterLevel === 'all' || s.level === filterLevel;
            let matchOrientation = filterOrientation === 'all' || s.orientation === filterOrientation;
            return matchLevel && matchOrientation;
        });
    }, [subjects, filterLevel, filterOrientation]);

    if (role !== 'coordinador' && role !== 'gerente') {
        return <div className="p-10 text-center text-error font-bold">Acceso Denegado</div>;
    }

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
    );

    return (
        <>
            <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 flex flex-col h-full">
                {/* Header Section */}
                <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)] shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary border border-primary/20 shadow-inner shrink-0">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-1">Catálogo de Materias</h2>
                            <p className="text-secondary font-medium text-sm">Administración del listado general de materias disponibles en la institución.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 relative z-10 w-full md:w-auto flex-wrap md:flex-nowrap">
                        <div className="flex items-center gap-2 bg-main/50 border border-color/50 px-3 py-2 rounded-xl text-sm font-medium shadow-inner grow md:grow-0 overflow-x-auto custom-scrollbar">
                            <Filter size={16} className="text-primary" />
                            <select
                                value={filterOrientation}
                                onChange={(e) => setFilterOrientation(e.target.value)}
                                className="bg-transparent border-none text-sm font-medium text-[var(--text-primary)] focus:ring-0 cursor-pointer appearance-none min-w-[130px]"
                            >
                                <option value="all" className="bg-surface text-[var(--text-primary)] font-bold">Especialidad (Todas)</option>
                                <option value="Electromecánica" className="bg-surface text-[var(--text-primary)]">Electromecánica</option>
                                <option value="Electrónica" className="bg-surface text-[var(--text-primary)]">Electrónica</option>
                                <option value="General" className="bg-surface text-[var(--text-primary)]">General</option>
                            </select>

                            <div className="w-px h-6 bg-color/50 mx-1 shrink-0"></div>

                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="bg-transparent border-none text-sm font-medium text-[var(--text-primary)] focus:ring-0 cursor-pointer appearance-none min-w-[110px]"
                            >
                                <option value="all" className="bg-surface text-[var(--text-primary)] font-bold">Nivel (Todos)</option>
                                <option value="Básico" className="bg-surface text-[var(--text-primary)]">Básico</option>
                                <option value="Superior" className="bg-surface text-[var(--text-primary)]">Superior</option>
                            </select>
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="btn btn-primary shadow-lg shadow-primary/20 flex items-center gap-2 px-6 py-3 rounded-xl font-bold grow md:grow-0 justify-center whitespace-nowrap"
                        >
                            <Plus size={18} />
                            <span>Nueva Materia</span>
                        </button>
                    </div>
                </div>

                {pageError && (
                    <div className="bg-error/10 border-l-4 border-error text-error p-4 rounded-r-xl shadow-sm flex items-start gap-3">
                        <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold">Atención Requerida</h4>
                            <p className="text-sm mt-1">{pageError}</p>
                        </div>
                    </div>
                )}

                {seedSuccess && (
                    <div className="bg-success/10 border-l-4 border-success text-success p-4 rounded-r-xl shadow-sm flex items-start gap-3">
                        <Check className="shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-bold">¡Éxito!</h4>
                            <p className="text-sm mt-1">Se han cargado las materias correctamente.</p>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="glass-card flex-1 overflow-hidden flex flex-col shadow-sm border border-color/50">
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-surface-hover/50 text-tertiary text-xs uppercase tracking-wider border-b border-color/50">
                                    <th className="p-4 font-bold">Asignatura</th>
                                    <th className="p-4 font-bold">Abreviatura</th>
                                    <th className="p-4 font-bold">Orientación</th>
                                    <th className="p-4 font-bold">Nivel</th>
                                    <th className="p-4 font-bold text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-color/40 text-sm">
                                {displayedSubjects.map(subject => (
                                    <tr key={subject.id} className="hover:bg-surface-hover/30 transition-colors group">
                                        <td className="p-4 font-bold text-[var(--text-primary)]">
                                            {subject.name}
                                        </td>
                                        <td className="p-4 text-secondary font-mono">
                                            <span className="bg-main/50 px-2 py-1 rounded border border-color/30">{subject.abbreviation || '-'}</span>
                                        </td>
                                        <td className="p-4 text-secondary">
                                            {subject.orientation}
                                        </td>
                                        <td className="p-4 text-secondary">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${subject.level === 'Básico' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-primary/10 text-primary border-primary/20'
                                                }`}>
                                                {subject.level}
                                            </span>
                                        </td>
                                        <td className="p-4 flex gap-2 justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openDetails(subject)}
                                                className="p-2 bg-surface hover:bg-primary/10 border border-color hover:border-primary/30 rounded-lg text-secondary hover:text-primary transition-colors shadow-sm"
                                                title="Ver Docentes y Cursos"
                                            >
                                                <Users size={16} />
                                            </button>
                                            <button
                                                onClick={() => openModal(subject)}
                                                className="p-2 bg-surface hover:bg-surface-hover border border-color rounded-lg text-secondary hover:text-[var(--text-primary)] transition-colors shadow-sm"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(subject.id)}
                                                className="p-2 bg-surface hover:bg-error/10 border border-color hover:border-error/30 rounded-lg text-secondary hover:text-error transition-colors shadow-sm"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {displayedSubjects.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <AlertTriangle size={48} className="text-warning mb-4 opacity-50" />
                                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No se encontraron materias</h3>
                                <p className="text-secondary font-medium mb-6">No hay registros que coincidan con la búsqueda o el filtro.</p>
                                {subjects.length === 0 && filterLevel === 'all' && filterOrientation === 'all' && !pageError && (
                                    <div className="flex flex-col items-center gap-4">
                                        <button
                                            onClick={handleSeedData}
                                            className="btn btn-primary shadow-lg shadow-primary/20 flex items-center gap-2 px-6 py-3 rounded-xl font-bold justify-center hover:scale-105 transition-transform"
                                        >
                                            <BookOpen size={18} />
                                            <span>Cargar {SEED_DATA.length} Materias Iniciales Automáticamente</span>
                                        </button>
                                        <p className="text-xs text-tertiary max-w-sm text-center">
                                            Si este botón no responde, asegúrate de haber creado la tabla `subjects_catalog` en Supabase.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in-up" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">
                                {editingSubject ? 'Editar Materia' : 'Nueva Materia'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 relative">
                            {modalError && (
                                <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg flex items-center gap-3">
                                    <X size={16} /> <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Nombre de la Asignatura</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                                    placeholder="Ej. Matemática"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Abreviatura (Opcional)</label>
                                <input
                                    type="text"
                                    value={formData.abbreviation}
                                    onChange={e => setFormData({ ...formData, abbreviation: e.target.value })}
                                    className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                                    placeholder="Ej. MAT"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary">Orientación</label>
                                    <select
                                        value={formData.orientation}
                                        onChange={e => setFormData({ ...formData, orientation: e.target.value })}
                                        className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                                        required
                                    >
                                        <option value="" disabled className="bg-surface text-tertiary">Seleccionar...</option>
                                        <option value="General" className="bg-surface text-[var(--text-primary)]">General</option>
                                        <option value="Electrónica" className="bg-surface text-[var(--text-primary)]">Electrónica</option>
                                        <option value="Electromecánica" className="bg-surface text-[var(--text-primary)]">Electromecánica</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary">Nivel</label>
                                    <select
                                        value={formData.level}
                                        onChange={e => setFormData({ ...formData, level: e.target.value })}
                                        className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                                        required
                                    >
                                        <option value="" disabled className="bg-surface text-tertiary">Seleccionar...</option>
                                        <option value="Básico" className="bg-surface text-[var(--text-primary)]">Básico</option>
                                        <option value="Superior" className="bg-surface text-[var(--text-primary)]">Superior</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={modalSubmitting}
                                className="btn btn-primary w-full mt-4 h-12 shadow-lg relative z-10 flex items-center justify-center gap-2"
                            >
                                {modalSubmitting ? 'Guardando...' : <><Check size={18} /> Guardar Materia</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Cross Reference Details Modal */}
            {viewingSubject && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in-up" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-primary/5">
                            <div>
                                <h3 className="font-black text-xl text-[var(--text-primary)] tracking-tight">
                                    {viewingSubject.name}
                                </h3>
                                <div className="flex gap-2 mt-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-main/50 text-secondary border border-color/30">{viewingSubject.abbreviation || '-'}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-main/50 text-secondary border border-color/30">{viewingSubject.orientation}</span>
                                </div>
                            </div>
                            <button onClick={() => setViewingSubject(null)} className="p-2 bg-surface hover:bg-surface-hover border border-color hover:border-error/30 rounded-lg text-secondary hover:text-error transition-colors shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto custom-scrollbar flex-1 relative min-h-[200px]">
                            {detailsLoading ? (
                                <div className="absolute inset-0 flex justify-center items-center">
                                    <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                            ) : subjectDetails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                                    <AlertTriangle size={48} className="text-warning mb-4 opacity-50" />
                                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Sin Asignaciones</h3>
                                    <p className="text-secondary font-medium">Esta materia no tiene docentes ni cursos asignados actualmente.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-surface-hover/50 text-tertiary text-xs uppercase tracking-wider border-b border-color/50 sticky top-0 z-10 backdrop-blur-md">
                                            <th className="p-4 font-bold">Curso</th>
                                            <th className="p-4 font-bold">Docente Asignado</th>
                                            <th className="p-4 font-bold text-right pr-6">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-color/40 text-sm">
                                        {[...subjectDetails].sort((a, b) => (a.courses?.name || '').localeCompare(b.courses?.name || '')).map(detail => (
                                            <tr key={detail.id} className="hover:bg-surface-hover/30 transition-colors">
                                                <td className="p-4 font-bold text-[var(--text-primary)]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                                                            {detail.courses?.name || '-'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-secondary">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-main flex items-center justify-center border border-color font-bold text-xs text-tertiary">
                                                            {(detail.user_profiles?.first_name?.[0] || '') + (detail.user_profiles?.last_name?.[0] || '')}
                                                        </div>
                                                        <span className="font-medium text-[var(--text-primary)]">
                                                            {detail.user_profiles?.last_name || 'Desconocido'}, {detail.user_profiles?.first_name || ''}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right pr-6">
                                                    <button
                                                        onClick={() => handleDeleteAssignment(detail.id)}
                                                        className="w-8 h-8 bg-error/10 hover:bg-error hover:text-white border border-error/20 rounded-xl flex items-center justify-center text-error transition-all shadow-sm ml-auto"
                                                        title="Quitar asignación"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Formulario de Asignación Rápida */}
                        <div className="p-6 bg-surface-hover/30 border-t border-color/50 flex flex-col md:flex-row items-end gap-4 shrink-0">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Curso</label>
                                <select
                                    value={newAssignment.courseId}
                                    onChange={e => setNewAssignment(prev => ({ ...prev, courseId: e.target.value }))}
                                    className="bg-main border border-color text-[var(--text-primary)] w-full py-2.5 px-3 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="" className="bg-surface text-tertiary">Seleccionar curso...</option>
                                    {courses.map(course => (
                                        <option key={course.id} value={course.id} className="bg-surface text-[var(--text-primary)]">
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 w-full">
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-1.5 block">Docente</label>
                                <select
                                    value={newAssignment.teacherId}
                                    onChange={e => setNewAssignment(prev => ({ ...prev, teacherId: e.target.value }))}
                                    className="bg-main border border-color text-[var(--text-primary)] w-full py-2.5 px-3 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                                >
                                    <option value="" className="bg-surface text-tertiary">Seleccionar docente...</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id} className="bg-surface text-[var(--text-primary)]">
                                            {t.last_name}, {t.first_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleCreateAssignment}
                                disabled={assigning || !newAssignment.courseId || !newAssignment.teacherId}
                                className="btn btn-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all w-full md:w-auto h-[46px] justify-center text-white bg-primary hover:bg-primary-hover border-none"
                            >
                                {assigning ? 'Asignando...' : <><Plus size={16} /> Asignar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
