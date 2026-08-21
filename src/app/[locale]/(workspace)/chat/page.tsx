/**
 * Clinic chat is hosted by the workspace keep-alive layer (KAZI-588) so
 * Space→Clinic does not remount the thread. This route only keeps /chat
 * in the App Router.
 */
export default function ChatPage() {
  return null;
}
