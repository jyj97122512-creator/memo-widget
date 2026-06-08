import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasEnvToken: !!(process.env.NOTION_API_TOKEN),
  });
}
