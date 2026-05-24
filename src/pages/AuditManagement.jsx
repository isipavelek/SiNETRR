import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
    BarChart2, Plus, Calendar, User, Clipboard, 
    Check, AlertTriangle, AlertCircle, X, ChevronRight, CheckCircle, HelpCircle
} from 'lucide-react';
import { createNotification } from '../lib/notificationsHelper';

const S_DESCRIPTIONS = [
    {
        name: 'Seiri (Clasificación)',
        description: 'Separar lo innecesario de lo necesario. Descartar herramientas rotas, insumos vencidos o cosas inútiles en el sector.',
        keyword: 'Clasificación'
    },
    {
        name: 'Seiton (Orden)',
        description: 'Un lugar para cada cosa y cada cosa en su lugar. Identificar y etiquetar claramente dónde va cada herramienta e insumo.',
        keyword: 'Orden'
    },
    {
        name: 'Seiso (Limpieza)',
        description: 'Mantener limpio el espacio de trabajo y las máquinas. Identificar fuentes de suciedad para eliminarlas proactivamente.',
        keyword: 'Limpieza'
    },
    {
        name: 'Seiketsu (Estandarización)',
        description: 'Establecer normas y reglas visuales claras de orden y limpieza. Todo el personal conoce las reglas básicas del taller.',
        keyword: 'Estandarización'
    },
    {
        name: 'Shitsuke (Disciplina)',
        description: 'Convertir en hábito los estándares establecidos. Realizar auditorías constantes y respetar las normas de seguridad del Nodo.',
        keyword: 'Disciplina'
    }
];

export default function AuditManagement() {
    const { role, userProfile } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState('historial'); // 'historial' | 'nueva'
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState(null);

    // Form state
    const [sector, setSector] = useState('');
    const [scores, setScores] = useState({ seiri: 5, seiton: 5, seiso: 5, seiketsu: 5, shitsuke: 5 });
    const [observations, setObservations] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const sectorsList = [
        'Taller Mecánica',
        'Taller Electrónica',
        'Pañol de Herramientas',
        'Laboratorio de Computación',
        'Aulas del Nodo',
        'Oficina de Coordinación'
    ];

    const getDefaultAudits = () => [
        {
            id: 'mock-audit-1',
            sector: 'Taller Mecánica',
            auditor_name: 'Alejandro Tombesi',
            score_seiri: 4,
            score_seiton: 3,
            score_seiso: 5,
            score_seiketsu: 4,
            score_shitsuke: 4,
            observations: 'Buen orden en general, se limpiaron los tornos y la viruta. Faltan etiquetar algunos cajones de llaves combinadas.',
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'mock-audit-2',
            sector: 'Pañol de Herramientas',
            auditor_name: 'Laureano Bolzan',
            score_seiri: 5,
            score_seiton: 5,
            score_seiso: 4,
            score_seiketsu: 5,
            score_shitsuke: 4,
            observations: 'Excelente gestión de pañol. El nuevo pañolero mantiene las herramientas ordenadas perfectamente según las directrices 5S.',
            created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'mock-audit-3',
            sector: 'Taller Electrónica',
            auditor_name: 'Gonzalo Bermudez',
            score_seiri: 3,
            score_seiton: 2,
            score_seiso: 4,
            score_seiketsu: 3,
            score_shitsuke: 3,
            observations: 'Se encontraron soldadores enchufados sin supervisión y cables de estaño tirados en el suelo. Requiere atención inmediata.',
            created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];

    const loadAudits = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('audit_sessions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // If no Supabase audits exist, fallback to local storage / defaults
            if (!data || data.length === 0) {
                loadLocalAudits();
            } else {
                // Fetch auditor names (we will query user profiles dynamically or match them)
                const enhanced = await Promise.all(data.map(async (audit) => {
                    let auditorName = 'Auditor del Nodo';
                    try {
                        const { data: prof } = await supabase
                            .from('user_profiles')
                            .select('first_name, last_name')
                            .eq('id', audit.auditor_id)
                            .single();
                        if (prof) auditorName = `${prof.first_name} ${prof.last_name}`;
                    } catch (e) {}
                    return { ...audit, auditor_name: auditorName };
                }));
                setAudits(enhanced);
            }
        } catch (err) {
            loadLocalAudits();
        } finally {
            setLoading(false);
        }
    };

    const loadLocalAudits = () => {
        const local = JSON.parse(localStorage.getItem('etrr-audits') || '[]');
        if (local.length === 0) {
            const defaults = getDefaultAudits();
            localStorage.setItem('etrr-audits', JSON.stringify(defaults));
            setAudits(defaults);
        } else {
            setAudits(local);
        }
    };

    useEffect(() => {
        loadAudits();
    }, []);

    const handleScoreChange = (key, value) => {
        setScores(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmitAudit = async (e) => {
        e.preventDefault();
        if (!sector) {
            setErrorMsg('Por favor seleccione un sector para la auditoría.');
            return;
        }

        setSaving(true);
        setErrorMsg('');
        setSuccessMsg('');

        const auditorId = userProfile?.id || '95c78188-52a3-484c-807a-8e1e2079b76e';
        const auditorName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Israel Pavelek';

        const auditData = {
            sector,
            auditor_id: auditorId,
            score_seiri: scores.seiri,
            score_seiton: scores.seiton,
            score_seiso: scores.seiso,
            score_seiketsu: scores.seiketsu,
            score_shitsuke: scores.shitsuke,
            observations,
            created_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from('audit_sessions')
                .insert([auditData]);

            if (error) throw error;
            
            setSuccessMsg(`¡Auditoría de "${sector}" guardada con éxito!`);
            
            // Trigger system alerts if low scores exist
            triggerAuditAlerts(auditData);

            await loadAudits();
            resetForm();
            setTimeout(() => setActiveSubTab('historial'), 2000);

        } catch (err) {
            // Local Storage fallback
            const local = JSON.parse(localStorage.getItem('etrr-audits') || '[]');
            const completeAudit = {
                id: `local-audit-${Date.now()}`,
                auditor_name: auditorName,
                ...auditData
            };
            const updated = [completeAudit, ...local];
            localStorage.setItem('etrr-audits', JSON.stringify(updated));
            setAudits(updated);
            
            setSuccessMsg(`¡Auditoría de "${sector}" guardada localmente con éxito (Modo Demo)!`);
            triggerAuditAlerts(completeAudit);
            resetForm();
            setTimeout(() => setActiveSubTab('historial'), 2000);
        } finally {
            setSaving(false);
        }
    };

    const triggerAuditAlerts = (audit) => {
        const categoriesWithLowScores = [];
        if (audit.score_seiri < 3) categoriesWithLowScores.push('Clasificación (Seiri)');
        if (audit.score_seiton < 3) categoriesWithLowScores.push('Orden (Seiton)');
        if (audit.score_seiso < 3) categoriesWithLowScores.push('Limpieza (Seiso)');
        if (audit.score_seiketsu < 3) categoriesWithLowScores.push('Estandarización (Seiketsu)');
        if (audit.score_shitsuke < 3) categoriesWithLowScores.push('Disciplina (Shitsuke)');

        if (categoriesWithLowScores.length > 0) {
            createNotification(
                null,
                '⚠️ Puntuación 5S Baja en Auditoría',
                `La auditoría en "${audit.sector}" registró bajas puntuaciones en: ${categoriesWithLowScores.join(', ')}. Observaciones: "${audit.observations?.substring(0, 50)}..."`,
                'red_card'
            );
        } else {
            createNotification(
                null,
                '📋 Nueva Auditoría 5S Realizada',
                `Se completó la auditoría del sector "${audit.sector}" con excelentes puntuaciones generales.`,
                'system'
            );
        }
    };

    const resetForm = () => {
        setSector('');
        setScores({ seiri: 5, seiton: 5, seiso: 5, seiketsu: 5, shitsuke: 5 });
        setObservations('');
    };

    // Dynamic Red Card Creator
    const handleQuickRedCard = async (lowCategory, score) => {
        if (!selectedAudit) return;
        const auditorName = selectedAudit.auditor_name || 'Israel Pavelek';
        
        const confirmCreate = window.confirm(
            `¿Desea crear automáticamente una Tarjeta Roja para el sector "${selectedAudit.sector}" debido a la baja puntuación (${score}/5) en "${lowCategory}"?`
        );

        if (!confirmCreate) return;

        const redCardData = {
            card_number: `RC-AUD-${Math.floor(1000 + Math.random() * 9000)}`,
            date: new Date().toISOString().split('T')[0],
            placed_by: auditorName,
            sector: selectedAudit.sector,
            element: lowCategory,
            problem_description: `Anomalía detectada en Auditoría 5S. Puntuación baja (${score}/5). Observación de auditoría: "${selectedAudit.observations || ''}"`,
            suggestion_type: 'Acción Correctiva Inmediata',
            explicit_suggestion: 'Adecuar el sector según las pautas de orden, clasificación y limpieza institucionales.',
            status: 'Pendiente'
        };

        try {
            const { error } = await supabase
                .from('red_cards')
                .insert([redCardData]);
            
            if (error) throw error;
            
            alert('¡Tarjeta Roja proactiva creada con éxito en el sistema!');
            
            // Notify
            await createNotification(
                null,
                '🚨 Tarjeta Roja Proactiva Creada',
                `Se abrió una tarjeta roja automática para "${selectedAudit.sector}" por fallas en la auditoría de "${lowCategory}".`,
                'red_card'
            );
        } catch (e) {
            // Local fallback
            const localRCs = JSON.parse(localStorage.getItem('etrr-red-cards') || '[]');
            localRCs.unshift({ id: `local-rc-${Date.now()}`, ...redCardData });
            localStorage.setItem('etrr-red-cards', JSON.stringify(localRCs));

            // Notify
            await createNotification(
                null,
                '🚨 Tarjeta Roja Proactiva Creada (Local)',
                `Se abrió una tarjeta roja automática para "${selectedAudit.sector}" por fallas en la auditoría de "${lowCategory}".`,
                'red_card'
            );
            alert('¡Tarjeta Roja proactiva creada y guardada localmente con éxito (Modo Demo)!');
        }
    };

    // CUSTOM SVG RADAR CHART COMPONENT (NATIVE VECTORS)
    const renderRadarChart = (audit) => {
        const cx = 150;
        const cy = 150;
        const radius = 100;

        const keys = ['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'];
        const labels = ['Seiri (Clasificar)', 'Seiton (Ordenar)', 'Seiso (Limpiar)', 'Seiketsu (Estandarizar)', 'Shitsuke (Disciplina)'];
        
        // 5 axes: 360 / 5 = 72 deg spacing
        const angles = [
            -Math.PI / 2, // Up
            -Math.PI / 2 + (2 * Math.PI) / 5,
            -Math.PI / 2 + (4 * Math.PI) / 5,
            -Math.PI / 2 + (6 * Math.PI) / 5,
            -Math.PI / 2 + (8 * Math.PI) / 5
        ];

        // Draw background Concentric Polygons (Grid)
        const grids = [0.2, 0.4, 0.6, 0.8, 1.0];
        const gridPolygons = grids.map((fraction) => {
            const points = angles.map((angle) => {
                const r = radius * fraction;
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                return `${x},${y}`;
            }).join(' ');
            return (
                <polygon 
                    key={fraction} 
                    points={points} 
                    fill="none" 
                    stroke="var(--text-tertiary)" 
                    strokeWidth="0.5" 
                    strokeDasharray="2,2" 
                    opacity="0.5"
                />
            );
        });

        // Draw Axis Lines
        const axisLines = angles.map((angle, i) => {
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            return (
                <g key={i}>
                    <line 
                        x1={cx} 
                        y1={cy} 
                        x2={x} 
                        y2={y} 
                        stroke="var(--text-tertiary)" 
                        strokeWidth="0.7" 
                        opacity="0.6"
                    />
                    {/* Axis Labels */}
                    <text
                        x={cx + (radius + 20) * Math.cos(angle)}
                        y={cy + (radius + 15) * Math.sin(angle)}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className="text-[9px] font-black text-secondary select-none fill-current"
                    >
                        {labels[i]}
                    </text>
                </g>
            );
        });

        // Compute Audit Area Polygon
        const scoresValues = [
            audit.score_seiri || 5,
            audit.score_seiton || 5,
            audit.score_seiso || 5,
            audit.score_seiketsu || 5,
            audit.score_shitsuke || 5
        ];

        const auditPoints = angles.map((angle, i) => {
            const fraction = scoresValues[i] / 5;
            const r = radius * fraction;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');

        // Individual Vertex Dots
        const vertexDots = angles.map((angle, i) => {
            const fraction = scoresValues[i] / 5;
            const r = radius * fraction;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            return (
                <g key={i}>
                    <circle 
                        cx={x} 
                        cy={y} 
                        r="4" 
                        fill="var(--color-primary)" 
                        stroke="var(--surface)" 
                        strokeWidth="1.5"
                        className="shadow-sm filter drop-shadow"
                    />
                    {/* Small number badge on dot */}
                    <text
                        x={x}
                        y={y - 8}
                        textAnchor="middle"
                        className="text-[8px] font-black text-primary fill-current"
                    >
                        {scoresValues[i]}
                    </text>
                </g>
            );
        });

        return (
            <svg 
                viewBox="0 0 300 300" 
                className="w-full max-w-[280px] sm:max-w-[320px] mx-auto animate-fade-in"
            >
                {/* Background grids */}
                {gridPolygons}
                {/* Axis lines */}
                {axisLines}
                {/* Audit filled score shape */}
                <polygon 
                    points={auditPoints} 
                    fill="var(--color-primary)" 
                    fillOpacity="0.25" 
                    stroke="var(--color-primary)" 
                    strokeWidth="2.5"
                    className="transition-all duration-300"
                />
                {/* Vertex Dots */}
                {vertexDots}
                {/* Center dot */}
                <circle cx={cx} cy={cy} r="3" fill="var(--text-tertiary)" opacity="0.5" />
            </svg>
        );
    };

    const getScoreAverage = (audit) => {
        const sum = 
            (audit.score_seiri || 0) + 
            (audit.score_seiton || 0) + 
            (audit.score_seiso || 0) + 
            (audit.score_seiketsu || 0) + 
            (audit.score_shitsuke || 0);
        return (sum / 5).toFixed(1);
    };

    const getScoreColor = (average) => {
        if (average >= 4.5) return 'text-primary';
        if (average >= 3.5) return 'text-accent';
        if (average >= 2.5) return 'text-warning';
        return 'text-error';
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <header className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <BarChart2 size={22} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">Auditorías 5S</h2>
                        <p className="text-secondary font-medium">Control de orden, limpieza y disciplina del Nodo Tecnológico.</p>
                    </div>
                </div>
            </header>

            {/* Sub-navigation tabs */}
            <div className="flex border-b border-color">
                <button
                    onClick={() => { setActiveSubTab('historial'); setSelectedAudit(null); }}
                    className={`pb-3 px-6 text-sm font-black transition-all relative cursor-pointer ${
                        activeSubTab === 'historial' 
                            ? 'text-primary' 
                            : 'text-secondary hover:text-[var(--text-primary)]'
                    }`}
                >
                    {activeSubTab === 'historial' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.75 bg-primary rounded-t-full shadow-[0_0_8px_var(--color-primary)]"></span>
                    )}
                    Historial de Auditorías
                </button>
                <button
                    onClick={() => setActiveSubTab('nueva')}
                    className={`pb-3 px-6 text-sm font-black transition-all relative cursor-pointer ${
                        activeSubTab === 'nueva' 
                            ? 'text-primary' 
                            : 'text-secondary hover:text-[var(--text-primary)]'
                    }`}
                >
                    {activeSubTab === 'nueva' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.75 bg-primary rounded-t-full shadow-[0_0_8px_var(--color-primary)]"></span>
                    )}
                    Nueva Auditoría
                </button>
            </div>

            {/* HISTORIAL SUB-TAB */}
            {activeSubTab === 'historial' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left List Pane */}
                    <div className="lg:col-span-2 space-y-4">
                        {loading ? (
                            <div className="p-8 text-center text-secondary">Cargando historial de auditorías...</div>
                        ) : audits.length === 0 ? (
                            <div className="glass-card p-12 text-center text-secondary flex flex-col items-center justify-center">
                                <Clipboard size={40} className="text-tertiary mb-3" />
                                <p className="font-extrabold text-sm mb-1">Sin auditorías cargadas</p>
                                <p className="text-xs text-tertiary">Comienza presionando la pestaña "Nueva Auditoría" arriba.</p>
                            </div>
                        ) : (
                            audits.map((audit) => {
                                const average = getScoreAverage(audit);
                                return (
                                    <div
                                        key={audit.id}
                                        onClick={() => setSelectedAudit(audit)}
                                        className={`glass-card p-5 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                                            selectedAudit?.id === audit.id 
                                                ? 'border-l-primary bg-primary/[0.02] shadow-md' 
                                                : 'border-l-transparent hover:border-l-primary/30 hover:bg-surface-hover/10'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <h4 className="font-extrabold text-base text-[var(--text-primary)] mb-1.5 flex items-center gap-2">
                                                {audit.sector}
                                                <span className="text-[10px] text-tertiary font-mono">
                                                    #{audit.id.substring(0, 6)}
                                                </span>
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-tertiary font-medium">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={13} />
                                                    {new Date(audit.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <User size={13} />
                                                    {audit.auditor_name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <div className={`text-2xl font-black ${getScoreColor(average)} leading-none`}>
                                                    {average}
                                                </div>
                                                <div className="text-[9px] text-tertiary font-extrabold uppercase mt-1">Promedio 5S</div>
                                            </div>
                                            <ChevronRight size={18} className="text-tertiary" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Right Details / Radar Pane */}
                    <div className="lg:col-span-1">
                        {selectedAudit ? (
                            <div className="glass-card p-6 space-y-6 relative overflow-hidden">
                                <header className="pb-4 border-b border-color flex justify-between items-start">
                                    <div>
                                        <h3 className="font-black text-lg text-[var(--text-primary)]">{selectedAudit.sector}</h3>
                                        <p className="text-xs text-tertiary font-bold mt-0.5">Auditor: {selectedAudit.auditor_name}</p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedAudit(null)}
                                        className="p-1 rounded-lg text-secondary hover:bg-surface-hover transition-all cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </header>

                                {/* Radar Chart Render */}
                                <div className="py-2 flex items-center justify-center bg-surface-hover/20 rounded-2xl border border-color/40">
                                    {renderRadarChart(selectedAudit)}
                                </div>

                                {/* Score list breakdown with potential red card generator */}
                                <div className="space-y-3.5">
                                    <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-0.5">Desglose de Puntuación</h4>
                                    
                                    {[
                                        { key: 'seiri', label: '1. Seiri (Clasificación)', score: selectedAudit.score_seiri },
                                        { key: 'seiton', label: '2. Seiton (Orden)', score: selectedAudit.score_seiton },
                                        { key: 'seiso', label: '3. Seiso (Limpieza)', score: selectedAudit.score_seiso },
                                        { key: 'seiketsu', label: '4. Seiketsu (Estandarizar)', score: selectedAudit.score_seiketsu },
                                        { key: 'shitsuke', label: '5. Shitsuke (Disciplina)', score: selectedAudit.score_shitsuke }
                                    ].map((item) => (
                                        <div key={item.key} className="p-3 bg-surface-hover/40 rounded-xl border border-color/30 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-secondary">{item.label}</span>
                                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                    item.score >= 4 ? 'bg-primary/10 text-primary' : item.score >= 3 ? 'bg-accent/10 text-accent' : 'bg-error/10 text-error'
                                                }`}>
                                                    {item.score} / 5
                                                </span>
                                            </div>
                                            {item.score < 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickRedCard(item.label, item.score)}
                                                    className="py-1 px-2.5 bg-error/15 hover:bg-error/25 border border-error/20 text-error font-black text-[10px] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer self-start"
                                                >
                                                    <AlertTriangle size={11} />
                                                    Crear Tarjeta Roja Proactiva
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Observations */}
                                {selectedAudit.observations && (
                                    <div className="pt-4 border-t border-color">
                                        <h5 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1.5">Observaciones Generales</h5>
                                        <p className="text-xs text-secondary leading-relaxed font-medium bg-main/5 p-3 rounded-xl border border-color/40 italic">
                                            "{selectedAudit.observations}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="glass-card p-8 text-center text-secondary h-full flex flex-col items-center justify-center opacity-70">
                                <Clipboard size={36} className="text-tertiary mb-2.5 animate-pulse" />
                                <p className="font-extrabold text-xs">Detalle de Auditoría</p>
                                <p className="text-[11px] text-tertiary mt-1">Selecciona una auditoría del historial de la izquierda para ver su gráfico de radar 5S interactivo.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* NUEVA AUDITORÍA SUB-TAB */}
            {activeSubTab === 'nueva' && (
                <div className="glass-card max-w-3xl mx-auto p-6 md:p-8">
                    <header className="mb-6 pb-4 border-b border-color flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-[var(--text-primary)]">Formulario de Auditoría</h3>
                            <p className="text-xs text-secondary font-medium">Califica objetivamente el estado físico del sector seleccionado.</p>
                        </div>
                        <HelpCircle size={20} className="text-tertiary cursor-help" title="Una puntuación menor a 3 habilitará alertas de tarjetas rojas automáticas." />
                    </header>

                    {successMsg && (
                        <div className="p-4 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center gap-2.5 mb-6 text-sm font-bold animate-fade-in">
                            <CheckCircle size={18} />
                            {successMsg}
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-4 bg-error/10 border border-error/20 text-error rounded-xl flex items-center gap-2.5 mb-6 text-sm font-bold animate-fade-in">
                            <AlertCircle size={18} />
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmitAudit} className="space-y-6">
                        {/* Sector selector */}
                        <div>
                            <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-2">Sector / Taller a Auditar</label>
                            <select
                                required
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-main/5 border border-color hover:border-color-hover focus:border-primary focus:bg-surface transition-all text-sm font-semibold outline-none"
                            >
                                <option value="">-- Seleccionar Sector --</option>
                                {sectorsList.map((sec) => (
                                    <option key={sec} value={sec}>{sec}</option>
                                ))}
                            </select>
                        </div>

                        {/* 5S Scoring checklists */}
                        <div className="space-y-6 pt-2">
                            <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-0.5 border-b border-color/40 pb-2">Puntuación de las 5 "S"</h4>

                            {[
                                { key: 'seiri', label: S_DESCRIPTIONS[0].name, desc: S_DESCRIPTIONS[0].description },
                                { key: 'seiton', label: S_DESCRIPTIONS[1].name, desc: S_DESCRIPTIONS[1].description },
                                { key: 'seiso', label: S_DESCRIPTIONS[2].name, desc: S_DESCRIPTIONS[2].description },
                                { key: 'seiketsu', label: S_DESCRIPTIONS[3].name, desc: S_DESCRIPTIONS[3].description },
                                { key: 'shitsuke', label: S_DESCRIPTIONS[4].name, desc: S_DESCRIPTIONS[4].description }
                            ].map((sItem) => (
                                <div key={sItem.key} className="p-4 bg-surface-hover/30 rounded-2xl border border-color/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1 max-w-md">
                                        <h5 className="font-extrabold text-sm text-[var(--text-primary)]">{sItem.label}</h5>
                                        <p className="text-[11px] text-secondary leading-relaxed font-medium">{sItem.desc}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {[1, 2, 3, 4, 5].map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => handleScoreChange(sItem.key, val)}
                                                className={`w-9 h-9 rounded-full font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                                                    scores[sItem.key] === val
                                                        ? 'bg-primary text-white shadow-md shadow-primary/20 scale-110'
                                                        : 'bg-surface border border-color hover:border-color-hover text-secondary hover:text-[var(--text-primary)]'
                                                }`}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* General Observations */}
                        <div>
                            <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-2">Observaciones y Hallazgos</label>
                            <textarea
                                rows={3}
                                placeholder="Escribe aquí los comentarios sobre el orden, la limpieza o qué falta adecuar..."
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-main/5 border border-color hover:border-color-hover focus:border-primary focus:bg-surface transition-all text-sm font-semibold outline-none resize-none"
                            />
                        </div>

                        {/* Submit Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-color">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="py-2.5 px-4 bg-surface-hover hover:bg-surface text-secondary font-black rounded-xl border border-color transition-all text-sm cursor-pointer"
                            >
                                Reestablecer
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="py-2.5 px-5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all text-sm cursor-pointer shadow-md shadow-primary/10 flex items-center gap-2"
                            >
                                <Check size={16} />
                                {saving ? 'Guardando...' : 'Guardar Auditoría'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
