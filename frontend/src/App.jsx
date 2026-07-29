import React from 'react'
import DemoOne from '@/components/ui/demo'
import AuthModal from '@/components/AuthModal'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import './App.css'
import { Sparkles, Coins, LogOut, UserCheck } from "lucide-react"

function MainContent() {
  const { userName, logout, loading } = useAuth();
  const token = localStorage.getItem('access_token');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section id="center" className="w-full px-4 md:px-8 py-8">
      {/* Top Navbar Header Bar */}
      <div className="w-full max-w-6xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider animate-pulse">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Interactive Expense Tracker</span>
        </div>

        {token && (
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-card/80 text-card-foreground border border-border shadow-sm backdrop-blur-md">
              <UserCheck className="w-3.5 h-3.5 text-primary" />
              {userName ? `Hi, ${userName}` : 'Logged In'}
            </span>
            <button
              onClick={logout}
              title="Sign Out"
              className="px-3.5 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Title & Description */}
      <header className="mb-10 text-center space-y-3">
        <h1 className="flex items-center justify-center gap-3 text-4xl md:text-5xl font-black text-card-foreground tracking-tight my-2">
          <Coins className="h-10 w-10 text-primary" />
          <span>Expense<span className="text-primary">Flow</span></span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto font-medium">
          Log your daily expenses, select categories, input descriptions, track day-to-day totals, and add new day cards as time flows.
        </p>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-6xl mx-auto">
        {!token ? (
          <AuthModal />
        ) : (
          <DemoOne />
        )}
      </div>
    </section>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainContent />
      <div className="ticks"></div>
      <section id="spacer"></section>
    </AuthProvider>
  )
}

export default App
