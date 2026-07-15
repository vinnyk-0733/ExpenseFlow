import DemoOne from '@/components/ui/demo'
import './App.css'
import { Sparkles, Coins } from "lucide-react"

function App() {
  return (
    <>
      <section id="center" className="w-full px-4 md:px-8 py-8">
        <header className="mb-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider animate-pulse">
            <Sparkles className="h-3 w-3" />
            <span>Interactive Expense Tracker</span>
          </div>
          <h1 className="flex items-center justify-center gap-3 text-4xl md:text-5xl font-black text-card-foreground tracking-tight my-2">
            <Coins className="h-10 w-10 text-primary" />
            <span>Expense<span className="text-primary">Flow</span></span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto font-medium">
            Log your daily expenses, select categories, input descriptions, track day-to-day totals, and add new day cards as time flows.
          </p>
        </header>
        
        <div className="w-full max-w-6xl mx-auto">
          <DemoOne />
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
