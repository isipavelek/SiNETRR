import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X, Save, Camera } from 'lucide-react';

export default function EditTeacherModal({ isOpen, onClose, teacher, onTeacherUpdated }) {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        coordinatorId: ''
    });
    const [coordinators, setCoordinators] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [profiles, setProfiles] = useState({
        docente: true,
        coordinador: false,
        especialista: false,
        gerenteTecnico: false,
        panolero: false
    });
    const [specialtyArea, setSpecialtyArea] = useState('');
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');

    useEffect(() => {
        const fetchCoordinators = async () => {
            try {
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('id')
                    .eq('role_name', 'coordinador')
                    .single();

                if (roleData) {
                    const { data } = await supabase
                        .from('user_profiles')
                        .select('id, first_name, last_name')
                        .eq('role_id', roleData.id);
                    setCoordinators(data || []);
                }
            } catch (err) {
                console.error('Error fetching coordinators', err);
            }
        };

        if (isOpen) {
            fetchCoordinators();
        }

        if (isOpen && teacher) {
            let parsedProfiles = { docente: true, coordinador: false, especialista: false, gerenteTecnico: false, panolero: false };
            let parsedSpecialty = '';

            if (teacher.orientation && teacher.orientation.startsWith('{')) {
                try {
                    const parsed = JSON.parse(teacher.orientation);
                    const list = parsed.profiles || [];
                    parsedProfiles = {
                        docente: list.includes('Docente'),
                        coordinador: list.includes('Coordinador'),
                        especialista: list.includes('Especialista'),
                        gerenteTecnico: list.includes('Gerente Técnico'),
                        panolero: list.includes('Pañolero')
                    };
                    parsedSpecialty = parsed.specialtyArea || '';
                } catch (e) {
                    console.error("Error parsing orientation JSON", e);
                }
            } else if (teacher.orientation) {
                const val = teacher.orientation;
                parsedProfiles = {
                    docente: val.includes('Docente'),
                    coordinador: val.includes('Coordinador'),
                    especialista: val.includes('Especialista'),
                    gerenteTecnico: val.includes('Gerente'),
                    panolero: val.includes('Pañolero')
                };
            }

            setFormData({
                firstName: teacher.first_name || '',
                lastName: teacher.last_name || '',
                coordinatorId: teacher.coordinator_id || ''
            });
            setPhotoPreview(teacher.photo_url || '');
            setPhotoFile(null);
            setProfiles(parsedProfiles);
            setSpecialtyArea(parsedSpecialty);
            setError('');
        }
    }, [isOpen, teacher]);

    if (!isOpen || !teacher) return null;

    const uploadPhoto = async (file) => {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `profiles/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (e) {
            console.error("Error uploading teacher profile photo:", e);
            throw new Error("No se pudo subir la foto del docente: " + (e.message || "Error desconocido"));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const profilesList = [];
            if (profiles.docente) profilesList.push('Docente');
            if (profiles.coordinador) profilesList.push('Coordinador');
            if (profiles.especialista) profilesList.push('Especialista');
            if (profiles.gerenteTecnico) profilesList.push('Gerente Técnico');
            if (profiles.panolero) profilesList.push('Pañolero');

            const orientationJson = JSON.stringify({
                profiles: profilesList,
                specialtyArea: profiles.especialista ? specialtyArea : ''
            });

            let photoUrl = teacher.photo_url;
            if (photoFile) {
                photoUrl = await uploadPhoto(photoFile);
            }

            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    coordinator_id: formData.coordinatorId || null,
                    orientation: orientationJson,
                    photo_url: photoUrl
                })
                .eq('id', teacher.id);

            if (updateError) throw updateError;

            onTeacherUpdated();
            onClose();
        } catch (err) {
            setError(err.message || 'Error al actualizar el docente.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in-up">
            <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                    <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">Editar Docente</h3>
                    <button onClick={onClose} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 relative">
                    {/* Foto de Perfil */}
                    <div className="flex flex-col items-center gap-2 mb-2 relative">
                        <div className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 bg-main/50 shadow-md">
                            {photoPreview ? (
                                <img src={photoPreview} alt="Vista previa" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-secondary font-black text-3xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary">
                                    {formData.firstName?.charAt(0) || 'D'}
                                </div>
                            )}
                            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold">
                                <Camera size={18} className="mb-1" />
                                <span>Cambiar Foto</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            setPhotoFile(file);
                                            setPhotoPreview(URL.createObjectURL(file));
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <span className="text-[10px] text-tertiary font-medium">PNG, JPG hasta 5MB</span>
                    </div>
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none"></div>

                    {error && (
                        <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg flex items-center gap-3 relative z-10">
                            <X size={16} /> <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Nombre</label>
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Apellido</label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                            />
                        </div>
                    </div>

                    <div className="relative z-10 w-full mt-2">
                        <label className="text-sm font-semibold mb-1 block text-secondary">Coordinador de Trayectoria</label>
                        <select
                            value={formData.coordinatorId}
                            onChange={e => setFormData({ ...formData, coordinatorId: e.target.value })}
                            className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                        >
                            <option value="" className="bg-surface text-tertiary">-- Ninguno --</option>
                            {coordinators.map(coord => (
                                <option key={coord.id} value={coord.id} className="bg-surface text-[var(--text-primary)]">
                                    {coord.first_name} {coord.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative z-10 w-full mt-2">
                        <label className="text-sm font-semibold mb-2 block text-secondary">Perfiles Asignados</label>
                        <div className="grid grid-cols-2 gap-3 p-3.5 bg-main/30 border border-color/30 rounded-xl shadow-inner">
                            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={profiles.docente}
                                    onChange={e => setProfiles({ ...profiles, docente: e.target.checked })}
                                    className="rounded border-color/50 text-primary focus:ring-primary/50 bg-main"
                                />
                                <span>Docente</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={profiles.coordinador}
                                    onChange={e => setProfiles({ ...profiles, coordinador: e.target.checked })}
                                    className="rounded border-color/50 text-primary focus:ring-primary/50 bg-main"
                                />
                                <span>Coordinador</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={profiles.especialista}
                                    onChange={e => setProfiles({ ...profiles, especialista: e.target.checked })}
                                    className="rounded border-color/50 text-primary focus:ring-primary/50 bg-main"
                                />
                                <span>Especialista</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={profiles.gerenteTecnico}
                                    onChange={e => setProfiles({ ...profiles, gerenteTecnico: e.target.checked })}
                                    className="rounded border-color/50 text-primary focus:ring-primary/50 bg-main"
                                />
                                <span>Gerente Técnico</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={profiles.panolero}
                                    onChange={e => setProfiles({ ...profiles, panolero: e.target.checked })}
                                    className="rounded border-color/50 text-primary focus:ring-primary/50 bg-main"
                                />
                                <span>Pañolero</span>
                            </label>
                        </div>
                    </div>

                    {profiles.especialista && (
                        <div className="relative z-10 w-full animate-fade-in-up">
                            <label className="text-sm font-semibold mb-1 block text-secondary">¿En qué es especialista?</label>
                            <input
                                type="text"
                                required
                                value={specialtyArea}
                                onChange={e => setSpecialtyArea(e.target.value)}
                                placeholder="Ej: Electrónica, Mecánica, Soldadura..."
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full mt-4 h-12 shadow-lg shadow-primary/20 relative z-10 border-none transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}
