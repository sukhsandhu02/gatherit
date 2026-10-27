const isProduction = process.env.NODE_ENV === 'production';

export function getAuthCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  };
}

export function getClearCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
  };
}
