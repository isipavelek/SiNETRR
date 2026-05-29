import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
    X, Upload, FileText, CheckCircle, Clock, Trash2, Image, 
    ExternalLink, Plus, MessageSquare, AlertCircle, Camera
} from 'lucide-react';

export default function ProjectSubmissionDetail({ project, onClose }) {
    const { role, userProfile } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [gallery, setGallery] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form inputs - Submissions
    const [submittingTemplateId, setSubmittingTemplateId] = useState(null);
    const [submissionForm, setSubmissionForm] = useState({ fileUrl: '', comments: '' });
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // Form inputs - Gallery
    const [isGalleryFormOpen, setIsGalleryFormOpen] = useState(false);
    const [galleryForm, setGalleryForm] = useState({ imageUrl: '', caption: '', description: '' });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [postingGallery, setPostingGallery] = useState(false);

    const isTeacher = role === 'docente';

    useEffect(() => {
        if (project) {
            loadProjectSubData();
        }
    }, [project]);

    const loadProjectSubData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Event Templates
            const { data: tempd, error: tempe } = await supabase
                .from('event_templates')
                .select('*')
                .eq('event_id', project.event_id);
            if (tempe) throw tempe;
            setTemplates(tempd || []);

            // 2. Fetch Project Submissions
            const { data: subd, error: sube } = await supabase
                .from('project_submissions')
                .select('*')
                .eq('project_id', project.id);
            if (sube) throw sube;
            setSubmissions(subd || []);

            // 3. Fetch Project Gallery
            const { data: gald, error: gale } = await supabase
                .from('project_gallery')
                .select('*')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });
            if (gale) throw gale;
            setGallery(gald || []);

        } catch (err) {
            console.error('Error loading project submission details:', err);
        } finally {
            setLoading(false);
        }
    };

    // Submissions Actions
    const handleCreateSubmission = async (e, templateId) => {
        e.preventDefault();
        if (!submissionForm.fileUrl.trim()) return;

        setUploadingDoc(true);
        try {
            const { error } = await supabase
                .from('project_submissions')
                .insert([{
                    project_id: project.id,
                    template_id: templateId,
                    file_url: submissionForm.fileUrl,
                    comments: submissionForm.comments,
                    uploaded_by: userProfile?.id
                }]);
            if (error) throw error;
            
            await loadProjectSubData();
            setSubmittingTemplateId(null);
            setSubmissionForm({ fileUrl: '', comments: '' });
        } catch (err) {
            alert('Error al entregar documento: ' + err.message);
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleDeleteSubmission = async (subId) => {
        if (!confirm('¿Estás seguro de eliminar este documento entregado?')) return;
        try {
            const { error } = await supabase
                .from('project_submissions')
                .delete()
                .eq('id', subId);
            if (error) throw error;
            await loadProjectSubData();
        } catch (err) {
            alert('Error al eliminar entrega: ' + err.message);
        }
    };

    // Simulated File Uploads (generates a mock link or uploads if possible)
    const handleSimulatedDocUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingDoc(true);
        // Simulate a delay and generate a link
        setTimeout(() => {
            setSubmissionForm(prev => ({
                ...prev,
                fileUrl: `https://mockfile.etrr.edu.ar/uploads/projects/${project.id}/${encodeURIComponent(file.name)}`
            }));
            setUploadingDoc(false);
            alert(`Archivo "${file.name}" cargado simuladamente.`);
        }, 1500);
    };

    const handleSimulatedImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            // Upload to storage profile uploads bucket if possible
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `gallery/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, file);

            if (uploadError) {
                // Fallback simulation
                setTimeout(() => {
                    // Using a placeholder graphic image since we don't have real file storage online
                    setGalleryForm(prev => ({
                        ...prev,
                        imageUrl: `https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=800&q=80`
                    }));
                    setUploadingImage(false);
                    alert("Simulado: Foto subida correctamente. Se utilizará una imagen de taller de muestra.");
                }, 1500);
            } else {
                const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
                setGalleryForm(prev => ({ ...prev, imageUrl: data.publicUrl }));
                setUploadingImage(false);
            }
        } catch (err) {
            console.error('Upload image error:', err);
            setUploadingImage(false);
        }
    };

    // Gallery Actions
    const handleCreateGalleryItem = async (e) => {
        e.preventDefault();
        if (!galleryForm.imageUrl.trim() || !galleryForm.caption.trim()) return;

        setPostingGallery(true);
        try {
            const { error } = await supabase
                .from('project_gallery')
                .insert([{
                    project_id: project.id,
                    image_url: galleryForm.imageUrl,
                    caption: galleryForm.caption,
                    progress_description: galleryForm.description,
                    uploaded_by: userProfile?.id
                }]);
            if (error) throw error;
            
            await loadProjectSubData();
            setIsGalleryFormOpen(false);
            setGalleryForm({ imageUrl: '', caption: '', description: '' });
        } catch (err) {
            alert('Error al subir foto de avance: ' + err.message);
        } finally {
            setPostingGallery(false);
        }
    };

    const handleDeleteGalleryItem = async (itemId) => {
        if (!confirm('¿Estás seguro de eliminar esta foto del avance?')) return;
        try {
            const { error } = await supabase
                .from('project_gallery')
                .delete()
                .eq('id', itemId);
            if (error) throw error;
            await loadProjectSubData();
        } catch (err) {
            alert('Error al eliminar foto: ' + err.message);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-start md:items-center p-4 overflow-y-auto">
            <div className="bg-surface border border-color rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[92vh] animate-scale-in">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-color/50 bg-primary/5 shrink-0">
                    <div>
                        <span className="text-[10px] font-black px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full uppercase tracking-wider">
                            Entregas & Avances
                        </span>
                        <h3 className="font-extrabold text-xl text-[var(--text-primary)] mt-1 truncate max-w-[500px]">
                            {project.name}
                        </h3>
                        <p className="text-xs text-secondary mt-1">
                            Materia: {project.subjects?.name} | Curso: {project.subjects?.courses?.name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-surface hover:bg-surface-hover border border-color rounded-xl text-secondary hover:text-error transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    {loading ? (
                        <div className="py-20 text-center flex items-center justify-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-secondary font-medium">Cargando requerimientos...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            
                            {/* Left Column: Requirements & Documents */}
                            <div className="lg:col-span-7 space-y-6">
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-color pb-2">
                                        <FileText className="text-primary" size={18} />
                                        Entregables del Proyecto
                                    </h4>

                                    {templates.length === 0 ? (
                                        <div className="p-6 border border-dashed border-color rounded-xl bg-main/20 text-center text-tertiary">
                                            <p className="text-sm font-semibold">Sin requerimientos de entrega</p>
                                            <p className="text-xs text-secondary mt-1">Coordinación aún no ha definido entregables obligatorios para este evento.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {templates.map(temp => {
                                                const sub = submissions.find(s => s.template_id === temp.id);
                                                const isEditing = submittingTemplateId === temp.id;

                                                return (
                                                    <div key={temp.id} className="p-4 bg-main/30 border border-color/40 rounded-xl space-y-3">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div>
                                                                <h5 className="font-bold text-sm text-[var(--text-primary)]">{temp.name}</h5>
                                                                {temp.description && (
                                                                    <p className="text-xs text-secondary font-medium mt-1 leading-relaxed">{temp.description}</p>
                                                                )}
                                                                {temp.template_url && (
                                                                    <a 
                                                                        href={temp.template_url} 
                                                                        target="_blank" 
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-1.5"
                                                                    >
                                                                        Descargar Plantilla <ExternalLink size={10} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase shrink-0 ${
                                                                sub ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30'
                                                            }`}>
                                                                {sub ? 'Entregado' : 'Pendiente'}
                                                            </span>
                                                        </div>

                                                        {sub ? (
                                                            // Submission Details
                                                            <div className="bg-surface/50 border border-color/40 rounded-xl p-3.5 flex items-center justify-between gap-4">
                                                                <div className="min-w-0 space-y-1">
                                                                    <a 
                                                                        href={sub.file_url} 
                                                                        target="_blank" 
                                                                        rel="noreferrer"
                                                                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 truncate"
                                                                    >
                                                                        Ver Documento Entregado <ExternalLink size={12} />
                                                                    </a>
                                                                    {sub.comments && (
                                                                        <p className="text-[11px] text-secondary leading-relaxed italic">"{sub.comments}"</p>
                                                                    )}
                                                                </div>
                                                                {isTeacher && (
                                                                    <button
                                                                        onClick={() => handleDeleteSubmission(sub.id)}
                                                                        className="p-2 bg-error/15 text-error rounded-lg hover:bg-error hover:text-white transition-all shrink-0"
                                                                        title="Eliminar entrega"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            // Deliver Form Trigger or Form
                                                            isTeacher && (
                                                                <div>
                                                                    {!isEditing ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSubmittingTemplateId(temp.id);
                                                                                setSubmissionForm({ fileUrl: '', comments: '' });
                                                                            }}
                                                                            className="px-4 py-2 bg-primary/10 hover:bg-primary hover:text-white rounded-xl text-xs font-bold text-primary transition-all flex items-center gap-1 shadow-sm"
                                                                        >
                                                                            <Upload size={13} />
                                                                            <span>Entregar Documento</span>
                                                                        </button>
                                                                    ) : (
                                                                        <form onSubmit={(e) => handleCreateSubmission(e, temp.id)} className="p-3 bg-surface/80 border border-primary/20 rounded-xl space-y-3 animate-fade-in-up">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-xs font-bold text-primary">Cargar Entrega</span>
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={() => setSubmittingTemplateId(null)}
                                                                                    className="text-secondary hover:text-[var(--text-primary)]"
                                                                                >
                                                                                    <X size={15} />
                                                                                </button>
                                                                            </div>
                                                                            <div className="grid grid-cols-1 gap-3">
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Enlace del Documento (Drive/Dropbox/Web) *</label>
                                                                                    <input 
                                                                                        type="url"
                                                                                        required
                                                                                        placeholder="https://docs.google.com/..."
                                                                                        value={submissionForm.fileUrl}
                                                                                        onChange={e => setSubmissionForm(prev => ({ ...prev, fileUrl: e.target.value }))}
                                                                                        className="bg-main border-color/40 text-xs text-[var(--text-primary)] w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[10px] text-tertiary">O subir archivo de tu PC (Simulado):</span>
                                                                                    <label className="px-2 py-1 bg-surface border border-color hover:bg-surface-hover rounded text-[10px] font-bold text-secondary cursor-pointer transition-all flex items-center gap-1">
                                                                                        <Upload size={10} />
                                                                                        <span>Examinar...</span>
                                                                                        <input 
                                                                                            type="file"
                                                                                            onChange={handleSimulatedDocUpload}
                                                                                            className="hidden"
                                                                                        />
                                                                                    </label>
                                                                                </div>
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Comentarios</label>
                                                                                    <textarea 
                                                                                        placeholder="Mensaje o notas opcionales para la entrega..."
                                                                                        rows={2}
                                                                                        value={submissionForm.comments}
                                                                                        onChange={e => setSubmissionForm(prev => ({ ...prev, comments: e.target.value }))}
                                                                                        className="bg-main border-color/40 text-xs text-[var(--text-primary)] w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                type="submit"
                                                                                disabled={uploadingDoc}
                                                                                className="btn btn-primary w-full py-2 text-xs font-bold rounded-lg shadow flex items-center justify-center gap-1.5"
                                                                            >
                                                                                {uploadingDoc ? 'Enviando...' : 'Cargar Entrega'}
                                                                            </button>
                                                                        </form>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Project Gallery & Advances */}
                            <div className="lg:col-span-5 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-color pb-2">
                                        <h4 className="font-black text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                                            <Image className="text-primary" size={18} />
                                            Galería de Avances
                                        </h4>
                                        {isTeacher && !isGalleryFormOpen && (
                                            <button
                                                onClick={() => setIsGalleryFormOpen(true)}
                                                className="px-2.5 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-0.5"
                                            >
                                                <Plus size={12} /> Cargar Foto
                                            </button>
                                        )}
                                    </div>

                                    {/* Gallery Upload Form */}
                                    {isGalleryFormOpen && (
                                        <form onSubmit={handleCreateGalleryItem} className="p-4 bg-main/40 border border-primary/20 rounded-xl space-y-3 animate-fade-in-up">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-primary flex items-center gap-1">
                                                    <Camera size={13} /> Agregar Foto de Avance
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setIsGalleryFormOpen(false)}
                                                    className="text-secondary hover:text-[var(--text-primary)]"
                                                >
                                                    <X size={15} />
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[9px] font-bold text-secondary uppercase block mb-1">URL de la Imagen *</label>
                                                    <input 
                                                        type="url"
                                                        required
                                                        placeholder="https://enlace-imagen.com/foto.jpg"
                                                        value={galleryForm.imageUrl}
                                                        onChange={e => setGalleryForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                                        className="bg-surface border-color/40 text-xs text-[var(--text-primary)] w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-tertiary">O subir foto (Simulada):</span>
                                                    <label className="px-2 py-1 bg-surface border border-color hover:bg-surface-hover rounded text-[10px] font-bold text-secondary cursor-pointer transition-all flex items-center gap-1">
                                                        <Upload size={10} />
                                                        <span>Subir Foto</span>
                                                        <input 
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleSimulatedImageUpload}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-secondary uppercase block mb-1">Título de la Foto *</label>
                                                    <input 
                                                        type="text"
                                                        required
                                                        placeholder="Ej: Prueba de motores, Primer prototipo"
                                                        value={galleryForm.caption}
                                                        onChange={e => setGalleryForm(prev => ({ ...prev, caption: e.target.value }))}
                                                        className="bg-surface border-color/40 text-xs text-[var(--text-primary)] w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-secondary uppercase block mb-1">Descripción / Bitácora</label>
                                                    <textarea 
                                                        placeholder="Indica qué avance se logró y qué dificultades surgieron..."
                                                        rows={2}
                                                        value={galleryForm.description}
                                                        onChange={e => setGalleryForm(prev => ({ ...prev, description: e.target.value }))}
                                                        className="bg-surface border-color/40 text-xs text-[var(--text-primary)] w-full rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={postingGallery || uploadingImage}
                                                className="btn btn-primary w-full py-2 text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-1.5"
                                            >
                                                {postingGallery ? 'Guardando...' : 'Cargar Avance'}
                                            </button>
                                        </form>
                                    )}

                                    {/* Gallery items list */}
                                    {gallery.length === 0 ? (
                                        <div className="py-12 border border-dashed border-color rounded-xl text-center text-tertiary bg-main/20">
                                            <p className="text-sm font-semibold">Sin imágenes en la bitácora</p>
                                            <p className="text-xs text-secondary mt-1">Sube fotos de los prototipos y avances para documentar la muestra.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {gallery.map(item => (
                                                <div key={item.id} className="bg-main/30 border border-color/40 rounded-xl overflow-hidden shadow-sm flex flex-col group relative">
                                                    {isTeacher && (
                                                        <button
                                                            onClick={() => handleDeleteGalleryItem(item.id)}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-error text-white hover:text-white rounded-lg transition-all z-10 opacity-0 group-hover:opacity-100 shadow"
                                                            title="Eliminar foto"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                    <div className="h-40 bg-black overflow-hidden relative shrink-0">
                                                        <img 
                                                            src={item.image_url} 
                                                            alt={item.caption} 
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    </div>
                                                    <div className="p-3.5 space-y-1.5 flex-grow">
                                                        <h5 className="font-bold text-xs text-[var(--text-primary)] leading-tight">{item.caption}</h5>
                                                        {item.progress_description && (
                                                            <p className="text-[10px] text-secondary leading-relaxed font-medium line-clamp-3">{item.progress_description}</p>
                                                        )}
                                                        <span className="text-[8px] text-tertiary font-mono block pt-1 border-t border-color/10">
                                                            {new Date(item.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
