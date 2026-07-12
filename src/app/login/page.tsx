import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/admin-login";

export const metadata: Metadata = {
  title: "Admin Login | Kasa Kai",
  description: "Secure login for the Kasa Kai administration team",
};

export default function LoginPage() {
  return <AdminLogin />;
}
