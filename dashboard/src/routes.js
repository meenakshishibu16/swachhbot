export function resolveRoute(pathname = window.location.pathname) {
  if (pathname === '/' || pathname === '/landing') {
    return '/landing'
  }

  if (pathname === '/dashboard') {
    return '/dashboard'
  }

  return '/landing'
}
