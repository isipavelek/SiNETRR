import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
    Search, Plus, QrCode, PackageOpen, CheckCircle, XCircle, 
    AlertCircle, Calendar, User, Clock, Trash2, Edit, Wrench, 
    History, UserCheck, BookOpen, Layers, Check, ChevronDown, ChevronUp,
    Upload, FileSpreadsheet, Camera, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { createNotification } from '../lib/notificationsHelper';

const COURSES = ['1°', '2°', '3°', '4°', '5°', '6°', '7°', 'CFP'];
const DIVISIONS = ['A', 'B', 'TEL', 'TEM'];

const getCourseCycle = (course) => {
    if (['1°', '2°', '3°'].includes(course)) return 'CB';
    if (['4°', '5°', '6°', '7°'].includes(course)) return 'Superior';
    if (course === 'CFP') return 'CFP';
    return 'Otros';
};

const formatDbCourseName = (course, division) => {
    const cleanCourse = (course || '').replace('°', '');
    const cleanDiv = division || '';
    if (['1', '2', '3'].includes(cleanCourse)) {
        return `${cleanCourse}o${cleanDiv}`;
    }
    return `${cleanCourse}${cleanDiv}`;
};

const getAvailableDivisions = (course) => {
    if (['1°', '2°', '3°'].includes(course)) return ['A', 'B'];
    if (['4°', '5°', '6°', '7°'].includes(course)) return ['TEL', 'TEM'];
    return [];
};

export default function PanolDashboard() {
    const { role, userProfile } = useAuth();
    
    // Check access role
    const isPanolOrAdmin = role === 'panol' || role === 'coordinador' || role === 'gerente';

    // Tabs
    const [activeTab, setActiveTab] = useState(isPanolOrAdmin ? 'orders' : 'my_reservations'); // 'orders' | 'reservations' | 'my_reservations' | 'inventory' | 'history' | 'my_authorizations'

    // Data lists
    const [inventory, setInventory] = useState([]);
    const [orders, setOrders] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [toolHistory, setToolHistory] = useState([]);
    
    // Loadings
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    // Navigation and filters
    const [inventorySearch, setInventorySearch] = useState('');
    const [ordersSearch, setOrdersSearch] = useState('');
    const [pendingReturnsSearch, setPendingReturnsSearch] = useState('');
    
    // Grouping & Filtering states
    const [selectedCycle, setSelectedCycle] = useState('TODOS'); // 'TODOS' | 'CB' | 'Superior' | 'CFP'
    const [filterCourse, setFilterCourse] = useState('TODOS');
    const [filterDivision, setFilterDivision] = useState('TODOS');
    const [ordersStatusFilter, setOrdersStatusFilter] = useState('Abierta'); // 'Abierta' | 'Cerrada' | 'TODOS'

    // Expansions
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [editingOrderId, setEditingOrderId] = useState(null);

    // Selected tool for traceability
    const [selectedTraceToolId, setSelectedTraceToolId] = useState('');

    // Forms states
    const [showAddToolForm, setShowAddToolForm] = useState(false);
    const [newTool, setNewTool] = useState({ name: '', code: '', stock: '' });
    const [toolPhotoFile, setToolPhotoFile] = useState(null);
    const [uploadingToolId, setUploadingToolId] = useState(null);
    const [toolImageModal, setToolImageModal] = useState(null);
    const toolFileInputRef = useRef(null);

    // Excel tools import and seeding states
    const [importingTools, setImportingTools] = useState(false);
    const [importToolsError, setImportToolsError] = useState('');
    const [importToolsSuccess, setImportToolsSuccess] = useState('');
    const [loadingSeed, setLoadingSeed] = useState(false);

    const [showNewOrderForm, setShowNewOrderForm] = useState(false);
    const [newOrder, setNewOrder] = useState({
        studentName: '',
        course: '1°',
        division: 'A',
        subjectOrProject: '',
        teacherId: '',
        date: new Date().toISOString().split('T')[0],
        tools: [] // { toolId, name, quantity, maxStock }
    });
    
    // Reservations state (for teachers)
    const [showNewReservationForm, setShowNewReservationForm] = useState(false);
    const [newReservation, setNewReservation] = useState({
        studentName: '',
        course: '1°',
        division: 'A',
        subjectOrProject: '',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // default to tomorrow
        tools: [] // { toolId, name, quantity, maxStock }
    });
    const [reservationToolSearch, setReservationToolSearch] = useState('');
    const [showReservationToolResults, setShowReservationToolResults] = useState(false);

    // Edit reservation state (for teachers)
    const [editingReservation, setEditingReservation] = useState(null);
    const [editReservationToolSearch, setEditReservationToolSearch] = useState('');
    const [showEditReservationToolResults, setShowEditReservationToolResults] = useState(false);
    const [showEditReservationSubjectSuggestions, setShowEditReservationSubjectSuggestions] = useState(false);

    // Observations editing state (for staff)
    const [savingObservationId, setSavingObservationId] = useState(null);
    const [observationsTextState, setObservationsTextState] = useState({});

    // Stock conflict modal state
    const [stockConflictOrder, setStockConflictOrder] = useState(null);
    const [stockConflictDetails, setStockConflictDetails] = useState([]); // { toolId, name, requested, available }
    const [subjectsList, setSubjectsList] = useState([]);
    const [showOrderSubjectSuggestions, setShowOrderSubjectSuggestions] = useState(false);
    const [showReservationSubjectSuggestions, setShowReservationSubjectSuggestions] = useState(false);
    
    // Tools searching inside New Order form
    const [orderToolSearch, setOrderToolSearch] = useState('');
    const [showToolResults, setShowToolResults] = useState(false);

    // Return element states
    const [returningItemId, setReturningItemId] = useState(null);
    const [returnQty, setReturnQty] = useState(1);
    const [returnComment, setReturnComment] = useState('');
    const [sendToRepair, setSendToRepair] = useState(false);

    // Add tools to existing order state
    const [addingToolToOrderId, setAddingToolToOrderId] = useState(null);
    const [newToolForOrder, setNewToolForOrder] = useState({ toolId: '', quantity: 1, maxStock: 0 });
    const [existingOrderToolSearch, setExistingOrderToolSearch] = useState('');
    const [showExistingOrderToolResults, setShowExistingOrderToolResults] = useState(false);

    useEffect(() => {
        fetchInventory();
        fetchSubjectsList();
        if (isPanolOrAdmin) {
            fetchOrders();
            fetchTeachers();
        } else {
            fetchMyAuthorizations();
        }
    }, [role, userProfile]);

    useEffect(() => {
        if (!isPanolOrAdmin) return;

        const interval = setInterval(() => {
            fetchOrders();
            fetchInventory();
        }, 15000);

        return () => clearInterval(interval);
    }, [isPanolOrAdmin]);

    useEffect(() => {
        if (selectedTraceToolId) {
            fetchToolHistory(selectedTraceToolId);
        }
    }, [selectedTraceToolId]);

    useEffect(() => {
        setFilterCourse('TODOS');
        setFilterDivision('TODOS');
    }, [selectedCycle]);

    // Data fetching
    const fetchInventory = async () => {
        setLoadingInventory(true);
        try {
            const { data, error } = await supabase.from('inventory').select('*').order('name');
            if (error) throw error;
            setInventory(data || []);
        } catch (err) {
            console.error('Error fetching inventory:', err);
        } finally {
            setLoadingInventory(false);
        }
    };

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const { data, error } = await supabase
                .from('tool_orders')
                .select(`
                    *,
                    teacher:teacher_id (first_name, last_name),
                    items:tool_order_items (
                        *,
                        tool:tool_id (id, name, code, stock, repair_stock)
                    )
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchMyAuthorizations = async () => {
        if (!userProfile) return;
        setLoadingOrders(true);
        try {
            const { data, error } = await supabase
                .from('tool_orders')
                .select(`
                    *,
                    teacher:teacher_id (first_name, last_name),
                    items:tool_order_items (
                        *,
                        tool:tool_id (id, name, code, stock, repair_stock)
                    )
                `)
                .eq('teacher_id', userProfile.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching my authorizations:', err);
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchTeachers = async () => {
        try {
            // Fetch roles first to find docents ID
            const { data: roleData } = await supabase.from('user_roles').select('id').eq('role_name', 'docente').single();
            if (roleData) {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, first_name, last_name')
                    .eq('role_id', roleData.id)
                    .order('last_name');
                if (!error) setTeachers(data || []);
            }
        } catch (e) {
            console.error('Error fetching teachers', e);
        }
    };

    const fetchSubjectsList = async () => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select(`
                    id,
                    name,
                    course_id,
                    courses (id, name),
                    teacher_id
                `);
            if (!error) {
                setSubjectsList(data || []);
            }
        } catch (e) {
            console.error('Error fetching subjects list:', e);
        }
    };

    const fetchToolHistory = async (toolId) => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('tool_order_items')
                .select(`
                    id, quantity, returned_quantity, return_comment, status, created_at,
                    order:order_id (
                        date, student_name, course, division, subject_or_project, status,
                        teacher:teacher_id (first_name, last_name)
                    )
                `)
                .eq('tool_id', toolId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setToolHistory(data || []);
        } catch (err) {
            console.error('Error fetching tool history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteHistoryItem = async (itemId) => {
        if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro de préstamo del historial?')) return;
        
        try {
            const { error } = await supabase
                .from('tool_order_items')
                .delete()
                .eq('id', itemId);
                
            if (error) throw error;
            
            alert('Registro eliminado correctamente.');
            if (selectedTraceToolId) {
                fetchToolHistory(selectedTraceToolId);
            }
            fetchInventory();
            fetchOrders();
        } catch (err) {
            console.error('Error deleting history item:', err);
            alert('Error al eliminar el registro: ' + err.message);
        }
    };

    const uploadToolPhoto = async (file) => {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `tools/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (e) {
            console.error("Error uploading tool photo:", e);
            throw new Error("No se pudo subir la foto de la herramienta: " + (e.message || "Error desconocido"));
        }
    };

    const handleToolImageClick = (toolId) => {
        setUploadingToolId(toolId);
        if (toolFileInputRef.current) {
            toolFileInputRef.current.click();
        }
    };

    const handleToolImageChange = async (e) => {
        if (!e.target.files || e.target.files.length === 0 || !uploadingToolId) return;
        const file = e.target.files[0];
        try {
            const imgUrl = await uploadToolPhoto(file);
            if (!imgUrl) return;

            const { error } = await supabase
                .from('inventory')
                .update({ image_url: imgUrl })
                .eq('id', uploadingToolId);

            if (error) throw error;

            alert("Foto del material actualizada.");
            fetchInventory();
        } catch (err) {
            console.error("Error updating tool image:", err);
            alert("Error al actualizar la foto: " + err.message);
        } finally {
            setUploadingToolId(null);
            e.target.value = ''; // Reset input
        }
    };

    const handleDeleteToolPhoto = async (toolId) => {
        if (!confirm("¿Estás seguro que deseas eliminar la foto de esta herramienta?")) return;
        try {
            const { error } = await supabase
                .from('inventory')
                .update({ image_url: null })
                .eq('id', toolId);

            if (error) throw error;

            alert("Foto de la herramienta eliminada.");
            setToolImageModal(null);
            fetchInventory();
        } catch (err) {
            console.error("Error deleting tool image:", err);
            alert("Error al eliminar la foto: " + err.message);
        }
    };

    // Inventory operations
    const handleAddInventoryItem = async (e) => {
        e.preventDefault();
        try {
            let imgUrl = null;
            if (toolPhotoFile) {
                imgUrl = await uploadToolPhoto(toolPhotoFile);
            }

            const { error } = await supabase.from('inventory').insert([{
                name: newTool.name,
                code: newTool.code || null,
                stock: parseInt(newTool.stock),
                image_url: imgUrl
            }]);
            if (error) throw error;
            setShowAddToolForm(false);
            setNewTool({ name: '', code: '', stock: '' });
            setToolPhotoFile(null);
            fetchInventory();
            alert('Material agregado con éxito.');
        } catch (err) {
            alert('Error agregando material. Verifique que el código no esté duplicado.');
        }
    };

    const handleSeedTools = async () => {
        if (!confirm('¿Desea cargar las herramientas de prueba en el inventario? Si ya existen por su código o nombre, se actualizará su stock.')) return;
        setLoadingSeed(true);
        try {
            const { data: existingItems, error: fetchErr } = await supabase.from('inventory').select('*');
            if (fetchErr) throw fetchErr;

            const codeMap = {};
            const nameMap = {};
            existingItems?.forEach(item => {
                if (item.code) codeMap[item.code.toLowerCase().trim()] = item;
                if (item.name) nameMap[item.name.toLowerCase().trim()] = item;
            });

            const MOCK_TOOLS = [
                { name: 'Taladro Atornillador DeWalt 20V', code: 'TAL-001', stock: 5 },
                { name: 'Amoladora Angular Bosch 4.5" 850W', code: 'AMO-002', stock: 4 },
                { name: 'Martillo de Carpintero Stanley 16oz', code: 'MAR-003', stock: 12 },
                { name: 'Juego de Destornilladores Stanley (x6)', code: 'DES-004', stock: 8 },
                { name: 'Cinta Métrica Stanley 8m', code: 'MET-005', stock: 15 },
                { name: 'Multímetro Digital Fluke 115', code: 'MUL-006', stock: 3 },
                { name: 'Sierra Caladora Makita 450W', code: 'SIE-007', stock: 2 },
                { name: 'Soldadora Inverter Esab 160A', code: 'SOL-008', stock: 2 },
                { name: 'Pinza Universal Gedore 8"', code: 'PIN-009', stock: 10 },
                { name: 'Llave Francesa Bahco 10"', code: 'LLA-010', stock: 6 },
                { name: 'Calibre Digital Mitutoyo 150mm', code: 'CAL-011', stock: 4 },
                { name: 'Pistola de Calor DeWalt 1800W', code: 'PIS-012', stock: 3 }
            ];

            const recordsToUpsert = MOCK_TOOLS.map(t => {
                const record = {
                    name: t.name,
                    code: t.code,
                    stock: t.stock,
                    repair_stock: 0
                };
                
                let matchedId = null;
                if (t.code && codeMap[t.code.toLowerCase()]) {
                    matchedId = codeMap[t.code.toLowerCase()].id;
                } else if (nameMap[t.name.toLowerCase()]) {
                    matchedId = nameMap[t.name.toLowerCase()].id;
                }

                if (matchedId) {
                    record.id = matchedId;
                }
                return record;
            });

            const { error: upsertErr } = await supabase.from('inventory').upsert(recordsToUpsert);
            if (upsertErr) throw upsertErr;

            alert('Herramientas de prueba cargadas correctamente.');
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error al cargar herramientas de prueba: ' + err.message);
        } finally {
            setLoadingSeed(false);
        }
    };

    const handleExcelToolsUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportingTools(true);
        setImportToolsError('');
        setImportToolsSuccess('');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    throw new Error('El archivo Excel está vacío.');
                }

                const { data: existingItems, error: fetchErr } = await supabase.from('inventory').select('*');
                if (fetchErr) throw fetchErr;

                const codeMap = {};
                const nameMap = {};
                existingItems?.forEach(item => {
                    if (item.code) codeMap[item.code.toLowerCase().trim()] = item;
                    if (item.name) nameMap[item.name.toLowerCase().trim()] = item;
                });

                const recordsToUpsert = [];
                const errorsInRow = [];

                data.forEach((row, index) => {
                    const findValue = (prefixes) => {
                        const key = Object.keys(row).find(k => 
                            prefixes.some(p => k.toLowerCase().replace(/\s+/g, '').includes(p.toLowerCase().replace(/\s+/g, '')))
                        );
                        return key ? row[key] : null;
                    };

                    const name = findValue(['nombre', 'material', 'herramienta', 'name', 'articulo', 'desc']);
                    const code = findValue(['codigo', 'code', 'id', 'identificador', 'barras']);
                    const stockVal = findValue(['stock', 'cantidad', 'disponible', 'qty', 'count', 'inicial']);

                    if (!name) {
                        if (code || stockVal !== null) {
                            errorsInRow.push(`Fila ${index + 2}: Falta columna Nombre del material.`);
                        }
                        return;
                    }

                    const stock = parseInt(stockVal) || 0;
                    const record = {
                        name: name.toString().trim(),
                        code: code ? code.toString().trim() : null,
                        stock: Math.max(0, stock),
                        repair_stock: 0
                    };

                    let matchedId = null;
                    if (record.code && codeMap[record.code.toLowerCase()]) {
                        matchedId = codeMap[record.code.toLowerCase()].id;
                    } else if (nameMap[record.name.toLowerCase()]) {
                        matchedId = nameMap[record.name.toLowerCase()].id;
                    }

                    if (matchedId) {
                        record.id = matchedId;
                    }

                    recordsToUpsert.push(record);
                });

                if (errorsInRow.length > 0) {
                    throw new Error(errorsInRow.join('\n'));
                }

                if (recordsToUpsert.length > 0) {
                    const { error: upsertErr } = await supabase.from('inventory').upsert(recordsToUpsert);
                    if (upsertErr) throw upsertErr;

                    setImportToolsSuccess(`Se importaron/actualizaron ${recordsToUpsert.length} materiales correctamente.`);
                    fetchInventory();
                } else {
                    throw new Error('No se encontraron registros válidos para importar.');
                }
            } catch (err) {
                console.error(err);
                setImportToolsError(err.message || 'Error al analizar el archivo Excel.');
            } finally {
                setImportingTools(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleUpdateStock = async (id, currentStock, change) => {
        const newStock = Math.max(0, currentStock + change);
        try {
            const { error } = await supabase.from('inventory').update({ stock: newStock }).eq('id', id);
            if (error) throw error;
            fetchInventory();
        } catch (err) {
            alert('Error al actualizar stock');
        }
    };

    const handleUpdateRepairStock = async (id, currentRepair, change) => {
        const newRepair = Math.max(0, currentRepair + change);
        try {
            const { error } = await supabase.from('inventory').update({ repair_stock: newRepair }).eq('id', id);
            if (error) throw error;
            fetchInventory();
        } catch (err) {
            alert('Error al actualizar stock en reparación');
        }
    };

    // New Order Form controls
    const addToolToOrderForm = (tool) => {
        if (newOrder.tools.some(t => t.toolId === tool.id)) {
            alert('Esta herramienta ya fue agregada.');
            return;
        }
        if (tool.stock <= 0) {
            alert('No hay stock disponible.');
            return;
        }
        setNewOrder(prev => ({
            ...prev,
            tools: [...prev.tools, { toolId: tool.id, name: tool.name, quantity: 1, maxStock: tool.stock }]
        }));
        setShowToolResults(false);
        setOrderToolSearch('');
    };

    const removeToolFromOrderForm = (toolId) => {
        setNewOrder(prev => ({
            ...prev,
            tools: prev.tools.filter(t => t.toolId !== toolId)
        }));
    };

    const updateToolQtyInOrderForm = (toolId, qty) => {
        setNewOrder(prev => ({
            ...prev,
            tools: prev.tools.map(t => {
                if (t.toolId === toolId) {
                    const parsedQty = Math.max(1, Math.min(t.maxStock, parseInt(qty) || 1));
                    return { ...t, quantity: parsedQty };
                }
                return t;
            })
        }));
    };

    const handleOrderCourseChange = (courseVal, divisionVal = null) => {
        let defaultDiv = divisionVal;
        if (divisionVal === null) {
            if (['1°', '2°', '3°'].includes(courseVal)) {
                defaultDiv = 'A';
            } else if (['4°', '5°', '6°', '7°'].includes(courseVal)) {
                defaultDiv = 'TEL';
            } else {
                defaultDiv = '';
            }
        }
        
        setNewOrder(prev => {
            const updated = {
                ...prev,
                course: courseVal,
                division: defaultDiv
            };
            
            const dbCourse = formatDbCourseName(courseVal, defaultDiv);
            
            // 1. Validate subject if it's in catalog
            const subjectInCatalog = subjectsList.some(s => s.name === prev.subjectOrProject);
            if (subjectInCatalog) {
                const isSubjectValid = subjectsList.some(s => s.name === prev.subjectOrProject && s.courses?.name === dbCourse);
                if (!isSubjectValid) {
                    updated.subjectOrProject = ''; // clear invalid subject
                }
            }
            
            // 2. Validate teacher
            if (prev.teacherId) {
                const isTeacherValid = subjectsList.some(s => s.teacher_id === prev.teacherId && s.courses?.name === dbCourse);
                if (!isTeacherValid) {
                    // Find first teacher for this course
                    const match = subjectsList.find(s => s.courses?.name === dbCourse);
                    updated.teacherId = match ? match.teacher_id : '';
                }
            }
            
            return updated;
        });
    };

    const handleOrderTeacherChange = (teacherIdVal) => {
        setNewOrder(prev => {
            const updated = {
                ...prev,
                teacherId: teacherIdVal
            };
            
            if (!teacherIdVal) return updated;
            
            // Find all assignments for this teacher
            const teacherAssignments = subjectsList.filter(s => s.teacher_id === teacherIdVal);
            if (teacherAssignments.length > 0) {
                // Check if current course/division is valid for this teacher
                const dbCourse = formatDbCourseName(prev.course, prev.division);
                const isCourseValid = teacherAssignments.some(a => a.courses?.name === dbCourse);
                
                if (!isCourseValid) {
                    // Auto-set to the first valid course for this teacher
                    const firstAssignment = teacherAssignments[0];
                    const courseVal = firstAssignment.courses?.name || '';
                    let parsedCourse = '1°';
                    let parsedDivision = 'A';
                    
                    if (courseVal.includes('o')) {
                        const parts = courseVal.split('o');
                        parsedCourse = parts[0] + '°';
                        parsedDivision = parts[1];
                    } else {
                        const match = courseVal.match(/^(\d)(.*)$/);
                        if (match) {
                            parsedCourse = match[1] + '°';
                            parsedDivision = match[2];
                        }
                    }
                    updated.course = parsedCourse;
                    updated.division = parsedDivision;
                }
                
                // Check if subject is valid for this teacher
                const subjectInCatalog = subjectsList.some(s => s.name === prev.subjectOrProject);
                if (subjectInCatalog) {
                    const isSubjectValid = teacherAssignments.some(s => s.name === prev.subjectOrProject);
                    if (!isSubjectValid) {
                        updated.subjectOrProject = ''; // clear subject
                    }
                }
            }
            
            return updated;
        });
    };

    const handleSubjectSelect = (subjectName, isReservation = false, isEditing = false) => {
        const setter = isEditing ? setEditingReservation : (isReservation ? setNewReservation : setNewOrder);
        const current = isEditing ? editingReservation : (isReservation ? newReservation : newOrder);
        
        // Find all assignments for this subject name
        const assignments = subjectsList.filter(s => s.name === subjectName);
        
        if (assignments.length > 0) {
            // If there's only one assignment in the system, we can auto-fill everything!
            if (assignments.length === 1) {
                const assignment = assignments[0];
                const courseVal = assignment.courses?.name || ''; // e.g. "4TEL" or "1oA"
                let parsedCourse = '1°';
                let parsedDivision = 'A';
                
                if (courseVal.includes('o')) {
                     const parts = courseVal.split('o');
                     parsedCourse = parts[0] + '°';
                     parsedDivision = parts[1];
                } else {
                     const match = courseVal.match(/^(\d)(.*)$/);
                     if (match) {
                         parsedCourse = match[1] + '°';
                         parsedDivision = match[2];
                     }
                }
                
                setter(prev => ({
                    ...prev,
                    subjectOrProject: subjectName,
                    course: parsedCourse,
                    division: parsedDivision,
                    ...(!isReservation && !isEditing ? { teacherId: assignment.teacher_id } : {})
                }));
            } else {
                // Multiple courses/teachers for this subject.
                // Check if current course is valid
                const dbCourse = formatDbCourseName(current.course, current.division);
                const hasCurrentCourse = assignments.some(a => a.courses?.name === dbCourse);
                
                if (!hasCurrentCourse) {
                    const firstAssignment = assignments[0];
                    const courseVal = firstAssignment.courses?.name || '';
                    let parsedCourse = '1°';
                    let parsedDivision = 'A';
                    
                    if (courseVal.includes('o')) {
                        const parts = courseVal.split('o');
                        parsedCourse = parts[0] + '°';
                        parsedDivision = parts[1];
                    } else {
                        const match = courseVal.match(/^(\d)(.*)$/);
                        if (match) {
                            parsedCourse = match[1] + '°';
                            parsedDivision = match[2];
                        }
                    }
                    
                    setter(prev => ({
                        ...prev,
                        subjectOrProject: subjectName,
                        course: parsedCourse,
                        division: parsedDivision,
                        ...(!isReservation && !isEditing ? { teacherId: firstAssignment.teacher_id } : {})
                    }));
                } else {
                    // Current course is valid.
                    if (!isReservation && !isEditing && current.teacherId) {
                        const isValidTeacher = assignments.some(a => a.courses?.name === dbCourse && a.teacher_id === current.teacherId);
                        if (!isValidTeacher) {
                            const match = assignments.find(a => a.courses?.name === dbCourse);
                            if (match) {
                                setter(prev => ({
                                    ...prev,
                                    subjectOrProject: subjectName,
                                    teacherId: match.teacher_id
                                }));
                            }
                        } else {
                            setter(prev => ({ ...prev, subjectOrProject: subjectName }));
                        }
                    } else if (!isReservation && !isEditing) {
                        const match = assignments.find(a => a.courses?.name === dbCourse);
                        if (match) {
                            setter(prev => ({
                                ...prev,
                                subjectOrProject: subjectName,
                                teacherId: match.teacher_id
                            }));
                        } else {
                            setter(prev => ({ ...prev, subjectOrProject: subjectName }));
                        }
                    } else {
                        setter(prev => ({ ...prev, subjectOrProject: subjectName }));
                    }
                }
            }
        } else {
            setter(prev => ({ ...prev, subjectOrProject: subjectName }));
        }
    };

    const getSuggestedSubjects = (isReservation = false, isEditing = false) => {
        const current = isEditing ? editingReservation : (isReservation ? newReservation : newOrder);
        if (!current) return [];
        const teacherIdVal = (isReservation || isEditing) ? (userProfile?.id || null) : current.teacherId;
        
        let filtered = subjectsList;
        
        if (teacherIdVal) {
            filtered = filtered.filter(s => s.teacher_id === teacherIdVal);
        }
        
        const dbCourse = formatDbCourseName(current.course, current.division);
        if (dbCourse) {
            filtered = filtered.filter(s => s.courses?.name === dbCourse);
        }
        
        return [...new Set(filtered.map(s => s.name))].sort();
    };

    const getFilteredSubjectSuggestions = (isReservation = false, isEditing = false) => {
        const current = isEditing ? editingReservation : (isReservation ? newReservation : newOrder);
        if (!current) return [];
        const query = (current.subjectOrProject || '').toLowerCase();
        
        const baseSuggestions = getSuggestedSubjects(isReservation, isEditing);
        if (!query) return baseSuggestions;
        
        return baseSuggestions.filter(name => name.toLowerCase().includes(query));
    };

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (!newOrder.studentName || !newOrder.subjectOrProject || !newOrder.teacherId) {
            alert('Por favor complete los campos requeridos.');
            return;
        }
        if (newOrder.tools.length === 0) {
            alert('Debe agregar al menos una herramienta a la orden.');
            return;
        }

        setActionLoading('create_order');
        try {
            // 1. Create order
            const { data: orderData, error: orderErr } = await supabase
                .from('tool_orders')
                .insert([{
                    date: newOrder.date,
                    student_name: newOrder.studentName,
                    course: newOrder.course,
                    division: newOrder.division || null,
                    subject_or_project: newOrder.subjectOrProject,
                    teacher_id: newOrder.teacherId,
                    status: 'Abierta'
                }])
                .select()
                .single();

            if (orderErr) throw orderErr;

            // 2. Insert items and discount stock
            const itemsToInsert = newOrder.tools.map(t => ({
                order_id: orderData.id,
                tool_id: t.toolId,
                quantity: t.quantity,
                returned_quantity: 0,
                status: 'Prestado'
            }));

            const { error: itemsErr } = await supabase.from('tool_order_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;

            // 3. Discount inventory stocks
            for (const t of newOrder.tools) {
                const { error: stockErr } = await supabase
                    .from('inventory')
                    .update({ stock: Math.max(0, t.maxStock - t.quantity) })
                    .eq('id', t.toolId);
                if (stockErr) console.error('Error updating stock', stockErr);
            }

            // Send notification to the authorizing teacher
            try {
                if (newOrder.teacherId) {
                    const formattedDate = newOrder.date.split('-').reverse().join('/');
                    await createNotification(
                        newOrder.teacherId,
                        'Nuevo Préstamo Autorizado',
                        `Se ha registrado un préstamo activo para el alumno ${newOrder.studentName} (${newOrder.course} ${newOrder.division || ''}) bajo tu autorización el ${formattedDate}.`,
                        'planning'
                    );
                }
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Orden de préstamo creada exitosamente.');
            setShowNewOrderForm(false);
            setNewOrder({
                studentName: '',
                course: '1°',
                division: 'A',
                subjectOrProject: '',
                teacherId: '',
                date: new Date().toISOString().split('T')[0],
                tools: []
            });
            fetchOrders();
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error creando la orden de préstamo. Verifique que la base de datos haya sido migrada.');
        } finally {
            setActionLoading(null);
        }
    };

    // Reservations Form controls
    const addToolToReservationForm = (tool) => {
        if (newReservation.tools.some(t => t.toolId === tool.id)) {
            alert('Esta herramienta ya fue agregada.');
            return;
        }
        setNewReservation(prev => ({
            ...prev,
            tools: [...prev.tools, { toolId: tool.id, name: tool.name, quantity: 1, maxStock: tool.stock }]
        }));
        setShowReservationToolResults(false);
        setReservationToolSearch('');
    };

    const removeToolFromReservationForm = (toolId) => {
        setNewReservation(prev => ({
            ...prev,
            tools: prev.tools.filter(t => t.toolId !== toolId)
        }));
    };

    const updateToolQtyInReservationForm = (toolId, qty) => {
        setNewReservation(prev => ({
            ...prev,
            tools: prev.tools.map(t => {
                if (t.toolId === toolId) {
                    const parsedQty = Math.max(1, parseInt(qty) || 1);
                    return { ...t, quantity: parsedQty };
                }
                return t;
            })
        }));
    };

    const handleReservationCourseChange = (courseVal, divisionVal = null) => {
        let defaultDiv = divisionVal;
        if (divisionVal === null) {
            if (['1°', '2°', '3°'].includes(courseVal)) {
                defaultDiv = 'A';
            } else if (['4°', '5°', '6°', '7°'].includes(courseVal)) {
                defaultDiv = 'TEL';
            } else {
                defaultDiv = '';
            }
        }
        
        setNewReservation(prev => {
            const updated = {
                ...prev,
                course: courseVal,
                division: defaultDiv
            };
            
            const dbCourse = formatDbCourseName(courseVal, defaultDiv);
            
            // Validate subject against teacher (userProfile.id) and course
            const subjectInCatalog = subjectsList.some(s => s.name === prev.subjectOrProject);
            if (subjectInCatalog && userProfile) {
                const isSubjectValid = subjectsList.some(s => 
                    s.name === prev.subjectOrProject && 
                    s.courses?.name === dbCourse && 
                    s.teacher_id === userProfile.id
                );
                if (!isSubjectValid) {
                    updated.subjectOrProject = ''; // clear invalid subject
                }
            }
            
            return updated;
        });
    };

    const handleCreateReservation = async (e) => {
        e.preventDefault();
        if (!newReservation.studentName || !newReservation.subjectOrProject) {
            alert('Por favor complete los campos requeridos.');
            return;
        }
        if (newReservation.tools.length === 0) {
            alert('Debe agregar al menos una herramienta a la solicitud.');
            return;
        }

        setActionLoading('create_reservation');
        try {
            // 1. Create order as Pendiente
            const { data: orderData, error: orderErr } = await supabase
                .from('tool_orders')
                .insert([{
                    date: newReservation.date,
                    student_name: newReservation.studentName,
                    course: newReservation.course,
                    division: newReservation.division || null,
                    subject_or_project: newReservation.subjectOrProject,
                    teacher_id: userProfile?.id || null,
                    status: 'Pendiente'
                }])
                .select()
                .single();

            if (orderErr) throw orderErr;

            // 2. Insert items
            const itemsToInsert = newReservation.tools.map(t => ({
                order_id: orderData.id,
                tool_id: t.toolId,
                quantity: t.quantity,
                returned_quantity: 0,
                status: 'Prestado'
            }));

            const { error: itemsErr } = await supabase.from('tool_order_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;

            // 3. Send notification to staff
            try {
                const formattedDate = newReservation.date.split('-').reverse().join('/');
                const teacherName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim();
                await createNotification(
                    null,
                    'Nueva Reserva Pendiente',
                    `El docente ${teacherName} ha solicitado materiales para el curso ${newReservation.course} ${newReservation.division || ''} el ${formattedDate}.`,
                    'planning'
                );
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Solicitud de materiales registrada con éxito.');
            setShowNewReservationForm(false);
            setNewReservation({
                studentName: '',
                course: '1°',
                division: 'A',
                subjectOrProject: '',
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                tools: []
            });
            
            if (isPanolOrAdmin) {
                fetchOrders();
            } else {
                fetchMyAuthorizations();
            }
        } catch (err) {
            console.error(err);
            alert('Error al registrar la solicitud: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReceiveReservation = async (orderId) => {
        setActionLoading(`receive_reservation_${orderId}`);
        try {
            const { error } = await supabase
                .from('tool_orders')
                .update({ status: 'Recepcionado' })
                .eq('id', orderId);
            if (error) throw error;

            // Send notification to the teacher
            try {
                const order = orders.find(o => o.id === orderId);
                if (order && order.teacher_id) {
                    const formattedDate = order.date.split('-').reverse().join('/');
                    await createNotification(
                        order.teacher_id,
                        'Reserva Recepcionada',
                        `Tu reserva de materiales para el ${formattedDate} ha sido recepcionada por Pañol.`,
                        'planning'
                    );
                }
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Solicitud de materiales recepcionada con éxito.');
            fetchOrders();
        } catch (err) {
            console.error(err);
            alert('Error al recepcionar la solicitud.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveObservation = async (orderId) => {
        const text = observationsTextState[orderId] || '';
        setActionLoading(`save_observation_${orderId}`);
        try {
            const { error } = await supabase
                .from('tool_orders')
                .update({ observations: text.trim() || null })
                .eq('id', orderId);
            if (error) throw error;

            // Send notification to the teacher if observation is added
            try {
                const order = orders.find(o => o.id === orderId);
                if (order && order.teacher_id && text.trim()) {
                    const formattedDate = order.date.split('-').reverse().join('/');
                    await createNotification(
                        order.teacher_id,
                        'Nueva Observación en Reserva',
                        `Se ha añadido una observación a tu reserva para el ${formattedDate}: "${text.trim()}"`,
                        'planning'
                    );
                }
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Observaciones guardadas con éxito.');
            fetchOrders();
        } catch (err) {
            console.error(err);
            alert('Error al guardar las observaciones.');
        } finally {
            setActionLoading(null);
        }
    };

    const startEditReservation = (order) => {
        const formattedTools = order.items?.map(item => {
            const invItem = inventory.find(i => i.id === item.tool_id);
            return {
                toolId: item.tool_id,
                name: item.tool?.name || 'Material Desconocido',
                quantity: item.quantity,
                maxStock: invItem ? invItem.stock : 999
            };
        }) || [];
        setEditingReservation({
            id: order.id,
            studentName: order.student_name,
            course: order.course,
            division: order.division || '',
            subjectOrProject: order.subject_or_project,
            date: order.date,
            tools: formattedTools
        });
        setEditReservationToolSearch('');
        setShowEditReservationToolResults(false);
    };

    const addToolToEditReservationForm = (tool) => {
        if (editingReservation.tools.some(t => t.toolId === tool.id)) {
            alert('Esta herramienta ya fue agregada.');
            return;
        }
        setEditingReservation(prev => ({
            ...prev,
            tools: [...prev.tools, { toolId: tool.id, name: tool.name, quantity: 1, maxStock: tool.stock }]
        }));
        setShowEditReservationToolResults(false);
        setEditReservationToolSearch('');
    };

    const removeToolFromEditReservationForm = (toolId) => {
        setEditingReservation(prev => ({
            ...prev,
            tools: prev.tools.filter(t => t.toolId !== toolId)
        }));
    };

    const updateToolQtyInEditReservationForm = (toolId, qty) => {
        setEditingReservation(prev => ({
            ...prev,
            tools: prev.tools.map(t => {
                if (t.toolId === toolId) {
                    const parsedQty = Math.max(1, parseInt(qty) || 1);
                    return { ...t, quantity: parsedQty };
                }
                return t;
            })
        }));
    };

    const handleEditReservationCourseChange = (courseVal, divisionVal = null) => {
        let defaultDiv = divisionVal;
        if (divisionVal === null) {
            if (['1°', '2°', '3°'].includes(courseVal)) {
                defaultDiv = 'A';
            } else if (['4°', '5°', '6°', '7°'].includes(courseVal)) {
                defaultDiv = 'TEL';
            } else {
                defaultDiv = '';
            }
        }
        
        setEditingReservation(prev => {
            const updated = {
                ...prev,
                course: courseVal,
                division: defaultDiv
            };
            
            const dbCourse = formatDbCourseName(courseVal, defaultDiv);
            
            // Validate subject against teacher (userProfile.id) and course
            const subjectInCatalog = subjectsList.some(s => s.name === prev.subjectOrProject);
            if (subjectInCatalog && userProfile) {
                const isSubjectValid = subjectsList.some(s => 
                    s.name === prev.subjectOrProject && 
                    s.courses?.name === dbCourse && 
                    s.teacher_id === userProfile.id
                );
                if (!isSubjectValid) {
                    updated.subjectOrProject = ''; // clear invalid subject
                }
            }
            
            return updated;
        });
    };

    const handleSaveEditReservation = async (e) => {
        e.preventDefault();
        if (!editingReservation.studentName || !editingReservation.subjectOrProject) {
            alert('Por favor complete los campos requeridos.');
            return;
        }
        if (editingReservation.tools.length === 0) {
            alert('Debe agregar al menos una herramienta a la solicitud.');
            return;
        }

        setActionLoading('save_edit_reservation');
        try {
            // 1. Update order header details
            const { error: orderErr } = await supabase
                .from('tool_orders')
                .update({
                    date: editingReservation.date,
                    student_name: editingReservation.studentName,
                    course: editingReservation.course,
                    division: editingReservation.division || null,
                    subject_or_project: editingReservation.subjectOrProject
                })
                .eq('id', editingReservation.id);

            if (orderErr) throw orderErr;

            // 2. Delete all existing items
            const { error: deleteErr } = await supabase
                .from('tool_order_items')
                .delete()
                .eq('order_id', editingReservation.id);

            if (deleteErr) throw deleteErr;

            // 3. Insert new tools list
            const itemsToInsert = editingReservation.tools.map(t => ({
                order_id: editingReservation.id,
                tool_id: t.toolId,
                quantity: t.quantity,
                returned_quantity: 0,
                status: 'Prestado'
            }));

            const { error: insertErr } = await supabase.from('tool_order_items').insert(itemsToInsert);
            if (insertErr) throw insertErr;

            // 4. Send notification to staff
            try {
                const formattedDate = editingReservation.date.split('-').reverse().join('/');
                const teacherName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim();
                await createNotification(
                    null,
                    'Reserva Modificada',
                    `El docente ${teacherName} ha modificado su reserva para ${editingReservation.course} ${editingReservation.division || ''} del ${formattedDate}.`,
                    'planning'
                );
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Solicitud de materiales actualizada con éxito.');
            setEditingReservation(null);
            if (isPanolOrAdmin) {
                fetchOrders();
            } else {
                fetchMyAuthorizations();
            }
        } catch (err) {
            console.error(err);
            alert('Error al actualizar la reserva: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleApproveReservation = (order) => {
        const conflicts = [];
        order.items?.forEach(item => {
            const invItem = inventory.find(i => i.id === item.tool_id);
            const availableStock = invItem ? invItem.stock : 0;
            if (availableStock < item.quantity) {
                conflicts.push({
                    toolId: item.tool_id,
                    name: item.tool?.name || 'Material Desconocido',
                    requested: item.quantity,
                    available: availableStock
                });
            }
        });

        if (conflicts.length > 0) {
            setStockConflictOrder(order);
            setStockConflictDetails(conflicts);
        } else {
            executeCheckout(order, 'as_is');
        }
    };

    const executeCheckout = async (order, mode) => {
        setActionLoading(`checkout_${order.id}`);
        try {
            if (mode === 'as_is') {
                for (const item of order.items || []) {
                    const invItem = inventory.find(i => i.id === item.tool_id);
                    const currentStock = invItem ? invItem.stock : 0;
                    const { error: stockErr } = await supabase
                        .from('inventory')
                        .update({ stock: currentStock - item.quantity })
                        .eq('id', item.tool_id);
                    if (stockErr) throw stockErr;
                }
            } else if (mode === 'adjust') {
                for (const item of order.items || []) {
                    const invItem = inventory.find(i => i.id === item.tool_id);
                    const availableStock = invItem ? invItem.stock : 0;

                    if (availableStock <= 0) {
                        const { error: deleteErr } = await supabase
                            .from('tool_order_items')
                            .delete()
                            .eq('id', item.id);
                        if (deleteErr) throw deleteErr;
                    } else if (availableStock < item.quantity) {
                        const { error: updateErr } = await supabase
                            .from('tool_order_items')
                            .update({ quantity: availableStock })
                            .eq('id', item.id);
                        if (updateErr) throw updateErr;

                        const { error: stockErr } = await supabase
                            .from('inventory')
                            .update({ stock: 0 })
                            .eq('id', item.tool_id);
                        if (stockErr) throw stockErr;
                    } else {
                        const { error: stockErr } = await supabase
                            .from('inventory')
                            .update({ stock: availableStock - item.quantity })
                            .eq('id', item.tool_id);
                        if (stockErr) throw stockErr;
                    }
                }
            }

            const { error: statusErr } = await supabase
                .from('tool_orders')
                .update({ status: 'Abierta' })
                .eq('id', order.id);
            if (statusErr) throw statusErr;

            // Send notification to the teacher
            try {
                if (order && order.teacher_id) {
                    const formattedDate = order.date.split('-').reverse().join('/');
                    await createNotification(
                        order.teacher_id,
                        'Materiales Retirados',
                        `Se ha registrado el retiro de los materiales de tu reserva para el ${formattedDate}.`,
                        'planning'
                    );
                }
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Retiro de materiales habilitado con éxito. El pedido pasó a la lista del curso correspondiente.');
            setStockConflictOrder(null);
            setStockConflictDetails([]);
            fetchOrders();
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error al habilitar el retiro: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelReservation = async (orderId) => {
        if (!confirm('¿Está seguro de que desea cancelar esta solicitud de materiales?')) return;
        
        setActionLoading(`cancel_reservation_${orderId}`);
        try {
            const { error } = await supabase
                .from('tool_orders')
                .update({ status: 'Cancelado' })
                .eq('id', orderId);
            if (error) throw error;

            // Send notification
            try {
                const order = orders.find(o => o.id === orderId);
                if (order) {
                    const formattedDate = order.date.split('-').reverse().join('/');
                    if (isPanolOrAdmin) {
                        // Staff cancelled it, notify teacher
                        if (order.teacher_id) {
                            await createNotification(
                                order.teacher_id,
                                'Reserva Cancelada',
                                `Tu reserva de materiales para el ${formattedDate} ha sido cancelada por el personal de Pañol.`,
                                'planning'
                            );
                        }
                    } else {
                        // Teacher cancelled it, notify staff
                        const teacherName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim();
                        await createNotification(
                            null,
                            'Reserva Cancelada por Docente',
                            `El docente ${teacherName} ha cancelado su reserva para el ${formattedDate}.`,
                            'planning'
                        );
                    }
                }
            } catch (errNotif) {
                console.error('Failed to create notification:', errNotif);
            }

            alert('Solicitud de materiales cancelada.');
            if (isPanolOrAdmin) {
                fetchOrders();
            } else {
                fetchMyAuthorizations();
            }
        } catch (err) {
            console.error(err);
            alert('Error al cancelar la solicitud.');
        } finally {
            setActionLoading(null);
        }
    };

    // Return items logic
    const handleReturnItem = async (e) => {
        e.preventDefault();
        if (!returningItemId) return;
        
        setActionLoading(returningItemId);
        try {
            // Fetch current item details
            const { data: itemData, error: fetchErr } = await supabase
                .from('tool_order_items')
                .select('*, order:order_id(*), tool:tool_id(*)')
                .eq('id', returningItemId)
                .single();

            if (fetchErr) throw fetchErr;

            const remaining = itemData.quantity - itemData.returned_quantity;
            const parsedReturnQty = Math.min(remaining, Math.max(1, parseInt(returnQty) || 1));

            const newReturnedQty = itemData.returned_quantity + parsedReturnQty;
            const isFullyReturned = newReturnedQty === itemData.quantity;
            const newStatus = isFullyReturned ? (sendToRepair ? 'En Reparacion' : 'Devuelto') : 'Prestado';

            // Format return comment
            let combinedComment = itemData.return_comment || '';
            if (returnComment.trim()) {
                const timestamp = new Date().toLocaleDateString('es-AR');
                const commentText = `[${timestamp} - Cant: ${parsedReturnQty}]: ${returnComment.trim()}${sendToRepair ? ' (A Reparación)' : ''}`;
                combinedComment = combinedComment ? `${combinedComment}\n${commentText}` : commentText;
            }

            // 1. Update tool_order_items
            const { error: updateItemErr } = await supabase
                .from('tool_order_items')
                .update({
                    returned_quantity: newReturnedQty,
                    status: newStatus,
                    return_comment: combinedComment
                })
                .eq('id', returningItemId);

            if (updateItemErr) throw updateItemErr;

            // 2. Update inventory stocks
            if (sendToRepair) {
                const newRepairStock = (itemData.tool.repair_stock || 0) + parsedReturnQty;
                await supabase
                    .from('inventory')
                    .update({ repair_stock: newRepairStock })
                    .eq('id', itemData.tool_id);
            } else {
                const newStock = (itemData.tool.stock || 0) + parsedReturnQty;
                await supabase
                    .from('inventory')
                    .update({ stock: newStock })
                    .eq('id', itemData.tool_id);
            }

            // 3. Check if whole order is now closed
            // Fetch all items in the order
            const { data: allItems } = await supabase
                .from('tool_order_items')
                .select('quantity, returned_quantity')
                .eq('order_id', itemData.order_id);

            const allDevueltos = allItems?.every(item => item.quantity === item.returned_quantity) || false;
            
            if (allDevueltos) {
                await supabase
                    .from('tool_orders')
                    .update({ status: 'Cerrada' })
                    .eq('id', itemData.order_id);
            }

            alert('Devolución registrada con éxito.');
            setReturningItemId(null);
            setReturnQty(1);
            setReturnComment('');
            setSendToRepair(false);
            fetchOrders();
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error al registrar la devolución');
        } finally {
            setActionLoading(null);
        }
    };

    // Edit open order logic (add item)
    const handleAddToolToOrder = async (e) => {
        e.preventDefault();
        if (!addingToolToOrderId || !newToolForOrder.toolId) return;

        setActionLoading(`add_tool_${addingToolToOrderId}`);
        try {
            // Check if already in order
            const { data: existingItems } = await supabase
                .from('tool_order_items')
                .select('*')
                .eq('order_id', addingToolToOrderId)
                .eq('tool_id', newToolForOrder.toolId);

            if (existingItems && existingItems.length > 0) {
                alert('Este elemento ya está en la orden. Si deseas cambiar su cantidad, por favor cancela e interactúa con el elemento.');
                return;
            }

            // Discount inventory stock
            await supabase
                .from('inventory')
                .update({ stock: Math.max(0, newToolForOrder.maxStock - newToolForOrder.quantity) })
                .eq('id', newToolForOrder.toolId);

            // Insert new item
            await supabase
                .from('tool_order_items')
                .insert([{
                    order_id: addingToolToOrderId,
                    tool_id: newToolForOrder.toolId,
                    quantity: newToolForOrder.quantity,
                    returned_quantity: 0,
                    status: 'Prestado'
                }]);

            // Re-open order just in case it was closed (though edit button only displays on Abiertas)
            await supabase
                .from('tool_orders')
                .update({ status: 'Abierta' })
                .eq('id', addingToolToOrderId);

            alert('Elemento agregado a la orden con éxito.');
            setAddingToolToOrderId(null);
            setNewToolForOrder({ toolId: '', quantity: 1, maxStock: 0 });
            setExistingOrderToolSearch('');
            fetchOrders();
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error al agregar herramienta');
        } finally {
            setActionLoading(null);
        }
    };

    // Remove item from order completely
    const handleRemoveItemFromOrder = async (itemId, toolId, quantity, returnedQuantity) => {
        const isCoordinatorOrGerente = role === 'coordinador' || role === 'gerente';
        
        if (returnedQuantity > 0 && !isCoordinatorOrGerente) {
            alert('No se puede eliminar un elemento que ya registra devoluciones. Solo los coordinadores o el gerente pueden realizar esta acción.');
            return;
        }

        const confirmMsg = returnedQuantity > 0 
            ? 'Este elemento ya registra devoluciones. ¿Seguro que quieres removerlo de la orden por completo? Se reintegrará al stock la cantidad pendiente de devolución.'
            : '¿Seguro que quieres remover este elemento de la orden? Las unidades se reintegrarán al stock.';

        if (!confirm(confirmMsg)) return;

        setActionLoading(`remove_item_${itemId}`);
        try {
            // Get current stock
            const { data: toolData } = await supabase.from('inventory').select('stock').eq('id', toolId).single();
            const currentStock = toolData ? toolData.stock : 0;

            // Delete item
            await supabase.from('tool_order_items').delete().eq('id', itemId);

            // Reintegrate unreturned stock
            const unreturnedQty = quantity - returnedQuantity;
            if (unreturnedQty > 0) {
                await supabase.from('inventory').update({ stock: currentStock + unreturnedQty }).eq('id', toolId);
            }

            alert('Elemento removido.');
            fetchOrders();
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error al remover el elemento');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteOrder = async (orderId) => {
        if (!confirm('¿Está seguro de que desea eliminar esta orden de préstamo por completo? Esta acción eliminará permanentemente la orden y todos sus registros de herramientas. El stock no será reintegrado automáticamente.')) return;
        
        setActionLoading(`delete_order_${orderId}`);
        try {
            const { error } = await supabase.from('tool_orders').delete().eq('id', orderId);
            if (error) throw error;
            
            alert('Orden de préstamo eliminada permanentemente.');
            fetchOrders();
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert('Error al eliminar la orden de préstamo.');
        } finally {
            setActionLoading(null);
        }
    };

    // Filters implementation
    const filteredOrders = orders.filter(order => {
        // Exclude reservations and canceled requests from normal loan tabs
        if (order.status === 'Pendiente' || order.status === 'Cancelado') return false;

        // Cycle Filter
        if (selectedCycle !== 'TODOS') {
            const cycle = getCourseCycle(order.course);
            if (cycle !== selectedCycle) return false;
        }
        // Course Filter
        if (filterCourse !== 'TODOS' && order.course !== filterCourse) {
            return false;
        }
        // Division Filter
        if (filterDivision !== 'TODOS' && order.division !== filterDivision) {
            return false;
        }
        // Status Filter
        if (ordersStatusFilter !== 'TODOS' && order.status !== ordersStatusFilter) {
            return false;
        }
        // Search Term
        if (ordersSearch.trim()) {
            const term = ordersSearch.toLowerCase();
            const teacherName = `${order.teacher?.first_name || ''} ${order.teacher?.last_name || ''}`.toLowerCase();
            const matches = 
                order.student_name.toLowerCase().includes(term) ||
                order.subject_or_project.toLowerCase().includes(term) ||
                order.date.includes(term) ||
                teacherName.includes(term) ||
                (order.course && order.course.toLowerCase().includes(term)) ||
                (order.division && order.division.toLowerCase().includes(term));
            
            if (!matches) return false;
        }
        return true;
    });

    const filteredInventory = inventory.filter(item =>
        item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        (item.code && item.code.includes(inventorySearch))
    );

    // Search tools in New Order Form
    const filteredToolsForOrder = inventory.filter(item =>
        item.name.toLowerCase().includes(orderToolSearch.toLowerCase()) ||
        (item.code && item.code.includes(orderToolSearch))
    );

    // Search tools in Existing Order Edit Form
    const filteredToolsForExistingOrder = inventory.filter(item =>
        item.name.toLowerCase().includes(existingOrderToolSearch.toLowerCase()) ||
        (item.code && item.code.includes(existingOrderToolSearch))
    );

    // Search tools in Edit Reservation Form (Docente)
    const filteredToolsForEditReservation = inventory.filter(item =>
        item.name.toLowerCase().includes(editReservationToolSearch.toLowerCase()) ||
        (item.code && item.code.includes(editReservationToolSearch))
    );

    // Calculate pending reservations and today's withdrawals count
    const pendingReservationsCount = orders.filter(o => o.status === 'Pendiente').length;

    const localDate = new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const todayRetirosCount = orders.filter(o => o.status === 'Recepcionado' && o.date === todayStr).length;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header Section */}
            <header className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <PackageOpen size={120} className="text-primary" />
                </div>

                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[var(--text-primary)] shadow-lg shadow-primary/20">
                        <PackageOpen size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight mb-1">Pañol y Préstamos</h2>
                        <p className="text-secondary font-medium">Control de stock en tiempo real, registro de órdenes por curso y trazabilidad.</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 relative z-10">
                    {isPanolOrAdmin && (
                        <button 
                            onClick={() => setShowNewOrderForm(true)} 
                            className="btn btn-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2"
                        >
                            <Plus size={18} /> Nuevo Préstamo
                        </button>
                    )}
                    {role === 'docente' && (
                        <button 
                            onClick={() => setShowNewReservationForm(true)} 
                            className="btn btn-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2"
                        >
                            <Calendar size={18} /> Solicitar Materiales (Reserva)
                        </button>
                    )}
                </div>
            </header>
 
            {/* Navigation Tabs */}
            <div className="flex bg-surface-hover/30 p-1.5 rounded-xl border border-color/40 gap-1 w-fit overflow-x-auto max-w-full">
                {isPanolOrAdmin ? (
                    <>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'orders' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <Clock size={15} />
                            Órdenes de Préstamo
                        </button>
                        <button
                            onClick={() => setActiveTab('reservations')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'reservations' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <Calendar size={15} />
                            <span>Reservas Docentes</span>
                            {pendingReservationsCount > 0 && (
                                <span className="ml-1 px-2 py-0.5 text-[10px] font-black bg-error text-white rounded-full leading-none shadow-sm shadow-error/25 animate-pulse">
                                    {pendingReservationsCount}
                                </span>
                            )}
                            {todayRetirosCount > 0 && (
                                <span className="ml-1 px-2 py-0.5 text-[10px] font-black bg-success text-white rounded-full leading-none shadow-sm shadow-success/25">
                                    {todayRetirosCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('pending_returns')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'pending_returns' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <AlertCircle size={15} />
                            Faltan Devolver
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'inventory' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <Layers size={15} />
                            Inventario / Stock
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <History size={15} />
                            Trazabilidad por Material
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setActiveTab('my_reservations')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'my_reservations' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <Calendar size={15} />
                            Mis Reservas
                        </button>
                        <button
                            onClick={() => setActiveTab('my_authorizations')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'my_authorizations' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <UserCheck size={15} />
                            Mis Autorizaciones
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'inventory' ? 'bg-primary text-[var(--text-primary)] shadow-md' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/80'}`}
                        >
                            <Layers size={15} />
                            Inventario (Disponibilidad)
                        </button>
                    </>
                )}
            </div>

            {/* NEW ORDER MODAL FORM */}
            {showNewOrderForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-fade-in-up space-y-6 relative border border-color">
                        <div className="flex justify-between items-center border-b border-color pb-4">
                            <h3 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                                <Plus className="text-primary" /> Nuevo Préstamo de Pañol
                            </h3>
                            <button onClick={() => setShowNewOrderForm(false)} className="text-secondary hover:text-[var(--text-primary)] font-bold text-sm">Cerrar</button>
                        </div>

                        <form onSubmit={handleCreateOrder} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Nombre del Alumno (Retira) *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={newOrder.studentName} 
                                        onChange={e => setNewOrder({ ...newOrder, studentName: e.target.value })} 
                                        placeholder="Ej: Juan Pérez"
                                        className="text-xs bg-main/50" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Fecha del Préstamo *</label>
                                    <input 
                                        type="date" 
                                        required 
                                        value={newOrder.date} 
                                        onChange={e => setNewOrder({ ...newOrder, date: e.target.value })} 
                                        className="text-xs bg-main/50 font-mono" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Curso *</label>
                                    <select
                                        value={newOrder.course}
                                        onChange={e => handleOrderCourseChange(e.target.value)}
                                        className="text-xs bg-main/50 font-semibold"
                                    >
                                        {COURSES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">División *</label>
                                    {['1°', '2°', '3°', '4°', '5°', '6°', '7°'].includes(newOrder.course) ? (
                                        <select
                                            value={newOrder.division}
                                            onChange={e => handleOrderCourseChange(newOrder.course, e.target.value)}
                                            className="text-xs bg-main/50 font-semibold"
                                        >
                                            {getAvailableDivisions(newOrder.course).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={newOrder.division || ''} 
                                            onChange={e => handleOrderCourseChange(newOrder.course, e.target.value)} 
                                            placeholder="N/A o División"
                                            className="text-xs bg-main/50" 
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Docente Responsable (Autoriza) *</label>
                                    <select
                                        required
                                        value={newOrder.teacherId}
                                        onChange={e => handleOrderTeacherChange(e.target.value)}
                                        className="text-xs bg-main/50"
                                    >
                                        <option value="">Seleccionar Docente...</option>
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Asignatura / Proyecto / Uso *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={newOrder.subjectOrProject} 
                                    onChange={e => {
                                        setNewOrder({ ...newOrder, subjectOrProject: e.target.value });
                                        setShowOrderSubjectSuggestions(true);
                                    }} 
                                    onFocus={() => setShowOrderSubjectSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowOrderSubjectSuggestions(false), 200)}
                                    placeholder="Ej: Taller Mecánica / Proyecto EcoDesafío"
                                    className="text-xs bg-main/50 w-full" 
                                />
                                {showOrderSubjectSuggestions && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-color/30">
                                        {getFilteredSubjectSuggestions(false).length === 0 ? (
                                            <div className="p-3 text-xs text-tertiary italic">No hay sugerencias coincidentes. Puedes escribir libremente.</div>
                                        ) : (
                                            getFilteredSubjectSuggestions(false).map((subName, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onMouseDown={() => handleSubjectSelect(subName, false)}
                                                    className="p-2.5 text-xs hover:bg-surface-hover cursor-pointer text-[var(--text-primary)] transition-colors"
                                                >
                                                    {subName}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Tool selection search inside modal */}
                            <div className="border-t border-color/40 pt-4 space-y-3">
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Seleccionar Herramientas</h4>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar herramientas en stock..."
                                        value={orderToolSearch}
                                        onChange={e => {
                                            setOrderToolSearch(e.target.value);
                                            setShowToolResults(true);
                                        }}
                                        onFocus={() => setShowToolResults(true)}
                                        className="pl-9 text-xs bg-main/30" 
                                    />
                                    {showToolResults && orderToolSearch.trim() && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-color/30">
                                            {filteredToolsForOrder.length === 0 ? (
                                                <div className="p-3 text-xs text-tertiary italic">No se encontraron herramientas.</div>
                                            ) : (
                                                filteredToolsForOrder.map(tool => (
                                                    <div 
                                                        key={tool.id} 
                                                        onClick={() => addToolToOrderForm(tool)}
                                                        className="p-2.5 text-xs hover:bg-surface-hover cursor-pointer flex justify-between items-center transition-colors"
                                                    >
                                                        <div>
                                                            <span className="font-bold text-[var(--text-primary)]">{tool.name}</span>
                                                            <span className="text-[10px] text-tertiary font-mono ml-2">({tool.code || 'S/N'})</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tool.stock > 0 ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                                                            Stock: {tool.stock}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* List of added tools */}
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {newOrder.tools.length === 0 ? (
                                        <p className="text-xs text-tertiary italic text-center py-4 bg-main/10 rounded-xl">Ninguna herramienta agregada aún.</p>
                                    ) : (
                                        newOrder.tools.map(tool => (
                                            <div key={tool.toolId} className="flex items-center justify-between p-2.5 bg-surface-hover/30 border border-color/40 rounded-xl gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tool.name}</p>
                                                    <p className="text-[9px] text-tertiary">Disponible en depósito: {tool.maxStock}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-secondary font-bold">Cant:</span>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            max={tool.maxStock} 
                                                            value={tool.quantity} 
                                                            onChange={e => updateToolQtyInOrderForm(tool.toolId, e.target.value)}
                                                            className="w-14 text-center text-xs py-1 px-1 bg-main border border-color rounded font-bold" 
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeToolFromOrderForm(tool.toolId)}
                                                        className="p-1 text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-color pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowNewOrderForm(false)}
                                    className="px-4 py-2 border border-color rounded-xl text-xs font-bold text-secondary hover:bg-surface-hover"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={actionLoading === 'create_order'}
                                    className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-extrabold hover:bg-primary-hover shadow-sm"
                                >
                                    {actionLoading === 'create_order' ? 'Procesando...' : 'Confirmar Préstamo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* NEW RESERVATION MODAL FORM (FOR TEACHERS) */}
            {showNewReservationForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-fade-in-up space-y-6 relative border border-color">
                        <div className="flex justify-between items-center border-b border-color pb-4">
                            <h3 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                                <Calendar className="text-primary" /> Solicitar Materiales (Reserva)
                            </h3>
                            <button onClick={() => setShowNewReservationForm(false)} className="text-secondary hover:text-[var(--text-primary)] font-bold text-sm">Cerrar</button>
                        </div>

                        <form onSubmit={handleCreateReservation} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Nombre del Alumno (Retira) *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={newReservation.studentName} 
                                        onChange={e => setNewReservation({ ...newReservation, studentName: e.target.value })} 
                                        placeholder="Ej: Alumnos / Juan Pérez"
                                        className="text-xs bg-main/50" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Fecha de la Clase / Reserva *</label>
                                    <input 
                                        type="date" 
                                        required 
                                        min={new Date().toISOString().split('T')[0]}
                                        value={newReservation.date} 
                                        onChange={e => setNewReservation({ ...newReservation, date: e.target.value })} 
                                        className="text-xs bg-main/50 font-mono" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Curso *</label>
                                    <select
                                        value={newReservation.course}
                                        onChange={e => handleReservationCourseChange(e.target.value)}
                                        className="text-xs bg-main/50 font-semibold"
                                    >
                                        {COURSES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">División *</label>
                                    {['1°', '2°', '3°', '4°', '5°', '6°', '7°'].includes(newReservation.course) ? (
                                        <select
                                            value={newReservation.division}
                                            onChange={e => handleReservationCourseChange(newReservation.course, e.target.value)}
                                            className="text-xs bg-main/50 font-semibold"
                                        >
                                            {getAvailableDivisions(newReservation.course).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={newReservation.division || ''} 
                                            onChange={e => handleReservationCourseChange(newReservation.course, e.target.value)} 
                                            placeholder="N/A o División"
                                            className="text-xs bg-main/50" 
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Asignatura / Proyecto / Uso *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={newReservation.subjectOrProject} 
                                    onChange={e => {
                                        setNewReservation({ ...newReservation, subjectOrProject: e.target.value });
                                        setShowReservationSubjectSuggestions(true);
                                    }} 
                                    onFocus={() => setShowReservationSubjectSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowReservationSubjectSuggestions(false), 200)}
                                    placeholder="Ej: Taller Electricidad / Proyecto Integrador"
                                    className="text-xs bg-main/50 w-full" 
                                />
                                {showReservationSubjectSuggestions && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-color/30">
                                        {getFilteredSubjectSuggestions(true).length === 0 ? (
                                            <div className="p-3 text-xs text-tertiary italic">No hay sugerencias coincidentes. Puedes escribir libremente.</div>
                                        ) : (
                                            getFilteredSubjectSuggestions(true).map((subName, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onMouseDown={() => handleSubjectSelect(subName, true)}
                                                    className="p-2.5 text-xs hover:bg-surface-hover cursor-pointer text-[var(--text-primary)] transition-colors"
                                                >
                                                    {subName}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Tool selection search inside reservation modal */}
                            <div className="border-t border-color/40 pt-4 space-y-3">
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Seleccionar Herramientas</h4>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar herramientas..."
                                        value={reservationToolSearch}
                                        onChange={e => {
                                            setReservationToolSearch(e.target.value);
                                            setShowReservationToolResults(true);
                                        }}
                                        onFocus={() => setShowReservationToolResults(true)}
                                        className="pl-9 text-xs bg-main/30" 
                                    />
                                    {showReservationToolResults && reservationToolSearch.trim() && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-color/30">
                                            {filteredToolsForOrder.length === 0 ? (
                                                <div className="p-3 text-xs text-tertiary italic">No se encontraron herramientas.</div>
                                            ) : (
                                                filteredToolsForOrder.map(tool => (
                                                    <div 
                                                        key={tool.id} 
                                                        onClick={() => addToolToReservationForm(tool)}
                                                        className="p-2.5 text-xs hover:bg-surface-hover cursor-pointer flex justify-between items-center transition-colors"
                                                    >
                                                        <div>
                                                            <span className="font-bold text-[var(--text-primary)]">{tool.name}</span>
                                                            <span className="text-[10px] text-tertiary font-mono ml-2">({tool.code || 'S/N'})</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tool.stock > 0 ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                                                            Stock: {tool.stock}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* List of added tools in reservation */}
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {newReservation.tools.length === 0 ? (
                                        <p className="text-xs text-tertiary italic text-center py-4 bg-main/10 rounded-xl">Ninguna herramienta agregada aún.</p>
                                    ) : (
                                        newReservation.tools.map(tool => (
                                            <div key={tool.toolId} className="flex items-center justify-between p-2.5 bg-surface-hover/30 border border-color/40 rounded-xl gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tool.name}</p>
                                                    <p className="text-[9px] text-tertiary">Disponible en depósito: {tool.maxStock}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-secondary font-bold">Cant:</span>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={tool.quantity} 
                                                            onChange={e => updateToolQtyInReservationForm(tool.toolId, e.target.value)}
                                                            className="w-14 text-center text-xs py-1 px-1 bg-main border border-color rounded font-bold" 
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeToolFromReservationForm(tool.toolId)}
                                                        className="p-1 text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-color pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowNewReservationForm(false)}
                                    className="px-4 py-2 border border-color rounded-xl text-xs font-bold text-secondary hover:bg-surface-hover"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={actionLoading === 'create_reservation'}
                                    className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-extrabold hover:bg-primary-hover shadow-sm"
                                >
                                    {actionLoading === 'create_reservation' ? 'Procesando...' : 'Confirmar Solicitud'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT RESERVATION MODAL FORM (FOR TEACHERS) */}
            {editingReservation && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-fade-in-up space-y-6 relative border border-color">
                        <div className="flex justify-between items-center border-b border-color pb-4">
                            <h3 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                                <Edit className="text-primary" /> Editar Solicitud de Materiales
                            </h3>
                            <button onClick={() => setEditingReservation(null)} className="text-secondary hover:text-[var(--text-primary)] font-bold text-sm">Cerrar</button>
                        </div>

                        <form onSubmit={handleSaveEditReservation} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Nombre del Alumno (Retira) *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={editingReservation.studentName} 
                                        onChange={e => setEditingReservation({ ...editingReservation, studentName: e.target.value })} 
                                        placeholder="Ej: Alumnos / Juan Pérez"
                                        className="text-xs bg-main/50" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Fecha de la Clase / Reserva *</label>
                                    <input 
                                        type="date" 
                                        required 
                                        min={new Date().toISOString().split('T')[0]}
                                        value={editingReservation.date} 
                                        onChange={e => setEditingReservation({ ...editingReservation, date: e.target.value })} 
                                        className="text-xs bg-main/50 font-mono" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Curso *</label>
                                    <select
                                        value={editingReservation.course}
                                        onChange={e => handleEditReservationCourseChange(e.target.value)}
                                        className="text-xs bg-main/50 font-semibold"
                                    >
                                        {COURSES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">División *</label>
                                    {['1°', '2°', '3°', '4°', '5°', '6°', '7°'].includes(editingReservation.course) ? (
                                        <select
                                            value={editingReservation.division}
                                            onChange={e => handleEditReservationCourseChange(editingReservation.course, e.target.value)}
                                            className="text-xs bg-main/50 font-semibold"
                                        >
                                            {getAvailableDivisions(editingReservation.course).map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={editingReservation.division || ''} 
                                            onChange={e => handleEditReservationCourseChange(editingReservation.course, e.target.value)} 
                                            placeholder="N/A o División"
                                            className="text-xs bg-main/50" 
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Asignatura / Proyecto / Uso *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingReservation.subjectOrProject} 
                                    onChange={e => {
                                        setEditingReservation({ ...editingReservation, subjectOrProject: e.target.value });
                                        setShowEditReservationSubjectSuggestions(true);
                                    }} 
                                    onFocus={() => setShowEditReservationSubjectSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowEditReservationSubjectSuggestions(false), 200)}
                                    placeholder="Ej: Taller Electricidad / Proyecto Integrador"
                                    className="text-xs bg-main/50 w-full" 
                                />
                                {showEditReservationSubjectSuggestions && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-color/30">
                                        {getFilteredSubjectSuggestions(true, true).length === 0 ? (
                                            <div className="p-3 text-xs text-tertiary italic">No hay sugerencias coincidentes. Puedes escribir libremente.</div>
                                        ) : (
                                            getFilteredSubjectSuggestions(true, true).map((subName, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onMouseDown={() => handleSubjectSelect(subName, true, true)}
                                                    className="p-2.5 text-xs hover:bg-surface-hover cursor-pointer text-[var(--text-primary)] transition-colors"
                                                >
                                                    {subName}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Tool selection search inside edit reservation modal */}
                            <div className="border-t border-color/40 pt-4 space-y-3">
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Seleccionar Herramientas</h4>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar herramientas..."
                                        value={editReservationToolSearch}
                                        onChange={e => {
                                            setEditReservationToolSearch(e.target.value);
                                            setShowEditReservationToolResults(true);
                                        }}
                                        onFocus={() => setShowEditReservationToolResults(true)}
                                        className="pl-9 text-xs bg-main/30" 
                                    />
                                    {showEditReservationToolResults && editReservationToolSearch.trim() && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-color/30">
                                            {filteredToolsForEditReservation.length === 0 ? (
                                                <div className="p-3 text-xs text-tertiary italic">No se encontraron herramientas.</div>
                                            ) : (
                                                filteredToolsForEditReservation.map(tool => (
                                                    <div 
                                                        key={tool.id} 
                                                        onClick={() => addToolToEditReservationForm(tool)}
                                                        className="p-2.5 text-xs hover:bg-surface-hover cursor-pointer flex justify-between items-center transition-colors"
                                                    >
                                                        <div>
                                                            <span className="font-bold text-[var(--text-primary)]">{tool.name}</span>
                                                            <span className="text-[10px] text-tertiary font-mono ml-2">({tool.code || 'S/N'})</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tool.stock > 0 ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                                                            Stock: {tool.stock}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* List of added tools in editing reservation */}
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {editingReservation.tools.length === 0 ? (
                                        <p className="text-xs text-tertiary italic text-center py-4 bg-main/10 rounded-xl">Ninguna herramienta agregada aún.</p>
                                    ) : (
                                        editingReservation.tools.map(tool => (
                                            <div key={tool.toolId} className="flex items-center justify-between p-2.5 bg-surface-hover/30 border border-color/40 rounded-xl gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tool.name}</p>
                                                    <p className="text-[9px] text-tertiary">Disponible en depósito: {tool.maxStock}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-secondary font-bold">Cant:</span>
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            value={tool.quantity} 
                                                            onChange={e => updateToolQtyInEditReservationForm(tool.toolId, e.target.value)}
                                                            className="w-14 text-center text-xs py-1 px-1 bg-main border border-color rounded font-bold" 
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeToolFromEditReservationForm(tool.toolId)}
                                                        className="p-1 text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-color pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingReservation(null)}
                                    className="px-4 py-2 border border-color rounded-xl text-xs font-bold text-secondary hover:bg-surface-hover"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={actionLoading === 'save_edit_reservation'}
                                    className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-extrabold hover:bg-primary-hover shadow-sm"
                                >
                                    {actionLoading === 'save_edit_reservation' ? 'Procesando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STAFF RESERVATIONS TAB VIEW */}
            {activeTab === 'reservations' && isPanolOrAdmin && (
                <div className="space-y-6">
                    <div className="glass-card p-4 space-y-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por docente, alumno, materia..."
                                value={ordersSearch}
                                onChange={e => setOrdersSearch(e.target.value)}
                                className="pl-10 py-2 text-xs rounded-xl"
                            />
                        </div>
                    </div>

                    {loadingOrders ? (
                        <div className="text-center py-20 text-tertiary font-mono">Cargando reservas...</div>
                    ) : (
                        (() => {
                            const pendingRes = orders.filter(order => {
                                if (order.status !== 'Pendiente' && order.status !== 'Recepcionado') return false;
                                if (ordersSearch.trim()) {
                                    const term = ordersSearch.toLowerCase();
                                    const teacherName = `${order.teacher?.first_name || ''} ${order.teacher?.last_name || ''}`.toLowerCase();
                                    return (
                                        order.student_name.toLowerCase().includes(term) ||
                                        order.subject_or_project.toLowerCase().includes(term) ||
                                        order.date.includes(term) ||
                                        teacherName.includes(term) ||
                                        (order.course && order.course.toLowerCase().includes(term)) ||
                                        (order.division && order.division.toLowerCase().includes(term))
                                    );
                                }
                                return true;
                            });

                            const sortedRes = [...pendingRes].sort((a, b) => a.date.localeCompare(b.date));

                            if (sortedRes.length === 0) {
                                return (
                                    <div className="text-center bg-surface/50 border border-color rounded-2xl py-16 text-tertiary italic">
                                        No hay reservas pendientes de entrega o recepción.
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {sortedRes.map(order => (
                                        <div key={order.id} className="card relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-color/30 pb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                                            {order.course} {order.division ? `- ${order.division}` : ''}
                                                        </span>
                                                        {order.status === 'Pendiente' ? (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-warning/15 text-warning flex items-center gap-1">
                                                                <Clock size={10} /> Pendiente
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/15 text-primary flex items-center gap-1">
                                                                <Check size={10} /> Recepcionado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                                                        <Calendar size={13} /> {order.date.split('-').reverse().join('/')}
                                                    </span>
                                                </div>

                                                <div className="space-y-1">
                                                    <h4 className="text-base font-bold text-[var(--text-primary)]">
                                                        Docente: <span className="text-secondary">{order.teacher ? `${order.teacher.last_name}, ${order.teacher.first_name}` : 'Docente Desconocido'}</span>
                                                    </h4>
                                                    <p className="text-xs text-secondary">
                                                        Retira: <strong className="text-[var(--text-primary)]">{order.student_name}</strong>
                                                    </p>
                                                    <p className="text-xs text-secondary">
                                                        Asignatura/Proyecto: <strong className="text-[var(--text-primary)]">{order.subject_or_project}</strong>
                                                    </p>
                                                </div>

                                                {/* Tools list */}
                                                <div className="space-y-2 pt-2">
                                                    <span className="text-[10px] uppercase font-bold text-tertiary tracking-wider block">Materiales Solicitados:</span>
                                                    <div className="divide-y divide-color/20 bg-main/10 rounded-xl overflow-hidden border border-color/30">
                                                        {order.items?.map(item => {
                                                            const invItem = inventory.find(i => i.id === item.tool_id);
                                                            const available = invItem ? invItem.stock : 0;
                                                            const isShort = available < item.quantity;
                                                            return (
                                                                <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                                                                    <div className="flex-1 min-w-0 pr-2">
                                                                        <span className="font-bold text-[var(--text-primary)] block truncate">{item.tool?.name || 'Material Desconocido'}</span>
                                                                        <span className="text-[9px] text-tertiary">Código: {item.tool?.code || 'S/N'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 shrink-0">
                                                                        <span className="text-secondary">Cant: <strong>{item.quantity}</strong></span>
                                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isShort ? 'bg-error/10 text-error border border-error/20' : 'bg-success/10 text-success border border-success/20'}`}>
                                                                            Stock: {available}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Observations Input */}
                                                <div className="space-y-1.5 pt-3 border-t border-color/20">
                                                    <label className="text-[10px] uppercase font-bold text-tertiary tracking-wider block">Mensaje / Observación al docente:</label>
                                                    <div className="flex gap-2">
                                                        <textarea
                                                            rows="1"
                                                            value={observationsTextState[order.id] !== undefined ? observationsTextState[order.id] : (order.observations || '')}
                                                            onChange={e => setObservationsTextState({ ...observationsTextState, [order.id]: e.target.value })}
                                                            placeholder="Escribir observaciones..."
                                                            className="flex-1 text-xs px-2.5 py-1.5 bg-main/50 border border-color rounded-xl focus:bg-surface text-[var(--text-primary)] resize-y min-h-[34px] max-h-[120px]"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveObservation(order.id)}
                                                            disabled={actionLoading === `save_observation_${order.id}`}
                                                            className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all h-[34px] self-end"
                                                        >
                                                            {actionLoading === `save_observation_${order.id}` ? '...' : 'Guardar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-3 border-t border-color/30 pt-4 mt-4">
                                                <button
                                                    onClick={() => handleCancelReservation(order.id)}
                                                    disabled={actionLoading === `cancel_reservation_${order.id}`}
                                                    className="flex-1 px-4 py-2 border border-color rounded-xl text-xs font-bold text-secondary hover:bg-error/10 hover:text-error hover:border-error transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                                {order.status === 'Pendiente' ? (
                                                    <button
                                                        onClick={() => handleReceiveReservation(order.id)}
                                                        disabled={actionLoading === `receive_reservation_${order.id}`}
                                                        className="flex-1 px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <CheckCircle size={14} /> Recepcionar Pedido
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleApproveReservation(order)}
                                                        disabled={actionLoading === `checkout_${order.id}`}
                                                        className="flex-1 px-4 py-2 bg-success text-white hover:bg-success-hover rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <CheckCircle size={14} /> Habilitar Retiro
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>
            )}

            {/* PENDING RETURNS TAB VIEW */}
            {activeTab === 'pending_returns' && isPanolOrAdmin && (
                <div className="space-y-6">
                    <div className="glass-card p-4 space-y-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por herramienta, código, alumno, materia, docente..."
                                value={pendingReturnsSearch}
                                onChange={e => setPendingReturnsSearch(e.target.value)}
                                className="pl-10 py-2 text-xs rounded-xl"
                            />
                        </div>
                    </div>

                    {loadingOrders ? (
                        <div className="text-center py-20 text-tertiary font-mono">Cargando elementos prestados...</div>
                    ) : (
                        (() => {
                            const pendingReturnItems = [];
                            orders.forEach(order => {
                                if (order.status === 'Abierta') {
                                    order.items?.forEach(item => {
                                        if (item.quantity > item.returned_quantity) {
                                            pendingReturnItems.push({
                                                ...item,
                                                order: order
                                            });
                                        }
                                    });
                                }
                            });

                            const sortedPendingReturns = [...pendingReturnItems].sort((a, b) => a.order.date.localeCompare(b.order.date));

                            const filteredPendingReturns = sortedPendingReturns.filter(item => {
                                const term = pendingReturnsSearch.toLowerCase();
                                const teacherName = `${item.order.teacher?.first_name || ''} ${item.order.teacher?.last_name || ''}`.toLowerCase();
                                return (
                                    (item.tool?.name || '').toLowerCase().includes(term) ||
                                    (item.tool?.code || '').toLowerCase().includes(term) ||
                                    item.order.student_name.toLowerCase().includes(term) ||
                                    item.order.subject_or_project.toLowerCase().includes(term) ||
                                    teacherName.includes(term) ||
                                    (item.order.course && item.order.course.toLowerCase().includes(term)) ||
                                    (item.order.division && item.order.division.toLowerCase().includes(term))
                                );
                            });

                            if (filteredPendingReturns.length === 0) {
                                return (
                                    <div className="text-center bg-surface/50 border border-color rounded-2xl py-16 text-tertiary italic">
                                        No hay elementos pendientes de devolución.
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {filteredPendingReturns.map(item => {
                                        const remaining = item.quantity - item.returned_quantity;
                                        const isDevolverMode = returningItemId === item.id;
                                        return (
                                            <div key={item.id} className="card relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] flex flex-col justify-between p-5 border border-color/40 bg-surface/40">
                                                <div className="space-y-4">
                                                    {/* Card Header: Tool name & Code */}
                                                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-color/30 pb-3">
                                                        <div className="space-y-1">
                                                            <h4 className="text-base font-extrabold text-[var(--text-primary)] tracking-wide">
                                                                {item.tool?.name || 'Material Desconocido'}
                                                            </h4>
                                                            <span className="text-xs text-secondary font-mono bg-main/80 px-2.5 py-0.5 rounded border border-color/50">
                                                                Código: {item.tool?.code || 'S/N'}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider bg-error/15 text-error border border-error/30 animate-pulse-slow">
                                                                Pendientes: {remaining}
                                                            </span>
                                                            <span className="block text-[9px] text-tertiary mt-1">Total prestado: {item.quantity}</span>
                                                        </div>
                                                    </div>

                                                    {/* Parent Loan Order Details */}
                                                    <div className="space-y-2 bg-main/10 p-3.5 rounded-xl border border-color/30 text-xs">
                                                        <span className="text-[10px] uppercase font-bold text-tertiary tracking-wider block">Detalles del Préstamo:</span>
                                                        <div className="grid grid-cols-2 gap-2 text-secondary">
                                                            <div>
                                                                <span className="text-tertiary font-medium">Alumno:</span>
                                                                <p className="font-bold text-[var(--text-primary)]">{item.order.student_name}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-tertiary font-medium">Curso / Div:</span>
                                                                <p className="font-bold text-[var(--text-primary)] font-mono">
                                                                    {item.order.course} {item.order.division ? `- ${item.order.division}` : ''}
                                                                </p>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <span className="text-tertiary font-medium">Asignatura / Proyecto:</span>
                                                                <p className="font-bold text-[var(--text-primary)]">{item.order.subject_or_project}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-tertiary font-medium">Docente Autorizante:</span>
                                                                <p className="font-bold text-[var(--text-primary)]">
                                                                    {item.order.teacher ? `${item.order.teacher.last_name}, ${item.order.teacher.first_name}` : 'Docente Desconocido'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-tertiary font-medium">Fecha Préstamo:</span>
                                                                <p className="font-bold text-[var(--text-primary)] font-mono">{item.order.date.split('-').reverse().join('/')}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Return comments if any */}
                                                    {item.return_comment && (
                                                        <div className="text-[10px] text-secondary bg-main/30 p-2.5 rounded border border-color/30 font-mono whitespace-pre-line leading-relaxed">
                                                            <strong>Historial de Notas:</strong>
                                                            {`\n${item.return_comment}`}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="mt-4 pt-3 border-t border-color/30 flex flex-col gap-3">
                                                    {!isDevolverMode && (
                                                        <button
                                                            onClick={() => {
                                                                setReturningItemId(item.id);
                                                                setReturnQty(remaining);
                                                                setReturnComment('');
                                                                setSendToRepair(false);
                                                            }}
                                                            className="w-full btn btn-primary py-2 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                                                        >
                                                            Registrar Devolución
                                                        </button>
                                                    )}

                                                    {/* Inline Returning Form Drawer */}
                                                    {isDevolverMode && (
                                                        <form onSubmit={handleReturnItem} className="p-4 bg-surface rounded-xl border border-color space-y-3 animate-fade-in-up">
                                                            <h6 className="text-xs font-bold text-[var(--text-primary)]">Registrar Devolución</h6>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase font-bold text-secondary mb-1 block">Cantidad a devolver</label>
                                                                    <input 
                                                                        type="number" 
                                                                        min="1" 
                                                                        max={remaining} 
                                                                        value={returnQty} 
                                                                        onChange={e => setReturnQty(Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1)))}
                                                                        className="text-xs py-1.5 bg-main border border-color rounded-lg font-bold text-center w-full" 
                                                                    />
                                                                </div>
                                                                <div className="flex items-center pt-5">
                                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-secondary">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={sendToRepair} 
                                                                            onChange={e => setSendToRepair(e.target.checked)} 
                                                                            className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                                        />
                                                                        <span className="flex items-center gap-1 text-error"><Wrench size={13} /> Enviar a Reparación</span>
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-secondary mb-1 block">Comentario / Estado de la herramienta (Opcional)</label>
                                                                <textarea
                                                                    rows="2"
                                                                    placeholder={sendToRepair ? "Ej: Carbones gastados / Carcasa rota" : "Ej: Limpia y en buen estado"}
                                                                    value={returnComment}
                                                                    onChange={e => setReturnComment(e.target.value)}
                                                                    className="text-xs py-1.5 px-3 bg-main border border-color rounded-lg focus:bg-surface w-full"
                                                                />
                                                            </div>

                                                            <div className="flex justify-end gap-2 pt-2 border-t border-color">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setReturningItemId(null)}
                                                                    className="px-3 py-1.5 text-[11px] border border-color rounded-lg font-bold text-secondary hover:bg-surface-hover"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button 
                                                                    type="submit" 
                                                                    className="px-4 py-1.5 text-[11px] bg-success text-white rounded-lg font-extrabold hover:bg-success-hover shadow-sm"
                                                                >
                                                                    Devolver
                                                                </button>
                                                            </div>
                                                        </form>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()
                    )}
                </div>
            )}

            {/* TEACHER MY RESERVATIONS TAB VIEW */}
            {activeTab === 'my_reservations' && !isPanolOrAdmin && (
                <div className="space-y-6">
                    {loadingOrders ? (
                        <div className="text-center py-20 text-tertiary font-mono">Cargando mis reservas...</div>
                    ) : (
                        (() => {
                            const myRes = orders.filter(order => order.status === 'Pending' || order.status === 'Pendiente' || order.status === 'Recepcionado' || order.status === 'Cancelado');
                            const sortedMyRes = [...myRes].sort((a, b) => b.date.localeCompare(a.date)); // show future/newest reservations first

                            if (sortedMyRes.length === 0) {
                                return (
                                    <div className="text-center bg-surface/50 border border-color rounded-2xl py-16 text-tertiary italic">
                                        No has realizado ninguna reserva aún.
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {sortedMyRes.map(order => (
                                        <div key={order.id} className="card relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-color/30 pb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                                            {order.course} {order.division ? `- ${order.division}` : ''}
                                                        </span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                                                            order.status === 'Pendiente' ? 'bg-warning/15 text-warning' :
                                                            order.status === 'Recepcionado' ? 'bg-primary/15 text-primary' :
                                                            'bg-error/15 text-error'
                                                        }`}>
                                                            {order.status === 'Pendiente' ? (
                                                                <>
                                                                    <Clock size={10} /> Pendiente
                                                                </>
                                                            ) : order.status === 'Recepcionado' ? (
                                                                <>
                                                                    <Check size={10} /> Recepcionado
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle size={10} /> Cancelada
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                                                        <Calendar size={13} /> {order.date.split('-').reverse().join('/')}
                                                    </span>
                                                </div>

                                                <div className="space-y-1">
                                                    <p className="text-xs text-secondary">
                                                        Retira: <strong className="text-[var(--text-primary)]">{order.student_name}</strong>
                                                    </p>
                                                    <p className="text-xs text-secondary">
                                                        Asignatura/Proyecto: <strong className="text-[var(--text-primary)]">{order.subject_or_project}</strong>
                                                    </p>
                                                </div>

                                                {/* Observations Alert */}
                                                {order.observations && (
                                                    <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl text-xs text-warning flex items-start gap-2">
                                                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                                        <div>
                                                            <strong className="block mb-0.5">Observación de Pañol:</strong>
                                                            <p className="font-mono whitespace-pre-line leading-relaxed">{order.observations}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Tools list */}
                                                <div className="space-y-2 pt-2">
                                                    <span className="text-[10px] uppercase font-bold text-tertiary tracking-wider block">Materiales Solicitados:</span>
                                                    <div className="divide-y divide-color/20 bg-main/10 rounded-xl overflow-hidden border border-color/30">
                                                        {order.items?.map(item => (
                                                            <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                                                                <div className="flex-1 min-w-0 pr-2">
                                                                    <span className="font-bold text-[var(--text-primary)] block truncate">{item.tool?.name || 'Material Desconocido'}</span>
                                                                    <span className="text-[9px] text-tertiary">Código: {item.tool?.code || 'S/N'}</span>
                                                                </div>
                                                                <span className="text-secondary shrink-0">Cant: <strong>{item.quantity}</strong></span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            {order.status === 'Pendiente' && (
                                                <div className="flex gap-3 border-t border-color/30 pt-4 mt-4">
                                                    <button
                                                        onClick={() => handleCancelReservation(order.id)}
                                                        disabled={actionLoading === `cancel_reservation_${order.id}`}
                                                        className="flex-1 px-4 py-2 border border-color hover:border-error hover:text-error hover:bg-error/10 rounded-xl text-xs font-bold text-secondary transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <XCircle size={14} /> Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => startEditReservation(order)}
                                                        className="flex-1 px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Edit size={14} /> Editar Solicitud
                                                    </button>
                                                </div>
                                            )}

                                            {order.status === 'Recepcionado' && (
                                                <div className="border-t border-color/30 pt-4 mt-4 space-y-3">
                                                    <div className="text-center text-[10px] text-tertiary font-semibold bg-main/30 py-1.5 rounded-xl border border-color/30 flex items-center justify-center gap-1">
                                                        <AlertCircle size={12} className="text-primary" /> El pedido fue recepcionado por Pañol y no puede modificarse.
                                                    </div>
                                                    <button
                                                        onClick={() => handleCancelReservation(order.id)}
                                                        disabled={actionLoading === `cancel_reservation_${order.id}`}
                                                        className="w-full px-4 py-2 border border-color hover:border-error hover:text-error hover:bg-error/10 rounded-xl text-xs font-bold text-secondary transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <XCircle size={14} /> Cancelar Solicitud
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}
                </div>
            )}

            {/* ORDERS TAB VIEW */}
            {(activeTab === 'orders' || activeTab === 'my_authorizations') && (
                <div className="space-y-6">
                    
                    {/* Orders filter bar */}
                    <div className="glass-card p-4 space-y-4">
                        {/* Predefined Cycle filters */}
                        <div className="border-b border-color/40 pb-3 overflow-x-auto flex gap-1.5 no-scrollbar">
                            <button
                                onClick={() => setSelectedCycle('TODOS')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${selectedCycle === 'TODOS' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/50 border border-transparent'}`}
                            >
                                TODOS LOS CICLOS
                            </button>
                            <button
                                onClick={() => setSelectedCycle('CB')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${selectedCycle === 'CB' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/50 border border-transparent'}`}
                            >
                                CICLO BÁSICO (CB)
                            </button>
                            <button
                                onClick={() => setSelectedCycle('Superior')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${selectedCycle === 'Superior' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/50 border border-transparent'}`}
                            >
                                CICLO SUPERIOR
                            </button>
                            <button
                                onClick={() => setSelectedCycle('CFP')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${selectedCycle === 'CFP' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover/50 border border-transparent'}`}
                            >
                                CFP
                            </button>
                        </div>

                        {/* Sub-filters for Course and Division */}
                        <div className="flex flex-wrap gap-4 items-center bg-surface-hover/10 p-3 rounded-xl border border-color/30">
                            {selectedCycle !== 'CFP' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-black text-tertiary tracking-wider whitespace-nowrap">Curso:</span>
                                    <select
                                        value={filterCourse}
                                        onChange={e => setFilterCourse(e.target.value)}
                                        className="py-1 px-3 text-xs rounded-lg bg-main/50 border border-color/40 focus:border-primary/50 w-28"
                                    >
                                        <option value="TODOS">Todos</option>
                                        {COURSES.filter(c => selectedCycle === 'TODOS' || getCourseCycle(c) === selectedCycle).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            {selectedCycle !== 'CFP' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-black text-tertiary tracking-wider whitespace-nowrap">División:</span>
                                    <select
                                        value={filterDivision}
                                        onChange={e => setFilterDivision(e.target.value)}
                                        className="py-1 px-3 text-xs rounded-lg bg-main/50 border border-color/40 focus:border-primary/50 w-28"
                                    >
                                        <option value="TODOS">Todas</option>
                                        {DIVISIONS.filter(d => {
                                            if (selectedCycle === 'TODOS') return true;
                                            if (selectedCycle === 'CB') return ['A', 'B'].includes(d);
                                            if (selectedCycle === 'Superior') return ['TEL', 'TEM'].includes(d);
                                            return false;
                                        }).map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Search and Status Dropdown */}
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por alumno, materia, fecha (AAAA-MM-DD), docente..."
                                    value={ordersSearch}
                                    onChange={e => setOrdersSearch(e.target.value)}
                                    className="pl-10 py-2 text-xs rounded-xl"
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <select
                                    value={ordersStatusFilter}
                                    onChange={e => setOrdersStatusFilter(e.target.value)}
                                    className="py-2 text-xs rounded-xl"
                                >
                                    <option value="Abierta">Pedidos: Abiertos</option>
                                    <option value="Cerrada">Pedidos: Cerrados (Histórico)</option>
                                    <option value="TODOS">Todos los Pedidos</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Orders listing */}
                    {loadingOrders ? (
                        <div className="text-center py-20 text-tertiary font-mono">Sincronizando pedidos...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center bg-surface/50 border border-color rounded-2xl py-16 text-tertiary italic">
                            No se encontraron órdenes de préstamo para los filtros seleccionados.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredOrders.map(order => {
                                const isExpanded = expandedOrderId === order.id;
                                const isEditing = editingOrderId === order.id;
                                
                                // Count items status
                                const totalItems = order.items?.length || 0;
                                const returnedItems = order.items?.filter(item => item.quantity === item.returned_quantity).length || 0;
                                
                                return (
                                    <div 
                                        key={order.id}
                                        className={`card relative overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/30 shadow-lg' : 'hover:translate-y-[-2px]'}`}
                                    >
                                        {/* Card Header details */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-black text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                                        {order.course} {order.division ? `- ${order.division}` : ''}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${order.status === 'Abierta' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
                                                        {order.status === 'Abierta' ? 'Abierta' : 'Cerrada'}
                                                    </span>
                                                    <span className="text-[10px] text-tertiary font-medium">
                                                        ({returnedItems}/{totalItems} devueltos)
                                                    </span>
                                                </div>
                                                
                                                <h4 className="text-lg font-bold text-[var(--text-primary)] truncate mt-1">
                                                    Alumno: <strong className="text-primary">{order.student_name}</strong>
                                                </h4>
                                                
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tertiary">
                                                    <span className="font-semibold text-secondary flex items-center gap-1">
                                                        <BookOpen size={13} /> {order.subject_or_project}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={13} /> {order.date.split('-').reverse().join('/')}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1 font-semibold text-secondary">
                                                        <User size={13} /> Autoriza: {order.teacher ? `${order.teacher.last_name}, ${order.teacher.first_name}` : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expand and edit buttons */}
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                {isPanolOrAdmin && order.status === 'Abierta' && (
                                                    <button
                                                        onClick={() => setEditingOrderId(isEditing ? null : order.id)}
                                                        className="p-2 text-secondary hover:text-primary bg-surface-hover/50 hover:bg-surface-hover border border-color/40 rounded-xl transition-all flex items-center gap-1"
                                                        title="Editar herramientas de la orden"
                                                    >
                                                        <Edit size={14} />
                                                        <span className="text-xs font-bold hidden md:inline">Editar</span>
                                                    </button>
                                                )}
                                                {(role === 'coordinador' || role === 'gerente') && (
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="p-2 text-tertiary hover:text-error bg-surface-hover/50 hover:bg-surface-hover border border-color/40 rounded-xl transition-all"
                                                        title="Eliminar orden de préstamo por completo"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                                    className="p-2 text-secondary hover:text-primary bg-surface-hover/50 hover:bg-surface-hover border border-color/40 rounded-xl transition-all"
                                                    title="Ver elementos"
                                                >
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* EXPANDED CONTENT DETAILS */}
                                        {isExpanded && (
                                            <div className="mt-6 pt-5 border-t border-color space-y-6 animate-fade-in-up">
                                                
                                                {/* Edit Tools Panel inside card */}
                                                {isEditing && isPanolOrAdmin && order.status === 'Abierta' && (
                                                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
                                                        <h5 className="text-xs font-extrabold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                                            <Edit size={14} /> Añadir herramienta a esta orden
                                                        </h5>
                                                        
                                                        <form onSubmit={handleAddToolToOrder} className="flex flex-col sm:flex-row gap-3 items-end">
                                                            <div className="flex-1 relative w-full">
                                                                <label className="text-[10px] uppercase font-bold text-secondary mb-1 block">Buscar herramienta</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Escribe para buscar..."
                                                                    value={existingOrderToolSearch}
                                                                    onChange={e => {
                                                                        setExistingOrderToolSearch(e.target.value);
                                                                        setAddingToolToOrderId(order.id);
                                                                        setShowExistingOrderToolResults(true);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setAddingToolToOrderId(order.id);
                                                                        setShowExistingOrderToolResults(true);
                                                                    }}
                                                                    className="py-1.5 text-xs bg-main/50"
                                                                />
                                                                {showExistingOrderToolResults && addingToolToOrderId === order.id && existingOrderToolSearch.trim() && (
                                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-lg z-30 max-h-40 overflow-y-auto divide-y divide-color/30">
                                                                        {filteredToolsForExistingOrder.map(t => (
                                                                            <div
                                                                                key={t.id}
                                                                                onClick={() => {
                                                                                    setNewToolForOrder({ toolId: t.id, quantity: 1, maxStock: t.stock });
                                                                                    setExistingOrderToolSearch(t.name);
                                                                                    setShowExistingOrderToolResults(false);
                                                                                }}
                                                                                className="p-2 text-xs hover:bg-surface-hover cursor-pointer flex justify-between items-center"
                                                                            >
                                                                                <span>{t.name}</span>
                                                                                <span className="text-[10px] text-tertiary">Dispon.: {t.stock}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="w-24 shrink-0">
                                                                <label className="text-[10px] uppercase font-bold text-secondary mb-1 block">Cantidad</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max={newToolForOrder.maxStock || 999}
                                                                    value={newToolForOrder.quantity}
                                                                    onChange={e => setNewToolForOrder({ ...newToolForOrder, quantity: Math.max(1, Math.min(newToolForOrder.maxStock || 1, parseInt(e.target.value) || 1)) })}
                                                                    className="py-1.5 text-xs text-center bg-main/50 font-bold"
                                                                />
                                                            </div>
                                                            <div className="flex gap-2 w-full sm:w-auto">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingOrderId(null);
                                                                        setAddingToolToOrderId(null);
                                                                    }}
                                                                    className="btn py-1.5 px-3 border border-color rounded-lg text-xs font-bold text-secondary hover:bg-surface-hover"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    type="submit"
                                                                    className="btn btn-primary py-1.5 px-4 rounded-lg text-xs font-bold"
                                                                >
                                                                    Confirmar
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                )}

                                                {/* Tools list in Order */}
                                                <div className="space-y-3">
                                                    <h5 className="text-xs font-bold text-secondary uppercase tracking-widest">Elementos Entregados</h5>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {order.items?.map(item => {
                                                            const isReturned = item.quantity === item.returned_quantity;
                                                            const remaining = item.quantity - item.returned_quantity;
                                                            const isDevolverMode = returningItemId === item.id;

                                                            return (
                                                                <div 
                                                                    key={item.id} 
                                                                    className={`p-3.5 rounded-xl border transition-all flex flex-col gap-3 ${isReturned ? 'bg-success/5 border-success/10 opacity-75' : 'bg-surface-hover/20 border-color/40'}`}
                                                                >
                                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-bold text-[var(--text-primary)] tracking-wide truncate">{item.tool?.name || 'Material Desconocido'}</p>
                                                                            <div className="flex items-center gap-2.5 mt-0.5 text-xs text-tertiary font-mono">
                                                                                <span>Código: {item.tool?.code || 'S/N'}</span>
                                                                                <span>•</span>
                                                                                <span>Entregados: <strong>{item.quantity}</strong></span>
                                                                                <span>•</span>
                                                                                <span>Devueltos: <strong className="text-success">{item.returned_quantity}</strong></span>
                                                                            </div>
                                                                            
                                                                            {item.return_comment && (
                                                                                <div className="mt-2 text-[10px] text-secondary bg-main/30 p-2 rounded border border-color/30 font-mono whitespace-pre-line leading-relaxed">
                                                                                    <strong>Historial de Notas:</strong>
                                                                                    {`\n${item.return_comment}`}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Status Badge */}
                                                                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                                                item.status === 'Devuelto' ? 'bg-success/15 text-success' :
                                                                                item.status === 'En Reparacion' ? 'bg-error/15 text-error animate-pulse-slow' :
                                                                                'bg-warning/15 text-warning'
                                                                            }`}>
                                                                                {item.status === 'En Reparacion' ? 'En Reparación' : item.status}
                                                                            </span>

                                                                            {/* Devolver / Remove Actions */}
                                                                            <div className="flex items-center gap-2">
                                                                                {isPanolOrAdmin && order.status === 'Abierta' && !isReturned && !isDevolverMode && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setReturningItemId(item.id);
                                                                                            setReturnQty(remaining);
                                                                                        }}
                                                                                        className="btn bg-primary text-white hover:bg-primary-hover font-bold text-xs py-1 px-3.5 rounded-lg transition-all"
                                                                                    >
                                                                                        Devolver
                                                                                    </button>
                                                                                )}
                                                                                
                                                                                {((isPanolOrAdmin && order.status === 'Abierta' && item.returned_quantity === 0) || 
                                                                                  (role === 'coordinador' || role === 'gerente')) && (
                                                                                    <button
                                                                                        onClick={() => handleRemoveItemFromOrder(item.id, item.tool_id, item.quantity, item.returned_quantity)}
                                                                                        className="p-1 text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                                                                        title="Remover herramienta de la orden completamente"
                                                                                    >
                                                                                        <Trash2 size={15} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Returning Form Drawer */}
                                                                    {isDevolverMode && (
                                                                        <form onSubmit={handleReturnItem} className="mt-3 p-4 bg-surface rounded-xl border border-color space-y-3 max-w-lg animate-fade-in-up">
                                                                            <h6 className="text-xs font-bold text-[var(--text-primary)]">Registrar Devolución</h6>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                                <div>
                                                                                    <label className="text-[10px] uppercase font-bold text-secondary mb-1 block">Cantidad a devolver</label>
                                                                                    <input 
                                                                                        type="number" 
                                                                                        min="1" 
                                                                                        max={remaining} 
                                                                                        value={returnQty} 
                                                                                        onChange={e => setReturnQty(Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1)))}
                                                                                        className="text-xs py-1.5 bg-main border border-color rounded-lg font-bold text-center" 
                                                                                    />
                                                                                </div>
                                                                                <div className="flex items-center pt-5">
                                                                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-secondary">
                                                                                        <input 
                                                                                            type="checkbox" 
                                                                                            checked={sendToRepair} 
                                                                                            onChange={e => setSendToRepair(e.target.checked)} 
                                                                                            className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                                                        />
                                                                                        <span className="flex items-center gap-1 text-error"><Wrench size={13} /> Enviar a Reparación</span>
                                                                                    </label>
                                                                                </div>
                                                                            </div>

                                                                            <div>
                                                                                <label className="text-[10px] uppercase font-bold text-secondary mb-1 block">Comentario / Estado de la herramienta (Opcional)</label>
                                                                                <textarea
                                                                                    rows="2"
                                                                                    placeholder={sendToRepair ? "Ej: Carbones gastados / Carcasa rota" : "Ej: Limpia y en buen estado"}
                                                                                    value={returnComment}
                                                                                    onChange={e => setReturnComment(e.target.value)}
                                                                                    className="text-xs py-1.5 px-3 bg-main border border-color rounded-lg focus:bg-surface"
                                                                                />
                                                                            </div>

                                                                            <div className="flex justify-end gap-2 pt-2 border-t border-color">
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={() => setReturningItemId(null)}
                                                                                    className="px-3 py-1.5 text-[11px] border border-color rounded-lg font-bold text-secondary hover:bg-surface-hover"
                                                                                >
                                                                                    Cancelar
                                                                                </button>
                                                                                <button 
                                                                                    type="submit" 
                                                                                    className="px-4 py-1.5 text-[11px] bg-success text-white rounded-lg font-extrabold hover:bg-success-hover shadow-sm"
                                                                                >
                                                                                    Devolver
                                                                                </button>
                                                                            </div>
                                                                        </form>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* INVENTORY TAB VIEW */}
            {activeTab === 'inventory' && (
                <div className="space-y-6">
                    {/* Add / Import / Seed Actions Panel */}
                    {isPanolOrAdmin && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Excel Importer for Tools */}
                            <div className="glass-card p-5 border border-dashed border-color hover:border-primary/40 transition-all rounded-2xl relative overflow-hidden bg-surface/40 flex flex-col justify-between min-h-[140px]">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary">
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Importación Masiva de Inventario</h3>
                                        <p className="text-[11px] text-secondary leading-relaxed">
                                            Sube un Excel (`.xlsx` o `.xls`) con columnas `Nombre` (requerido), `Código` (opcional) y `Stock`. Si el código o nombre coincide con uno existente, actualizará su stock.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <label className="btn btn-primary cursor-pointer justify-center py-2 px-4 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm">
                                        <Upload size={14} />
                                        <span>{importingTools ? 'Procesando...' : 'Seleccionar Excel'}</span>
                                        <input 
                                            type="file" 
                                            accept=".xlsx, .xls" 
                                            onChange={handleExcelToolsUpload} 
                                            disabled={importingTools}
                                            className="hidden" 
                                        />
                                    </label>
                                    {importToolsSuccess && <span className="text-[11px] text-success font-semibold">{importToolsSuccess}</span>}
                                    {importToolsError && <span className="text-[11px] text-error font-semibold whitespace-pre-line">{importToolsError}</span>}
                                </div>
                            </div>

                            {/* Seed Test Tools */}
                            <div className="glass-card p-5 border border-dashed border-color hover:border-primary/40 transition-all rounded-2xl relative overflow-hidden bg-surface/40 flex flex-col justify-between min-h-[140px]">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-accent/10 rounded-xl border border-accent/20 text-accent">
                                        <Wrench size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Cargar Stock de Herramientas de Prueba</h3>
                                        <p className="text-[11px] text-secondary leading-relaxed">
                                            Genera automáticamente un stock inicial de 12 herramientas estándar (Taladros, Amoladoras, Martillos, Destornilladores, etc.) para probar el flujo de préstamos.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={handleSeedTools}
                                        disabled={loadingSeed}
                                        className="btn bg-accent text-white hover:bg-accent-hover py-2 px-4 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm justify-center"
                                    >
                                        <Wrench size={14} />
                                        <span>{loadingSeed ? 'Generando...' : 'Cargar Herramientas de Prueba'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add Form */}
                    {showAddToolForm && isPanolOrAdmin && (
                        <div className="glass-card p-6 border-l-4 border-l-primary animate-fade-in-up relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none"></div>
                            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-6 flex items-center gap-2">
                                <Plus size={20} className="text-primary" />
                                Ingresar Material al Depósito
                            </h3>
                            <form onSubmit={handleAddInventoryItem} className="flex flex-col gap-4 relative z-10 w-full">
                                <div className="flex flex-col md:flex-row gap-4 items-end w-full">
                                    <div className="flex-1 w-full">
                                        <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest mb-2 block">Nombre Exacto</label>
                                        <input type="text" value={newTool.name} onChange={e => setNewTool({ ...newTool, name: e.target.value })} placeholder="Ej. Amoladora Bosch 4 1/2" required className="bg-main/50 border-color/50 focus:bg-surface text-[var(--text-primary)]" />
                                    </div>
                                    <div className="w-full md:w-48">
                                        <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest mb-2 block">Identificador / Código</label>
                                        <input type="text" value={newTool.code} onChange={e => setNewTool({ ...newTool, code: e.target.value })} placeholder="Opcional..." className="bg-main/50 border-color/50 focus:bg-surface text-[var(--text-primary)]" />
                                    </div>
                                    <div className="w-full md:w-32">
                                        <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest mb-2 block">Stock inicial</label>
                                        <input type="number" min="0" value={newTool.stock} onChange={e => setNewTool({ ...newTool, stock: e.target.value })} required className="bg-main/50 border-color/50 focus:bg-surface text-center font-bold text-[var(--text-primary)]" />
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-t border-color/30 pt-4 w-full">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-bold text-secondary uppercase bg-main/50 border border-color/50 hover:bg-surface-hover hover:border-color px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 transition-all">
                                            <Upload size={14} className="text-primary" />
                                            <span>{toolPhotoFile ? toolPhotoFile.name : 'Subir Foto (Opcional)'}</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={e => setToolPhotoFile(e.target.files[0])} />
                                        </label>
                                        {toolPhotoFile && (
                                            <button type="button" onClick={() => setToolPhotoFile(null)} className="text-xs text-error hover:text-error-hover font-bold">Quitar</button>
                                        )}
                                    </div>
                                    <button type="submit" className="btn btn-primary w-full md:w-auto h-[44px] px-8">Guardar Material</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="glass-card p-0 overflow-hidden flex flex-col">
                        <div className="bg-surface-hover/30 p-4 border-b border-color/50 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
                            <div className="relative flex-1">
                                <Search className="text-primary absolute left-4 top-1/2 -translate-y-1/2" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar herramientas por nombre o código..."
                                    className="w-full bg-main/50 border border-color/50 rounded-xl py-2.5 pl-11 pr-4 focus:bg-surface transition-all text-xs text-[var(--text-primary)]"
                                    value={inventorySearch}
                                    onChange={e => setInventorySearch(e.target.value)}
                                />
                            </div>
                            
                            {isPanolOrAdmin && (
                                <button 
                                    onClick={() => setShowAddToolForm(!showAddToolForm)}
                                    className="btn btn-primary py-2 px-5 text-xs font-bold shadow-sm flex items-center gap-1.5 self-end md:self-auto"
                                >
                                    <Plus size={16} /> Nuevo Material
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            {loadingInventory ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                                    <PackageOpen size={32} className="text-tertiary mb-4 animate-pulse-slow" />
                                    <div className="text-secondary font-medium">Sincronizando inventario...</div>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-surface-hover/40 text-tertiary text-[11px] font-bold uppercase tracking-widest border-b border-color/50">
                                            <th className="p-4 pl-6">Material / Herramienta</th>
                                            <th className="p-4">Identificador</th>
                                            <th className="p-4 text-center">Stock Disponible</th>
                                            <th className="p-4 text-center">En Reparación</th>
                                            {isPanolOrAdmin && <th className="p-4 text-center pr-6">Acciones de Stock</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-color/30">
                                        {filteredInventory.length === 0 ? (
                                            <tr>
                                                <td colSpan={isPanolOrAdmin ? 5 : 4} className="p-12 text-center">
                                                    <div className="flex flex-col items-center justify-center opacity-70">
                                                        <Search size={32} className="text-tertiary mb-3" />
                                                        <p className="text-secondary">No se encontraron herramientas con esos criterios.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredInventory.map(item => (
                                                <tr key={item.id} className="hover:bg-surface-hover/20 transition-colors group">
                                                    <td className="p-4 pl-6">
                                                        <div className="flex items-center gap-3">
                                                            <div 
                                                                onClick={() => setToolImageModal(item)}
                                                                className="w-10 h-10 rounded-lg bg-main/50 border border-color flex items-center justify-center text-secondary overflow-hidden relative transition-all cursor-pointer hover:border-primary hover:text-primary group/img"
                                                                title="Gestionar imagen del material"
                                                            >
                                                                {item.image_url ? (
                                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <PackageOpen size={18} />
                                                                )}
                                                                {isPanolOrAdmin && (
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white">
                                                                        <Camera size={14} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-[15px] text-[var(--text-primary)] tracking-wide">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-xs text-secondary font-mono bg-main/80 px-2.5 py-1 rounded border border-color/50">
                                                            {item.code || 'S/N'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full text-sm font-black border tracking-wide ${item.stock > 0 ? 'bg-success/10 text-success border-success/30' : 'bg-error/10 text-error border-error/30'}`}>
                                                            {item.stock}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full text-sm font-black border tracking-wide ${item.repair_stock > 0 ? 'bg-error/10 text-error border-error/30 animate-pulse-slow' : 'bg-main text-secondary border-color/50'}`}>
                                                            {item.repair_stock || 0}
                                                        </span>
                                                    </td>
                                                    {isPanolOrAdmin && (
                                                        <td className="p-4 pr-6">
                                                            <div className="flex items-center justify-center gap-6">
                                                                {/* Normal Stock Adjust */}
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-[9px] uppercase tracking-wider text-tertiary font-bold">Disponible</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <button onClick={() => handleUpdateStock(item.id, item.stock, -1)} disabled={item.stock === 0} className="w-8 h-8 rounded-lg border border-color/50 bg-surface flex items-center justify-center hover:bg-error/10 hover:text-error hover:border-error transition-all disabled:opacity-30 shadow-sm font-bold">-</button>
                                                                        <button onClick={() => handleUpdateStock(item.id, item.stock, 1)} className="w-8 h-8 rounded-lg border border-color/50 bg-surface flex items-center justify-center hover:bg-success/10 hover:text-success hover:border-success transition-all shadow-sm font-bold">+</button>
                                                                    </div>
                                                                </div>

                                                                {/* Repair Stock Adjust */}
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-[9px] uppercase tracking-wider text-tertiary font-bold">Reparación</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <button onClick={() => handleUpdateRepairStock(item.id, item.repair_stock || 0, -1)} disabled={!item.repair_stock} className="w-8 h-8 rounded-lg border border-color/50 bg-surface flex items-center justify-center hover:bg-error/10 hover:text-error hover:border-error transition-all disabled:opacity-30 shadow-sm font-bold">-</button>
                                                                        <button onClick={() => handleUpdateRepairStock(item.id, item.repair_stock || 0, 1)} className="w-8 h-8 rounded-lg border border-color/50 bg-surface flex items-center justify-center hover:bg-success/10 hover:text-success hover:border-success transition-all shadow-sm font-bold">+</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TRACEABILITY HISTORY TAB VIEW */}
            {activeTab === 'history' && isPanolOrAdmin && (
                <div className="space-y-6">
                    <div className="glass-card p-6 space-y-4">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <History className="text-primary" /> Historial de Trazabilidad por Material
                        </h3>
                        <p className="text-xs text-secondary">
                            Selecciona una herramienta del inventario para conocer su historial completo de préstamos, quién la solicitó y en qué condiciones se devolvió.
                        </p>

                        <div className="max-w-md">
                            <label className="text-[10px] uppercase font-black text-tertiary tracking-wider block mb-1">Seleccionar Herramienta</label>
                            <select
                                value={selectedTraceToolId}
                                onChange={e => setSelectedTraceToolId(e.target.value)}
                                className="text-xs bg-main/50 font-bold"
                            >
                                <option value="">Seleccionar herramienta...</option>
                                {inventory.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.code || 'S/N'})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedTraceToolId && (
                        <div className="glass-card p-6 space-y-6">
                            <h4 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">Historial de Registro</h4>
                            
                            {loadingHistory ? (
                                <div className="text-center py-10 text-tertiary font-mono">Buscando registros...</div>
                            ) : toolHistory.length === 0 ? (
                                <p className="text-xs text-tertiary italic text-center py-10 bg-main/10 rounded-xl">Esta herramienta no registra ningún préstamo histórico.</p>
                            ) : (
                                <div className="relative border-l border-color/70 ml-4 pl-6 space-y-8 py-2">
                                    {toolHistory.map((hist, index) => (
                                        <div key={index} className="relative">
                                            {/* Bullet icon */}
                                            <span className={`absolute -left-9 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shadow-sm ${
                                                hist.status === 'Devuelto' ? 'bg-success text-white border-success-hover' :
                                                hist.status === 'En Reparacion' ? 'bg-error text-white border-error-hover animate-pulse-slow' :
                                                'bg-warning text-white border-warning-hover'
                                            }`}>
                                                {hist.status === 'Devuelto' ? '✓' : hist.status === 'En Reparacion' ? '🔧' : '→'}
                                            </span>

                                            <div className="bg-surface-hover/30 p-4 border border-color/40 rounded-2xl max-w-2xl space-y-2">
                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-color/30 pb-2">
                                                    <span className="text-xs font-black text-primary font-mono">{hist.order?.date.split('-').reverse().join('/')}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                            hist.status === 'Devuelto' ? 'bg-success/15 text-success' :
                                                            hist.status === 'En Reparacion' ? 'bg-error/15 text-error' :
                                                            'bg-warning/15 text-warning'
                                                        }`}>
                                                            {hist.status === 'En Reparacion' ? 'Devuelto a Reparación' : hist.status}
                                                        </span>
                                                        {(role === 'coordinador' || role === 'gerente') && (
                                                            <button
                                                                onClick={() => handleDeleteHistoryItem(hist.id)}
                                                                className="p-1 text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer"
                                                                title="Eliminar este registro del historial"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    <p className="text-secondary font-medium">Alumno: <strong className="text-[var(--text-primary)]">{hist.order?.student_name}</strong></p>
                                                    <p className="text-secondary font-medium">Curso: <strong className="text-[var(--text-primary)]">{hist.order?.course} {hist.order?.division || ''}</strong></p>
                                                    <p className="text-secondary font-medium">Proyecto/Materia: <strong className="text-[var(--text-primary)]">{hist.order?.subject_or_project}</strong></p>
                                                    <p className="text-secondary font-medium">Cantidad: <strong className="text-[var(--text-primary)]">{hist.quantity} unidades</strong></p>
                                                </div>

                                                <p className="text-xs text-tertiary">Autorizado por docente: <strong className="text-secondary">{hist.order?.teacher ? `${hist.order.teacher.last_name}, ${hist.order.teacher.first_name}` : 'N/A'}</strong></p>

                                                {hist.return_comment && (
                                                    <div className="mt-2.5 pt-2 border-t border-color/20">
                                                        <span className="text-[9px] uppercase font-bold text-secondary tracking-widest block mb-1">Notas de Devolución:</span>
                                                        <p className="text-xs italic font-mono text-secondary bg-main/45 p-2 rounded border border-color/20 whitespace-pre-line leading-relaxed">
                                                            {hist.return_comment}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* STOCK CONFLICT MODAL */}
            {stockConflictOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card max-w-lg w-full p-6 md:p-8 animate-fade-in-up space-y-6 relative border border-color">
                        <div className="flex items-center gap-3 text-error border-b border-color pb-4">
                            <AlertCircle size={24} />
                            <h3 className="text-xl font-extrabold text-[var(--text-primary)]">
                                Conflicto de Stock
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <p className="text-xs text-secondary leading-relaxed">
                                No hay suficiente stock en depósito para habilitar el retiro de la reserva de <strong>{stockConflictOrder.student_name}</strong> ({stockConflictOrder.course} {stockConflictOrder.division || ''}).
                            </p>

                            <div className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-tertiary tracking-wider block">Materiales con Faltantes:</span>
                                <div className="divide-y divide-color/20 bg-error/5 rounded-xl border border-error/10 overflow-hidden">
                                    {stockConflictDetails.map((detail, idx) => (
                                        <div key={idx} className="p-3 text-xs flex justify-between items-center">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <span className="font-bold text-[var(--text-primary)] block truncate">{detail.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0 text-right font-mono">
                                                <div className="pr-2 border-r border-color/30">
                                                    <span className="text-secondary text-[10px] block">Solicitado</span>
                                                    <strong className="text-error text-xs">{detail.requested}</strong>
                                                </div>
                                                <div>
                                                    <span className="text-secondary text-[10px] block">Disponible</span>
                                                    <strong className="text-success text-xs">{detail.available}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <p className="text-[11px] text-tertiary italic">
                                ¿Cómo desea proceder? "Prestar todo" registrará el préstamo de la cantidad solicitada (permitiendo stock negativo). "Ajustar al stock disponible" reducirá las cantidades entregadas al stock físico actual (los ítems sin stock no se entregarán).
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-color">
                            <button
                                onClick={() => {
                                    setStockConflictOrder(null);
                                    setStockConflictDetails([]);
                                }}
                                className="flex-1 px-4 py-2 border border-color rounded-xl text-xs font-bold text-secondary hover:bg-surface-hover transition-all"
                            >
                                Volver
                            </button>
                            <button
                                onClick={() => executeCheckout(stockConflictOrder, 'adjust')}
                                disabled={actionLoading === `checkout_${stockConflictOrder.id}`}
                                className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold transition-all"
                            >
                                Ajustar al Stock
                            </button>
                            <button
                                onClick={() => executeCheckout(stockConflictOrder, 'as_is')}
                                disabled={actionLoading === `checkout_${stockConflictOrder.id}`}
                                className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all"
                            >
                                Prestar Todo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Tool Image Lightbox Modal */}
            {toolImageModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-scale-in">
                        <div className="flex justify-between items-center p-5 border-b border-color/50 bg-surface-hover/50">
                            <h3 className="font-bold text-base text-[var(--text-primary)] truncate pr-4">{toolImageModal.name}</h3>
                            <button onClick={() => setToolImageModal(null)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-6">
                            <div className="w-64 h-64 rounded-xl overflow-hidden border border-color/85 bg-main/30 flex items-center justify-center relative shadow-lg">
                                {toolImageModal.image_url ? (
                                    <img src={toolImageModal.image_url} alt={toolImageModal.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center text-tertiary flex flex-col items-center gap-2">
                                        <PackageOpen size={48} />
                                        <span className="text-xs font-semibold">Sin imagen cargada</span>
                                    </div>
                                )}
                            </div>
                            
                            {isPanolOrAdmin && (
                                <div className="flex gap-3 w-full border-t border-color/40 pt-4">
                                    <button
                                        onClick={() => {
                                            handleToolImageClick(toolImageModal.id);
                                            setToolImageModal(null);
                                        }}
                                        className="flex-1 py-2 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                                    >
                                        <Upload size={14} />
                                        {toolImageModal.image_url ? 'Cambiar Foto' : 'Agregar Foto'}
                                    </button>
                                    {toolImageModal.image_url && (
                                        <button
                                            onClick={() => handleDeleteToolPhoto(toolImageModal.id)}
                                            className="py-2 px-4 bg-error/15 hover:bg-error hover:text-white text-error rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                            title="Eliminar Foto"
                                        >
                                            <Trash2 size={14} />
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <input 
                type="file" 
                ref={toolFileInputRef} 
                onChange={handleToolImageChange} 
                accept="image/*" 
                className="hidden" 
            />
        </div>
    );
}
