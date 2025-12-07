/*
 * Grounds API
 *
 * Routes:
 *   - GET  /api/grounds
 *   - POST /api/grounds
 *
 * Purpose:
 *   Simple file-backed API for reading and appending ground entries from/to
 *   `data/grounds.json`. This is intended for development/demo usage. In
 *   production you would typically use a real database and proper auth.
 *
 * Authentication:
 *   - None enforced in this implementation.
 *
 * JSON shapes:
 *
 * GET /api/grounds
 *   Request:
 *     - No body required.
 *
 *   Success (200):
 *     - Returns an array of ground objects (as stored in data/grounds.json).
 *       Example:
 *         [
 *           { "id": 1, "name": "Ground A", "location": "City" },
 *           ...
 *         ]
 *
 *   Failure (on read/parse error):
 *     - Returns an empty array [] (current implementation).
 *
 * POST /api/grounds
 *   Request:
 *     - Body: JSON object representing a new ground. Typical fields might
 *       include: { "name": string, "location": string, ... }.
 *
 *   Success (200):
 *     - Body:
 *         { "message": "Ground added successfully" }
 *     - Side-effect: Appends the new ground to `data/grounds.json` and
 *       assigns a numeric `id` value of `grounds.length + 1`.
 *
 *   Failure (500):
 *     - Body:
 *         { "message": "Error adding ground" }
 *     - Occurs when reading/writing/parsing fails or the provided JSON is invalid.
 *
 * Notes / edge-cases:
 *   - This file uses synchronous process.cwd() + '/data/grounds.json' to locate
 *     the data file. If that file does not exist, GET will throw and return [].
 *   - POST trusts the incoming JSON payload and simply appends it with an `id`.
 *     There is no validation of required fields, no deduplication, and no
 *     concurrency control: concurrent writes may cause lost updates.
 *   - Consider switching to a transactional persistent store and adding
 *     validation + authentication for production.
 */

import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";

const groundsFilePath = process.cwd() + "/data/grounds.json";

export async function GET() {
  try {
    const data = await fs.readFile(groundsFilePath, "utf-8");
    const grounds = JSON.parse(data);
    return NextResponse.json(grounds);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const newGround = await req.json();
    const data = await fs.readFile(groundsFilePath, "utf-8");
    const grounds = JSON.parse(data);
    grounds.push({ ...newGround, id: grounds.length + 1 });
    await fs.writeFile(groundsFilePath, JSON.stringify(grounds, null, 2));
    return NextResponse.json({ message: "Ground added successfully" });
  } catch (error) {
    return NextResponse.json(
      { message: "Error adding ground" },
      { status: 500 },
    );
  }
}
