"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthInit } from "@/hooks/use-auth-init";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Layers, Swords, SpellCheck, BookOpen, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/cards", label: "Cards", icon: Layers },
  { href: "/match", label: "Match", icon: Swords },
  { href: "/spell", label: "Spell", icon: SpellCheck },
  { href: "/reading", label: "Reading", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAuthInit();
  const pathname = usePathname();
  const router = useRouter();
  const { uid, role, name, loading, logout } = useAuthStore();

  useEffect(() => {
    if (!loading && (!uid || role !== "student")) {
      router.push("/login");
    }
  }, [uid, role, loading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-bg">
        <Loader2 className="size-6 animate-spin text-warm-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-warm-bg">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-warm-border bg-warm-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {/* Logo / Brand */}
          <Link
            href="/cards"
            className="font-[family-name:var(--font-serif)] text-xl text-warm-text transition-colors hover:text-warm-accent"
          >
            VocabMaster
          </Link>

          {/* Nav Links - hidden on small screens */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-warm-accent"
                      : "text-warm-text-muted hover:text-warm-text"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-x-0 -bottom-[9px] h-0.5 rounded-full bg-warm-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side: name + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-warm-text-muted sm:block">
              {name}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              className="text-warm-text-muted hover:text-warm-wrong"
              aria-label="Log out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

        {/* Mobile bottom nav - visible only on small screens */}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-warm-border bg-warm-surface/90 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-around px-2 py-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "text-warm-accent"
                      : "text-warm-text-subtle hover:text-warm-text-muted"
                  }`}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  );
}
