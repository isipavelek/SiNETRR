import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
    BarChart2, Plus, Calendar, User, Clipboard, 
    Check, AlertTriangle, AlertCircle, X, ChevronRight, CheckCircle, HelpCircle,
    ChevronDown, ChevronUp, Star
} from 'lucide-react';
import { createNotification } from '../lib/notificationsHelper';

const AUDIT_QUESTIONS = {
    seiri: {
        name: 'Seiri (Clasificación)',
        description: 'Separar lo innecesario de lo necesario. Descartar herramientas rotas, insumos vencidos o cosas inútiles en el sector.',
        keyword: 'Clasificación',
        key: 'seiri',
        items: [
            { id: 1, name: "Componentes, materiales y partes", desc: "Se encuentran los niveles necesarios de materiales/elementos. Residuos y elementos sin uso están en contenedores claramente identificados." },
            { id: 2, name: "Máquinas, gabinetes, muebles, bancos, escritorios", desc: "Solo los elementos necesarios están en uso y se encuentran operables. No hay elementos rotos que deban ser descartados o reparados." },
            { id: 3, name: "Herramientas y equipos", desc: "Todas las herramientas necesarias están en uso y operables. Hay cosas innecesarias en los armarios." },
            { id: 4, name: "Cartelera / Información", desc: "¿Los registros de actividad con tarjetas rojas y hallazgos están actualizados?" },
            { id: 5, name: "Ambiente", desc: "Existen objetos innecesarios o basura en el piso. Las áreas de circulación están libres de objetos." }
        ]
    },
    seiton: {
        name: 'Seiton (Orden)',
        description: 'Un lugar para cada cosa y cada cosa en su lugar. Identificar y etiquetar claramente dónde va cada herramienta e insumo.',
        keyword: 'Orden',
        key: 'seiton',
        items: [
            { id: 6, name: "Lay out", desc: "Máquinas, herramientas, estanterías, contenedores están dispuestos de manera lógica y promoviendo un flujo de trabajo ágil y ordenado en el área." },
            { id: 7, name: "Marcado de pasillos y suelos", desc: "Los pasillos y sendas se encuentran marcados y liberados." },
            { id: 8, name: "Documentación y señales visuales", desc: "Se encuentran solo los documentos/carpetas necesarias para el trabajo. Están guardadas, ordenadas y rotuladas." },
            { id: 9, name: "Control visual y almacenamiento", desc: "Los elementos están correctamente identificados. La cartelería es clara, apropiada y prolija." },
            { id: 10, name: "Lugares para herramientas y accesorios", desc: "Herramientas y accesorios son arreglados y guardados en orden, limpios y en un lugar específico de fácil localización." },
            { id: 11, name: "Elementos fuera de lugar", desc: "Hay elementos sin ubicación específica. Obstruyen el orden y limpieza del lugar." },
            { id: 12, name: "Almacenamiento de materiales peligrosos", desc: "Líquidos, solventes y otros químicos se encuentran claramente identificados. Se encuentran disponibles sus hojas de seguridad. No hay derrames." },
            { id: 13, name: "Salidas de emergencia. Elementos de seguridad", desc: "Los elementos de seguridad están visibles y sin obstrucciones. Las rutas de escape y los lugares de peligro están identificados y despejados." },
            { id: 14, name: "Mantenimiento de equipos", desc: "Se llevan registros del mantenimiento de los equipos. Se informan posibles mejoras." }
        ]
    },
    seiso: {
        name: 'Seiso (Limpieza)',
        description: 'Mantener limpio el espacio de trabajo y las máquinas. Identificar fuentes de suciedad para eliminarlas proactivamente.',
        keyword: 'Limpieza',
        key: 'seiso',
        items: [
            { id: 15, name: "Estado de pisos / tachos", desc: "Los pisos están limpios, libres de suciedad, residuos o líquidos. El exterior de los tachos está limpio e identificado." },
            { id: 16, name: "Máquinas / equipos", desc: "Se realiza una rutina de limpieza. No hay tierra, suciedad, residuos entre o en las máquinas o equipos." },
            { id: 17, name: "Elementos de limpieza", desc: "Todo el equipo de limpieza está ubicado en un lugar específico y disponible fácilmente." },
            { id: 18, name: "Limpieza más allá de lo propio", desc: "Todo el área se ve ordenada." },
            { id: 19, name: "Disciplina de limpieza", desc: "Cuando hay tiempo disponible, los alumnos habitualmente y automáticamente ordenan y limpian sus espacios de trabajo." },
            { id: 20, name: "Plan de mejoras", desc: "Donde sea aplicable se implementan nuevas estrategias para evitar la generación de residuos, según principios 5S. Existe un programa con responsables y plazos." }
        ]
    },
    seiketsu: {
        name: 'Seiketsu (Estandarización)',
        description: 'Establecer normas y reglas visuales claras de orden y limpieza. Todo el personal conoce las reglas básicas del taller.',
        keyword: 'Estandarización',
        key: 'seiketsu',
        items: [
            { id: 21, name: "Control visual", desc: "Tableros o sistemas de información digitales son accesibles al personal del área." },
            { id: 22, name: "Auditorías 5S", desc: "Se realizan auditorías de 5S regularmente y los resultados son expuestos y compartidos." },
            { id: 23, name: "Seguridad", desc: "Los alumnos conocen y respetan las normas de seguridad del área." },
            { id: 24, name: "Actividades estándar", desc: "Se utilizan estándares para mantener organizadas y productivas las actividades." },
            { id: 25, name: "Revisión del ciclo 5S", desc: "Se aplican consistentemente las 3 primeras S." }
        ]
    },
    shitsuke: {
        name: 'Shitsuke (Disciplina)',
        description: 'Convertir en hábito los estándares establecidos. Realizar auditorías constantes y respetar las normas de seguridad del Nodo.',
        keyword: 'Disciplina',
        key: 'shitsuke',
        items: [
            { id: 26, name: "Mantenimiento", desc: "El equipo es capacitado en 5S, se realizan actividades sistemáticas, los docentes y alumnos se involucran." },
            { id: 27, name: "Área de responsabilidad", desc: "Cumplen las normas del código de convivencia. Se utilizan los elementos de protección personal, incluyendo el uniforme. Se investigan y divulgan los accidentes." },
            { id: 28, name: "Involucramiento 5S", desc: "Los alumnos mantienen su espacio sin la exigencia de sus docentes." },
            { id: 29, name: "Vistas de áreas de trabajo", desc: "El docente del área controla las tareas de 5S y reconoce apropiadamente a los alumnos." },
            { id: 30, name: "5S control y disciplina", desc: "Hay implementado un sistema de seguimiento y control de 5S. Se cumple con la planificación. Se resuelven tempestivamente los desvíos identificados." }
        ]
    }
};

const S_DESCRIPTIONS = Object.values(AUDIT_QUESTIONS).map(cat => ({
    name: cat.name,
    description: cat.description,
    keyword: cat.keyword
}));

export default function AuditManagement() {
    const { role, userProfile } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState('historial'); // 'historial' | 'nueva'
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState(null);

    // Form state
    const [sector, setSector] = useState('');
    
    // Default scores to 5 for all 30 questions
    const getInitialScores = () => {
        const initial = {};
        Object.values(AUDIT_QUESTIONS).forEach(cat => {
            cat.items.forEach(item => {
                initial[item.id] = 5;
            });
        });
        return initial;
    };
    
    const [scores, setScores] = useState(getInitialScores);
    const [observations, setObservations] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    // UI state for accordion
    const [expandedCategory, setExpandedCategory] = useState('seiri');
    const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingAuditId, setEditingAuditId] = useState(null);

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
            
            if (!data || data.length === 0) {
                loadLocalAudits();
            } else {
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

    useEffect(() => {
        setShowDetailedBreakdown(false);
    }, [selectedAudit]);

    const handleScoreChange = (questionId, value) => {
        setScores(prev => ({ ...prev, [questionId]: value }));
    };

    const handleMarkAllAsFive = () => {
        const updated = {};
        Object.values(AUDIT_QUESTIONS).forEach(cat => {
            cat.items.forEach(item => {
                updated[item.id] = 5;
            });
        });
        setScores(updated);
    };

    const handleMarkCategoryAsFive = (catKey) => {
        setScores(prev => {
            const updated = { ...prev };
            AUDIT_QUESTIONS[catKey].items.forEach(item => {
                updated[item.id] = 5;
            });
            return updated;
        });
    };

    // Helper to group scores by category for calculations
    const getCategoryScores = (currentScores) => {
        const result = { seiri: [], seiton: [], seiso: [], seiketsu: [], shitsuke: [] };
        Object.entries(AUDIT_QUESTIONS).forEach(([catKey, cat]) => {
            cat.items.forEach(item => {
                const val = currentScores[item.id] !== undefined ? currentScores[item.id] : 5;
                result[catKey].push(val);
            });
        });
        return result;
    };

    const getAuditDetails = (audit) => {
        if (!audit) return null;
        
        // 1. If detailed_scores exists directly as an object, use it
        if (audit.detailed_scores && typeof audit.detailed_scores === 'object') {
            return audit.detailed_scores;
        }
        
        // 2. Otherwise try to parse it from observations
        if (audit.observations && audit.observations.includes('[DETALLES_5S]:')) {
            try {
                const parts = audit.observations.split('[DETALLES_5S]:');
                const jsonStr = parts[1].trim();
                return JSON.parse(jsonStr);
            } catch (e) {
                console.error("Error parsing detailed scores from observations:", e);
            }
        }
        
        // 3. Fallback: recreate scores from the 5 category averages
        const fallback = {};
        Object.entries(AUDIT_QUESTIONS).forEach(([catKey, cat]) => {
            const catScore = audit[`score_${catKey}`] !== undefined ? audit[`score_${catKey}`] : 5;
            cat.items.forEach(item => {
                fallback[item.id] = catScore;
            });
        });
        return fallback;
    };

    const getCleanObservations = (obs) => {
        if (!obs) return "";
        if (obs.includes('[DETALLES_5S]:')) {
            return obs.split('[DETALLES_5S]:')[0].trim();
        }
        return obs;
    };

    // Calculation states for form
    const formCategoryScores = getCategoryScores(scores);
    const formCategoryTotals = {
        seiri: formCategoryScores.seiri.reduce((a, b) => a + b, 0),
        seiton: formCategoryScores.seiton.reduce((a, b) => a + b, 0),
        seiso: formCategoryScores.seiso.reduce((a, b) => a + b, 0),
        seiketsu: formCategoryScores.seiketsu.reduce((a, b) => a + b, 0),
        shitsuke: formCategoryScores.shitsuke.reduce((a, b) => a + b, 0)
    };
    const formTotalPoints = Object.values(formCategoryTotals).reduce((a, b) => a + b, 0);
    
    // Average of 5 categories
    const formAverages = {
        seiri: formCategoryTotals.seiri / 5,
        seiton: formCategoryTotals.seiton / 9,
        seiso: formCategoryTotals.seiso / 6,
        seiketsu: formCategoryTotals.seiketsu / 5,
        shitsuke: formCategoryTotals.shitsuke / 5
    };
    const formOverallAverage = ((formAverages.seiri + formAverages.seiton + formAverages.seiso + formAverages.seiketsu + formAverages.shitsuke) / 5).toFixed(1);

    const get5SLevelInfo = (points) => {
        if (points <= 10) {
            return { level: 0, status: "No Iniciado", range: "0-10", color: "text-danger" };
        } else if (points <= 40) {
            return { level: 1, status: "Actividad de inicio", range: "11-40", color: "text-warning" };
        } else if (points <= 70) {
            return { level: 2, status: "Amplia Actividad", range: "41-70", color: "text-warning" };
        } else if (points <= 100) {
            return { level: 3, status: "Nivel mínimo requerido", range: "71-100", color: "text-accent" };
        } else if (points <= 130) {
            return { level: 4, status: "Nivel Medio", range: "101-130", color: "text-primary" };
        } else {
            return { level: 5, status: "Mejor Práctica", range: "131-150", color: "text-success" };
        }
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

        const auditorId = selectedAudit && isEditing ? selectedAudit.auditor_id : (userProfile?.id || '95c78188-52a3-484c-807a-8e1e2079b76e');
        const auditorName = selectedAudit && isEditing ? selectedAudit.auditor_name : (userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Israel Pavelek');

        // Calculate averages for DB (as rounded integers between 0 and 5)
        const scoreSeiri = Math.round(formAverages.seiri);
        const scoreSeiton = Math.round(formAverages.seiton);
        const scoreSeiso = Math.round(formAverages.seiso);
        const scoreSeiketsu = Math.round(formAverages.seiketsu);
        const scoreShitsuke = Math.round(formAverages.shitsuke);

        const serializedDetails = `[DETALLES_5S]:${JSON.stringify(scores)}`;
        const finalObservations = observations 
            ? `${observations}\n\n${serializedDetails}`
            : serializedDetails;

        const baseAuditData = {
            sector,
            auditor_id: auditorId,
            score_seiri: scoreSeiri,
            score_seiton: scoreSeiton,
            score_seiso: scoreSeiso,
            score_seiketsu: scoreSeiketsu,
            score_shitsuke: scoreShitsuke,
            observations: finalObservations
        };

        try {
            if (isEditing) {
                if (editingAuditId.startsWith('local-audit-')) {
                    const local = JSON.parse(localStorage.getItem('etrr-audits') || '[]');
                    const updated = local.map(item => {
                        if (item.id === editingAuditId) {
                            return { ...item, ...baseAuditData, detailed_scores: scores };
                        }
                        return item;
                    });
                    localStorage.setItem('etrr-audits', JSON.stringify(updated));
                    setAudits(updated);
                    setSuccessMsg(`¡Auditoría de "${sector}" actualizada localmente!`);
                } else {
                    const { error: primaryError } = await supabase
                        .from('audit_sessions')
                        .update({
                            ...baseAuditData,
                            detailed_scores: scores
                        })
                        .eq('id', editingAuditId);

                    if (primaryError) {
                        console.warn("Primary update failed, trying fallback without detailed_scores:", primaryError);
                        const { error: fallbackError } = await supabase
                            .from('audit_sessions')
                            .update(baseAuditData)
                            .eq('id', editingAuditId);

                        if (fallbackError) throw fallbackError;
                    }
                    setSuccessMsg(`¡Auditoría de "${sector}" actualizada con éxito!`);
                }
            } else {
                baseAuditData.created_at = new Date().toISOString();
                
                const { error: primaryError } = await supabase
                    .from('audit_sessions')
                    .insert([{
                        ...baseAuditData,
                        detailed_scores: scores
                    }]);

                if (primaryError) {
                    console.warn("Primary save failed, trying fallback without detailed_scores column:", primaryError);
                    
                    const { error: fallbackError } = await supabase
                        .from('audit_sessions')
                        .insert([baseAuditData]);

                    if (fallbackError) throw fallbackError;
                }
                
                setSuccessMsg(`¡Auditoría de "${sector}" guardada con éxito!`);
                triggerAuditAlerts({ ...baseAuditData, detailed_scores: scores });
            }
            
            await loadAudits();
            resetForm();
            setIsEditing(false);
            setEditingAuditId(null);
            setSelectedAudit(null);
            setTimeout(() => setActiveSubTab('historial'), 2000);

        } catch (err) {
            console.error("Operation failed, using localStorage fallback:", err);
            const local = JSON.parse(localStorage.getItem('etrr-audits') || '[]');
            
            if (isEditing) {
                const updated = local.map(item => {
                    if (item.id === editingAuditId) {
                        return { ...item, ...baseAuditData, detailed_scores: scores };
                    }
                    return item;
                });
                localStorage.setItem('etrr-audits', JSON.stringify(updated));
                setAudits(updated);
                setSuccessMsg(`¡Auditoría actualizada localmente (Modo Demo)!`);
            } else {
                baseAuditData.created_at = new Date().toISOString();
                const completeAudit = {
                    id: `local-audit-${Date.now()}`,
                    auditor_name: auditorName,
                    detailed_scores: scores,
                    ...baseAuditData
                };
                const updated = [completeAudit, ...local];
                localStorage.setItem('etrr-audits', JSON.stringify(updated));
                setAudits(updated);
                
                setSuccessMsg(`¡Auditoría de "${sector}" guardada localmente con éxito (Modo Demo)!`);
                triggerAuditAlerts(completeAudit);
            }
            
            resetForm();
            setIsEditing(false);
            setEditingAuditId(null);
            setSelectedAudit(null);
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

        const cleanObs = getCleanObservations(audit.observations);

        if (categoriesWithLowScores.length > 0) {
            createNotification(
                null,
                '⚠️ Puntuación 5S Baja en Auditoría',
                `La auditoría en "${audit.sector}" registró bajas puntuaciones en: ${categoriesWithLowScores.join(', ')}. Observaciones: "${cleanObs?.substring(0, 50)}..."`,
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
        setScores(getInitialScores());
        setObservations('');
        setExpandedCategory('seiri');
    };

    const handleQuickRedCard = async (lowCategory, score, questionDesc) => {
        if (!selectedAudit) return;
        const auditorName = selectedAudit.auditor_name || 'Israel Pavelek';
        
        const confirmCreate = window.confirm(
            `¿Desea crear automáticamente una Tarjeta Roja para el sector "${selectedAudit.sector}" debido a la baja puntuación (${score}/5) en "${questionDesc || lowCategory}"?`
        );

        if (!confirmCreate) return;

        const redCardData = {
            card_number: `RC-AUD-${Math.floor(1000 + Math.random() * 9000)}`,
            date: new Date().toISOString().split('T')[0],
            placed_by: auditorName,
            sector: selectedAudit.sector,
            element: lowCategory,
            problem_description: `Anomalía detectada en Auditoría 5S. Criterio: "${questionDesc || lowCategory}". Puntuación baja (${score}/5). Observación de auditoría: "${getCleanObservations(selectedAudit.observations) || ''}"`,
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
            
            await createNotification(
                null,
                '🚨 Tarjeta Roja Proactiva Creada',
                `Se abrió una tarjeta roja automática para "${selectedAudit.sector}" por fallas en la auditoría de "${questionDesc || lowCategory}".`,
                'red_card'
            );
        } catch (e) {
            const localRCs = JSON.parse(localStorage.getItem('etrr-red-cards') || '[]');
            localRCs.unshift({ id: `local-rc-${Date.now()}`, ...redCardData });
            localStorage.setItem('etrr-red-cards', JSON.stringify(localRCs));

            await createNotification(
                null,
                '🚨 Tarjeta Roja Proactiva Creada (Local)',
                `Se abrió una tarjeta roja automática para "${selectedAudit.sector}" por fallas en la auditoría de "${questionDesc || lowCategory}".`,
                'red_card'
            );
            alert('¡Tarjeta Roja proactiva creada y guardada localmente con éxito (Modo Demo)!');
        }
    };

    const handleStartEdit = () => {
        if (!selectedAudit) return;
        setEditingAuditId(selectedAudit.id);
        setSector(selectedAudit.sector);
        setObservations(getCleanObservations(selectedAudit.observations));
        
        const details = getAuditDetails(selectedAudit);
        setScores(details || getInitialScores());
        
        setIsEditing(true);
        setActiveSubTab('nueva');
    };

    const handleDeleteAudit = async (audit) => {
        if (!audit) return;
        const confirmDelete = window.confirm(
            `¿Está seguro de que desea eliminar permanentemente la auditoría del sector "${audit.sector}" realizada por "${audit.auditor_name}"?`
        );
        if (!confirmDelete) return;

        try {
            if (audit.id && audit.id.startsWith('local-audit-')) {
                const local = JSON.parse(localStorage.getItem('etrr-audits') || '[]');
                const updated = local.filter(item => item.id !== audit.id);
                localStorage.setItem('etrr-audits', JSON.stringify(updated));
                setAudits(updated);
                alert('Auditoría eliminada localmente.');
            } else {
                const { error } = await supabase
                    .from('audit_sessions')
                    .delete()
                    .eq('id', audit.id);

                if (error) throw error;
                alert('Auditoría eliminada con éxito de la base de datos.');
            }
            setSelectedAudit(null);
            await loadAudits();
        } catch (e) {
            console.error("Error deleting audit:", e);
            alert(`No se pudo eliminar la auditoría: ${e.message || e}`);
        }
    };

    // CUSTOM SVG RADAR CHART COMPONENT (NATIVE VECTORS)
    const renderRadarChart = (audit) => {
        const cx = 150;
        const cy = 150;
        const radius = 100;

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

        // Compute Audit Area Polygon with decimals if details exist
        let seiriAvg = audit.score_seiri;
        let seitonAvg = audit.score_seiton;
        let seisoAvg = audit.score_seiso;
        let seiketsuAvg = audit.score_seiketsu;
        let shitsukeAvg = audit.score_shitsuke;

        const details = getAuditDetails(audit);
        if (details) {
            const catScores = getCategoryScores(details);
            seiriAvg = catScores.seiri.reduce((a, b) => a + b, 0) / 5;
            seitonAvg = catScores.seiton.reduce((a, b) => a + b, 0) / 9;
            seisoAvg = catScores.seiso.reduce((a, b) => a + b, 0) / 6;
            seiketsuAvg = catScores.seiketsu.reduce((a, b) => a + b, 0) / 5;
            shitsukeAvg = catScores.shitsuke.reduce((a, b) => a + b, 0) / 5;
        }

        const scoresValues = [
            seiriAvg || 5,
            seitonAvg || 5,
            seisoAvg || 5,
            seiketsuAvg || 5,
            shitsukeAvg || 5
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
                    <text
                        x={x}
                        y={y - 8}
                        textAnchor="middle"
                        className="text-[8px] font-black text-primary fill-current"
                    >
                        {scoresValues[i].toFixed(1)}
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
        let seiriAvg = audit.score_seiri;
        let seitonAvg = audit.score_seiton;
        let seisoAvg = audit.score_seiso;
        let seiketsuAvg = audit.score_seiketsu;
        let shitsukeAvg = audit.score_shitsuke;

        const details = getAuditDetails(audit);
        if (details) {
            const catScores = getCategoryScores(details);
            seiriAvg = catScores.seiri.reduce((a, b) => a + b, 0) / 5;
            seitonAvg = catScores.seiton.reduce((a, b) => a + b, 0) / 9;
            seisoAvg = catScores.seiso.reduce((a, b) => a + b, 0) / 6;
            seiketsuAvg = catScores.seiketsu.reduce((a, b) => a + b, 0) / 5;
            shitsukeAvg = catScores.shitsuke.reduce((a, b) => a + b, 0) / 5;
        }

        const sum = (seiriAvg || 0) + (seitonAvg || 0) + (seisoAvg || 0) + (seiketsuAvg || 0) + (shitsukeAvg || 0);
        return (sum / 5).toFixed(1);
    };

    const getScoreColor = (average) => {
        if (average >= 4.5) return 'text-success';
        if (average >= 3.5) return 'text-accent';
        if (average >= 2.5) return 'text-warning';
        return 'text-danger';
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

                                {/* Score list breakdown with detailed questions view option */}
                                <div className="space-y-3.5">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-0.5">Puntuaciones</h4>
                                        <button
                                            type="button"
                                            onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
                                            className="text-xs font-black text-primary hover:underline cursor-pointer bg-none border-none outline-none"
                                        >
                                            {showDetailedBreakdown ? 'Ver Resumen' : 'Ver 30 Preguntas'}
                                        </button>
                                    </div>
                                    
                                    {(() => {
                                        const details = getAuditDetails(selectedAudit);
                                        const catScores = getCategoryScores(details || {});
                                        const averages = {
                                            seiri: catScores.seiri.reduce((a,b)=>a+b,0) / 5,
                                            seiton: catScores.seiton.reduce((a,b)=>a+b,0) / 9,
                                            seiso: catScores.seiso.reduce((a,b)=>a+b,0) / 6,
                                            seiketsu: catScores.seiketsu.reduce((a,b)=>a+b,0) / 5,
                                            shitsuke: catScores.shitsuke.reduce((a,b)=>a+b,0) / 5,
                                        };
                                        const selectedTotalPoints = Object.values(details || {}).reduce((a,b)=>a+b,0);
                                        const selectedLevelInfo = get5SLevelInfo(selectedTotalPoints);

                                        return (
                                            <>
                                                {/* Point badge */}
                                                <div className="p-3 bg-surface-hover/30 rounded-xl border border-color/40 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-xs font-bold text-[var(--text-primary)]">Puntaje Total:</span>
                                                        <p className="text-[10px] text-secondary font-medium mt-0.5">
                                                            Nivel {selectedLevelInfo.level} - {selectedLevelInfo.status}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-black text-primary">{selectedTotalPoints}</span>
                                                        <span className="text-[10px] text-tertiary"> / 150 pts</span>
                                                    </div>
                                                </div>

                                                {/* Summary categories if not details view */}
                                                {!showDetailedBreakdown ? (
                                                    <div className="space-y-2">
                                                        {[
                                                            { key: 'seiri', label: '1. Seiri (Clasificación)', score: averages.seiri },
                                                            { key: 'seiton', label: '2. Seiton (Orden)', score: averages.seiton },
                                                            { key: 'seiso', label: '3. Seiso (Limpieza)', score: averages.seiso },
                                                            { key: 'seiketsu', label: '4. Seiketsu (Estandarización)', score: averages.seiketsu },
                                                            { key: 'shitsuke', label: '5. Shitsuke (Disciplina)', score: averages.shitsuke }
                                                        ].map((item) => (
                                                            <div key={item.key} className="p-3 bg-surface-hover/20 rounded-xl border border-color/30 flex items-center justify-between">
                                                                <span className="text-xs font-bold text-secondary">{item.label}</span>
                                                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                                    item.score >= 4 ? 'bg-success/10 text-success' : item.score >= 3 ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'
                                                                }`}>
                                                                    {item.score.toFixed(1)} / 5
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    /* Detailed breakdown */
                                                    <div className="pt-2 space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                                        {Object.entries(AUDIT_QUESTIONS).map(([catKey, cat]) => (
                                                            <div key={catKey} className="space-y-2">
                                                                <h5 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider pl-0.5 border-b border-color/30 pb-1">
                                                                    {cat.keyword}
                                                                </h5>
                                                                <div className="space-y-1.5">
                                                                    {cat.items.map(q => {
                                                                        const qScore = details[q.id] !== undefined ? details[q.id] : 5;
                                                                        return (
                                                                            <div key={q.id} className="p-2.5 bg-main/5 rounded-xl border border-color/20 flex flex-col gap-1.5">
                                                                                <div className="flex justify-between items-start gap-2">
                                                                                    <span className="text-[11px] font-bold text-secondary leading-tight">
                                                                                        {q.name}
                                                                                    </span>
                                                                                    <span className={`text-[10px] font-black px-1.5 py-0.25 rounded shrink-0 ${
                                                                                        qScore >= 4 ? 'bg-success/10 text-success' : qScore >= 3 ? 'bg-amber-500/10 text-amber-600' : 'bg-danger/10 text-danger'
                                                                                    }`}>
                                                                                        {qScore}
                                                                                    </span>
                                                                                </div>
                                                                                {qScore < 3 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleQuickRedCard(cat.keyword, qScore, q.name)}
                                                                                        className="py-0.5 px-2 bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger font-extrabold text-[8px] rounded transition-all flex items-center gap-1 cursor-pointer self-start"
                                                                                    >
                                                                                        <AlertTriangle size={8} />
                                                                                        Crear Tarjeta Roja
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Observations */}
                                {getCleanObservations(selectedAudit.observations) && (
                                    <div className="pt-4 border-t border-color">
                                        <h5 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1.5">Observaciones Generales</h5>
                                        <p className="text-xs text-secondary leading-relaxed font-medium bg-main/5 p-3 rounded-xl border border-color/40 italic">
                                            "{getCleanObservations(selectedAudit.observations)}"
                                        </p>
                                    </div>
                                )}

                                {/* Admin actions for Coordinator and Gerente */}
                                {(role === 'coordinador' || role === 'gerente') && (
                                    <div className="pt-4 border-t border-color flex gap-3">
                                        <button
                                            type="button"
                                            onClick={handleStartEdit}
                                            className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all cursor-pointer text-center"
                                        >
                                            Editar Auditoría
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAudit(selectedAudit)}
                                            className="flex-1 py-2 bg-danger/10 hover:bg-danger/20 text-danger font-bold text-xs rounded-xl border border-danger/20 transition-all cursor-pointer text-center"
                                        >
                                            Eliminar Auditoría
                                        </button>
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
                            <h3 className="text-lg font-black text-[var(--text-primary)]">
                                {isEditing ? 'Editar Auditoría 5S' : 'Formulario de Auditoría'}
                            </h3>
                            <p className="text-xs text-secondary font-medium">
                                {isEditing 
                                    ? `Modificando la auditoría de "${sector}" realizada por "${selectedAudit?.auditor_name}".`
                                    : 'Califica objetivamente el estado físico del sector seleccionado.'}
                            </p>
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

                        {/* Accordion Group of 5S questions */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between border-b border-color/40 pb-2">
                                <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-0.5">Preguntas de las 5 "S"</h4>
                                <span className="text-[10px] text-tertiary font-bold">
                                    Responde cada una del 0 al 5
                                </span>
                            </div>

                            <div className="space-y-3">
                                {Object.entries(AUDIT_QUESTIONS).map(([catKey, cat]) => {
                                    const isExpanded = expandedCategory === catKey;
                                    const items = cat.items;
                                    const answeredCount = items.filter(item => scores[item.id] !== undefined && scores[item.id] !== null).length;
                                    const categoryTotal = items.reduce((sum, item) => sum + (scores[item.id] || 0), 0);
                                    const categoryMax = items.length * 5;

                                    return (
                                        <div key={catKey} className="border border-color rounded-2xl overflow-hidden bg-surface-hover/20">
                                            {/* Accordion Header */}
                                            <button
                                                type="button"
                                                onClick={() => setExpandedCategory(isExpanded ? null : catKey)}
                                                className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-hover/50 transition-all text-left outline-none cursor-pointer"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                                    <span className="font-extrabold text-sm text-[var(--text-primary)]">
                                                        {cat.name}
                                                    </span>
                                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold self-start">
                                                        {answeredCount} / {items.length} Respondidas
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-secondary">
                                                        {categoryTotal} / {categoryMax} pts
                                                    </span>
                                                    {isExpanded ? <ChevronUp size={16} className="text-secondary" /> : <ChevronDown size={16} className="text-secondary" />}
                                                </div>
                                            </button>

                                            {/* Expanded questions list */}
                                            {isExpanded && (
                                                <div className="p-4 space-y-4 bg-surface border-t border-color/40 animate-fade-in">
                                                    <div className="flex justify-between items-center bg-main/5 p-3 rounded-xl border border-color/30 gap-4">
                                                        <p className="text-[11px] text-secondary leading-relaxed font-medium max-w-xl">
                                                            {cat.description}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMarkCategoryAsFive(catKey)}
                                                            className="py-1 px-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/20 text-primary font-black text-[10px] rounded-lg transition-all shrink-0 cursor-pointer"
                                                        >
                                                            Marcar {cat.keyword} con 5
                                                        </button>
                                                    </div>

                                                    <div className="space-y-4">
                                                        {items.map((item) => (
                                                            <div key={item.id} className="p-4 bg-surface-hover/30 rounded-xl border border-color/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                                <div className="space-y-1 max-w-lg">
                                                                    <h5 className="font-extrabold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                                                                        <span className="text-tertiary">#{item.id}</span>
                                                                        {item.name}
                                                                    </h5>
                                                                    <p className="text-[11px] text-secondary leading-relaxed font-medium">
                                                                        {item.desc}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {[0, 1, 2, 3, 4, 5].map((val) => (
                                                                        <button
                                                                            key={val}
                                                                            type="button"
                                                                            onClick={() => handleScoreChange(item.id, val)}
                                                                            className={`w-8 h-8 rounded-full font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                                                                                scores[item.id] === val
                                                                                    ? val <= 2
                                                                                        ? 'bg-red-500 text-white shadow-md shadow-red-500/20 scale-110'
                                                                                        : val <= 4
                                                                                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-110'
                                                                                        : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-110'
                                                                                    : 'bg-surface border border-color hover:border-color-hover text-secondary hover:text-[var(--text-primary)]'
                                                                            }`}
                                                                            title={
                                                                                val === 0 ? "No Iniciado" :
                                                                                val === 1 ? "Actividad de inicio" :
                                                                                val === 2 ? "Amplia Actividad" :
                                                                                val === 3 ? "Nivel mínimo requerido" :
                                                                                val === 4 ? "Nivel Medio" : "Mejor Práctica"
                                                                            }
                                                                        >
                                                                            {val}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Real-time Summary Dashboard Panel */}
                        {(() => {
                            const levelInfo = get5SLevelInfo(formTotalPoints);
                            return (
                                <div className="p-5 bg-surface-hover/20 rounded-2xl border border-color flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="space-y-1.5 text-center md:text-left">
                                        <h4 className="text-xs font-black text-secondary uppercase tracking-widest pl-0.5">Resumen de Evaluación</h4>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center md:justify-start">
                                            <span className="text-sm font-bold text-[var(--text-primary)]">
                                                Puntaje Total: <span className="text-lg font-black text-primary">{formTotalPoints}</span> / 150 pts
                                            </span>
                                            <span className="text-tertiary">|</span>
                                            <span className="text-sm font-bold text-[var(--text-primary)]">
                                                Promedio: <span className="text-lg font-black text-primary">{formOverallAverage}</span> / 5.0
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-secondary">
                                            Nivel de Madurez: <span className={`font-black ${levelInfo.color}`}>{levelInfo.level} - {levelInfo.status}</span> ({levelInfo.range} pts)
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleMarkAllAsFive}
                                            className="py-2 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                                        >
                                            <Star size={14} className="fill-current" />
                                            Marcar todo con 5
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

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
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setEditingAuditId(null);
                                        resetForm();
                                        setActiveSubTab('historial');
                                    }}
                                    className="py-2.5 px-4 bg-surface-hover hover:bg-surface text-secondary font-black rounded-xl border border-color transition-all text-sm cursor-pointer"
                                >
                                    Cancelar Edición
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={resetForm}
                                className="py-2.5 px-4 bg-surface-hover hover:bg-surface text-secondary font-black rounded-xl border border-color transition-all text-sm cursor-pointer"
                            >
                                Restablecer
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="py-2.5 px-5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all text-sm cursor-pointer shadow-md shadow-primary/10 flex items-center gap-2"
                            >
                                <Check size={16} />
                                {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Auditoría'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
