import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, AlertTriangle, Check, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function EditMyProfileModal({ isOpen, onClose }) {
    const { userProfile, session, refreshProfile } = useAuth();

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen && userProfile && session) {
            setFormData({
                firstName: userProfile.first_name || '',
                lastName: userProfile.last_name || '',
                email: session.user.email || '',
                password: '',
                confirmPassword: ''
            });
            setPhotoPreview(userProfile.photo_url || '');
            setPhotoFile(null);
            setError('');
            setSuccessMsg('');
        }
    }, [isOpen, userProfile, session]);

    if (!isOpen || !userProfile) return null;

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
            console.error("Error uploading profile photo:", e);
            throw new Error("No se pudo subir la foto de perfil. Verifique la conexión o el tamaño del archivo.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            // Validate password if filled
            if (formData.password) {
                if (formData.password.length < 6) {
                    throw new Error('La contraseña debe tener al menos 6 caracteres.');
                }
                if (formData.password !== formData.confirmPassword) {
                    throw new Error('Las contraseñas no coinciden.');
                }
            }

            let photoUrl = userProfile.photo_url;
            if (photoFile) {
                photoUrl = await uploadPhoto(photoFile);
            }

            // Update profile data in `user_profiles` table
            const { error: profileError } = await supabase
                .from('user_profiles')
                .update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    photo_url: photoUrl
                })
                .eq('id', userProfile.id);

            if (profileError) throw profileError;

            let finalMsg = 'Perfil actualizado correctamente.';

            // Update Auth password if provided
            if (formData.password) {
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: formData.password
                });
                if (passwordError) throw passwordError;
                finalMsg = 'Perfil y contraseña actualizados correctamente.';
            }

            // Update Auth email if changed
            if (formData.email !== session.user.email) {
                const { error: authError } = await supabase.auth.updateUser({
                    email: formData.email
                });

                if (authError) {
                    throw new Error('Error al actualizar correo: ' + authError.message);
                }

                finalMsg = 'Perfil guardado. Si cambiaste tu correo, revisa tu bandeja de entrada para verificarlo.';
            }

            setSuccessMsg(finalMsg);

            // Refresh the AuthContext
            await refreshProfile();

            // Close after a short delay on success
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (err) {
            setError(err.message || 'Error al actualizar el perfil.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in-up" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
                <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 relative z-10">
                    <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">Mi Perfil</h3>
                    <button onClick={onClose} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none"></div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 relative z-10">
                    {/* Foto de Perfil */}
                    <div className="flex flex-col items-center gap-2 mb-2 relative">
                        <div className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 bg-main/50 shadow-md">
                            {photoPreview ? (
                                <img src={photoPreview} alt="Vista previa" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-secondary font-black text-3xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary">
                                    {formData.firstName?.charAt(0) || 'U'}
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
                    {error && (
                        <div className="bg-error/10 border-l-4 border-error text-error text-sm px-4 py-3 rounded-r-lg flex items-center gap-3">
                            <AlertTriangle size={16} className="shrink-0" /> <span className="flex-1">{error}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-success/10 border-l-4 border-success text-success text-sm px-4 py-3 rounded-r-lg flex items-center gap-3">
                            <Check size={16} className="shrink-0" /> <span className="flex-1">{successMsg}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Nombre</label>
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Apellido</label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    <div className="w-full mt-2">
                        <label className="text-sm font-semibold mb-1 block text-secondary">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full focus:ring-primary/50"
                        />
                        <p className="text-xs text-tertiary mt-1">Si lo cambias, tendrás que confirmarlo con un link que llegará a tu bandeja de entrada.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Nueva Contraseña</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Dejar en blanco"
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full focus:ring-primary/50 placeholder:text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Confirmar Contraseña</label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                placeholder="Confirmar nueva clave"
                                className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full focus:ring-primary/50 placeholder:text-xs"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !!successMsg}
                        className="btn btn-primary w-full mt-6 h-12 shadow-lg shadow-primary/20 border-none transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
