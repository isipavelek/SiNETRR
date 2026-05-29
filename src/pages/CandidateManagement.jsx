import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import { 
    Users, Search, Filter, Plus, FileText, CheckCircle, X, 
    Download, Upload, Edit3, Trash2, Calendar, Clipboard, 
    Briefcase, Grid, Award, AlertCircle, Clock, Info, Check, ChevronDown
} from 'lucide-react';

// Helper to convert Excel date format or serial numbers
const parseExcelDate = (excelDate) => {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        return jsDate.toISOString().split('T')[0];
    }
    const parsedStr = String(excelDate).trim();
    if (parsedStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        return parsedStr.split('T')[0];
    }
    const d = new Date(parsedStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return parsedStr;
};

// Helper to resolve product type descriptions
const getProductTypeInfo = (type) => {
    const rawType = (type || '').trim().toUpperCase();
    switch (rawType) {
        case 'BU':
            return { code: 'BU', name: 'Bienes de uso' };
        case 'HE':
            return { code: 'HE', name: 'Herramental' };
        case 'IN':
            return { code: 'IN', name: 'Insumos' };
        case 'ME':
            return { code: 'ME', name: 'Instrumentos de medición' };
        default:
            return { code: 'NS', name: 'Insumos (N/S)' };
    }
};

const cleanString = (str) => {
    return String(str || '')
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9 ]/g, "") // keep only alphanumeric and spaces
        .replace(/\s+/g, ' '); // collapse spaces
};

const getSuggestions = (firstName, lastName, currentCandidates) => {
    const importFullNameCleaned = cleanString(`${firstName} ${lastName}`);
    const importWords = importFullNameCleaned.split(/\s+/).filter(w => w.length > 2);
    if (importWords.length === 0) return [];
    
    return currentCandidates.filter(c => {
        const dbFullName = cleanString(`${c.first_name || ''} ${c.last_name || ''}`);
        return importWords.some(word => dbFullName.includes(word));
    });
};


// Reusable Subject Selector component
const SubjectSelector = ({ subjects, selectedSubjects, onChange, placeholder = "Seleccionar materias..." }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return subjects.filter(s => 
            s.name.toLowerCase().includes(q) || 
            (s.courses?.name || '').toLowerCase().includes(q)
        );
    }, [subjects, search]);

    const toggleSubject = (name) => {
        if (selectedSubjects.includes(name)) {
            onChange(selectedSubjects.filter(n => n !== name));
        } else {
            onChange([...selectedSubjects, name]);
        }
    };

    return (
        <div className="space-y-1.5 relative w-full font-sans">
            {/* Selected Pills */}
            <div className="flex flex-wrap gap-1 p-2 bg-main border border-color/40 rounded-xl min-h-[40px] max-h-32 overflow-y-auto shadow-inner w-full">
                {selectedSubjects.length === 0 ? (
                    <span className="text-xs text-tertiary px-1.5 py-0.5 italic">{placeholder}</span>
                ) : (
                    selectedSubjects.map(name => (
                        <span key={name} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 animate-scale-in">
                            {name}
                            <button 
                                type="button"
                                onClick={() => onChange(selectedSubjects.filter(n => n !== name))}
                                className="hover:bg-accent/20 rounded-full p-0.5 transition-colors cursor-pointer"
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))
                )}
            </div>

            {/* Input & Dropdown Toggle */}
            <div className="relative w-full">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Buscar materias..."
                    className="w-full bg-surface border border-color/40 text-xs text-[var(--text-primary)] rounded-xl pl-3 pr-8 py-2 outline-none focus:ring-2 focus:ring-accent font-semibold"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-[var(--text-primary)] cursor-pointer"
                >
                    <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Dropdown Options List */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[10000]" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute left-0 right-0 mt-1 bg-surface border border-color rounded-xl shadow-xl max-h-48 overflow-y-auto z-[10001] divide-y divide-color/20 custom-scrollbar animate-fade-in">
                        {filtered.length === 0 ? (
                            <div className="p-3 text-center text-xs text-tertiary font-semibold">No se encontraron materias</div>
                        ) : (
                            filtered.map(s => {
                                const isChecked = selectedSubjects.includes(s.name);
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => toggleSubject(s.name)}
                                        className="w-full text-left p-2 hover:bg-main transition-colors text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="truncate pr-4">
                                            <span className="font-bold text-xs text-[var(--text-primary)] block truncate">{s.name}</span>
                                            <span className="text-[10px] text-secondary block font-mono">{s.courses?.name || 'Colegio'}</span>
                                        </div>
                                        {isChecked ? (
                                            <Check size={14} className="text-accent shrink-0" />
                                        ) : (
                                            <span className="w-3.5 h-3.5 border border-color/50 rounded-sm shrink-0"></span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default function CandidateManagement() {
    const { userProfile, role } = useAuth();
    const [candidates, setCandidates] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [decisionFilter, setDecisionFilter] = useState('all');
    const [areaFilter, setAreaFilter] = useState('all');

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [newCandidateForm, setNewCandidateForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        cv_url: ''
    });

    // Review Form State
    const [reviewForm, setReviewForm] = useState({
        global_evaluation: 'Bueno',
        request_interview: 'Si',
        potential_areas: [],
        potential_subjects: [],
        has_pedagogical_training: 'No',
        has_teaching_experience: 'No',
        has_industry_experience: 'No',
        comments: ''
    });

    // Interview Form State
    const [interviewForm, setInterviewForm] = useState({
        interview_date: '',
        interview_description: '',
        interviewers: [],
        availability_monday: 'No disponible',
        availability_tuesday: 'No disponible',
        availability_wednesday: 'No disponible',
        availability_thursday: 'No disponible',
        availability_friday: 'No disponible',
        availability_comments: '',
        possible_3ct: 'No',
        subjects_of_interest: [],
        decision: 'Pending', // will map to 'Pendiente'
        reasons: ''
    });

    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    // Import Resolution State
    const [importResolution, setImportResolution] = useState({
        isOpen: false,
        unresolvedItems: [], // [{ index, firstName, lastName, candidateEmail, row, suggestions }]
        currentIndex: 0,
        candidatesToUpsert: [],
        currentCandidates: [],
        resolvedResults: [] // { type: 'create' | 'link' | 'skip', dbCandidateId?: string, item: unresolvedItem }
    });
    const [selectedResolutionOption, setSelectedResolutionOption] = useState('create');
    const [selectedLinkCandidateId, setSelectedLinkCandidateId] = useState('');
    const [resolutionSearchText, setResolutionSearchText] = useState('');

    // Duplicates management
    const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
    const [duplicatePairs, setDuplicatePairs] = useState([]);
    const [ignoredPairs, setIgnoredPairs] = useState(new Set());

    const interviewerOptions = ['Luis Cornaglia', 'Israel Pavelek', 'Alejandro Tombesi'];

    useEffect(() => {
        fetchCandidates();
        fetchSubjects();
    }, []);

    const fetchCandidates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setCandidates(data || []);
        } catch (err) {
            console.error('Error fetching candidates:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubjects = async () => {
        try {
            const { data, error } = await supabase
                .from('subjects')
                .select('id, name, courses(name)')
                .order('name');
            if (error) throw error;
            setSubjects(data || []);
        } catch (err) {
            console.error('Error fetching subjects:', err);
        }
    };

    // Calculate flow statistics
    const stats = useMemo(() => {
        const counts = { total: 0, pendingReview: 0, interviewed: 0, approvedToPsico: 0 };
        candidates.forEach(c => {
            counts.total++;
            if (!c.reviews || c.reviews.length === 0) {
                counts.pendingReview++;
            }
            if (c.interview_date) {
                counts.interviewed++;
            }
            if (c.decision === 'Avanza a Psicotécnico') {
                counts.approvedToPsico++;
            }
        });
        return counts;
    }, [candidates]);

    // Filtering logic
    const filteredCandidates = useMemo(() => {
        return candidates.filter(c => {
            const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
            const email = (c.email || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            const matchesSearch = fullName.includes(query) || email.includes(query) || 
                                 (c.subjects_of_interest || []).some(s => s.toLowerCase().includes(query));

            const matchesDecision = decisionFilter === 'all' || c.decision === decisionFilter;
            
            let matchesArea = true;
            if (areaFilter !== 'all') {
                matchesArea = (c.reviews || []).some(r => (r.potential_areas || []).includes(areaFilter));
            }

            return matchesSearch && matchesDecision && matchesArea;
        });
    }, [candidates, searchQuery, decisionFilter, areaFilter]);

    // Add manual candidate
    const handleAddCandidate = async (e) => {
        e.preventDefault();
        if (!newCandidateForm.first_name.trim() || !newCandidateForm.email.trim()) {
            alert('Por favor, completa los campos requeridos (*).');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('candidates')
                .insert([{
                    first_name: newCandidateForm.first_name.trim(),
                    last_name: newCandidateForm.last_name.trim(),
                    email: newCandidateForm.email.trim().toLowerCase(),
                    cv_url: newCandidateForm.cv_url.trim(),
                    decision: 'Pendiente'
                }]);

            if (error) throw error;

            alert('Candidato dado de alta correctamente.');
            setIsAddModalOpen(false);
            setNewCandidateForm({ first_name: '', last_name: '', email: '', cv_url: '' });
            fetchCandidates();
        } catch (err) {
            alert('Error al agregar candidato: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Open detail & review modal
    const handleOpenDetail = (c) => {
        setSelectedCandidate(c);
        
        // Find existing review of current user if any
        const myReview = (c.reviews || []).find(r => r.evaluator_id === userProfile?.id) || {};
        setReviewForm({
            global_evaluation: myReview.global_evaluation || 'Bueno',
            request_interview: myReview.request_interview || 'Si',
            potential_areas: myReview.potential_areas || [],
            potential_subjects: myReview.potential_subjects || [],
            has_pedagogical_training: myReview.has_pedagogical_training || 'No',
            has_teaching_experience: myReview.has_teaching_experience || 'No',
            has_industry_experience: myReview.has_industry_experience || 'No',
            comments: myReview.comments || ''
        });

        // Setup Interview Form
        setInterviewForm({
            interview_date: c.interview_date || '',
            interview_description: c.interview_description || '',
            interviewers: c.interviewers || [],
            availability_monday: c.availability_monday || 'No disponible',
            availability_tuesday: c.availability_tuesday || 'No disponible',
            availability_wednesday: c.availability_wednesday || 'No disponible',
            availability_thursday: c.availability_thursday || 'No disponible',
            availability_friday: c.availability_friday || 'No disponible',
            availability_comments: c.availability_comments || '',
            possible_3ct: c.possible_3ct || 'No',
            subjects_of_interest: c.subjects_of_interest || [],
            decision: c.decision || 'Pendiente',
            reasons: c.reasons || ''
        });
    };

    // Save CV Evaluation Review
    const handleSaveReview = async (e) => {
        e.preventDefault();
        if (!selectedCandidate) return;

        setSaving(true);
        try {
            const userReviewId = userProfile?.id || 'evaluator';
            const userReviewName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Evaluador';
            const newReview = {
                evaluator_id: userReviewId,
                evaluator_name: userReviewName,
                evaluator_role: role,
                global_evaluation: reviewForm.global_evaluation,
                request_interview: reviewForm.request_interview,
                potential_areas: reviewForm.potential_areas,
                potential_subjects: reviewForm.potential_subjects,
                has_pedagogical_training: reviewForm.has_pedagogical_training,
                has_teaching_experience: reviewForm.has_teaching_experience,
                has_industry_experience: reviewForm.has_industry_experience,
                comments: reviewForm.comments,
                updated_at: new Date().toISOString()
            };

            const updatedReviews = [
                ...(selectedCandidate.reviews || []).filter(r => r.evaluator_id !== userReviewId),
                newReview
            ];

            const { error } = await supabase
                .from('candidates')
                .update({ reviews: updatedReviews })
                .eq('id', selectedCandidate.id);

            if (error) throw error;

            alert('Evaluación guardada.');
            fetchCandidates();
            
            // Update selected candidate state in-place
            setSelectedCandidate(prev => ({ ...prev, reviews: updatedReviews }));
        } catch (err) {
            alert('Error al guardar evaluación: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Save Interview Log and Decision
    const handleSaveInterview = async (e) => {
        e.preventDefault();
        if (!selectedCandidate) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('candidates')
                .update({
                    interview_date: interviewForm.interview_date || null,
                    interview_description: interviewForm.interview_description,
                    interviewers: interviewForm.interviewers,
                    availability_monday: interviewForm.availability_monday,
                    availability_tuesday: interviewForm.availability_tuesday,
                    availability_wednesday: interviewForm.availability_wednesday,
                    availability_thursday: interviewForm.availability_thursday,
                    availability_friday: interviewForm.availability_friday,
                    availability_comments: interviewForm.availability_comments,
                    possible_3ct: interviewForm.possible_3ct,
                    subjects_of_interest: interviewForm.subjects_of_interest,
                    decision: interviewForm.decision,
                    reasons: interviewForm.reasons
                })
                .eq('id', selectedCandidate.id);

            if (error) throw error;

            alert('Registro de entrevista y decisión actualizados.');
            fetchCandidates();
            setSelectedCandidate(null);
        } catch (err) {
            alert('Error al guardar entrevista: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Delete candidate
    const handleDeleteCandidate = async (id, name) => {
        if (!confirm(`¿Estás seguro de eliminar por completo a "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const { error } = await supabase
                .from('candidates')
                .delete()
                .eq('id', id);
            if (error) throw error;
            alert('Candidato eliminado.');
            fetchCandidates();
        } catch (err) {
            alert('Error al eliminar candidato: ' + err.message);
        }
    };

    // Excel Import
    const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('¿Deseas importar candidatos de este archivo Excel? Los registros y evaluaciones se combinarán por correo único.')) {
            e.target.value = '';
            return;
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!data || data.length === 0) {
                    throw new Error('El archivo está vacío.');
                }

                // Query current candidates from database to match interviews
                const { data: currentCandidates, error: fetchErr } = await supabase
                    .from('candidates')
                    .select('*');
                if (fetchErr) throw fetchErr;

                const candidatesToUpsert = [];
                const cvOrOldCandidates = [];
                const unresolvedItems = [];

                for (let index = 0; index < data.length; index++) {
                    const row = data[index];
                    const isInterviewResultsFormat = ('Nombre2' in row) || ('Entrevistaron' in row && !('Postulante' in row));
                    const isCvAnalysisFormat = ('Postulante' in row) || ('Evaluación global del candidato' in row);

                    let firstName = '';
                    let lastName = '';
                    let candidateEmail = '';
                    let cvUrl = '';

                    if (isInterviewResultsFormat) {
                        const candidateName = String(row['Nombre2'] || '').trim();
                        if (!candidateName) continue; // Skip empty rows

                        // Try to extract email from candidateName (e.g. "Juan Perez (juan.perez@gmail.com)")
                        const emailRegex = /[\w.-]+@[\w.-]+\.[\w.-]+/i;
                        const emailMatch = candidateName.match(emailRegex);
                        let extractedEmail = '';
                        let cleanedName = candidateName;

                        if (emailMatch) {
                            extractedEmail = emailMatch[0].toLowerCase();
                            cleanedName = candidateName.replace(emailRegex, '').replace(/[()\[\]]/g, '').trim();
                        }

                        // Split cleanedName into first_name and last_name
                        const nameParts = cleanedName.split(/\s+/);
                        if (nameParts.length > 1) {
                            firstName = nameParts[0];
                            lastName = nameParts.slice(1).join(' ');
                        } else {
                            firstName = cleanedName || 'Sin Nombre';
                            lastName = '';
                        }
                        candidateEmail = extractedEmail;

                        // Try to match in existing database list with name reversal and clean name comparison
                        let matchedCandidate = currentCandidates.find(c => {
                            if (candidateEmail && c.email && c.email.toLowerCase() === candidateEmail) return true;
                            const dbFullName = cleanString(`${c.first_name || ''} ${c.last_name || ''}`);
                            const dbReversedName = cleanString(`${c.last_name || ''} ${c.first_name || ''}`);
                            const importedFullName = cleanString(`${firstName} ${lastName}`);
                            return dbFullName === importedFullName || dbReversedName === importedFullName;
                        });

                        // If no exact match found, queue it as unresolved
                        if (!matchedCandidate) {
                            const suggestions = getSuggestions(firstName, lastName, currentCandidates);
                            unresolvedItems.push({
                                index,
                                firstName,
                                lastName,
                                candidateEmail,
                                row,
                                suggestions
                            });
                            continue;
                        }

                        const parsedInterviewers = String(row['Entrevistaron'] || '')
                            .split(/[;,]/)
                            .map(i => i.trim())
                            .filter(Boolean);

                        const parsedSubjects = String(row['Posibles materias de interes'] || row['Posibles materias de interés'] || '')
                            .split(/[;,]/)
                            .map(s => s.trim())
                            .filter(Boolean);

                        const candidateData = {
                            import_id: String(row['ID'] || row['Id'] || index + 1),
                            start_time: row['Hora de inicio'] ? new Date(row['Hora de inicio']).toISOString() : null,
                            end_time: row['Hora de finalización'] ? new Date(row['Hora de finalización']).toISOString() : null,
                            email: matchedCandidate.email,
                            first_name: matchedCandidate.first_name,
                            last_name: matchedCandidate.last_name || null,
                            cv_url: matchedCandidate.cv_url,
                            // Preserve existing reviews if matched
                            reviews: matchedCandidate.reviews || [],
                            interviewers: parsedInterviewers,
                            interview_date: parseExcelDate(row['Fecha de la entrevista']),
                            interview_description: row['Descripción global'] || null,
                            availability_monday: row['Lunes'] || 'No disponible',
                            availability_tuesday: row['Martes'] || 'No disponible',
                            availability_wednesday: row['Miércoles'] || 'No disponible',
                            availability_thursday: row['Jueves'] || 'No disponible',
                            availability_friday: row['Viernes'] || 'No disponible',
                            availability_comments: row['Comentarios sobre la disponibilidad horaria del candidato'] || null,
                            possible_3ct: row['Posible Candidato 3CT'] || 'No',
                            subjects_of_interest: parsedSubjects,
                            decision: row['Decisión'] || 'Pendiente',
                            reasons: row['Razones'] || null
                        };

                        candidateData.id = matchedCandidate.id;

                        // Check if we already have this email in candidatesToUpsert (deduplicate within the import file)
                        const existingIdx = candidatesToUpsert.findIndex(c => c.email.toLowerCase() === candidateData.email.toLowerCase());
                        if (existingIdx !== -1) {
                            candidatesToUpsert[existingIdx] = candidateData;
                        } else {
                            candidatesToUpsert.push(candidateData);
                        }
                    } else {
                        // Extract fields for CV analysis or old format
                        if (isCvAnalysisFormat) {
                            const candidateName = String(row['Postulante'] || '').trim();
                            if (!candidateName) continue;

                            const emailRegex = /[\w.-]+@[\w.-]+\.[\w.-]+/i;
                            const emailMatch = candidateName.match(emailRegex);
                            let extractedEmail = '';
                            let cleanedName = candidateName;

                            if (emailMatch) {
                                extractedEmail = emailMatch[0].toLowerCase();
                                cleanedName = candidateName.replace(emailRegex, '').replace(/[()\[\]]/g, '').trim();
                            }

                            const nameParts = cleanedName.split(/\s+/);
                            if (nameParts.length > 1) {
                                firstName = nameParts[0];
                                lastName = nameParts.slice(1).join(' ');
                            } else {
                                firstName = cleanedName || 'Sin Nombre';
                                lastName = '';
                            }
                            candidateEmail = extractedEmail;
                            cvUrl = String(row['Cargar CVs'] || '').trim();
                        } else {
                            firstName = String(row['Nombre'] || row['first_name'] || '').trim();
                            lastName = String(row['Nombre1'] || row['last_name'] || '').trim();
                            candidateEmail = String(row['Correo electrónico'] || row['email'] || '').trim().toLowerCase();
                            cvUrl = String(row['cv_url'] || '').trim();
                            if (!firstName) continue;
                        }

                        cvOrOldCandidates.push({
                            row,
                            index,
                            isCvAnalysisFormat,
                            firstName,
                            lastName,
                            candidateEmail,
                            cvUrl
                        });
                    }
                }

                // If we have CV or old format candidates, we process them using grouping by email
                if (cvOrOldCandidates.length > 0) {
                    const emailToNames = {};
                    cvOrOldCandidates.forEach(item => {
                        const emailCol = String(item.row['Correo electrónico'] || '').trim().toLowerCase();
                        if (emailCol) {
                            const nameKey = `${item.firstName} ${item.lastName}`.trim().toLowerCase();
                            if (!emailToNames[emailCol]) {
                                emailToNames[emailCol] = new Set();
                            }
                            emailToNames[emailCol].add(nameKey);
                        }
                    });

                    const sharedEmails = new Set();
                    Object.keys(emailToNames).forEach(email => {
                        if (emailToNames[email].size > 1) {
                            sharedEmails.add(email);
                        }
                    });

                    cvOrOldCandidates.forEach(item => {
                        if (!item.candidateEmail) {
                            const emailCol = String(item.row['Correo electrónico'] || '').trim().toLowerCase();
                            if (emailCol && !sharedEmails.has(emailCol)) {
                                item.candidateEmail = emailCol;
                            } else {
                                const cleanName = `${item.firstName}.${item.lastName}`
                                    .toLowerCase()
                                    .normalize("NFD")
                                    .replace(/[\u0300-\u036f]/g, "")
                                    .replace(/[^a-z0-9.]/g, "");
                                item.candidateEmail = `${cleanName || 'candidato'}.${item.index + 1}@temporal.com`;
                            }
                        }
                    });

                    const candidateGroups = {};
                    cvOrOldCandidates.forEach(item => {
                        const emailKey = item.candidateEmail;
                        if (!candidateGroups[emailKey]) {
                            candidateGroups[emailKey] = [];
                        }
                        candidateGroups[emailKey].push(item);
                    });

                    const cvOrOldUpsertData = Object.keys(candidateGroups).map(emailKey => {
                        const items = candidateGroups[emailKey];
                        const firstItem = items[0];

                        const first_name = firstItem.firstName;
                        const last_name = firstItem.lastName || null;
                        const cv_url = items.map(item => item.cvUrl).find(Boolean) || null;
                        const import_id = String(firstItem.row['ID'] || firstItem.row['Id'] || firstItem.index + 1);
                        const start_time = firstItem.row['Hora de inicio'] ? new Date(firstItem.row['Hora de inicio']).toISOString() : null;
                        const end_time = firstItem.row['Hora de finalización'] ? new Date(firstItem.row['Hora de finalización']).toISOString() : null;

                        let reviews = [];
                        let interviewers = [];
                        let interview_date = null;
                        let interview_description = null;
                        let availability_monday = 'No disponible';
                        let availability_tuesday = 'No disponible';
                        let availability_wednesday = 'No disponible';
                        let availability_thursday = 'No disponible';
                        let availability_friday = 'No disponible';
                        let availability_comments = null;
                        let possible_3ct = 'No';
                        let subjects_of_interest = [];
                        let decision = 'Pendiente';
                        let reasons = null;

                        if (firstItem.isCvAnalysisFormat) {
                            reviews = items.map((item, idx) => {
                                const r = item.row;
                                const evaluator_name = String(r['Evaluador'] || r['Nombre'] || `Evaluador ${idx + 1}`).trim();
                                const evaluator_id = `evaluator_import_${idx + 1}_${item.index}`;
                                const evaluator_role = 'coordinador';

                                const rawEval = String(r['Evaluación global del candidato'] || '').trim();
                                let global_evaluation = 'No Aplica';
                                if (/muy\s+bueno/i.test(rawEval)) global_evaluation = 'Muy Bueno';
                                else if (/bueno/i.test(rawEval)) global_evaluation = 'Bueno';
                                else if (/regular/i.test(rawEval)) global_evaluation = 'Regular';
                                else if (/no\s+aplica/i.test(rawEval)) global_evaluation = 'No Aplica';

                                const rawInt = String(r['Solicitar entrevista'] || '').trim();
                                let request_interview = 'No';
                                if (/si/i.test(rawInt)) request_interview = 'Si';
                                else if (/no/i.test(rawInt)) request_interview = 'No';
                                else if (/duda/i.test(rawInt)) request_interview = 'Duda';

                                const rawAreas = String(r['Areas Potenciales'] || r['Areas Potenciales explicitas.'] || '');
                                const potential_areas = [];
                                if (/CB/i.test(rawAreas)) potential_areas.push('CB');
                                if (/TEL/i.test(rawAreas)) potential_areas.push('TEL');
                                if (/TEM/i.test(rawAreas)) potential_areas.push('TEM');
                                if (/3CT/i.test(rawAreas)) potential_areas.push('3CT');
                                if (potential_areas.length === 0 && /no\s+aplica/i.test(rawAreas)) {
                                    potential_areas.push('No aplica');
                                }

                                const rawSubjects = r['Materias Potenciales'] || '';
                                const potential_subjects = String(rawSubjects)
                                    .split(/[;,]/)
                                    .map(s => s.trim())
                                    .filter(Boolean);

                                const rawPedag = String(r['Formación Docente'] || '').trim();
                                const has_pedagogical_training = /si/i.test(rawPedag) ? 'Si' : 'No';

                                const rawTeach = String(r['Experiencia Docente'] || '').trim();
                                const has_teaching_experience = /si/i.test(rawTeach) ? 'Si' : 'No';

                                const rawInd = String(r['Experiencia en empresas afines a la tecnología de su potencial asignatura'] || '').trim();
                                const has_industry_experience = /si/i.test(rawInd) ? 'Si' : 'No';

                                const comments = r['Considerandos de la evaluación general'] || null;

                                return {
                                    evaluator_id,
                                    evaluator_name,
                                    evaluator_role,
                                    global_evaluation,
                                    request_interview,
                                    potential_areas,
                                    potential_subjects,
                                    has_pedagogical_training,
                                    has_teaching_experience,
                                    has_industry_experience,
                                    comments,
                                    updated_at: r['Hora de la última modificación'] 
                                        ? new Date(r['Hora de la última modificación']).toISOString()
                                        : r['Fecha evaluación']
                                            ? new Date(r['Fecha evaluación']).toISOString()
                                            : new Date().toISOString()
                                };
                            });

                            subjects_of_interest = Array.from(new Set(reviews.flatMap(rev => rev.potential_subjects)));
                        } else {
                            const r = firstItem.row;
                            const rawSubjects = r['Posibles materias de interes'] || r['subjects_of_interest'] || '';
                            subjects_of_interest = String(rawSubjects)
                                .split(/[;,]/)
                                .map(s => s.trim())
                                .filter(Boolean);

                            const rawInterviewers = r['Entrevistaron'] || r['interviewers'] || '';
                            interviewers = String(rawInterviewers)
                                .split(/[;,]/)
                                .map(i => i.trim())
                                .filter(Boolean);

                            interview_date = parseExcelDate(r['Fecha de la entrevista']);
                            interview_description = r['Descripción global'] || null;
                            availability_monday = r['Disponibilidad horaria.Lunes'] || 'No disponible';
                            availability_tuesday = r['Disponibilidad horaria.Martes'] || 'No disponible';
                            availability_wednesday = r['Disponibilidad horaria.Miércoles'] || 'No disponible';
                            availability_thursday = r['Disponibilidad horaria.Jueves'] || 'No disponible';
                            availability_friday = r['Disponibilidad horaria.Viernes'] || 'No disponible';
                            availability_comments = r['Comentarios sobre la disponibilidad horaria del candidato'] || null;
                            possible_3ct = r['Posible Candidato 3CT'] || 'No';
                            decision = r['Decisión'] || 'Pendiente';
                            reasons = r['Razones'] || null;
                        }

                        // Try to find if this candidate already exists in database to merge
                        const nameKey = `${first_name} ${last_name || ''}`.trim().toLowerCase();
                        const dbMatch = currentCandidates.find(c => {
                            if (emailKey && c.email && c.email.toLowerCase() === emailKey.toLowerCase()) return true;
                            const cFullName = `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase();
                            return cFullName === nameKey;
                        });

                        const mappedObj = {
                            import_id,
                            start_time,
                            end_time,
                            email: dbMatch ? dbMatch.email : emailKey,
                            first_name,
                            last_name,
                            cv_url: dbMatch ? dbMatch.cv_url : cv_url,
                            reviews: dbMatch ? [...(dbMatch.reviews || []), ...reviews] : reviews,
                            interviewers: dbMatch ? dbMatch.interviewers : interviewers,
                            interview_date: dbMatch ? dbMatch.interview_date : interview_date,
                            interview_description: dbMatch ? dbMatch.interview_description : interview_description,
                            availability_monday: dbMatch ? dbMatch.availability_monday : availability_monday,
                            availability_tuesday: dbMatch ? dbMatch.availability_tuesday : availability_tuesday,
                            availability_wednesday: dbMatch ? dbMatch.availability_wednesday : availability_wednesday,
                            availability_thursday: dbMatch ? dbMatch.availability_thursday : availability_thursday,
                            availability_friday: dbMatch ? dbMatch.availability_friday : availability_friday,
                            availability_comments: dbMatch ? dbMatch.availability_comments : availability_comments,
                            possible_3ct: dbMatch ? dbMatch.possible_3ct : possible_3ct,
                            subjects_of_interest: dbMatch ? dbMatch.subjects_of_interest : subjects_of_interest,
                            decision: dbMatch ? dbMatch.decision : decision,
                            reasons: dbMatch ? dbMatch.reasons : reasons
                        };

                        if (dbMatch) {
                            mappedObj.id = dbMatch.id;
                        }
                        return mappedObj;
                    });

                    candidatesToUpsert.push(...cvOrOldUpsertData);
                }

                // Check if we need interactive match resolution
                if (unresolvedItems.length > 0) {
                    setImportResolution({
                        isOpen: true,
                        unresolvedItems,
                        currentIndex: 0,
                        candidatesToUpsert,
                        currentCandidates,
                        resolvedResults: []
                    });
                    const firstItem = unresolvedItems[0];
                    setSelectedResolutionOption(firstItem.suggestions.length > 0 ? 'link' : 'create');
                    setSelectedLinkCandidateId(firstItem.suggestions.length > 0 ? firstItem.suggestions[0].id : '');
                    setResolutionSearchText('');
                    setImporting(false);
                } else {
                    if (candidatesToUpsert.length === 0) {
                        throw new Error('No se procesó ningún registro válido de la hoja.');
                    }

                    // Save directly to Supabase
                    const { error } = await supabase
                        .from('candidates')
                        .upsert(candidatesToUpsert, { onConflict: 'email' });

                    if (error) throw error;

                    alert(`¡Importación exitosa! Se procesaron ${candidatesToUpsert.length} candidatos.`);
                    fetchCandidates();
                    setImporting(false);
                }
            } catch (err) {
                alert('Error al importar Excel: ' + err.message);
                setImporting(false);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // Save final candidates after resolving match conflicts manually
    const saveResolvedImport = async (resolvedResults, initialCandidatesToUpsert, currentCandidates) => {
        setSaving(true);
        try {
            const finalCandidatesToUpsert = [...initialCandidatesToUpsert];

            for (let i = 0; i < resolvedResults.length; i++) {
                const res = resolvedResults[i];
                if (res.type === 'skip') continue;

                const { firstName, lastName, candidateEmail, row, index } = res.item;
                let emailToUse = candidateEmail;
                let matchedCandidate = null;

                if (res.type === 'link') {
                    matchedCandidate = currentCandidates.find(c => c.id === res.dbCandidateId);
                    if (matchedCandidate) {
                        emailToUse = matchedCandidate.email;
                    }
                }

                if (!matchedCandidate && !emailToUse) {
                    const cleanName = `${firstName}.${lastName}`
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9.]/g, "");
                    emailToUse = `${cleanName || 'candidato'}.${index + 1}@temporal.com`;
                }

                const parsedInterviewers = String(row['Entrevistaron'] || '')
                    .split(/[;,]/)
                    .map(item => item.trim())
                    .filter(Boolean);

                const parsedSubjects = String(row['Posibles materias de interes'] || row['Posibles materias de interés'] || '')
                    .split(/[;,]/)
                    .map(s => s.trim())
                    .filter(Boolean);

                const candidateData = {
                    import_id: String(row['ID'] || row['Id'] || index + 1),
                    start_time: row['Hora de inicio'] ? new Date(row['Hora de inicio']).toISOString() : null,
                    end_time: row['Hora de finalización'] ? new Date(row['Hora de finalización']).toISOString() : null,
                    email: emailToUse,
                    first_name: matchedCandidate ? matchedCandidate.first_name : firstName,
                    last_name: matchedCandidate ? matchedCandidate.last_name : (lastName || null),
                    cv_url: matchedCandidate ? matchedCandidate.cv_url : null,
                    // Preserve existing reviews if matched
                    reviews: matchedCandidate ? (matchedCandidate.reviews || []) : [],
                    interviewers: parsedInterviewers,
                    interview_date: parseExcelDate(row['Fecha de la entrevista']),
                    interview_description: row['Descripción global'] || null,
                    availability_monday: row['Lunes'] || 'No disponible',
                    availability_tuesday: row['Martes'] || 'No disponible',
                    availability_wednesday: row['Miércoles'] || 'No disponible',
                    availability_thursday: row['Jueves'] || 'No disponible',
                    availability_friday: row['Viernes'] || 'No disponible',
                    availability_comments: row['Comentarios sobre la disponibilidad horaria del candidato'] || null,
                    possible_3ct: row['Posible Candidato 3CT'] || 'No',
                    subjects_of_interest: parsedSubjects,
                    decision: row['Decisión'] || 'Pendiente',
                    reasons: row['Razones'] || null
                };

                if (matchedCandidate) {
                    candidateData.id = matchedCandidate.id;
                }

                // Check if we already have this email in finalCandidatesToUpsert (deduplicate)
                const existingIdx = finalCandidatesToUpsert.findIndex(c => c.email.toLowerCase() === candidateData.email.toLowerCase());
                if (existingIdx !== -1) {
                    finalCandidatesToUpsert[existingIdx] = {
                        ...finalCandidatesToUpsert[existingIdx],
                        ...candidateData,
                        reviews: [...(finalCandidatesToUpsert[existingIdx].reviews || []), ...(candidateData.reviews || [])]
                    };
                } else {
                    finalCandidatesToUpsert.push(candidateData);
                }
            }

            if (finalCandidatesToUpsert.length === 0) {
                throw new Error('No se procesó ningún registro válido de la hoja.');
            }

            // Save to Supabase
            const { error } = await supabase
                .from('candidates')
                .upsert(finalCandidatesToUpsert, { onConflict: 'email' });

            if (error) throw error;

            alert(`¡Importación exitosa! Se procesaron ${finalCandidatesToUpsert.length} candidatos.`);
            fetchCandidates();
        } catch (err) {
            alert('Error al importar Excel: ' + err.message);
        } finally {
            setSaving(false);
            setImportResolution(prev => ({ ...prev, isOpen: false }));
        }
    };

    // Excel Export
    const handleExportExcel = () => {
        try {
            const dataToExport = filteredCandidates.map(c => {
                // Flatten reviews for output reference if needed, or output simple candidate data
                const reviewsSummary = (c.reviews || []).map(r => 
                    `[${r.evaluator_name} (${r.evaluator_role})]: Ev: ${r.global_evaluation}, Solicitar: ${r.request_interview}`
                ).join(' | ');

                return {
                    'Id': c.import_id || '',
                    'Nombre': c.first_name,
                    'Nombre1': c.last_name || '',
                    'Correo electrónico': c.email,
                    'Evaluaciones de CV': reviewsSummary,
                    'Entrevistaron': (c.interviewers || []).join(', '),
                    'Fecha de la entrevista': c.interview_date || '',
                    'Descripción global': c.interview_description || '',
                    'Disponibilidad horaria.Lunes': c.availability_monday || 'No disponible',
                    'Disponibilidad horaria.Martes': c.availability_tuesday || 'No disponible',
                    'Disponibilidad horaria.Miércoles': c.availability_wednesday || 'No disponible',
                    'Disponibilidad horaria.Jueves': c.availability_thursday || 'No disponible',
                    'Disponibilidad horaria.Viernes': c.availability_friday || 'No disponible',
                    'Comentarios sobre la disponibilidad horaria del candidato': c.availability_comments || '',
                    'Posible Candidato 3CT': c.possible_3ct || 'No',
                    'Posibles materias de interes': (c.subjects_of_interest || []).join(', '),
                    'Decisión': c.decision || 'Pendiente',
                    'Razones': c.reasons || ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Postulantes');
            XLSX.writeFile(wb, 'postulantes_y_entrevistas.xlsx');
        } catch (err) {
            alert('Error al exportar: ' + err.message);
        }
    };

    const handleScanDuplicates = () => {
        const pairs = [];
        const seen = new Set();

        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                const a = candidates[i];
                const b = candidates[j];

                const pairKey = [a.id, b.id].sort().join('-');
                if (seen.has(pairKey) || ignoredPairs.has(pairKey)) continue;

                // 1. Same email
                const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();

                // 2. Exact or reversed name match (clean strings)
                const nameA = cleanString(`${a.first_name || ''} ${a.last_name || ''}`);
                const nameB = cleanString(`${b.first_name || ''} ${b.last_name || ''}`);
                const nameAReversed = cleanString(`${a.last_name || ''} ${a.first_name || ''}`);
                
                const exactNameMatch = (nameA === nameB) || (nameAReversed === nameB);

                // 3. Fuzzy match: share at least 2 words of length > 2
                const wordsA = nameA.split(/\s+/).filter(w => w.length > 2);
                const wordsB = nameB.split(/\s+/).filter(w => w.length > 2);
                const sharedWords = wordsA.filter(w => wordsB.includes(w));
                const fuzzyNameMatch = sharedWords.length >= 2;

                // 4. Same prefix in email
                const prefixA = a.email ? a.email.split('@')[0].toLowerCase() : '';
                const prefixB = b.email ? b.email.split('@')[0].toLowerCase() : '';
                const samePrefix = prefixA && prefixB && prefixA === prefixB;

                if (sameEmail || exactNameMatch || fuzzyNameMatch || samePrefix) {
                    pairs.push({
                        candidateA: a,
                        candidateB: b,
                        isExact: exactNameMatch || sameEmail
                    });
                    seen.add(pairKey);
                }
            }
        }

        setDuplicatePairs(pairs);
        setIsDuplicatesModalOpen(true);
    };

    const handleMergeCandidates = async (candA, candB, isExact) => {
        let confirmMsg = `¿Deseas fusionar a "${candA.first_name} ${candA.last_name || ''}" con "${candB.first_name} ${candB.last_name || ''}"?\n\nLos datos de "${candB.first_name}" se combinarán en el perfil de "${candA.first_name}" y el registro duplicado se eliminará.`;
        
        if (!isExact) {
            confirmMsg = `⚠️ ¡ADVERTENCIA: COINCIDENCIA NO EXACTA! ⚠️\n\nLos nombres no coinciden exactamente:\n` +
                `- "${candA.first_name} ${candA.last_name || ''}"\n` +
                `- "${candB.first_name} ${candB.last_name || ''}"\n\n` +
                `¿Estás seguro de que son la misma persona y deseas fusionar sus datos?`;
        }

        if (!confirm(confirmMsg)) return;

        setSaving(true);
        try {
            const reviewsA = candA.reviews || [];
            const reviewsB = candB.reviews || [];
            const mergedReviews = [...reviewsA];

            reviewsB.forEach(revB => {
                const duplicateIdx = mergedReviews.findIndex(revA => revA.evaluator_id === revB.evaluator_id);
                if (duplicateIdx !== -1) {
                    const dateA = new Date(mergedReviews[duplicateIdx].updated_at || 0);
                    const dateB = new Date(revB.updated_at || 0);
                    if (dateB > dateA) {
                        mergedReviews[duplicateIdx] = revB;
                    }
                } else {
                    mergedReviews.push(revB);
                }
            });

            const mergedSubjects = Array.from(new Set([
                ...(candA.subjects_of_interest || []),
                ...(candB.subjects_of_interest || [])
            ]));
            
            const mergedInterviewers = Array.from(new Set([
                ...(candA.interviewers || []),
                ...(candB.interviewers || [])
            ]));

            const cv_url = candA.cv_url || candB.cv_url || null;
            const interview_date = candA.interview_date || candB.interview_date || null;
            const interview_description = candA.interview_description || candB.interview_description || null;
            const availability_monday = candA.availability_monday && candA.availability_monday !== 'No disponible' ? candA.availability_monday : candB.availability_monday;
            const availability_tuesday = candA.availability_tuesday && candA.availability_tuesday !== 'No disponible' ? candA.availability_tuesday : candB.availability_tuesday;
            const availability_wednesday = candA.availability_wednesday && candA.availability_wednesday !== 'No disponible' ? candA.availability_wednesday : candB.availability_wednesday;
            const availability_thursday = candA.availability_thursday && candA.availability_thursday !== 'No disponible' ? candA.availability_thursday : candB.availability_thursday;
            const availability_friday = candA.availability_friday && candA.availability_friday !== 'No disponible' ? candA.availability_friday : candB.availability_friday;
            const availability_comments = candA.availability_comments || candB.availability_comments || null;
            const possible_3ct = candA.possible_3ct === 'Si' ? 'Si' : candB.possible_3ct;
            const decision = candA.decision && candA.decision !== 'Pendiente' ? candA.decision : candB.decision;
            const reasons = candA.reasons || candB.reasons || null;

            const { error: updateErr } = await supabase
                .from('candidates')
                .update({
                    reviews: mergedReviews,
                    subjects_of_interest: mergedSubjects,
                    interviewers: mergedInterviewers,
                    cv_url,
                    interview_date,
                    interview_description,
                    availability_monday,
                    availability_tuesday,
                    availability_wednesday,
                    availability_thursday,
                    availability_friday,
                    availability_comments,
                    possible_3ct,
                    decision,
                    reasons
                })
                .eq('id', candA.id);

            if (updateErr) throw updateErr;

            const { error: deleteErr } = await supabase
                .from('candidates')
                .delete()
                .eq('id', candB.id);

            if (deleteErr) throw deleteErr;

            alert('Fusión completada.');
            await fetchCandidates();

            setDuplicatePairs(prev => prev.filter(pair => 
                pair.candidateA.id !== candB.id && pair.candidateB.id !== candB.id &&
                !(pair.candidateA.id === candA.id && pair.candidateB.id === candB.id)
            ));

        } catch (err) {
            alert('Error al fusionar candidatos: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteFromDuplicates = async (candId, candName) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${candName}"? Esta acción no se puede deshacer.`)) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('candidates')
                .delete()
                .eq('id', candId);

            if (error) throw error;

            alert('Candidato eliminado.');
            await fetchCandidates();

            setDuplicatePairs(prev => prev.filter(pair => 
                pair.candidateA.id !== candId && pair.candidateB.id !== candId
            ));
        } catch (err) {
            alert('Error al eliminar candidato: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleIgnorePair = (candAId, candBId) => {
        const pairKey = [candAId, candBId].sort().join('-');
        setIgnoredPairs(prev => {
            const next = new Set(prev);
            next.add(pairKey);
            return next;
        });
        setDuplicatePairs(prev => prev.filter(pair => {
            const key = [pair.candidateA.id, pair.candidateB.id].sort().join('-');
            return key !== pairKey;
        }));
    };

    if (role !== 'coordinador' && role !== 'gerente') {
        return <div className="p-10 text-center text-error font-bold">Acceso Denegado</div>;
    }

    return (
        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Header Banner */}
            <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border-l-4 border-l-accent shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex flex-col items-center justify-center text-accent border border-accent/20 shadow-inner shrink-0">
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)] mb-1 font-sans">Flujo de Postulantes</h2>
                        <p className="text-secondary font-medium text-sm font-sans">Administra los CVs ingresados, las revisiones técnicas, y el resultado de entrevistas del colegio.</p>
                    </div>
                </div>

                <div className="relative z-10 flex items-center gap-3 w-full md:w-auto flex-wrap shrink-0">
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn btn-primary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Alta Postulante</span>
                    </button>
                    <button 
                        onClick={handleScanDuplicates}
                        className="btn btn-secondary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer"
                    >
                        <Users size={14} />
                        <span>Detectar Duplicados</span>
                    </button>
                    <label className="btn btn-secondary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer">
                        <Upload size={14} />
                        <span>{importing ? 'Importando...' : 'Importar Excel'}</span>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            onChange={handleImportExcel} 
                            disabled={importing}
                            className="hidden" 
                        />
                    </label>
                    <button 
                        onClick={handleExportExcel}
                        className="btn btn-secondary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer"
                    >
                        <Download size={14} />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-4 text-center border-l-4 border-l-primary shadow-sm">
                    <span className="text-[10px] text-secondary font-black uppercase tracking-wider block">Total Postulantes</span>
                    <span className="text-3xl font-black text-primary block mt-1">{stats.total}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-warning shadow-sm">
                    <span className="text-[10px] text-secondary font-black uppercase tracking-wider block">Falta Evaluar CV</span>
                    <span className="text-3xl font-black text-warning block mt-1">{stats.pendingReview}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-accent shadow-sm">
                    <span className="text-[10px] text-secondary font-black uppercase tracking-wider block">Entrevistados</span>
                    <span className="text-3xl font-black text-accent block mt-1">{stats.interviewed}</span>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-l-success shadow-sm">
                    <span className="text-[10px] text-secondary font-black uppercase tracking-wider block">Avanza a Psicotécnico</span>
                    <span className="text-3xl font-black text-success block mt-1">{stats.approvedToPsico}</span>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o materia..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-main border border-color rounded-xl pl-4 pr-10 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-inner"
                    />
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-tertiary" size={16} />
                </div>
                <div className="flex gap-4 w-full md:w-auto flex-wrap">
                    <div className="flex items-center gap-2 bg-main/50 border border-color px-3 py-1.5 rounded-xl text-xs font-semibold shadow-inner">
                        <span className="text-secondary font-bold">Decisión:</span>
                        <select
                            value={decisionFilter}
                            onChange={(e) => setDecisionFilter(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] cursor-pointer outline-none"
                        >
                            <option value="all">Todas las Decisiones</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Avanza a Psicotécnico">Avanza a Psicotécnico</option>
                            <option value="No por ahora">No por ahora</option>
                            <option value="No">No</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-main/50 border border-color px-3 py-1.5 rounded-xl text-xs font-semibold shadow-inner">
                        <span className="text-secondary font-bold">Área Potencial:</span>
                        <select
                            value={areaFilter}
                            onChange={(e) => setAreaFilter(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] cursor-pointer outline-none"
                        >
                            <option value="all">Todas las Áreas</option>
                            <option value="CB">CB (Ciclo Básico)</option>
                            <option value="TEL">TEL (Electrónica)</option>
                            <option value="TEM">TEM (Electromecánica)</option>
                            <option value="3CT">3CT</option>
                            <option value="No aplica">No aplica</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Candidates Table */}
            <div className="glass-card overflow-hidden shadow-sm border border-color/40">
                {filteredCandidates.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                        <Users size={48} className="text-tertiary opacity-45 mb-4" />
                        <h3 className="text-lg font-bold text-[var(--text-primary)] font-sans">No se encontraron postulantes</h3>
                        <p className="text-sm text-secondary mt-1 font-sans">Prueba cambiando la búsqueda o importa un archivo de Excel.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[900px] font-sans">
                            <thead>
                                <tr className="bg-surface-hover/50 text-tertiary text-xs uppercase tracking-wider border-b border-color/50">
                                    <th className="p-4 font-bold">Postulante</th>
                                    <th className="p-4 font-bold">Materias Interés / Áreas</th>
                                    <th className="p-4 font-bold">Revisiones CV</th>
                                    <th className="p-4 font-bold">Entrevista</th>
                                    <th className="p-4 font-bold">Decisión Final</th>
                                    <th className="p-4 font-bold text-right pr-6">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-color/40 text-sm">
                                {filteredCandidates.map(c => {
                                    const evaluatedCount = (c.reviews || []).length;
                                    const areas = Array.from(new Set((c.reviews || []).flatMap(r => r.potential_areas || [])));
                                    
                                    return (
                                        <tr key={c.id} className="hover:bg-surface-hover/30 transition-colors">
                                            <td className="p-4">
                                                <div>
                                                    <span className="font-extrabold text-sm text-[var(--text-primary)] block">
                                                        {c.first_name} {c.last_name || ''}
                                                    </span>
                                                    <span className="text-xs text-secondary font-medium font-mono">{c.email}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    {areas.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {areas.map(a => (
                                                                <span key={a} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                                                                    {a}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {c.subjects_of_interest && c.subjects_of_interest.length > 0 ? (
                                                        <p className="text-xs text-secondary truncate max-w-[220px]" title={c.subjects_of_interest.join(', ')}>
                                                            {c.subjects_of_interest.join(', ')}
                                                        </p>
                                                    ) : (
                                                        <span className="text-[10px] text-tertiary font-medium">Materias no especificadas</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                        evaluatedCount === 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                                                    }`}>
                                                        {evaluatedCount} {evaluatedCount === 1 ? 'evaluación' : 'evaluaciones'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {c.interview_date ? (
                                                    <div className="text-xs space-y-0.5">
                                                        <span className="font-bold text-[var(--text-primary)] block flex items-center gap-1">
                                                            <Calendar size={12} className="text-accent" />
                                                            {new Date(c.interview_date + 'T00:00:00').toLocaleDateString()}
                                                        </span>
                                                        <span className="text-[10px] text-secondary font-semibold block truncate max-w-[150px]">
                                                            Con: {(c.interviewers || []).join(', ')}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-tertiary font-medium flex items-center gap-1">
                                                        <Clock size={12} />
                                                        Sin fecha cargada
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${
                                                    c.decision === 'Avanza a Psicotécnico' ? 'bg-success/10 text-success border-success/20' :
                                                    c.decision === 'No por ahora' ? 'bg-warning/10 text-warning border-warning/20' :
                                                    c.decision === 'No' ? 'bg-error/10 text-error border-error/20' :
                                                    'bg-secondary/15 text-tertiary border-color/40'
                                                }`}>
                                                    {c.decision}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenDetail(c)}
                                                        className="px-3 py-2 bg-surface hover:bg-accent/10 border border-color hover:border-accent/30 rounded-xl text-xs font-bold text-secondary hover:text-accent transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                                                    >
                                                        <Edit3 size={13} />
                                                        <span>Evaluar / Entrevista</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCandidate(c.id, `${c.first_name} ${c.last_name || ''}`)}
                                                        className="p-2 bg-surface hover:bg-error/15 border border-color hover:border-error/30 rounded-xl text-secondary hover:text-error transition-all shadow-sm cursor-pointer"
                                                        title="Eliminar Postulante"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Add Candidate Manually */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[9999] flex justify-center items-start md:items-center p-4 overflow-y-auto font-sans">
                    <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-auto">
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight">Dar de alta Postulante</h3>
                                <p className="text-xs text-secondary mt-1">Ingresa los datos del candidato para iniciar su proceso de revisión.</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddCandidate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Nombre *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCandidateForm.first_name}
                                        onChange={e => setNewCandidateForm(prev => ({ ...prev, first_name: e.target.value }))}
                                        placeholder="Ej: Juan"
                                        className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Apellido</label>
                                    <input
                                        type="text"
                                        value={newCandidateForm.last_name}
                                        onChange={e => setNewCandidateForm(prev => ({ ...prev, last_name: e.target.value }))}
                                        placeholder="Ej: Pérez"
                                        className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent font-semibold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-extrabold text-secondary mb-1.5 block">Correo electrónico *</label>
                                <input
                                    type="email"
                                    required
                                    value={newCandidateForm.email}
                                    onChange={e => setNewCandidateForm(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="Ej: juan.perez@email.com"
                                    className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent font-semibold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-extrabold text-secondary mb-1.5 block">Enlace al CV (Drive/Dropbox/etc.)</label>
                                <input
                                    type="url"
                                    value={newCandidateForm.cv_url}
                                    onChange={e => setNewCandidateForm(prev => ({ ...prev, cv_url: e.target.value }))}
                                    placeholder="https://..."
                                    className="bg-main border border-color/40 text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent font-semibold"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="btn btn-primary w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
                            >
                                {saving ? 'Guardando...' : <><CheckCircle size={16} /> Guardar Postulante</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Evaluation and Interview flow */}
            {selectedCandidate && createPortal(
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-start md:items-center p-4 overflow-y-auto font-sans"
                    style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div 
                        className="bg-surface border border-color rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', position: 'relative', zIndex: 1000000 }}
                    >
                        <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight">
                                    Flujo de Evaluación: {selectedCandidate.first_name} {selectedCandidate.last_name || ''}
                                </h3>
                                <p className="text-xs text-secondary mt-1 flex items-center gap-2">
                                    <span>Correo: {selectedCandidate.email}</span>
                                    {selectedCandidate.cv_url && (
                                        <>
                                            <span>•</span>
                                            <a href={selectedCandidate.cv_url} target="_blank" rel="noreferrer" className="text-accent font-bold hover:underline">Ver CV Adjunto 🔗</a>
                                        </>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setSelectedCandidate(null)} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            
                            {/* Panel 1: CV Review / Evaluaciones de Coordinadores */}
                            <div className="space-y-4">
                                <h4 className="font-black text-sm text-[var(--text-primary)] uppercase tracking-wider border-b border-color pb-1.5 flex items-center gap-2">
                                    <Clipboard className="text-accent" size={18} />
                                    <span>Evaluación de CV</span>
                                </h4>

                                {/* Existing Reviews List */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(selectedCandidate.reviews || []).length === 0 ? (
                                        <div className="col-span-2 p-6 border border-dashed border-color rounded-xl text-center text-secondary bg-main/10">
                                            <AlertCircle size={24} className="mx-auto mb-2 text-tertiary" />
                                            <p className="text-xs font-bold">Ningún coordinador o gerente técnico ha evaluado este CV aún.</p>
                                        </div>
                                    ) : (
                                        (selectedCandidate.reviews || []).map((rev, i) => (
                                            <div key={i} className="p-4 bg-main/30 border border-color rounded-xl space-y-3 shadow-sm relative">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-sm text-[var(--text-primary)] block">{rev.evaluator_name}</span>
                                                        <span className="text-[10px] text-accent font-black uppercase tracking-wider bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full mt-1 inline-block">
                                                            {rev.evaluator_role}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                                                        rev.global_evaluation === 'Muy Bueno' ? 'bg-success/15 text-success border-success/35' :
                                                        rev.global_evaluation === 'Bueno' ? 'bg-primary/15 text-primary border-primary/35' :
                                                        rev.global_evaluation === 'Regular' ? 'bg-warning/15 text-warning border-warning/35' :
                                                        'bg-secondary/15 text-tertiary border-color'
                                                    } uppercase tracking-wider`}>
                                                        {rev.global_evaluation}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-xs border-y border-color/40 py-2">
                                                    <div><span className="text-secondary font-semibold">¿Entrevista?:</span> <span className="font-bold text-[var(--text-primary)]">{rev.request_interview}</span></div>
                                                    <div><span className="text-secondary font-semibold">Form. Docente:</span> <span className="font-bold text-[var(--text-primary)]">{rev.has_pedagogical_training}</span></div>
                                                    <div><span className="text-secondary font-semibold">Exp. Docente:</span> <span className="font-bold text-[var(--text-primary)]">{rev.has_teaching_experience}</span></div>
                                                    <div><span className="text-secondary font-semibold">Exp. Empresas:</span> <span className="font-bold text-[var(--text-primary)]">{rev.has_industry_experience}</span></div>
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-secondary font-bold block uppercase tracking-wider">Materias Potenciales</span>
                                                    <p className="text-xs text-[var(--text-primary)] font-semibold truncate">
                                                        {(rev.potential_subjects || []).join(', ') || 'Ninguna seleccionada'}
                                                    </p>
                                                </div>

                                                {rev.comments && (
                                                    <div className="bg-surface border border-color/40 p-2.5 rounded-lg text-xs leading-relaxed italic text-secondary">
                                                        "{rev.comments}"
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Evaluation Entry Form */}
                                <form onSubmit={handleSaveReview} className="bg-main/30 border border-color rounded-xl p-5 space-y-4 shadow-sm">
                                    <h5 className="font-bold text-xs text-accent uppercase tracking-wider">Registrar / Editar mi evaluación</h5>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">Evaluación Global</label>
                                            <select
                                                value={reviewForm.global_evaluation}
                                                onChange={e => setReviewForm(prev => ({ ...prev, global_evaluation: e.target.value }))}
                                                className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                                            >
                                                <option value="Muy Bueno">Muy Bueno</option>
                                                <option value="Bueno">Bueno</option>
                                                <option value="Regular">Regular</option>
                                                <option value="No Aplica">No Aplica</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">¿Solicitar Entrevista?</label>
                                            <select
                                                value={reviewForm.request_interview}
                                                onChange={e => setReviewForm(prev => ({ ...prev, request_interview: e.target.value }))}
                                                className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                                            >
                                                <option value="Si">Si</option>
                                                <option value="No">No</option>
                                                <option value="Duda">Duda</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">Áreas Potenciales</label>
                                            <div className="flex flex-wrap gap-1 bg-surface border border-color rounded-xl p-2 max-h-24 overflow-y-auto">
                                                {['CB', 'TEL', 'TEM', '3CT', 'No aplica'].map(area => {
                                                    const checked = reviewForm.potential_areas.includes(area);
                                                    return (
                                                        <label key={area} className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary cursor-pointer bg-main/50 px-2 py-0.5 rounded border border-color/40">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={checked} 
                                                                onChange={() => {
                                                                    setReviewForm(prev => ({
                                                                        ...prev,
                                                                        potential_areas: checked 
                                                                            ? prev.potential_areas.filter(a => a !== area)
                                                                            : [...prev.potential_areas, area]
                                                                    }));
                                                                }}
                                                                className="rounded border-color" 
                                                            />
                                                            {area}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">Materias de Interés</label>
                                            <SubjectSelector
                                                subjects={subjects}
                                                selectedSubjects={reviewForm.potential_subjects}
                                                onChange={list => setReviewForm(prev => ({ ...prev, potential_subjects: list }))}
                                                placeholder="Seleccionar materias..."
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">¿Formación Docente?</label>
                                            <select
                                                value={reviewForm.has_pedagogical_training}
                                                onChange={e => setReviewForm(prev => ({ ...prev, has_pedagogical_training: e.target.value }))}
                                                className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                                            >
                                                <option value="Si">Si</option>
                                                <option value="No">No</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">¿Experiencia Docente?</label>
                                            <select
                                                value={reviewForm.has_teaching_experience}
                                                onChange={e => setReviewForm(prev => ({ ...prev, has_teaching_experience: e.target.value }))}
                                                className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                                            >
                                                <option value="Si">Si</option>
                                                <option value="No">No</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-extrabold text-secondary mb-1.5 block">¿Exp. Empresas Tecnología/Afines?</label>
                                            <select
                                                value={reviewForm.has_industry_experience}
                                                onChange={e => setReviewForm(prev => ({ ...prev, has_industry_experience: e.target.value }))}
                                                className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                                            >
                                                <option value="Si">Si</option>
                                                <option value="No">No</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">Observaciones / Comentarios de mi revisión</label>
                                        <textarea
                                            value={reviewForm.comments}
                                            onChange={e => setReviewForm(prev => ({ ...prev, comments: e.target.value }))}
                                            placeholder="Detalla tu análisis del perfil..."
                                            rows={2}
                                            className="bg-surface border border-color text-[var(--text-primary)] w-full rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent text-sm"
                                        />
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="btn btn-primary px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <CheckCircle size={14} />
                                            <span>Guardar mi evaluación de CV</span>
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Panel 2: Interview Log & Decision */}
                            <form onSubmit={handleSaveInterview} className="space-y-6">
                                <h4 className="font-black text-sm text-[var(--text-primary)] uppercase tracking-wider border-b border-color pb-1.5 flex items-center gap-2">
                                    <Calendar className="text-accent" size={18} />
                                    <span>Registro de Entrevista & Decisión Final</span>
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">Fecha de la entrevista</label>
                                        <input
                                            type="date"
                                            value={interviewForm.interview_date}
                                            onChange={e => setInterviewForm(prev => ({ ...prev, interview_date: e.target.value }))}
                                            className="bg-main border border-color text-sm text-[var(--text-primary)] rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">¿Entrevistaron? (Quiénes estuvieron)</label>
                                        <div className="bg-main border border-color rounded-xl p-2 max-h-24 overflow-y-auto space-y-1">
                                            {interviewerOptions.map(interviewerName => {
                                                const checked = interviewForm.interviewers.includes(interviewerName);
                                                return (
                                                    <label key={interviewerName} className="flex items-center gap-1.5 text-xs font-semibold text-secondary cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setInterviewForm(prev => ({
                                                                    ...prev,
                                                                    interviewers: checked
                                                                        ? prev.interviewers.filter(i => i !== interviewerName)
                                                                        : [...prev.interviewers, interviewerName]
                                                                }));
                                                            }}
                                                            className="rounded border-color"
                                                        />
                                                        <span>{interviewerName}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">Materias de Interés Post-Entrevista</label>
                                        <SubjectSelector
                                            subjects={subjects}
                                            selectedSubjects={interviewForm.subjects_of_interest}
                                            onChange={list => setInterviewForm(prev => ({ ...prev, subjects_of_interest: list }))}
                                            placeholder="Seleccionar materias..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-extrabold text-secondary mb-1.5 block">Descripción Global de la Entrevista</label>
                                    <textarea
                                        value={interviewForm.interview_description}
                                        onChange={e => setInterviewForm(prev => ({ ...prev, interview_description: e.target.value }))}
                                        placeholder="Escribe un resumen global de cómo resultó la entrevista presencial/virtual..."
                                        rows={3}
                                        className="bg-main border border-color text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent text-sm font-semibold"
                                    />
                                </div>

                                {/* Availability Grid (Lunes to Viernes: Mañana/Tarde/Completo/No disponible) */}
                                <div className="space-y-3 bg-main/30 border border-color rounded-xl p-5 shadow-inner">
                                    <div>
                                        <span className="text-xs font-black text-secondary block uppercase tracking-wider">Disponibilidad Horaria</span>
                                        <p className="text-[11px] text-tertiary mt-0.5">Define los turnos de disponibilidad manifestados por el candidato.</p>
                                    </div>

                                    <div className="overflow-x-auto border border-color/60 rounded-xl bg-surface">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-surface-hover/80 border-b border-color text-secondary font-bold text-center">
                                                    <th className="p-3 text-left w-32 border-r border-color/40">Día</th>
                                                    <th className="p-3 border-r border-color/40">Mañana</th>
                                                    <th className="p-3 border-r border-color/40">Tarde</th>
                                                    <th className="p-3 border-r border-color/40">Completo</th>
                                                    <th>No disponible</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-color/30 text-center font-semibold text-secondary">
                                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => {
                                                    const dayLabel = 
                                                        day === 'monday' ? 'Lunes' :
                                                        day === 'tuesday' ? 'Martes' :
                                                        day === 'wednesday' ? 'Miércoles' :
                                                        day === 'thursday' ? 'Jueves' : 'Viernes';
                                                    const fieldName = `availability_${day}`;
                                                    const currentValue = interviewForm[fieldName];
                                                    
                                                    return (
                                                        <tr key={day} className="hover:bg-surface-hover/20">
                                                            <td className="p-3 text-left font-bold text-[var(--text-primary)] border-r border-color/40">
                                                                {dayLabel}
                                                            </td>
                                                            {['Mañana', 'Tarde', 'Completo', 'No disponible'].map((option, idx) => (
                                                                <td key={option} className={`p-3 border-r border-color/40 ${idx === 3 ? 'border-r-0' : ''}`}>
                                                                    <label className="flex items-center justify-center cursor-pointer w-full h-full py-1">
                                                                        <input
                                                                            type="radio"
                                                                            name={fieldName}
                                                                            value={option}
                                                                            checked={currentValue === option}
                                                                            onChange={() => setInterviewForm(prev => ({ ...prev, [fieldName]: option }))}
                                                                            className="w-4 h-4 text-accent border-color focus:ring-accent cursor-pointer"
                                                                        />
                                                                    </label>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">Comentarios sobre la disponibilidad horaria</label>
                                        <input
                                            type="text"
                                            value={interviewForm.availability_comments}
                                            onChange={e => setInterviewForm(prev => ({ ...prev, availability_comments: e.target.value }))}
                                            placeholder="Ej: Solo puede Lunes por la mañana a partir de las 10:00..."
                                            className="bg-surface border border-color text-[var(--text-primary)] w-full rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent text-sm font-semibold shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-accent/5 border border-accent/20 rounded-xl p-5 shadow-sm">
                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">¿Posible Candidato 3CT?</label>
                                        <select
                                            value={interviewForm.possible_3ct}
                                            onChange={e => setInterviewForm(prev => ({ ...prev, possible_3ct: e.target.value }))}
                                            className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent font-bold cursor-pointer"
                                        >
                                            <option value="Si">Si</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">Decisión Final Proceso</label>
                                        <select
                                            value={interviewForm.decision}
                                            onChange={e => setInterviewForm(prev => ({ ...prev, decision: e.target.value }))}
                                            className="bg-surface border border-color text-sm text-[var(--text-primary)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent font-black cursor-pointer text-accent"
                                        >
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="Avanza a Psicotécnico">Avanza a Psicotécnico</option>
                                            <option value="No por ahora">No por ahora</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-extrabold text-secondary mb-1.5 block">Razones de la decisión</label>
                                        <textarea
                                            value={interviewForm.reasons}
                                            onChange={e => setInterviewForm(prev => ({ ...prev, reasons: e.target.value }))}
                                            placeholder="Detalla los motivos de tu decisión..."
                                            rows={2}
                                            className="bg-surface border border-color text-[var(--text-primary)] w-full rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-accent text-xs font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 border-t border-color/40 pt-4 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCandidate(null)}
                                        className="btn btn-secondary px-6 h-12 rounded-xl font-bold flex items-center justify-center cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="btn btn-primary px-8 h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer bg-accent hover:bg-accent-hover text-white border-none"
                                    >
                                        {saving ? 'Guardando...' : <><CheckCircle size={16} /> Guardar Entrevista & Decisión</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal: Interactive Match Resolution */}
            {importResolution.isOpen && createPortal(
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-start md:items-center p-4 overflow-y-auto font-sans"
                    style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div 
                        className="bg-surface border border-color rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', position: 'relative', zIndex: 1000000 }}
                    >
                        <div className="flex justify-between items-center p-5 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-lg text-[var(--text-primary)] tracking-tight">
                                    Resolución de Postulante Sin Coincidencia
                                </h3>
                                <p className="text-xs text-secondary mt-1">
                                    Paso {importResolution.currentIndex + 1} de {importResolution.unresolvedItems.length}
                                </p>
                            </div>
                            <button 
                                onClick={() => setImportResolution(prev => ({ ...prev, isOpen: false }))} 
                                className="text-secondary hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            {/* Current Unresolved Item details */}
                            {(() => {
                                const currentItem = importResolution.unresolvedItems[importResolution.currentIndex];
                                if (!currentItem) return null;

                                // Filter candidates by resolutionSearchText for manual association
                                const searchFilteredCandidates = resolutionSearchText.trim().length > 1
                                    ? importResolution.currentCandidates.filter(c => {
                                        const cleanQuery = cleanString(resolutionSearchText);
                                        const cleanName = cleanString(`${c.first_name || ''} ${c.last_name || ''}`);
                                        const cleanEmail = cleanString(c.email);
                                        return cleanName.includes(cleanQuery) || cleanEmail.includes(cleanQuery);
                                      }).slice(0, 5)
                                    : [];

                                return (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-warning/5 border border-warning/25 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2 text-warning font-extrabold text-xs uppercase tracking-wider">
                                                <AlertCircle size={16} />
                                                <span>Datos en Fila {currentItem.index + 1} del Excel</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-secondary block font-bold">Nombre en Excel:</span>
                                                    <span className="font-black text-sm text-[var(--text-primary)] block">
                                                        {currentItem.firstName} {currentItem.lastName}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-secondary block font-bold">Email en Excel:</span>
                                                    <span className="font-mono font-bold text-[var(--text-primary)] block truncate">
                                                        {currentItem.candidateEmail || 'No especificado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resolution Selection Options */}
                                        <div className="space-y-4">
                                            <span className="text-xs font-black text-secondary block uppercase tracking-wider">Selecciona cómo proceder</span>
                                            
                                            <div className="space-y-3">
                                                {/* Option A: Link to Suggested/Existing */}
                                                <div className={`p-4 border rounded-xl transition-all ${
                                                    selectedResolutionOption === 'link' 
                                                        ? 'bg-accent/5 border-accent shadow-sm' 
                                                        : 'bg-surface border-color/60 hover:border-color'
                                                }`}>
                                                    <label className="flex items-start gap-3 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="resolutionOption"
                                                            value="link"
                                                            checked={selectedResolutionOption === 'link'}
                                                            onChange={() => {
                                                                setSelectedResolutionOption('link');
                                                                if (currentItem.suggestions.length > 0) {
                                                                    setSelectedLinkCandidateId(currentItem.suggestions[0].id);
                                                                } else {
                                                                    setSelectedLinkCandidateId('');
                                                                }
                                                            }}
                                                            className="mt-1 w-4 h-4 text-accent border-color focus:ring-accent cursor-pointer"
                                                        />
                                                        <div className="flex-1 space-y-3">
                                                            <div>
                                                                <span className="font-bold text-xs text-[var(--text-primary)] block">
                                                                    Vincular a un postulante existente
                                                                </span>
                                                                <span className="text-[10px] text-tertiary block font-semibold mt-0.5">
                                                                    Asocia el resultado de esta entrevista al perfil de un candidato que ya está registrado.
                                                                </span>
                                                            </div>

                                                            {/* Suggestions List */}
                                                            {selectedResolutionOption === 'link' && (
                                                                <div className="space-y-2 mt-2">
                                                                    {currentItem.suggestions.length > 0 && (
                                                                        <div className="space-y-1.5">
                                                                            <span className="text-[10px] text-accent font-black uppercase tracking-wider block">Coincidencias Sugeridas:</span>
                                                                            {currentItem.suggestions.map(sug => (
                                                                                <label 
                                                                                    key={sug.id} 
                                                                                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                                                        selectedLinkCandidateId === sug.id 
                                                                                            ? 'bg-accent/10 border-accent/35 font-bold text-[var(--text-primary)]' 
                                                                                            : 'bg-main/20 border-color/40 hover:bg-main/40'
                                                                                    }`}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="radio"
                                                                                            name="suggestionSelect"
                                                                                            value={sug.id}
                                                                                            checked={selectedLinkCandidateId === sug.id}
                                                                                            onChange={() => setSelectedLinkCandidateId(sug.id)}
                                                                                            className="w-3.5 h-3.5 text-accent border-color focus:ring-accent cursor-pointer"
                                                                                        />
                                                                                        <div className="truncate">
                                                                                            <span className="block font-bold truncate">{sug.first_name} {sug.last_name || ''}</span>
                                                                                            <span className="block text-[10px] text-secondary font-mono truncate">{sug.email}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className="text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                                                                                        {(sug.reviews || []).length} evaluaciones
                                                                                    </span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Search all database candidates */}
                                                                    <div className="space-y-1.5 pt-2 border-t border-color/30">
                                                                        <span className="text-[10px] text-secondary font-black uppercase tracking-wider block">Buscar en toda la base de datos:</span>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Ingresa nombre o email para buscar..."
                                                                            value={resolutionSearchText}
                                                                            onChange={e => setResolutionSearchText(e.target.value)}
                                                                            className="w-full bg-main border border-color rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-accent font-semibold"
                                                                        />
                                                                        
                                                                        {searchFilteredCandidates.length > 0 && (
                                                                            <div className="bg-main border border-color rounded-xl overflow-hidden divide-y divide-color/30 mt-1">
                                                                                {searchFilteredCandidates.map(c => (
                                                                                    <button
                                                                                        key={c.id}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setSelectedLinkCandidateId(c.id);
                                                                                            setResolutionSearchText('');
                                                                                        }}
                                                                                        className="w-full text-left p-2 hover:bg-surface-hover transition-colors text-xs flex justify-between items-center cursor-pointer"
                                                                                    >
                                                                                        <div>
                                                                                            <span className="font-extrabold text-[var(--text-primary)] block">{c.first_name} {c.last_name || ''}</span>
                                                                                            <span className="text-[10px] text-secondary font-mono block">{c.email}</span>
                                                                                        </div>
                                                                                        {selectedLinkCandidateId === c.id ? (
                                                                                            <Check size={14} className="text-accent" />
                                                                                        ) : (
                                                                                            <span className="text-[9px] font-bold text-accent hover:underline">Seleccionar</span>
                                                                                        )}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        {/* Currently selected non-suggested link */}
                                                                        {selectedLinkCandidateId && !currentItem.suggestions.some(s => s.id === selectedLinkCandidateId) && (
                                                                            (() => {
                                                                                const selectedCand = importResolution.currentCandidates.find(c => c.id === selectedLinkCandidateId);
                                                                                if (!selectedCand) return null;
                                                                                return (
                                                                                    <div className="p-2 bg-accent/10 border border-accent/25 rounded-lg flex justify-between items-center text-xs mt-1 animate-scale-in">
                                                                                        <div className="truncate">
                                                                                            <span className="font-bold text-[var(--text-primary)] block truncate">Vincular a: {selectedCand.first_name} {selectedCand.last_name || ''}</span>
                                                                                            <span className="text-[10px] text-secondary font-mono block truncate">{selectedCand.email}</span>
                                                                                        </div>
                                                                                        <button 
                                                                                            type="button"
                                                                                            onClick={() => setSelectedLinkCandidateId('')}
                                                                                            className="text-error font-bold text-[10px] hover:underline"
                                                                                        >
                                                                                            Quitar
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            })()
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </label>
                                                </div>

                                                {/* Option B: Create New Candidate */}
                                                <div className={`p-4 border rounded-xl transition-all ${
                                                    selectedResolutionOption === 'create' 
                                                        ? 'bg-accent/5 border-accent shadow-sm' 
                                                        : 'bg-surface border-color/60 hover:border-color'
                                                }`}>
                                                    <label className="flex items-start gap-3 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="resolutionOption"
                                                            value="create"
                                                            checked={selectedResolutionOption === 'create'}
                                                            onChange={() => {
                                                                setSelectedResolutionOption('create');
                                                                setSelectedLinkCandidateId('');
                                                            }}
                                                            className="mt-1 w-4 h-4 text-accent border-color focus:ring-accent cursor-pointer"
                                                        />
                                                        <div>
                                                            <span className="font-bold text-xs text-[var(--text-primary)] block">
                                                                Crear como nuevo postulante
                                                            </span>
                                                            <span className="text-[10px] text-tertiary block font-semibold mt-0.5">
                                                                Se dará de alta una nueva ficha de postulante en la base de datos y se le asociará el resultado de esta entrevista.
                                                            </span>
                                                        </div>
                                                    </label>
                                                </div>

                                                {/* Option C: Skip row */}
                                                <div className={`p-4 border rounded-xl transition-all ${
                                                    selectedResolutionOption === 'skip' 
                                                        ? 'bg-error/5 border-error/30 shadow-sm' 
                                                        : 'bg-surface border-color/60 hover:border-color'
                                                }`}>
                                                    <label className="flex items-start gap-3 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="resolutionOption"
                                                            value="skip"
                                                            checked={selectedResolutionOption === 'skip'}
                                                            onChange={() => {
                                                                setSelectedResolutionOption('skip');
                                                                setSelectedLinkCandidateId('');
                                                            }}
                                                            className="mt-1 w-4 h-4 text-accent border-color focus:ring-accent cursor-pointer"
                                                        />
                                                        <div>
                                                            <span className="font-bold text-xs text-[var(--text-primary)] block">
                                                                Omitir esta fila (no importar)
                                                            </span>
                                                            <span className="text-[10px] text-tertiary block font-semibold mt-0.5">
                                                                Ignora esta fila del Excel y continúa con la importación del resto de las filas.
                                                            </span>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer buttons */}
                        <div className="p-5 border-t border-color/40 bg-surface-hover/20 flex justify-between items-center shrink-0">
                            <button
                                type="button"
                                onClick={() => setImportResolution(prev => ({ ...prev, isOpen: false }))}
                                className="btn btn-secondary px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                            >
                                Cancelar Importación
                            </button>
                            <button
                                type="button"
                                disabled={saving || (selectedResolutionOption === 'link' && !selectedLinkCandidateId)}
                                onClick={() => {
                                    const currentItem = importResolution.unresolvedItems[importResolution.currentIndex];
                                    const nextIndex = importResolution.currentIndex + 1;
                                    const updatedResults = [
                                        ...importResolution.resolvedResults,
                                        {
                                            type: selectedResolutionOption,
                                            dbCandidateId: selectedResolutionOption === 'link' ? selectedLinkCandidateId : null,
                                            item: currentItem
                                        }
                                    ];

                                    if (nextIndex < importResolution.unresolvedItems.length) {
                                        const nextItem = importResolution.unresolvedItems[nextIndex];
                                        setImportResolution(prev => ({
                                            ...prev,
                                            currentIndex: nextIndex,
                                            resolvedResults: updatedResults
                                        }));
                                        setSelectedResolutionOption(nextItem.suggestions.length > 0 ? 'link' : 'create');
                                        setSelectedLinkCandidateId(nextItem.suggestions.length > 0 ? nextItem.suggestions[0].id : '');
                                        setResolutionSearchText('');
                                    } else {
                                        saveResolvedImport(updatedResults, importResolution.candidatesToUpsert, importResolution.currentCandidates);
                                    }
                                }}
                                className="btn btn-primary bg-accent hover:bg-accent-hover text-white border-none px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                            >
                                <span>
                                    {importResolution.currentIndex + 1 === importResolution.unresolvedItems.length 
                                        ? 'Finalizar y Guardar' 
                                        : 'Confirmar y Continuar'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal: Interactive Duplicate Resolution */}
            {isDuplicatesModalOpen && createPortal(
                <div 
                    className="fixed inset-0 bg-black/85 backdrop-blur-md flex justify-center items-center p-4 overflow-y-auto font-sans"
                    style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div 
                        className="bg-surface border border-color rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', position: 'relative', zIndex: 1000000 }}
                    >
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-5 border-b border-color/50 bg-surface-hover/50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-lg text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                                    <Users size={20} className="text-accent" />
                                    <span>Gestión de Postulantes Duplicados</span>
                                </h3>
                                <p className="text-xs text-secondary mt-1">
                                    Detecta posibles candidatos duplicados en base a nombres similares, inversiones o datos de contacto.
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsDuplicatesModalOpen(false)} 
                                className="text-secondary hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                            {duplicatePairs.length === 0 ? (
                                <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success">
                                        <CheckCircle size={36} />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-base text-[var(--text-primary)]">¡No se detectaron duplicados!</h4>
                                        <p className="text-xs text-secondary mt-1">Todos los registros de postulantes parecen únicos y limpios.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsDuplicatesModalOpen(false)}
                                        className="btn btn-secondary px-5 py-2.5 rounded-xl text-xs font-bold"
                                    >
                                        Cerrar Panel
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-3 bg-accent/5 border border-accent/15 rounded-xl text-xs text-secondary flex items-start gap-2 leading-relaxed">
                                        <Info size={16} className="text-accent shrink-0 mt-0.5" />
                                        <span>
                                            Se han detectado <strong>{duplicatePairs.length} pares de posibles duplicados</strong>. Puedes fusionar un registro en el otro (conservando evaluaciones e historial), eliminar registros sobrantes o ignorar la sugerencia si se trata de personas diferentes.
                                        </span>
                                    </div>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                        {duplicatePairs.map((pair, index) => {
                                            const { candidateA: a, candidateB: b, isExact } = pair;
                                            const key = [a.id, b.id].sort().join('-');

                                            return (
                                                <div key={key} className="p-4 bg-main/30 border border-color rounded-2xl space-y-4 relative">
                                                    {/* Badge Exact vs Partial */}
                                                    <div className="flex justify-between items-center border-b border-color/40 pb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary">
                                                            Caso #{index + 1}
                                                        </span>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                                            isExact 
                                                                ? 'bg-success/10 text-success border border-success/20' 
                                                                : 'bg-warning/10 text-warning border border-warning/20'
                                                        }`}>
                                                            {isExact ? 'Coincidencia Exacta' : 'Coincidencia Parcial'}
                                                        </span>
                                                    </div>

                                                    {/* Side by Side Candidates info */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Candidate A Card */}
                                                        <div className="p-3 bg-surface border border-color/40 rounded-xl space-y-2">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <span className="font-extrabold text-sm text-[var(--text-primary)] block">
                                                                        {a.first_name} {a.last_name || ''}
                                                                    </span>
                                                                    <span className="text-xs text-secondary font-medium font-mono block truncate">{a.email}</span>
                                                                </div>
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
                                                                    A
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-color/20 pt-2 text-secondary font-semibold">
                                                                <div>Evaluaciones: <span className="font-bold text-[var(--text-primary)]">{(a.reviews || []).length}</span></div>
                                                                <div>Decisión: <span className="font-bold text-accent">{a.decision}</span></div>
                                                                <div className="col-span-2 truncate">Entrevistado: <span className="font-bold text-[var(--text-primary)]">{a.interview_date ? 'Sí' : 'No'}</span></div>
                                                            </div>
                                                        </div>

                                                        {/* Candidate B Card */}
                                                        <div className="p-3 bg-surface border border-color/40 rounded-xl space-y-2">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <span className="font-extrabold text-sm text-[var(--text-primary)] block">
                                                                        {b.first_name} {b.last_name || ''}
                                                                    </span>
                                                                    <span className="text-xs text-secondary font-medium font-mono block truncate">{b.email}</span>
                                                                </div>
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 uppercase">
                                                                    B
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-color/20 pt-2 text-secondary font-semibold">
                                                                <div>Evaluaciones: <span className="font-bold text-[var(--text-primary)]">{(b.reviews || []).length}</span></div>
                                                                <div>Decisión: <span className="font-bold text-accent">{b.decision}</span></div>
                                                                <div className="col-span-2 truncate">Entrevistado: <span className="font-bold text-[var(--text-primary)]">{b.interview_date ? 'Sí' : 'No'}</span></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Control buttons inside card */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-color/40 pt-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMergeCandidates(a, b, isExact)}
                                                                className="px-3 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                                                                title="Combina los datos de B dentro de A, y elimina B"
                                                            >
                                                                <Check size={12} />
                                                                <span>Fusionar B en A (Mantener A)</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMergeCandidates(b, a, isExact)}
                                                                className="px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                                                                title="Combina los datos de A dentro de B, y elimina A"
                                                            >
                                                                <Check size={12} />
                                                                <span>Fusionar A en B (Mantener B)</span>
                                                            </button>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteFromDuplicates(a.id, `${a.first_name} ${a.last_name || ''}`)}
                                                                className="p-2 hover:bg-error/15 text-secondary hover:text-error rounded-xl border border-color hover:border-error/20 transition-all cursor-pointer"
                                                                title="Eliminar candidato A permanentemente"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteFromDuplicates(b.id, `${b.first_name} ${b.last_name || ''}`)}
                                                                className="p-2 hover:bg-error/15 text-secondary hover:text-error rounded-xl border border-color hover:border-error/20 transition-all cursor-pointer"
                                                                title="Eliminar candidato B permanentemente"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleIgnorePair(a.id, b.id)}
                                                                className="px-3 py-2 bg-surface hover:bg-surface-hover border border-color rounded-xl text-xs font-bold text-secondary cursor-pointer"
                                                            >
                                                                Ignorar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-color/40 bg-surface-hover/20 flex justify-end items-center shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsDuplicatesModalOpen(false)}
                                className="btn btn-secondary px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
