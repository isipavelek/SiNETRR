import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ReportModal from '../components/ReportModal';
import { LayoutGrid, List, Trash2, ArrowUp, ArrowDown, Calendar, User, Eye, Search, Filter } from 'lucide-react';

// Helper to format local date
const formatLocalDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('es-AR');
};

export default function RedCardDashboard() {
    const { role, userProfile } = useAuth();
    const navigate = useNavigate();
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState([]);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('redCardsViewMode') || 'list');
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [sortField, setSortField] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');

    // For handling the assignment modal/form inline
    const [assigningCardId, setAssigningCardId] = useState(null);
    const [assigningTeacherId, setAssigningTeacherId] = useState('');
    const [deadlineType, setDeadlineType] = useState('date'); // 'date' or 'days'
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineDays, setDeadlineDays] = useState('');

    // Search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        status: '',
        sector: '',
        subject: '',
        course: '',
        assignedTeacher: ''
    });

    useEffect(() => {
        localStorage.setItem('redCardsViewMode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        fetchCards();
        if (role === 'coordinador' || role === 'gerente') {
            fetchTeachers();
        }
    }, [role]);

    const fetchCards = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('red_cards')
                .select(`
                    *,
                    assignee:responsible_id (first_name, last_name)
                `)
                .neq('subject', 'ANOMALIA')
                .order('created_at', { ascending: false });

            // If it's a teacher, only show their assigned cards
            if (role === 'docente') {
                query = query.eq('responsible_id', userProfile.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setCards(data || []);
        } catch (err) {
            console.error('Error fetching cards:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, first_name, last_name')
                .eq('role_id', (await getRole('docente')));

            if (!error) setTeachers(data || []);
        } catch (e) { console.error(e) }
    };

    const getRole = async (roleName) => {
        const { data } = await supabase.from('user_roles').select('id').eq('role_name', roleName).single();
        return data?.id;
    };

    const updateCardStatus = async (id, status) => {
        try {
            const card = cards.find(c => c.id === id);
            const { error } = await supabase.from('red_cards').update({ status }).eq('id', id);
            if (error) throw error;
            
            // Local state update
            setCards(prev => prev.map(c => c.id === id ? { ...c, status } : c));
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Error al actualizar el estado');
        }
    };

    const updateProgress = async (cardId, percentStr, currentStatus) => {
        try {
            const progressVal = parseInt(percentStr, 10);
            let updateData = { coordinator_notes: percentStr };

            if (progressVal === 100) {
                updateData.status = 'Resuelta';
            } else {
                if (currentStatus === 'Resuelta' || currentStatus === 'Pendiente' || currentStatus === 'Sin Asignar') {
                    updateData.status = 'En Proceso';
                }
            }

            const { error } = await supabase.from('red_cards').update(updateData).eq('id', cardId);
            if (error) throw error;
            fetchCards();
        } catch (err) {
            console.error('Error updating progress:', err);
            alert('Error al actualizar el progreso');
        }
    };

    const handleDeleteCard = async (id) => {
        if (!confirm('¿Está seguro de eliminar esta tarjeta roja? Esta acción no se puede deshacer.')) return;
        try {
            const { error } = await supabase.from('red_cards').delete().eq('id', id);
            if (error) throw error;
            setCards(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error('Error deleting card:', err);
            alert('Error al eliminar tarjeta');
        }
    };

    const startAssigning = (card) => {
        setAssigningCardId(card.id);
        setAssigningTeacherId(card.responsible_id || '');
        setDeadlineType('date');
        setDeadlineDate(card.deadline || '');
        setDeadlineDays('');
    };

    const assignTeacher = async (cardId) => {
        if (!assigningTeacherId) {
            alert('Por favor seleccione un docente.');
            return;
        }

        let calculatedDeadline = null;
        if (deadlineType === 'date' && deadlineDate) {
            calculatedDeadline = deadlineDate;
        } else if (deadlineType === 'days' && deadlineDays) {
            const date = new Date();
            date.setDate(date.getDate() + parseInt(deadlineDays, 10));
            calculatedDeadline = date.toISOString().split('T')[0];
        }

        try {
            const card = cards.find(c => c.id === cardId);
            const currentStatus = card ? card.status : 'Sin Asignar';
            const newStatus = currentStatus === 'Sin Asignar' ? 'En Proceso' : currentStatus;

            const { error } = await supabase
                .from('red_cards')
                .update({
                    responsible_id: assigningTeacherId,
                    deadline: calculatedDeadline,
                    status: newStatus
                })
                .eq('id', cardId);

            if (error) throw error;

            alert('Asignación guardada con éxito.');
            setAssigningCardId(null);
            setAssigningTeacherId('');
            setDeadlineDate('');
            setDeadlineDays('');
            fetchCards();
        } catch (err) {
            console.error('Error assigning teacher:', err);
            alert('Error al asignar docente');
        }
    };

    const unassignTeacher = async (cardId) => {
        if (!confirm('¿Está seguro de remover al docente asignado y volver la tarjeta a "Sin Asignar"?')) return;
        try {
            const { error } = await supabase
                .from('red_cards')
                .update({
                    responsible_id: null,
                    deadline: null,
                    status: 'Sin Asignar'
                })
                .eq('id', cardId);

            if (error) throw error;
            fetchCards();
        } catch (err) {
            console.error('Error unassigning teacher:', err);
            alert('Error al remover asignación');
        }
    };

    const calculateRemainingDays = (deadlineStr) => {
        if (!deadlineStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(deadlineStr);
        const deadlineLocal = new Date(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());
        
        const diffTime = deadlineLocal.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Sorting
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Filters and Search implementation
    const filteredCards = cards.filter(card => {
        const matchesSearch = 
            card.card_number?.toString().includes(searchTerm) ||
            card.placed_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            card.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            card.problem_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            card.element?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            card.subject?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = !filters.status || card.status === filters.status;
        const matchesSector = !filters.sector || card.sector === filters.sector;
        const matchesSubject = !filters.subject || card.subject === filters.subject;
        const matchesCourse = !filters.course || card.course?.toString() === filters.course;
        
        let matchesAssignedTeacher = true;
        if (filters.assignedTeacher) {
            if (filters.assignedTeacher === 'unassigned') {
                matchesAssignedTeacher = !card.responsible_id;
            } else {
                matchesAssignedTeacher = card.responsible_id === filters.assignedTeacher;
            }
        }

        return matchesSearch && matchesStatus && matchesSector && matchesSubject && matchesCourse && matchesAssignedTeacher;
    });

    const sortedCards = [...filteredCards].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'date' || sortField === 'deadline') {
            valA = valA ? new Date(valA).getTime() : 0;
            valB = valB ? new Date(valB).getTime() : 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Unique filter options list
    const uniqueSectors = [...new Set(cards.map(c => c.sector).filter(Boolean))].sort();
    const uniqueSubjects = [...new Set(cards.map(c => c.subject).filter(Boolean))].sort();
    const uniqueCourses = [...new Set(cards.map(c => c.course).filter(Boolean))].sort((a, b) => a - b);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-color pb-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-1">Tarjetas Rojas 5S</h2>
                    <p className="text-secondary text-sm">Administra las Tarjetas Rojas 5S, realiza asignaciones, plazos y seguimientos de avance.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-1 bg-surface-hover/80 p-1 border border-color/50 rounded-lg shadow-sm">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`} title="Vista de Cuadrícula"><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface shadow text-primary' : 'text-secondary hover:text-[var(--text-primary)]'}`} title="Vista de Lista"><List size={18} /></button>
                    </div>
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="btn bg-primary border text-white hover:bg-primary-hover border-transparent shadow-sm transition-all justify-center font-bold text-sm px-5 py-2.5 rounded-xl"
                    >
                        <Calendar size={16} />
                        <span>Generar Reporte</span>
                    </button>
                    <button
                        onClick={fetchCards}
                        className="btn bg-surface border border-color text-[var(--text-primary)] hover:bg-surface-hover shadow-sm transition-all justify-center font-bold text-sm px-5 py-2.5 rounded-xl"
                    >
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="glass-card p-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-tertiary uppercase tracking-wider flex items-center gap-2">
                        <Filter size={14} />
                        Filtros de Búsqueda
                    </h3>
                    {(filters.status || filters.sector || filters.subject || filters.course || filters.assignedTeacher || searchTerm) && (
                        <button 
                            onClick={() => {
                                setSearchTerm('');
                                setFilters({ status: '', sector: '', subject: '', course: '', assignedTeacher: '' });
                            }}
                            className="text-xs font-bold text-primary hover:text-primary-hover transition-colors"
                        >
                            Limpiar Filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                    {/* General Text Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar tarjeta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 py-2 text-xs rounded-xl"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="py-2 text-xs rounded-xl"
                    >
                        <option value="">Todos los Estados</option>
                        <option value="Sin Asignar">Sin Asignar</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Resuelta">Resuelta</option>
                    </select>

                    {/* Sector Filter */}
                    <select
                        value={filters.sector}
                        onChange={(e) => setFilters(prev => ({ ...prev, sector: e.target.value }))}
                        className="py-2 text-xs rounded-xl"
                    >
                        <option value="">Todos los Sectores</option>
                        {uniqueSectors.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    {/* Subject Filter */}
                    <select
                        value={filters.subject}
                        onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
                        className="py-2 text-xs rounded-xl"
                    >
                        <option value="">Todas las Materias</option>
                        {uniqueSubjects.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))}
                    </select>

                    {/* Course Filter */}
                    <select
                        value={filters.course}
                        onChange={(e) => setFilters(prev => ({ ...prev, course: e.target.value }))}
                        className="py-2 text-xs rounded-xl"
                    >
                        <option value="">Todos los Cursos</option>
                        {uniqueCourses.map(c => (
                            <option key={c} value={c}>{c}° Año</option>
                        ))}
                    </select>

                    {/* Assigned Teacher Filter */}
                    {(role === 'coordinador' || role === 'gerente') && (
                        <select
                            value={filters.assignedTeacher}
                            onChange={(e) => setFilters(prev => ({ ...prev, assignedTeacher: e.target.value }))}
                            className="py-2 text-xs rounded-xl"
                        >
                            <option value="">Cualquier Responsable</option>
                            <option value="unassigned">Sin Docente Asignado</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Cards Grid/List */}
            {loading ? (
                <div className="text-center py-20 font-mono text-tertiary">Cargando Tarjetas Rojas...</div>
            ) : sortedCards.length === 0 ? (
                <div className="text-center bg-surface/50 border border-color rounded-2xl py-16 text-tertiary italic">
                    No se encontraron tarjetas rojas con los criterios de búsqueda aplicados.
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                    {sortedCards.map(card => {
                        const isExpanded = expandedCardId === card.id;
                        const isAssigning = assigningCardId === card.id;
                        const remainingDays = calculateRemainingDays(card.deadline);

                        return (
                            <div 
                                key={card.id} 
                                className={`card relative overflow-hidden transition-all duration-300 ${
                                    isExpanded ? 'ring-1 ring-primary/30 shadow-lg' : 'hover:translate-y-[-2px] hover:shadow-md'
                                }`}
                            >
                                {/* Header Details */}
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-extrabold text-primary font-mono">#ID {card.card_number}</span>
                                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-surface-hover border border-color text-secondary">
                                                {card.suggestion_type || 'Acción 5S'}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                card.status === 'Resuelta' ? 'bg-success/10 text-success' :
                                                card.status === 'En Proceso' ? 'bg-warning/10 text-warning' :
                                                'bg-tertiary/10 text-tertiary'
                                            }`}>
                                                {card.status}
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-bold text-[var(--text-primary)]">{card.element}</h4>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tertiary">
                                            <span className="font-semibold text-secondary">Sector: {card.sector}</span>
                                            <span>•</span>
                                            <span>Curso: {card.course}° {card.group_name}</span>
                                            <span>•</span>
                                            <span>Materia: {card.subject}</span>
                                            <span>•</span>
                                            <span>Fecha: {formatLocalDate(card.date)}</span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                                            className="p-1.5 text-secondary hover:text-primary bg-surface-hover/50 hover:bg-surface-hover border border-color/40 rounded-lg transition-colors"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        {(role === 'coordinador' || role === 'gerente') && (
                                            <button 
                                                onClick={() => handleDeleteCard(card.id)}
                                                className="p-1.5 text-tertiary hover:text-error bg-surface-hover/50 hover:bg-surface-hover border border-color/40 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Content Details */}
                                {(viewMode === 'grid' || isExpanded) && (
                                    <div className="mt-4 pt-4 border-t border-color space-y-4 animate-fade-in-up">
                                        {/* Description */}
                                        <div className="bg-surface-hover/30 p-3.5 rounded-xl border border-color/40">
                                            <h5 className="text-[10px] uppercase font-black text-tertiary tracking-wider mb-1">Descripción del problema</h5>
                                            <p className="text-sm font-medium text-[var(--text-secondary)]">{card.problem_description}</p>
                                            
                                            {card.explicit_suggestion && (
                                                <div className="mt-2.5 pt-2 border-t border-color/30">
                                                    <h5 className="text-[10px] uppercase font-black text-tertiary tracking-wider mb-0.5">Sugerencia de Acción</h5>
                                                    <p className="text-xs italic text-secondary">"{card.explicit_suggestion}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Photo evidence if exists */}
                                        {card.photo_url && (
                                            <div className="space-y-3 mt-3 pt-3 border-t border-color/30">
                                                <h5 className="text-[10px] uppercase font-black text-tertiary tracking-wider">Evidencia Fotográfica</h5>
                                                {card.photo_url.includes('sharepoint.com') || card.photo_url.includes('onedrive') ? (
                                                    <div className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                                                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-image"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="10" cy="12" r="2"/><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"/></svg>
                                                        </div>
                                                        <div className="flex-1 text-center sm:text-left space-y-1">
                                                            <p className="text-xs font-bold text-[var(--text-primary)]">Foto en Microsoft OneDrive / SharePoint</p>
                                                            <p className="text-[10px] text-secondary">Para ver la evidencia, abre el enlace e inicia sesión con tu cuenta escolar.</p>
                                                        </div>
                                                        <a 
                                                            href={card.photo_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="btn bg-primary text-white hover:bg-primary-hover shadow-sm font-bold text-xs px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center"
                                                        >
                                                            <span>Ver Foto</span>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="rounded-xl overflow-hidden border border-color max-w-md mx-auto bg-surface-hover/30 relative shadow-sm">
                                                            <img 
                                                                src={card.photo_url} 
                                                                alt="Evidencia" 
                                                                className="w-full h-auto max-h-80 object-contain mx-auto"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    const parent = e.target.parentElement;
                                                                    if (parent && !parent.querySelector('.img-error-fallback')) {
                                                                        const fallback = document.createElement('div');
                                                                        fallback.className = "img-error-fallback p-4 text-center text-xs text-tertiary italic";
                                                                        fallback.innerText = "No se pudo previsualizar la imagen directamente.";
                                                                        parent.appendChild(fallback);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-center">
                                                            <a 
                                                                href={card.photo_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 py-1 px-3 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/10 transition-colors"
                                                            >
                                                                <span>Abrir foto completa</span>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Reporter / Email */}
                                        <div className="flex items-center gap-2 text-xs text-secondary font-medium">
                                            <User size={14} className="text-tertiary" />
                                            <span>Reportado por: <strong className="text-[var(--text-primary)]">{card.placed_by || 'Colaborador ETRR'}</strong></span>
                                            <span>•</span>
                                            <span>Docente de Clase: <strong className="text-[var(--text-primary)]">{card.teacher_responsible || 'No definido'}</strong></span>
                                        </div>

                                        {/* Assignment and deadline info */}
                                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <h5 className="text-[10px] uppercase font-black text-primary tracking-wider mb-1">Docente Responsable 5S</h5>
                                                {card.assignee ? (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-bold text-[var(--text-primary)]">
                                                            {card.assignee.last_name}, {card.assignee.first_name}
                                                        </span>
                                                        {(role === 'coordinador' || role === 'gerente') && (
                                                            <div className="flex gap-2.5">
                                                                <button 
                                                                    onClick={() => startAssigning(card)} 
                                                                    className="text-xs text-primary hover:underline font-bold"
                                                                >
                                                                    Editar
                                                                </button>
                                                                <button 
                                                                    onClick={() => unassignTeacher(card.id)} 
                                                                    className="text-xs text-error hover:underline font-bold"
                                                                >
                                                                    Remover
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <span className="text-xs font-semibold text-tertiary italic">Sin docente asignado</span>
                                                        {(role === 'coordinador' || role === 'gerente') && !isAssigning && (
                                                            <button 
                                                                onClick={() => startAssigning(card)}
                                                                className="text-xs text-primary hover:underline font-bold ml-3"
                                                            >
                                                                Asignar Docente
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <h5 className="text-[10px] uppercase font-black text-primary tracking-wider mb-1">Fecha Límite Comprometida</h5>
                                                {card.deadline ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                                                            {formatLocalDate(card.deadline)}
                                                        </span>
                                                        <span className={`text-[10px] font-bold ${
                                                            remainingDays === null ? 'text-secondary' :
                                                            card.status === 'Resuelta' ? 'text-success' :
                                                            remainingDays < 0 ? 'text-error animate-pulse' :
                                                            remainingDays <= 3 ? 'text-warning font-bold' :
                                                            'text-success'
                                                        }`}>
                                                            {card.status === 'Resuelta' ? 'Completado' :
                                                             remainingDays === 0 ? '¡Vence hoy!' :
                                                             remainingDays < 0 ? `Vencido hace ${Math.abs(remainingDays)} días` :
                                                             `${remainingDays} días restantes`}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-tertiary italic font-semibold">Sin fecha asignada</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Inline assignment panel */}
                                        {isAssigning && (
                                            <div className="p-4 bg-surface rounded-xl border border-color space-y-3">
                                                <h5 className="text-xs font-bold text-[var(--text-primary)]">Asignar Docente y Plazo</h5>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Docente Responsable</label>
                                                        <select
                                                            value={assigningTeacherId}
                                                            onChange={(e) => setAssigningTeacherId(e.target.value)}
                                                            className="text-xs py-1.5 rounded-lg border-color bg-main"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {teachers.map(t => (
                                                                <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Definir plazo en:</label>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                type="button"
                                                                onClick={() => setDeadlineType('date')}
                                                                className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition-colors ${
                                                                    deadlineType === 'date' ? 'bg-primary border-primary text-white' : 'border-color hover:bg-surface-hover text-secondary'
                                                                }`}
                                                            >
                                                                Fecha
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setDeadlineType('days')}
                                                                className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition-colors ${
                                                                    deadlineType === 'days' ? 'bg-primary border-primary text-white' : 'border-color hover:bg-surface-hover text-secondary'
                                                                }`}
                                                            >
                                                                Días Faltantes
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    {deadlineType === 'date' ? (
                                                        <div>
                                                            <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Seleccionar Fecha Límite</label>
                                                            <input 
                                                                type="date" 
                                                                value={deadlineDate}
                                                                onChange={(e) => setDeadlineDate(e.target.value)}
                                                                className="text-xs py-1.5 rounded-lg border-color"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Cantidad de días desde hoy</label>
                                                            <input 
                                                                type="number" 
                                                                placeholder="Ej: 10"
                                                                value={deadlineDays}
                                                                onChange={(e) => setDeadlineDays(e.target.value)}
                                                                className="text-xs py-1.5 rounded-lg border-color"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-end gap-2 pt-2 border-t border-color">
                                                    <button 
                                                        onClick={() => setAssigningCardId(null)}
                                                        className="px-3 py-1.5 text-xs border border-color rounded-lg font-bold text-secondary hover:bg-surface-hover"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button 
                                                        onClick={() => assignTeacher(card.id)}
                                                        className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg font-extrabold hover:bg-primary-hover shadow-sm"
                                                    >
                                                        Confirmar
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Progress stepper */}
                                        {card.responsible_id && (
                                            <div className="pt-2 border-t border-color/40">
                                                <h5 className="text-[10px] uppercase font-black text-tertiary tracking-wider mb-2">Porcentaje de Avance</h5>
                                                {role === 'gerente' || role === 'coordinador' || userProfile?.id === card.responsible_id ? (
                                                    <div className="flex items-center justify-between gap-1 border border-color rounded-xl p-1 bg-surface-hover/30">
                                                        {['0', '25', '50', '75', '100'].map((pct) => {
                                                            const isSelected = (card.coordinator_notes || '0') === pct;
                                                            return (
                                                                <button
                                                                    key={pct}
                                                                    onClick={() => updateProgress(card.id, pct, card.status)}
                                                                    className={`flex-1 text-center py-1.5 text-xs font-black rounded-lg transition-all ${
                                                                        isSelected 
                                                                            ? 'bg-primary text-white shadow' 
                                                                            : 'text-secondary hover:bg-surface-hover'
                                                                    }`}
                                                                >
                                                                    {pct}%
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="w-full bg-main rounded-full h-3 border border-color overflow-hidden">
                                                        <div 
                                                            style={{ width: `${card.coordinator_notes || '0'}%` }}
                                                            className="bg-primary h-full transition-all duration-500 shadow-sm"
                                                        />
                                                        <span className="text-[10px] font-bold text-secondary mt-1 block">
                                                            {card.coordinator_notes || '0'}% completado (Vista de Lectura)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Print Modal */}
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onGenerate={(start, end, sector) => {
                    navigate(`/reporte-5s?start=${start}&end=${end}${sector ? `&sector=${encodeURIComponent(sector)}` : ''}`);
                }}
            />
        </div>
    );
}
