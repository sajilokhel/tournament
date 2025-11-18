"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import VerifiedTick from "@/components/VerifiedTick";
import { Star } from "lucide-react";
import RatingModal from "@/components/RatingModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import WeeklySlotsGrid from "@/components/WeeklySlotsGrid";

interface Comment {
  id: string;
  text: string;
  author: string;
  role: string;
  createdAt: string;
}

interface Booking {
  id: string;
  venueId: string;
  userId: string;
  timeSlot: string;
  status: string;
  createdAt: any;
  rated?: boolean;
}

const VenuePage = () => {
  const { id } = useParams();
  const [venue, setVenue] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const { user, role } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [bookingToRate, setBookingToRate] = useState<Booking | null>(null);
  const [currentReview, setCurrentReview] = useState<{
    rating?: number;
    review?: string;
  }>({});
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);

  useEffect(() => {
    const fetchVenue = async () => {
      const docRef = doc(db, "venues", id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const venueData = { id: docSnap.id, ...docSnap.data() };
        setVenue(venueData);
        if (venueData.imageUrls && venueData.imageUrls.length > 0) {
          setSelectedImage(venueData.imageUrls[0]);
        }
      }
    };

    const fetchComments = async () => {
      const q = query(
        collection(db, `venues/${id}/comments`),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const commentsList = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Comment)
      );
      setComments(commentsList);
    };

    if (id) {
      fetchVenue();
      fetchComments();
    }
  }, [id]);

  useEffect(() => {
    const checkForUnratedBookings = async () => {
      if (!user || !id) return;

      const bookingsQuery = query(
        collection(db, "bookings"),
        where("userId", "==", user.uid),
        where("venueId", "==", id),
        where("status", "==", "completed"),
        where("rated", "!=", true)
      );

      const querySnapshot = await getDocs(bookingsQuery);
      if (!querySnapshot.empty) {
        const booking = querySnapshot.docs[0].data() as Booking;
        setBookingToRate({ ...booking, id: querySnapshot.docs[0].id });

        const reviewDocRef = doc(db, "reviews", `${id}_${user.uid}`);
        const reviewDocSnap = await getDoc(reviewDocRef);
        if (reviewDocSnap.exists()) {
          setCurrentReview({
            rating: reviewDocSnap.data().rating,
            review: reviewDocSnap.data().comment,
          });
        }

        setIsRatingModalOpen(true);
      }
    };

    checkForUnratedBookings();
  }, [user, id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) {
      toast.error("Please write a comment and be logged in.");
      return;
    }

    const commentData = {
      text: newComment,
      author: user.displayName || user.email,
      role: role,
      createdAt: new Date().toISOString(),
    };

    const commentDocRef = await addDoc(
      collection(db, `venues/${id}/comments`),
      commentData
    );
    setComments([{ id: commentDocRef.id, ...commentData }, ...comments]);
    setNewComment("");

    const reviewDocRef = doc(db, "reviews", `${id}_${user.uid}`);
    await setDoc(
      reviewDocRef,
      {
        venueId: id,
        userId: user.uid,
        comment: newComment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    toast.success("Comment added successfully");
  };

  const handleCloseRatingModal = () => {
    setIsRatingModalOpen(false);
    setBookingToRate(null);
  };

  if (!venue) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  const isManagerOfVenue =
    user && role === "manager" && venue.managedBy === user.uid;

  return (
    <div className="container mx-auto px-4 py-8">
      {bookingToRate && (
        <RatingModal
          bookingId={bookingToRate.id}
          venueId={id as string}
          userId={user!.uid}
          isOpen={isRatingModalOpen}
          onClose={handleCloseRatingModal}
          currentRating={currentReview.rating}
          currentReview={currentReview.review}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div
            className="relative overflow-hidden mb-4 bg-gray-200 rounded-lg shadow-lg"
            style={{ paddingTop: "56.25%" }}
          >
            <img
              src={
                selectedImage ||
                "https://via.placeholder.com/1280x720?text=No+Image"
              }
              alt="Selected Venue"
              className="absolute top-0 left-0 w-full h-full object-contain"
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {venue.imageUrls &&
              venue.imageUrls.map((image: string, index: number) => (
                <div
                  key={index}
                  className={`relative overflow-hidden rounded-lg cursor-pointer hover:opacity-75 ${
                    selectedImage === image
                      ? "ring-2 ring-offset-2 ring-blue-500"
                      : ""
                  }`}
                  style={{ paddingTop: "100%" }}
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={image}
                    alt={`Venue thumbnail ${index + 1}`}
                    className="absolute top-0 left-0 w-full h-full object-contain"
                  />
                </div>
              ))}
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
            {venue.name}
          </h1>
          <div className="flex items-center mb-4">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-5 h-5 text-yellow-400 fill-current"
                />
              ))}
              <span className="ml-2 text-gray-600">(No reviews yet)</span>
            </div>
          </div>
          <p className="text-gray-700 mb-6">{venue.description}</p>

          <div className="mb-6">
            <p className="text-3xl font-bold text-gray-900">
              Rs. {venue.pricePerHour}
              <span className="text-lg font-normal text-gray-600">/hour</span>
            </p>
          </div>

          {venue.attributes && Object.keys(venue.attributes).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Extra Features</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {Object.entries(venue.attributes).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-semibold">{key}:</span>{" "}
                    {value as string}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Dialog open={isSlotDialogOpen} onOpenChange={setIsSlotDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">View Slots</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Time Slots</DialogTitle>
              </DialogHeader>
              <WeeklySlotsGrid groundId={id as string} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t">
        <h2 className="text-3xl font-bold mb-6">Reviews & Comments</h2>
        {user && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Leave a Comment</h3>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your experience..."
              className="mb-2"
            />
            <Button onClick={handleAddComment}>Post Comment</Button>
          </div>
        )}

        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                {comment.author.charAt(0).toUpperCase()}
              </div>
              <div className="flex-grow">
                <div className="flex items-center mb-1">
                  <p className="font-bold">{comment.author}</p>
                  {comment.role === "manager" && <VerifiedTick />}
                </div>
                <p className="text-gray-700">{comment.text}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VenuePage;
