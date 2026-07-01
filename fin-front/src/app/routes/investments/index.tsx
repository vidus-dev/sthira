import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@components/ui/dialog";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Progress } from "@components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  BarChart3,
  DollarSign,
  Target,
  Star,
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
} from "lucide-react";

interface MutualFund {
  id: string;
  name: string;
  category: string;
  nav: number;
  change: number;
  changePercent: number;
  invested: number;
  currentValue: number;
  units: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  rating: number;
  expense: number;
  aum: string;
}

const mockFunds: MutualFund[] = [
  {
    id: '1',
    name: 'Vanguard S&P 500 ETF',
    category: 'Large Cap',
    nav: 425.80,
    change: 5.20,
    changePercent: 1.24,
    invested: 10000,
    currentValue: 12450,
    units: 23.5,
    riskLevel: 'Medium',
    rating: 5,
    expense: 0.03,
    aum: '$850B'
  },
  {
    id: '2',
    name: 'Fidelity Total Market',
    category: 'Diversified',
    nav: 112.45,
    change: -2.15,
    changePercent: -1.88,
    invested: 5000,
    currentValue: 5180,
    units: 44.5,
    riskLevel: 'Medium',
    rating: 4,
    expense: 0.015,
    aum: '$125B'
  },
  {
    id: '3',
    name: 'ARK Innovation ETF',
    category: 'Growth',
    nav: 78.90,
    change: 12.30,
    changePercent: 18.47,
    invested: 3000,
    currentValue: 3890,
    units: 38.0,
    riskLevel: 'High',
    rating: 3,
    expense: 0.75,
    aum: '$8.5B'
  }
];

const performanceData = [
  { month: 'Jan', portfolio: 18000, benchmark: 17500 },
  { month: 'Feb', portfolio: 18500, benchmark: 17800 },
  { month: 'Mar', portfolio: 19200, benchmark: 18200 },
  { month: 'Apr', portfolio: 20100, benchmark: 19000 },
  { month: 'May', portfolio: 20850, benchmark: 19500 },
  { month: 'Jun', portfolio: 21520, benchmark: 20100 },
];

const allocationData = [
  { name: 'Large Cap', value: 60, color: '#8884d8' },
  { name: 'Small Cap', value: 20, color: '#82ca9d' },
  { name: 'International', value: 15, color: '#ffc658' },
  { name: 'Bonds', value: 5, color: '#ff7300' },
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

export function MutualFunds() {
  const [funds] = useState<MutualFund[]>(mockFunds);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInvestDialogOpen, setIsInvestDialogOpen] = useState(false);

  const totalInvested = funds.reduce((sum, fund) => sum + fund.invested, 0);
  const totalCurrentValue = funds.reduce((sum, fund) => sum + fund.currentValue, 0);
  const totalGains = totalCurrentValue - totalInvested;
  const totalGainsPercent = ((totalGains / totalInvested) * 100);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-600 bg-green-500/10';
      case 'Medium': return 'text-yellow-600 bg-yellow-500/10';
      case 'High': return 'text-red-600 bg-red-500/10';
      default: return 'text-gray-600 bg-gray-500/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <h1 className="text-2xl">Mutual Funds & Investments</h1>
          <p className="text-muted-foreground">Track and manage your investment portfolio</p>
        </div>
        
        <Dialog open={isInvestDialogOpen} onOpenChange={setIsInvestDialogOpen}>
          <DialogTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invest Now
              </Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Make New Investment</DialogTitle>
              <DialogDescription>
                Choose a fund and amount to invest.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Fund Selection</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a mutual fund" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vanguard">Vanguard S&P 500 ETF</SelectItem>
                    <SelectItem value="fidelity">Fidelity Total Market</SelectItem>
                    <SelectItem value="ark">ARK Innovation ETF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Investment Amount</Label>
                <Input type="number" placeholder="$1,000" />
              </div>
              <div>
                <Label>Investment Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="One-time or SIP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lumpsum">Lump Sum</SelectItem>
                    <SelectItem value="sip">SIP (Monthly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full">
                Confirm Investment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <CardTitle className="text-sm">Total Invested</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">${totalInvested.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across {funds.length} funds
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
              <CardTitle className="text-sm">Current Value</CardTitle>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl">${totalCurrentValue.toLocaleString()}</div>
              <p className={`text-xs ${totalGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalGains >= 0 ? '+' : ''}${totalGains.toLocaleString()} ({totalGainsPercent.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.3}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10"
              animate={{ 
                background: [
                  "linear-gradient(to bottom right, rgb(168 85 247 / 0.1), rgb(236 72 153 / 0.1))",
                  "linear-gradient(to bottom right, rgb(236 72 153 / 0.1), rgb(168 85 247 / 0.1))"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 2 }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Best Performer</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg">ARK Innovation</div>
              <p className="text-xs text-green-600">
                +18.47% today
              </p>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.4}>
          <Card className="relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10"
              animate={{ 
                background: [
                  "linear-gradient(to bottom right, rgb(249 115 22 / 0.1), rgb(239 68 68 / 0.1))",
                  "linear-gradient(to bottom right, rgb(239 68 68 / 0.1), rgb(249 115 22 / 0.1))"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 3 }}
            />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Target Progress</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">72%</div>
              <Progress value={72} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </FloatingCard>
      </div>

      {/* Portfolio Performance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FloatingCard delay={0.5}>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <BarChart3 className="h-5 w-5 text-primary" />
                </motion.div>
                <span>Portfolio Performance</span>
              </CardTitle>
              <CardDescription>Your investments vs benchmark over 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="portfolio" stroke="#8884d8" strokeWidth={3} name="Your Portfolio" />
                  <Line type="monotone" dataKey="benchmark" stroke="#82ca9d" strokeWidth={2} name="S&P 500" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </FloatingCard>

        <FloatingCard delay={0.6}>
          <Card>
            <CardHeader>
              <CardTitle>Asset Allocation</CardTitle>
              <CardDescription>Portfolio distribution by category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {allocationData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span>{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FloatingCard>
      </div>

      {/* Funds List */}
      <FloatingCard delay={0.7}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Mutual Funds</CardTitle>
                <CardDescription>Track performance of your investments</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Search funds..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funds.map((fund, index) => (
                <motion.div
                  key={fund.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-4 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                    {/* Fund Info */}
                    <div className="flex items-center space-x-3">
                      <motion.div
                        className="p-2 bg-primary/10 rounded-lg"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        <Building className="h-4 w-4 text-primary" />
                      </motion.div>
                      <div>
                        <p className="font-medium">{fund.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>{fund.category}</span>
                          <Badge variant="outline" className={getRiskColor(fund.riskLevel)}>
                            {fund.riskLevel} Risk
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* NAV & Change */}
                    <div className="text-center">
                      <p className="text-lg">${fund.nav}</p>
                      <div className={`flex items-center justify-center space-x-1 text-sm ${fund.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fund.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        <span>{fund.change >= 0 ? '+' : ''}${fund.change} ({fund.changePercent}%)</span>
                      </div>
                    </div>

                    {/* Investment */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Invested</p>
                      <p className="text-lg">${fund.invested.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{fund.units} units</p>
                    </div>

                    {/* Current Value */}
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <motion.p 
                        className="text-lg"
                        whileHover={{ scale: 1.05 }}
                      >
                        ${fund.currentValue.toLocaleString()}
                      </motion.p>
                      <p className={`text-xs ${fund.currentValue >= fund.invested ? 'text-green-600' : 'text-red-600'}`}>
                        {fund.currentValue >= fund.invested ? '+' : ''}${(fund.currentValue - fund.invested).toLocaleString()}
                      </p>
                    </div>

                    {/* Rating & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 * i }}
                          >
                            <Star className={`h-3 w-3 ${i < fund.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                          </motion.div>
                        ))}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                        <Button size="sm">
                          Invest More
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FloatingCard>
    </div>
  );
}