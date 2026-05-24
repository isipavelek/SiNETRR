import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';

export default function ReportModal({ isOpen, onClose, onGenerate }) {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sectors, setSectors] = useState([]);
    const [selectedSector, setSelectedSector] = useState('');

    useEffect(() => {
        const fetchSectors = async () => {
            const { data, error } = await supabase
                .from('red_cards')
                .select('sector')
                .not('sector', 'is', null)
                .order('sector');

            if (!error && data) {
                const uniqueSectors = [...new Set(data.map(item => item.sector))];
                setSectors(uniqueSectors);
            }
        };

        if (isOpen) {
            fetchSectors();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onGenerate(startDate, endDate, selectedSector);
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999] p-4">
            <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in-up border border-color">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] relative z-10 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>
                        Generar Informe 5S
                    </h2>
                    <button onClick={onClose} className="text-tertiary hover:text-error transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider font-bold text-tertiary mb-1">Fecha de Inicio</label>
                        <input
                            type="date"
                            required
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-main border border-color rounded-lg px-3 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase tracking-wider font-bold text-tertiary mb-1">Fecha de Fin</label>
                        <input
                            type="date"
                            required
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-main border border-color rounded-lg px-3 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-wider font-bold text-tertiary mb-1">Sector (Opcional)</label>
                        <select
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className="w-full bg-main border border-color rounded-lg px-3 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                        >
                            <option value="">Todos los Sectores</option>
                            {sectors.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-color mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-color rounded-lg text-secondary hover:bg-surface-hover transition-colors font-medium text-sm">
                            Cancelar
                        </button>
                        <button type="submit" className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover shadow-md transition-all font-bold text-sm">
                            Ir al Reporte
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
