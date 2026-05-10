"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  User,
  Mail,
  Calendar,
  Shield,
  BookOpen,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { pageTransition } from "@/lib/animations";

interface TeacherProfile {
  name: string;
  email: string;
  joinedDate: string;
  role: string;
  totalModules: number;
  totalClasses: number;
}

export default function SettingsPage() {
  const { uid, name, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherProfile>({
    name: "",
    email: "",
    joinedDate: "",
    role: "teacher",
    totalModules: 0,
    totalClasses: 0,
  });

  useEffect(() => {
    if (!uid) return;
    fetchProfile();
  }, [uid]);

  async function fetchProfile() {
    if (!uid) return;
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      // Get email from auth
      const { getAuth } = await import("firebase/auth");
      const currentUser = getAuth().currentUser;

      // Count modules and classes
      const { collection, query, where, getDocs } = await import("firebase/firestore");

      const modulesSnap = await getDocs(
        query(collection(db, "modules"), where("createdBy", "==", uid))
      );
      const classesSnap = await getDocs(
        query(collection(db, "classes"), where("teacherId", "==", uid))
      );

      const joinedDate = userData.createdAt
        ? new Date((userData.createdAt as { seconds: number }).seconds * 1000).toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric", year: "numeric" }
          )
        : "Unknown";

      setProfile({
        name: name || "Teacher",
        email: currentUser?.email || "Not available",
        joinedDate,
        role: "Teacher",
        totalModules: modulesSnap.size,
        totalClasses: classesSnap.size,
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div {...pageTransition} className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
          Settings
        </h1>
        <p className="mt-1 text-warm-text-muted">
          View your profile and account information
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="animate-pulse rounded-xl border border-warm-border bg-warm-surface p-6">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-warm-surface-2" />
              <div className="space-y-2">
                <div className="h-5 w-32 rounded bg-warm-surface-2" />
                <div className="h-3 w-48 rounded bg-warm-surface-2" />
              </div>
            </div>
          </div>
          <div className="animate-pulse h-48 rounded-xl bg-warm-surface-2" />
        </div>
      ) : (
        <>
          {/* Profile Card */}
          <Card className="border-warm-border bg-warm-surface">
            <CardContent className="pt-6">
              <div className="flex items-center gap-5">
                <div className="flex size-16 items-center justify-center rounded-full bg-warm-accent text-2xl font-bold text-white">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-warm-text">
                    {profile.name}
                  </h2>
                  <p className="text-warm-text-muted">{profile.email}</p>
                  <p className="mt-1 text-xs text-warm-text-subtle">
                    Joined {profile.joinedDate}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="border-warm-border bg-warm-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warm-text">
                <Settings className="size-4 text-warm-accent" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-warm-surface-2">
                  <User className="size-5 text-warm-text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-text-subtle">
                    Full Name
                  </p>
                  <p className="text-sm text-warm-text">{profile.name}</p>
                </div>
              </div>

              <Separator className="bg-warm-border" />

              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-warm-surface-2">
                  <Mail className="size-5 text-warm-text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-text-subtle">
                    Email Address
                  </p>
                  <p className="text-sm text-warm-text">{profile.email}</p>
                </div>
              </div>

              <Separator className="bg-warm-border" />

              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-warm-surface-2">
                  <Shield className="size-5 text-warm-text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-text-subtle">
                    Role
                  </p>
                  <p className="text-sm text-warm-text capitalize">{profile.role}</p>
                </div>
              </div>

              <Separator className="bg-warm-border" />

              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-warm-surface-2">
                  <Calendar className="size-5 text-warm-text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-text-subtle">
                    Member Since
                  </p>
                  <p className="text-sm text-warm-text">{profile.joinedDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="border-warm-border bg-warm-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warm-text">
                <BookOpen className="size-4 text-warm-accent" />
                Your Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-warm-border bg-warm-surface-2 p-4 text-center">
                  <p className="text-2xl font-semibold text-warm-accent">
                    {profile.totalModules}
                  </p>
                  <p className="mt-1 text-xs text-warm-text-muted">
                    Modules Created
                  </p>
                </div>
                <div className="rounded-lg border border-warm-border bg-warm-surface-2 p-4 text-center">
                  <p className="text-2xl font-semibold text-warm-accent">
                    {profile.totalClasses}
                  </p>
                  <p className="mt-1 text-xs text-warm-text-muted">
                    Classes Managed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
