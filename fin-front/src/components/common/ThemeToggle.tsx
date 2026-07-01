import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@components/ui/button";
import { useTheme } from "./ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const themeIcon = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };

  const CurrentIcon = themeIcon[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 rounded-full"
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 10,
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <CurrentIcon className="h-4 w-4" />
          </motion.div>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center space-x-2"
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
          {theme === "light" && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto h-2 w-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center space-x-2"
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
          {theme === "dark" && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto h-2 w-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center space-x-2"
        >
          <Monitor className="h-4 w-4" />
          <span>System</span>
          {theme === "system" && (
            <motion.div
              layoutId="theme-indicator"
              className="ml-auto h-2 w-2 rounded-full bg-primary"
            />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simplified toggle for top header - matching landing page style
export function SimpleThemeToggle() {
  const { setTheme, actualTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(actualTheme === "light" ? "dark" : "light");
  };

  const getIcon = () => {
    switch (actualTheme) {
      case "light":
        return Sun;
      case "dark":
        return Moon;
      default:
        return Monitor;
    }
  };

  const Icon = getIcon();

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="relative h-9 w-9 rounded-full backdrop-blur-sm"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={actualTheme}
            initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 180, opacity: 0, scale: 0.5 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              duration: 0.3,
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Icon className="h-4 w-4" />
          </motion.div>
        </AnimatePresence>
        
        {/* Animated background */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            background: "linear-gradient(45deg, #4f46e5, #7c3aed)",
          }}
          transition={{ duration: 0.3 }}
          style={{ opacity: 0.1 }}
        />
        
        <span className="sr-only">Toggle theme</span>
      </Button>
    </motion.div>
  );
}