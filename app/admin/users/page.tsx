"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { Users, Shield, Search, UserCog } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  doc,
  where,
} from "firebase/firestore";

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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

/**
 * Admin Users Page
 *
 * Minimal, professional UI for listing and managing users.
 * - Search & filter users by email
 * - Toggle role between "user" and "manager"
 * - Remove user document from Firestore (soft-delete)
 *
 * Notes:
 * - This component is intended to be rendered inside `app/admin/layout.tsx`
 * - Auth protection and role checks are handled by the admin layout/guard
 */

type UserDoc = {
  id: string;
  email?: string;
  role?: string;
  createdAt?: string | { seconds?: number; nanoseconds?: number };
  disabled?: boolean;
};

export default function AdminUsersPage(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [queryText, setQueryText] = useState<string>("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Load up to 1000 users for management UI (adjust if needed)
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(1000));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as UserDoc[];
      setUsers(list);
    } catch (err) {
      console.error("Failed to load users", err);
      toast.error("Failed to load users. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email ?? "").toLowerCase().includes(q));
  }, [users, queryText]);

  const toggleRole = async (u: UserDoc) => {
    if (!u.id) return;
    // Prevent changing admin account role here for safety
    if (u.role === "admin") {
      toast.error("Cannot change role of an admin account.");
      return;
    }

    const newRole = u.role === "manager" ? "user" : "manager";
    try {
      await updateDoc(doc(db, "users", u.id), { role: newRole });
      setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, role: newRole } : p)));
      toast.success(`Role changed to ${newRole}`);
    } catch (err) {
      console.error("Failed to toggle role", err);
      toast.error("Failed to update role");
    }
  };

  const removeUser = async (u: UserDoc) => {
    if (!u.id) return;
    // Soft safety check
    const ok = window.confirm(
      `Remove user document for ${u.email ?? u.id}? This will delete the Firestore user document (does not delete Auth account).`,
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", u.id));
      setUsers((prev) => prev.filter((p) => p.id !== u.id));
      toast.success("User document removed");
    } catch (err) {
      console.error("Failed to remove user", err);
      toast.error("Failed to remove user");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and roles</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'manager').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <UserCog className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users List</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Input
                placeholder="Search by email"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                aria-label="Search users"
              />
              <Button size="sm" variant="ghost" onClick={() => setQueryText("")}>
                Clear
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {loading ? (
            <div className="text-sm text-muted-foreground py-8">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((u) => {
                    const created =
                      typeof u.createdAt === "string"
                        ? u.createdAt
                        : u.createdAt && "seconds" in u.createdAt
                        ? new Date(u.createdAt.seconds * 1000).toLocaleString()
                        : "—";

                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              u.role === "admin" ? "default" : u.role === "manager" ? "secondary" : "outline"
                            }
                          >
                            {u.role ?? "user"}
                          </Badge>
                        </TableCell>
                        <TableCell>{created}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleRole(u)}
                              disabled={u.role === "admin"}
                              title={u.role === "admin" ? "Cannot change admin role" : "Toggle role user ↔ manager"}
                            >
                              {u.role === "manager" ? "Demote" : "Promote"}
                            </Button>

                            <Button size="sm" variant="destructive" onClick={() => removeUser(u)}>
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
