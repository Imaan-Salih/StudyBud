import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { auth } from '../firebase';
import { updateEmail, updatePassword, deleteUser } from 'firebase/auth';
import { Settings as SettingsIcon, Moon, Sun, Mail, Lock, Trash2, Heart, AlertCircle, LogOut, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Modal } from '../components/Modal';

export const Settings = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('custom_gemini_api_key') || '');

  const handleSaveApiKey = () => {
    if (customApiKey.trim()) {
      localStorage.setItem('custom_gemini_api_key', customApiKey.trim());
      setMessage({ type: 'success', text: 'Custom API Key saved successfully! It will be used for AI features.' });
    } else {
      localStorage.removeItem('custom_gemini_api_key');
      setMessage({ type: 'success', text: 'Custom API Key removed. Using default quota.' });
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newEmail) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await updateEmail(auth.currentUser, newEmail);
      setMessage({ type: 'success', text: 'Email updated successfully!' });
      setNewEmail('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Please log out and log back in to update your email.' });
      } else {
        setMessage({ type: 'error', text: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newPassword) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await updatePassword(auth.currentUser, newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Please log out and log back in to update your password.' });
      } else {
        setMessage({ type: 'error', text: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteAccount = () => {
    setDeleteModalOpen(true);
    setDeleteConfirmation('');
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    if (deleteConfirmation !== 'DELETE') return;

    setLoading(true);
    try {
      await deleteUser(auth.currentUser);
      setDeleteModalOpen(false);
      navigate('/login');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Please log out and log back in to delete your account.' });
      } else {
        setMessage({ type: 'error', text: error.message });
      }
      setLoading(false);
      setDeleteModalOpen(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors"
    >
      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-500" />
            Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Manage your account preferences and application settings.</p>
        </header>

        {message.text && (
          <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Appearance */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm transition-colors">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Appearance</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">Dark Mode</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Toggle between light and dark themes.</p>
              </div>
              <button 
                onClick={toggleTheme}
                className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors self-start sm:self-auto"
              >
                {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </button>
            </div>
          </section>

          {/* API Settings */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm transition-colors">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-indigo-500" />
              API Settings
            </h2>
            <div className="mb-4">
              <h3 className="font-medium text-slate-900 dark:text-white">Custom Gemini API Key (Optional)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                If you are running into quota limits, you can provide your own free Google Gemini API key to get unlimited access. 
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1">
                  Get a free key here.
                </a>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  />
                </div>
                <button 
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  Save Key
                </button>
              </div>
            </div>
          </section>

          {/* Account Settings */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm transition-colors">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Account Settings</h2>
            
            <form onSubmit={handleUpdateEmail} className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Update Email Address</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={user?.email || "New email address"}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading || !newEmail}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  Update Email
                </button>
              </div>
            </form>

            <form onSubmit={handleUpdatePassword} className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Update Password</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={loading || !newPassword || newPassword.length < 6}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  Update Password
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 md:hidden">
              <button 
                onClick={() => { logout(); navigate('/login'); }}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </section>

          {/* Recycle Bin */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Trash2 className="w-6 h-6 text-slate-500" />
                  Recycle Bin
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Restore deleted items or empty the bin.</p>
              </div>
              <button 
                onClick={() => navigate('/recycle-bin')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                View Bin
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30 p-6 shadow-sm transition-colors">
            <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              Danger Zone
            </h2>
            <p className="text-sm text-red-600 dark:text-red-300 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button 
              onClick={confirmDeleteAccount}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Delete Account
            </button>
          </section>

          {/* Credits */}
          <section className="flex justify-center pt-8 pb-4">
            <button 
              onClick={() => setShowCredits(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              View Credits
            </button>
          </section>
          
          {showCredits && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-md overflow-hidden cursor-pointer" 
              onClick={() => setShowCredits(false)}
            >
              <motion.div 
                initial={{ y: "100vh" }}
                animate={{ y: "-100vh" }}
                transition={{ duration: 12, ease: "linear", repeat: Infinity }}
                className="text-center w-full px-4"
              >
                <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/50">
                  <BrainCircuit className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-5xl font-extrabold text-white mb-16 tracking-[0.2em] drop-shadow-lg">STUDY BUD</h1>
                
                <h2 className="font-medium text-slate-400 mb-4 tracking-[0.3em] uppercase text-sm">Founder & Creator</h2>
                <p className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400 mb-16 drop-shadow-sm">
                  IMAAN ABDUL-RAZAQ
                </p>

                <p className="text-slate-500 mt-20 text-sm tracking-widest uppercase">Tap anywhere to close</p>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Account">
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type <span className="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-colors"
              placeholder="DELETE"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE' || loading}
              className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};
