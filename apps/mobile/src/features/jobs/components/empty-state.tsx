import { EmptyState as FoundationEmptyState } from "../../../components/ui";

type EmptyStateProps = {
  body: string;
  title: string;
};

export function EmptyState({ body, title }: EmptyStateProps) {
  return <FoundationEmptyState body={body} eyebrow="Technician view" title={title} />;
}
