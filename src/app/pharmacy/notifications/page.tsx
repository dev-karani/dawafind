import { requirePharmacyPage } from "@/lib/auth/guard";
import { NotificationList } from "@/components/NotificationList";

export default async function PharmacyNotifications() {
  const ctx = await requirePharmacyPage();
  return <NotificationList userId={ctx.user.id} />;
}
