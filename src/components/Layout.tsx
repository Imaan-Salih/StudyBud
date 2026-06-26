import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, MessageSquare, BrainCircuit, LogOut, Clock, Settings as SettingsIcon, WifiOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'motion/react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: BookOpen, label: 'Dashboard' },
    { to: '/tutor', icon: MessageSquare, label: 'AI Tutor' },
    { to: '/quizzes', icon: BrainCircuit, label: 'Quizzes' },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="flex h-[100dvh] bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700 transition-colors">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-full flex-shrink-0 flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            StudyBud
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img
              src={user?.photoURL || 'https://ui-avatars.com/api/?name=' + user?.displayName}
              alt="Profile"
              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] md:pb-0 relative">
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-2 z-50 shadow-md"
          >
            <WifiOff className="w-5 h-5" />
            <span className="font-medium text-sm">You are offline. Please check your connection to avoid losing progress.</span>
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          {outlet ? React.cloneElement(outlet as React.ReactElement, { key: location.pathname }) : null}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-white border-t border-slate-200 dark:bg-slate-800 dark:border-slate-700 z-50 flex items-center justify-around px-2 transition-colors">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
