
import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming db is exported from your firebase config

export async function GET(req: NextRequest) {
  try {
    const managersSnapshot = await getDocs(collection(db, "managers"));

    for (const managerDoc of managersSnapshot.docs) {
      const managerId = managerDoc.id;
      const schedulesSnapshot = await getDocs(
        collection(db, "managers", managerId, "schedules")
      );
      const groundId = managerDoc.data().groundId; // Assuming manager has a groundId

      if (schedulesSnapshot.empty) {
        continue;
      }

      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dayOfWeek = date.getDay(); // Sunday = 0, Monday = 1, etc.

        for (const scheduleDoc of schedulesSnapshot.docs) {
          const schedule = scheduleDoc.data();
          if (schedule.weekday === dayOfWeek) {
            for (
              let hour = schedule.startHour;
              hour < schedule.endHour;
              hour++
            ) {
              const slotDate = date.toISOString().split("T")[0]; // YYYY-MM-DD
              const startTime = `${hour}:00`;
              const endTime = `${hour + 1}:00`;

              // Check for duplicate slots
              const slotsQuery = query(
                collection(db, "slots"),
                where("groundId", "==", groundId),
                where("date", "==", slotDate),
                where("startTime", "==", startTime)
              );

              const existingSlots = await getDocs(slotsQuery);

              if (existingSlots.empty) {
                await addDoc(collection(db, "slots"), {
                  groundId: groundId,
                  date: slotDate,
                  startTime: startTime,
                  endTime: endTime,
                  status: "AVAILABLE", // Default status
                  createdAt: new Date(),
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: "Slot generation completed successfully.",
    });
  } catch (error) {
    console.error("Error generating slots:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

