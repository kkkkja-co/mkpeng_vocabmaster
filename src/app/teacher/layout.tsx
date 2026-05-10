"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  BarChart3,
  Swords,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { springSnappy } from "@/lib/animations";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { label: "Classes", href: "/teacher/classes", icon: Users },
  { label: "Students", href: "/teacher/students", icon: UserCog },
  { label: "Modules", href: "/teacher/modules", icon: BookOpen },
  { label: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
  { label: "Battle", href: "/teacher/battle", icon: Swords },
  { label: "Settings", href: "/teacher/settings", icon: Settings },
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { uid, name, logout, loading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Redirect if not teacher
  useEffect(() => {
    if (!loading && (!uid || useAuthStore.getState().role !== "teacher")) {
      router.push("/login");
    }
  }, [uid, loading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/teacher") return pathname === "/teacher";
    return pathname.startsWith(href);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-warm-border border-t-warm-accent" />
          <p className="text-sm text-warm-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-warm-bg">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#1c1917] text-white transition-all duration-300",
          collapsed ? "w-[68px]" : "w-64",
          // Mobile: slide in/out
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo area */}
        <div className={cn(
          "flex h-16 items-center border-b border-white/10 px-4",
          collapsed ? "justify-center" : "gap-3"
        )}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warm-accent">
            <BookOpen className="size-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-[family-name:var(--font-serif)] text-lg leading-tight text-white">
                VocabMaster
              </span>
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Teacher Console
              </span>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1 text-white/60 hover:text-white lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-warm-accent text-white shadow-lg shadow-warm-accent/20"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className={cn("size-5 shrink-0", active && "text-white")} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 p-3">
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mb-2 hidden w-full items-center justify-center rounded-xl p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70 lg:flex"
          >
            <ChevronLeft
              className={cn(
                "size-4 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>

          {/* User info & logout */}
          <div className={cn(
            "flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5",
            collapsed && "justify-center px-2"
          )}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warm-accent/20 text-sm font-semibold text-warm-accent">
              {name?.charAt(0)?.toUpperCase() || "T"}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {name || "Teacher"}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={cn(
                "rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-red-400",
                collapsed && "hidden"
              )}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "lg:ml-[68px]" : "lg:ml-64"
        )}
      >
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-warm-border bg-warm-surface/80 px-4 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-warm-text-muted hover:bg-warm-surface-2"
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-warm-accent">
              <BookOpen className="size-4 text-white" />
            </div>
            <span className="font-[family-name:var(--font-serif)] text-lg text-warm-text">
              VocabMaster
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
