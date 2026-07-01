import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ThemeToggle } from "@components/common/ThemeToggle";
import { User, Bell, Shield, CreditCard, Palette, Smartphone, Database, Lock } from "lucide-react";
import { motion } from "framer-motion";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-2xl">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application preferences</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.1,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <User className="h-4 w-4" />
                </motion.div>
                <span>Profile Settings</span>
              </CardTitle>
              <CardDescription>Update your personal information and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Edit Profile
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.2,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Bell className="h-4 w-4" />
                </motion.div>
                <span>Notifications</span>
              </CardTitle>
              <CardDescription>Configure alerts and notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Manage Notifications
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Shield className="h-4 w-4" />
                </motion.div>
                <span>Security</span>
              </CardTitle>
              <CardDescription>Update password and two-factor authentication</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Security Settings
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.4,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CreditCard className="h-4 w-4" />
                </motion.div>
                <span>Connected Accounts</span>
              </CardTitle>
              <CardDescription>Manage your linked bank accounts and cards</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Manage Accounts
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.5,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <Palette className="h-4 w-4" />
                </motion.div>
                <span>Appearance</span>
              </CardTitle>
              <CardDescription>Customize the look and feel of your application</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Theme</p>
                  <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.6,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Smartphone className="h-4 w-4" />
                </motion.div>
                <span>Mobile App</span>
              </CardTitle>
              <CardDescription>Download our mobile app for on-the-go access</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Download App
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.7,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 to-slate-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ rotate: [0, 180, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Database className="h-4 w-4" />
                </motion.div>
                <span>Data & Privacy</span>
              </CardTitle>
              <CardDescription>Manage your data and privacy settings</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Privacy Settings
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: 0.8,
              delay: 0.8,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            },
          }}
          whileHover={{
            y: -8,
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
        >
          <Card className="relative overflow-hidden group">
            <motion.div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Lock className="h-4 w-4" />
                </motion.div>
                <span>Backup & Sync</span>
              </CardTitle>
              <CardDescription>Backup your data and sync across devices</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Backup Settings
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
