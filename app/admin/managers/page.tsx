"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { Users, Search, Briefcase, ChevronRight } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ManagerDoc = {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  createdAt?: any;
  phoneNumber?: string;
};

export default function AdminManagersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [managers, setManagers] = useState<ManagerDoc[]>([]);
  const [queryText, setQueryText] = useState<string>("");

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("role", "==", "manager"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ManagerDoc[];
      setManagers(list);
    } catch (err) {
      console.error("Failed to load managers", err);
      toast.error("Failed to load managers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter(
      (m) =>
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.displayName ?? "").toLowerCase().includes(q)
    );
  }, [managers, queryText]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Managers</h1>
        <p className="text-muted-foreground">
          View and manage venue managers. Click on a manager to see detailed
          stats and payouts.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Manager List
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search managers..."
              className="pl-8"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading managers...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No managers found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((manager) => (
                  <TableRow
                    key={manager.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/managers/${manager.id}`)}
                  >
                    <TableCell className="font-medium">
                      {manager.displayName || "N/A"}
                    </TableCell>
                    <TableCell>{manager.email}</TableCell>
                    <TableCell>
                      {manager.createdAt?.seconds
                        ? new Date(
                            manager.createdAt.seconds * 1000
                          ).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Details <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
