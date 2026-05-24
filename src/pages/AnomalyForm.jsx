import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { createNotification } from '../lib/notificationsHelper';

export default function AnomalyForm() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);
    const [teachersList, setTeachersList] = useState([]);

    const [formData, setFormData] = useState({
        card_number: '',
        date: new Date().toISOString().split('T')[0],
        placed_by: '',
        group_name: '',
        course: '',
        sector: '',
        teacher_responsible: '',
        element: '',
        problem_description: '',
        urgency: 'Normal',
        solution_suggestion: '',
        photo: null
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch teachers
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('id')
                    .eq('role_name', 'docente')
                    .single();
                if (roleData) {
                    const { data: profData } = await supabase
                        .from('user_profiles')
                        .select('id, first_name, last_name')
                        .eq('role_id', roleData.id)
                        .order('last_name');
                    if (profData) setTeachersList(profData);
                }
            } catch (err) {
                console.error('Error fetching teachers:', err);
            }
        };

        fetchInitialData();

        // Auto-generate a unique anomaly card number
        const year = new Date().getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        setFormData(prev => ({
            ...prev,
            card_number: `AN-${year}-${rand}`
        }));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFormData({ ...formData, photo: e.target.files[0] });
        }
    };

    const uploadPhoto = async (file) => {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `anomalies/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (e) {
            console.error("Error uploading photo:", e);
            return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let photoUrl = null;
            if (formData.photo) {
                photoUrl = await uploadPhoto(formData.photo);
            }

            // In anomalies, the urgency is embedded in explicit_suggestion as: [URGENCIA:Nivel] Texto
            const formattedSuggestion = `[URGENCIA:${formData.urgency}] ${formData.solution_suggestion}`;

            const { error: insertError } = await supabase
                .from('red_cards')
                .insert([{
                    card_number: formData.card_number,
                    date: formData.date,
                    placed_by: formData.placed_by,
                    group_name: formData.group_name || 'Ciclo basico',
                    course: parseInt(formData.course) || 1,
                    sector: formData.sector,
                    teacher_responsible: formData.teacher_responsible,
                    subject: 'ANOMALIA', // MUST be ANOMALIA to be fetched in Anomaly Dashboard
                    element: formData.element,
                    problem_description: formData.problem_description,
                    suggestion_type: 'R- Reparar', // default type
                    explicit_suggestion: formattedSuggestion,
                    photo_url: photoUrl,
                    status: 'Sin Asignar'
                }]);

            if (insertError) throw insertError;

            // Trigger notification for all coordinators & managers & pañoleros
            await createNotification(
                null,
                'Nueva Anomalía Reportada ⚠️',
                `Se reportó una anomalía en "${formData.sector}" sobre "${formData.element}" con urgencia "${formData.urgency}". Reportado por: ${formData.placed_by || 'Anónimo'}.`,
                'planning'
            );

            setSuccess(true);
            setTimeout(() => navigate('/login'), 4000);

        } catch (err) {
            console.error(err);
            setError('Hubo un error al enviar el reporte. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex h-screen items-center justify-center bg-main p-4">
                <div className="card max-w-md w-full text-center border-t-4" style={{ borderTopColor: 'var(--color-accent)' }}>
                    <div className="text-5xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold mb-2">Anomalía Reportada</h2>
                    <p className="text-secondary mb-3">El reporte técnico ha sido registrado con éxito. Gracias por colaborar en mantener los talleres y equipos en óptimo estado.</p>
                    <p className="text-sm font-mono font-bold text-accent bg-accent/10 py-2 px-4 rounded-lg inline-block mb-6">Código de Reporte: {formData.card_number}</p>
                    <p className="text-sm text-tertiary">Redirigiendo al inicio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-main py-12 px-4 md:px-8 lg:px-12 flex items-center justify-center animate-fade-in-up relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-accent/5 blur-[80px] pointer-events-none"></div>

            <div className="w-full max-w-4xl glass-card p-0 overflow-hidden relative z-10 border-t-4 border-t-accent shadow-[0_10px_40px_rgba(0,0,0,0.3)]">

                <div className="p-8 md:p-10 border-b border-color/40 bg-surface-hover/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                    <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center text-[var(--text-primary)] shadow-lg shadow-accent/30 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight mb-2">Reporte de Anomalías</h1>
                            <p className="text-secondary font-medium">Equipos y Talleres • Aviso de fallas y desperfectos</p>
                        </div>
                    </div>

                    <Link to="/login" className="btn bg-surface-hover border border-color/80 text-secondary hover:text-[var(--text-primary)] hover:bg-surface hover:border-color shadow-sm transition-all shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Volver
                    </Link>
                </div>

                <div className="p-8 md:p-10">
                    {error && (
                        <div className="mb-8 p-4 bg-error/10 border border-error/30 rounded-xl flex items-start gap-3 animate-shake">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-error shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                            <p className="text-sm font-semibold text-error/90 leading-relaxed">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-10">

                        {/* Basic Info Section */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-color/40 pb-2 mb-6">
                                <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-accent/30">1</span>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">Datos del Reporte</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Número de Reporte <span className="text-secondary">(Auto-generado)</span>
                                    </label>
                                    <input type="text" name="card_number" value={formData.card_number} readOnly className="w-full bg-main/30 border border-color/40 rounded-xl px-4 py-3 text-secondary font-mono cursor-not-allowed shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Fecha del reporte <span className="text-error">*</span>
                                    </label>
                                    <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all shadow-inner font-mono" />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Nombre del Reportante <span className="text-error">*</span>
                                    </label>
                                    <input type="text" name="placed_by" value={formData.placed_by} onChange={handleChange} required placeholder="Nombre completo o correo electrónico de quien reporta la falla" className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all placeholder:text-surface-hover shadow-inner" />
                                </div>
                            </div>
                        </section>

                        {/* Location Section */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-color/40 pb-2 mb-6">
                                <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-accent/30">2</span>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">Ubicación y Sector</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 relative">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Grupo / Especialidad
                                    </label>
                                    <select name="group_name" value={formData.group_name} onChange={handleChange} className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all appearance-none cursor-pointer shadow-inner pr-10">
                                        <option value="" className="text-tertiary bg-surface">Seleccione especialidad...</option>
                                        <option value="Ciclo basico" className="bg-surface text-[var(--text-primary)]">Ciclo Básico</option>
                                        <option value="TEL" className="bg-surface text-[var(--text-primary)]">TEL (Electrónica)</option>
                                        <option value="TEM" className="bg-surface text-[var(--text-primary)]">TEM (Electromecánica)</option>
                                    </select>
                                    <div className="absolute top-[34px] right-4 pointer-events-none text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></div>
                                </div>
                                <div className="space-y-2 relative">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Curso (Año)
                                    </label>
                                    <select name="course" value={formData.course} onChange={handleChange} className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all appearance-none cursor-pointer shadow-inner pr-10">
                                        <option value="" className="text-tertiary bg-surface">Seleccione curso...</option>
                                        {[1, 2, 3, 4, 5, 6, 7].map(c => <option key={c} value={c} className="bg-surface text-[var(--text-primary)]">{c}° Año</option>)}
                                    </select>
                                    <div className="absolute top-[34px] right-4 pointer-events-none text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></div>
                                </div>
                                <div className="md:col-span-2 space-y-2 relative">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Sector Físico / Aula / Taller <span className="text-error">*</span>
                                    </label>
                                    <select name="sector" value={formData.sector} onChange={handleChange} required className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all appearance-none cursor-pointer shadow-inner pr-10">
                                        <option value="" className="text-tertiary bg-surface">Seleccione el sector afectado...</option>
                                        <option value="Robótica" className="bg-surface text-[var(--text-primary)]">Robótica</option>
                                        <option value="Sala Profesores" className="bg-surface text-[var(--text-primary)]">Sala Profesores</option>
                                        <option value="Laboratorio Químico" className="bg-surface text-[var(--text-primary)]">Laboratorio Químico</option>
                                        <option value="Simulación CNC" className="bg-surface text-[var(--text-primary)]">Simulación CNC</option>
                                        <option value="Taller CNC" className="bg-surface text-[var(--text-primary)]">Taller CNC</option>
                                        <option value="Taller Mecanizado" className="bg-surface text-[var(--text-primary)]">Taller Mecanizado</option>
                                        <option value="Taller Soldadura y Hojalateria" className="bg-surface text-[var(--text-primary)]">Taller Soldadura y Hojalateria</option>
                                        <option value="Taller Eléctrico" className="bg-surface text-[var(--text-primary)]">Taller Eléctrico</option>
                                        <option value="Pañol" className="bg-surface text-[var(--text-primary)]">Pañol</option>
                                        <option value="SAM" className="bg-surface text-[var(--text-primary)]">SAM</option>
                                        <option value="FACT" className="bg-surface text-[var(--text-primary)]">FACT</option>
                                        <option value="Taller General 1 (Sur)" className="bg-surface text-[var(--text-primary)]">Taller General 1 (Sur)</option>
                                        <option value="Taller General 2 (Norte)" className="bg-surface text-[var(--text-primary)]">Taller General 2 (Norte)</option>
                                        <option value="Taller Electrónica 1 (Sur)" className="bg-surface text-[var(--text-primary)]">Taller Electrónica 1 (Sur)</option>
                                        <option value="Taller Electrónica 2 (Norte)" className="bg-surface text-[var(--text-primary)]">Taller Electrónica 2 (Norte)</option>
                                        <option value="FabLab" className="bg-surface text-[var(--text-primary)]">FabLab</option>
                                        <option value="Pasillos" className="bg-surface text-[var(--text-primary)]">Pasillos</option>
                                    </select>
                                    <div className="absolute top-[34px] right-4 pointer-events-none text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></div>
                                </div>
                                <div className="md:col-span-2 space-y-2 relative">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Docente a cargo de la clase (Opcional)
                                    </label>
                                    <select
                                        name="teacher_responsible"
                                        value={formData.teacher_responsible}
                                        onChange={handleChange}
                                        className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all appearance-none cursor-pointer shadow-inner pr-10"
                                    >
                                        <option value="" className="text-tertiary bg-surface">Seleccionar docente (Opcional)...</option>
                                        {teachersList.map(t => (
                                            <option key={t.id} value={`${t.last_name}, ${t.first_name}`} className="bg-surface text-[var(--text-primary)]">
                                                {t.last_name}, {t.first_name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute top-[34px] right-4 pointer-events-none text-tertiary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></div>
                                </div>
                            </div>
                        </section>

                        {/* Defect Details Section */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-color/40 pb-2 mb-6">
                                <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-accent/30">3</span>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">Detalles del Desperfecto</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Equipo / Objeto Afectado <span className="text-error">*</span>
                                    </label>
                                    <input type="text" name="element" value={formData.element} onChange={handleChange} required placeholder="¿Qué máquina, instalación o elemento está fallando? Ej. Amoladora de Banco N°2" className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all placeholder:text-surface-hover shadow-inner" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Descripción de la Falla o Anomalía <span className="text-error">*</span>
                                    </label>
                                    <textarea
                                        name="problem_description"
                                        value={formData.problem_description}
                                        onChange={handleChange}
                                        placeholder="Describa el desperfecto técnico de forma clara (Ej. No enciende, presenta cables pelados, hace un ruido extraño al girar...)"
                                        rows={4}
                                        required
                                        className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all placeholder:text-surface-hover shadow-inner resize-y min-h-[100px]"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Urgency and Solution Section */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-color/40 pb-2 mb-6">
                                <span className="bg-accent/20 text-accent w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border border-accent/30">4</span>
                                <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">Urgencia y Sugerencia</h3>
                            </div>

                            <div className="bg-surface-hover/20 border border-color/40 p-6 md:p-8 rounded-2xl space-y-6">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest block text-center md:text-left mb-2">
                                        Grado de Urgencia <span className="text-error">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {['Muy Urgente', 'Urgente', 'Normal', 'Baja'].map((urg) => {
                                            const isSelected = formData.urgency === urg;
                                            const activeStyles = 
                                                urg === 'Muy Urgente' 
                                                    ? 'bg-error/15 border-error text-error shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                                    : urg === 'Urgente'
                                                        ? 'bg-warning/15 border-warning text-warning shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                                                        : urg === 'Normal'
                                                            ? 'bg-primary/15 border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                                            : 'bg-success/15 border-success text-success shadow-[0_0_15px_rgba(34,197,94,0.2)]';
                                            return (
                                                <label
                                                    key={urg}
                                                    className={`flex items-center justify-center gap-2 cursor-pointer p-4 rounded-xl border transition-all text-sm font-bold text-center select-none ${
                                                        isSelected 
                                                            ? activeStyles 
                                                            : 'bg-main/50 border-color/50 text-secondary hover:bg-surface-hover hover:border-color'
                                                    }`}
                                                >
                                                    <input type="radio" name="urgency" value={urg} checked={isSelected} onChange={handleChange} required className="hidden" />
                                                    <span>{urg}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2">
                                    <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest flex justify-between">
                                        Acción sugerida / Propuesta de Solución <span className="text-error">*</span>
                                    </label>
                                    <textarea
                                        name="solution_suggestion"
                                        value={formData.solution_suggestion}
                                        onChange={handleChange}
                                        placeholder="Sugerencias para resolver el desperfecto (Ej. Enviar el motor a rebobinar, cambiar el fusible quemado...)"
                                        rows={3}
                                        required
                                        className="w-full bg-main/50 border border-color/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:bg-surface focus:ring-2 focus:ring-accent/40 focus:border-accent/50 transition-all placeholder:text-surface-hover shadow-inner resize-y min-h-[80px]"
                                    />
                                </div>
                            </div>

                            {/* Photo Upload */}
                            <div className="mt-8">
                                <label className="text-[11px] font-bold text-tertiary uppercase tracking-widest block mb-3">
                                    Evidencia Fotográfica (Opcional)
                                </label>

                                <label
                                    htmlFor="photo-upload"
                                    className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${formData.photo
                                        ? 'border-accent bg-accent/5'
                                        : 'border-color hover:bg-surface hover:border-color-hover bg-main/30'
                                        }`}
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {formData.photo ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mb-3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                                <p className="mb-1 text-sm text-[var(--text-primary)] font-semibold">Archivo seleccionado</p>
                                                <p className="text-xs text-accent font-mono bg-accent/10 px-3 py-1 rounded mt-1">{formData.photo.name}</p>
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary mb-3"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                                <p className="mb-1 text-sm text-secondary font-medium"><span className="text-accent font-bold">Hacé click para subir</span> o arrastrá el archivo</p>
                                                <p className="text-xs text-tertiary">PNG, JPG, JPEG (Max. 10MB)</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        id="photo-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        ref={fileInputRef}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </section>

                        <div className="pt-8 border-t border-color/40 flex flex-col sm:flex-row justify-end gap-4">
                            <Link to="/login" className="btn bg-surface border border-color text-secondary hover:text-[var(--text-primary)] hover:bg-surface-hover hover:border-color-hover py-3 px-8 order-2 sm:order-1 text-center w-full sm:w-auto">
                                Cancelar y Volver
                            </Link>
                            <button
                                type="submit"
                                className="btn py-3 px-10 text-[var(--text-primary)] font-extrabold tracking-wide uppercase shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all order-1 sm:order-2 w-full sm:w-auto flex justify-center items-center gap-2"
                                style={{ backgroundColor: 'var(--color-accent)' }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[var(--text-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4Z" /></svg>
                                        Reportar Anomalía
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
