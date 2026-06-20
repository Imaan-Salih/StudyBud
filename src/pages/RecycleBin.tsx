import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Trash2, RefreshCw, AlertCircle, Clock, MessageSquare, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Modal } from '../components/Modal';

export const RecycleBin = () => {
  const { user } = useAuth();
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm_single' | 'confirm_all';
    itemId?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'recycleBin'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Auto-cleanup items older than 30 days
      const now = new Date().getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      items.forEach(async (item: any) => {
        const deletedTime = new Date(item.deletedAt).getTime();
        if (now - deletedTime > thirtyDaysMs) {
          try {
            await deleteDoc(doc(db, 'recycleBin', item.id));
          } catch (error) {
            console.error("Failed to auto-delete old item", error);
          }
        }
      });

      // Filter out items that are older than 30 days for display
      const validItems = items.filter((item: any) => {
        const deletedTime = new Date(item.deletedAt).getTime();
        return now - deletedTime <= thirtyDaysMs;
      });

      validItems.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      setDeletedItems(validItems);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error for recycleBin:", error);
      handleFirestoreError(error, OperationType.LIST, 'recycleBin');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRestore = async (item: any) => {
    try {
      // Move back to original collection
      const dataToRestore = item.itemData || item.data;
      if (!dataToRestore) {
        throw new Error("No data found to restore.");
      }
      await setDoc(doc(db, item.originalCollection, item.id), dataToRestore);
      // Remove from recycle bin
      await deleteDoc(doc(db, 'recycleBin', item.id));
    } catch (error) {
      console.error("Error restoring item:", error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to restore item.',
        type: 'alert'
      });
    }
  };

  const confirmPermanentDelete = (id: string) => {
    setModalState({
      isOpen: true,
      title: 'Delete Permanently',
      message: 'Are you sure you want to permanently delete this item? This cannot be undone.',
      type: 'confirm_single',
      itemId: id
    });
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recycleBin', id));
      closeModal();
    } catch (error) {
      console.error("Error deleting item:", error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to delete item.',
        type: 'alert'
      });
    }
  };

  const confirmEmptyBin = () => {
    if (deletedItems.length === 0) return;
    setModalState({
      isOpen: true,
      title: 'Empty Recycle Bin',
      message: 'Are you sure you want to permanently delete ALL items in the recycle bin? This cannot be undone.',
      type: 'confirm_all'
    });
  };

  const handleEmptyBin = async () => {
    try {
      for (const item of deletedItems) {
        await deleteDoc(doc(db, 'recycleBin', item.id));
      }
      closeModal();
    } catch (error) {
      console.error("Error emptying recycle bin:", error);
      setModalState({
        isOpen: true,
        title: 'Error',
        message: 'Failed to empty recycle bin completely.',
        type: 'alert'
      });
    }
  };

  const getDaysLeft = (deletedAt: string) => {
    const now = new Date().getTime();
    const deletedTime = new Date(deletedAt).getTime();
    const diffDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors"
    >
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-slate-500" />
              Recycle Bin
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Items here will be permanently deleted after 30 days.</p>
          </div>
          
          <button 
            onClick={confirmEmptyBin}
            disabled={deletedItems.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Empty Recycle Bin
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : deletedItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-sm transition-colors">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Recycle Bin is empty</h3>
            <p className="text-slate-500 dark:text-slate-400">No deleted items found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deletedItems.map((item) => (
              <div 
                key={item.id} 
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-3 rounded-xl ${item.originalCollection === 'studySessions' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                    {item.originalCollection === 'studySessions' ? <MessageSquare className="w-6 h-6" /> : <BrainCircuit className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${item.originalCollection === 'studySessions' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                        {item.originalCollection === 'studySessions' ? 'Tutor Session' : 'Practice Quiz'}
                      </span>
                      <span className="text-xs text-red-500 flex items-center gap-1 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {getDaysLeft(item.deletedAt)} days left
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {(item.itemData?.title || item.data?.title) || 'Untitled'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Deleted on {new Date(item.deletedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => handleRestore(item)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Restore
                  </button>
                  <button 
                    onClick={() => confirmPermanentDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    title="Delete Permanently"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.title}>
        <p className="text-slate-600 dark:text-slate-300 mb-6">{modalState.message}</p>
        <div className="flex justify-end gap-3">
          {modalState.type === 'alert' ? (
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modalState.type === 'confirm_single' && modalState.itemId) {
                    handlePermanentDelete(modalState.itemId);
                  } else if (modalState.type === 'confirm_all') {
                    handleEmptyBin();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </Modal>
    </motion.div>
  );
};
