"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Download,
  Users,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { decrypt } from "@/lib/crypto";
import { pageTransition } from "@/lib/animations";
import { toast } from "sonner";

interface StudentRow {
  uid: string;
  name: string;
  className: string;
  classNum: string;
  lastActive: Date;
  score: number;
  modulesStudied: number;
}

type SortKey = "name" | "lastActive" | "score" | "modulesStudied";

export default function StudentsPage() {
  const { uid } = useAuthStore();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!uid) return;
    fetchStudents();
  }, [uid]);

  async function fetchStudents() {
    try {
      const studentsQ = query(
        collection(db(), "users"),
        where("role", "==", "student"),
        orderBy("lastActive", "desc")
      );
      const snap = await getDocs(studentsQ);

      const rows: StudentRow[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        let name = "Unknown";
        let className = "";
        let classNum = "";

        try {
          name = await decrypt(data.nameEnc as string);
          className = await decrypt(data.classEnc as string);
          classNum = await decrypt(data.classNumEnc as string);
        } catch {
          // Decryption failed, use defaults
        }

        // Fetch score and modules studied
        const progressSnap = await getDocs(
          query(
            collection(db(), "progress"),
            where("userId", "==", docSnap.id)
          )
        );

        let totalScore = 0;
        let count = 0;
        progressSnap.docs.forEach((p) => {
          totalScore += (p.data().score as number) ?? 0;
          count++;
        });

        rows.push({
          uid: docSnap.id,
          name,
          className,
          classNum,
          lastActive: data.lastActive
            ? new Date((data.lastActive as { seconds: number }).seconds * 1000)
            : new Date(0),
          score: count > 0 ? Math.round(totalScore / count) : 0,
          modulesStudied: count,
        });
      }

      setStudents(rows);
    } catch (err) {
      console.error("Error fetching students:", err);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const filteredList = students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.className.toLowerCase().includes(term)
    );

    filteredList.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "lastActive":
          cmp = a.lastActive.getTime() - b.lastActive.getTime();
          break;
        case "score":
          cmp = a.score - b.score;
          break;
        case "modulesStudied":
          cmp = a.modulesStudied - b.modulesStudied;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return filteredList;
  }, [students, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function exportCSV() {
    const headers = ["Name", "Class", "Student #", "Score", "Modules Studied", "Last Active"];
    const rows = filtered.map((s) => [
      s.name,
      s.className,
      s.classNum,
      `${s.score}%`,
      String(s.modulesStudied),
      s.lastActive.toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((r) => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  }

  function formatDate(d: Date) {
    if (d.getTime() === 0) return "Never";
    const now = Date.now();
    const diff = now - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function SortButton({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    return (
      <button
        onClick={() => toggleSort(sortKeyName)}
        className="flex items-center gap-1 text-xs font-medium text-warm-text-muted hover:text-warm-text"
      >
        {label}
        <ArrowUpDown
          className={`size-3 ${sortKey === sortKeyName ? "text-warm-accent" : ""}`}
        />
      </button>
    );
  }

  return (
    <motion.div {...pageTransition} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-normal text-warm-text">
            Students
          </h1>
          <p className="mt-1 text-warm-text-muted">
            View and manage your student roster
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCSV}
          disabled={loading || students.length === 0}
          className="border-warm-border text-warm-text hover:bg-warm-surface-2"
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warm-text-subtle" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or class..."
          className="border-warm-border bg-warm-surface pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-warm-border bg-warm-surface overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4">
                  <div className="size-8 rounded-full bg-warm-surface-2" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded bg-warm-surface-2" />
                    <div className="h-2.5 w-20 rounded bg-warm-surface-2" />
                  </div>
                  <div className="h-6 w-14 rounded bg-warm-surface-2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="mb-3 size-10 text-warm-text-subtle" />
              <p className="text-sm text-warm-text-muted">
                {search ? "No students match your search" : "No students found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-warm-border bg-warm-surface-2">
                    <th className="px-4 py-3 text-left">
                      <SortButton label="Name" sortKeyName="name" />
                    </th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">
                      Class
                    </th>
                    <th className="hidden px-4 py-3 text-left sm:table-cell">
                      <SortButton label="Last Active" sortKeyName="lastActive" />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortButton label="Score" sortKeyName="score" />
                    </th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">
                      <SortButton label="Modules" sortKeyName="modulesStudied" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr
                      key={student.uid}
                      onClick={() => router.push(`/teacher/students/${student.uid}`)}
                      className="cursor-pointer border-b border-warm-border/50 transition-colors hover:bg-warm-surface-2/50 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warm-accent/10 text-xs font-semibold text-warm-accent">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-warm-text">
                              {student.name}
                            </p>
                            <p className="text-xs text-warm-text-muted sm:hidden">
                              {student.className}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-sm text-warm-text-muted">
                          {student.className || "N/A"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-sm text-warm-text-muted">
                          {formatDate(student.lastActive)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={student.score >= 70
                            ? "bg-emerald-100 text-emerald-700"
                            : student.score >= 40
                            ? "bg-amber-100 text-amber-700"
                            : student.score > 0
                            ? "bg-red-100 text-red-700"
                            : "bg-warm-surface-2 text-warm-text-muted"
                          }
                          variant="secondary"
                        >
                          {student.score}%
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-sm text-warm-text-muted">
                          {student.modulesStudied}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      {!loading && students.length > 0 && (
        <p className="text-xs text-warm-text-subtle">
          Showing {filtered.length} of {students.length} students
        </p>
      )}
    </motion.div>
  );
}
