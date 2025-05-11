// src/app/api/test-env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    apiKeyExists: !!process.env.OPENAI_API_KEY,
    apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    firstFiveChars: process.env.OPENAI_API_KEY ?
      process.env.OPENAI_API_KEY.substring(0, 5) + '...' : 'none'
  });
}