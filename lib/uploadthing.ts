// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { UploadThingError } from "uploadthing/server";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({ image: { maxFileSize: "4MB" } })
//     .middleware(async ({ req }) => {
//       return { userId: "user" }; // Replace with actual auth
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       console.log("Upload complete for userId:", metadata.userId);
//       console.log("file url", file.url);
//       return { uploadedBy: metadata.userId };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;


import { generateReactHelpers, generateUploadButton } from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

export const UploadButton = generateUploadButton<OurFileRouter>();
