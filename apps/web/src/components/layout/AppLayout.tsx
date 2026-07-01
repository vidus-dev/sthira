import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { SimpleThemeToggle } from "@components/common/ThemeToggle";
import { UserProfile } from "@app/routes/settings";
import {
  LayoutDashboard,
  CreditCard,
  Target,
  PieChart,
  Settings,
  Menu,
  X,
  Wallet,
  Building2,
  TrendingUp,
  Bell,
  Heart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

const navigation = [
  { path: "/app/dashboard", id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
  { path: "/app/accounts", id: "accounts", name: "Bank Accounts", icon: Building2 },
  { path: "/app/transactions", id: "transactions", name: "Transactions", icon: CreditCard },
  { path: "/app/budgets", id: "budgets", name: "Budgets", icon: Target },
  { path: "/app/goals", id: "goals", name: "Goals & events", icon: Heart },
  { path: "/app/mutual-funds", id: "mutual-funds", name: "Mutual Funds", icon: TrendingUp },
  { path: "/app/analytics", id: "analytics", name: "Analytics", icon: PieChart },
  { path: "/app/settings", id: "settings", name: "Settings", icon: Settings },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const currentNav =
    navigation.find((item) => location.pathname === item.path) ??
    navigation[0];

  const go = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64">
        <div className="flex h-screen flex-col bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center px-4 flex-shrink-0 border-b border-border/20">
            <motion.div
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Wallet className="h-8 w-8 text-primary" />
              </motion.div>
              <span className="text-lg">FinanceTracker</span>
            </motion.div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto px-4 py-4">
              <nav className="space-y-2">
                {navigation.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start relative overflow-hidden group hover:bg-primary/5 transition-all duration-200"
                        onClick={() => go(item.path)}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-indicator"
                            className="absolute inset-0 bg-primary/8 rounded-md border border-primary/20"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <Icon className="h-4 w-4 mr-3" />
                        </motion.div>
                        <span className="relative z-10">{item.name}</span>
                        {item.id === "budgets" && (
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Badge variant="secondary" className="ml-auto relative z-10">
                              3
                            </Badge>
                          </motion.div>
                        )}
                        {item.id === "mutual-funds" && (
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                          >
                            <Badge variant="default" className="ml-auto relative z-10">
                              New
                            </Badge>
                          </motion.div>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-background/95 backdrop-blur-xl border-r border-border/30 lg:hidden"
          >
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center justify-between px-4 border-b border-border/20 flex-shrink-0">
                <motion.div
                  className="flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Wallet className="h-8 w-8 text-primary" />
                  </motion.div>
                  <span className="text-lg">FinanceTracker</span>
                </motion.div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto px-4 py-4">
                  <nav className="space-y-2">
                    {navigation.map((item, index) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            className="w-full justify-start relative overflow-hidden group hover:bg-primary/5 transition-all duration-200"
                            onClick={() => go(item.path)}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="mobile-sidebar-indicator"
                                className="absolute inset-0 bg-primary/8 rounded-md border border-primary/20"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              />
                            )}
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ type: "spring", stiffness: 300 }}
                            >
                              <Icon className="h-4 w-4 mr-3" />
                            </motion.div>
                            <span className="relative z-10">{item.name}</span>
                            {item.id === "budgets" && (
                              <Badge variant="secondary" className="ml-auto relative z-10">
                                3
                              </Badge>
                            )}
                            {item.id === "mutual-funds" && (
                              <Badge variant="default" className="ml-auto relative z-10">
                                New
                              </Badge>
                            )}
                          </Button>
                        </motion.div>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/30 transition-colors duration-300">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden mr-2"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <div className="flex-1">
              <motion.h1
                key={location.pathname}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg"
              >
                {currentNav.name}
              </motion.h1>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-4 mr-2">
                <motion.div
                  className="text-sm text-muted-foreground"
                  whileHover={{ scale: 1.05 }}
                >
                  Balance: <span className="text-foreground">$12,450</span>
                </motion.div>
                <motion.div
                  className="text-sm text-muted-foreground"
                  whileHover={{ scale: 1.05 }}
                >
                  Budget: <span className="text-green-500">78%</span>
                </motion.div>
              </div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative h-9 w-9 rounded-full"
                  type="button"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-background"
                  />
                </Button>
              </motion.div>

              <SimpleThemeToggle />

              <UserProfile />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
