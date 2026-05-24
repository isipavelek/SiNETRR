import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

export default function AddSubjectModal({ isOpen, onClose, teacher, onSubjectAdded }) {
    const [courses, setCourses] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        courseId: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [subjectsCatalog, setSubjectsCatalog] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchCourses();
            fetchCatalog();
            setFormData({ name: '', courseId: '' }); // Reset form
            setError('');
        }
    }, [isOpen]);

    const fetchCatalog = async () => {
        try {
            const { data, error } = await supabase.from('subjects_catalog').select('*').order('name');
            if (error) throw error;
            setSubjectsCatalog(data || []);
        } catch (err) { console.error('Error fetching subjects catalog:', err); }
    };

    const fetchCourses = async () => {
        try {
            const { data, error } = await supabase.from('courses').select('id, name, level').order('level');
            if (error) throw error;
            setCourses(data || []);
            if (data && data.length > 0) {
                setFormData(prev => ({ ...prev, courseId: data[0].id }));
            }
        } catch (err) {
            console.error('Error fetching courses:', err);
        }
    };

    if (!isOpen || !teacher) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: insertError } = await supabase.from('subjects').insert([{
                name: formData.name,
                course_id: formData.courseId,
                teacher_id: teacher.id
            }]);

            if (insertError) throw insertError;

            onSubjectAdded();
            onClose();
        } catch (err) {
            setError(err.message || 'Error al asignar la materia.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in-up">
            <div className="bg-surface border border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative z-[10000]">
                <div className="flex justify-between items-center p-6 border-b border-color/50 bg-surface-hover/50">
                    <div>
                        <h3 className="font-bold text-xl text-[var(--text-primary)] tracking-tight">Asignar Materia</h3>
                        <p className="text-secondary text-sm mt-1">A: {teacher.first_name} {teacher.last_name}</p>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-[40px] pointer-events-none"></div>

                    {error && (
                        <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg flex items-center gap-3">
                            <X size={16} /> <span>{error}</span>
                        </div>
                    )}

                    <div className="relative z-10 w-full">
                        <label className="text-sm font-semibold mb-1 block text-secondary">Curso Asociado</label>
                        <select
                            required
                            value={formData.courseId}
                            onChange={e => setFormData({ ...formData, courseId: e.target.value, name: '' })}
                            className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                        >
                            <option value="">Seleccione un curso...</option>
                            {courses.map(course => (
                                <option key={course.id} value={course.id} className="bg-surface text-[var(--text-primary)]">
                                    {course.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative z-10 w-full">
                        <label className="text-sm font-semibold mb-1 block text-secondary">Nombre de la Materia</label>
                        <select
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="bg-main/50 border-color/50 text-[var(--text-primary)] w-full"
                            disabled={!formData.courseId}
                        >
                            <option value="">Seleccione la materia...</option>
                            {subjectsCatalog.filter(sub => {
                                if (!formData.courseId) return true;
                                const selectedCourse = courses.find(c => c.id === formData.courseId);
                                if (!selectedCourse) return true;
                                const isBasic = selectedCourse.level <= 3;
                                return isBasic ? sub.level?.startsWith('Básic') : sub.level?.startsWith('Superior');
                            }).map(sub => (
                                <option key={sub.id} value={sub.name} className="bg-surface text-[var(--text-primary)]">
                                    {sub.abbreviation ? `${sub.abbreviation} - ` : ''}{sub.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn bg-accent text-[var(--text-primary)] hover:bg-[#7c3aed] w-full mt-4 h-12 shadow-lg relative z-10 border-none transition-all"
                    >
                        {loading ? 'Asignando...' : 'Asignar Materia'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}
