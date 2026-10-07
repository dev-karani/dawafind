"use client";

import { useRouter } from "next/navigation";
import { api } from "./api";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      onClick={async () => {
        await api("/api/auth/logout", "POST");
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
