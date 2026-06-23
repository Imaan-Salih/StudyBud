/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tutor } from './pages/Tutor';
import { Quizzes } from './pages/Quizzes';
import { QuizRunner } from './pages/QuizRunner';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { RecycleBin } from './pages/RecycleBin';
import { DeleteAccount } from './pages/DeleteAccount';
import { Analytics } from '@vercel/analytics/react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/delete-account" element={<DeleteAccount />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="tutor" element={<Tutor />} />
                <Route path="tutor/:sessionId" element={<Tutor />} />
                <Route path="quizzes" element={<Quizzes />} />
                <Route path="quizzes/:quizId" element={<QuizRunner />} />
                <Route path="history" element={<History />} />
                <Route path="settings" element={<Settings />} />
                <Route path="recycle-bin" element={<RecycleBin />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Analytics />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
