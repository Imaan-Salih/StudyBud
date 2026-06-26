import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Link } from 'react-router-dom';
import { MessageSquare, BrainCircuit, Clock, ArrowRight, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export const History = () => {
  const { user } = useAuth();
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string, type: string) => {
    e.preventDefault(); // Prevent navigating to the item
    e.stopPropagation(); // Prevent the Link from acting

    if (deletingId === id) {
      // Confirm delete: Move to recycle bin
      try {
        const collectionName = type === 'session' ? 'studySessions' : 'quizzes';
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          // Save to recycle bin
          try {
            await setDoc(doc(db, 'recycleBin', id), {
              userId: user?.uid,
              originalCollection: collectionName,
              itemData: docSnap.data(),
              deletedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Failed to set in recycleBin:", e);
            throw e;
          }
          
          // Delete from original collection
          try {
            await deleteDoc(docRef);
          } catch (e) {
            console.error("Failed to delete from " + collectionName + ":", e);
            throw e;
          }
        }
        setDeletingId(null);
      } catch (error) {
        if (error instanceof Error) {
          console.error("Delete sequence failed. Message:", error.message, "Stack:", error.stack);
        } else {
          console.error("Delete sequence failed:", error);
        }
        handleFirestoreError(error, OperationType.WRITE, 'deleteSequence');
      }
    } else {
      // Ask for confirmation
      setDeletingId(id);
      // Reset after 3 seconds
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  useEffect(() => {
    if (!user) return;

    let sessions: any[] = [];
    let quizzes: any[] = [];
    let sessionsLoaded = false;
    let quizzesLoaded = false;

    const combineAndSort = () => {
      if (sessionsLoaded && quizzesLoaded) {
        const combined = [...sessions, ...quizzes];
        combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistoryItems(combined);
        setLoading(false);
      }
    };

    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      sessions = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'session',
            title: data.title,
            date: data.updatedAt || data.createdAt,
            ...data
          };
        });
      sessionsLoaded = true;
      combineAndSort();
    }, (error) => {
      console.error("Firestore error for studySessions:", error);
      handleFirestoreError(error, OperationType.LIST, 'studySessions');
      setLoading(false);
    });

    const quizzesQuery = query(
      collection(db, 'quizzes'),
      where('userId', '==', user.uid)
    );

    const unsubscribeQuizzes = onSnapshot(quizzesQuery, (snapshot) => {
      quizzes = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'quiz',
            title: data.title,
            date: data.createdAt,
            ...data
          };
        });
      quizzesLoaded = true;
      combineAndSort();
    }, (error) => {
      console.error("Firestore error for quizzes:", error);
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
      setLoading(false);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeQuizzes();
    };
  }, [user]);

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
              <Clock className="w-8 h-8 text-indigo-500" />
              Study History
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">All your past study sessions and quizzes in one place.</p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-sm transition-colors">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No history yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Start a study session or generate a quiz to see your history here.</p>
            <Link to="/tutor" className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm">
              Start Studying
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {historyItems.map((item) => (
              <Link 
                key={`${item.type}-${item.id}`} 
                to={item.type === 'session' ? `/tutor/${item.id}` : `/quizzes/${item.id}`}
                className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${item.type === 'session' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                    {item.type === 'session' ? <MessageSquare className="w-6 h-6" /> : <BrainCircuit className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${item.type === 'session' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                          {item.type === 'session' ? 'Tutor Session' : 'Practice Quiz'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.type === 'quiz' && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {item.questions?.length || 0} questions
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDelete(e, item.id, item.type)}
                      className={`p-2 rounded-xl transition-all duration-200 flex items-center gap-2 ${deletingId === item.id ? 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 px-4 shadow-sm ring-2 ring-red-500/30' : 'text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'}`}
                      title={deletingId === item.id ? "Click again to confirm" : "Delete"}
                    >
                      <Trash2 className="w-5 h-5" />
                      {deletingId === item.id && <span className="text-sm font-medium whitespace-nowrap">Are you sure you want to delete?</span>}
                    </button>
                    <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
