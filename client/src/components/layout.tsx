import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogOut, Menu, Activity, Settings, Store, X, UserSquare } from "lucide-react";
import { useState } from "react";
import { cn } from "./ui-kit";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isProprietario = user?.role === 'admin' || user?.role === 'superAdmin' || user?.isAdmin;
  const isOperatore = user?.role === 'operatore' && !user?.isAdmin;

  const navItems = isOperatore ? [
    { label: "Home", href: "/operatore", icon: LayoutDashboard },
    { label: "Profilo", href: "/profile", icon: UserSquare },
  ] : [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ...(isProprietario ? [
      { label: "Amministrazione", href: "/admin", icon: Settings },
    ] : []),
    { label: "Profilo", href: "/profile", icon: UserSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 md:px-8 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <span className="font-display text-xl font-bold text-gray-900">ControlClose</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
              location === item.href ? "text-primary" : "text-muted-foreground"
            )}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
          <button 
            onClick={() => logout()}
            className="ml-4 text-sm font-medium text-muted-foreground hover:text-destructive flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Esci
          </button>
        </nav>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-xl z-30 p-4"
          >
            <nav className="flex flex-col gap-4">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-base font-medium",
                  location === item.href ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-50"
                )} onClick={() => setMobileMenuOpen(false)}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-gray-100 my-2" />
              <button 
                onClick={() => logout()}
                className="flex items-center gap-3 p-3 rounded-lg text-base font-medium text-destructive hover:bg-destructive/10 w-full text-left"
              >
                <LogOut className="w-5 h-5" />
                Esci
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-5 md:px-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
