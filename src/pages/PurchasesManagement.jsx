import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { createNotification } from '../lib/notificationsHelper';
import productCatalog from '../data/product_catalog.json';
import { 
    ShoppingBag, Search, Filter, Info, FileText, CheckCircle, Clock, 
    X, AlertTriangle, Send, Edit3, Plus, Trash2, ExternalLink, Grid, Copy
} from 'lucide-react';

const getProductTypeInfo = (type) => {
    const rawType = (type || '').trim().toUpperCase();
    switch (rawType) {
        case 'BU':
            return { code: 'BU', name: 'Bienes de uso' };
        case 'HE':
            return { code: 'HE', name: 'Herramental' };
        case 'IN':
            return { code: 'IN', name: 'Insumos' };
        case 'ME':
            return { code: 'ME', name: 'Instrumentos de medición' };
        default:
            return { code: 'NS', name: 'Insumos (N/S)' };
    }
};

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
    const [copyTargetPurchase, setCopyTargetPurchase] = useState(null);

    // Product catalog search state
    const [activeSearchIdx, setActiveSearchIdx] = useState(null);
    const [catalogItems, setCatalogItems] = useState(productCatalog);

    useEffect(() => {
        const fetchCatalogFromSupabase = async () => {
            try {
                const { data, error } = await supabase
                    .from('product_catalog')
                    .select('*')
                    .order('code');
                if (error) throw error;
                if (data && data.length > 0) {
                    const mapped = data.map(it => ({
                        code: it.code,
                        type: it.type,
                        description: it.description,
                        unit: it.unit,
                        unitDescription: it.unit_description || it.unit
                    }));
                    setCatalogItems(mapped);
                }
            } catch (err) {
                console.warn('Failed to load database catalog in PurchasesManagement, using offline fallback:', err);
            }
        };
        fetchCatalogFromSupabase();
    }, []);

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
            items: [...prev.items, { name: '', quantity: 1, unit: 'unidades', estimated_price: 0, link: '', code: '', type: '' }]
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

    const handleDeletePurchase = async (purchaseId) => {
        if (!confirm('¿Estás seguro de eliminar este pedido de compra por completo?')) return;
        try {
            const { error } = await supabase
                .from('material_purchases')
                .delete()
                .eq('id', purchaseId);
            if (error) throw error;
            alert('Pedido de compra eliminado correctamente.');
            await fetchPurchases();
        } catch (err) {
            alert('Error al eliminar el pedido: ' + err.message);
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
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setCopyTargetPurchase(p)}
                                                    className="px-3 py-2 bg-accent/10 hover:bg-accent hover:text-white border border-accent/20 rounded-xl text-xs font-bold text-accent transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                                    title="Ver tabla tipo Excel para copiar"
                                                >
                                                    <Grid size={13} />
                                                    <span>Copiar Excel</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(p)}
                                                    className="px-3 py-2 bg-surface hover:bg-primary/10 border border-color hover:border-primary/30 rounded-xl text-xs font-bold text-secondary hover:text-primary transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                                >
                                                    <Edit3 size={13} />
                                                    <span>Procesar</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePurchase(p.id)}
                                                    className="p-2 bg-surface hover:bg-error/15 border border-color hover:border-error/30 rounded-xl text-secondary hover:text-error transition-all shadow-sm cursor-pointer"
                                                    title="Eliminar Pedido"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Process / Edit Purchase Order */}
            {editingPurchase && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-start md:items-center p-4 overflow-y-auto">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]">
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
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const headers = ["Tipo de Producto", "Descripción del Tipo de Producto", "Codigo del producto original", "Descripción", "Observaciones", "Cantidad", "Unidad de medida", "Precio Unitario"];
                                                const rows = editForm.items.map(item => {
                                                    const typeInfo = getProductTypeInfo(item.type);
                                                    return [
                                                        typeInfo.code,
                                                        typeInfo.name,
                                                        item.code || '',
                                                        item.name || '',
                                                        editForm.coordinationNotes || '',
                                                        item.quantity || '',
                                                        item.unit || '',
                                                        item.estimated_price || ''
                                                    ];
                                                });
                                                const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n');
                                                navigator.clipboard.writeText(tsvContent)
                                                    .then(() => alert('¡Datos copiados al portapapeles! Puedes pegarlos en Excel.'))
                                                    .catch(err => alert('Error al copiar: ' + err.message));
                                            }}
                                            className="px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                            title="Copiar materiales para Excel con cabeceras"
                                        >
                                            <Copy size={13} />
                                            <span>Copiar Excel</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const rows = editForm.items.map(item => {
                                                    const typeInfo = getProductTypeInfo(item.type);
                                                    return [
                                                        typeInfo.code,
                                                        typeInfo.name,
                                                        item.code || '',
                                                        item.name || '',
                                                        editForm.coordinationNotes || '',
                                                        item.quantity || '',
                                                        item.unit || '',
                                                        item.estimated_price || ''
                                                    ];
                                                });
                                                const tsvContent = rows.map(row => row.join('\t')).join('\n');
                                                navigator.clipboard.writeText(tsvContent)
                                                    .then(() => alert('¡Datos copiados para Softland (sin cabeceras)!'))
                                                    .catch(err => alert('Error al copiar: ' + err.message));
                                            }}
                                            className="px-3 py-1.5 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-600/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                            title="Copiar materiales para Softland sin cabeceras"
                                        >
                                            <Send size={13} />
                                            <span>Copiar para Softland</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleEditAddItem}
                                            className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                        >
                                            <Plus size={14} />
                                            Agregar Material
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {editForm.items.map((item, idx) => (
                                        <div key={idx} className="p-5 bg-main/30 border border-color/40 rounded-2xl relative space-y-4 shadow-sm group">
                                            {/* Item Header with Delete Button */}
                                            <div className="flex justify-between items-center border-b border-color/20 pb-2.5">
                                                <span className="text-xs font-black text-primary uppercase tracking-wider">Material #{idx + 1}</span>
                                                {editForm.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditRemoveItem(idx)}
                                                        className="text-error hover:text-error/80 transition-colors flex items-center gap-1.5 text-xs font-extrabold"
                                                        title="Quitar material"
                                                    >
                                                        <Trash2 size={14} className="shrink-0" />
                                                        <span>Eliminar</span>
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-12 gap-4">
                                                {/* Nombre / Descripción */}
                                                <div className="col-span-12 md:col-span-8 relative">
                                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Nombre / Descripción *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Buscar en el catálogo..."
                                                        value={item.name}
                                                        onFocus={() => setActiveSearchIdx(idx)}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setActiveSearchIdx(null);
                                                            }, 250);
                                                        }}
                                                        onChange={e => {
                                                            handleEditItemChange(idx, 'name', e.target.value);
                                                            // reset code if user types custom
                                                            if (item.code) {
                                                                handleEditItemChange(idx, 'code', '');
                                                                handleEditItemChange(idx, 'type', '');
                                                            }
                                                        }}
                                                        className="bg-surface border border-color/40 text-[var(--text-primary)] text-sm w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold transition-all shadow-inner"
                                                    />
                                                    {activeSearchIdx === idx && (
                                                        (() => {
                                                            const query = item.name || '';
                                                            const filtered = catalogItems.filter(p => 
                                                                p.description.toLowerCase().includes(query.toLowerCase()) || 
                                                                p.code.toLowerCase().includes(query.toLowerCase())
                                                            ).slice(0, 8);

                                                            if (filtered.length === 0) return null;

                                                            return (
                                                                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-2xl z-[9999] max-h-48 overflow-y-auto divide-y divide-color/30 font-sans">
                                                                    {filtered.map(p => (
                                                                        <button
                                                                            key={p.code}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                handleEditItemChange(idx, 'name', p.description);
                                                                                handleEditItemChange(idx, 'unit', p.unitDescription || p.unit);
                                                                                handleEditItemChange(idx, 'code', p.code);
                                                                                handleEditItemChange(idx, 'type', p.type);
                                                                                setActiveSearchIdx(null);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-surface-hover flex items-center justify-between gap-2 transition-colors duration-150 cursor-pointer"
                                                                        >
                                                                            <div className="min-w-0 flex items-center text-left">
                                                                                <span className="font-mono text-primary font-extrabold text-[10px] mr-1.5 bg-primary/10 border border-primary/20 px-1 py-0.5 rounded shrink-0">
                                                                                    {p.code}
                                                                                </span>
                                                                                <span className="text-[var(--text-primary)] font-semibold truncate">{p.description}</span>
                                                                            </div>
                                                                            <span className="text-[9px] font-black text-secondary uppercase bg-secondary/15 px-1.5 py-0.5 rounded shrink-0">
                                                                                {p.unit}
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()
                                                    )}
                                                </div>

                                                {/* Medida */}
                                                <div className="col-span-12 md:col-span-4">
                                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Medida</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ej: Unidad, Metro..."
                                                        value={item.unit}
                                                        onChange={e => handleEditItemChange(idx, 'unit', e.target.value)}
                                                        className="bg-surface border border-color/40 text-[var(--text-primary)] text-sm w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold transition-all shadow-inner"
                                                    />
                                                </div>

                                                {/* Cantidad */}
                                                <div className="col-span-4 md:col-span-3">
                                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Cantidad *</label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="1"
                                                        placeholder="1"
                                                        value={item.quantity}
                                                        onChange={e => handleEditItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="bg-surface border border-color/40 text-[var(--text-primary)] text-sm w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold transition-all shadow-inner"
                                                    />
                                                </div>

                                                {/* Costo Unit Est. * */}
                                                <div className="col-span-4 md:col-span-3">
                                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Costo Unit Est. *</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-secondary font-bold font-mono">$</span>
                                                        <input
                                                            type="number"
                                                            required
                                                            min="0"
                                                            placeholder="0"
                                                            value={item.estimated_price}
                                                            onChange={e => handleEditItemChange(idx, 'estimated_price', parseFloat(e.target.value) || 0)}
                                                            className="bg-surface border border-color/40 text-[var(--text-primary)] text-sm w-full rounded-xl pl-7 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold font-mono transition-all shadow-inner"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Link Ref. */}
                                                <div className="col-span-12 md:col-span-6">
                                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Link Ref.</label>
                                                    <input
                                                        type="url"
                                                        placeholder="https://..."
                                                        value={item.link || ''}
                                                        onChange={e => handleEditItemChange(idx, 'link', e.target.value)}
                                                        className="bg-surface border border-color/40 text-[var(--text-primary)] text-sm w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold transition-all shadow-inner"
                                                    />
                                                </div>
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
                </div>,
                document.body
            )}

            {/* Modal: Excel Copy Helper */}
            {copyTargetPurchase && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-start md:items-center p-4 overflow-y-auto">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                                    <Grid className="text-accent" size={22} />
                                    <span>Vista de Copiado Rápido (Estilo Excel)</span>
                                </h3>
                                <p className="text-xs text-secondary mt-1">
                                    Esta tabla está optimizada para copiar y pegar directamente en Microsoft Excel, Google Sheets o sistemas de compras.
                                </p>
                            </div>
                            <button onClick={() => setCopyTargetPurchase(null)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 font-sans">
                            
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary/5 p-4 border border-primary/20 rounded-xl">
                                <div>
                                    <span className="text-xs font-bold text-primary block uppercase tracking-wider">Copiado Automático en 1 Clic</span>
                                    <p className="text-xs text-secondary mt-0.5">Haz clic en el botón para copiar los datos con formato de celdas compatible con Excel.</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                                    <button
                                        onClick={() => {
                                            const headers = ["Tipo de Producto", "Descripción del Tipo de Producto", "Codigo del producto original", "Descripción", "Observaciones", "Cantidad", "Unidad de medida", "Precio Unitario"];
                                            const rows = copyTargetPurchase.items.map(item => {
                                                const typeInfo = getProductTypeInfo(item.type);
                                                return [
                                                    typeInfo.code,
                                                    typeInfo.name,
                                                    item.code || '',
                                                    item.name || '',
                                                    copyTargetPurchase.coordination_notes || '',
                                                    item.quantity || '',
                                                    item.unit || '',
                                                    item.estimated_price || ''
                                                ];
                                            });
                                            const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n');
                                            navigator.clipboard.writeText(tsvContent)
                                                .then(() => alert('¡Datos copiados al portapapeles! Puedes pegarlos en Excel o Google Sheets con Ctrl+V.'))
                                                .catch(err => alert('Error al copiar: ' + err.message));
                                        }}
                                        className="btn btn-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-md cursor-pointer self-stretch sm:self-auto text-xs"
                                    >
                                        <Copy size={15} />
                                        <span>Copiar Tabla Completa</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const rows = copyTargetPurchase.items.map(item => {
                                                const typeInfo = getProductTypeInfo(item.type);
                                                return [
                                                    typeInfo.code,
                                                    typeInfo.name,
                                                    item.code || '',
                                                    item.name || '',
                                                    copyTargetPurchase.coordination_notes || '',
                                                    item.quantity || '',
                                                    item.unit || '',
                                                    item.estimated_price || ''
                                                ];
                                            });
                                            const tsvContent = rows.map(row => row.join('\t')).join('\n');
                                            navigator.clipboard.writeText(tsvContent)
                                                .then(() => alert('¡Datos copiados para Softland (sin cabeceras)!'))
                                                .catch(err => alert('Error al copiar: ' + err.message));
                                        }}
                                        className="btn bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-md cursor-pointer self-stretch sm:self-auto text-xs border-none"
                                    >
                                        <Send size={15} />
                                        <span>Copiar para Softland</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-extrabold text-secondary uppercase tracking-wider block">Tabla de datos</span>
                                <div className="border border-color rounded-xl overflow-hidden shadow-sm bg-main/10 max-h-72 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse text-xs select-all bg-surface">
                                        <thead>
                                            <tr className="bg-surface-hover/80 border-b border-color text-secondary font-bold sticky top-0 z-10">
                                                <th className="p-3 border-r border-color/40">Tipo de Producto</th>
                                                <th className="p-3 border-r border-color/40">Descripción del Tipo de Producto</th>
                                                <th className="p-3 border-r border-color/40">Codigo del producto original</th>
                                                <th className="p-3 border-r border-color/40">Descripción</th>
                                                <th className="p-3 border-r border-color/40">Observaciones</th>
                                                <th className="p-3 border-r border-color/40 text-center">Cantidad</th>
                                                <th className="p-3 border-r border-color/40">Unidad de medida</th>
                                                <th className="p-3">Precio Unitario</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-color/30 font-medium text-[var(--text-primary)]">
                                            {copyTargetPurchase.items.map((item, index) => {
                                                const typeInfo = getProductTypeInfo(item.type);
                                                return (
                                                    <tr key={index} className="hover:bg-surface-hover/40 transition-colors">
                                                        <td className="p-3 border-r border-color/40 font-mono font-bold text-center select-all">
                                                            {typeInfo.code}
                                                        </td>
                                                        <td className="p-3 border-r border-color/40 select-all">
                                                            {typeInfo.name}
                                                        </td>
                                                        <td className="p-3 border-r border-color/40 font-mono font-bold text-primary select-all">
                                                            {item.code || '-'}
                                                        </td>
                                                        <td className="p-3 border-r border-color/40 select-all">
                                                            {item.name}
                                                        </td>
                                                        <td className="p-3 border-r border-color/40 select-all italic text-secondary">
                                                            {copyTargetPurchase.coordination_notes || '-'}
                                                        </td>
                                                        <td className="p-3 border-r border-color/40 text-center select-all">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="p-3 border-r border-color/40 select-all">
                                                            {item.unit}
                                                        </td>
                                                        <td className="p-3 font-mono select-all">
                                                            ${item.estimated_price}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <span className="text-[10px] text-tertiary block mt-1 italic">
                                    * Consejo: También puedes hacer clic y arrastrar con el mouse sobre la tabla para seleccionar filas específicas y copiarlas.
                                </span>
                            </div>

                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
