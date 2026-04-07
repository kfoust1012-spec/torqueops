import { headers } from "next/headers";
import type { Metadata } from "next";

import { StatusBadge } from "../../../components/ui";
import {
  formatCustomerDocumentDateRange,
  formatCustomerDocumentDateTime
} from "../../../lib/customer-documents/formatting";
import { resolveCustomerDocumentAccess } from "../../../lib/customer-documents/service";
import { getRequestIpAddress } from "../../../lib/customer-documents/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  },
  title: "Meet Your Mechanic"
};

type CustomerVisitPageProps = {
  params: Promise<{
    token: string;
  }>;
};

function getVisitStatusCopy(status: string) {
  switch (status) {
    case "scheduled":
      return "Your visit is scheduled. Review the appointment window and mechanic details before the service date.";
    case "dispatched":
    case "en_route":
      return "Your mechanic has been dispatched. Keep this page handy for arrival and contact context.";
    case "arrived":
    case "diagnosing":
    case "waiting_approval":
    case "waiting_parts":
    case "repairing":
    case "ready_for_payment":
    case "in_progress":
      return "Your mechanic is actively on the visit. This page confirms who is assigned and the service location.";
    default:
      return "Review the visit timing, location, and assigned mechanic details below.";
  }
}

function getVisitTrustCopy(status: string) {
  switch (status) {
    case "scheduled":
      return "Use this page to confirm the scheduled window, service location, and assigned mechanic before the visit begins.";
    case "dispatched":
    case "en_route":
      return "Keep this page handy while the mechanic is on the way. If the shop changes the technician or appointment window, they should send an updated message.";
    case "arrived":
    case "diagnosing":
    case "waiting_approval":
    case "waiting_parts":
    case "repairing":
    case "ready_for_payment":
    case "in_progress":
      return "This page confirms the mechanic identity and visit details while service is underway.";
    default:
      return "Review the service timing, location, and mechanic details below.";
  }
}

function getVisitSupportCopy(companyName: string) {
  return `If the technician, arrival window, or address changes, rely on the most recent message from ${companyName}. This page reflects the visit details tied to this specific link.`;
}

export default async function CustomerVisitPage({ params }: CustomerVisitPageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const resolved = await resolveCustomerDocumentAccess(
    { token },
    {
      markViewed: true,
      ipAddress: getRequestIpAddress(headerStore),
      userAgent: headerStore.get("user-agent")
    }
  );

  if (resolved.unavailable || !resolved.visit) {
    return (
      <main className="page-shell">
        <section className="panel customer-document-panel">
          <p className="eyebrow">Meet Your Mechanic</p>
          <h1 className="title">Link unavailable</h1>
          <p className="copy">
            {resolved.unavailable?.message ?? "This visit link is unavailable."} It may have expired or been replaced with a newer appointment update. Use the latest message from the shop if you expected updated visit details.
          </p>
        </section>
      </main>
    );
  }

  const visit = resolved.visit;
  const link = resolved.link;
  const companyTimeZone = visit.companyTimeZone;

  return (
    <main className="customer-document-shell">
      <section className="customer-document-panel">
        <div className="customer-document-header">
          <div>
            <p className="eyebrow">Meet Your Mechanic</p>
            <h1 className="title">{visit.jobTitle}</h1>
            <p className="copy" style={{ marginBottom: 0 }}>
              {visit.companyName} is preparing for your visit with {visit.vehicleLabel}.
            </p>
          </div>

          <StatusBadge status={visit.jobStatus} />
        </div>

        <div className="workspace-card">
          <p className="detail-value" style={{ margin: 0 }}>
            {getVisitStatusCopy(visit.jobStatus)}
          </p>
        </div>

        <div className="workspace-card">
          <p className="eyebrow">What this page confirms</p>
          <h2 className="section-title">Visit details from the shop</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            {getVisitTrustCopy(visit.jobStatus)}
          </p>
        </div>

        <div className="workspace-card">
          <p className="eyebrow">Need help?</p>
          <h2 className="section-title">Use the latest appointment update if anything changed</h2>
          <p className="copy" style={{ marginBottom: 0 }}>
            {getVisitSupportCopy(visit.companyName)}
          </p>
        </div>

        <div className="customer-document-grid">
          <div className="workspace-card">
            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Customer</p>
                <p className="detail-value">{visit.customerName}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Vehicle</p>
                <p className="detail-value">{visit.vehicleLabel}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Scheduled start</p>
                <p className="detail-value">{formatCustomerDocumentDateTime(visit.scheduledStartAt, companyTimeZone)}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Scheduled end</p>
                <p className="detail-value">{formatCustomerDocumentDateTime(visit.scheduledEndAt, companyTimeZone)}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Arrival window</p>
                <p className="detail-value">
                  {formatCustomerDocumentDateRange(
                    visit.arrivalWindowStartAt,
                    visit.arrivalWindowEndAt,
                    companyTimeZone
                  )}
                </p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Link expires</p>
                <p className="detail-value">
                  {link ? formatCustomerDocumentDateTime(link.expiresAt, companyTimeZone, "Unavailable") : "Unavailable"}
                </p>
              </div>
            </div>

            <div className="detail-item">
              <p className="detail-label">Service location</p>
              <p className="detail-value">{visit.serviceAddress ?? "Address will be confirmed by the shop."}</p>
            </div>
          </div>

          <div className="workspace-card" style={{ display: "grid", gap: 18 }}>
            <div>
              <p className="detail-label">Assigned mechanic</p>
              <p className="section-title" style={{ marginTop: 6 }}>
                {visit.technician?.fullName ?? visit.technicianName ?? "Technician details coming soon"}
              </p>
            </div>

            {visit.technician?.photoUrl ? (
              <img
                alt={`Photo of ${visit.technician.fullName}`}
                src={visit.technician.photoUrl}
                style={{
                  width: "100%",
                  maxWidth: 360,
                  aspectRatio: "4 / 3",
                  objectFit: "cover",
                  borderRadius: 20,
                  border: "1px solid rgba(17, 24, 39, 0.08)"
                }}
              />
            ) : null}

            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">Experience</p>
                <p className="detail-value">
                  {visit.technician?.yearsExperience !== null && visit.technician?.yearsExperience !== undefined
                    ? `${visit.technician.yearsExperience} year${visit.technician.yearsExperience === 1 ? "" : "s"}`
                    : "Not shared"}
                </p>
              </div>
              <div className="detail-item">
                <p className="detail-label">Certifications</p>
                <p className="detail-value">
                  {visit.technician?.certifications.length
                    ? visit.technician.certifications.join(", ")
                    : "Not shared"}
                </p>
              </div>
            </div>

            <div className="detail-item">
              <p className="detail-label">About your mechanic</p>
              <p className="detail-value">
                {visit.technician?.bio ?? "Your shop has not added a mechanic introduction yet, but your assigned technician is already on this visit."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
