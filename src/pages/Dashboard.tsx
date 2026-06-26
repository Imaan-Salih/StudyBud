import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Link } from 'react-router-dom';
import { MessageSquare, BrainCircuit, ArrowRight, Clock, Loader2, GraduationCap, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../components/Modal';

export const Dashboard = () => {
  const { user } = useAuth();
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    if (!user) return;

    const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${user.uid}`);
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }

    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessions = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }));
      sessions.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setRecentSessions(sessions.slice(0, 3));
      setLoadingSessions(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'studySessions');
      setLoadingSessions(false);
    });

    const quizzesQuery = query(
      collection(db, 'quizzes'),
      where('userId', '==', user.uid)
    );

    const unsubscribeQuizzes = onSnapshot(quizzesQuery, (snapshot) => {
      const quizzesList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }));
      quizzesList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentQuizzes(quizzesList.slice(0, 3));
      setLoadingQuizzes(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
      setLoadingQuizzes(false);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeQuizzes();
    };
  }, [user]);

  const handleCloseTutorial = () => {
    if (user) {
      localStorage.setItem(`tutorial_seen_${user.uid}`, 'true');
    }
    setShowTutorial(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-8 transition-colors"
    >
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Student'}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Your learning journey continues.</p>
        </header>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/tutor" className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
            <MessageSquare className="w-8 h-8 mb-4 text-indigo-100" />
            <h3 className="text-xl font-semibold mb-1">New Tutor Session</h3>
            <p className="text-indigo-100 text-sm">Start a Socratic dialogue</p>
          </Link>

          <Link to="/quizzes" className="group relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <BrainCircuit className="w-8 h-8 mb-4 text-emerald-500" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Practice Quizzes</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Review your generated quizzes</p>
          </Link>

          <Link to="/history" className="group relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer">
            <Clock className="w-8 h-8 mb-4 text-amber-500" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Study History</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Review past sessions & quizzes</p>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Sessions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Sessions</h2>
              <Link to="/tutor" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
              {loadingSessions ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                  <p>Loading recent sessions...</p>
                </div>
              ) : recentSessions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p>No recent study sessions.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {recentSessions.map(session => (
                    <li key={session.id}>
                      <Link to={`/tutor/${session.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl">
                          <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{session.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Recent Quizzes */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Quizzes</h2>
              <Link to="/quizzes" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
              {loadingQuizzes ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                  <p>Loading recent quizzes...</p>
                </div>
              ) : recentQuizzes.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <BrainCircuit className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p>No generated quizzes yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {recentQuizzes.map(quiz => (
                    <li key={quiz.id}>
                      <Link to={`/quizzes/${quiz.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
                          <BrainCircuit className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{quiz.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                            {quiz.questions?.length || 0} questions
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

      </div>

      <Modal isOpen={showTutorial} onClose={handleCloseTutorial} title="Welcome to StudyBud! 🎉">
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-300 mb-6 text-lg">
            We're excited to help you supercharge your learning journey. Here's a quick tour of what you can do:
          </p>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-2xl h-fit shrink-0">
                <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Tutor Sessions</h3>
                <p className="text-slate-500 dark:text-slate-400">Engage in Socratic dialogues with your AI tutor. Upload materials and learn through guided discovery.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-2xl h-fit shrink-0">
                <BrainCircuit className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Practice Quizzes</h3>
                <p className="text-slate-500 dark:text-slate-400">Generate multiple-choice quizzes from your study materials to test your knowledge.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl h-fit shrink-0">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Study History</h3>
                <p className="text-slate-500 dark:text-slate-400">Review your past sessions and quizzes to track your progress over time.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
              onClick={handleCloseTutorial}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <GraduationCap className="w-5 h-5" />
              Let's Start Learning!
            </button>
          </div>
        </div>
      </Modal>

    </motion.div>
  );
};

