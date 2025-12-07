/**
 * UploadThing route handler
 *
 * Routes:
 *   - GET  /api/uploadthing
 *   - POST /api/uploadthing
 *
 * Purpose:
 *   This file exports the `GET` and `POST` handlers created by `uploadthing`'s
 *   `createRouteHandler` function. The actual upload logic, validation, and
 *   per-file processing are defined in the `ourFileRouter` router (see ./core).
 *
 * Request expectations (POST):
 *   - Requests are typically sent by the UploadThing client library or a
 *     compatible multipart/form-data client.
 *   - The exact required fields, file parameter names, and any metadata are
 *     governed by the `ourFileRouter` configuration.
 *   - Authentication/authorization requirements (if any) should be enforced
 *     within the router's handlers or upstream middleware. This file simply
 *     wires the router into the Next.js App Router.
 *
 * Responses:
 *   - Success (2xx):
 *       The route handler will return a JSON success response as defined by
 *       the `uploadthing` runtime and the `ourFileRouter` implementation.
 *       Typical successful responses from upload handlers include information
 *       about uploaded file(s) such as storage URLs, file ids, sizes and any
 *       extra metadata the router attaches.
 *
 *   - Client errors (4xx):
 *       If the request is malformed (missing required parts) or fails router
 *       validation, the handler will return a 4xx JSON error response. The
 *       exact shape and status code depend on the router and the library's
 *       runtime behavior.
 *
 *   - Server errors (5xx):
 *       Unhandled exceptions or storage/backend failures surface as 5xx
 *       responses with an error message. See server logs for details.
 *
 * Examples / Notes:
 *   - Do not modify this file to add business logic. Implement per-file
 *     validation, transforms, and authorization rules inside `ourFileRouter`
 *     (./core).
 *   - If you need to require authentication for uploads, either:
 *       1) Wrap the UploadThing router operations with auth checks in the
 *          router's handler functions, or
 *       2) Add a middleware that validates the request before it reaches this
 *          handler (depending on app router/middleware setup).
 *   - The route is intended to be used by the UploadThing client helpers which
 *     perform pre-signed/managed upload flows. If you call this endpoint
 *     manually, ensure you follow the router's required payload format.
 */

import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
