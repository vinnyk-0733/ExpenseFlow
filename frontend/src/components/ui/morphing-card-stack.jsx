"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue } from "framer-motion"
import { cn } from "@/lib/utils"
import { 
  Grid3X3, 
  Layers, 
  LayoutList, 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  AlertCircle,
  Tag,
  PenSquare
} from "lucide-react"

const layoutIcons = {
  stack: Layers,
  grid: Grid3X3,
  list: LayoutList,
}

const SWIPE_THRESHOLD = 50

const CATEGORIES = [
  { value: "Food", label: "Food & Dining", icon: "🍔", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { value: "Transport", label: "Transportation", icon: "🚗", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "Shopping", label: "Shopping", icon: "🛍️", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "Entertainment", label: "Entertainment", icon: "🎬", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { value: "Utilities", label: "Bills & Utilities", icon: "💡", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "Others", label: "Others", icon: "💵", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
]

export function Component({
  cards = [],
  className,
  defaultLayout = "stack",
  onAddExpense,
  onDeleteExpense,
  onDeleteDay,
  onAddDay,
}) {
  const [layout, setLayout] = useState(defaultLayout)
  const [expandedCard, setExpandedCard] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Use Motion Values to achieve absolute zero latency dragging.
  // Directly writing coordinates to the style attribute bypasses React updates
  // and Framer Motion's main loop during user dragging.
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)

  // Local state for the add-expense form (for the currently open card)
  const [formCategory, setFormCategory] = useState("Food")
  const [formDescription, setFormDescription] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formError, setFormError] = useState("")

  const handleDragEnd = (event, info) => {
    const { offset, velocity } = info
    const swipe = Math.abs(offset.x) * velocity.x

    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
      // Swiped left - go to next card
      setActiveIndex((prev) => (prev + 1) % cards.length)
    } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
      // Swiped right - go to previous card
      setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length)
    }
    setIsDragging(false)
  }

  const getStackOrder = () => {
    const reordered = []
    for (let i = 0; i < cards.length; i++) {
      const index = (activeIndex + i) % cards.length
      reordered.push({ ...cards[index], stackPosition: i })
    }
    return reordered.reverse() // Reverse so top card renders last (on top)
  }

  const getLayoutStyles = (stackPosition) => {
    switch (layout) {
      case "stack":
        return {
          x: stackPosition * 8,
          y: stackPosition * 8,
          zIndex: cards.length - stackPosition,
          rotate: (stackPosition - 1) * 1.5,
        }
      case "grid":
      case "list":
        return {
          x: 0,
          y: 0,
          zIndex: 1,
          rotate: 0,
        }
    }
  }

  const containerStyles = {
    stack: "relative h-[300px] w-full max-w-[260px] sm:max-w-[340px] sm:h-[365px] md:h-[420px] md:max-w-[380px]",
    grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl px-4",
    list: "flex flex-col gap-4 w-full max-w-4xl px-4",
  }

  const displayCards = layout === "stack" ? getStackOrder() : cards.map((c, i) => ({ ...c, stackPosition: i }))

  const handleAddExpenseSubmit = (e, dayId) => {
    e.preventDefault()
    setFormError("")

    if (!formDescription.trim()) {
      setFormError("Please write a short description.")
      return
    }

    const parsedAmount = parseInt(formAmount, 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid positive integer amount.")
      return
    }

    onAddExpense(dayId, {
      category: formCategory,
      description: formDescription.trim(),
      amount: parsedAmount,
    })

    // Reset Form
    setFormDescription("")
    setFormAmount("")
  }

  const handleCardOpen = (cardId) => {
    setFormCategory("Food")
    setFormDescription("")
    setFormAmount("")
    setFormError("")
    setExpandedCard(cardId)
  }

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      
      {/* Dashboard Top bar & Actions */}
      <div className="flex flex-row gap-3 items-center justify-between w-full max-w-6xl px-4 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground hidden min-flex min-[480px]:inline">Layout:</span>
          <div className="flex items-center gap-1 rounded-xl bg-secondary/80 p-1 backdrop-blur-md border border-border/40">
            {Object.keys(layoutIcons).map((mode) => {
              const Icon = layoutIcons[mode]
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setLayout(mode)
                    setExpandedCard(null)
                  }}
                  className={cn(
                    "rounded-lg p-1.5 sm:p-2 transition-all cursor-pointer",
                    layout === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  aria-label={`Switch to ${mode} layout`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={onAddDay}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-xs sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Add New Day</span>
        </button>
      </div>

      {/* Cards Container */}
      <div className={cn(containerStyles[layout], "mx-auto mt-4")}>
        <AnimatePresence mode="popLayout">
          {displayCards.map((card) => {
            const styles = getLayoutStyles(card.stackPosition)
            const isTopCard = layout === "stack" && card.stackPosition === 0
            const dayTotal = card.expenses.reduce((sum, item) => sum + item.amount, 0)

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  // When the card is draggable, we exclude x and y from the animate target
                  // to prevent Framer Motion's transition physics from fighting the drag event.
                  x: (layout === "stack" && isTopCard) ? undefined : styles.x,
                  y: (layout === "stack" && isTopCard) ? undefined : styles.y,
                  zIndex: styles.zIndex,
                  rotate: styles.rotate,
                }}
                exit={{ opacity: 0, scale: 0.8, x: -200 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
                drag={isTopCard ? "x" : false}
                dragConstraints={{ left: -600, right: 600 }}
                dragElastic={0.7}
                dragSnapToOrigin={true}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 32 }}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                onClick={() => {
                  if (isDragging) return
                  if (layout === "stack" && !isTopCard) {
                    // Click behind card to bring to front
                    const cardRealIndex = cards.findIndex(c => c.id === card.id)
                    setActiveIndex(cardRealIndex)
                    return
                  }
                  handleCardOpen(card.id)
                }}
                className={cn(
                  "cursor-pointer rounded-2xl border border-border bg-card p-4 sm:p-5 relative flex justify-between",
                  // CRITICAL FIX: Changed transition-all to transition-[border-color,background-color,box-shadow].
                  // Applying transition-all makes the browser intercept coordinates during drag transforms
                  // and smooth/delay them over 300ms, causing card dragging to lag behind the cursor.
                  "hover:border-primary/40 hover:shadow-xl transition-[border-color,background-color,box-shadow] duration-300",
                  layout === "stack" && "absolute top-0 left-0 w-full h-full flex-col",
                  layout === "stack" && isTopCard && "cursor-grab active:cursor-grabbing shadow-lg",
                  layout === "grid" && "w-full min-h-[220px] shadow-sm flex-col",
                  layout === "list" && "w-full min-h-[100px] shadow-sm flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
                )}
                style={{
                  // Bind motion values directly to the style object of the top card.
                  // This enables hardware accelerated dragging that is 100% glued to the cursor.
                  x: (layout === "stack" && isTopCard) ? dragX : undefined,
                  y: (layout === "stack" && isTopCard) ? dragY : undefined,
                  background: card.color
                    ? `${card.color}, var(--card-bg)`
                    : "linear-gradient(135deg, var(--card-bg) 0%, var(--secondary-bg) 100%)",
                }}
              >
                
                {/* Card Header & Body */}
                <div className={cn("flex flex-col gap-2.5 sm:gap-3 w-full", layout === "list" && "sm:flex-row sm:justify-between sm:items-center sm:flex-1")}>
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/15 shrink-0">
                        <Calendar className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base sm:text-lg text-card-foreground tracking-tight">{card.title}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{card.date}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteDay(card.id)
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      title="Delete Day"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Stats summary inside card */}
                  <div className={cn("flex flex-col gap-1 mt-1 sm:mt-2", layout === "list" && "mt-0 flex-row gap-4 sm:gap-8")}>
                    <div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground block font-medium uppercase tracking-wider">Total Spent</span>
                      <span className="text-xl sm:text-2xl font-bold text-card-foreground">
                        ₹{dayTotal.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground block font-medium uppercase tracking-wider">Expenses</span>
                      <span className="text-xs sm:text-sm font-semibold text-card-foreground">
                        {card.expenses.length} item{card.expenses.length !== 1 && 's'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer/Swipe hints for stack */}
                {layout === "stack" && isTopCard && (
                  <div className="text-center w-full mt-4 border-t border-border/40 pt-3">
                    <span className="text-xs text-muted-foreground/60 flex items-center justify-center gap-1.5 font-medium">
                      Click card to edit • Swipe to next
                    </span>
                  </div>
                )}

                {layout !== "stack" && (
                  <div className={cn("mt-4 pt-3 border-t border-border/40 flex justify-end w-full", layout === "list" && "mt-0 pt-0 border-t-0 w-auto sm:w-auto shrink-0 sm:ml-4")}>
                    <span className="text-xs text-primary font-medium flex items-center gap-1.5 group-hover:underline">
                      Manage Expenses →
                    </span>
                  </div>
                )}

              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Stack layout dots navigation */}
      {layout === "stack" && cards.length > 1 && (
        <div className="flex justify-center gap-2 mt-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all cursor-pointer",
                index === activeIndex 
                  ? "w-6 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* DETAILED OVERLAY / EXPANDED CARD DIALOG */}
      <AnimatePresence>
        {expandedCard && (() => {
          const card = cards.find(c => c.id === expandedCard)
          if (!card) return null
          const dayTotal = card.expenses.reduce((sum, item) => sum + item.amount, 0)

          return (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setExpandedCard(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 cursor-zoom-out"
              />

              {/* Modal Container */}
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
                <motion.div
                  initial={isMobile ? { y: "100%", opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ y: 0, scale: 1, opacity: 1 }}
                  exit={isMobile ? { y: "100%", opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
                  transition={{
                    type: "spring",
                    stiffness: isMobile ? 300 : 350,
                    damping: 30,
                  }}
                  className="bg-card w-full h-[92vh] sm:h-auto max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl rounded-b-none sm:rounded-3xl border-t sm:border border-border shadow-2xl overflow-hidden flex flex-col pointer-events-auto mt-auto sm:mt-0 sm:max-w-2xl"
                  style={{
                    background: "var(--card-bg)",
                  }}
                >
                  {/* Mobile Drag Handle */}
                  <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                  
                  {/* Modal Header */}
                  <div className="p-4 sm:p-6 border-b border-border/60 flex items-start justify-between bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Calendar className="h-5.5 w-5.5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-card-foreground tracking-tight">{card.title} Details</h2>
                        <p className="text-sm text-muted-foreground">{card.date}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setExpandedCard(null)}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer border border-border/40"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Modal Body (Scrollable content) */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    
                    {/* Sum display at the top of detail */}
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 sm:p-5 border border-primary/15 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold uppercase tracking-wider text-primary/70 block">
                          Total Expense for the Day
                        </span>
                        <span className="text-2xl sm:text-3xl font-extrabold text-card-foreground mt-1 block">
                          ₹{dayTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xl font-bold">
                        ₹
                      </div>
                    </div>

                    {/* Expense list section */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Tag className="h-4 w-4" />
                        <span>Expenses History ({card.expenses.length})</span>
                      </h4>

                      {card.expenses.length === 0 ? (
                        <div className="border border-dashed border-border rounded-2xl p-6 sm:p-8 text-center text-muted-foreground">
                          <p className="font-medium text-sm">No expenses added for this day yet.</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">Use the form below to add your first expense!</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[200px] sm:max-h-[220px] overflow-y-auto pr-1">
                          {card.expenses.map((expense) => {
                            const catObj = CATEGORIES.find(cat => cat.value === expense.category) || CATEGORIES[5]
                            return (
                              <motion.div
                                key={expense.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span 
                                    className="text-lg w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-border/30"
                                    role="img" 
                                    aria-label={expense.category}
                                  >
                                    {catObj.icon}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-card-foreground truncate">{expense.description}</p>
                                    <span className={cn(
                                      "inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5",
                                      catObj.color
                                    )}>
                                      {expense.category}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-bold text-sm text-card-foreground">
                                    -₹{expense.amount.toLocaleString()}
                                  </span>
                                  <button
                                    onClick={() => onDeleteExpense(card.id, expense.id)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Delete Expense"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add Expense Form */}
                    <div className="border-t border-border/60 pt-5 space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <PenSquare className="h-4 w-4" />
                        <span>Add New Expense</span>
                      </h4>

                      <form onSubmit={(e) => handleAddExpenseSubmit(e, card.id)} className="space-y-4">
                        
                        {formError && (
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-semibold">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{formError}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* Category dropdown */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Category
                            </label>
                            <div className="relative">
                              <select
                                value={formCategory}
                                onChange={(e) => setFormCategory(e.target.value)}
                                className="w-full bg-secondary/50 border border-border rounded-xl p-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none transition-all cursor-pointer font-medium"
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.icon} {cat.label}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Amount (integer) */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              Amount (₹)
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground text-sm font-semibold">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="1"
                                placeholder="e.g. 25"
                                value={formAmount}
                                onChange={(e) => setFormAmount(e.target.value)}
                                className="w-full bg-secondary/50 border border-border rounded-xl p-3 pl-7 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Description (written expense description) */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Description
                          </label>
                          <input
                            type="text"
                            placeholder="What did you spend on? (e.g., Grocery shopping, Gas fill up)"
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            className="w-full bg-secondary/50 border border-border rounded-xl p-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-sm"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Expense & Add to Daily Total</span>
                        </button>

                      </form>
                    </div>

                  </div>

                </motion.div>
              </div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
