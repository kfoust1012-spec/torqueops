import { expect, test } from "@playwright/test";

import {
  chooseCommandResult,
  getSingleSupabaseRow,
  listSupabaseRows,
  loginOffice,
  openCommandPalette,
  patchSupabaseRows,
  webBaseUrl
} from "./helpers";

type CommunicationEventRow = {
  communication_type: string;
  created_at: string;
  event_type: string;
  id: string;
  job_id: string | null;
  payload: Record<string, unknown> | null;
  trigger_source: string;
};

type CustomerCommunicationRow = {
  channel: string;
  communication_type: string;
  created_at: string;
  event_id: string | null;
  id: string;
  job_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: string;
};

type HotThreadJobRow = {
  arrival_window_start_at: string | null;
  assigned_technician_user_id: string | null;
  id: string;
  scheduled_start_at: string | null;
  status: string;
  title: string;
};

test.describe("office command center", () => {
  test("pins an active hot thread and carries it across desks", async ({ page }) => {
    await loginOffice(page);

    const commandInput = await openCommandPalette(page);
    await commandInput.fill("Front brake");
    await chooseCommandResult(page, /Front brake inspection and estimate/i);

    await expect(page).toHaveURL(/\/dashboard\/visits\?jobId=/);
    await expect(page.getByRole("button", { name: "Pin case file" })).toBeVisible();
    await page.getByRole("button", { name: "Pin case file" }).click();
    await expect(page.getByRole("button", { name: "Unpin case file" })).toBeVisible();

    await page.goto(`${webBaseUrl}/dashboard/fleet`);

    await expect(
      page
        .locator(".ui-admin-hot-thread__title")
        .filter({ hasText: "Front brake inspection and estimate" })
    ).toBeVisible();
  });

  test("switches dispatch surfaces and opens customer sites from command search", async ({
    page
  }) => {
    await loginOffice(page);
    await page.goto(`${webBaseUrl}/dashboard/dispatch`);

    const surfaceTabs = page.getByRole("region", { name: "Dispatch surface modes" });
    if (!(await surfaceTabs.isVisible().catch(() => false))) {
      const queueToggle = page.getByRole("button", { name: /Hide queue|Show queue/i });
      await expect(queueToggle).toBeVisible();
      await queueToggle.click();
    }
    if (!(await surfaceTabs.isVisible().catch(() => false))) {
      const surfaceUtility = page.getByText(/Surface mode/i).first();
      if (await surfaceUtility.isVisible().catch(() => false)) {
        await surfaceUtility.click();
      }
    }
    const releaseTab = surfaceTabs.getByRole("button", { name: /Release runway/i });
    if (await releaseTab.isVisible().catch(() => false)) {
      await releaseTab.click();
      await expect(page.getByText("Place approved visits onto live lanes")).toBeVisible();
    }

    const recoveryTab = surfaceTabs.getByRole("button", { name: /Recovery/i });
    if (await recoveryTab.isVisible().catch(() => false)) {
      await recoveryTab.click();
      await expect(page.getByText("Rescue lanes and place ready work from Dispatch")).toBeVisible();
    }

    await surfaceTabs.getByRole("button", { name: /Board/i }).click();
    await expect(page.getByText("Rescue lanes and place ready work from Dispatch")).not.toBeVisible();

    const followThroughTab = surfaceTabs.getByRole("button", { name: /Follow-through/i });
    if (await followThroughTab.isVisible().catch(() => false)) {
      await followThroughTab.click();
      await expect(page.getByRole("heading", { name: "Intervention dock" })).toBeVisible();
    }

    const commandInput = await openCommandPalette(page);
    await commandInput.fill("123 Service Lane");
    await chooseCommandResult(page, "123 Service Lane");

    await expect(page).toHaveURL(/\/dashboard\/customers\?customerId=.*tab=addresses/);
    await expect(page.getByRole("link", { name: "Sites", exact: true })).toBeVisible();
    await expect(page.getByText("Run recurring sites like operational assets")).toBeVisible();
  });

  test("sends a dispatch update from the hot thread", async ({ page }) => {
    await loginOffice(page);

    const hotThreadVisit = await getSingleSupabaseRow<HotThreadJobRow>("jobs", {
      label: "no-start dispatched visit",
      filters: {
        title: "eq.No-start battery and charging diagnosis"
      },
      select: "id,title,status,assigned_technician_user_id,scheduled_start_at,arrival_window_start_at"
    });
    const overdueScheduledStartAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const overdueScheduledEndAt = new Date(Date.now() + 75 * 60_000).toISOString();
    const overdueArrivalWindowStartAt = new Date(Date.now() - 60 * 60_000).toISOString();
    const overdueArrivalWindowEndAt = new Date(Date.now() - 15 * 60_000).toISOString();

    await patchSupabaseRows<HotThreadJobRow>("jobs", {
      filters: {
        id: `eq.${hotThreadVisit.id}`
      },
      payload: {
        arrival_window_end_at: overdueArrivalWindowEndAt,
        arrival_window_start_at: overdueArrivalWindowStartAt,
        assigned_technician_user_id: hotThreadVisit.assigned_technician_user_id,
        scheduled_end_at: overdueScheduledEndAt,
        scheduled_start_at: overdueScheduledStartAt,
        status: "dispatched"
      }
    });

    const jobId = hotThreadVisit.id;
    await page.goto(`${webBaseUrl}/dashboard/visits?jobId=${jobId}`);

    const initialDispatchEvents = await listSupabaseRows<CommunicationEventRow>(
      "communication_events",
      {
        filters: {
          event_type: "eq.dispatch_update_requested",
          job_id: `eq.${jobId}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );
    const initialDispatchCommunications = await listSupabaseRows<CustomerCommunicationRow>(
      "customer_communications",
      {
        filters: {
          communication_type: "eq.dispatch_update",
          job_id: `eq.${jobId}`
        },
        order: "created_at.desc",
        select: "id,created_at"
      }
    );

    const dispatchUpdateButton = page.getByRole("button", { name: "Send en-route update" });
    await expect(dispatchUpdateButton).toBeVisible();
    const dispatchUpdateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/communications") &&
        response.request().postData()?.includes('"action":"dispatch_update"') === true &&
        response.request().postData()?.includes('"updateType":"en_route"') === true
    );

    await dispatchUpdateButton.click();
    const dispatchUpdateResult = await dispatchUpdateResponse;
    expect(dispatchUpdateResult.ok()).toBe(true);

    await expect(page.getByText("En-route update queued from the hot thread.")).toBeVisible();
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CommunicationEventRow>("communication_events", {
          filters: {
            event_type: "eq.dispatch_update_requested",
            job_id: `eq.${jobId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialDispatchEvents.length);
    await expect
      .poll(async () => {
        const rows = await listSupabaseRows<CustomerCommunicationRow>("customer_communications", {
          filters: {
            communication_type: "eq.dispatch_update",
            job_id: `eq.${jobId}`
          },
          select: "id"
        });

        return rows.length;
      })
      .toBeGreaterThan(initialDispatchCommunications.length);

    const latestDispatchEvent = await getSingleSupabaseRow<CommunicationEventRow>(
      "communication_events",
      {
        label: `latest hot-thread dispatch update for ${jobId}`,
        filters: {
          event_type: "eq.dispatch_update_requested",
          job_id: `eq.${jobId}`
        },
        limit: 1,
        order: "created_at.desc",
        select: "id,created_at,job_id,event_type,communication_type,trigger_source,payload"
      }
    );
    const latestDispatchCommunication =
      await getSingleSupabaseRow<CustomerCommunicationRow>("customer_communications", {
        label: `latest hot-thread dispatch communication for ${jobId}`,
        filters: {
          event_id: `eq.${latestDispatchEvent.id}`
        },
        select:
          "id,event_id,job_id,communication_type,channel,status,recipient_email,recipient_phone,created_at"
      });

    expect(Date.parse(latestDispatchEvent.created_at)).toBeGreaterThan(
      initialDispatchEvents[0]?.created_at ? Date.parse(initialDispatchEvents[0].created_at) : 0
    );
    expect(latestDispatchEvent.job_id).toBe(jobId);
    expect(latestDispatchEvent.event_type).toBe("dispatch_update_requested");
    expect(latestDispatchEvent.communication_type).toBe("dispatch_update");
    expect(latestDispatchEvent.trigger_source).toBe("manual");
    expect(latestDispatchEvent.payload).toMatchObject({
      updateType: "en_route"
    });

    expect(latestDispatchCommunication.event_id).toBe(latestDispatchEvent.id);
    expect(latestDispatchCommunication.job_id).toBe(jobId);
    expect(latestDispatchCommunication.communication_type).toBe("dispatch_update");
    expect(["email", "sms"]).toContain(latestDispatchCommunication.channel);
    expect(["queued", "processing", "sent", "delivered", "failed"]).toContain(
      latestDispatchCommunication.status
    );
    expect(
      latestDispatchCommunication.recipient_email ||
        latestDispatchCommunication.recipient_phone
    ).toBeTruthy();
  });
});
