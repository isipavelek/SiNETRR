import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [view, setView] = useState('login'); // 'login' or 'forgot'
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { error } = await signIn(email, password);
            if (error) {
                setError('Credenciales incorrectas');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/dashboard`
            });
            if (error) throw error;
            setSuccessMsg('¡Enlace enviado! Revisa tu correo electrónico para restablecer tu contraseña.');
        } catch (err) {
            setError(err.message || 'Error al enviar el enlace de recuperación.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-main p-4 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[100px] rounded-full pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[100px] rounded-full pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            <div className="w-full max-w-md glass-card p-8 md:p-10 relative z-10 animate-fade-in-up">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-primary/20 shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                    </div>
                    <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-[var(--text-primary)] drop-shadow-sm">ETRR Docentes</h1>
                    <p className="text-secondary font-medium">Portal de Gestión Interna</p>
                </div>

                {error && (
                    <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-3 animate-shake">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="bg-success/10 border border-success/20 text-success text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        <span>{successMsg}</span>
                    </div>
                )}

                {view === 'login' ? (
                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
                        <div>
                            <label className="text-sm font-semibold mb-2 block text-secondary">Correo Electrónico</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="juan.perez@ejemplo.com"
                                    className="pl-10 text-[var(--text-primary)]"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-semibold block text-secondary">Contraseña</label>
                                <button
                                    type="button"
                                    onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }}
                                    className="text-xs font-bold text-primary hover:underline hover:text-primary-hover focus:outline-none transition-colors"
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="pl-10 text-[var(--text-primary)]"
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2 h-12 text-base flex justify-center items-center gap-2">
                            {loading ? 'Ingresando...' : (
                                <>
                                    Ingresar al Sistema
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
                        <div>
                            <label className="text-sm font-semibold mb-2 block text-secondary">Correo Electrónico</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-tertiary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="juan.perez@ejemplo.com"
                                    className="pl-10 text-[var(--text-primary)]"
                                    required
                                />
                            </div>
                            <p className="text-xs text-tertiary mt-2 leading-relaxed">
                                Ingresa tu correo para recibir un enlace de recuperación. Al hacer clic en el enlace, podrás ingresar al sistema y cambiar tu contraseña desde tu perfil.
                            </p>
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2 h-12 text-base flex justify-center items-center gap-2">
                            {loading ? 'Enviando...' : (
                                <>
                                    Enviar Enlace de Recuperación
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                            className="text-sm font-bold text-center text-secondary hover:text-[var(--text-primary)] transition-colors mt-2"
                        >
                            Volver al Inicio de Sesión
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-color/50 relative">
                    <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 bg-surface px-4 text-xs font-bold text-tertiary uppercase tracking-wider rounded-full border border-color/50">
                        Otras Acciones
                    </div>

                    <div className="bg-warning/5 rounded-xl p-5 border border-warning/20 transition-all hover:bg-warning/10 hover:border-warning/30 group">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-error/20 rounded-lg text-error group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </div>
                            <h3 className="font-bold text-[15px] text-[var(--text-primary)]">Reportar Tarjeta Roja (5S)</h3>
                        </div>
                        <p className="text-sm text-secondary mb-4 leading-relaxed pl-12 pr-2">
                            Si detectaste una anomalía en un aula o taller, podés reportarla rápidamente de forma pública o anónima.
                        </p>
                        <Link to="/tarjeta-roja" className="btn w-full bg-error text-[var(--text-primary)] hover:bg-red-600 border-none shadow-sm hover:shadow-md ml-auto flex items-center justify-center gap-2">
                            Crear Reporte 5S
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
