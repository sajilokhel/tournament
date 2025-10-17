"use client";

import React, { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";

import { IconFolderCode } from "@tabler/icons-react";
import { ArrowUpRightIcon } from "lucide-react";

/**
 * Tester page
 *
 * - Protected by AuthGuard so only authenticated users can use it.
 * - Allows adding dummy venues and bookings to Firestore.
 * - Shows existing venues; uses `Empty` UI when no venues exist.
 *
 * NOTE: This page is intended for development / testing only. Remove or secure
 * it before deploying to production.
 */

type UserDoc = {
  id: string;
  email?: string;
  role?: string;
};

interface Venue {
  id: string;
  name: string;
  address?: string;
  facilities?: string;
  qrCode?: string;
}

export default function TesterPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for creating a venue
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [facilities, setFacilities] = useState("");
  const [qrCode, setQrCode] = useState("");

  // Booking form state
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState("9:00-10:00");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchVenues();
  }, []);

  async function fetchVenues() {
    // fetch both venues and users so tester can manage roles too
    setLoading(true);
    try {
      // venues
      const vSnap = await getDocs(collection(db, "venues"));
      const list: Venue[] = vSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Venue, "id">),
      }));
      setVenues(list);

      // users
      try {
        const uSnap = await getDocs(collection(db, "users"));
        const userList: UserDoc[] = uSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setUsers(userList);
      } catch (uErr) {
        console.warn(
          "No users collection found or failed to fetch users",
          uErr,
        );
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to fetch venues", err);
      setVenues([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVenue() {
    if (!name.trim()) {
      alert("Please provide a name for the venue.");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "venues"), {
        name: name.trim(),
        address: address.trim() || undefined,
        facilities: facilities.trim() || undefined,
        qrCode: qrCode.trim() || undefined,
      });
      setName("");
      setAddress("");
      setFacilities("");
      setQrCode("");
      await fetchVenues();
      alert("Venue added.");
    } catch (err) {
      console.error("Failed to add venue", err);
      alert("Failed to add venue. See console.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddBooking() {
    if (!selectedVenueId) {
      alert("Select a venue first.");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "bookings"), {
        venueId: selectedVenueId,
        userId: "tester", // dummy tester user
        timeSlot,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      alert("Booking (dummy) submitted as pending.");
      setSelectedVenueId(null);
    } catch (err) {
      console.error("Failed to add booking", err);
      alert("Failed to add booking. See console.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddSampleVenues() {
    setCreating(true);
    const samples = [
      {
        name: "Downtown Futsal Arena",
        address: "123 Central Ave",
        facilities: "Indoor, lights, lockers",
        qrCode: "https://via.placeholder.com/150?text=QR+Downtown",
      },
      {
        name: "Riverside Court",
        address: "45 River Rd",
        facilities: "Outdoor, floodlights",
        qrCode: "https://via.placeholder.com/150?text=QR+Riverside",
      },
      {
        name: "Uptown Sports Hub",
        address: "8 Uptown Plaza",
        facilities: "Indoor, turf, showers",
        qrCode: "https://via.placeholder.com/150?text=QR+Uptown",
      },
    ];

    try {
      for (const s of samples) {
        await addDoc(collection(db, "venues"), s);
      }
      await fetchVenues();
      alert("Sample venues added.");
    } catch (err) {
      console.error("Failed to add sample venues", err);
      alert("Failed to add samples. See console.");
    } finally {
      setCreating(false);
    }
  }

  async function handleClearAllVenues() {
    if (!confirm("Delete all venues? This cannot be undone.")) return;
    setCreating(true);
    try {
      const snap = await getDocs(collection(db, "venues"));
      const deletes = snap.docs.map((d) => deleteDoc(doc(db, "venues", d.id)));
      await Promise.all(deletes);
      await fetchVenues();
      alert("All venues deleted.");
    } catch (err) {
      console.error("Failed to delete venues", err);
      alert("Failed to delete venues. See console.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tester - Seed & Quick Actions</CardTitle>
            <div className="text-xs text-muted-foreground">
              Use this page to create dummy venues and bookings for development.
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Create a venue</h3>
                <div className="space-y-2">
                  <Input
                    placeholder="Venue name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    placeholder="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Textarea
                    placeholder="Facilities (comma separated or description)"
                    value={facilities}
                    onChange={(e) => setFacilities(e.target.value)}
                  />
                  <Input
                    placeholder="QR Code Image URL"
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button onClick={handleAddVenue} disabled={creating}>
                      Add Venue
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleAddSampleVenues}
                      disabled={creating}
                    >
                      Add Sample Venues
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleClearAllVenues}
                      disabled={creating}
                    >
                      Clear All Venues
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">
                  Create a dummy booking
                </h3>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground block">
                    Select venue
                  </label>
                  <select
                    value={selectedVenueId ?? ""}
                    onChange={(e) => setSelectedVenueId(e.target.value || null)}
                    className="w-full bg-input border rounded px-3 py-2"
                  >
                    <option value="">-- Select venue --</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>

                  <label className="text-sm text-muted-foreground block mt-2">
                    Time slot
                  </label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full bg-input border rounded px-3 py-2"
                  >
                    <option>9:00-10:00</option>
                    <option>10:00-11:00</option>
                    <option>11:00-12:00</option>
                    <option>12:00-13:00</option>
                    <option>13:00-14:00</option>
                    <option>14:00-15:00</option>
                    <option>15:00-16:00</option>
                    <option>16:00-17:00</option>
                  </select>

                  <div className="flex gap-2 mt-3">
                    <Button onClick={handleAddBooking} disabled={creating}>
                      Submit Booking (pending)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <div className="text-sm text-muted-foreground">
              Tip: Use the sample venues button to quickly populate data for
              visual testing.
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Venues</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading venues...
              </div>
            ) : venues.length === 0 ? (
              <div className="p-6">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconFolderCode className="size-6" />
                    </EmptyMedia>

                    <EmptyTitle>No venues yet</EmptyTitle>
                    <EmptyDescription>
                      You don't have any venues in your database. Get started by
                      creating your first venue or import a set of venues for
                      testing.
                    </EmptyDescription>
                  </EmptyHeader>

                  <EmptyContent>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // prefill the form by focusing the name input is optional;
                          // for quickness we open the sample venues flow when create is pressed
                          // but you can modify to navigate or open a create-venue dialog
                          document
                            .querySelector<HTMLInputElement>(
                              'input[placeholder="Venue name"]',
                            )
                            ?.focus();
                        }}
                      >
                        Create Venue
                      </Button>
                      <Button variant="outline" onClick={handleAddSampleVenues}>
                        Import Venues
                      </Button>
                    </div>
                  </EmptyContent>

                  <Button
                    variant="link"
                    asChild
                    className="text-muted-foreground mt-4"
                    size="sm"
                  >
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open("https://example.com/docs", "_blank");
                      }}
                    >
                      Learn More{" "}
                      <ArrowUpRightIcon className="inline-block size-4 ml-1" />
                    </a>
                  </Button>
                </Empty>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {venues.map((v) => (
                  <div
                    key={v.id}
                    className="border rounded-lg p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-lg font-semibold">{v.name}</div>
                      {v.address && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {v.address}
                        </div>
                      )}
                      {v.facilities && (
                        <div className="text-sm mt-2">{v.facilities}</div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {v.qrCode ? (
                          <img
                            alt="qr"
                            src={v.qrCode}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">
                            No QR
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            // quick create an approved booking for this venue
                            try {
                              await addDoc(collection(db, "bookings"), {
                                venueId: v.id,
                                userId: "tester",
                                timeSlot: "18:00-19:00",
                                status: "approved",
                                createdAt: new Date().toISOString(),
                              });
                              alert("Approved booking created for demo.");
                            } catch (err) {
                              console.error(err);
                              alert("Failed to create booking.");
                            }
                          }}
                        >
                          Create approved booking
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-sm text-muted-foreground">
                  No users found. Create users by signing up or add user docs in
                  Firestore (collection `users` with fields `email` and `role`).
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-4 p-3 border rounded-md"
                  >
                    <div>
                      <div className="font-medium">{u.email ?? u.id}</div>
                      <div className="text-xs text-muted-foreground">
                        Role: {u.role ?? "user"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={u.role ?? "user"}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          try {
                            await updateDoc(doc(db, "users", u.id), {
                              role: newRole,
                            });
                            // refresh list
                            await fetchVenues();
                          } catch (err) {
                            console.error("Failed to update role", err);
                            alert(
                              "Failed to update role. Check console for details.",
                            );
                          }
                        }}
                        className="border rounded px-2 py-1 bg-background"
                      >
                        <option value="user">user</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>

                      <button
                        onClick={async () => {
                          // quick toggle between user <-> manager
                          const newRole =
                            u.role === "manager" ? "user" : "manager";
                          try {
                            await updateDoc(doc(db, "users", u.id), {
                              role: newRole,
                            });
                            await fetchVenues();
                          } catch (err) {
                            console.error("Toggle role failed", err);
                            alert("Failed to toggle role. See console.");
                          }
                        }}
                        className="px-3 py-1 rounded bg-accent text-accent-foreground"
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick checks</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                onClick={async () => {
                  // quick count bookings for debugging
                  try {
                    const snap = await getDocs(collection(db, "bookings"));
                    alert(`Total bookings: ${snap.size}`);
                  } catch (err) {
                    console.error(err);
                    alert("Failed to fetch bookings.");
                  }
                }}
              >
                Count bookings
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  // quick remove all bookings (dangerous!)
                  if (
                    !confirm(
                      "Delete all bookings? This cannot be undone. Continue?",
                    )
                  )
                    return;
                  try {
                    const snap = await getDocs(collection(db, "bookings"));
                    const deletes = snap.docs.map((d) =>
                      deleteDoc(doc(db, "bookings", d.id)),
                    );
                    await Promise.all(deletes);
                    alert("All bookings removed.");
                  } catch (err) {
                    console.error(err);
                    alert("Failed to delete bookings.");
                  }
                }}
              >
                Clear all bookings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
