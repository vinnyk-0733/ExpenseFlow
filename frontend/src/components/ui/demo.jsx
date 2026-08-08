import { useState, useEffect } from "react"
import { Component as MorphingCardStack } from "@/components/ui/morphing-card-stack"
import { TrendingUp, Award, DollarSign, CalendarRange, Search, X, Calendar } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"

export default function DemoOne() {
  const [days, setDays] = useState([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [dayToDelete, setDayToDelete] = useState(null)
  const [selectedRawDate, setSelectedRawDate] = useState("")

  // Convert YYYY-MM-DD input value to database format "Month D, YYYY" (e.g. "July 8, 2026")
  const formatDateToDb = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const monthName = dateObj.toLocaleString("en-US", { month: "long" });
    return `${monthName} ${parseInt(day, 10)}, ${year}`;
  };

  // Filter day cards according to selected search date
  const filteredDays = selectedRawDate
    ? days.filter(day => {
        const targetFormatted = formatDateToDb(selectedRawDate);
        return day.date.toLowerCase() === targetFormatted.toLowerCase();
      })
    : days;

  // Fetch days from the backend database on mount with Bearer Auth
  useEffect(() => {
    const fetchDays = async () => {
      try {
        const response = await apiRequest('/api/v1/days')
        if (!response.ok) throw new Error("Failed to fetch days")
        const data = await response.json()
        setDays(Array.isArray(data) ? data : (data.items || []))
      } catch (e) {
        console.error("Error loading days from backend:", e)
      }
    }
    fetchDays()
  }, [])

  // Handlers
  const handleAddExpense = async (dayId, expenseData) => {
    try {
      const response = await apiRequest(`/api/v1/days/${dayId}/expenses`, {
        method: "POST",
        body: JSON.stringify(expenseData),
      })
      if (!response.ok) throw new Error("Failed to add expense")
      const newExpense = await response.json()
      
      setDays((prevDays) =>
        prevDays.map((day) => {
          if (day.id === dayId) {
            return {
              ...day,
              expenses: [...day.expenses, newExpense],
            }
          }
          return day
        })
      )
    } catch (e) {
      console.error("Error adding expense:", e)
    }
  }

  const handleEditExpense = async (dayId, expenseId, expenseData) => {
    try {
      const response = await apiRequest(`/api/v1/days/${dayId}/expenses/${expenseId}`, {
        method: "PUT",
        body: JSON.stringify(expenseData),
      })
      if (!response.ok) throw new Error("Failed to edit expense")
      const updatedExpense = await response.json()
      
      setDays((prevDays) =>
        prevDays.map((day) => {
          if (day.id === dayId) {
            return {
              ...day,
              expenses: day.expenses.map((exp) =>
                exp.id === expenseId ? updatedExpense : exp
              ),
            }
          }
          return day
        })
      )
    } catch (e) {
      console.error("Error editing expense:", e)
    }
  }

  const handleDeleteExpense = async (dayId, expenseId) => {
    try {
      const response = await apiRequest(`/api/v1/days/${dayId}/expenses/${expenseId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete expense")
      
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
    } catch (e) {
      console.error("Error deleting expense:", e)
    }
  }

  const handleDeleteDay = (dayId) => {
    setDayToDelete(dayId)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteDay = async () => {
    if (!dayToDelete) return
    try {
      const response = await apiRequest(`/api/v1/days/${dayToDelete}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete day card")
      
      setDays((prevDays) => prevDays.filter((day) => day.id !== dayToDelete))
    } catch (e) {
      console.error("Error deleting day:", e)
    } finally {
      setDeleteConfirmOpen(false)
      setDayToDelete(null)
    }
  }

  const cancelDeleteDay = () => {
    setDeleteConfirmOpen(false)
    setDayToDelete(null)
  }

  const handleAddDay = async () => {
    try {
      const response = await apiRequest('/api/v1/days', {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to add day card")
      const newDay = await response.json()
      
      setDays((prevDays) => [...prevDays, newDay])
    } catch (e) {
      console.error("Error adding day card:", e)
    }
  }

  // Handle keyboard shortcuts (Enter to confirm, Escape to cancel) when confirmation modal is active
  useEffect(() => {
    if (!deleteConfirmOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmDeleteDay();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelDeleteDay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteConfirmOpen, dayToDelete])

  // Calculate high-level stats with float parsing to prevent string concatenation
  const totalOverallSpend = days.reduce((sum, day) => 
    sum + day.expenses.reduce((dSum, exp) => dSum + (parseFloat(exp.amount) || 0), 0)
  , 0)

  const averageSpentPerDay = days.length > 0 ? (totalOverallSpend / days.length) : 0

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
            <span className="text-xl sm:text-2xl font-black text-card-foreground block">₹{formatCurrency(totalOverallSpend)}</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center sm:flex-row sm:items-center sm:text-left sm:justify-start gap-3 sm:gap-4 hover:shadow-md transition-all">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">Avg. Spend / Day</span>
            <span className="text-xl sm:text-2xl font-black text-card-foreground block">₹{formatCurrency(averageSpentPerDay)}</span>
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

      {/* Date Search Bar / Small Calendar */}
      {days.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/45 border border-border/55 rounded-2xl p-4 mx-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">Search by Date</span>
              <span className="text-sm font-bold text-card-foreground block truncate">
                {selectedRawDate ? `Filtering for ${formatDateToDb(selectedRawDate)}` : "Showing all day cards"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto relative">
            <input
              type="date"
              value={selectedRawDate}
              onChange={(e) => setSelectedRawDate(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 text-xs rounded-xl bg-secondary/30 border border-border/80 text-card-foreground font-semibold shadow-inner focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer placeholder-muted-foreground custom-date-input"
            />
            {selectedRawDate && (
              <button
                onClick={() => setSelectedRawDate("")}
                className="absolute right-8 sm:right-8 px-1.5 py-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-card-foreground transition-all cursor-pointer flex items-center justify-center"
                style={{ top: "50%", transform: "translateY(-50%)" }}
                title="Clear Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

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
      ) : filteredDays.length === 0 ? (
        <div className="border border-dashed border-border rounded-3xl p-6 sm:p-12 text-center w-[calc(100%-2rem)] sm:w-full max-w-md mx-auto space-y-4 animate-fade-in">
          <Search className="h-12 w-12 text-muted-foreground/60 mx-auto" />
          <h3 className="text-lg font-bold text-card-foreground">No Cards Found</h3>
          <p className="text-sm text-muted-foreground">We couldn't find any day card matching the date <strong>{formatDateToDb(selectedRawDate)}</strong>.</p>
          <div className="flex justify-center pt-3 gap-3">
            <button
              onClick={() => setSelectedRawDate("")}
              className="px-5 py-2 text-xs rounded-xl border border-border bg-secondary/50 text-secondary-foreground font-semibold shadow-sm hover:bg-secondary transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              Clear Filter
            </button>
          </div>
        </div>
      ) : (
        <MorphingCardStack 
          cards={filteredDays}
          onAddExpense={handleAddExpense}
          onEditExpense={handleEditExpense}
          onDeleteExpense={handleDeleteExpense}
          onDeleteDay={handleDeleteDay}
          onAddDay={handleAddDay}
        />
      )}

      {/* Custom Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-card/95 border border-border/80 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-5 animate-scale-up backdrop-blur-md">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Delete Day Card?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete this entire day and all its logged expenses? This action is permanent and cannot be undone.
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={cancelDeleteDay}
                className="px-4 py-2 rounded-xl border border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary transition-all font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDay}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all font-semibold text-xs shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
