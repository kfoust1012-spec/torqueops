import { CustomersWorkspaceShell } from "./_components/customers-workspace-shell";

type CustomersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function CustomersPage({ searchParams }: CustomersPageProps) {
  return <CustomersWorkspaceShell searchParams={searchParams} />;
}
