import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
    Sun, Moon, Building2, Calendar, Users, 
    Check, Save, RefreshCw, Sliders, Shield, AlertTriangle, Trash2 
} from 'lucide-react';

export default function GlobalSettings() {
    const { role } = useAuth();
    const [theme, setTheme] = useState('light');
    const [cfpName, setCfpName] = useState('Nodo Tecnológico - Escuela Técnica Roberto Rocca');
    const [cfpYear, setCfpYear] = useState('2026');
    const [staffList, setStaffList] = useState([]);
    
    // UI states
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
 
    // Duplicates scan & purge states
    const [scanning, setScanning] = useState(false);
    const [purging, setPurging] = useState(false);
    const [dupCount, setDupCount] = useState(0);
    const [dupsList, setDupsList] = useState([]);
    const [scanResultMsg, setScanResultMsg] = useState('');

    // Load initial configurations
    useEffect(() => {
        const savedTheme = localStorage.getItem('etrr-theme') || 'light';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);

        const savedCfp = localStorage.getItem('etrr-cfp-name');
        if (savedCfp) setCfpName(savedCfp);

        const savedYear = localStorage.getItem('etrr-cfp-year');
        if (savedYear) setCfpYear(savedYear);

        fetchStaffStats();
    }, []);

    // Fetch live stats from Supabase
    const fetchStaffStats = async () => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('orientation');
            if (error) throw error;
            setStaffList(data || []);
        } catch (e) {
            console.error("Using fallback mock staff count:", e);
            // Dynamic mock fallback
            setStaffList([
                { orientation: '{"profiles":["Coordinador"]}' },
                { orientation: '{"profiles":["Coordinador"]}' },
                { orientation: '{"profiles":["Gerente Técnico"]}' },
                { orientation: '{"profiles":["Especialista"]}' },
                { orientation: '{"profiles":["Especialista"]}' },
                { orientation: '{"profiles":["Pañolero"]}' }
            ]);
        }
    };

    // Toggle Theme
    const handleThemeToggle = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('etrr-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    // Helper to count profiles
    const parseProfilesCount = () => {
        let counts = {
            coordinador: 0,
            gerente: 0,
            especialista: 0,
            panolero: 0,
            docente: 0
        };

        staffList.forEach(staff => {
            let pList = [];
            if (staff.orientation) {
                try {
                    const parsed = JSON.parse(staff.orientation);
                    pList = parsed.profiles || [];
                } catch (e) {
                    if (typeof staff.orientation === 'string') {
                        pList = staff.orientation.split(',').map(p => p.trim());
                    }
                }
            }
            // If no profile is explicitly selected, default to standard "Docente"
            if (pList.length === 0) {
                pList = ['Docente'];
            }

            pList.forEach(p => {
                const profile = p.toLowerCase();
                if (profile.includes('coordinador')) counts.coordinador++;
                else if (profile.includes('gerente')) counts.gerente++;
                else if (profile.includes('especialista')) counts.especialista++;
                else if (profile.includes('pañolero') || profile.includes('panolero')) counts.panolero++;
                else if (profile.includes('docente')) counts.docente++;
            });
        });

        return counts;
    };

    const counts = parseProfilesCount();

    // Save configurations
    const handleSaveConfig = (e) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMsg('');
        setErrorMsg('');

        try {
            localStorage.setItem('etrr-cfp-name', cfpName);
            localStorage.setItem('etrr-cfp-year', cfpYear);
            
            // Trigger customized global event to notify headers (if any)
            window.dispatchEvent(new Event('etrr-config-updated'));

            setSuccessMsg('Configuraciones guardadas con éxito.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setErrorMsg('Ocurrió un error al guardar localmente.');
        } finally {
            setLoading(false);
        }
    };

    // Clean local mock coordination tasks
    const handleResetDemoState = () => {
        if (confirm('¿Estás seguro de que quieres limpiar las tareas guardadas del Modo Demostración de Coordinación? Se restaurarán los datos iniciales predeterminados.')) {
            localStorage.removeItem('etrr-coordination-topics');
            localStorage.removeItem('etrr-coordination-comments');
            setSuccessMsg('Datos demostrativos de Coordinación restablecidos correctamente.');
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    // Scan for duplicate red cards
    const scanDuplicates = async () => {
        setScanning(true);
        setDupCount(0);
        setDupsList([]);
        setScanResultMsg('');
        try {
            const { data, error } = await supabase
                .from('red_cards')
                .select('id, sector, element, problem_description, placed_by, date, card_number');
            if (error) throw error;

            const groups = {};
            const duplicatesToDelete = [];

            (data || []).forEach(card => {
                const sectorNorm = (card.sector || '').trim().toLowerCase();
                const elementNorm = (card.element || '').trim().toLowerCase();
                const probNorm = (card.problem_description || '').trim().toLowerCase();
                const placedNorm = (card.placed_by || '').trim().toLowerCase();
                const dateNorm = card.date ? new Date(card.date).toDateString() : '';

                const key = `${sectorNorm}|${elementNorm}|${probNorm}|${placedNorm}|${dateNorm}`;

                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(card);
            });

            let totalDups = 0;
            Object.keys(groups).forEach(key => {
                const group = groups[key];
                if (group.length > 1) {
                    const [keep, ...duplicates] = group;
                    totalDups += duplicates.length;
                    duplicates.forEach(d => {
                        duplicatesToDelete.push(d.id);
                    });
                }
            });

            setDupCount(totalDups);
            setDupsList(duplicatesToDelete);
            
            if (totalDups === 0) {
                setScanResultMsg('No se encontraron tarjetas rojas duplicadas.');
            } else {
                setScanResultMsg(`Se encontraron ${totalDups} tarjetas duplicadas (idénticas en sector, elemento, descripción y fecha).`);
            }
        } catch (err) {
            console.error("Error scanning duplicates:", err);
            setErrorMsg('Error al escanear duplicados en la base de datos.');
        } finally {
            setScanning(false);
        }
    };

    // Purge duplicate red cards
    const purgeDuplicates = async () => {
        if (dupsList.length === 0) return;
        if (!confirm(`¿Estás seguro de que quieres eliminar permanentemente las ${dupCount} tarjetas duplicadas detectadas? Se conservará únicamente una copia original de cada una.`)) return;
        
        setPurging(true);
        setSuccessMsg('');
        setErrorMsg('');
        try {
            const chunkSize = 50;
            let deletedCount = 0;
            for (let i = 0; i < dupsList.length; i += chunkSize) {
                const chunk = dupsList.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from('red_cards')
                    .delete()
                    .in('id', chunk);
                if (error) throw error;
                deletedCount += chunk.length;
            }

            setSuccessMsg(`¡Depuración completada! Se eliminaron ${deletedCount} tarjetas duplicadas con éxito.`);
            setTimeout(() => setSuccessMsg(''), 4000);
            setDupCount(0);
            setDupsList([]);
            setScanResultMsg('');
        } catch (err) {
            console.error("Error purging duplicates:", err);
            setErrorMsg('Ocurrió un error al intentar purgar las tarjetas duplicadas.');
        } finally {
            setPurging(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-1.5 md:flex-row md:justify-between md:items-center border-b border-color/40 pb-5">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                        <Sliders className="text-primary animate-pulse" size={24} />
                        {role === 'docente' ? 'Configuración de Usuario' : 'Configuración Global del Sistema'}
                    </h1>
                    <p className="text-xs text-secondary">
                        {role === 'docente' 
                            ? 'Administra tus preferencias visuales de visualización para la plataforma.' 
                            : 'Administra el comportamiento visual, variables de la escuela y visualiza estadísticas generales.'}
                    </p>
                </div>
            </div>

            {successMsg && (
                <div className="bg-success/10 border-l-4 border-success text-success text-sm px-4 py-3.5 rounded-r-2xl flex items-center gap-3 animate-fade-in-up">
                    <Check size={16} className="shrink-0" />
                    <span className="font-semibold">{successMsg}</span>
                </div>
            )}

            {errorMsg && (
                <div className="bg-error/10 border-l-4 border-error text-error text-sm px-4 py-3.5 rounded-r-2xl flex items-center gap-3 animate-fade-in-up">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span className="font-semibold">{errorMsg}</span>
                </div>
            )}

            <div className={role === 'docente' ? "grid grid-cols-1 max-w-md mx-auto gap-6" : "grid grid-cols-1 md:grid-cols-3 gap-6"}>
                
                {/* 1. Visual Theme Settings */}
                <div className="glass-card p-6 border border-color/60 rounded-2xl bg-surface/40 shadow-sm space-y-4 flex flex-col justify-between col-span-1">
                    <div className="space-y-1">
                        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                            {theme === 'light' ? <Sun className="text-amber-500 animate-spin-slow" size={18} /> : <Moon className="text-primary animate-bounce-slow" size={18} />}
                            Preferencia Visual (Tema)
                        </h2>
                        <p className="text-[10px] text-tertiary">Elige tu modo visual de preferencia. Se guardará de forma persistente en tu navegador.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-main/50 border border-color rounded-2xl relative shadow-inner">
                        {/* Light Mode Switch */}
                        <button
                            type="button"
                            onClick={() => handleThemeToggle('light')}
                            className={`flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                theme === 'light' 
                                    ? 'bg-white text-slate-800 shadow-md scale-100 border border-slate-200' 
                                    : 'text-secondary hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Sun size={15} className={theme === 'light' ? 'text-amber-500' : ''} />
                            Claro
                        </button>

                        {/* Dark Mode Switch */}
                        <button
                            type="button"
                            onClick={() => handleThemeToggle('dark')}
                            className={`flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                theme === 'dark' 
                                    ? 'bg-slate-800 text-white shadow-md border border-slate-700' 
                                    : 'text-secondary hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Moon size={15} className={theme === 'dark' ? 'text-indigo-400' : ''} />
                            Oscuro
                        </button>
                    </div>
                    
                    <div className="bg-main/30 border border-color/40 p-3 rounded-xl text-[10px] text-tertiary leading-normal">
                        <strong>Nota:</strong> El modo oscuro aplica una paleta azul marino profunda de alto contraste para disminuir la fatiga visual en entornos nocturnos.
                    </div>
                </div>

                {/* 2. Institutional Metadata Settings */}
                {role !== 'docente' && (
                    <form onSubmit={handleSaveConfig} className="glass-card p-6 border border-color/60 rounded-2xl bg-surface/40 shadow-sm md:col-span-2 space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Building2 className="text-primary" size={18} />
                                Datos del Nodo Tecnológico
                            </h2>
                            <p className="text-[10px] text-tertiary">Configura las variables institucionales para reportes y cabeceras del sistema.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold mb-1.5 block text-secondary">Nombre de la Institución</label>
                                <input
                                    type="text"
                                    required
                                    value={cfpName}
                                    onChange={e => setCfpName(e.target.value)}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full py-2.5 px-3 rounded-xl focus:ring-1 focus:ring-accent outline-none text-xs"
                                    placeholder="Ej: Nodo Tecnológico Roberto Rocca"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-1.5 block text-secondary">Año Lectivo Activo</label>
                                <input
                                    type="text"
                                    required
                                    value={cfpYear}
                                    onChange={e => setCfpYear(e.target.value)}
                                    className="bg-main border-color/50 text-[var(--text-primary)] w-full py-2.5 px-3 rounded-xl focus:ring-1 focus:ring-accent outline-none text-xs"
                                    placeholder="Ej: 2026"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-color/30">
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary px-5 py-2.5 text-xs font-black shadow-md shadow-primary/10 transition-all hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                            >
                                <Save size={14} />
                                {loading ? 'Guardando...' : 'Guardar Datos'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {role !== 'docente' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* 3. Dynamic Institutional Staff Stats */}
                    <div className="glass-card p-6 border border-color/60 rounded-2xl bg-surface/40 shadow-sm md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Users className="text-primary" size={18} />
                                    Resumen Ejecutivo de Personal
                                </h2>
                                <p className="text-[10px] text-tertiary">Conteo dinámico de perfiles y roles registrados actualmente en el Nodo Tecnológico de la escuela.</p>
                            </div>
                            <button
                                onClick={fetchStaffStats}
                                className="p-2 rounded-xl hover:bg-surface-hover border border-color/40 text-secondary transition-all hover:scale-105 shrink-0 cursor-pointer"
                                title="Refrescar estadísticas"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {/* Coordinadores */}
                            <div className="bg-main/40 border border-color/50 p-3.5 rounded-2xl text-center space-y-1 hover:border-accent/40 transition-colors shadow-sm">
                                <span className="text-[10px] font-bold text-tertiary block">Coordinadores</span>
                                <span className="text-2xl font-black text-primary block">{counts.coordinador}</span>
                            </div>

                            {/* Gerente Técnico */}
                            <div className="bg-main/40 border border-color/50 p-3.5 rounded-2xl text-center space-y-1 hover:border-accent/40 transition-colors shadow-sm">
                                <span className="text-[10px] font-bold text-tertiary block">Gerente Técnico</span>
                                <span className="text-2xl font-black text-accent block">{counts.gerente}</span>
                            </div>

                            {/* Especialistas */}
                            <div className="bg-main/40 border border-color/50 p-3.5 rounded-2xl text-center space-y-1 hover:border-accent/40 transition-colors shadow-sm">
                                <span className="text-[10px] font-bold text-tertiary block">Especialistas</span>
                                <span className="text-2xl font-black text-amber-500 block">{counts.especialista}</span>
                            </div>

                            {/* Pañoleros */}
                            <div className="bg-main/40 border border-color/50 p-3.5 rounded-2xl text-center space-y-1 hover:border-accent/40 transition-colors shadow-sm">
                                <span className="text-[10px] font-bold text-tertiary block">Pañoleros</span>
                                <span className="text-2xl font-black text-cyan-500 block">{counts.panolero}</span>
                            </div>

                            {/* Docentes Comunes */}
                            <div className="bg-main/40 border border-color/50 p-3.5 rounded-2xl text-center space-y-1 hover:border-accent/40 transition-colors shadow-sm col-span-2 sm:col-span-1">
                                <span className="text-[10px] font-bold text-tertiary block">Docentes</span>
                                <span className="text-2xl font-black text-emerald-500 block">{counts.docente}</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Advanced/System Tools Settings */}
                    <div className="glass-card p-6 border border-color/60 rounded-2xl bg-surface/40 shadow-sm space-y-4 flex flex-col justify-between">
                        <div className="space-y-1">
                            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Shield className="text-error" size={18} />
                                Herramientas del Sistema
                            </h2>
                            <p className="text-[10px] text-tertiary">Acciones de mantenimiento de datos y soporte.</p>
                        </div>

                        <div className="space-y-3">
                            {/* Demo Clean */}
                            <div>
                                <span className="text-[10px] font-bold text-secondary uppercase block mb-1">Mantenimiento de Demo</span>
                                <button
                                    type="button"
                                    onClick={handleResetDemoState}
                                    className="w-full py-2.5 px-4 bg-error/10 hover:bg-error/20 border border-error/20 text-error text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <RefreshCw size={13} />
                                    Limpiar Tareas de Demo
                                </button>
                            </div>

                            <div className="border-t border-color/40 my-2 pt-2"></div>

                            {/* Duplicates Tools */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-secondary uppercase block">Depuración de Duplicados</span>
                                
                                <button
                                    type="button"
                                    onClick={scanDuplicates}
                                    disabled={scanning || purging}
                                    className="w-full py-2.5 px-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <Shield size={13} className={scanning ? 'animate-spin' : ''} />
                                    {scanning ? 'Escaneando...' : 'Escanear Duplicados 5S'}
                                </button>

                                {scanResultMsg && (
                                    <div className="text-[10px] bg-main/40 border border-color/40 p-2.5 rounded-xl text-secondary text-center font-medium leading-tight">
                                        {scanResultMsg}
                                    </div>
                                )}

                                {dupCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={purgeDuplicates}
                                        disabled={purging}
                                        className="w-full py-2.5 px-4 bg-error text-white font-black rounded-xl hover:bg-error-hover transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-error/10"
                                    >
                                        <Trash2 size={13} className={purging ? 'animate-bounce' : ''} />
                                        {purging ? 'Purgando...' : `Purgar ${dupCount} Duplicados`}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-main/30 border border-color/40 p-3.5 rounded-xl flex items-start gap-2 text-[9px] text-tertiary leading-normal">
                            <Shield className="text-tertiary mt-0.5 shrink-0" size={12} />
                            <span>El acceso a estas configuraciones avanzadas está restringido a nivel de interfaz de usuario.</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
