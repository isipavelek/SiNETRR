import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
    Plus, Search, MessageSquare, Calendar, Edit2, Trash2, 
    User, Check, AlertCircle, X, ChevronRight, Copy, Database, ArrowLeft
} from 'lucide-react';
import { createNotification } from '../lib/notificationsHelper';

// Color dynamic assignments based on parsed profiles
const parseProfiles = (orientationStr) => {
    let profilesList = ['Docente'];
    let specialtyArea = '';
    if (orientationStr && orientationStr.startsWith('{')) {
        try {
            const parsed = JSON.parse(orientationStr);
            profilesList = parsed.profiles || ['Docente'];
            specialtyArea = parsed.specialtyArea || '';
        } catch (e) {
            console.error(e);
        }
    } else if (orientationStr) {
        profilesList = [orientationStr];
    }
    return { profilesList, specialtyArea };
};

// Initial Mock Data for Demo Mode
const MOCK_TOPICS = [
    {
        id: 'mock-topic-1',
        title: 'Coordinación de auditorías 5S en taller',
        description: 'Debemos definir la fecha de las auditorías de 5S en los talleres del ciclo superior y básico. Luis sugirió que se realice a finales de mes.',
        status: 'En Proceso',
        assigned_teachers: ['52bc690c-f666-47cb-accc-d64f18dd47a7', 'a790db27-358e-4482-aa0c-bda50ad24c88'], // Gonzalo Bermudez, Laureano Bolzan
        created_by: '90f5abc8-97ea-4dbb-b760-7fdaed1b82dd', // Alejandro Tombesi
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        creator_name: 'Alejandro Tombesi'
    },
    {
        id: 'mock-topic-2',
        title: 'Inventario de herramientas del pañol y faltantes',
        description: 'Revisar la lista de insumos y consumibles de soldadura y seguridad industrial antes de las prácticas generales del segundo trimestre.',
        status: 'Pendiente',
        assigned_teachers: ['10f2ce96-1b84-4abb-916d-85d976ee5d5f'], // Luis Cornaglia
        created_by: '95c78188-52a3-484c-807a-8e1e2079b76e', // Israel Pavelek
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        creator_name: 'Israel Pavelek'
    },
    {
        id: 'mock-topic-3',
        title: 'Capacitación obligatoria en seguridad ETRR',
        description: 'Validar que todos los docentes del taller técnico superior hayan entregado el certificado firmado de realización del curso de seguridad.',
        status: 'Resuelto',
        assigned_teachers: [],
        created_by: '10f2ce96-1b84-4abb-916d-85d976ee5d5f', // Luis Cornaglia
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        creator_name: 'Luis Cornaglia'
    }
];

const MOCK_COMMENTS = [
    {
        id: 'mock-comment-1',
        topic_id: 'mock-topic-1',
        comment: 'Considero que sería ideal programarla para el jueves 28 a primera hora, así no interferimos con las mesas de exámenes.',
        created_by: '52bc690c-f666-47cb-accc-d64f18dd47a7',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        author_name: 'Gonzalo Bermudez'
    },
    {
        id: 'mock-comment-2',
        topic_id: 'mock-topic-1',
        comment: 'Excelente. Ya tenemos listas las plantillas de auditoría actualizadas con la nueva versión de las tarjetas rojas.',
        created_by: '90f5abc8-97ea-4dbb-b760-7fdaed1b82dd',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        author_name: 'Alejandro Tombesi'
    },
    {
        id: 'mock-comment-3',
        topic_id: 'mock-topic-2',
        comment: 'Coordiné con pañol. Mañana a la mañana consolidamos la planilla final para hacer el pedido formal.',
        created_by: '10f2ce96-1b84-4abb-916d-85d976ee5d5f',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        author_name: 'Luis Cornaglia'
    }
];

export default function CoordinationSpace() {
    const { userProfile, role } = useAuth();
    const [topics, setTopics] = useState([]);
    const [comments, setComments] = useState([]);
    const [teachersCatalog, setTeachersCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // UI states
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [showSchemaInstructions, setShowSchemaInstructions] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedTopic, setSelectedTopic] = useState(null);
    
    // Modal & Action states
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [newTopicData, setNewTopicData] = useState({ title: '', description: '', status: 'Pendiente', assigned: [] });
    
    // Comment inputs
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [newCommentText, setNewCommentText] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState('');

    // Fetch teachers/staff catalog
    const fetchStaff = async () => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, first_name, last_name, orientation');
            if (error) throw error;
            setTeachersCatalog(data || []);
        } catch (e) {
            console.error("Error fetching staff:", e);
            // In demo mode, load dummy staff from profiles we know
            setTeachersCatalog([
                { id: '95c78188-52a3-484c-807a-8e1e2079b76e', first_name: 'Israel', last_name: 'Pavelek', orientation: '{"profiles":["Coordinador"]}' },
                { id: '90f5abc8-97ea-4dbb-b760-7fdaed1b82dd', first_name: 'Alejandro', last_name: 'Tombesi', orientation: '{"profiles":["Coordinador"]}' },
                { id: '10f2ce96-1b84-4abb-916d-85d976ee5d5f', first_name: 'Luis', last_name: 'Cornaglia', orientation: '{"profiles":["Gerente Técnico"]}' },
                { id: '52bc690c-f666-47cb-accc-d64f18dd47a7', first_name: 'Gonzalo', last_name: 'Bermudez', orientation: '{"profiles":["Especialista"],"specialtyArea":"Electrónica"}' },
                { id: 'a790db27-358e-4482-aa0c-bda50ad24c88', first_name: 'Laureano', last_name: 'Bolzan', orientation: '{"profiles":["Especialista"],"specialtyArea":"Mecánica"}' }
            ]);
        }
    };

    // Load Data
    const loadData = async () => {
        setLoading(true);
        await fetchStaff();
        
        try {
            // Test topics table existence
            const { data: topicsData, error: topicsError } = await supabase
                .from('coordination_topics')
                .select('*')
                .order('created_at', { ascending: false });

            if (topicsError) {
                if (topicsError.code === 'PGRST205' || topicsError.message.includes('coordination_topics')) {
                    throw new Error("Tables not initialized");
                }
                throw topicsError;
            }

            const { data: commentsData, error: commentsError } = await supabase
                .from('coordination_comments')
                .select('*')
                .order('created_at', { ascending: true });

            if (commentsError) throw commentsError;

            setTopics(topicsData || []);
            setComments(commentsData || []);
            setIsDemoMode(false);
        } catch (err) {
            console.warn("Falling back to Demo/Local Mock Mode:", err.message);
            setIsDemoMode(true);
            
            // Read or initialize local storage for persistence
            const localTopics = localStorage.getItem('etrr_local_topics');
            const localComments = localStorage.getItem('etrr_local_comments');
            
            if (localTopics && localComments) {
                setTopics(JSON.parse(localTopics));
                setComments(JSON.parse(localComments));
            } else {
                setTopics(MOCK_TOPICS);
                setComments(MOCK_COMMENTS);
                localStorage.setItem('etrr_local_topics', JSON.stringify(MOCK_TOPICS));
                localStorage.setItem('etrr_local_comments', JSON.stringify(MOCK_COMMENTS));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Helper to persist state in Demo Mode
    const saveDemoState = (newTopics, newComments) => {
        setTopics(newTopics);
        setComments(newComments);
        localStorage.setItem('etrr_local_topics', JSON.stringify(newTopics));
        localStorage.setItem('etrr_local_comments', JSON.stringify(newComments));
    };

    // Copy SQL instructions script
    const handleCopySQL = () => {
        const sqlText = `CREATE TABLE IF NOT EXISTS coordination_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Pendiente',
    assigned_teachers JSONB DEFAULT '[]',
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS coordination_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES coordination_topics(id) ON DELETE CASCADE NOT NULL,
    comment TEXT NOT NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE coordination_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordination_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_auth_topics ON coordination_topics FOR ALL TO authenticated USING (true);
CREATE POLICY allow_all_auth_comments ON coordination_comments FOR ALL TO authenticated USING (true);`;

        navigator.clipboard.writeText(sqlText);
        alert("¡Código SQL copiado al portapapeles con éxito!");
    };

    // Save Topic (Insert/Update)
    const handleSaveTopic = async (e) => {
        e.preventDefault();
        const authorId = userProfile?.id || '95c78188-52a3-484c-807a-8e1e2079b76e';
        const authorName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Israel Pavelek';

        if (isDemoMode) {
            let updatedTopics;
            if (editingTopic) {
                updatedTopics = topics.map(t => t.id === editingTopic.id ? {
                    ...t,
                    title: newTopicData.title,
                    description: newTopicData.description,
                    status: newTopicData.status,
                    assigned_teachers: newTopicData.assigned
                } : t);
            } else {
                const newT = {
                    id: `local-topic-${Date.now()}`,
                    title: newTopicData.title,
                    description: newTopicData.description,
                    status: newTopicData.status,
                    assigned_teachers: newTopicData.assigned,
                    created_by: authorId,
                    created_at: new Date().toISOString(),
                    creator_name: authorName
                };
                updatedTopics = [newT, ...topics];
            }
            saveDemoState(updatedTopics, comments);
            if (!editingTopic) {
                notifyNewTopic(newTopicData.title, newTopicData.assigned);
            }
            setIsTopicModalOpen(false);
            setEditingTopic(null);
            setNewTopicData({ title: '', description: '', status: 'Pendiente', assigned: [] });
            return;
        }

        // Live Supabase Mode
        try {
            setLoading(true);
            if (editingTopic) {
                const { error } = await supabase
                    .from('coordination_topics')
                    .update({
                        title: newTopicData.title,
                        description: newTopicData.description,
                        status: newTopicData.status,
                        assigned_teachers: JSON.stringify(newTopicData.assigned)
                    })
                    .eq('id', editingTopic.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('coordination_topics')
                    .insert([{
                        title: newTopicData.title,
                        description: newTopicData.description,
                        status: newTopicData.status,
                        assigned_teachers: JSON.stringify(newTopicData.assigned),
                        created_by: authorId
                    }]);
                if (error) throw error;
                notifyNewTopic(newTopicData.title, newTopicData.assigned);
            }
            await loadData();
            setIsTopicModalOpen(false);
            setEditingTopic(null);
            setNewTopicData({ title: '', description: '', status: 'Pendiente', assigned: [] });
        } catch (err) {
            alert(`Error al guardar tema: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Open Topic Modal for Creation / Edit
    const openTopicModal = (topicToEdit = null) => {
        setStaffSearchQuery('');
        if (topicToEdit) {
            setEditingTopic(topicToEdit);
            let assignedArr = [];
            if (typeof topicToEdit.assigned_teachers === 'string') {
                try { assignedArr = JSON.parse(topicToEdit.assigned_teachers); } catch { assignedArr = []; }
            } else if (Array.isArray(topicToEdit.assigned_teachers)) {
                assignedArr = topicToEdit.assigned_teachers;
            }
            setNewTopicData({
                title: topicToEdit.title,
                description: topicToEdit.description || '',
                status: topicToEdit.status || 'Pendiente',
                assigned: assignedArr
            });
        } else {
            setEditingTopic(null);
            setNewTopicData({ title: '', description: '', status: 'Pendiente', assigned: [] });
        }
        setIsTopicModalOpen(true);
    };

    // Delete Topic
    const handleDeleteTopic = async (topicId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta tarea/tema por completo junto con sus comentarios?")) return;

        if (isDemoMode) {
            const updatedTopics = topics.filter(t => t.id !== topicId);
            const updatedComments = comments.filter(c => c.topic_id !== topicId);
            saveDemoState(updatedTopics, updatedComments);
            if (selectedTopic?.id === topicId) setSelectedTopic(null);
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('coordination_topics')
                .delete()
                .eq('id', topicId);
            if (error) throw error;
            await loadData();
            if (selectedTopic?.id === topicId) setSelectedTopic(null);
        } catch (err) {
            alert(`Error al eliminar: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Update status directly from detail view
    const handleUpdateStatus = async (topicId, newStatus) => {
        if (isDemoMode) {
            const updatedTopics = topics.map(t => t.id === topicId ? { ...t, status: newStatus } : t);
            saveDemoState(updatedTopics, comments);
            if (selectedTopic?.id === topicId) {
                setSelectedTopic(prev => ({ ...prev, status: newStatus }));
            }
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('coordination_topics')
                .update({ status: newStatus })
                .eq('id', topicId);
            if (error) throw error;
            await loadData();
            if (selectedTopic?.id === topicId) {
                setSelectedTopic(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            alert(`Error al actualizar estado: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Toggle staff assignment inside the form
    const toggleStaffInForm = (staffId) => {
        const currentAssigned = [...newTopicData.assigned];
        const index = currentAssigned.indexOf(staffId);
        if (index > -1) {
            currentAssigned.splice(index, 1);
        } else {
            currentAssigned.push(staffId);
        }
        setNewTopicData({ ...newTopicData, assigned: currentAssigned });
    };

    // Helper to send notifications when a new coordination task is created
    const notifyNewTopic = (topicTitle, assignedTeachers) => {
        const title = 'Nueva Tarea de Coordinación 📋';
        const content = `Se ha creado la tarea "${topicTitle}" en el espacio de coordinación.`;
        if (assignedTeachers && assignedTeachers.length > 0) {
            assignedTeachers.forEach(teacherId => {
                createNotification(teacherId, title, content, 'coordination');
            });
        } else {
            createNotification(null, title, content, 'coordination');
        }
    };

    // Helper to send notifications when a comment is added to a task
    const notifyComment = (authorId, authorName, text) => {
        let assignedList = [];
        if (typeof selectedTopic.assigned_teachers === 'string') {
            try { assignedList = JSON.parse(selectedTopic.assigned_teachers) || []; } catch { assignedList = []; }
        } else if (Array.isArray(selectedTopic.assigned_teachers)) {
            assignedList = selectedTopic.assigned_teachers;
        }

        const snippet = `${text.substring(0, 45)}${text.length > 45 ? '...' : ''}`;
        const title = 'Nuevo Comentario en Coordinación 💬';
        const content = `${authorName} comentó en "${selectedTopic.title}": "${snippet}"`;

        if (assignedList.length > 0) {
            assignedList.forEach(teacherId => {
                if (teacherId !== authorId) {
                    createNotification(teacherId, title, content, 'coordination');
                }
            });
        } else {
            createNotification(null, title, content, 'coordination');
        }

        if (selectedTopic.created_by && selectedTopic.created_by !== authorId && !assignedList.includes(selectedTopic.created_by)) {
            createNotification(selectedTopic.created_by, title, content, 'coordination');
        }
    };

    // Post new comment
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;

        const authorId = userProfile?.id || '95c78188-52a3-484c-807a-8e1e2079b76e';
        const authorName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Israel Pavelek';

        if (isDemoMode) {
            const newC = {
                id: `local-comment-${Date.now()}`,
                topic_id: selectedTopic.id,
                comment: newCommentText,
                created_by: authorId,
                created_at: new Date().toISOString(),
                author_name: authorName
            };
            const updatedComments = [...comments, newC];
            saveDemoState(topics, updatedComments);
            notifyComment(authorId, authorName, newCommentText);
            setNewCommentText('');
            return;
        }

        try {
            const { error } = await supabase
                .from('coordination_comments')
                .insert([{
                    topic_id: selectedTopic.id,
                    comment: newCommentText,
                    created_by: authorId
                }]);
            if (error) throw error;
            notifyComment(authorId, authorName, newCommentText);
            setNewCommentText('');
            await loadData();
        } catch (err) {
            alert(`Error al agregar comentario: ${err.message}`);
        }
    };

    // Edit comment trigger
    const startEditComment = (comment) => {
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.comment);
    };

    // Save edited comment
    const handleSaveComment = async (commentId) => {
        if (!editingCommentText.trim()) return;

        if (isDemoMode) {
            const updatedComments = comments.map(c => c.id === commentId ? { ...c, comment: editingCommentText } : c);
            saveDemoState(topics, updatedComments);
            setEditingCommentId(null);
            return;
        }

        try {
            const { error } = await supabase
                .from('coordination_comments')
                .update({ comment: editingCommentText })
                .eq('id', commentId);
            if (error) throw error;
            setEditingCommentId(null);
            await loadData();
        } catch (err) {
            alert(`Error al actualizar comentario: ${err.message}`);
        }
    };

    // Delete comment
    const handleDeleteComment = async (commentId) => {
        if (!confirm("¿Deseas eliminar este comentario?")) return;

        if (isDemoMode) {
            const updatedComments = comments.filter(c => c.id !== commentId);
            saveDemoState(topics, updatedComments);
            return;
        }

        try {
            const { error } = await supabase
                .from('coordination_comments')
                .delete()
                .eq('id', commentId);
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert(`Error al eliminar comentario: ${err.message}`);
        }
    };

    // Helpers to lookup names in database or catalog
    const getStaffInfo = (staffId) => {
        const staff = teachersCatalog.find(t => t.id === staffId);
        if (!staff) return { name: 'Desconocido', initial: '?' };
        const initial = `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`;
        return {
            name: `${staff.first_name} ${staff.last_name}`,
            initial,
            profiles: parseProfiles(staff.orientation).profilesList,
            specialty: parseProfiles(staff.orientation).specialtyArea
        };
    };

    const getAuthorInfo = (userId, customName = null) => {
        if (customName) return { name: customName, initials: customName.split(' ').map(n => n[0]).join('') };
        const staff = teachersCatalog.find(t => t.id === userId);
        if (staff) {
            return {
                name: `${staff.first_name} ${staff.last_name}`,
                initials: `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`
            };
        }
        return { name: 'Coordinador', initials: 'CO' };
    };

    // Filter topics
    const filteredTopics = topics.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        
        if (role === 'docente') {
            let assignedList = [];
            if (typeof t.assigned_teachers === 'string') {
                try { assignedList = JSON.parse(t.assigned_teachers) || []; } catch { assignedList = []; }
            } else if (Array.isArray(t.assigned_teachers)) {
                assignedList = t.assigned_teachers;
            }
            const isAssigned = assignedList.includes(userProfile?.id);
            const isCreator = t.created_by === userProfile?.id;
            return matchesSearch && matchesStatus && (isAssigned || isCreator);
        }
        
        return matchesSearch && matchesStatus;
    });

    const activeTopicComments = comments.filter(c => selectedTopic && c.topic_id === selectedTopic.id);

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-6 animate-fade-in-up">
            
            {/* Header / Banner */}
            <header className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden group border-l-4 border-l-accent shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                </div>
                <div className="absolute top-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mt-20 pointer-events-none"></div>

                <div className="relative z-10 flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-accent/20 shrink-0">
                        CP
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Coordinación & Gerencia</h2>
                        <p className="text-secondary font-medium mt-1">Espacio de trabajo colectivo para el seguimiento de tareas, insumos y temas estratégicos del Nodo Tecnológico de la escuela.</p>
                    </div>
                </div>

                {role !== 'docente' && (
                    <button
                        onClick={() => openTopicModal()}
                        className="btn btn-primary h-12 px-6 shadow-md shadow-primary/20 shrink-0 flex items-center gap-2 relative z-10 hover:scale-[1.02] active:scale-95 transition-all font-bold"
                    >
                        <Plus size={20} />
                        <span>Nuevo Tema / Tarea</span>
                    </button>
                )}
            </header>

            {/* Warning Banner for Demo Mode / Missing Schema */}
            {isDemoMode && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-inner">
                    <div className="flex gap-3">
                        <AlertCircle className="text-warning shrink-0 mt-0.5 md:mt-0" size={22} />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Modo de Demostración Activo</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                Las tablas `coordination_topics` y `coordination_comments` no están creadas en tu base de datos de Supabase. Los datos creados se guardarán temporalmente en la memoria del navegador.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                        <button
                            onClick={() => setShowSchemaInstructions(!showSchemaInstructions)}
                            className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center gap-2 border border-amber-500/20"
                        >
                            <Database size={14} />
                            <span>{showSchemaInstructions ? 'Ocultar Instrucciones' : '¿Cómo configurar en Supabase?'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* SQL Setup Instructions Modal/Card */}
            {showSchemaInstructions && (
                <div className="glass-card p-6 border-2 border-primary/30 rounded-2xl bg-surface/90 shadow-2xl animate-fade-in-up">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Database className="text-primary animate-pulse" size={20} />
                                Configurar Base de Datos en Supabase
                            </h3>
                            <p className="text-xs text-secondary mt-1">Sigue estos sencillos pasos para persistir las tareas en tu servidor de Supabase permanentemente:</p>
                        </div>
                        <button 
                            onClick={() => setShowSchemaInstructions(false)} 
                            className="p-1 rounded-lg hover:bg-surface-hover text-secondary transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    <ol className="list-decimal list-inside text-xs text-secondary space-y-2 mt-4 bg-main/50 p-4 rounded-xl border border-color">
                        <li>Ingresa a tu cuenta en <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">Supabase.com</a>.</li>
                        <li>Haz clic en tu proyecto de base de datos actual.</li>
                        <li>Ve a la pestaña **SQL Editor** en el menú izquierdo (el icono del terminal SQL "&gt;_").</li>
                        <li>Haz clic en **New query** para abrir una consola en blanco.</li>
                        <li>Copia el script SQL de abajo presionando el botón de copiar.</li>
                        <li>Pega el código en la consola de Supabase y presiona el botón verde **Run** (en la parte inferior derecha).</li>
                    </ol>

                    <div className="relative mt-4 group">
                        <pre className="text-[10px] text-tertiary bg-black/90 p-4 rounded-xl overflow-x-auto max-h-48 border border-white/10 leading-relaxed font-mono">
{`CREATE TABLE IF NOT EXISTS coordination_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Pendiente',
    assigned_teachers JSONB DEFAULT '[]',
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS coordination_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES coordination_topics(id) ON DELETE CASCADE NOT NULL,
    comment TEXT NOT NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE coordination_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordination_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_auth_topics ON coordination_topics FOR ALL TO authenticated USING (true);
CREATE POLICY allow_all_auth_comments ON coordination_comments FOR ALL TO authenticated USING (true);`}
                        </pre>
                        <button
                            onClick={handleCopySQL}
                            className="absolute top-2 right-2 bg-primary text-white hover:bg-primary-hover p-2 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all shadow-md"
                            title="Copiar código SQL"
                        >
                            <Copy size={13} />
                            <span>Copiar SQL</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Split View: Tasks List & Detail Sidebar */}
            <div className="grid lg:grid-cols-12 gap-8 items-start">
                
                {/* Left side: Search, Filters & Tasks List */}
                <div className={`space-y-6 ${selectedTopic ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
                    
                    {/* Controls Bar */}
                    <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div className="relative w-full md:w-80">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-tertiary">
                                <Search size={18} />
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar temas, tareas, descripciones..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 text-sm bg-main border border-color rounded-xl w-full text-[var(--text-primary)] placeholder-slate-400 focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                        </div>

                        {/* Status Filters */}
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto shrink-0 pb-1 md:pb-0">
                            {['all', 'Pendiente', 'En Proceso', 'Resuelto'].map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                                        statusFilter === st 
                                            ? 'bg-accent border-accent text-white shadow-sm' 
                                            : 'bg-surface hover:bg-surface-hover text-secondary border-color hover:border-color-hover'
                                    }`}
                                >
                                    {st === 'all' ? 'Todos' : st}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tasks / Topics List */}
                    {loading ? (
                        <div className="py-20 text-center font-bold text-secondary flex items-center justify-center gap-3">
                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                            <span>Cargando datos...</span>
                        </div>
                    ) : filteredTopics.length === 0 ? (
                        <div className="glass-card py-20 text-center border-2 border-dashed border-color/60 rounded-2xl flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-main flex items-center justify-center mb-4 border border-color shadow-inner">
                                <AlertCircle size={28} className="text-tertiary" />
                            </div>
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">No se encontraron tareas</h3>
                            <p className="text-sm text-secondary max-w-sm mt-1">Prueba cambiando los filtros de búsqueda o crea una nueva tarea para debatir.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTopics.map(topic => {
                                let assignedList = [];
                                if (typeof topic.assigned_teachers === 'string') {
                                    try { assignedList = JSON.parse(topic.assigned_teachers) || []; } catch { assignedList = []; }
                                } else if (Array.isArray(topic.assigned_teachers)) {
                                    assignedList = topic.assigned_teachers;
                                }

                                const isSelected = selectedTopic?.id === topic.id;
                                const topicComments = comments.filter(c => c.topic_id === topic.id);

                                return (
                                    <div 
                                        key={topic.id}
                                        onClick={() => setSelectedTopic(topic)}
                                        className={`glass-card p-5 cursor-pointer relative overflow-hidden group border-l-4 transition-all flex flex-col justify-between gap-4 hover:shadow-lg hover:border-color-hover min-h-[180px] ${
                                            isSelected 
                                                ? 'border-l-accent ring-2 ring-accent bg-accent/5' 
                                                : topic.status === 'Resuelto' 
                                                    ? 'border-l-success' 
                                                    : topic.status === 'En Proceso' 
                                                        ? 'border-l-accent' 
                                                        : 'border-l-warning'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-3">
                                                {/* Date & Author */}
                                                <span className="text-[10px] text-tertiary font-semibold flex items-center gap-1.5">
                                                    <Calendar size={12} />
                                                    {new Date(topic.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                    <span>•</span>
                                                    <span>Por {getAuthorInfo(topic.created_by, topic.creator_name).name}</span>
                                                </span>

                                                {/* Status Badge */}
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                                                    topic.status === 'Resuelto' ? 'bg-success/10 text-success border-success/20' :
                                                    topic.status === 'En Proceso' ? 'bg-accent/10 text-accent border-accent/20' :
                                                    'bg-warning/10 text-warning border-warning/20'
                                                }`}>
                                                    {topic.status}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-base text-[var(--text-primary)] mt-2 group-hover:text-accent transition-colors leading-snug">
                                                {topic.title}
                                            </h3>
                                            
                                            {topic.description && (
                                                <p className="text-xs text-secondary mt-1.5 line-clamp-2 leading-relaxed">
                                                    {topic.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Bottom Row: Assigned Staff & Comments Count */}
                                        <div className="flex justify-between items-center gap-3 border-t border-color/40 pt-3.5 mt-1 relative z-10">
                                            {/* Assigned Staff avatars */}
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {assignedList.length === 0 ? (
                                                    <span className="text-[10px] text-tertiary font-bold italic">Sin asignar</span>
                                                ) : (
                                                    assignedList.slice(0, 4).map(stId => {
                                                        const info = getStaffInfo(stId);
                                                        return (
                                                            <div 
                                                                key={stId} 
                                                                title={info.name}
                                                                className="w-6 h-6 rounded-full bg-accent/20 border border-surface text-[8px] font-black text-accent flex items-center justify-center uppercase shrink-0 shadow-sm"
                                                            >
                                                                {info.initial}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                {assignedList.length > 4 && (
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 border border-surface text-[8px] font-bold text-secondary flex items-center justify-center shrink-0">
                                                        +{assignedList.length - 4}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0">
                                                {/* Comments count */}
                                                <span className="text-xs font-bold text-secondary flex items-center gap-1.5 hover:text-accent transition-colors">
                                                    <MessageSquare size={13} className="text-tertiary" />
                                                    {topicComments.length}
                                                </span>

                                                {/* Edit / Delete Buttons */}
                                                {role !== 'docente' && (
                                                    <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openTopicModal(topic); }}
                                                            className="p-1 rounded-lg hover:bg-accent/10 text-secondary hover:text-accent transition-colors"
                                                            title="Editar Tarea"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id); }}
                                                            className="p-1 rounded-lg hover:bg-error/10 text-secondary hover:text-error transition-colors"
                                                            title="Eliminar Tarea"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right side: Comments & Discussion thread of selected task */}
                {selectedTopic && (
                    <div className="lg:col-span-5 glass-card flex flex-col max-h-[700px] border-l-4 border-l-accent shadow-lg animate-fade-in relative z-20">
                        {/* Selected Task Header */}
                        <div className="p-5 border-b border-color/40 bg-surface-hover/30 relative">
                            <button
                                onClick={() => setSelectedTopic(null)}
                                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-hover text-secondary hover:text-[var(--text-primary)] transition-colors shrink-0"
                                title="Cerrar panel de debate"
                            >
                                <X size={18} />
                            </button>

                            <div className="pr-8 space-y-3">
                                <div className="inline-block relative">
                                    <select
                                        value={selectedTopic.status}
                                        onChange={(e) => handleUpdateStatus(selectedTopic.id, e.target.value)}
                                        className={`text-[9px] font-black px-2.5 py-1 rounded-full border tracking-wide uppercase cursor-pointer outline-none transition-all appearance-none pr-6 ${
                                            selectedTopic.status === 'Resuelto' ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' :
                                            selectedTopic.status === 'En Proceso' ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20' :
                                            'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
                                        }`}
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Proceso">En Proceso</option>
                                        <option value="Resuelto">Resuelto</option>
                                    </select>
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-secondary">▼</span>
                                </div>

                                <h3 className="font-bold text-lg text-[var(--text-primary)] mt-1.5 leading-tight">{selectedTopic.title}</h3>
                                {selectedTopic.description && (
                                    <p className="text-xs text-secondary leading-relaxed bg-main/50 p-3 rounded-xl border border-color/40 shadow-inner">{selectedTopic.description}</p>
                                )}

                                {/* Meta information / Assigned Staff list */}
                                <div className="border-t border-color/30 pt-3.5 mt-2 flex flex-col gap-2">
                                    <span className="text-[10px] text-tertiary font-bold flex items-center gap-1.5">
                                        Creador: {getAuthorInfo(selectedTopic.created_by, selectedTopic.creator_name).name} • {new Date(selectedTopic.created_at).toLocaleDateString('es-AR')}
                                    </span>
                                    
                                    {/* Detailed assigned staff */}
                                    {(() => {
                                        let list = [];
                                        if (typeof selectedTopic.assigned_teachers === 'string') {
                                            try { list = JSON.parse(selectedTopic.assigned_teachers) || []; } catch { list = []; }
                                        } else if (Array.isArray(selectedTopic.assigned_teachers)) {
                                            list = selectedTopic.assigned_teachers;
                                        }
                                        if (list.length === 0) return null;
                                        return (
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-tertiary uppercase tracking-wider block">Docentes asignados:</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {list.map(stId => {
                                                        const info = getStaffInfo(stId);
                                                        return (
                                                            <span 
                                                                key={stId} 
                                                                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent"
                                                            >
                                                                {info.name} {info.profiles.includes('Especialista') && `(Esp. en ${info.specialty})`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Comments Thread list */}
                        <div className="p-5 flex-grow overflow-y-auto space-y-4 bg-main/15 min-h-[300px]">
                            {activeTopicComments.length === 0 ? (
                                <div className="py-12 text-center text-tertiary flex flex-col items-center">
                                    <MessageSquare size={32} className="opacity-30 mb-2" />
                                    <p className="text-xs font-bold">Aún no hay comentarios.</p>
                                    <p className="text-[10px] opacity-70">¡Sé el primero en aportar una sugerencia o respuesta!</p>
                                </div>
                            ) : (
                                activeTopicComments.map(comment => {
                                    const author = getAuthorInfo(comment.created_by, comment.author_name);
                                    const isEditing = editingCommentId === comment.id;

                                    return (
                                        <div key={comment.id} className="flex items-start gap-3 group/comment animate-fade-in">
                                            {/* Avatar/Initial Circle with gradient */}
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/25 to-primary/25 border border-accent/20 flex items-center justify-center text-xs font-black text-accent shrink-0 uppercase shadow-sm">
                                                {author.initials}
                                            </div>

                                            {/* Comment content box */}
                                            <div className="bg-surface border border-color rounded-2xl p-3.5 shadow-sm max-w-full flex-grow relative overflow-hidden">
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-[10px] font-black text-[var(--text-primary)]">{author.name}</span>
                                                    <span className="text-[9px] text-tertiary font-semibold">
                                                        {new Date(comment.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {isEditing ? (
                                                    <div className="mt-2 space-y-2">
                                                        <textarea
                                                            value={editingCommentText}
                                                            onChange={e => setEditingCommentText(e.target.value)}
                                                            className="w-full text-xs p-2 bg-main border border-color rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-accent leading-relaxed"
                                                            rows={2}
                                                        />
                                                        <div className="flex justify-end gap-1.5">
                                                            <button
                                                                onClick={() => setEditingCommentId(null)}
                                                                className="px-2.5 py-1 text-[10px] font-bold text-secondary bg-main hover:bg-surface-hover rounded-lg border border-color transition-colors"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveComment(comment.id)}
                                                                className="px-2.5 py-1 text-[10px] font-bold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
                                                            >
                                                                Guardar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-secondary mt-1 whitespace-pre-wrap leading-relaxed">
                                                        {comment.comment}
                                                    </p>
                                                )}

                                                {/* Edit/Delete Actions */}
                                                {!isEditing && (
                                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity bg-surface pl-2">
                                                        {comment.created_by === userProfile?.id && (
                                                            <button
                                                                onClick={() => startEditComment(comment)}
                                                                className="p-1 text-tertiary hover:text-accent hover:bg-accent/5 rounded transition-colors"
                                                                title="Editar Comentario"
                                                            >
                                                                <Edit2 size={11} />
                                                            </button>
                                                        )}
                                                        {(comment.created_by === userProfile?.id || role !== 'docente') && (
                                                            <button
                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                className="p-1 text-tertiary hover:text-error hover:bg-error/5 rounded transition-colors"
                                                                title="Eliminar Comentario"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Add Comment Input Form */}
                        <form onSubmit={handleAddComment} className="p-4 border-t border-color/40 bg-surface flex gap-2">
                            <input
                                type="text"
                                placeholder="Escribe un aporte, sugerencia o comentario..."
                                value={newCommentText}
                                onChange={e => setNewCommentText(e.target.value)}
                                className="flex-grow text-xs px-3.5 py-2.5 bg-main border border-color rounded-xl text-[var(--text-primary)] placeholder-slate-400 focus:ring-2 focus:ring-accent outline-none transition-all"
                            />
                            <button
                                type="submit"
                                className="btn btn-primary px-4 py-2.5 shrink-0 text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                Enviar
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Task Creation / Edit Modal */}
            {isTopicModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in-up">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                            <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">
                                {editingTopic ? 'Editar Tema / Tarea' : 'Nuevo Tema o Tarea de Coordinación'}
                            </h3>
                            <button 
                                onClick={() => setIsTopicModalOpen(false)} 
                                className="text-secondary hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTopic} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            
                            {/* Title */}
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Título o Asunto *</label>
                                <input
                                    type="text"
                                    required
                                    value={newTopicData.title}
                                    onChange={e => setNewTopicData({ ...newTopicData, title: e.target.value })}
                                    placeholder="Ej: Auditoría de seguridad del taller 2"
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full py-2 px-3 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Detalles o Descripción</label>
                                <textarea
                                    value={newTopicData.description}
                                    onChange={e => setNewTopicData({ ...newTopicData, description: e.target.value })}
                                    placeholder="Proporciona detalles sobre los temas a tratar o la tarea específica..."
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full py-2 px-3 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                                    rows={3}
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="text-sm font-semibold mb-1 block text-secondary">Estado Inicial</label>
                                <select
                                    value={newTopicData.status}
                                    onChange={e => setNewTopicData({ ...newTopicData, status: e.target.value })}
                                    className="bg-main border border-color rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-accent w-full cursor-pointer outline-none"
                                >
                                    <option value="Pendiente">Pendiente (Sin iniciar)</option>
                                    <option value="En Proceso">En Proceso (En discusión/desarrollo)</option>
                                    <option value="Resuelto">Resuelto (Tema cerrado)</option>
                                </select>
                            </div>

                            {/* Multi-Select Assigned Staff */}
                            <div>
                                <label className="text-sm font-semibold mb-1.5 block text-secondary">Asignar a Docentes / Especialistas / Pañoleros</label>
                                <p className="text-[10px] text-tertiary mb-2">Selecciona uno o varios miembros del personal involucrados en este tema o tarea:</p>
                                
                                <div className="relative mb-3">
                                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-tertiary">
                                        <Search size={14} />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, especialidad o rol..."
                                        value={staffSearchQuery}
                                        onChange={e => setStaffSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-2 text-xs bg-main border border-color rounded-xl w-full text-[var(--text-primary)] placeholder-slate-400 focus:ring-1 focus:ring-accent outline-none transition-all shadow-inner"
                                    />
                                    {staffSearchQuery && (
                                        <button 
                                            type="button"
                                            onClick={() => setStaffSearchQuery('')}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-tertiary hover:text-[var(--text-primary)] transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-color/60 p-3 rounded-xl bg-main/30 shadow-inner">
                                    {(() => {
                                        const filtered = teachersCatalog
                                            .filter(staff => staff.first_name || staff.last_name)
                                            .filter(staff => {
                                                const fullName = `${staff.first_name} ${staff.last_name}`.toLowerCase();
                                                const { profilesList, specialtyArea } = parseProfiles(staff.orientation);
                                                const query = staffSearchQuery.toLowerCase();
                                                return fullName.includes(query) || 
                                                       profilesList.some(p => p.toLowerCase().includes(query)) ||
                                                       specialtyArea.toLowerCase().includes(query);
                                            });

                                        if (filtered.length === 0) {
                                            return (
                                                <div className="text-center py-8 text-xs text-tertiary font-bold flex flex-col items-center justify-center gap-1.5">
                                                    <span>No se encontraron resultados</span>
                                                    <span className="text-[10px] font-normal opacity-70">Prueba con otra palabra clave</span>
                                                </div>
                                            );
                                        }

                                        return filtered.map(staff => {
                                            const { profilesList, specialtyArea } = parseProfiles(staff.orientation);
                                            const isChecked = newTopicData.assigned.includes(staff.id);
                                            const initials = `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`;
                                            
                                            return (
                                                <label 
                                                    key={staff.id} 
                                                    className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer select-none transition-all hover:bg-surface-hover/80 ${
                                                        isChecked 
                                                            ? 'bg-accent/10 border-accent/40 text-accent shadow-sm' 
                                                            : 'border-color/50 text-secondary'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/25 flex items-center justify-center text-[10px] font-black text-accent uppercase shrink-0">
                                                            {initials}
                                                        </div>
                                                        <div className="leading-tight">
                                                            <span className="text-xs font-bold block text-[var(--text-primary)]">
                                                                {staff.last_name}, {staff.first_name}
                                                            </span>
                                                            <span className="text-[10px] text-tertiary font-semibold block">
                                                                {profilesList.includes('Especialista') && specialtyArea 
                                                                    ? `Especialista en ${specialtyArea}` 
                                                                    : profilesList.join(' / ')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleStaffInForm(staff.id)}
                                                        className="rounded border-color/50 text-accent focus:ring-accent bg-main w-4 h-4 cursor-pointer animate-scale-up"
                                                    />
                                                </label>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex gap-3 justify-end border-t border-color/40 pt-4 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsTopicModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-bold text-secondary bg-main hover:bg-surface-hover rounded-xl border border-color transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary px-6 py-2.5 text-sm font-bold shadow-md shadow-primary/10 transition-all hover:scale-[1.02] shrink-0"
                                >
                                    {loading ? 'Guardando...' : editingTopic ? 'Guardar Cambios' : 'Crear Tema'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
