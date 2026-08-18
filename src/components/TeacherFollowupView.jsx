import { useState, useMemo } from 'react';
import { 
    Search, User, Plus, Trash2, CheckCircle2, AlertTriangle, 
    CheckSquare, Square, Filter, ArrowUpDown, Info, ThumbsUp, Save
} from 'lucide-react';

export default function TeacherFollowupView({ teachers, coordinators, followups, onUpdateFollowup }) {
    const [filterCoordinator, setFilterCoordinator] = useState('all');
    const [filterClassification, setFilterClassification] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState('name'); // 'name', 'status', 'checklist'
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'

    // Local inputs for adding checklist items per teacher
    const [newItemTexts, setNewItemTexts] = useState({});
    // Local state to show brief "Saved" confirmation for notes
    const [savedNotesStatus, setSavedNotesStatus] = useState({});

    // Helper to get or build default follow-up data for a teacher
    const getFollowup = (teacherId) => {
        const found = followups.find(f => f.teacher_id === teacherId);
        return found || {
            teacher_id: teacherId,
            classification: 'SPOT',
            performance_status: 'Conforme',
            notes: '',
            checklist: []
        };
    };

    // Handle updates for a teacher's follow-up record
    const handleFieldChange = (teacherId, fieldName, value) => {
        const current = getFollowup(teacherId);
        const updated = {
            ...current,
            [fieldName]: value,
            updated_at: new Date().toISOString()
        };
        onUpdateFollowup(updated);
    };

    // Checklist actions
    const handleAddChecklistItem = (teacherId) => {
        const text = (newItemTexts[teacherId] || '').trim();
        if (!text) return;

        const current = getFollowup(teacherId);
        const newItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text,
            completed: false
        };

        const updatedChecklist = [...(current.checklist || []), newItem];
        handleFieldChange(teacherId, 'checklist', updatedChecklist);

        // Clear local input
        setNewItemTexts({
            ...newItemTexts,
            [teacherId]: ''
        });
    };

    const handleToggleChecklistItem = (teacherId, itemId) => {
        const current = getFollowup(teacherId);
        const updatedChecklist = (current.checklist || []).map(item => 
            item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        handleFieldChange(teacherId, 'checklist', updatedChecklist);
    };

    const handleDeleteChecklistItem = (teacherId, itemId) => {
        const current = getFollowup(teacherId);
        const updatedChecklist = (current.checklist || []).filter(item => item.id !== itemId);
        handleFieldChange(teacherId, 'checklist', updatedChecklist);
    };

    const handleNotesBlur = (teacherId, notesText) => {
        const current = getFollowup(teacherId);
        if (current.notes !== notesText) {
            handleFieldChange(teacherId, 'notes', notesText);
            
            // Show brief "Guardado" feedback
            setSavedNotesStatus(prev => ({ ...prev, [teacherId]: true }));
            setTimeout(() => {
                setSavedNotesStatus(prev => ({ ...prev, [teacherId]: false }));
            }, 1500);
        }
    };

    // Filtering & Sorting
    const filteredTeachers = useMemo(() => {
        return teachers.filter(t => {
            const followup = getFollowup(t.id);
            
            // 1. Search term
            const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
            if (searchTerm && !fullName.includes(searchTerm.toLowerCase())) {
                return false;
            }

            // 2. Coordinator filter
            if (filterCoordinator !== 'all' && t.coordinator_id !== filterCoordinator) {
                return false;
            }

            // 3. Classification filter
            if (filterClassification !== 'all' && followup.classification !== filterClassification) {
                return false;
            }

            // 4. Status filter
            if (filterStatus !== 'all' && followup.performance_status !== filterStatus) {
                return false;
            }

            return true;
        });
    }, [teachers, followups, searchTerm, filterCoordinator, filterClassification, filterStatus]);

    const sortedTeachers = useMemo(() => {
        return [...filteredTeachers].sort((a, b) => {
            const fA = getFollowup(a.id);
            const fB = getFollowup(b.id);
            let valA, valB;

            switch (sortField) {
                case 'name':
                    valA = `${a.last_name} ${a.first_name}`.toLowerCase();
                    valB = `${b.last_name} ${b.first_name}`.toLowerCase();
                    break;
                case 'status':
                    // Put "Acciones para mejorar" first or "Conforme" first
                    valA = fA.performance_status;
                    valB = fB.performance_status;
                    break;
                case 'checklist': {
                    // Sort by completion percentage
                    const totalA = fA.checklist?.length || 0;
                    const completedA = fA.checklist?.filter(item => item.completed).length || 0;
                    valA = totalA > 0 ? (completedA / totalA) : -1; // -1 for no items so they can be sent to bottom or top

                    const totalB = fB.checklist?.length || 0;
                    const completedB = fB.checklist?.filter(item => item.completed).length || 0;
                    valB = totalB > 0 ? (completedB / totalB) : -1;
                    break;
                }
                default:
                    valA = a.last_name;
                    valB = b.last_name;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredTeachers, followups, sortField, sortDirection]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="space-y-6">
            {/* Filter Toolbar */}
            <div className="glass-card p-5 border border-color/40 shadow-md">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-color/30">
                    <h3 className="text-sm font-bold text-tertiary uppercase tracking-wider flex items-center gap-2">
                        <Filter size={16} className="text-primary" />
                        Filtros de Seguimiento Interno
                    </h3>
                    <span className="text-xs font-semibold text-secondary">
                        {sortedTeachers.length} de {teachers.length} docentes
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Search by Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-secondary">Buscar Docente</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Nombre o apellido..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-main border border-color rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary w-full outline-none"
                            />
                            <Search className="absolute left-3 top-2.5 text-tertiary" size={16} />
                        </div>
                    </div>

                    {/* Filter by Coordinator */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-secondary">Coordinador Asignado</label>
                        <select
                            value={filterCoordinator}
                            onChange={(e) => setFilterCoordinator(e.target.value)}
                            className="bg-main border border-color rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="all">Todos los Coordinadores</option>
                            {coordinators.map(coord => (
                                <option key={coord.id} value={coord.id}>
                                    {coord.first_name} {coord.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Classification */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-secondary">Clasificación</label>
                        <select
                            value={filterClassification}
                            onChange={(e) => setFilterClassification(e.target.value)}
                            className="bg-main border border-color rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="all">Todas las Categorías</option>
                            <option value="SPOT">SPOT</option>
                            <option value="FULL TIME">FULL TIME</option>
                            <option value="ESPECIALISTA">ESPECIALISTA</option>
                        </select>
                    </div>

                    {/* Filter by Performance Status */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-secondary">Estado Desempeño</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-main border border-color rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="all">Todos los Estados</option>
                            <option value="Conforme">Conforme</option>
                            <option value="Acciones para mejorar">Acciones para mejorar</option>
                        </select>
                    </div>
                </div>

                {/* Sorting options */}
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-color/30 text-xs font-bold text-secondary">
                    <span className="text-tertiary flex items-center gap-1 uppercase tracking-wider text-[10px]">
                        <ArrowUpDown size={12} /> Ordenar por:
                    </span>
                    <button 
                        onClick={() => handleSort('name')}
                        className={`px-3 py-1.5 rounded-lg border transition-all ${sortField === 'name' ? 'bg-primary/15 border-primary/30 text-primary' : 'border-color/60 hover:bg-surface-hover'}`}
                    >
                        Nombre {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                    <button 
                        onClick={() => handleSort('status')}
                        className={`px-3 py-1.5 rounded-lg border transition-all ${sortField === 'status' ? 'bg-primary/15 border-primary/30 text-primary' : 'border-color/60 hover:bg-surface-hover'}`}
                    >
                        Acciones Pendientes {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                    <button 
                        onClick={() => handleSort('checklist')}
                        className={`px-3 py-1.5 rounded-lg border transition-all ${sortField === 'checklist' ? 'bg-primary/15 border-primary/30 text-primary' : 'border-color/60 hover:bg-surface-hover'}`}
                    >
                        Avance de Checklist {sortField === 'checklist' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                </div>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedTeachers.map(teacher => {
                    const fup = getFollowup(teacher.id);
                    const coord = coordinators.find(c => c.id === teacher.coordinator_id);
                    
                    const totalChecklist = fup.checklist?.length || 0;
                    const completedChecklist = fup.checklist?.filter(item => item.completed).length || 0;
                    const percentage = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

                    return (
                        <div 
                            key={teacher.id}
                            className="glass-card p-6 flex flex-col justify-between border border-color/40 hover:border-primary/30 shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl relative overflow-hidden bg-surface/90"
                        >
                            {/* Card Background Decorator */}
                            <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none transition-all ${
                                fup.performance_status === 'Acciones para mejorar' 
                                    ? 'bg-warning/15' 
                                    : 'bg-success/15'
                            }`}></div>

                            {/* Card Content */}
                            <div>
                                {/* Header (Avatar + Name) */}
                                <div className="flex items-center gap-3.5 mb-5 pb-3 border-b border-color/20 relative z-10">
                                    {teacher.photo_url ? (
                                        <img 
                                            src={teacher.photo_url} 
                                            alt={`${teacher.first_name} ${teacher.last_name}`} 
                                            className="w-11 h-11 rounded-full object-cover border border-primary/10 shadow-inner" 
                                        />
                                    ) : (
                                        <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-inner">
                                            {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-extrabold text-[var(--text-primary)] text-base truncate leading-tight">
                                            {teacher.last_name}, {teacher.first_name}
                                        </h4>
                                        <p className="text-[11px] text-tertiary font-semibold truncate mt-0.5">
                                            Coordinador: <span className="text-secondary">{coord ? `${coord.first_name} ${coord.last_name}` : 'Sin asignar'}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Category Selector (SPOT, FULL TIME, ESPECIALISTA) */}
                                <div className="space-y-1.5 mb-4 relative z-10">
                                    <label className="text-[10px] font-black text-tertiary uppercase tracking-widest block">Clasificación General</label>
                                    <div className="grid grid-cols-3 gap-1.5 bg-main/40 border border-color/40 rounded-xl p-1 shadow-inner">
                                        {['SPOT', 'FULL TIME', 'ESPECIALISTA'].map(cat => {
                                            const isActive = fup.classification === cat;
                                            let activeStyle = '';
                                            if (isActive) {
                                                if (cat === 'SPOT') activeStyle = 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 dark:text-cyan-400 font-extrabold shadow-sm';
                                                else if (cat === 'FULL TIME') activeStyle = 'bg-success/10 text-success border-success/30 font-extrabold shadow-sm';
                                                else activeStyle = 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 font-extrabold shadow-sm';
                                            } else {
                                                activeStyle = 'text-tertiary hover:text-secondary border-transparent';
                                            }

                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => handleFieldChange(teacher.id, 'classification', cat)}
                                                    className={`py-1.5 text-[9px] font-bold rounded-lg border text-center transition-all ${activeStyle}`}
                                                >
                                                    {cat}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Status Selector (Acciones vs Conforme) */}
                                <div className="space-y-1.5 mb-4 relative z-10">
                                    <label className="text-[10px] font-black text-tertiary uppercase tracking-widest block">Estado de Desempeño</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleFieldChange(teacher.id, 'performance_status', 'Conforme')}
                                            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                                fup.performance_status === 'Conforme'
                                                    ? 'bg-success/15 border-success/30 text-success shadow-sm'
                                                    : 'bg-main/30 border-color/30 text-tertiary hover:bg-main/50 hover:text-secondary'
                                            }`}
                                        >
                                            <ThumbsUp size={14} />
                                            <span>Conforme</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleFieldChange(teacher.id, 'performance_status', 'Acciones para mejorar')}
                                            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                                fup.performance_status === 'Acciones para mejorar'
                                                    ? 'bg-warning/15 border-warning/30 text-warning shadow-sm'
                                                    : 'bg-main/30 border-color/30 text-tertiary hover:bg-main/50 hover:text-secondary'
                                            }`}
                                        >
                                            <AlertTriangle size={14} />
                                            <span>Acciones a Tomar</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Internal Notes */}
                                <div className="space-y-1.5 mb-5 relative z-10">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-tertiary uppercase tracking-widest">
                                            Notas de Evolución (Interno)
                                        </label>
                                        {savedNotesStatus[teacher.id] && (
                                            <span className="text-[9px] text-success font-black flex items-center gap-0.5 animate-pulse">
                                                <Save size={10} /> Guardado
                                            </span>
                                        )}
                                    </div>
                                    <textarea
                                        defaultValue={fup.notes}
                                        onBlur={(e) => handleNotesBlur(teacher.id, e.target.value)}
                                        rows="2.5"
                                        placeholder="Escribe aquí observaciones internas del desempeño o evolución..."
                                        className="bg-main/40 border-color/40 text-secondary placeholder:text-tertiary/70 text-xs focus:ring-1 focus:ring-primary w-full p-2.5 rounded-xl outline-none resize-none shadow-inner"
                                    />
                                </div>

                                {/* Checklist Section */}
                                <div className="space-y-3 relative z-10">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-tertiary uppercase tracking-widest flex items-center gap-1">
                                            <CheckCircle2 size={12} className="text-primary" />
                                            Ítems a Revisar
                                        </label>
                                        <span className="text-[10px] font-bold text-secondary">
                                            {completedChecklist}/{totalChecklist} ({percentage}%)
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-1.5 bg-main rounded-full overflow-hidden border border-color/30">
                                        <div 
                                            className={`h-full transition-all duration-500 rounded-full ${
                                                percentage === 100 
                                                    ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
                                                    : (fup.performance_status === 'Acciones para mejorar' ? 'bg-warning' : 'bg-primary')
                                            }`} 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>

                                    {/* Items List */}
                                    {totalChecklist > 0 && (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1.5 custom-scrollbar bg-main/15 p-2 rounded-xl border border-color/20">
                                            {(fup.checklist || []).map(item => (
                                                <div 
                                                    key={item.id} 
                                                    className="flex items-center justify-between gap-2 bg-surface/50 border border-color/30 hover:border-color-hover/40 p-2 rounded-lg transition-all"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleChecklistItem(teacher.id, item.id)}
                                                        className="text-secondary hover:text-primary transition-colors cursor-pointer shrink-0"
                                                    >
                                                        {item.completed ? (
                                                            <CheckSquare className="text-success" size={15} />
                                                        ) : (
                                                            <Square size={15} />
                                                        )}
                                                    </button>
                                                    <span className={`text-xs min-w-0 flex-1 truncate font-medium select-none ${
                                                        item.completed 
                                                            ? 'line-through text-tertiary font-normal' 
                                                            : 'text-secondary'
                                                    }`}>
                                                        {item.text}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteChecklistItem(teacher.id, item.id)}
                                                        className="text-tertiary hover:text-error transition-colors p-0.5 shrink-0"
                                                        title="Eliminar ítem"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add item input */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Añadir ítem a revisar..."
                                            value={newItemTexts[teacher.id] || ''}
                                            onChange={(e) => setNewItemTexts({
                                                ...newItemTexts,
                                                [teacher.id]: e.target.value
                                            })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddChecklistItem(teacher.id);
                                                }
                                            }}
                                            className="bg-main/30 border border-color/30 text-secondary placeholder:text-tertiary/70 text-xs focus:ring-1 focus:ring-primary flex-grow px-3 py-1.5 rounded-xl outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddChecklistItem(teacher.id)}
                                            className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary hover:text-white transition-all flex items-center justify-center text-primary shrink-0 cursor-pointer shadow-sm hover:shadow"
                                        >
                                            <Plus size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {sortedTeachers.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 border-2 border-dashed border-color/60 rounded-2xl bg-surface/50 text-center">
                        <div className="w-12 h-12 bg-main border border-color rounded-xl flex items-center justify-center text-tertiary mb-3">
                            <Info size={20} />
                        </div>
                        <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">
                            No se encontraron docentes
                        </h4>
                        <p className="text-secondary text-xs max-w-xs">
                            Ningún docente coincide con los criterios de búsqueda y filtros aplicados actualmente.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
