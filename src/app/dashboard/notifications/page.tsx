import { requirePage } from "@/lib/auth/guard";
import { NotificationList } from "@/components/NotificationList";

export default async function PatientNotifications() {
  const user = await requirePage(["PATIENT"]);
  return <NotificationList userId={user.id} />;
}
