import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Progress } from "@components/ui/progress";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Target, 
  DollarSign,
  Plus,
  Eye,
  Zap,
  Calendar,
  Building2,
  PieChart as PieChartIcon,
  Bell,
  Star,
  Gift
} from "lucide-react";

const monthlyData = [
  { month: 'Jan', income: 4500, expenses: 3200, savings: 1300 },
  { month: 'Feb', income: 4800, expenses: 3400, savings: 1400 },
  { month: 'Mar', income: 4600, expenses: 3800, savings: 800 },
  { month: 'Apr', income: 5200, expenses: 3600, savings: 1600 },
  { month: 'May', income: 4900, expenses: 4100, savings: 800 },
  { month: 'Jun', income: 5100, expenses: 3900, savings: 1200 },
];

const categoryData = [
  { name: 'Food & Dining', value: 800, color: '#8884d8', icon: '🍽️' },
  { name: 'Transportation', value: 600, color: '#82ca9d', icon: '🚗' },
  { name: 'Shopping', value: 400, color: '#ffc658', icon: '🛍️' },
  { name: 'Entertainment', value: 300, color: '#ff7300', icon: '🎬' },
  { name: 'Bills & Utilities', value: 700, color: '#00ff88', icon: '💡' },
];

const recentTransactions = [
  { id: '1', type: 'income', amount: 5100, description: 'Salary Deposit', date: '2025-01-15', category: 'Salary', icon: '💰' },
  { id: '2', type: 'expense', amount: -120, description: 'Grocery Shopping', date: '2025-01-14', category: 'Food & Dining', icon: '🛒' },
  { id: '3', type: 'expense', amount: -45, description: 'Gas Station', date: '2025-01-13', category: 'Transportation', icon: '⛽' },
  { id: '4', type: 'income', amount: 800, description: 'Freelance Work', date: '2025-01-12', category: 'Freelance', icon: '💻' },
  { id: '5', type: 'expense', amount: -85, description: 'Restaurant Dinner', date: '2025-01-11', category: 'Food & Dining', icon: '🍕' },
];

const quickActions = [
  { id: 'add-transaction', title: 'Add Transaction', icon: Plus, color: 'bg-blue-500' },
  { id: 'view-budget', title: 'View Budget', icon: Target, color: 'bg-green-500' },
  { id: 'pay-bills', title: 'Pay Bills', icon: CreditCard, color: 'bg-red-500' },
  { id: 'investments', title: 'Investments', icon: TrendingUp, color: 'bg-purple-500' },
];

const budgetProgress = [
  { category: 'Food & Dining', spent: 800, budget: 1000, color: 'bg-blue-500', emoji: '🍽️' },
  { category: 'Transportation', spent: 600, budget: 800, color: 'bg-green-500', emoji: '🚗' },
  { category: 'Shopping', spent: 400, budget: 500, color: 'bg-yellow-500', emoji: '🛍️' },
  { category: 'Entertainment', spent: 300, budget: 400, color: 'bg-purple-500', emoji: '🎬' },
];

const FloatingCard = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: { 
          duration: 0.8, 
          delay,
          ease: [0.16, 1, 0.3, 1],
          type: "spring",
          stiffness: 100
        }
      }}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
};

export function Dashboard() {
  const [showBalances, setShowBalances] = useState(true);
  
  const totalIncome = 5100;
  const totalExpenses = 3900;
  const totalBalance = 12450;
  const savingsRate = ((totalBalance / totalIncome) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <motion.h1 
            className="text-2xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            Welcome back, John! 👋
          </motion.h1>
          <motion.p 
            className="text-muted-foreground"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            Here's your financial overview for January 2025
          </motion.p>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button variant="outline" size="sm" onClick={() => setShowBalances(!showBalances)}>
              <Eye className="h-4 w-4 mr-2" />
              {showBalances ? 'Hide' : 'Show'} Balances
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Quick Add
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FloatingCard delay={0.1}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10"
              animate={{ 
                background: [
                  "linear-gradient(to bottom right, rgb(59 130 246 / 0.1), rgb(6 182 212 / 0.1))",
                  "linear-gradient(to bottom right, rgb(6 182 212 / 0.1), rgb(59 130 246 / 0.1))"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total Balance</CardTitle>
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="text-2xl"
                whileHover={{ scale: 1.05 }}
              >
                {showBalances ? `$${totalBalance.toLocaleString()}` : '••••••'}
              </motion.div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
                +12% from last month
              </p>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.2}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"
              animate={{ 
                background: [
                  "linear-gradient(to bottom right, rgb(34 197 94 / 0.1), rgb(16 185 129 / 0.1))",
                  "linear-gradient(to bottom right, rgb(16 185 129 / 0.1), rgb(34 197 94 / 0.1))"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 1 }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Monthly Income</CardTitle>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="text-2xl"
                whileHover={{ scale: 1.05 }}
              >
                {showBalances ? `$${totalIncome.toLocaleString()}` : '••••••'}
              </motion.div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
                +4% from last month
              </p>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.3}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10"
              animate={{ 
                background: [
                  "linear-gradient(to bottom right, rgb(239 68 68 / 0.1), rgb(236 72 153 / 0.1))",
                  "linear-gradient(to bottom right, rgb(236 72 153 / 0.1), rgb(239 68 68 / 0.1))"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 2 }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Monthly Expenses</CardTitle>
              <motion.div
                animate={{ rotate: [0, -15, 15, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="text-2xl"
                whileHover={{ scale: 1.05 }}
              >
                {showBalances ? `$${totalExpenses.toLocaleString()}` : '••••••'}
              </motion.div>
              <p className="text-xs text-muted-foreground">
                <TrendingDown className="inline h-3 w-3 mr-1 text-green-500" />
                -2% from last month
              </p>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.4}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/10"
              animate={{ 
                background: [
                  "linear-gradient(to bottom right, rgb(168 85 247 / 0.1), rgb(99 102 241 / 0.1))",
                  "linear-gradient(to bottom right, rgb(99 102 241 / 0.1), rgb(168 85 247 / 0.1))"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 3 }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Savings Rate</CardTitle>
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Target className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="text-2xl"
                whileHover={{ scale: 1.05 }}
              >
                {showBalances ? `${savingsRate}%` : '••••'}
              </motion.div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
                Target: 20%
              </p>
            </CardContent>
          </Card>
        </FloatingCard>
      </div>

      {/* Quick Actions */}
      <FloatingCard delay={0.5}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="h-5 w-5 text-primary" />
              </motion.div>
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>Frequently used actions at your fingertips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outline"
                      className="h-20 w-full flex flex-col items-center justify-center space-y-2 relative overflow-hidden group"
                    >
                      <motion.div
                        className={`p-2 ${action.color} rounded-full text-white group-hover:scale-110 transition-transform`}
                      >
                        <Icon className="h-4 w-4" />
                      </motion.div>
                      <span className="text-xs text-center">{action.title}</span>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </FloatingCard>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FloatingCard delay={0.6}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: [0, 180, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <PieChartIcon className="h-5 w-5 text-primary" />
                </motion.div>
                <span>Spending Overview</span>
              </CardTitle>
              <CardDescription>Current month expense breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {categoryData.map((item, index) => (
                  <motion.div 
                    key={index} 
                    className="flex items-center justify-between text-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.name}</span>
                    </div>
                    <span>${item.value}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.7}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Calendar className="h-5 w-5 text-primary" />
                </motion.div>
                <span>Monthly Trends</span>
              </CardTitle>
              <CardDescription>Income vs expenses over 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="income" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="expenses" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </FloatingCard>
      </div>

      {/* Budget Progress & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FloatingCard delay={0.8}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Target className="h-5 w-5 text-primary" />
                </motion.div>
                <span>Budget Progress</span>
              </CardTitle>
              <CardDescription>Track your spending against monthly budgets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetProgress.map((budget, index) => {
                  const percentage = (budget.spent / budget.budget) * 100;
                  const isOverBudget = percentage > 100;
                  
                  return (
                    <motion.div 
                      key={index} 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{budget.emoji}</span>
                          <span className="text-sm">{budget.category}</span>
                          {isOverBudget && (
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              <Badge variant="destructive" className="text-xs">Over Budget</Badge>
                            </motion.div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${budget.spent} / ${budget.budget}
                        </div>
                      </div>
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={`h-2 ${isOverBudget ? 'bg-destructive/20' : ''}`}
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        {percentage.toFixed(1)}% used
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.9}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                >
                  <Building2 className="h-5 w-5 text-primary" />
                </motion.div>
                <span>Recent Transactions</span>
              </CardTitle>
              <CardDescription>Latest financial activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTransactions.slice(0, 5).map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <motion.span 
                        className="text-lg"
                        whileHover={{ scale: 1.2 }}
                      >
                        {transaction.icon}
                      </motion.span>
                      <div>
                        <p className="text-sm">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <motion.p
                      className={`text-sm ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      whileHover={{ scale: 1.05 }}
                    >
                      {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString()}
                    </motion.p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FloatingCard>
      </div>

      {/* Notifications & Insights */}
      <FloatingCard delay={1.0}>
        <Card className="relative overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5"
            animate={{ 
              background: [
                "linear-gradient(to right, rgb(168 85 247 / 0.05), rgb(236 72 153 / 0.05))",
                "linear-gradient(to right, rgb(236 72 153 / 0.05), rgb(168 85 247 / 0.05))"
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
          />
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Bell className="h-5 w-5 text-primary" />
              </motion.div>
              <span>Smart Insights</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div 
                className="flex items-center space-x-3 p-3 rounded-lg border border-border/50"
                whileHover={{ scale: 1.02 }}
              >
                <Star className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm">Congratulations! 🎉</p>
                  <p className="text-xs text-muted-foreground">You saved 23% more this month</p>
                </div>
              </motion.div>
              
              <motion.div 
                className="flex items-center space-x-3 p-3 rounded-lg border border-border/50"
                whileHover={{ scale: 1.02 }}
              >
                <Gift className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm">Budget Alert</p>
                  <p className="text-xs text-muted-foreground">Shopping budget 80% used</p>
                </div>
              </motion.div>
              
              <motion.div 
                className="flex items-center space-x-3 p-3 rounded-lg border border-border/50"
                whileHover={{ scale: 1.02 }}
              >
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm">Investment Tip</p>
                  <p className="text-xs text-muted-foreground">Consider diversifying portfolio</p>
                </div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </FloatingCard>
    </div>
  );
}