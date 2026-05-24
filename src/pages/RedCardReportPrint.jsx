import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import logo5S from '../assets/logo5S.png';

const formatLocalDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('es-AR');
};

export default function RedCardReportPrint() {
    const [searchParams] = useSearchParams();
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const sectorParam = searchParams.get('sector');
    const subjectParam = searchParams.get('subject');
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReportData = async () => {
            setLoading(true);
            try {
                // Ensure date format includes the end of the day for the end date
                const endDateAdjusted = new Date(end);
                endDateAdjusted.setHours(23, 59, 59, 999);

                let query = supabase
                    .from('red_cards')
                    .select('*, assignee:responsible_id(first_name, last_name)')
                    .gte('date', start)
                    .lte('date', endDateAdjusted.toISOString());

                if (sectorParam) {
                    query = query.eq('sector', sectorParam);
                }

                if (subjectParam) {
                    query = query.eq('subject', subjectParam);
                } else {
                    query = query.neq('subject', 'ANOMALIA');
                }

                const { data, error } = await query.order('date', { ascending: false });

                if (error) throw error;
                setCards(data);

                // Allow time for loading/rendering before popping print
                setTimeout(() => {
                    window.print();
                }, 1500);

            } catch (err) {
                console.error("Error fetching report data:", err);
            } finally {
                setLoading(false);
            }
        };

        if (start && end) {
            fetchReportData();
        }
    }, [start, end, sectorParam, subjectParam]);

    if (loading) return <div className="p-10 font-mono text-center text-gray-600 bg-white min-h-screen">Generando reporte 5S...</div>;

    // Grouping logic
    const getGroupedData = () => {
        const grouped = {};
        
        cards.forEach(card => {
            const sec = card.sector || 'Sin Sector';
            const progress = card.coordinator_notes || ''; // empty string if undefined/null
            
            if (!grouped[sec]) {
                grouped[sec] = {};
            }
            if (!grouped[sec][progress]) {
                grouped[sec][progress] = [];
            }
            grouped[sec][progress].push(card);
        });

        const sortedSectors = Object.keys(grouped).sort();

        const getProgressVal = (p) => {
            if (p === '') return -1;
            return parseInt(p, 10);
        };

        return sortedSectors.map(sec => {
            const progresses = Object.keys(grouped[sec])
                .sort((a, b) => getProgressVal(a) - getProgressVal(b))
                .map(prog => ({
                    progress: prog,
                    cards: grouped[sec][prog]
                }));
            return {
                sector: sec,
                progresses
            };
        });
    };

    const groupedData = getGroupedData();

    return (
        <div className="bg-white text-black min-h-screen p-8 print:p-0">
            {/* Report Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-400 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    {/* Logo 5S */}
                    <div className="flex items-center justify-center border-r-2 border-gray-300 pr-4">
                        <img src={logo5S} alt="Logo 5S" className="h-16 w-auto object-contain" />
                    </div>
                    {/* Title */}
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 tracking-tight">
                            {subjectParam === 'ANOMALIA' 
                                ? 'INFORME DE ANOMALÍAS 5S' 
                                : 'INFORME DE AVANCES PRIMERA S - TARJETAS ROJA'}
                        </h1>
                        <p className="text-xs text-gray-600 font-mono mt-1 font-bold">
                            Período: {formatLocalDate(start)} al {formatLocalDate(end)}
                        </p>
                    </div>
                </div>
                <div className="text-right text-xs text-gray-500 font-mono font-bold">
                    Generado el {new Date().toLocaleDateString('es-AR')}
                </div>
            </div>

            {groupedData.length === 0 ? (
                <div className="text-center italic text-gray-500 py-10">No se registraron tarjetas rojas en este período.</div>
            ) : (
                <div className="space-y-6">
                    {groupedData.map((secGroup) => (
                        <div key={secGroup.sector} className="print:break-inside-avoid">
                            {/* Sector Gray Bar Header */}
                            <div 
                                style={{ backgroundColor: '#c5c3c0', color: '#ffffff' }}
                                className="w-full font-bold px-3 py-1.5 text-base uppercase tracking-wide rounded-sm mb-4"
                            >
                                {secGroup.sector}
                            </div>

                            {/* Progress Subgroups */}
                            {secGroup.progresses.map((progGroup) => (
                                <div key={progGroup.progress} className="mb-6 pl-1">
                                    <div className="text-xs font-black tracking-wider uppercase text-gray-700 mb-2">
                                        AVANCE %: {progGroup.progress}
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-xs mb-4">
                                            <thead>
                                                <tr className="border-b border-gray-300 text-left text-gray-500 font-bold">
                                                    <th className="py-2 pr-2 font-black text-gray-600 w-12">ID</th>
                                                    <th className="py-2 px-2 font-black text-gray-600 w-24">Asignatura</th>
                                                    <th className="py-2 px-2 font-black text-gray-600 w-44">Docente Asignatura</th>
                                                    <th className="py-2 px-2 font-black text-gray-600 w-48">Elemento</th>
                                                    <th className="py-2 px-2 font-black text-gray-600">Causa del desvío</th>
                                                    <th className="py-2 px-2 font-black text-gray-600 w-44">Responsable resolución</th>
                                                    <th className="py-2 pl-2 font-black text-gray-600 text-right w-28">Fecha comprom.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {progGroup.cards.map((card) => (
                                                    <tr key={card.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                                        <td className="py-2 pr-2 font-bold text-gray-800">{card.card_number}</td>
                                                        <td className="py-2 px-2 font-bold text-gray-700">{card.subject || 'PT'}</td>
                                                        <td className="py-2 px-2 text-gray-600">{card.teacher_responsible}</td>
                                                        <td className="py-2 px-2 text-gray-600 font-medium">{card.element}</td>
                                                        <td className="py-2 px-2 text-gray-600 break-words">{card.problem_description}</td>
                                                        <td className="py-2 px-2 text-gray-600">
                                                            {card.assignee ? `${card.assignee.last_name} ${card.assignee.first_name}` : ''}
                                                        </td>
                                                        <td className="py-2 pl-2 text-right text-gray-700 font-mono font-bold whitespace-nowrap">
                                                            {formatLocalDate(card.deadline)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @media print {
                    body { background: white !important; color: black !important; }
                    .print\\:break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                    @page { margin: 1.5cm; }
                }
            `}</style>
        </div>
    );
}
