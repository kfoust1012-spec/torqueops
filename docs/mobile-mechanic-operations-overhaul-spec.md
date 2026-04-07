# Mobile Mechanic Operations Overhaul Spec

This document adapts the broader UI overhaul plan to the actual product surface area in the current codebase.

## Product stance

The application should read as a premium mobile-service operations cockpit:

- dispatch-first
- workflow-first
- estimate speed first
- customer and vehicle context always nearby
- fleet and technician movement treated as primary, not secondary

This product is not static repair-shop software. The interface should optimize for work moving through the field.

## Current route mapping

The current top-level route model after the first overhaul pass is:

- `/dashboard` for the daily operating brief
- `/dashboard/dispatch` for live technician scheduling and route control
- `/dashboard/jobs` for workflow and triage
- `/dashboard/estimates` for estimate production and approvals
- `/dashboard/invoices` for billing follow-through
- `/dashboard/customers` for relationship workspaces
- `/dashboard/customer-vehicles` for customer-owned vehicle records
- `/dashboard/fleet` for map-first fleet control
- `/dashboard/fleet-vehicles` for company unit and van readiness
- `/dashboard/team` for technician workload and field context
- `/dashboard/reports` for operational reporting
- `/dashboard/settings` for grouped operational configuration

## Separation rules

The UI must keep these two systems visibly separate:

### Customer vehicles

Customer-owned service assets.

Must emphasize:

- owner relationship
- VIN and vehicle identity
- mileage
- active concerns
- service history
- estimate and invoice context
- photos, notes, and recommendations

### Fleet vehicles

Company-controlled units, vans, and field assets.

Must emphasize:

- assigned technician
- live status
- route readiness
- current and next stop
- maintenance and downtime risk
- van stock or operational support context

These should never collapse into one generic “vehicles” module.

## Screen intent

### Dashboard

Should answer:

- what is happening today
- what is urgent
- who is free
- what is delayed
- what is waiting approval
- what money is waiting

### Dispatch

Hero module for:

- scheduling
- live route control
- reassignment
- workload balancing

### Jobs

Primary workflow queue for intake, assignment, and release into dispatch.

### Estimates

Focused production workspace for drafting, revising, and sending approval-ready work.

### Customers

Relationship workspace where customer context, vehicle context, history, and communications stay together.

### Customer Vehicles

Dedicated registry and profile entry surface for customer-owned vehicles.

### Fleet

Map-first field-operations command center.

### Fleet Vehicles

Dedicated operational view of company units, vans, and route readiness.

### Team

Technician workspace centered on live status, route, capacity, and assigned work.

## Working rule

When a future redesign decision is ambiguous, prefer the option that:

1. keeps dispatch and field movement visible
2. reduces page hopping
3. keeps customer and vehicle context nearby
4. separates customer assets from company assets
5. makes the next operational action obvious
