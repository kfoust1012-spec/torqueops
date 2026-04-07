import type { TimestampFields, UUID } from "./common";

export const customerAddressLabels = ["service", "billing", "home", "work", "other"] as const;
export const customerRelationshipTypes = ["retail_customer", "fleet_account"] as const;

export type CustomerAddressLabel = (typeof customerAddressLabels)[number];
export type CustomerRelationshipType = (typeof customerRelationshipTypes)[number];

export interface Customer extends TimestampFields {
  id: UUID;
  companyId: UUID;
  relationshipType: CustomerRelationshipType;
  companyName: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface CustomerListItem {
  id: UUID;
  companyId: UUID;
  relationshipType: CustomerRelationshipType;
  companyName: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface CustomerAddress extends TimestampFields {
  id: UUID;
  customerId: UUID;
  companyId: UUID;
  label: CustomerAddressLabel;
  siteName: string | null;
  serviceContactName: string | null;
  serviceContactPhone: string | null;
  accessWindowNotes: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gateCode: string | null;
  parkingNotes: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface CustomerWithAddresses extends Customer {
  addresses: CustomerAddress[];
}

export interface CreateCustomerInput {
  companyId: UUID;
  relationshipType?: CustomerRelationshipType;
  companyName?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface UpdateCustomerInput {
  relationshipType?: CustomerRelationshipType;
  companyName?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface CreateCustomerAddressInput {
  customerId: UUID;
  companyId: UUID;
  label?: CustomerAddressLabel;
  siteName?: string | null;
  serviceContactName?: string | null;
  serviceContactPhone?: string | null;
  accessWindowNotes?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  gateCode?: string | null;
  parkingNotes?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateCustomerAddressInput {
  label?: CustomerAddressLabel;
  siteName?: string | null;
  serviceContactName?: string | null;
  serviceContactPhone?: string | null;
  accessWindowNotes?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  gateCode?: string | null;
  parkingNotes?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface CustomerListQuery {
  query?: string;
  includeInactive?: boolean;
}
