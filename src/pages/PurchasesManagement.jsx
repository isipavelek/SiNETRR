import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { createNotification } from '../lib/notificationsHelper';
import { 
    ShoppingBag, Search, Filter, Info, FileText, CheckCircle, Clock, 
    X, AlertTriangle, Send, Edit3, Plus, Trash2, ExternalLink
} from 'lucide-react';

export default function PurchasesManagement() {
    const { userProfile, role } = useAuth();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');

    // Editing modal state
    const [editingPurchase, setEditingPurchase] = useState(null);
    const [editForm, setEditForm] = useState({
        status: '',
        priority: '',
        coordinationNotes: '',
        items: []
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPurchases();
    }, []);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('material_purchases')
                .select(`
                    *,
                    subjects (id, name, courses (name)),
                    user_profiles (id, first_name, last_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPurchases(data || []);
        } catch (err) {
            console.error('Error fetching material purchases:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Summary stats
    const stats = useMemo(() => {
        const counts = { pending: 0, accepted: 0, in_process: 0, closed: 0, total_cost: 0 };
        purchases.forEach(p => {
            if (p.status === 'Pendiente') counts.pending++;
            else if (p.status === 'Aceptado') counts.accepted++;
            else if (p.status === 'En Proceso') counts.in_process++;
            else if (p.status === 'Cerrado') counts.closed++;
            
            if (p.status !== 'Rechazado') {
                counts.total_cost += parseFloat(p.total_cost) || 0;
            }
        });
        return counts;
    }, [purchases]);

    // Filtering logic
    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            const teacherName = p.user_profiles 
                ? `${p.user_profiles.first_name} ${p.user_profiles.last_name}`.toLowerCase()
                : '';
            const subjectName = p.subjects ? p.subjects.name.toLowerCase() : '';
            const courseName = p.subjects && p.subjects.courses ? p.subjects.courses.name.toLowerCase() : '';
            
            const query = searchQuery.toLowerCase();
            const matchesSearch = teacherName.includes(query) || 
                                 subjectName.includes(query) || 
                                 courseName.includes(query);

            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter;

            return matchesSearch && matchesStatus && matchesPriority;
        });
    }, [purchases, searchQuery, statusFilter, priorityFilter]);

    // Open editor modal
    const handleOpenEdit = (p) => {
        setEditingPurchase(p);
        setEditForm({
            status: p.status,
            priority: p.priority,
            coordinationNotes: p.coordination_notes || '',
            items: p.items ? JSON.parse(JSON.stringify(p.items)) : [] // Deep copy
        });
    };

    // Modal Form handlers
    const handleEditItemChange = (index, field, value) => {
        setEditForm(prev => {
            const updatedItems = [...prev.items];
            updatedItems[index] = { ...updatedItems[index], [field]: value };
            return { ...prev, items: updatedItems };
        });
    };

    const handleEditAddItem = () => {
        setEditForm(prev => ({
            ...prev,
            items: [...prev.items, { name: '', quantity: 1, unit: 'unidades', estimated_price: 0, link: '' }]
        }));
    };

    const handleEditRemoveItem = (index) => {
        if (editForm.items.length <= 1) return;
        setEditForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSavePurchase = async (e) => {
        e.preventDefault();
        if (!editingPurchase) return;
        
        // Validate items
        const invalidItem = editForm.items.some(it => !it.name.trim() || !it.quantity || !it.estimated_price);
        if (invalidItem) {
            alert('Por favor, completa todos los campos requeridos de los materiales (Nombre, Cantidad y Costo).');
            return;
        }

        setSaving(true);
        try {
            // Re-calculate total cost
            const total = editForm.items.reduce((sum, item) => {
                const price = parseFloat(item.estimated_price) || 0;
                return sum + (price * item.quantity);
            }, 0);

            const { error } = await supabase
                .from('material_purchases')
                .update({
                    status: editForm.status,
                    priority: editForm.priority,
                    coordination_notes: editForm.coordinationNotes,
                    items: editForm.items,
                    total_cost: total
                })
                .eq('id', editingPurchase.id);

            if (error) throw error;

            // Notify Teacher about update
            if (editingPurchase.teacher_id) {
                const title = `Actualización de Pedido de Compra 🛒`;
                let content = `Tu pedido para la materia "${editingPurchase.subjects?.name}" ha sido actualizado a estado "${editForm.status}".`;
                if (editForm.coordinationNotes) {
                    content += ` Observación: "${editForm.coordinationNotes}"`;
                }
                
                await createNotification(
                    editingPurchase.teacher_id,
                    title,
                    content,
                    'system'
                );
            }

            await fetchPurchases();
            setEditingPurchase(null);
        } catch (err) {
            alert('Error al guardar cambios: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (role !== 'coordinador' && role !== 'gerente') {
        return <div className="p-10 text-center text-error font-bold">Acceso Denegado</div>;
    }

    const modalTotalCost = editForm.items.reduce((sum, item) => {
        const price = parseFloat(item.estimated_price) || 0;
        return sum + (price * item.quantity);
    }, 0);

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header Section */}
            <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary border border-primary/20 shadow-inner shrink-0">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-1">Administración de Compras</h2>
                        <p className="text-secondary font-medium text-sm">Monitoreo, edición y procesamiento de pedidos de insumos cargados por los docentes.</p>
                    </div>
                </div>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="glass-card p-4 text-center border-l-4 border-l-warning">
                    <span className="text-xs text-secondary font-bold uppercase tracking-wider block">Pendientes</span>
                    <span className="text-2xl font-black text-warning block mt-1">{stats.pending}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-success">
                    <span className="text-xs text-secondary font-bold uppercase tracking-wider block">Aceptadas</span>
                    <span className="text-2xl font-black text-success block mt-1">{stats.accepted}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-accent">
                    <span className="text-xs text-secondary font-bold uppercase tracking-wider block">En Proceso</span>
                    <span className="text-2xl font-black text-accent block mt-1">{stats.in_process}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-secondary">
                    <span className="text-xs text-secondary font-bold uppercase tracking-wider block">Cerradas</span>
                    <span className="text-2xl font-black text-secondary block mt-1">{stats.closed}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-primary col-span-2 lg:col-span-1">
                    <span className="text-xs text-secondary font-bold uppercase tracking-wider block">Presupuesto Estimado</span>
                    <span className="text-xl font-mono font-black text-primary block mt-1">${stats.total_cost.toLocaleString('es-AR')}</span>
                </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por materia, curso o docente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-main border border-color rounded-xl pl-4 pr-10 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
                    />
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                </div>
                <div className="flex gap-4 w-full md:w-auto flex-wrap">
                    <div className="flex items-center gap-2 bg-main/50 border border-color px-3 py-1.5 rounded-xl text-xs font-semibold shadow-inner">
                        <Filter size={14} className="text-primary" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] cursor-pointer outline-none"
                        >
                            <option value="all">Estado (Todos)</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Aceptado">Aceptado</option>
                            <option value="En Proceso">En Proceso</option>
                            <option value="Cerrado">Cerrado</option>
                            <option value="Rechazado">Rechazado</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-main/50 border border-color px-3 py-1.5 rounded-xl text-xs font-semibold shadow-inner">
                        <Filter size={14} className="text-primary" />
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] cursor-pointer outline-none"
                        >
                            <option value="all">Prioridad (Todas)</option>
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* List and Table View */}
            <div className="glass-card overflow-hidden shadow-sm border border-color/40">
                {filteredPurchases.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                        <ShoppingBag size={48} className="text-tertiary opacity-45 mb-4" />
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">No se encontraron pedidos de compras</h3>
                        <p className="text-sm text-secondary mt-1">Prueba cambiando los filtros o cargando un nuevo pedido en las materias.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-surface-hover/50 text-tertiary text-xs uppercase tracking-wider border-b border-color/50">
                                    <th className="p-4 font-bold">Curso y Materia</th>
                                    <th className="p-4 font-bold">Docente</th>
                                    <th className="p-4 font-bold">Fecha</th>
                                    <th className="p-4 font-bold">Materiales</th>
                                    <th className="p-4 font-bold">Costo Est.</th>
                                    <th className="p-4 font-bold">Prioridad</th>
                                    <th className="p-4 font-bold">Estado</th>
                                    <th className="p-4 font-bold text-right pr-6">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-color/40 text-sm">
                                {filteredPurchases.map(p => (
                                    <tr key={p.id} className="hover:bg-surface-hover/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-black px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase tracking-wider block w-fit">
                                                    {p.subjects?.courses?.name}
                                                </span>
                                                <span className="font-bold text-[var(--text-primary)] mt-1.5 block truncate max-w-[200px]">
                                                    {p.subjects?.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-secondary font-medium">
                                            {p.user_profiles 
                                                ? `${p.user_profiles.first_name} ${p.user_profiles.last_name}`
                                                : 'Desconocido'
                                            }
                                        </td>
                                        <td className="p-4 text-secondary font-mono">
                                            {new Date(p.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-secondary font-semibold">
                                            {p.items.length} {p.items.length === 1 ? 'ítem' : 'ítems'}
                                        </td>
                                        <td className="p-4 font-mono font-bold text-[var(--text-primary)]">
                                            ${p.total_cost.toLocaleString('es-AR')}
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                                                p.priority === 'Alta' ? 'bg-error/10 text-error border-error/25' :
                                                p.priority === 'Media' ? 'bg-warning/10 text-warning border-warning/25' :
                                                'bg-secondary/15 text-tertiary border-color/40'
                                            }`}>
                                                {p.priority}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${
                                                p.status === 'Pendiente' ? 'bg-warning/10 text-warning border-warning/20' :
                                                p.status === 'Aceptado' ? 'bg-success/10 text-success border-success/20' :
                                                p.status === 'En Proceso' ? 'bg-accent/10 text-accent border-accent/20' :
                                                p.status === 'Cerrado' ? 'bg-secondary/15 text-tertiary border-color/40' :
                                                'bg-error/10 text-error border-error/20'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <button
                                                onClick={() => handleOpenEdit(p)}
                                                className="px-3 py-2 bg-surface hover:bg-primary/10 border border-color hover:border-primary/30 rounded-xl text-xs font-bold text-secondary hover:text-primary transition-all flex items-center justify-center gap-1 shadow-sm ml-auto cursor-pointer"
                                            >
                                                <Edit3 size={13} />
                                                <span>Procesar</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Process / Edit Purchase Order */}
            {editingPurchase && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 overflow-y-auto">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight">Editar & Procesar Pedido</h3>
                                <p className="text-xs text-secondary mt-1">
                                    Docente: {editingPurchase.user_profiles?.first_name} {editingPurchase.user_profiles?.last_name} | Materia: {editingPurchase.subjects?.name}
                                </p>
                            </div>
                            <button onClick={() => setEditingPurchase(null)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePurchase} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            
                            {/* Status & Priority Control */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-main/30 p-4 border border-color/40 rounded-xl">
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary">Estado del Pedido</label>
                                    <select
                                        value={editForm.status}
                                        onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                        className="bg-surface border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="Aceptado">Aceptado (Aprobado)</option>
                                        <option value="En Proceso">En Proceso (Adquiriendo)</option>
                                        <option value="Cerrado">Cerrado (Entregado)</option>
                                        <option value="Rechazado">Rechazado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary">Prioridad</label>
                                    <select
                                        value={editForm.priority}
                                        onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                                        className="bg-surface border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="Baja">Baja</option>
                                        <option value="Media">Media</option>
                                        <option value="Alta">Alta</option>
                                    </select>
                                </div>
                            </div>

                            {/* Items / Materials Editing List */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-color pb-2">
                                    <h4 className="font-bold text-sm text-[var(--text-primary)]">Lista de Materiales Solicitados</h4>
                                    <button
                                        type="button"
                                        onClick={handleEditAddItem}
                                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Agregar Material
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {editForm.items.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 p-4 bg-main/20 border border-color/30 rounded-xl relative items-end">
                                            {editForm.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditRemoveItem(idx)}
                                                    className="absolute top-2 right-2 text-error/60 hover:text-error transition-colors p-1"
                                                    title="Quitar"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}

                                            <div className="col-span-12 md:col-span-4">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Nombre / Descripción *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={item.name}
                                                    onChange={e => handleEditItemChange(idx, 'name', e.target.value)}
                                                    className="bg-surface border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Cantidad *</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={e => handleEditItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="bg-surface border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Medida</label>
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={e => handleEditItemChange(idx, 'unit', e.target.value)}
                                                    className="bg-surface border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-4 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Costo Unit Est. *</label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="0"
                                                    value={item.estimated_price}
                                                    onChange={e => handleEditItemChange(idx, 'estimated_price', parseFloat(e.target.value) || 0)}
                                                    className="bg-surface border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            <div className="col-span-12 md:col-span-2">
                                                <label className="text-xs font-bold text-secondary mb-1 block">Link Ref.</label>
                                                <input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={item.link || ''}
                                                    onChange={e => handleEditItemChange(idx, 'link', e.target.value)}
                                                    className="bg-surface border-color/40 text-[var(--text-primary)] text-xs w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Justification (Read-only for reference) */}
                            <div>
                                <span className="text-xs font-bold text-secondary uppercase tracking-wider block mb-1">Justificación del Docente</span>
                                <p className="text-xs text-[var(--text-primary)] bg-main/40 border border-color p-3.5 rounded-xl leading-relaxed italic">
                                    "{editingPurchase.justification}"
                                </p>
                            </div>

                            {/* Coordination Notes */}
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Notas / Observaciones de Coordinación</label>
                                <textarea
                                    value={editForm.coordinationNotes}
                                    onChange={e => setEditForm(prev => ({ ...prev, coordinationNotes: e.target.value }))}
                                    placeholder="Indica motivos de rechazo, fechas tentativas de entrega, o detalles de la compra..."
                                    rows={3}
                                    className="bg-surface border-color/50 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            {/* Total cost and submit */}
                            <div className="flex justify-between items-center border-t border-color/40 pt-4 shrink-0">
                                <div>
                                    <span className="text-xs text-secondary font-bold block uppercase tracking-wider">Costo Estimado Re-calculado</span>
                                    <span className="text-2xl font-black text-primary font-mono">${modalTotalCost.toLocaleString('es-AR')}</span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn btn-primary px-8 h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {saving ? 'Guardando...' : <><Send size={16} /> Aplicar & Guardar Cambios</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
