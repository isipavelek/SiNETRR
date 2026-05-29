import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ProjectSubmissionDetail from '../components/ProjectSubmissionDetail';
import { 
    Calendar, Plus, Edit2, Trash2, FileText, Image, Search, Filter, X, 
    ExternalLink, Clock, CheckCircle, AlertCircle, ArrowRight, Settings, 
    FolderOpen, Layers, Activity, Info
} from 'lucide-react';

export default function EventsDashboard() {
    const { role, userProfile } = useAuth();
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(true);

    // Event details states
    const [projects, setProjects] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [gallery, setGallery] = useState([]);

    // Filtering projects
    const [searchQuery, setSearchQuery] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('all');
    const [divisionFilter, setDivisionFilter] = useState('all');

    // Modals
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [eventForm, setEventForm] = useState({ name: '', date: '', status: 'Planificado' });
    const [editingEvent, setEditingEvent] = useState(null);

    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [templateForm, setTemplateForm] = useState({ name: '', description: '', template_url: '' });
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Selected project for delivery submission detail modal
    const [selectedProjectForSubmissions, setSelectedProjectForSubmissions] = useState(null);

    const isTeacher = role === 'docente';
    const isCoordinatorOrGerente = role === 'coordinador' || role === 'gerente';

    // Fetch list of events on load
    useEffect(() => {
        fetchEvents();
    }, []);

    // Fetch details whenever selected event changes
    useEffect(() => {
        if (selectedEventId) {
            fetchEventDetails(selectedEventId);
        } else {
            setProjects([]);
            setTemplates([]);
            setSubmissions([]);
            setGallery([]);
            setLoadingDetails(false);
        }
    }, [selectedEventId]);

    const fetchEvents = async (selectIdToSet = null) => {
        setLoadingEvents(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('name', { ascending: true });
            
            if (error) throw error;
            setEvents(data || []);

            if (data && data.length > 0) {
                if (selectIdToSet) {
                    setSelectedEventId(selectIdToSet);
                } else {
                    // Preselect first Active event, otherwise first planificado, otherwise first one
                    const activeEvent = data.find(e => e.status === 'Activo') || 
                                        data.find(e => e.status === 'Planificado') || 
                                        data[0];
                    setSelectedEventId(activeEvent.id);
                }
            } else {
                setSelectedEventId('');
                setLoadingDetails(false);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setLoadingEvents(false);
        }
    };

    const fetchEventDetails = async (eventId) => {
        setLoadingDetails(true);
        try {
            // 1. Fetch Event templates
            const { data: tempd, error: tempe } = await supabase
                .from('event_templates')
                .select('*')
                .eq('event_id', eventId)
                .order('name');
            if (tempe) throw tempe;
            setTemplates(tempd || []);

            // 2. Fetch Projects associated with this event
            const { data: projd, error: proje } = await supabase
                .from('subject_projects')
                .select(`
                    *,
                    subjects (
                        id,
                        name,
                        courses (id, name, level),
                        user_profiles (id, first_name, last_name)
                    )
                `)
                .eq('event_id', eventId)
                .order('name');
            if (proje) throw proje;
            setProjects(projd || []);

            // 3. Fetch submissions and gallery if there are projects
            if (projd && projd.length > 0) {
                const projectIds = projd.map(p => p.id);

                // Submissions
                const { data: subd, error: sube } = await supabase
                    .from('project_submissions')
                    .select('*')
                    .in('project_id', projectIds);
                if (sube) throw sube;
                setSubmissions(subd || []);

                // Gallery
                const { data: gald, error: gale } = await supabase
                    .from('project_gallery')
                    .select('*')
                    .in('project_id', projectIds);
                if (gale) throw gale;
                setGallery(gald || []);
            } else {
                setSubmissions([]);
                setGallery([]);
            }
        } catch (err) {
            console.error('Error loading event details:', err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const selectedEvent = useMemo(() => {
        return events.find(e => e.id === selectedEventId) || null;
    }, [events, selectedEventId]);

    // EVENT CRUD
    const handleOpenCreateEvent = () => {
        setEditingEvent(null);
        setEventForm({ name: '', date: '', status: 'Planificado' });
        setIsEventModalOpen(true);
    };

    const handleOpenEditEvent = () => {
        if (!selectedEvent) return;
        setEditingEvent(selectedEvent);
        setEventForm({ 
            name: selectedEvent.name, 
            date: selectedEvent.date || '', 
            status: selectedEvent.status 
        });
        setIsEventModalOpen(true);
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        if (!eventForm.name.trim()) return;

        try {
            if (editingEvent) {
                // Update
                const { error } = await supabase
                    .from('events')
                    .update({
                        name: eventForm.name,
                        date: eventForm.date || null,
                        status: eventForm.status
                    })
                    .eq('id', editingEvent.id);
                if (error) throw error;
                alert('Evento actualizado correctamente.');
                await fetchEvents(editingEvent.id);
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('events')
                    .insert([{
                        name: eventForm.name,
                        date: eventForm.date || null,
                        status: eventForm.status
                    }])
                    .select();
                if (error) throw error;
                alert('Evento creado correctamente.');
                await fetchEvents(data[0]?.id);
            }
            setIsEventModalOpen(false);
        } catch (err) {
            alert('Error al guardar evento: ' + err.message);
        }
    };

    const handleDeleteEvent = async () => {
        if (!selectedEvent) return;
        if (!confirm(`¿Estás seguro de eliminar el evento "${selectedEvent.name}"? Se desvincularán todos los proyectos y se borrarán plantillas y entregas relacionadas.`)) return;

        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', selectedEvent.id);
            if (error) throw error;
            alert('Evento eliminado correctamente.');
            await fetchEvents();
        } catch (err) {
            alert('Error al eliminar evento: ' + err.message);
        }
    };

    // TEMPLATE CRUD (coordinador/gerente)
    const handleOpenCreateTemplate = () => {
        setEditingTemplate(null);
        setTemplateForm({ name: '', description: '', template_url: '' });
        setIsTemplateModalOpen(true);
    };

    const handleOpenEditTemplate = (temp) => {
        setEditingTemplate(temp);
        setTemplateForm({ 
            name: temp.name, 
            description: temp.description || '', 
            template_url: temp.template_url || '' 
        });
        setIsTemplateModalOpen(true);
    };

    const handleSaveTemplate = async (e) => {
        e.preventDefault();
        if (!templateForm.name.trim() || !selectedEventId) return;

        try {
            if (editingTemplate) {
                const { error } = await supabase
                    .from('event_templates')
                    .update({
                        name: templateForm.name,
                        description: templateForm.description || null,
                        template_url: templateForm.template_url || null
                    })
                    .eq('id', editingTemplate.id);
                if (error) throw error;
                alert('Requerimiento actualizado correctamente.');
            } else {
                const { error } = await supabase
                    .from('event_templates')
                    .insert([{
                        event_id: selectedEventId,
                        name: templateForm.name,
                        description: templateForm.description || null,
                        template_url: templateForm.template_url || null
                    }]);
                if (error) throw error;
                alert('Requerimiento creado correctamente.');
            }
            setIsTemplateModalOpen(false);
            await fetchEventDetails(selectedEventId);
        } catch (err) {
            alert('Error al guardar plantilla: ' + err.message);
        }
    };

    const handleDeleteTemplate = async (tempId, tempName) => {
        if (!confirm(`¿Estás seguro de eliminar el entregable obligatorio "${tempName}"? Se borrarán todas las entregas que los docentes hayan realizado para este requerimiento.`)) return;

        try {
            const { error } = await supabase
                .from('event_templates')
                .delete()
                .eq('id', tempId);
            if (error) throw error;
            alert('Requerimiento eliminado correctamente.');
            await fetchEventDetails(selectedEventId);
        } catch (err) {
            alert('Error al eliminar plantilla: ' + err.message);
        }
    };

    // CLASSIFY PROJECTS AND COMPUTE STATISTICS
    const statistics = useMemo(() => {
        const totalProjects = projects.length;
        const finishedProjects = projects.filter(p => p.status === 'Finalizado').length;
        const totalGalleryCount = gallery.length;

        // Submissions calculation
        const expectedSubs = totalProjects * templates.length;
        const actualSubs = submissions.length;
        const deliveryProgressPercentage = expectedSubs > 0 ? Math.round((actualSubs / expectedSubs) * 100) : 0;

        // Level distribution (Ciclo Básico vs Ciclo Superior)
        // argentino técnico: 1-3 is basic, 4-7 is superior
        let basicLevelCount = 0;
        let superiorLevelCount = 0;

        // Specialty distribution
        let telCount = 0; // Electrónica
        let temCount = 0; // Electromecánica
        let cbCount = 0;  // Ciclo Básico

        // Division distribution
        let divA = 0;
        let divB = 0;
        let divC = 0;
        let divD = 0;
        let divOther = 0;

        projects.forEach(p => {
            const course = p.subjects?.courses;
            const courseName = (course?.name || '').toUpperCase();
            const level = course?.level || 0;

            // Level
            if (level <= 3 && level > 0) {
                basicLevelCount++;
            } else if (level > 3) {
                superiorLevelCount++;
            } else {
                // fallback on name starting with 1, 2, 3
                if (/^[1-3]/i.test(courseName)) {
                    basicLevelCount++;
                } else {
                    superiorLevelCount++;
                }
            }

            // Specialty (TEL, TEM, CB)
            if (courseName.includes('TEL')) {
                telCount++;
            } else if (courseName.includes('TEM')) {
                temCount++;
            } else {
                cbCount++;
            }

            // Division (A, B, C, D)
            const cleanedName = courseName.replace('TEL', '').replace('TEM', '');
            if (cleanedName.includes('A')) divA++;
            else if (cleanedName.includes('B')) divB++;
            else if (cleanedName.includes('C')) divC++;
            else if (cleanedName.includes('D')) divD++;
            else divOther++;
        });

        return {
            totalProjects,
            finishedProjects,
            totalGalleryCount,
            expectedSubs,
            actualSubs,
            deliveryProgressPercentage,
            basicLevelCount,
            superiorLevelCount,
            telCount,
            temCount,
            cbCount,
            divA,
            divB,
            divC,
            divD,
            divOther
        };
    }, [projects, templates, submissions, gallery]);

    // FILTERED PROJECTS FOR DISPLAY
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const courseName = (p.subjects?.courses?.name || '').toUpperCase();
            const subjectName = (p.subjects?.name || '').toLowerCase();
            const teacherName = p.subjects?.user_profiles 
                ? `${p.subjects.user_profiles.first_name} ${p.subjects.user_profiles.last_name}`.toLowerCase()
                : '';
            const projectName = (p.name || '').toLowerCase();

            // Search query
            const matchesSearch = projectName.includes(searchQuery.toLowerCase()) ||
                                 subjectName.includes(searchQuery.toLowerCase()) ||
                                 courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 teacherName.includes(searchQuery.toLowerCase());

            // Specialty filter
            let matchesSpecialty = true;
            if (specialtyFilter !== 'all') {
                const isTEL = courseName.includes('TEL');
                const isTEM = courseName.includes('TEM');
                if (specialtyFilter === 'CB') {
                    matchesSpecialty = !isTEL && !isTEM;
                } else if (specialtyFilter === 'TEL') {
                    matchesSpecialty = isTEL;
                } else if (specialtyFilter === 'TEM') {
                    matchesSpecialty = isTEM;
                }
            }

            // Division filter
            let matchesDivision = true;
            if (divisionFilter !== 'all') {
                const cleanedName = courseName.replace('TEL', '').replace('TEM', '');
                matchesDivision = cleanedName.includes(divisionFilter);
            }

            return matchesSearch && matchesSpecialty && matchesDivision;
        });
    }, [projects, searchQuery, specialtyFilter, divisionFilter]);

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header / Selector Section */}
            <div className="glass-card p-6 md:p-8 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 space-y-2 flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full uppercase tracking-wider">
                            Muestras & Proyectos
                        </span>
                        {selectedEvent && (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                selectedEvent.status === 'Activo' ? 'bg-success/10 text-success border-success/30' :
                                selectedEvent.status === 'Planificado' ? 'bg-warning/10 text-warning border-warning/30' :
                                'bg-secondary/15 text-tertiary border-color/40'
                            }`}>
                                {selectedEvent.status}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Muestra de Proyectos:</h2>
                        <div className="relative inline-block min-w-[200px] max-w-full">
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="bg-main border border-color rounded-xl px-4 py-2 text-base font-extrabold text-[var(--text-primary)] cursor-pointer outline-none w-full shadow-inner"
                                disabled={loadingEvents}
                            >
                                {loadingEvents ? (
                                    <option className="bg-surface text-secondary font-semibold">Cargando eventos...</option>
                                ) : events.length === 0 ? (
                                    <option className="bg-surface text-secondary font-semibold">Sin Eventos Disponibles</option>
                                ) : (
                                    events.map(e => (
                                        <option key={e.id} value={e.id} className="bg-surface text-[var(--text-primary)] font-semibold">
                                            {e.name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    <p className="text-secondary font-medium text-sm">
                        {selectedEvent?.date 
                            ? `Fecha programada: ${new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` 
                            : 'Fecha: A determinar'
                        }
                    </p>
                </div>

                {/* Event administration buttons */}
                <div className="relative z-10 flex gap-2 w-full md:w-auto shrink-0 flex-wrap">
                    {isCoordinatorOrGerente && (
                        <>
                            <button
                                onClick={handleOpenCreateEvent}
                                className="px-4 py-2.5 bg-primary/10 hover:bg-primary hover:text-white border border-primary/20 rounded-xl text-xs font-bold text-primary transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                title="Crear Nuevo Evento"
                            >
                                <Plus size={14} />
                                <span>Nuevo Evento</span>
                            </button>
                            {selectedEvent && (
                                <>
                                    <button
                                        onClick={handleOpenEditEvent}
                                        className="px-4 py-2.5 bg-surface hover:bg-surface-hover border border-color rounded-xl text-xs font-bold text-secondary hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                        title="Editar Evento Seleccionado"
                                    >
                                        <Edit2 size={13} />
                                        <span>Editar</span>
                                    </button>
                                    <button
                                        onClick={handleDeleteEvent}
                                        className="px-4 py-2.5 bg-error/10 hover:bg-error hover:text-white border border-error/20 rounded-xl text-xs font-bold text-error transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                        title="Eliminar Evento"
                                    >
                                        <Trash2 size={13} />
                                        <span>Eliminar</span>
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {loadingDetails ? (
                <div className="py-20 text-center flex items-center justify-center gap-2">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-secondary font-medium">Cargando métricas y proyectos del evento...</span>
                </div>
            ) : !selectedEventId ? (
                <div className="glass-card p-12 text-center text-tertiary">
                    <Calendar size={48} className="mx-auto mb-4 opacity-30" />
                    <h3 className="font-extrabold text-lg text-[var(--text-primary)]">No hay eventos creados</h3>
                    <p className="text-sm text-secondary mt-1">Crea un evento técnico desde la sección de administración para comenzar a asociar proyectos.</p>
                </div>
            ) : (
                <>
                    {/* STATS / METRICS DASHBOARD */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        {/* Metric Card 1: Total projects */}
                        <div className="glass-card p-6 flex flex-col justify-between border-t-4 border-t-primary shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                <FolderOpen size={80} className="text-primary" />
                            </div>
                            <div>
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 mb-3">
                                    <FolderOpen size={18} />
                                </div>
                                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">Proyectos Asociados</h4>
                                <p className="text-3xl font-black text-[var(--text-primary)] mt-1">{statistics.totalProjects}</p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-color/40 flex justify-between text-[11px] text-tertiary">
                                <span>Activos: {statistics.totalProjects - statistics.finishedProjects}</span>
                                <span className="text-success font-semibold">Cerrados: {statistics.finishedProjects}</span>
                            </div>
                        </div>

                        {/* Metric Card 2: Deliverables Progress */}
                        <div className="glass-card p-6 flex flex-col justify-between border-t-4 border-t-accent shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                <FileText size={80} className="text-accent" />
                            </div>
                            <div>
                                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 mb-3">
                                    <FileText size={18} />
                                </div>
                                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">Avance de Entregas</h4>
                                <p className="text-3xl font-black text-[var(--text-primary)] mt-1">{statistics.deliveryProgressPercentage}%</p>
                            </div>
                            <div className="mt-4 space-y-1.5">
                                <div className="w-full bg-surface-hover border border-color/30 rounded-full h-2 overflow-hidden">
                                    <div className="bg-gradient-to-r from-accent to-primary h-full rounded-full transition-all duration-500" style={{ width: `${statistics.deliveryProgressPercentage}%` }}></div>
                                </div>
                                <div className="flex justify-between text-[10px] text-tertiary">
                                    <span>{statistics.actualSubs} cargados</span>
                                    <span>De {statistics.expectedSubs} totales</span>
                                </div>
                            </div>
                        </div>

                        {/* Metric Card 3: Gallery Photos */}
                        <div className="glass-card p-6 flex flex-col justify-between border-t-4 border-t-success shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                <Image size={80} className="text-success" />
                            </div>
                            <div>
                                <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/20 mb-3">
                                    <Image size={18} />
                                </div>
                                <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">Bitácora / Galería</h4>
                                <p className="text-3xl font-black text-[var(--text-primary)] mt-1">{statistics.totalGalleryCount}</p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-color/40 text-[11px] text-tertiary">
                                <span>Fotos y reportes de prototipado cargados</span>
                            </div>
                        </div>

                        {/* Metric Card 4: Event Distributions */}
                        <div className="glass-card p-5 border-t-4 border-t-warning flex flex-col justify-between shadow-sm relative overflow-hidden">
                            <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3 flex items-center gap-1">
                                <Layers size={12} className="text-warning" />
                                Distribución por Ciclo & Orientación
                            </h4>
                            
                            <div className="space-y-3 flex-1 flex flex-col justify-center">
                                {/* Level: Basic vs Superior */}
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold text-secondary mb-1">
                                        <span>Ciclo Básico</span>
                                        <span>{statistics.basicLevelCount} ({statistics.totalProjects > 0 ? Math.round((statistics.basicLevelCount / statistics.totalProjects) * 100) : 0}%)</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-secondary">
                                        <span>Ciclo Superior</span>
                                        <span>{statistics.superiorLevelCount} ({statistics.totalProjects > 0 ? Math.round((statistics.superiorLevelCount / statistics.totalProjects) * 100) : 0}%)</span>
                                    </div>
                                </div>

                                {/* Specialties Tag Bar */}
                                <div className="pt-2 border-t border-color/20 flex flex-wrap gap-1.5">
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md">
                                        TEL: {statistics.telCount}
                                    </span>
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-warning/10 text-warning border border-warning/20 rounded-md">
                                        TEM: {statistics.temCount}
                                    </span>
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded-md">
                                        CB: {statistics.cbCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TWO COLUMNS: TEMPLATE ADMINISTRATION (FOR COORD) & PROJECTS TABLE */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* LEFT/TOP COLUMN: EVENT REQUIRED DOCUMENTATION TEMPLATES */}
                        <div className={`lg:col-span-4 space-y-6 ${!isCoordinatorOrGerente && 'hidden lg:block'}`}>
                            <div className="glass-card p-5 border border-color/40 flex flex-col">
                                <div className="flex justify-between items-center border-b border-color/40 pb-3">
                                    <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                                        <FileText className="text-primary" size={18} />
                                        Entregables Obligatorios
                                    </h3>
                                    {isCoordinatorOrGerente && (
                                        <button
                                            onClick={handleOpenCreateTemplate}
                                            className="p-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white rounded-lg transition-all"
                                            title="Nuevo Requerimiento de Entrega"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="pt-4 space-y-4">
                                    {templates.length === 0 ? (
                                        <div className="text-center py-6 text-tertiary">
                                            <p className="text-xs font-bold">Sin plantillas definidas</p>
                                            <p className="text-[11px] text-secondary mt-1">Define requerimientos de muestra para este evento (ej: Posters, Bitácoras, etc).</p>
                                        </div>
                                    ) : (
                                        templates.map(temp => (
                                            <div key={temp.id} className="p-3 bg-main/30 border border-color/40 rounded-xl space-y-2 relative group">
                                                {isCoordinatorOrGerente && (
                                                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleOpenEditTemplate(temp)}
                                                            className="p-1 text-secondary hover:text-primary hover:bg-primary/10 rounded"
                                                            title="Editar Requerimiento"
                                                        >
                                                            <Edit2 size={11} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTemplate(temp.id, temp.name)}
                                                            className="p-1 text-secondary hover:text-error hover:bg-error/10 rounded"
                                                            title="Eliminar Requerimiento"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    </div>
                                                )}

                                                <h4 className="font-extrabold text-xs text-[var(--text-primary)] pr-12">{temp.name}</h4>
                                                {temp.description && (
                                                    <p className="text-[11px] text-secondary font-medium leading-relaxed">{temp.description}</p>
                                                )}
                                                {temp.template_url && (
                                                    <a 
                                                        href={temp.template_url} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-[9px] font-black text-primary hover:underline"
                                                    >
                                                        Enlace de Plantilla <ExternalLink size={8} />
                                                    </a>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: PROJECT LISTING TABLE */}
                        <div className={`lg:col-span-8 ${!isCoordinatorOrGerente ? 'lg:col-span-12' : ''} space-y-6`}>
                            <div className="glass-card shadow-sm border border-color/40 flex flex-col">
                                
                                {/* Filters Bar */}
                                <div className="p-5 border-b border-color/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-hover/10">
                                    <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                                        <FolderOpen className="text-primary" size={18} />
                                        Proyectos Escolares
                                    </h3>
                                    
                                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                        {/* Search Input */}
                                        <div className="relative grow md:w-60">
                                            <input 
                                                type="text"
                                                placeholder="Buscar proyecto..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="bg-main border border-color text-xs w-full rounded-xl pl-3 pr-8 py-2.5 outline-none focus:ring-1 focus:ring-primary shadow-inner"
                                            />
                                            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary" size={14} />
                                        </div>

                                        {/* Specialty filter */}
                                        <div className="grow md:w-44 select-container">
                                            <select
                                                value={specialtyFilter}
                                                onChange={e => setSpecialtyFilter(e.target.value)}
                                                className="bg-main border border-color text-xs w-full rounded-xl px-2 py-2.5 outline-none focus:ring-1 focus:ring-primary font-bold cursor-pointer"
                                            >
                                                <option value="all" className="bg-surface text-[var(--text-primary)] font-semibold">Orientación (Todas)</option>
                                                <option value="CB" className="bg-surface text-[var(--text-primary)] font-semibold">Ciclo Básico (CB)</option>
                                                <option value="TEL" className="bg-surface text-[var(--text-primary)] font-semibold">Electrónica (TEL)</option>
                                                <option value="TEM" className="bg-surface text-[var(--text-primary)] font-semibold">Electromecánica (TEM)</option>
                                            </select>
                                        </div>

                                        {/* Division filter */}
                                        <div className="grow md:w-36 select-container">
                                            <select
                                                value={divisionFilter}
                                                onChange={e => setDivisionFilter(e.target.value)}
                                                className="bg-main border border-color text-xs w-full rounded-xl px-2 py-2.5 outline-none focus:ring-1 focus:ring-primary font-bold cursor-pointer"
                                            >
                                                <option value="all" className="bg-surface text-[var(--text-primary)] font-semibold">División (Todas)</option>
                                                <option value="A" className="bg-surface text-[var(--text-primary)] font-semibold">A</option>
                                                <option value="B" className="bg-surface text-[var(--text-primary)] font-semibold">B</option>
                                                <option value="C" className="bg-surface text-[var(--text-primary)] font-semibold">C</option>
                                                <option value="D" className="bg-surface text-[var(--text-primary)] font-semibold">D</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Table layout */}
                                <div className="overflow-x-auto">
                                    {filteredProjects.length === 0 ? (
                                        <div className="text-center py-16 text-tertiary">
                                            <FolderOpen className="mx-auto mb-2 opacity-20" size={32} />
                                            <p className="text-sm font-semibold">No se encontraron proyectos</p>
                                            <p className="text-xs text-secondary mt-1">No hay proyectos asociados al evento que coincidan con los filtros aplicados.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="border-b border-color text-secondary font-bold bg-surface-hover/30 uppercase tracking-wider text-[10px]">
                                                    <th className="p-4">Proyecto</th>
                                                    <th className="p-4">Materia / Curso</th>
                                                    <th className="p-4">Docente</th>
                                                    <th className="p-4 text-center">Entregables</th>
                                                    <th className="p-4 text-center">Fotos</th>
                                                    <th className="p-4 text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-color/30 font-medium text-[var(--text-primary)]">
                                                {filteredProjects.map(proj => {
                                                    const courseName = proj.subjects?.courses?.name || 'N/A';
                                                    const subjectName = proj.subjects?.name || 'N/A';
                                                    
                                                    const teacherName = proj.subjects?.user_profiles 
                                                        ? `${proj.subjects.user_profiles.first_name} ${proj.subjects.user_profiles.last_name}`
                                                        : 'Sin Asignar';

                                                    // Calculate this specific project's deliveries
                                                    const projSubs = submissions.filter(s => s.project_id === proj.id).length;
                                                    const totalReq = templates.length;
                                                    
                                                    const isAllDelivered = totalReq > 0 && projSubs === totalReq;
                                                    const isSomeDelivered = totalReq > 0 && projSubs > 0 && projSubs < totalReq;

                                                    // Gallery count
                                                    const galleryCount = gallery.filter(g => g.project_id === proj.id).length;

                                                    return (
                                                        <tr key={proj.id} className="hover:bg-surface-hover/20 transition-colors">
                                                            <td className="p-4">
                                                                <div className="space-y-1">
                                                                    <div className="font-extrabold text-sm text-[var(--text-primary)]">{proj.name}</div>
                                                                    {proj.description && (
                                                                        <p className="text-tertiary line-clamp-1 max-w-[220px]" title={proj.description}>
                                                                            {proj.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="space-y-1">
                                                                    <div className="font-bold">{subjectName}</div>
                                                                    <div className="flex gap-1.5 items-center">
                                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-surface border border-color rounded-md text-secondary">
                                                                            {courseName}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-secondary font-medium">
                                                                {teacherName}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
                                                                        isAllDelivered ? 'bg-success/15 text-success border-success/30' :
                                                                        isSomeDelivered ? 'bg-warning/15 text-warning border-warning/30' :
                                                                        'bg-secondary/15 text-tertiary border-color/40'
                                                                    }`}>
                                                                        {projSubs} / {totalReq}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center text-secondary">
                                                                <div className="inline-flex items-center gap-1 bg-surface-hover/50 px-2 py-1 rounded-lg border border-color/40">
                                                                    <Image size={12} className="text-tertiary" />
                                                                    <span className="font-bold font-mono">{galleryCount}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <button
                                                                    onClick={() => setSelectedProjectForSubmissions({
                                                                        ...proj,
                                                                        subjects: {
                                                                            name: subjectName,
                                                                            courses: { name: courseName }
                                                                        }
                                                                    })}
                                                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary hover:text-white border border-primary/20 rounded-xl text-xs font-bold text-primary transition-all flex items-center justify-center gap-1 mx-auto shadow-sm"
                                                                >
                                                                    <FileText size={12} />
                                                                    <span>Ver Entregas</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}

            {/* EVENT CREATE/EDIT MODAL */}
            {isEventModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">
                                {editingEvent ? 'Editar Evento' : 'Nuevo Evento Técnico'}
                            </h3>
                            <button onClick={() => setIsEventModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Nombre del Evento *</label>
                                <input
                                    type="text"
                                    required
                                    value={eventForm.name}
                                    onChange={e => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej: MAPE 2026, Día de la Educación"
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Fecha del Evento (Opcional)</label>
                                <input
                                    type="date"
                                    value={eventForm.date}
                                    onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Estado</label>
                                <select
                                    value={eventForm.status}
                                    onChange={e => setEventForm(prev => ({ ...prev, status: e.target.value }))}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-bold cursor-pointer"
                                >
                                    <option value="Planificado" className="bg-surface text-[var(--text-primary)] font-semibold">Planificado</option>
                                    <option value="Activo" className="bg-surface text-[var(--text-primary)] font-semibold">Activo</option>
                                    <option value="Finalizado" className="bg-surface text-[var(--text-primary)] font-semibold">Finalizado</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 mt-4"
                            >
                                <CheckCircle size={16} />
                                <span>{editingEvent ? 'Guardar Cambios' : 'Crear Evento'}</span>
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* TEMPLATE CREATE/EDIT MODAL */}
            {isTemplateModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">
                                {editingTemplate ? 'Editar Requerimiento' : 'Nuevo Entregable Obligatorio'}
                            </h3>
                            <button onClick={() => setIsTemplateModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Nombre del Entregable *</label>
                                <input
                                    type="text"
                                    required
                                    value={templateForm.name}
                                    onChange={e => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej: Informe de Proyecto, Póster Muestra"
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Descripción / Instrucciones (Opcional)</label>
                                <textarea
                                    value={templateForm.description}
                                    onChange={e => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Indica las especificaciones de entrega para el docente..."
                                    rows={3}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">URL de la Plantilla de Referencia (Opcional)</label>
                                <input
                                    type="url"
                                    value={templateForm.template_url}
                                    onChange={e => setTemplateForm(prev => ({ ...prev, template_url: e.target.value }))}
                                    placeholder="https://drive.google.com/..."
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 mt-4"
                            >
                                <CheckCircle size={16} />
                                <span>{editingTemplate ? 'Guardar Cambios' : 'Definir Requerimiento'}</span>
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* PROJECT SUBMISSIONS & GALLERY MODAL */}
            {selectedProjectForSubmissions && (
                <ProjectSubmissionDetail 
                    project={selectedProjectForSubmissions} 
                    onClose={() => {
                        setSelectedProjectForSubmissions(null);
                        // Refresh details
                        if (selectedEventId) {
                            fetchEventDetails(selectedEventId);
                        }
                    }}
                />
            )}

        </div>
    );
}
