import React, { useState } from 'react';
import { BrainCircuit, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DeleteAccount = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // In a real app, this would send a request to a backend
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="bg-indigo-600 p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Deletion</h1>
          <p className="text-indigo-100 text-sm">
            Request to delete your StudyBud account and data
          </p>
        </div>

        <div className="p-8">
          {!submitted ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                If you wish to delete your account and all associated data (quizzes, history, and settings), please enter your email address below. We will process your request within 30 days. Alternatively, you can instantly delete your account from within the app by going to Settings {'>'} Danger Zone {'>'} Delete Account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                    placeholder="Your account email"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Request Data Deletion
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Request Received</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Your request to delete data for {email} has been received. We will process it within 30 days and confirm via email.
              </p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
