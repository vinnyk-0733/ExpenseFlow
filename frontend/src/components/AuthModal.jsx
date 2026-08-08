import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Coins, Lock, Phone, User, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AuthModal() {
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Client-side validations
    if (isSignUp && (!name || name.trim().length < 2)) {
      setError('Please enter a valid full name.');
      return;
    }
    if (!phone || phone.trim().length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signup(name.trim(), phone.trim(), pin.trim());
        setSuccessMsg('Account created successfully! Logging you in...');
      } else {
        await login(phone.trim(), pin.trim());
        setSuccessMsg('Welcome back!');
      }

    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-6 p-1">
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-card/60 backdrop-blur-xl shadow-2xl p-6 md:p-8">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 -left-20 w-48 h-48 bg-primary/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ExpenseFlow Access</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            <Coins className="w-7 h-7 text-primary" />
            <span>{isSignUp ? 'Create Account' : 'Welcome Back'}</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isSignUp
              ? 'Sign up with your phone number and 6-digit PIN'
              : 'Enter your phone number & PIN to access your expenses'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-muted/50 border border-border">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError('');
              setSuccessMsg('');
              setName('');
              setPhone('');
              setPin('');
            }}
            className={`py-2 text-xs md:text-sm font-medium rounded-lg transition-all ${
              !isSignUp
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError('');
              setSuccessMsg('');
              setName('');
              setPhone('');
              setPin('');
            }}
            className={`py-2 text-xs md:text-sm font-medium rounded-lg transition-all ${
              isSignUp
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Vinay Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                required
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" /> Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={15}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-primary" /> 6-Digit Security PIN
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background/50 text-foreground text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
