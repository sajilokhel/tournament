import { redirect } from "next/navigation";

export default function ManagerRegisterPage() {
  redirect("/auth/login/manager");
}
