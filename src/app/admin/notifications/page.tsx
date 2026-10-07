import { requirePage } from "@/lib/auth/guard";
import { NotificationList } from "@/components/NotificationList";

export default async function AdminNotifications() {
  const user = await requirePage(["PLATFORM_ADMIN"]);
  return <NotificationList userId={user.id} />;
}
