import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
    Home, AlertTriangle, Package, Users, LogOut, Settings, Menu, X, 
    BookOpen, ClipboardList, Bell, Trash2, CheckCircle, BarChart2,
    ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import RedCardDashboard from './RedCardDashboard';
import TeacherManagement from './TeacherManagement';
import TeacherProfile from './TeacherProfile';
import PanolDashboard from './PanolDashboard';
import GeneralDashboard from './GeneralDashboard';
import SubjectManagement from './SubjectManagement';
import CoordinationSpace from './CoordinationSpace';
import AuditManagement from './AuditManagement';
import AnomalyDashboard from './AnomalyDashboard';
import EditMyProfileModal from '../components/EditMyProfileModal';
import GlobalSettings from './GlobalSettings';

export default function Dashboard() {
    const { userProfile, role, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState('inicio');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedTeacherId, setSelectedTeacherId] = useState(null);
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [is5sDropdownOpen, setIs5sDropdownOpen] = useState(true);

    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    const fetchNotifications = async () => {
        if (!userProfile) return;
        try {
            let query = supabase
                .from('notifications')
                .select('*');

            if (role === 'gerente' || role === 'coordinador' || role === 'panol') {
                query = query.or(`user_id.eq.${userProfile.id},user_id.is.null`);
            } else {
                query = query.eq('user_id', userProfile.id);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(40);

            if (error) throw error;
            setNotifications(data || []);
        } catch {
            const local = JSON.parse(localStorage.getItem('etrr-notifications') || '[]');
            const filtered = local.filter(n => {
                if (role === 'gerente' || role === 'coordinador' || role === 'panol') {
                    return !n.user_id || n.user_id === userProfile.id;
                } else {
                    return n.user_id === userProfile.id;
                }
            });
            setNotifications(filtered);
        }
    };

    const markAllNotificationsAsRead = async () => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('is_read', false);
            await fetchNotifications();
        } catch {
            const local = JSON.parse(localStorage.getItem('etrr-notifications') || '[]');
            const updated = local.map(n => ({ ...n, is_read: true }));
            localStorage.setItem('etrr-notifications', JSON.stringify(updated));
            setNotifications(updated);
        }
    };

    const clearAllNotifications = async () => {
        try {
            await supabase
                .from('notifications')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            await fetchNotifications();
        } catch {
            localStorage.removeItem('etrr-notifications');
            setNotifications([]);
        }
    };

    useEffect(() => {
        if (!userProfile) return;
        fetchNotifications();
        const handleNewNotif = () => fetchNotifications();
        window.addEventListener('etrr-new-notification', handleNewNotif);
        const interval = setInterval(fetchNotifications, 10000);

        return () => {
            window.removeEventListener('etrr-new-notification', handleNewNotif);
            clearInterval(interval);
        };
    }, [userProfile, role]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const navItems = [
        { id: 'inicio', label: 'Inicio', icon: <Home size={20} />, roles: ['gerente', 'coordinador', 'docente', 'panol'] },
        { id: 'coordinacion', label: 'Coordinación', icon: <ClipboardList size={20} />, roles: ['gerente', 'coordinador', 'docente'] },
        { id: '5s', label: 'Tarjetas Rojas 5S', icon: <AlertTriangle size={20} />, roles: ['gerente', 'coordinador', 'docente'], group: '5s' },
        { id: 'auditorias', label: 'Auditorías 5S', icon: <BarChart2 size={20} />, roles: ['gerente', 'coordinador'], group: '5s' },
        { id: 'anomalias', label: 'Informe de Anomalías 5S', icon: <FileText size={20} />, roles: ['gerente', 'coordinador', 'docente'], group: '5s' },
        { id: 'panol', label: 'Pañol', icon: <Package size={20} />, roles: ['gerente', 'coordinador', 'docente', 'panol'] },
        { id: 'docentes', label: 'Docentes', icon: <Users size={20} />, roles: ['gerente', 'coordinador'] },
        { id: 'materias', label: 'Materias', icon: <BookOpen size={20} />, roles: ['gerente', 'coordinador'] },
        { id: 'mi_perfil', label: 'Mi Perfil Docente', icon: <Users size={20} />, roles: ['docente'] },
    ];

    const menuStructure = [];
    let added5sGroup = false;

    navItems.forEach(item => {
        if (!item.roles.includes(role)) return;

        if (item.group === '5s') {
            if (!added5sGroup) {
                menuStructure.push({
                    type: 'group',
                    id: '5s_group',
                    label: 'Gestión 5S',
                    icon: <ClipboardList size={20} />,
                    items: navItems.filter(sub => sub.group === '5s' && sub.roles.includes(role))
                });
                added5sGroup = true;
            }
        } else {
            menuStructure.push({
                type: 'item',
                ...item
            });
        }
    });

    const handleTabChange = (id) => {
        setActiveTab(id);
        setIsSidebarOpen(false); // Close sidebar on mobile after navigating
        setSelectedTeacherId(null);
    };

    const handleViewTeacher = (id) => {
        setSelectedTeacherId(id);
        setActiveTab('perfil_docente');
    };

    return (
        <div className="flex h-screen bg-main overflow-hidden relative">

            {/* Mobile Header / Hamburger Menu */}
            <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-surface-hover/80 backdrop-blur-md border-b border-color/50 z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                    </div>
                    <span className="font-bold text-[var(--text-primary)] tracking-tight">ETRR Docentes</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2 text-secondary hover:text-[var(--text-primary)] rounded-lg hover:bg-surface-hover transition-colors relative"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error"></span>
                        )}
                    </button>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 text-secondary hover:text-[var(--text-primary)] rounded-lg hover:bg-surface-hover transition-colors"
                    >
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed md:relative top-0 left-0 h-full w-72 bg-surface/95 md:bg-surface/50 border-r border-color/50 flex flex-col items-center py-8 px-4 z-50 md:z-20 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

                {/* Mobile close button inside sidebar */}
                <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden absolute top-4 right-4 p-2 text-secondary hover:text-[var(--text-primary)] rounded-xl hover:bg-surface-hover transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="w-full text-center mt-4 md:mt-0 mb-10">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl mx-auto mb-3 flex items-center justify-center border border-primary/20 shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                    </div>
                    <h1 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight drop-shadow-sm">ETRR Docentes</h1>
                    <p className="text-[10px] text-primary font-bold mt-1 tracking-widest uppercase bg-primary/10 inline-block px-2 py-0.5 rounded-full border border-primary/20 shadow-sm">{role}</p>
                </div>

                <nav className="flex-1 w-full space-y-1 overflow-y-auto custom-scrollbar pr-1">
                    {menuStructure.map((menuItem) => {
                        if (menuItem.type === 'group') {
                            const isChildActive = menuItem.items.some(child => activeTab === child.id);
                            return (
                                <div key={menuItem.id} className="space-y-1 w-full">
                                    <button
                                        onClick={() => setIs5sDropdownOpen(!is5sDropdownOpen)}
                                        className={`flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-left transition-all duration-200 group relative ${
                                            isChildActive 
                                                ? 'bg-primary/5 text-primary font-bold border border-primary/10 shadow-sm' 
                                                : 'text-secondary hover:bg-surface-hover/80 hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-tertiary group-hover:text-primary transition-colors">
                                                {menuItem.icon}
                                            </span>
                                            <span className="text-[15px]">{menuItem.label}</span>
                                        </div>
                                        <span className="text-tertiary mr-1">
                                            {is5sDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </span>
                                    </button>
                                    {is5sDropdownOpen && (
                                        <div className="pl-4 border-l border-color/60 ml-6 space-y-1 mt-1">
                                            {menuItem.items.map((child) => (
                                                <button
                                                    key={child.id}
                                                    onClick={() => handleTabChange(child.id)}
                                                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-left transition-all duration-200 group relative ${
                                                        activeTab === child.id
                                                            ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-sm'
                                                            : 'text-secondary hover:bg-surface-hover/80 hover:text-[var(--text-primary)]'
                                                    }`}
                                                >
                                                    {activeTab === child.id && (
                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full shadow-[0_0_8px_var(--color-primary)]"></span>
                                                    )}
                                                    <span className={`${activeTab === child.id ? 'text-primary' : 'text-tertiary group-hover:text-primary transition-colors'}`}>
                                                        {child.icon}
                                                    </span>
                                                    <span className="text-[14px]">{child.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        } else {
                            return (
                                <button
                                    key={menuItem.id}
                                    onClick={() => handleTabChange(menuItem.id)}
                                    className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-all duration-200 group relative ${activeTab === menuItem.id
                                        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-sm'
                                        : 'text-secondary hover:bg-surface-hover/80 hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    {activeTab === menuItem.id && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full shadow-[0_0_8px_var(--color-primary)]"></span>
                                    )}
                                    <span className={`${activeTab === menuItem.id ? 'text-primary' : 'text-tertiary group-hover:text-primary transition-colors'}`}>
                                        {menuItem.icon}
                                    </span>
                                    <span className="text-[15px]">{menuItem.label}</span>
                                </button>
                            );
                        }
                    })}
                </nav>

                <div className="w-full border-t border-color/50 pt-6 mt-6 shrink-0">
                    <button
                        onClick={() => setIsEditProfileOpen(true)}
                        className="w-full text-left px-4 py-3 mb-4 bg-surface-hover/50 hover:bg-surface-hover rounded-xl border border-color/30 flex items-center gap-3 shadow-inner transition-colors group cursor-pointer"
                        title="Editar mi perfil"
                    >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 group-hover:scale-105 transition-transform">
                            {userProfile?.photo_url ? (
                                <img src={userProfile.photo_url} alt={`${userProfile?.first_name} ${userProfile?.last_name}`} className="w-full h-full object-cover" />
                            ) : (
                                userProfile?.first_name?.charAt(0) || 'U'
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-[var(--text-primary)] truncate drop-shadow-sm group-hover:text-primary transition-colors">{userProfile?.first_name} {userProfile?.last_name}</p>
                            <p className="text-xs text-tertiary truncate font-medium group-hover:text-secondary transition-colors">Ver Perfil</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-left transition-all mb-1 group cursor-pointer relative ${
                            showNotifications 
                                ? 'bg-primary/10 text-primary font-bold shadow-sm' 
                                : 'text-secondary hover:bg-surface-hover hover:text-[var(--text-primary)]'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <Bell size={18} className={showNotifications ? 'text-primary' : 'text-tertiary group-hover:text-[var(--text-primary)] transition-colors'} />
                            <span className="text-sm font-semibold">Notificaciones</span>
                        </div>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-[9px] font-black bg-error text-white rounded-full leading-none animate-pulse">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => handleTabChange('configuracion')}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all mb-1 group cursor-pointer ${
                            activeTab === 'configuracion' 
                                ? 'bg-primary/10 text-primary font-bold shadow-sm' 
                                : 'text-secondary hover:bg-surface-hover hover:text-[var(--text-primary)]'
                        }`}
                    >
                        <Settings size={18} className={activeTab === 'configuracion' ? 'text-primary' : 'text-tertiary group-hover:text-[var(--text-primary)] transition-colors'} />
                        <span className="text-sm font-semibold">Configuración</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-error hover:bg-error/10 hover:border-error/20 border border-transparent transition-all group hover:shadow-sm"
                    >
                        <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
                        <span className="text-sm font-semibold">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto h-full relative pt-16 md:pt-0">
                {/* Decorative subtle background overlay to main content */}
                <div className="absolute inset-0 bg-gradient-to-br from-surface-hover/10 to-transparent pointer-events-none z-0"></div>

                {/* Floating Bell Button for Desktop in Top-Right Corner */}
                <div className="hidden md:flex absolute top-6 right-8 z-30">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`p-3 rounded-2xl bg-surface/85 backdrop-blur-md border shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all relative cursor-pointer group ${
                            showNotifications 
                                ? 'border-primary/40 text-primary bg-primary/5 shadow-inner' 
                                : 'border-color/60 text-secondary hover:text-primary hover:border-primary/30'
                        }`}
                        title="Notificaciones"
                    >
                        <Bell size={20} className={showNotifications ? 'animate-bounce' : 'group-hover:scale-105 transition-transform'} />
                        {unreadCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error border border-surface animate-pulse"></span>
                        )}
                    </button>
                </div>

                <div className="relative z-10 w-full min-h-full">
                    {activeTab === 'inicio' && <GeneralDashboard onNavigate={handleTabChange} />}
                    {activeTab === 'coordinacion' && <CoordinationSpace />}
                    {activeTab === 'auditorias' && <AuditManagement />}
                    {activeTab === '5s' && <RedCardDashboard />}
                    {activeTab === 'anomalias' && <AnomalyDashboard />}
                    {activeTab === 'docentes' && <TeacherManagement onViewTeacher={handleViewTeacher} />}
                    {activeTab === 'materias' && <SubjectManagement />}
                    {activeTab === 'mi_perfil' && <TeacherProfile />}
                    {activeTab === 'perfil_docente' && <TeacherProfile teacherId={selectedTeacherId} onBack={() => handleTabChange('docentes')} />}
                    {activeTab === 'panol' && <PanolDashboard />}
                    {activeTab === 'configuracion' && <GlobalSettings />}
                </div>

                {/* Glassmorphic Real-Time Notification Center Drawer */}
                {showNotifications && (
                    <div className="fixed inset-x-0 bottom-0 md:inset-x-auto md:right-8 md:top-20 w-full md:w-96 h-[80vh] md:h-[500px] bg-surface/95 backdrop-blur-xl border border-color/60 md:rounded-2xl z-[99] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        {/* Popover Header */}
                        <div className="p-4 border-b border-color flex justify-between items-center bg-surface-hover/20">
                            <div className="flex items-center gap-2">
                                <Bell className="text-primary animate-bounce" size={18} />
                                <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Notificaciones</h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {notifications.length > 0 && (
                                    <>
                                        <button 
                                            onClick={markAllNotificationsAsRead}
                                            className="p-1.5 rounded-lg text-secondary hover:bg-primary/10 hover:text-primary transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                                            title="Marcar todas como leídas"
                                        >
                                            <CheckCircle size={15} />
                                            <span className="hidden sm:inline text-[9px] font-bold">Marcar todo</span>
                                        </button>
                                        <button 
                                            onClick={clearAllNotifications}
                                            className="p-1.5 rounded-lg text-error hover:bg-error/10 hover:text-error-hover transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                                            title="Eliminar historial"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={() => setShowNotifications(false)}
                                    className="p-1.5 rounded-lg text-secondary hover:bg-surface-hover hover:text-[var(--text-primary)] transition-all cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Popover Body (List) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-main/5">
                            {notifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                    <div className="w-12 h-12 rounded-full border border-color flex items-center justify-center mb-3">
                                        <Bell size={20} className="text-tertiary" />
                                    </div>
                                    <p className="text-secondary text-sm font-medium">No tienes notificaciones pendientes.</p>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif.id}
                                        className={`p-3.5 rounded-2xl border transition-all flex gap-3 relative ${
                                            notif.is_read 
                                                ? 'bg-surface-hover/20 border-color/30 opacity-70' 
                                                : 'bg-surface border-primary/20 shadow-md shadow-primary/[0.02] hover:border-primary/40'
                                        }`}
                                    >
                                        {!notif.is_read && (
                                            <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"></span>
                                        )}
                                        <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-base font-bold border ${
                                            notif.category === 'red_card' 
                                                ? 'bg-error/10 border-error/20 text-error' 
                                                : notif.category === 'coordination' 
                                                    ? 'bg-accent/10 border-accent/20 text-accent' 
                                                    : 'bg-primary/10 border-primary/20 text-primary'
                                        }`}>
                                            {notif.category === 'red_card' ? '🚨' : notif.category === 'coordination' ? '📋' : '🔔'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-black text-[var(--text-primary)] leading-tight ${!notif.is_read ? 'text-primary' : ''}`}>
                                                {notif.title}
                                            </p>
                                            <p className="text-[11px] text-secondary mt-1 font-medium leading-relaxed break-words">
                                                {notif.content}
                                            </p>
                                            <p className="text-[9px] text-tertiary mt-2 font-mono">
                                                {new Date(notif.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

            <EditMyProfileModal
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
            />
        </div>
    );
}
