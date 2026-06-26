import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { BrainCircuit, Loader2, Mail, Lock, User as UserIcon, Eye, EyeOff, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import emailjs from '@emailjs/browser';

// ==========================================
// EMAIL JS CONFIGURATION
// Replace these with your actual EmailJS credentials
// ==========================================
const EMAILJS_SERVICE_ID = 'service_4bi9jr4';
const EMAILJS_TEMPLATE_ID = 'template_294onsq';
const EMAILJS_PUBLIC_KEY = 'tEDRsptWzi5MKpk6V';
// ==========================================

export const Login = () => {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // EmailJS OTP State
  const [resetStep, setResetStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  if (user) {
    return <Navigate to="/" />;
  }

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error('Sign in error:', err);
      }
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. This often happens when third-party cookies are blocked in the preview window. Please open the app in a new tab (using the button in the top right) to sign in.');
      } else if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setError('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSigningIn) return;
    setIsSigningIn(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUpWithEmail(name, email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else if (err.code === 'auth/network-request-failed') {
        console.error('Email auth error:', err);
        setError('Network error. If you are using the AI Studio preview, please open the app in a new tab (using the button in the top right), as iframes can block authentication requests.');
      } else {
        console.error('Email auth error:', err);
        setError('Failed to authenticate. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSendEmailJSOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    
    setIsSigningIn(true);
    setError(null);
    setMessage(null);
    
    try {
      // 1. Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      
      const currentTime = new Date();
      currentTime.setMinutes(currentTime.getMinutes() + 15);
      const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 2. Send via EmailJS (requires your template variables to match this)
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          email: email,             // Maps to {{email}} in your template
          reset_code: otp,        // Maps to {{reset_code}} in your template
          time: timeString          // Maps to {{time}} in your template
        },
        EMAILJS_PUBLIC_KEY
      );
      setResetStep('otp');
      setMessage('The code has been sent to your email. Check your inbox or spam.');
      setResendTimer(60);
      
    } catch (err: any) {
      console.error('EmailJS Error:', err);
      setError('Failed to send OTP. Please try again later.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredOtp === generatedOtp) {
      setResetStep('new_password');
      setMessage('OTP verified successfully! You can now set a new password.');
      setError(null);
    } else {
      setError('Invalid OTP. Please try again.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    setError(null);
    setMessage(null);

    if (newPassword.length < 6) {
      setError('The password must be a string with at least 6 characters.');
      setIsSigningIn(false);
      return;
    }

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update password');
        }

        setMessage('Password updated successfully! You can now log in with your new password.');
        setResetStep('email');
        setTimeout(() => {
          setIsForgotPassword(false);
        }, 3000);
      } else {
        const textError = await response.text();
        throw new Error(`Server returned ${response.status} ${response.statusText}. Ensure Vercel environment variables (FIREBASE_ADMIN_CREDENTIALS) are set correctly.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with the backend server.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const renderForgotPasswordFlow = () => {
    if (resetStep === 'email') {
      return (
        <form onSubmit={handleSendEmailJSOtp} className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Email Address"
            />
          </div>
          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSigningIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
          </button>
        </form>
      );
    }

    if (resetStep === 'otp') {
      return (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <KeyRound className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              required
              maxLength={6}
              value={enteredOtp}
              onChange={(e) => setEnteredOtp(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 text-center tracking-[0.5em] text-lg font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              placeholder="000000"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Verify OTP
          </button>

          <div className="text-center mt-2">
            <button
              type="button"
              onClick={handleSendEmailJSOtp}
              disabled={resendTimer > 0 || isSigningIn}
              className={`text-sm font-medium transition-colors ${
                resendTimer > 0 
                  ? 'text-slate-400 cursor-not-allowed' 
                  : 'text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-lg ring-1 ring-indigo-500/30'
              }`}
            >
              {resendTimer > 0 
                ? `Resend code in ${resendTimer}s` 
                : 'Resend code'}
            </button>
          </div>
        </form>
      );
    }

    if (resetStep === 'new_password') {
      return (
        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type={showNewPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="New Secure Password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showNewPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Update Password
          </button>
        </form>
      );
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] transition-colors"
    >
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center transition-colors">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
          <BrainCircuit className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          {isForgotPassword 
            ? (resetStep === 'email' ? "Enter your email to receive a 6-digit OTP." : resetStep === 'otp' ? "Enter the 6-digit OTP sent to your email." : "Securely set your new password.")
            : isSignUp ? 'Sign up to start learning with StudyBud.' : 'Log in to continue your learning journey.'}
        </p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800 text-left">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm border border-emerald-100 dark:border-emerald-800 text-left">
            {message}
          </div>
        )}

        {isForgotPassword ? (
          renderForgotPasswordFlow()
        ) : (
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4 mb-6">
            {isSignUp && !isForgotPassword && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="Full Name"
                />
              </div>
            )}
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="Email Address"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="Password"
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
              disabled={isSigningIn}
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSigningIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                'Sign Up'
              ) : (
                'Log In'
              )}
            </button>
          </form>
        )}

        {!isForgotPassword && !isSignUp && (
          <div className="text-right mb-6 -mt-2">
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(true);
                setResetStep('email');
                setError(null);
                setMessage(null);
              }}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              Forgot your password?
            </button>
          </div>
        )}

        {!isForgotPassword && (
          <>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Google
            </button>
          </>
        )}
        
        <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
          {isForgotPassword ? (
            <button 
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setResetStep('email');
                setError(null);
                setMessage(null);
              }} 
              className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline focus:outline-none"
            >
              Back to log in
            </button>
          ) : (
            <>
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setMessage(null);
                }} 
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline focus:outline-none"
              >
                {isSignUp ? 'Log in' : 'Sign up'}
              </button>
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
};

