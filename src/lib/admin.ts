// The single Google account allowed to manage the admin panel. Shared between
// the Admin page (access gate) and the Navbar (shows the "Admin" shortcut).
export const ADMIN_EMAIL = 'siramrhadid@gmail.com'

/** Case-insensitive check that an email belongs to the admin account. */
export function isAdminEmail(email?: string | null): boolean {
  return (email?.toLowerCase() ?? null) === ADMIN_EMAIL
}
