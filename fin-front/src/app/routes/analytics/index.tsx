import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target } from "lucide-react";

const monthlyTrends = [
  { month: 'Jan', spending: 3200, income: 4500, savings: 1300 },
  { month: 'Feb', spending: 3400, income: 4800, savings: 1400 },
  { month: 'Mar', spending: 3800, income: 4600, savings: 800 },
  { month: 'Apr', spending: 3600, income: 5200, savings: 1600 },
  { month: 'May', spending: 4100, income: 4900, savings: 800 },
  { month: 'Jun', spending: 3900, income: 5100, savings: 1200 },
];

const categoryTrends = [
  { category: 'Food & Dining', thisMonth: 800, lastMonth: 750, change: 6.7 },
  { category: 'Transportation', thisMonth: 600, lastMonth: 650, change: -7.7 },
  { category: 'Shopping', thisMonth: 400, lastMonth: 300, change: 33.3 },
  { category: 'Entertainment', thisMonth: 300, lastMonth: 280, change: 7.1 },
  { category: 'Bills & Utilities', thisMonth: 700, lastMonth: 720, change: -2.8 },
];

const weeklySpending = [
  { week: 'Week 1', amount: 980 },
  { week: 'Week 2', amount: 1050 },
  { week: 'Week 3', amount: 890 },
  { week: 'Week 4', amount: 980 },
];

export function Analytics() {
  const totalSavings = monthlyTrends.reduce((sum, month) => sum + month.savings, 0);
  const avgMonthlySavings = totalSavings / monthlyTrends.length;
  const currentMonthSavings = monthlyTrends[monthlyTrends.length - 1].savings;
  const savingsChange = ((currentMonthSavings - avgMonthlySavings) / avgMonthlySavings) * 100;

  const totalSpendingThisMonth = categoryTrends.reduce((sum, cat) => sum + cat.thisMonth, 0);
  const totalSpendingLastMonth = categoryTrends.reduce((sum, cat) => sum + cat.lastMonth, 0);
  const spendingChange = ((totalSpendingThisMonth - totalSpendingLastMonth) / totalSpendingLastMonth) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl">Analytics & Insights</h1>
        <p className="text-muted-foreground">Understand your spending patterns and financial trends</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Monthly Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">${currentMonthSavings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {savingsChange >= 0 ? (
                <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="inline h-3 w-3 mr-1 text-red-500" />
              )}
              {Math.abs(savingsChange).toFixed(1)}% from average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Spending Change</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl ${spendingChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {spendingChange >= 0 ? '+' : ''}{spendingChange.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Top Category</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">Food & Dining</div>
            <p className="text-xs text-muted-foreground">
              ${categoryTrends[0].thisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Avg Weekly Spend</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              ${(weeklySpending.reduce((sum, week) => sum + week.amount, 0) / weeklySpending.length).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on last 4 weeks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Savings Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Savings Trend</CardTitle>
            <CardDescription>Monthly savings over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="savings" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly Spending */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Spending</CardTitle>
            <CardDescription>Spending breakdown for the current month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklySpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses Trend</CardTitle>
          <CardDescription>6-month comparison of income, expenses, and savings</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="income" stroke="#8884d8" strokeWidth={2} name="Income" />
              <Line type="monotone" dataKey="spending" stroke="#82ca9d" strokeWidth={2} name="Expenses" />
              <Line type="monotone" dataKey="savings" stroke="#ffc658" strokeWidth={2} name="Savings" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
          <CardDescription>Compare this month's spending with last month by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryTrends.map((category, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm">{category.category}</h4>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-muted-foreground">
                      This month: ${category.thisMonth}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Last month: ${category.lastMonth}
                    </span>
                  </div>
                </div>
                <Badge variant={category.change >= 0 ? "destructive" : "default"}>
                  {category.change >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(category.change).toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}