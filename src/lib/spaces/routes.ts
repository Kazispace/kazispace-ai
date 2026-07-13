/** `/spaces` with no spaceId — not a valid workspace route (ADR-006). */
export function isSpacesIndexPath(path: string): boolean {
  return path === '/spaces';
}
