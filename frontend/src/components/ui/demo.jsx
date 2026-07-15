import { useState, useEffect } from "react"
import { Component as MorphingCardStack } from "@/components/ui/morphing-card-stack"
import { TrendingUp, Award, DollarSign, CalendarRange } from "lucide-react"

// Gradient presets for a premium, harmonized look
const GRADIENTS = [
  "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", // Blue
  "linear-gradient(135deg, #10b981 0%, #047857 100%)", // Emerald
  "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", // Purple
  "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", // Amber
  "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", // Pink
  "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)", // Teal
]

const DEFAULT_DAYS = [
  {
    id: "day-1",
    title: "Day 1",
    date: "July 8, 2026",
    expenses: [
      { id: "exp-1-1", category: "Food", description: "Lunch at Pizza Hut", amount: 25 },
      { id: "exp-1-2", category: "Transport", description: "Uber to office", amount: 18 },
      { id: "exp-1-3", category: "Shopping", description: "Mechanical Keyboard", amount: 75 },
    ],
    color: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.05) 100%)",
  },
  {
    id: "day-2",
    title: "Day 2",
    date: "July 9, 2026",
    expenses: [
      { id: "exp-2-1", category: "Utilities", description: "High-speed Internet Bill", amount: 80 },
      { id: "exp-2-2", category: "Food", description: "Dinner & Drinks", amount: 45 },
    ],
    color: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.05) 100%)",
  },
]

export default function DemoOne() {
  const [days, setDays] = useState(() => {
    try {
      const saved = localStorage.getItem("expenseflow_days")
      return saved ? JSON.parse(saved) : DEFAULT_DAYS
    } catch (e) {
      console.error("Error loading days from localStorage:", e)
      return DEFAULT_DAYS
    }
  })

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem("expenseflow_days", JSON.stringify(days))
    } catch (e) {
      console.error("Error saving days to localStorage:", e)
    }
  }, [days])

  // Handlers
  const handleAddExpense = (dayId, expenseData) => {
    setDays((prevDays) =>
      prevDays.map((day) => {
        if (day.id === dayId) {
          const newExpense = {
            id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...expenseData,
          }
          return {
            ...day,
            expenses: [...day.expenses, newExpense],
          }
        }
        return day
      })
    )
  }

  const handleDeleteExpense = (dayId, expenseId) => {
    setDays((prevDays) =>
      prevDays.map((day) => {
        if (day.id === dayId) {
          return {
            ...day,
            expenses: day.expenses.filter((exp) => exp.id !== expenseId),
          }
        }
        return day
      })
    )
  }

  const handleDeleteDay = (dayId) => {
    if (confirm("Are you sure you want to delete this entire day and all its expenses?")) {
      setDays((prevDays) => prevDays.filter((day) => day.id !== dayId))
    }
  }

  const handleAddDay = () => {
    let nextNum = 1
    let lastDateStr = "July 9, 2026"

    if (days.length > 0) {
      // Extract highest day number
      const dayNums = days.map(d => {
        const m = d.title.match(/Day\s+(\d+)/i)
        return m ? parseInt(m[1], 10) : 0
      })
      nextNum = Math.max(...dayNums, 0) + 1

      // Find the last day's date to increment
      const sortedDays = [...days].sort((a, b) => {
        const aNum = parseInt(a.title.replace(/\D/g, ""), 10) || 0
        const bNum = parseInt(b.title.replace(/\D/g, ""), 10) || 0
        return aNum - bNum
      })
      lastDateStr = sortedDays[sortedDays.length - 1].date
    }

    // Try to parse the date and increment by 1 day
    let nextDate = new Date()
    try {
      const parsed = Date.parse(lastDateStr)
      if (!isNaN(parsed)) {
        nextDate = new Date(parsed)
        nextDate.setDate(nextDate.getDate() + 1)
      }
    } catch (e) {
      console.error(e)
    }

    const options = { year: 'numeric', month: 'long', day: 'numeric' }
    const formattedDate = nextDate.toLocaleDateString('en-US', options)

    // Select color index
    const colorIdx = (nextNum - 1) % GRADIENTS.length
    // Convert strong gradient to light translucent variant for background consistency
    const rColors = [
      "rgba(59, 130, 246, 0.1)",
      "rgba(16, 185, 129, 0.1)",
      "rgba(139, 92, 246, 0.1)",
      "rgba(245, 158, 11, 0.1)",
      "rgba(236, 72, 153, 0.1)",
      "rgba(20, 184, 166, 0.1)"
    ]
    const rColorEnd = [
      "rgba(29, 78, 216, 0.04)",
      "rgba(4, 120, 87, 0.04)",
      "rgba(109, 40, 217, 0.04)",
      "rgba(180, 83, 9, 0.04)",
      "rgba(190, 24, 93, 0.04)",
      "rgba(15, 118, 110, 0.04)"
    ]

    const newDay = {
      id: `day-${Date.now()}`,
      title: `Day ${nextNum}`,
      date: formattedDate,
      expenses: [],
      color: `linear-gradient(135deg, ${rColors[colorIdx]} 0%, ${rColorEnd[colorIdx]} 100%)`,
    }

    setDays([...days, newDay])
  }

  // Calculate high-level stats
  const totalOverallSpend = days.reduce((sum, day) => 
    sum + day.expenses.reduce((dSum, exp) => dSum + exp.amount, 0)
  , 0)

  const totalExpensesCount = days.reduce((sum, day) => sum + day.expenses.length, 0)

  const averageSpentPerDay = days.length > 0 ? Math.round(totalOverallSpend / days.length) : 0

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto pb-12">
      
      {/* High-level stats panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 w-full">
        
        {/* Stat 1 */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center sm:flex-row sm:items-center sm:text-left sm:justify-start gap-3 sm:gap-4 hover:shadow-md transition-all">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">Overall Spending</span>
            <span className="text-xl sm:text-2xl font-black text-card-foreground block">₹{totalOverallSpend.toLocaleString()}</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center sm:flex-row sm:items-center sm:text-left sm:justify-start gap-3 sm:gap-4 hover:shadow-md transition-all">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">Avg. Spend / Day</span>
            <span className="text-xl sm:text-2xl font-black text-card-foreground block">₹{averageSpentPerDay.toLocaleString()}</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center sm:flex-row sm:items-center sm:text-left sm:justify-start gap-3 sm:gap-4 hover:shadow-md transition-all">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center shrink-0">
            <CalendarRange className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">Days Tracked</span>
            <span className="text-xl sm:text-2xl font-black text-card-foreground block">
              {days.length} Day{days.length !== 1 && 's'}
            </span>
          </div>
        </div>

      </div>

      {days.length === 0 ? (
        <div className="border border-dashed border-border rounded-3xl p-6 sm:p-12 text-center w-[calc(100%-2rem)] sm:w-full max-w-md mx-auto space-y-4">
          <Award className="h-12 w-12 text-muted-foreground/60 mx-auto" />
          <h3 className="text-lg font-bold text-card-foreground">No Expense Days Yet</h3>
          <p className="text-sm text-muted-foreground">Click below to add your first day card and start tracking expenses.</p>
          <div className="flex justify-center pt-3">
            <button
              onClick={handleAddDay}
              className="px-6 py-2 text-sm rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              Add Day 1 Card
            </button>
          </div>
        </div>
      ) : (
        <MorphingCardStack 
          cards={days}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
          onDeleteDay={handleDeleteDay}
          onAddDay={handleAddDay}
        />
      )}
    </div>
  )
}

