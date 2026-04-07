import { formatDateTime } from "@mobile-mechanic/core";
import type { CustomerCommunicationLogEntry } from "@mobile-mechanic/types";

import {
  Badge,
  Card,
  CardHeader,
  CardHeaderContent,
  CardEyebrow,
  CardTitle,
  Cell,
  EmptyState,
  HeaderCell,
  StatusBadge,
  Table,
  TableWrap
} from "../../../components/ui";

type CommunicationLogPanelProps = {
  title: string;
  eyebrow?: string;
  entries: CustomerCommunicationLogEntry[];
  emptyMessage: string;
  timeZone: string;
};

function formatChannel(value: CustomerCommunicationLogEntry["channel"]): string {
  return value.toUpperCase();
}

function formatType(value: CustomerCommunicationLogEntry["communicationType"]): string {
  return value.replaceAll("_", " ");
}

export function CommunicationLogPanel({
  title,
  eyebrow,
  entries,
  emptyMessage,
  timeZone
}: CommunicationLogPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardHeaderContent>
          {eyebrow ? <CardEyebrow>{eyebrow}</CardEyebrow> : null}
          <CardTitle>{title}</CardTitle>
        </CardHeaderContent>
        <Badge tone="brand">{entries.length}</Badge>
      </CardHeader>

      {entries.length ? (
        <TableWrap className="ui-table-wrap--flat">
          <Table>
            <thead>
              <tr>
                <HeaderCell>When</HeaderCell>
                <HeaderCell>Type</HeaderCell>
                <HeaderCell>Channel</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Recipient</HeaderCell>
                <HeaderCell>Message</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Cell>{formatDateTime(entry.createdAt, { timeZone })}</Cell>
                  <Cell>{formatType(entry.communicationType)}</Cell>
                  <Cell>
                    <Badge tone="brand">{formatChannel(entry.channel)}</Badge>
                  </Cell>
                  <Cell>
                    <StatusBadge status={entry.status} />
                  </Cell>
                  <Cell>
                    <div>{entry.recipientName}</div>
                    <div className="ui-inline-copy">
                      {entry.recipientEmail ?? entry.recipientPhone ?? "Unknown destination"}
                    </div>
                  </Cell>
                  <Cell>
                    <div>{entry.subject ?? "No subject"}</div>
                    {entry.errorMessage ? <p className="ui-field__error">{entry.errorMessage}</p> : null}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState
          description={emptyMessage}
          eyebrow={eyebrow}
          title="No communication history"
        />
      )}
    </Card>
  );
}
