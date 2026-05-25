import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { createNotification } from '../lib/notificationsHelper';
import { 
    ArrowLeft, Plus, CheckCircle, Clock, Trash2, Calendar, FileText, 
    AlertTriangle, ShoppingBag, FolderOpen, Send, X, ExternalLink, Info
} from 'lucide-react';

export default function SubjectDetailView({ subjectId, onBack }) {
    const { role, userProfile } = useAuth();
    const [subject, setSubject] = useState(null);
    const [projects, setProjects] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state - Projects
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projectForm, setProjectForm] = useState({ name: '', description: '' });
    const [submittingProject, setSubmittingProject] = useState(false);

    // Modal state - Purchases
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState({
        projectId: '',
        priority: 'Media',
        justification: '',
        items: [{ name: '', quantity: 1, unit: 'unidades', estimated_price: '', link: '' }]
    });
    const [submittingPurchase, setSubmittingPurchase] = useState(false);
    
    // View purchase items modal
    const [viewingPurchase, setViewingPurchase] = useState(null);

    const isTeacher = role === 'docente';

    useEffect(() => {
        if (subjectId) {
            fetchSubjectData();
        }
    }, [subjectId]);

    const fetchSubjectData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Subject
            const { data: subData, error: subError } = await supabase
                .from('subjects')
                .select('*, courses(name), user_profiles(first_name, last_name)')
                .eq('id', subjectId)
                .single();
            if (subError) throw subError;
            setSubject(subData);

            // 2. Fetch Projects
            const { data: projData, error: projError } = await supabase
                .from('subject_projects')
                .select('*')
                .eq('subject_id', subjectId)
                .order('created_at', { ascending: false });
            if (projError) throw projError;
            setProjects(projData || []);

            // 3. Fetch Purchase Requests
            const { data: purchData, error: purchError } = await supabase
                .from('material_purchases')
                .select('*, subject_projects(name)')
                .eq('subject_id', subjectId)
                .order('created_at', { ascending: false });
            if (purchError) throw purchError;
            setPurchases(purchData || []);

        } catch (err) {
            console.error('Error fetching subject details:', err);
        } finally {
            setLoading(false);
        }
    };

    // Project Actions
    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!projectForm.name.trim()) return;
        setSubmittingProject(true);
        try {
            const { error } = await supabase
                .from('subject_projects')
                .insert([{
                    subject_id: subjectId,
                    name: projectForm.name,
                    description: projectForm.description,
                    status: 'Activo'
                }]);
            if (error) throw error;
            
            // Refresh
            await fetchSubjectData();
            setIsProjectModalOpen(false);
            setProjectForm({ name: '', description: '' });
        } catch (err) {
            alert('Error al crear el proyecto: ' + err.message);
        } finally {
            setSubmittingProject(false);
        }
    };

    const toggleProjectStatus = async (projectId, currentStatus) => {
        if (!isTeacher) return;
        const newStatus = currentStatus === 'Activo' ? 'Finalizado' : 'Activo';
        try {
            const { error } = await supabase
                .from('subject_projects')
                .update({ status: newStatus })
                .eq('id', projectId);
            if (error) throw error;
            await fetchSubjectData();
        } catch (err) {
            alert('Error al actualizar el estado: ' + err.message);
        }
    };

    // Purchase Request Actions
    const handleAddItem = () => {
        setPurchaseForm(prev => ({
            ...prev,
            items: [...prev.items, { name: '', quantity: 1, unit: 'unidades', estimated_price: '', link: '' }]
        }));
    };

    const handleRemoveItem = (index) => {
        if (purchaseForm.items.length <= 1) return;
        setPurchaseForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setPurchaseForm(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const handleCreatePurchase = async (e) => {
        e.preventDefault();
        if (!purchaseForm.justification.trim()) return;
        
        // Validate items
        const invalidItem = purchaseForm.items.some(it => !it.name.trim() || !it.quantity || !it.estimated_price);
        if (invalidItem) {
            alert('Por favor, completa todos los campos requeridos de los materiales (Nombre, Cantidad y Costo).');
            return;
        }

        setSubmittingPurchase(true);
        try {
            // Compute total cost
            const total = purchaseForm.items.reduce((sum, item) => {
                const price = parseFloat(item.estimated_price) || 0;
                return sum + (price * item.quantity);
            }, 0);

            const { error } = await supabase
                .from('material_purchases')
                .insert([{
                    subject_id: subjectId,
                    project_id: purchaseForm.projectId || null,
                    teacher_id: userProfile?.id,
                    items: purchaseForm.items,
                    justification: purchaseForm.justification,
                    priority: purchaseForm.priority,
                    status: 'Pendiente',
                    total_cost: total
                }]);

            if (error) throw error;

            // Notify coordinators
            await createNotification(
                null,
                'Nuevo Pedido de Compra 🛒',
                `El docente ${userProfile?.first_name} ${userProfile?.last_name} cargó un pedido para ${subject.name} (${subject.courses?.name}). Total: $${total.toLocaleString('es-AR')}`,
                'system'
            );

            await fetchSubjectData();
            setIsPurchaseModalOpen(false);
            setPurchaseForm({
                projectId: '',
                priority: 'Media',
                justification: '',
                items: [{ name: '', quantity: 1, unit: 'unidades', estimated_price: '', link: '' }]
            });
        } catch (err) {
            alert('Error al enviar el pedido: ' + err.message);
        } finally {
            setSubmittingPurchase(false);
        }
    };

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

    if (!subject) return <div className="p-10 text-center text-error font-bold">Materia no encontrada</div>;

    const estimatedTotal = purchaseForm.items.reduce((sum, item) => {
        const price = parseFloat(item.estimated_price) || 0;
        return sum + (price * item.quantity);
    }, 0);

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header Banner */}
            <div className="glass-card p-6 md:p-8 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBack}
                            className="p-2.5 bg-surface hover:bg-surface-hover border border-color rounded-xl text-secondary hover:text-[var(--text-primary)] transition-all shadow-sm"
                            title="Regresar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <span className="text-[10px] font-black px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full uppercase tracking-wider">
                                {subject.courses?.name}
                            </span>
                            <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mt-1">{subject.name}</h2>
                            <p className="text-secondary font-medium text-sm mt-1">
                                Docente: {subject.user_profiles ? `${subject.user_profiles.first_name} ${subject.user_profiles.last_name}` : 'Sin asignar'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Split View Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column: Projects */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-card shadow-sm border border-color/40 flex flex-col">
                        <div className="p-5 border-b border-color/40 flex items-center justify-between">
                            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                                <FolderOpen className="text-primary" size={20} />
                                Proyectos Escolares
                            </h3>
                            {isTeacher && (
                                <button 
                                    onClick={() => setIsProjectModalOpen(true)}
                                    className="p-1.5 bg-primary/15 text-primary border border-primary/25 rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"
                                    title="Nuevo Proyecto"
                                >
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>

                        <div className="p-5 space-y-4">
                            {projects.length === 0 ? (
                                <div className="text-center py-8 border border-dashed border-color rounded-xl bg-main/20 text-tertiary">
                                    <p className="text-sm font-semibold">Sin proyectos registrados</p>
                                    <p className="text-xs text-secondary mt-1">
                                        {isTeacher ? 'Crea un proyecto para asociarle tus compras de materiales.' : 'El docente no ha cargado proyectos.'}
                                    </p>
                                </div>
                            ) : (
                                projects.map(proj => (
                                    <div key={proj.id} className="p-4 bg-main/30 border border-color/30 rounded-xl space-y-2 relative overflow-hidden group">
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="font-extrabold text-sm text-[var(--text-primary)] truncate">{proj.name}</h4>
                                            <button
                                                disabled={!isTeacher}
                                                onClick={() => toggleProjectStatus(proj.id, proj.status)}
                                                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                    proj.status === 'Activo' 
                                                        ? 'bg-success/15 text-success border-success/35 hover:bg-success hover:text-white cursor-pointer' 
                                                        : 'bg-secondary/20 text-tertiary border-color hover:bg-success hover:text-white cursor-pointer'
                                                } transition-all`}
                                                title={isTeacher ? "Cambiar estado" : ""}
                                            >
                                                {proj.status}
                                            </button>
                                        </div>
                                        {proj.description && (
                                            <p className="text-xs text-secondary font-medium line-clamp-3 leading-relaxed">
                                                {proj.description}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Purchases */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="glass-card shadow-sm border border-color/40 flex flex-col">
                        <div className="p-5 border-b border-color/40 flex items-center justify-between">
                            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                                <ShoppingBag className="text-primary" size={20} />
                                Pedidos de Materiales
                            </h3>
                            {isTeacher && (
                                <button 
                                    onClick={() => {
                                        if (projects.length === 0) {
                                            alert("Debes crear al menos un Proyecto escolar primero.");
                                            return;
                                        }
                                        setIsPurchaseModalOpen(true);
                                    }}
                                    className="btn btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md"
                                >
                                    <Plus size={14} />
                                    <span>Hacer Pedido</span>
                                </button>
                            )}
                        </div>

                        <div className="p-5 space-y-4">
                            {purchases.length === 0 ? (
                                <div className="text-center py-16 border border-dashed border-color rounded-xl bg-main/20 text-tertiary">
                                    <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-semibold">No hay pedidos de compras cargados</p>
                                    <p className="text-xs text-secondary mt-1">Carga los pedidos de insumos y materiales que necesites para tus proyectos.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {purchases.map(p => (
                                        <div key={p.id} className="p-5 bg-main/30 border border-color/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-hover/20 transition-all shadow-sm">
                                            <div className="space-y-1.5 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                        p.status === 'Pendiente' ? 'bg-warning/10 text-warning border-warning/30' :
                                                        p.status === 'Aceptado' ? 'bg-success/10 text-success border-success/30' :
                                                        p.status === 'En Proceso' ? 'bg-accent/10 text-accent border-accent/30' :
                                                        p.status === 'Cerrado' ? 'bg-secondary/15 text-tertiary border-color/40' :
                                                        'bg-error/10 text-error border-error/30'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                                        p.priority === 'Alta' ? 'bg-error/10 text-error border-error/20' :
                                                        p.priority === 'Media' ? 'bg-warning/10 text-warning border-warning/20' :
                                                        'bg-secondary/10 text-secondary border-color'
                                                    }`}>
                                                        {p.priority}
                                                    </span>
                                                    {p.subject_projects && (
                                                        <span className="text-[10px] text-primary font-bold truncate max-w-[150px]">
                                                            📁 {p.subject_projects.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="font-extrabold text-sm text-[var(--text-primary)]">
                                                    Pedido con {p.items.length} {p.items.length === 1 ? 'material' : 'materiales'}
                                                </h4>
                                                <p className="text-xs text-secondary font-mono">
                                                    Fecha: {new Date(p.created_at).toLocaleDateString()}
                                                </p>
                                                {p.coordination_notes && (
                                                    <div className="p-2.5 bg-surface/50 border border-color rounded-xl text-xs text-secondary flex items-start gap-2 shadow-inner mt-2">
                                                        <Info size={14} className="text-primary shrink-0 mt-0.5" />
                                                        <span><strong>Nota de Coord:</strong> {p.coordination_notes}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col sm:items-end gap-2 shrink-0">
                                                <span className="font-mono font-black text-lg text-[var(--text-primary)]">
                                                    ${p.total_cost.toLocaleString('es-AR')}
                                                </span>
                                                <button
                                                    onClick={() => setViewingPurchase(p)}
                                                    className="px-4 py-2 bg-surface hover:bg-surface-hover border border-color hover:border-primary/30 rounded-xl text-xs font-bold text-secondary hover:text-primary transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                >
                                                    <FileText size={14} />
                                                    <span>Ver Detalle</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Modal: New Project */}
            {isProjectModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">Nuevo Proyecto Escolar</h3>
                            <button onClick={() => setIsProjectModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Nombre del Proyecto</label>
                                <input
                                    type="text"
                                    required
                                    value={projectForm.name}
                                    onChange={e => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ej: Robot Seguidor de Línea"
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Descripción / Objetivos</label>
                                <textarea
                                    value={projectForm.description}
                                    onChange={e => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Detalla los objetivos del proyecto y qué divisiones participan..."
                                    rows={4}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submittingProject}
                                className="btn btn-primary w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                {submittingProject ? 'Guardando...' : <><Send size={16} /> Crear Proyecto</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: New Purchase Request */}
            {isPurchaseModalOpen && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 overflow-y-auto">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">Cargar Pedido de Materiales</h3>
                                <p className="text-xs text-secondary mt-1">Completa los ítems requeridos para la materia.</p>
                            </div>
                            <button onClick={() => setIsPurchaseModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreatePurchase} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary">Asociar a Proyecto</label>
                                    <select
                                        required
                                        value={purchaseForm.projectId}
                                        onChange={e => setPurchaseForm(prev => ({ ...prev, projectId: e.target.value }))}
                                        className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="">Selecciona un proyecto...</option>
                                        {projects.filter(pr => pr.status === 'Activo').map(pr => (
                                            <option key={pr.id} value={pr.id}>{pr.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary">Prioridad</label>
                                    <select
                                        value={purchaseForm.priority}
                                        onChange={e => setPurchaseForm(prev => ({ ...prev, priority: e.target.value }))}
                                        className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="Baja">Baja (Planificable)</option>
                                        <option value="Media">Media (Necesaria)</option>
                                        <option value="Alta">Alta (Crítica/Urgente)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Dynamically Managed Items List */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-color pb-2">
                                    <h4 className="font-bold text-sm text-[var(--text-primary)]">Materiales / Insumos Solicitados</h4>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Agregar Fila
                                    </button>
                                </div>

                                <div className="space-y-3.5">
                                    {purchaseForm.items.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 p-4 bg-main/20 border border-color/30 rounded-xl relative items-end group">
                                            {purchaseForm.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="absolute top-2 right-2 text-error/60 hover:text-error transition-colors p-1"
                                                    title="Eliminar fila"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}

                                            <div className="col-span-12 md:col-span-4">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Nombre / Descripción *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Ej: Tester digital, LED rojo 5mm"
                                                    value={item.name}
                                                    onChange={e => handleItemChange(idx, 'name', e.target.value)}
                                                    className="bg-main border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Cantidad *</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="1"
                                                    placeholder="10"
                                                    value={item.quantity}
                                                    onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="bg-main border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Medida</label>
                                                <input
                                                    type="text"
                                                    placeholder="unidades, mts"
                                                    value={item.unit}
                                                    onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                                                    className="bg-main border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Costo Unit Est. *</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="0"
                                                    placeholder="$"
                                                    value={item.estimated_price}
                                                    onChange={e => handleItemChange(idx, 'estimated_price', parseFloat(e.target.value) || '')}
                                                    className="bg-main border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-12 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Link Ref. (Opcional)</label>
                                                <input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={item.link}
                                                    onChange={e => handleItemChange(idx, 'link', e.target.value)}
                                                    className="bg-main border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Justificación / Fundamento del pedido *</label>
                                <textarea
                                    required
                                    value={purchaseForm.justification}
                                    onChange={e => setPurchaseForm(prev => ({ ...prev, justification: e.target.value }))}
                                    placeholder="Indica brevemente el destino de los materiales y por qué son indispensables..."
                                    rows={3}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="flex justify-between items-center border-t border-color/40 pt-4 shrink-0">
                                <div>
                                    <span className="text-xs text-secondary font-bold block uppercase tracking-wider">Costo Estimado Total</span>
                                    <span className="text-2xl font-black text-primary font-mono">${estimatedTotal.toLocaleString('es-AR')}</span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={submittingPurchase}
                                    className="btn btn-primary px-8 h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {submittingPurchase ? 'Enviando...' : <><Send size={16} /> Enviar Pedido</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View Purchase Detail */}
            {viewingPurchase && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight">Detalle de Solicitud de Compra</h3>
                                <p className="text-xs text-secondary mt-1">Fecha de carga: {new Date(viewingPurchase.created_at).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setViewingPurchase(null)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-main/30 border border-color rounded-xl text-center">
                                    <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Estado</span>
                                    <span className="font-bold text-sm text-[var(--text-primary)] block mt-1">{viewingPurchase.status}</span>
                                </div>
                                <div className="p-3 bg-main/30 border border-color rounded-xl text-center">
                                    <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Prioridad</span>
                                    <span className="font-bold text-sm text-[var(--text-primary)] block mt-1">{viewingPurchase.priority}</span>
                                </div>
                                <div className="p-3 bg-main/30 border border-color rounded-xl text-center">
                                    <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Total Estimado</span>
                                    <span className="font-bold text-sm text-primary font-mono block mt-1">${viewingPurchase.total_cost.toLocaleString('es-AR')}</span>
                                </div>
                            </div>

                            {viewingPurchase.subject_projects && (
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                    <span className="text-xs font-bold text-secondary uppercase tracking-wider block mb-1">Proyecto Relacionado</span>
                                    <span className="font-black text-sm text-[var(--text-primary)]">📁 {viewingPurchase.subject_projects.name}</span>
                                </div>
                            )}

                            <div>
                                <span className="text-xs font-bold text-secondary uppercase tracking-wider block mb-1.5">Materiales Requeridos</span>
                                <div className="border border-color rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-surface-hover/60 border-b border-color text-secondary font-bold">
                                                <th className="p-3">Material</th>
                                                <th className="p-3 text-center">Cantidad</th>
                                                <th className="p-3 text-right">Unitario</th>
                                                <th className="p-3 text-right">Subtotal</th>
                                                <th className="p-3 text-center">Referencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-color/30 font-medium">
                                            {viewingPurchase.items.map((item, index) => {
                                                const cost = parseFloat(item.estimated_price) || 0;
                                                const subtotal = cost * item.quantity;
                                                return (
                                                    <tr key={index} className="hover:bg-surface-hover/20">
                                                        <td className="p-3 text-[var(--text-primary)] font-bold">{item.name}</td>
                                                        <td className="p-3 text-center text-secondary">{item.quantity} {item.unit}</td>
                                                        <td className="p-3 text-right font-mono">${cost.toLocaleString('es-AR')}</td>
                                                        <td className="p-3 text-right font-mono font-bold text-[var(--text-primary)]">${subtotal.toLocaleString('es-AR')}</td>
                                                        <td className="p-3 text-center">
                                                            {item.link ? (
                                                                <a 
                                                                    href={item.link} 
                                                                    target="_blank" 
                                                                    rel="noreferrer" 
                                                                    className="inline-flex items-center gap-0.5 text-primary hover:underline font-bold"
                                                                >
                                                                    Ver <ExternalLink size={10} />
                                                                </a>
                                                            ) : (
                                                                <span className="text-tertiary">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-secondary uppercase tracking-wider block mb-1">Justificación del Pedido</span>
                                <p className="text-sm text-[var(--text-primary)] bg-main/40 border border-color p-4 rounded-xl leading-relaxed italic">
                                    "{viewingPurchase.justification}"
                                </p>
                            </div>

                            {viewingPurchase.coordination_notes && (
                                <div className="bg-amber-500/5 border border-amber-500/25 p-4 rounded-xl space-y-1">
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Notas del Coordinador</span>
                                    <p className="text-sm text-secondary font-medium">
                                        {viewingPurchase.coordination_notes}
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
