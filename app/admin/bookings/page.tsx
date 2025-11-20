"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { Calendar, CheckCircle, XCircle, Clock, Filter } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Booking = {
  id: string;
  venueId?: string;
  userId?: string;
  timeSlot?: string;
  status?: string;
  createdAt?: string | { seconds?: number; nanoseconds?: number };
};

export default function AdminBookingsPage(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "bookings"),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Booking[];
      setBookings(list);
    } catch (err) {
      console.error("Failed to load bookings", err);
      // Keep UI simple: developer can replace with toast later
      alert("Failed to load bookings. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    // Intentionally not adding fetchBookings to deps to avoid re-creating the function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "bookings", id), { status });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    } catch (err) {
      console.error("Failed to update booking status", err);
      alert("Failed to update booking. See console for details.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">Manage recent bookings</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.filter(b => b.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.filter(b => b.status === 'approved').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle>Bookings List</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchBookings}>
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8">Loading…</div>
          ) : bookings.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8">No bookings available.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.venueId ?? "—"}</TableCell>
                      <TableCell>{b.userId ?? "—"}</TableCell>
                      <TableCell>{b.timeSlot ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            b.status === "pending"
                              ? "secondary"
                              : b.status === "approved"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {b.status ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {b.status === "pending" ? (
                            <>
                              <Button size="sm" onClick={() => updateStatus(b.id, "approved")}>
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateStatus(b.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "pending")}>
                              Set pending
                            </Button>
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
