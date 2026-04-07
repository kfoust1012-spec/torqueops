import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  EmptyState,
  Form,
  FormField,
  Input,
  Page,
  PageHeader,
  StatusBadge,
  Textarea,
  buttonClassName
} from "../../../../components/ui";
import { requireCompanyContext } from "../../../../lib/company-context";
import {
  deleteSupplyList,
  getSupplyListsWorkspace,
  saveSupplyList
} from "../../../../lib/procurement/supplies/service";
import { buildDashboardAliasHref } from "../../../../lib/dashboard/route-alias";

type SupplyListsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value ? value : null;
}

function revalidateSupplyListsPaths() {
  revalidatePath("/dashboard/supply/supplies");
  revalidatePath("/dashboard/parts/supplies");
}

export default async function SupplyListsPage({ searchParams }: SupplyListsPageProps) {
  redirect(buildDashboardAliasHref("/dashboard/supply/supplies", (searchParams ? await searchParams : {})));
}

export async function SupplyListsPageImpl() {
  const context = await requireCompanyContext({ requireOfficeAccess: true });
  const workspace = await getSupplyListsWorkspace(context.supabase, context.companyId);

  async function createSupplyListAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    const supplyList = await saveSupplyList(actionContext.supabase, {
      companyId: actionContext.companyId,
      createdByUserId: actionContext.currentUserId,
      description: getNullableString(formData, "description"),
      name: getString(formData, "name")
    });

    revalidateSupplyListsPaths();
    redirect(`/dashboard/supply/supplies/${supplyList.id}`);
  }

  async function deleteSupplyListAction(formData: FormData) {
    "use server";

    const actionContext = await requireCompanyContext({ requireOfficeAccess: true });
    await deleteSupplyList(actionContext.supabase, getString(formData, "supplyListId"));

    revalidateSupplyListsPaths();
    redirect("/dashboard/supply/supplies");
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Parts"
        title="Supply lists"
        description="Create reusable supply kits for oils, shop rags, and other repeatable consumables that should flow through the existing supply desk."
        actions={
          <>
            <Link className={buttonClassName({ tone: "secondary" })} href="/dashboard/supply">
              Back to supply desk
            </Link>
            <Link
              className={buttonClassName({ tone: "tertiary" })}
              href="/dashboard/supply/integrations/amazon-business"
            >
              Amazon Business settings
            </Link>
          </>
        }
      />

      <div className="ui-page-grid ui-page-grid--sidebar">
        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Create</CardEyebrow>
              <CardTitle>New supply list</CardTitle>
              <CardDescription>
                Keep recurring consumables in one reusable list, then apply them to a visit-linked
                parts request before starting Amazon Business sourcing.
              </CardDescription>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            <Form action={createSupplyListAction}>
              <FormField label="Name" required>
                <Input name="name" required />
              </FormField>
              <FormField label="Description">
                <Textarea name="description" rows={4} />
              </FormField>
              <Button type="submit">Create supply list</Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeaderContent>
              <CardEyebrow>Lists</CardEyebrow>
              <CardTitle>Reusable supply kits</CardTitle>
            </CardHeaderContent>
          </CardHeader>
          <CardContent>
            {workspace.lists.length ? (
              <div className="ui-list">
                {workspace.lists.map((list) => (
                  <article key={list.id} className="ui-list-item">
                    <div>
                      <p className="ui-card__eyebrow">{list.name}</p>
                      <h3 className="ui-card__title" style={{ fontSize: "1rem" }}>
                        {list.description ?? "No description"}
                      </h3>
                    </div>
                    <div className="ui-page-actions">
                      <StatusBadge status={list.isActive ? "active" : "archived"} />
                      <Link
                        className={buttonClassName({ size: "sm", tone: "secondary" })}
                        href={`/dashboard/supply/supplies/${list.id}`}
                      >
                        Open
                      </Link>
                      <Form action={deleteSupplyListAction}>
                        <input name="supplyListId" type="hidden" value={list.id} />
                        <Button size="sm" tone="danger" type="submit">
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                eyebrow="No supply lists"
                title="Create the first reusable kit"
                description="Start with repeatable consumables like oils, gloves, shop towels, or brake-clean kits."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
