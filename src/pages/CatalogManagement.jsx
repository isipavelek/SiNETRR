import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import offlineCatalog from '../data/product_catalog.json';
import { 
    BookOpen, Search, Plus, Trash2, Edit3, Upload, FileText, 
    CheckCircle, X, Download, ArrowLeft, RefreshCw
} from 'lucide-react';

export default function CatalogManagement() {
    const { role } = useAuth();
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    // Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null); // null means adding new
    const [formItem, setFormItem] = useState({
        code: '',
        type: 'IN',
        description: '',
        unit: 'UN',
        unit_description: 'Unidad'
    });
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchCatalog();
    }, []);

    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('product_catalog')
                .select('*')
                .order('code');
            if (error) throw error;
            setCatalog(data || []);
        } catch (err) {
            console.warn('Failed to load database catalog, using offline fallback:', err);
            // Convert offline catalog structure unitDescription -> unit_description
            const mappedOffline = offlineCatalog.map(it => ({
                type: it.type,
                code: it.code,
                description: it.description,
                unit: it.unit,
                unit_description: it.unitDescription || it.unit
            }));
            setCatalog(mappedOffline);
        } finally {
            setLoading(false);
        }
    };

    // Filters logic
    const filteredCatalog = useMemo(() => {
        return catalog.filter(item => {
            const code = (item.code || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            const matchesSearch = code.includes(query) || desc.includes(query);

            const matchesType = typeFilter === 'all' || item.type === typeFilter;

            return matchesSearch && matchesType;
        });
    }, [catalog, searchQuery, typeFilter]);

    // Save or update item
    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!formItem.code.trim() || !formItem.description.trim() || !formItem.unit.trim()) {
            alert('Por favor, completa todos los campos requeridos (*).');
            return;
        }

        setSaving(true);
        try {
            const itemData = {
                code: formItem.code.trim().toUpperCase(),
                type: formItem.type,
                description: formItem.description.trim(),
                unit: formItem.unit.trim(),
                unit_description: formItem.unit_description.trim()
            };

            const { error } = await supabase
                .from('product_catalog')
                .upsert([itemData], { onConflict: 'code' });

            if (error) throw error;

            alert(editingItem ? 'Producto actualizado correctamente.' : 'Producto agregado al catálogo.');
            setIsEditModalOpen(false);
            fetchCatalog();
        } catch (err) {
            alert('Error al guardar el producto: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Open Modal for Edit or Add
    const handleOpenEdit = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormItem({
                code: item.code,
                type: item.type,
                description: item.description,
                unit: item.unit,
                unit_description: item.unit_description || ''
            });
        } else {
            setFormItem({
                code: '',
                type: 'IN',
                description: '',
                unit: 'UN',
                unit_description: 'Unidad'
            });
        }
        setIsEditModalOpen(true);
    };

    // Delete item
    const handleDeleteItem = async (code) => {
        if (!confirm(`¿Estás seguro de eliminar el código "${code}" del catálogo?`)) return;
        try {
            const { error } = await supabase
                .from('product_catalog')
                .delete()
                .eq('code', code);
            if (error) throw error;
            alert('Producto eliminado del catálogo.');
            fetchCatalog();
        } catch (err) {
            alert('Error al eliminar producto: ' + err.message);
        }
    };

    // Excel Export
    const handleExportExcel = () => {
        try {
            const dataToExport = filteredCatalog.map(item => ({
                'Tipo de Producto': item.type,
                'Código de producto': item.code,
                'Descripción': item.description,
                'Unidad de medida': item.unit,
                'Descripción de la unidad de medida': item.unit_description
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Catálogo de Materiales');
            XLSX.writeFile(wb, 'catalogo_materiales.xlsx');
        } catch (err) {
            alert('Error al exportar catálogo: ' + err.message);
        }
    };

    // Excel Import
    const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('¿Deseas importar los elementos del Excel? Los códigos que coincidan se reemplazarán y se añadirán los nuevos.')) {
            e.target.value = '';
            return;
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!data || data.length === 0) {
                    throw new Error('El archivo Excel está vacío o no tiene la estructura correcta.');
                }

                // Map row fields
                const items = data.map((row, index) => {
                    const code = String(row['Código de producto'] || row['code'] || row['Code'] || '').trim().toUpperCase();
                    const type = String(row['Tipo de Producto'] || row['type'] || row['Type'] || 'IN').trim().toUpperCase();
                    const desc = String(row['Descripción'] || row['description'] || row['Description'] || '').trim();
                    const unit = String(row['Unidad de medida'] || row['unit'] || row['Unit'] || 'UN').trim();
                    const unitDesc = String(row['Descripción de la unidad de medida'] || row['unit_description'] || row['unitDescription'] || '').trim();

                    if (!code || !desc) {
                        return null; // Skip invalid
                    }

                    return {
                        code,
                        type: ['BU', 'ME', 'HE', 'IN'].includes(type) ? type : 'IN',
                        description: desc,
                        unit,
                        unit_description: unitDesc || unit
                    };
                }).filter(Boolean);

                if (items.length === 0) {
                    throw new Error('No se encontraron registros válidos con "Código de producto" y "Descripción".');
                }

                // Save to Supabase
                const { error } = await supabase
                    .from('product_catalog')
                    .upsert(items, { onConflict: 'code' });

                if (error) throw error;

                alert(`¡Importación exitosa! Se procesaron ${items.length} productos en el catálogo.`);
                fetchCatalog();
            } catch (err) {
                alert('Error en la importación: ' + err.message);
            } finally {
                setImporting(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    if (role !== 'coordinador' && role !== 'gerente') {
        return <div className="p-10 text-center text-error font-bold">Acceso Denegado</div>;
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header */}
            <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border-l-4 border-l-primary shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary border border-primary/20 shadow-inner shrink-0">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-1">Catálogo de Materiales</h2>
                        <p className="text-secondary font-medium text-sm">Gestiona el catálogo de insumos cargados para las materias. Añade, edita, importa y exporta en Excel.</p>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="relative z-10 flex items-center gap-3 w-full md:w-auto flex-wrap shrink-0">
                    <button 
                        onClick={() => handleOpenEdit(null)}
                        className="btn btn-primary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Añadir Producto</span>
                    </button>
                    <label className="btn btn-secondary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer">
                        <Upload size={14} />
                        <span>{importing ? 'Importando...' : 'Importar Excel'}</span>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            onChange={handleImportExcel} 
                            disabled={importing}
                            className="hidden" 
                        />
                    </label>
                    <button 
                        onClick={handleExportExcel}
                        className="btn btn-secondary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer"
                    >
                        <Download size={14} />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por código o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-main border border-color rounded-xl pl-4 pr-10 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
                    />
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                </div>
                <div className="flex gap-4 w-full md:w-auto flex-wrap">
                    <div className="flex items-center gap-2 bg-main/50 border border-color px-3 py-1.5 rounded-xl text-xs font-semibold shadow-inner">
                        <span className="text-secondary font-bold">Tipo:</span>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] cursor-pointer outline-none"
                        >
                            <option value="all">Todos los Tipos</option>
                            <option value="BU">Obra Civil / Equipamiento (BU)</option>
                            <option value="ME">Equipos de Medición (ME)</option>
                            <option value="HE">Herramientas (HE)</option>
                            <option value="IN">Insumos y Materiales (IN)</option>
                        </select>
                    </div>
                    <button
                        onClick={fetchCatalog}
                        className="p-2 bg-main/50 border border-color rounded-xl text-secondary hover:text-primary transition-all hover:bg-surface-hover shadow-sm"
                        title="Recargar catálogo"
                    >
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden shadow-sm border border-color/40">
                {filteredCatalog.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                        <BookOpen size={48} className="text-tertiary opacity-45 mb-4" />
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">No se encontraron productos</h3>
                        <p className="text-sm text-secondary mt-1">Prueba cambiando la búsqueda o importa un catálogo en Excel.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-surface-hover/50 text-tertiary text-xs uppercase tracking-wider border-b border-color/50">
                                    <th className="p-4 font-bold w-32">Tipo</th>
                                    <th className="p-4 font-bold w-40">Código</th>
                                    <th className="p-4 font-bold">Descripción</th>
                                    <th className="p-4 font-bold w-36">Unidad</th>
                                    <th className="p-4 font-bold w-48">Descr. Unidad</th>
                                    <th className="p-4 font-bold text-right pr-6 w-32">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-color/40 text-sm">
                                {filteredCatalog.map(item => (
                                    <tr key={item.code} className="hover:bg-surface-hover/30 transition-colors">
                                        <td className="p-4">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                                                item.type === 'BU' ? 'bg-primary/10 text-primary border-primary/20' :
                                                item.type === 'ME' ? 'bg-accent/10 text-accent border-accent/20' :
                                                item.type === 'HE' ? 'bg-warning/10 text-warning border-warning/20' :
                                                'bg-success/10 text-success border-success/20'
                                            }`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-primary">
                                            {item.code}
                                        </td>
                                        <td className="p-4 font-semibold text-[var(--text-primary)]">
                                            {item.description}
                                        </td>
                                        <td className="p-4 text-secondary font-medium">
                                            {item.unit}
                                        </td>
                                        <td className="p-4 text-secondary font-medium text-xs">
                                            {item.unit_description || '-'}
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="p-1.5 bg-surface hover:bg-primary/15 border border-color hover:border-primary/30 rounded-lg text-secondary hover:text-primary transition-all shadow-sm cursor-pointer"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item.code)}
                                                    className="p-1.5 bg-surface hover:bg-error/15 border border-color hover:border-error/30 rounded-lg text-secondary hover:text-error transition-all shadow-sm cursor-pointer"
                                                    title="Eliminar"
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

            {/* Modal: Edit or Create Catalog Item */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[9999] flex justify-center items-start md:items-center p-4 overflow-y-auto">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-auto">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">
                                    {editingItem ? 'Editar Producto' : 'Añadir Producto al Catálogo'}
                                </h3>
                                <p className="text-xs text-secondary mt-1">Completa los datos requeridos para registrar el insumo.</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Código del Producto *</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!!editingItem} // Code is primary key
                                    value={formItem.code}
                                    onChange={e => setFormItem(prev => ({ ...prev, code: e.target.value }))}
                                    placeholder="Ej: HE010030"
                                    className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-mono uppercase"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Tipo de Producto</label>
                                <select
                                    value={formItem.type}
                                    onChange={e => setFormItem(prev => ({ ...prev, type: e.target.value }))}
                                    className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-bold cursor-pointer"
                                >
                                    <option value="BU">BU (Obra Civil / Equipamiento)</option>
                                    <option value="ME">ME (Instrumental de Medida)</option>
                                    <option value="HE">HE (Herramientas)</option>
                                    <option value="IN">IN (Insumos y Materiales)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Descripción del Insumo *</label>
                                <textarea
                                    required
                                    value={formItem.description}
                                    onChange={e => setFormItem(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Ej: Taladro de banco Dewalt 13mm"
                                    rows={2}
                                    className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Unidad *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formItem.unit}
                                        onChange={e => setFormItem(prev => ({ ...prev, unit: e.target.value }))}
                                        placeholder="Ej: UN, MT"
                                        className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold mb-1 block text-secondary font-bold">Descr. Unidad</label>
                                    <input
                                        type="text"
                                        value={formItem.unit_description}
                                        onChange={e => setFormItem(prev => ({ ...prev, unit_description: e.target.value }))}
                                        placeholder="Ej: Unidad, Metro"
                                        className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary font-semibold"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="btn btn-primary w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 mt-4"
                            >
                                {saving ? 'Guardando...' : <><CheckCircle size={16} /> Guardar Producto</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
