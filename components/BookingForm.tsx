"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type BookingFormProps = {
  venueId: string;
};

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

export default function BookingForm({ venueId }: BookingFormProps) {
  const { user } = useAuth();
  const [timeSlots, setTimeSlots] = useState<Slot[]>([]);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTimeSlots = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const q = query(
          collection(db, "slots"),
          where("groundId", "==", venueId),
          where("date", ">=", today),
          where("status", "==", "available"),
          orderBy("date"),
          orderBy("startTime")
        );
        const querySnapshot = await getDocs(q);
        const slots: Slot[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          slots.push({
            id: doc.id,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
          });
        });
        setTimeSlots(slots);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch time slots.");
      } finally {
        setLoading(false);
      }
    };

    if (venueId) {
      fetchTimeSlots();
    }
  }, [venueId]);

  const handleBooking = async () => {
    if (!user) {
      toast.error("You must be logged in to book a slot.");
      return;
    }

    if (!selectedTimeSlotId) {
      toast.error("Please select a time slot.");
      return;
    }

    setLoading(true);

    try {
      const selectedSlot = timeSlots.find(
        (slot) => slot.id === selectedTimeSlotId
      );
      if (!selectedSlot) {
        toast.error("Selected time slot is not valid.");
        setLoading(false);
        return;
      }

      const bookingRef = doc(collection(db, "bookings"));
      await setDoc(bookingRef, {
        venueId,
        userId: user.uid,
        timeSlot: `${selectedSlot.date} ${selectedSlot.startTime} - ${selectedSlot.endTime}`,
        slotId: selectedTimeSlotId,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const slotRef = doc(db, "slots", selectedTimeSlotId);
      await updateDoc(slotRef, {
        status: "booked",
      });

      toast.success("Booking successful! Awaiting confirmation.");
      setTimeSlots(timeSlots.filter((slot) => slot.id !== selectedTimeSlotId));
      setSelectedTimeSlotId("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to book slot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book a Slot</CardTitle>
        <CardDescription>
          Select an available time slot to book your futsal session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p>Loading time slots...</p>}
        {!loading && timeSlots.length === 0 && <p>No available time slots.</p>}
        {!loading && timeSlots.length > 0 && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="time-slot">Time Slot</Label>
              <Select
                onValueChange={setSelectedTimeSlotId}
                value={selectedTimeSlotId}
              >
                <SelectTrigger id="time-slot">
                  <SelectValue placeholder="Select a time slot" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {`${slot.date} ${slot.startTime} - ${slot.endTime}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleBooking}
          disabled={loading || !selectedTimeSlotId}
        >
          {loading ? "Booking..." : "Book Now"}
        </Button>
      </CardFooter>
    </Card>
  );
}
