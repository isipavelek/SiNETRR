import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function AddTeacherModal({ isOpen, onClose, onTeacherAdded }) {
    const { userProfile, role } = useAuth();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
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
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // First grab the role ID
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('id')
                .eq('role_name', 'docente')
                .single();

            if (!roleData) throw new Error('Rol de docente no encontrado en la base de datos.');

            // Manual fetch to bypass supabase SDK auto-login
            const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password
                })
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.msg || responseData.error_description || 'Error al crear la cuenta en Auth.');
            }

            const newUserId = responseData.user?.id || responseData.id;

            if (!newUserId) {
                throw new Error('No se pudo obtener el ID del usuario creado.');
            }

            // Stringify and save assigned profiles
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

            // Create profile
            const { error: profileError } = await supabase.from('user_profiles').insert([
                {
                    id: newUserId,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    role_id: roleData.id,
                    coordinator_id: formData.coordinatorId || null,
                    orientation: orientationJson
                }
            ]);

            if (profileError) {
                console.error("Error creating profile:", profileError);
                throw new Error(`Usuario creado en Auth, pero falló la creación del perfil: ${profileError.message} (${profileError.details || ''})`);
            }

            onTeacherAdded();
            onClose();
        } catch (err) {
            setError(err.message || 'Error al crear el docente. Verifique los datos.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in-up" style={{ zIndex: 9999 }}>
            <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative" style={{ zIndex: 10000 }}>
                <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                    <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">Nuevo Docente</h3>
                    <button onClick={onClose} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 relative">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none"></div>

                    {error && (
                        <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg flex items-center gap-3">
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
                                className="bg-main/50 border-color/50 text-[var(--text-primary)]"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-1 block text-secondary">Apellido</label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className="bg-main/50 border-color/50 text-[var(--text-primary)]"
                            />
                        </div>
                    </div>

                    <div className="relative z-10">
                        <label className="text-sm font-semibold mb-1 block text-secondary">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="bg-main/50 border-color/50 text-[var(--text-primary)]"
                        />
                    </div>

                    <div className="relative z-10">
                        <label className="text-sm font-semibold mb-1 block text-secondary">Contraseña Temporal</label>
                        <input
                            type="password"
                            required
                            minLength="6"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            className="bg-main/50 border-color/50 text-[var(--text-primary)]"
                        />
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
                        className="btn btn-primary w-full mt-4 h-12 shadow-lg relative z-10"
                    >
                        {loading ? 'Creando...' : 'Registrar Docente'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}
