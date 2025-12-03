
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth as firebaseAdminAuth, isAdminInitialized } from "../../../lib/firebase-admin";

const f = createUploadthing();

const auth = async (req: Request) => {
  console.log("UploadThing middleware: Starting auth check");
  
  if (!isAdminInitialized()) {
    console.error("UploadThing middleware: Firebase Admin SDK not initialized");
    throw new Error("Firebase Admin SDK is not initialized on the server");
  }

  const authHeader = req.headers.get("authorization");
  console.log("UploadThing middleware: Auth header present?", !!authHeader);

  if (!authHeader) {
    console.warn("UploadThing middleware: No authorization header found");
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const idToken = match ? match[1] : null;

  if (!idToken) {
    console.warn("UploadThing middleware: Invalid bearer token format");
    return null;
  }

  try {
    // `firebaseAdminAuth` is the Admin Auth instance exported from `lib/firebase-admin`
    console.log("UploadThing middleware: Verifying ID token...");
    const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
    console.log("UploadThing middleware: Token verified for user", decoded.uid);
    return { id: decoded.uid, email: decoded.email };
  } catch (err: any) {
    console.error("UploadThing middleware: Failed to verify ID token", err);
    // Log the full error object for debugging
    console.error(JSON.stringify(err, null, 2));
    return null;
  }
};
 
// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const user = await auth(req);
 
      // If you throw, the user will not be able to upload
      if (!user) throw new Error("Unauthorized");
 
      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for userId:", metadata.userId);
 
      console.log("file url", file.url);
 
      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;
