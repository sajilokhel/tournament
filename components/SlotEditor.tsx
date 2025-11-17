"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

type SlotEditorProps = {
  venueId: string;
};

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "booked";
}

export default function SlotEditor({ venueId }: SlotEditorProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newSlot, setNewSlot] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "slots"),
        where("groundId", "==", venueId),
        orderBy("date"),
        orderBy("startTime")
      );
      const querySnapshot = await getDocs(q);
      const fetchedSlots: Slot[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedSlots.push({
          id: doc.id,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status,
        });
      });
      setSlots(fetchedSlots);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch time slots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      fetchSlots();
    }
  }, [venueId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewSlot((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSlot = async () => {
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime) {
      toast.error("Please fill in all fields to add a slot.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "slots"), {
        groundId: venueId,
        date: newSlot.date,
        startTime: newSlot.startTime,
        endTime: newSlot.endTime,
        status: "available",
        createdAt: serverTimestamp(),
      });
      toast.success("Slot added successfully!");
      setNewSlot({ date: "", startTime: "", endTime: "" });
      fetchSlots(); // Refresh the list
    } catch (err) {
      console.error(err);
      toast.error("Failed to add slot.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (slotId: string, status: string) => {
    if (status === "booked") {
      toast.error(
        "Cannot delete a booked slot. Please cancel the booking first."
      );
      return;
    }
    setLoading(true);
    try {
      await deleteDoc(doc(db, "slots", slotId));
      toast.success("Slot deleted successfully!");
      fetchSlots(); // Refresh the list
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete slot.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Time Slots</CardTitle>
        <CardDescription>
          Add or remove available time slots for your ground.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <h4 className="font-semibold">Add New Slot</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                type="date"
                id="date"
                name="date"
                value={newSlot.date}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                type="time"
                id="startTime"
                name="startTime"
                value={newSlot.startTime}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input
                type="time"
                id="endTime"
                name="endTime"
                value={newSlot.endTime}
                onChange={handleInputChange}
              />
            </div>
          </div>
          <Button onClick={handleAddSlot} disabled={loading} className="w-full">
            {loading ? "Adding..." : "Add Slot"}
          </Button>
        </div>
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Existing Slots</h4>
          {loading && <p>Loading slots...</p>}
          {!loading && slots.length === 0 && <p>No slots created yet.</p>}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex justify-between items-center p-2 border rounded-lg"
              >
                <div>
                  <p>{`${slot.date} ${slot.startTime} - ${slot.endTime}`}</p>
                  <p
                    className={`text-sm ${
                      slot.status === "booked"
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
                  >
                    {slot.status}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteSlot(slot.id, slot.status)}
                  disabled={loading || slot.status === "booked"}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
