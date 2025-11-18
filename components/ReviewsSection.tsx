"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import VerifiedTick from "@/components/VerifiedTick";
import { MessageSquare, Send, Star } from "lucide-react";

interface Comment {
  id: string;
  text: string;
  author: string;
  role: string;
  rating?: number;
  createdAt: string;
}

interface ReviewsSectionProps {
  venueId: string;
}

const ReviewsSection = ({ venueId }: ReviewsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const { user, role } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setIsLoading(true);
        const q = query(
          collection(db, `venues/${venueId}/comments`),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const commentsList = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Comment)
        );
        setComments(commentsList);
      } catch (error) {
        console.error("Error fetching comments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [venueId]);

  const handleAddComment = async () => {
    if (!user) {
      toast.error("Please log in to leave a review.");
      return;
    }

    if (!newComment.trim()) {
      toast.error("Please write a review.");
      return;
    }

    if (rating === 0) {
      toast.error("Please select a star rating (1-5 stars).");
      return;
    }

    try {
      setIsSubmitting(true);
      const commentData = {
        text: newComment,
        author: user.displayName || user.email || "Anonymous",
        role: role || "user",
        rating: rating,
        createdAt: new Date().toISOString(),
      };

      const commentDocRef = await addDoc(
        collection(db, `venues/${venueId}/comments`),
        commentData
      );

      setComments([{ id: commentDocRef.id, ...commentData }, ...comments]);
      setNewComment("");
      setRating(0);
      setHoverRating(0);

      // Also store in reviews collection for aggregation
      const reviewDocRef = doc(db, "reviews", `${venueId}_${user.uid}`);
      await setDoc(
        reviewDocRef,
        {
          venueId: venueId,
          userId: user.uid,
          rating: rating,
          comment: newComment,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success("Review posted successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-yellow-500",
      "bg-teal-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-8">
      {/* Post Review Form */}
      {user && (
        <Card className="border-2 border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className={`${getAvatarColor(user.displayName || user.email || "U")} flex-shrink-0`}>
                <AvatarFallback className="text-white font-semibold">
                  {getInitials(user.displayName || user.email || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                {/* Star Rating */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Your Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (hoverRating || rating)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-3 text-sm font-medium text-gray-700 self-center">
                        {rating} {rating === 1 ? "star" : "stars"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment Textarea */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Your Review <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your experience with this venue..."
                    className="min-h-[100px] resize-none text-base border-2 focus:border-blue-400"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleAddComment}
                    disabled={isSubmitting || !newComment.trim() || rating === 0}
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2 animate-pulse" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Post Review
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading reviews...</p>
          </div>
        ) : comments.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="py-16 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">
                No reviews yet
              </p>
              <p className="text-gray-600">
                Be the first to share your experience with this venue!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {comments.map((comment, index) => (
              <div key={comment.id}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <Avatar className={`${getAvatarColor(comment.author)} flex-shrink-0`}>
                        <AvatarFallback className="text-white font-semibold">
                          {getInitials(comment.author)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold text-gray-900 text-base">
                            {comment.author}
                          </p>
                          {comment.role === "manager" && <VerifiedTick />}
                          {comment.role === "admin" && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                              Admin
                            </span>
                          )}
                          <span className="text-gray-400">•</span>
                          <p className="text-sm text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </p>
                        </div>
                        
                        {/* Star Rating Display */}
                        {comment.rating && (
                          <div className="flex gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= comment.rating!
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {index < comments.length - 1 && <Separator className="my-6" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsSection;
