
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';

const groundsFilePath = process.cwd() + '/data/grounds.json';

export async function GET() {
  try {
    const data = await fs.readFile(groundsFilePath, 'utf-8');
    const grounds = JSON.parse(data);
    return NextResponse.json(grounds);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const newGround = await req.json();
    const data = await fs.readFile(groundsFilePath, 'utf-8');
    const grounds = JSON.parse(data);
    grounds.push({ ...newGround, id: grounds.length + 1 });
    await fs.writeFile(groundsFilePath, JSON.stringify(grounds, null, 2));
    return NextResponse.json({ message: 'Ground added successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Error adding ground' }, { status: 500 });
  }
}
