import { redirect } from "next/navigation";

export default function NewCustomerPage() {
  redirect("/dashboard/customers?mode=database&newCustomer=1");
}
