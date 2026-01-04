import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || '';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/login') {
    const token = request.cookies.get('authToken')?.value;

    if (token) {
      try {

        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        if (payload.userId && payload.email) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch (error) {
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/login',
};

