import { useConversations } from "./useConversations";

export const useUnreadCount = () => {
  const { items } = useConversations();
  return items.reduce((sum, c) => sum + c.unread, 0);
};
