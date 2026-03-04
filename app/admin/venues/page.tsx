"use client";

import React, { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { MapPin, Trash2, Edit } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DEFAULT_ADVANCE_PERCENT } from "@/lib/pricing/pricing";

/**
 * Admin Venues Page
 *
 * Minimal, professional management UI for venues.
 * - List venues
 * - Create new venue
 * - Edit and delete existing venues
 *
 * This component keeps the UI simple and focused so it can be rendered
 * inside the `app/admin/layout.tsx` shell and respond to sub-route rendering.
 */

type Venue = {
  id: string;
  name?: string;
  address?: string;
  advancePercentage?: number;
  platformCommission?: number;
  createdAt?: any;
};

export default function AdminVenuesPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Create form state
  const [creating, setCreating] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newAddress, setNewAddress] = useState<string>("");
  const [newAdvancePercent, setNewAdvancePercent] = useState<string>(String(DEFAULT_ADVANCE_PERCENT));
  const [newPlatformCommission, setNewPlatformCommission] = useState<string>("0");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editAddress, setEditAddress] = useState<string>("");
  const [editAdvancePercent, setEditAdvancePercent] = useState<string>("0");
  const [editPlatformCommission, setEditPlatformCommission] = useState<string>("0");

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "venues"),
        orderBy("createdAt", "desc"),
        limit(500)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Venue[];
      setVenues(list);
    } catch (err) {
      console.error("Failed to load venues", err);
      toast.error("Failed to load venues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newName.trim()) {
      toast.error("Please provide a name for the venue.");
      return;
    }
    setCreating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");
      const advanceValue = Math.max(0, Math.min(100, parseFloat(newAdvancePercent) || 0));
      const platformValue = Math.max(0, Math.min(100, parseFloat(newPlatformCommission) || 0));
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          address: newAddress.trim() || null,
          advancePercentage: advanceValue,
          platformCommission: platformValue,
          pricePerHour: 0,
          slotConfig: { slotDuration: 60, openTime: "06:00", closeTime: "22:00" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setNewName("");
      setNewAddress("");
      setNewAdvancePercent(String(DEFAULT_ADVANCE_PERCENT));
      setNewPlatformCommission("0");
      toast.success("Venue created");
      fetchVenues();
    } catch (err: any) {
      console.error("Create venue failed", err);
      toast.error(err?.message || "Failed to create venue");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (v: Venue) => {
    setEditingId(v.id);
    setEditName(v.name ?? "");
    setEditAddress(v.address ?? "");
    setEditAdvancePercent(String(v.advancePercentage ?? DEFAULT_ADVANCE_PERCENT));
    setEditPlatformCommission(String(v.platformCommission ?? 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditAddress("");
    setEditAdvancePercent("0");
    setEditPlatformCommission("0");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      toast.error("Venue name cannot be empty.");
      return;
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");
      const advanceValue = Math.max(0, Math.min(100, parseFloat(editAdvancePercent) || 0));
      const platformValue = Math.max(0, Math.min(100, parseFloat(editPlatformCommission) || 0));
      const res = await fetch(`/api/venues/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim() || null,
          advancePercentage: advanceValue,
          platformCommission: platformValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success("Venue updated");
      cancelEdit();
      fetchVenues();
    } catch (err: any) {
      console.error("Update venue failed", err);
      toast.error(err?.message || "Failed to update venue");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm(
      "Delete this venue? This action cannot be undone."
    );
    if (!ok) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`/api/venues/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Venue deleted");
      setVenues((p) => p.filter((v) => v.id !== id));
    } catch (err: any) {
      console.error("Delete venue failed", err);
      toast.error(err?.message || "Failed to delete venue");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Venues</h1>
        <p className="text-muted-foreground">Manage venues used in the system</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Venues</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{venues.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Venues List</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchVenues}>
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4"
          >
            <div className="sm:col-span-1">
              <Input
                placeholder="Venue name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="Venue name"
                required
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                placeholder="Address (optional)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                aria-label="Venue address"
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                type="number"
                placeholder="Advance % (user pays online)"
                value={newAdvancePercent}
                onChange={(e) => setNewAdvancePercent(e.target.value)}
                aria-label="Advance percentage"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                type="number"
                placeholder="Platform commission %"
                value={newPlatformCommission}
                onChange={(e) => setNewPlatformCommission(e.target.value)}
                aria-label="Platform commission percentage"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="sm:col-span-1 flex items-center gap-2">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create venue"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNewName("");
                  setNewAddress("");
                  setNewAdvancePercent(String(DEFAULT_ADVANCE_PERCENT));
                  setNewPlatformCommission("0");
                }}
              >
                Clear
              </Button>
            </div>
          </form>

          <Separator className="my-4" />

          {loading ? (
            <div className="text-sm text-muted-foreground py-6">
              Loading venues…
            </div>
          ) : venues.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">
              No venues found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Advance % (online)</TableHead>
                    <TableHead>Platform Commission %</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {venues.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="w-1/3">
                        {editingId === v.id ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          <div className="font-medium">{v.name ?? "—"}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingId === v.id ? (
                          <Input
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {v.address ?? "—"}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingId === v.id ? (
                          <Input
                            type="number"
                            value={editAdvancePercent}
                            onChange={(e) => setEditAdvancePercent(e.target.value)}
                            min="0"
                            max="100"
                            step="0.1"
                            aria-label="Advance percentage"
                          />
                        ) : (
                          <div className="text-sm font-medium">
                            {v.advancePercentage ?? DEFAULT_ADVANCE_PERCENT}%
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingId === v.id ? (
                          <Input
                            type="number"
                            value={editPlatformCommission}
                            onChange={(e) => setEditPlatformCommission(e.target.value)}
                            min="0"
                            max="100"
                            step="0.1"
                            aria-label="Platform commission percentage"
                          />
                        ) : (
                          <div className="text-sm font-medium">
                            {v.platformCommission ?? 0}%
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingId === v.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(v.id)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => startEdit(v)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(v.id)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
