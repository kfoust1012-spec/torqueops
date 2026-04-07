import type { Customer, CustomerRelationshipType } from "@mobile-mechanic/types";

type CustomerDisplayInput = {
  companyName?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  relationshipType?: CustomerRelationshipType | null | undefined;
};

export function getCustomerDisplayName(customer: CustomerDisplayInput): string {
  if (customer.relationshipType === "fleet_account" && customer.companyName?.trim()) {
    return customer.companyName.trim();
  }

  const personalName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();

  if (personalName) {
    return personalName;
  }

  return customer.companyName?.trim() || "Unknown customer";
}
