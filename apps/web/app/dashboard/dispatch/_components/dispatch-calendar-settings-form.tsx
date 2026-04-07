import type {
  AssignableTechnicianOption,
  DispatchResourcePreference
} from "@mobile-mechanic/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardHeaderContent,
  CardTitle,
  Form,
  FormField,
  Input,
  Select,
  SubmitButton,
  Textarea
} from "../../../../components/ui";

type DispatchCalendarSettingsFormProps = {
  resourcePreferences: DispatchResourcePreference[];
  saveResourcePreferenceAction: (formData: FormData) => Promise<void>;
  saveSettingsAction: (formData: FormData) => Promise<void>;
  settings: {
    dayEndHour: number;
    dayStartHour: number;
    defaultView: "day" | "week" | "month";
    showSaturday?: boolean;
    showSunday?: boolean;
    slotMinutes: 15 | 30 | 60;
    weekStartsOn: number;
  };
  technicians: AssignableTechnicianOption[];
};

function getPreference(
  resourcePreferences: DispatchResourcePreference[],
  technicianUserId: string
) {
  return (
    resourcePreferences.find((preference) => preference.technicianUserId === technicianUserId) ??
    null
  );
}

export function DispatchCalendarSettingsForm({
  resourcePreferences,
  saveResourcePreferenceAction,
  saveSettingsAction,
  settings,
  technicians
}: DispatchCalendarSettingsFormProps) {
  return (
    <div className="ui-section-stack">
      <Card tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Calendar settings</CardEyebrow>
            <CardTitle>Visible hours and default layout</CardTitle>
            <CardDescription>
              Tune the time grid, working day, and default calendar view for the dispatch team.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent>
          <Form action={saveSettingsAction}>
            <div className="ui-form-row">
              <FormField hint="0 = Sunday, 1 = Monday." label="Week starts on">
                <Select defaultValue={String(settings.weekStartsOn)} name="weekStartsOn">
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                </Select>
              </FormField>
              <FormField label="Default view">
                <Select defaultValue={settings.defaultView} name="defaultView">
                  <option value="day">Day view</option>
                  <option value="week">Week view</option>
                  <option value="month">Month view</option>
                </Select>
              </FormField>
            </div>

            <div className="ui-form-row">
              <FormField label="Day starts at">
                <Input
                  defaultValue={String(settings.dayStartHour)}
                  max={23}
                  min={0}
                  name="dayStartHour"
                  type="number"
                />
              </FormField>
              <FormField label="Day ends at">
                <Input
                  defaultValue={String(settings.dayEndHour)}
                  max={23}
                  min={1}
                  name="dayEndHour"
                  type="number"
                />
              </FormField>
            </div>

            <div className="ui-form-row">
              <FormField label="Slot size">
                <Select defaultValue={String(settings.slotMinutes)} name="slotMinutes">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                </Select>
              </FormField>
              <div className="ui-action-grid">
                <p className="ui-detail-label">Weekend display</p>
                <label className="ui-checkbox-row">
                  <input
                    defaultChecked={settings.showSaturday}
                    name="showSaturday"
                    type="checkbox"
                    value="1"
                  />
                  Show Saturday
                </label>
                <label className="ui-checkbox-row">
                  <input
                    defaultChecked={settings.showSunday}
                    name="showSunday"
                    type="checkbox"
                    value="1"
                  />
                  Show Sunday
                </label>
              </div>
            </div>

            <SubmitButton pendingLabel="Saving settings...">Save calendar settings</SubmitButton>
          </Form>
        </CardContent>
      </Card>

      <Card tone="raised">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Lane preferences</CardEyebrow>
            <CardTitle>Technician lane order and color</CardTitle>
            <CardDescription>
              Set the lane order and accent color used in the dispatch calendar for each worker.
            </CardDescription>
          </CardHeaderContent>
        </CardHeader>
        <CardContent className="ui-list">
          {technicians.map((technician, index) => {
            const preference = getPreference(resourcePreferences, technician.userId);

            return (
              <form action={saveResourcePreferenceAction} className="ui-list-item" key={technician.userId}>
                <input name="technicianUserId" type="hidden" value={technician.userId} />
                <div className="ui-list-item__header">
                  <div>
                    <h3 className="ui-list-item__title">{technician.displayName}</h3>
                    <p className="ui-list-item__copy">
                      {technician.role}
                      {technician.email ? ` · ${technician.email}` : ""}
                    </p>
                  </div>
                </div>

                <div className="ui-form-row">
                  <FormField label="Lane order">
                    <Input
                      defaultValue={String(preference?.laneOrder ?? index)}
                      name="laneOrder"
                      type="number"
                    />
                  </FormField>
                  <FormField hint="Hex or CSS color value." label="Lane accent">
                    <Input
                      defaultValue={preference?.laneColor ?? ""}
                      name="laneColor"
                      placeholder="#2f6df6"
                      type="text"
                    />
                  </FormField>
                </div>

                <div className="ui-toolbar">
                  <label className="ui-checkbox-row">
                    <input
                      defaultChecked={preference?.isVisibleByDefault ?? true}
                      name="isVisibleByDefault"
                      type="checkbox"
                      value="1"
                    />
                    Visible by default
                  </label>

                  <SubmitButton pendingLabel="Saving lane...">Save lane preference</SubmitButton>
                </div>
              </form>
            );
          })}
        </CardContent>
      </Card>

      <Card tone="subtle">
        <CardHeader>
          <CardHeaderContent>
            <CardEyebrow>Interaction notes</CardEyebrow>
            <CardTitle>How the calendar behaves</CardTitle>
          </CardHeaderContent>
        </CardHeader>
        <CardContent className="ui-detail-grid">
          <div className="ui-detail-item">
            <p className="ui-detail-label">Drag and drop</p>
            <p className="ui-detail-value">
              Visits snap to the configured slot size and adopt the new technician lane automatically.
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Conflict visibility</p>
            <p className="ui-detail-value">
              The live board flags overlaps against visits, availability blocks, and configured work hours.
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Saved views</p>
            <p className="ui-detail-value">
              Saved views keep worker subsets, default view mode, and whether the unassigned rail stays open.
            </p>
          </div>
          <div className="ui-detail-item">
            <p className="ui-detail-label">Quick edit</p>
            <p className="ui-detail-value">
              Clicking a visit opens the dispatch quick-edit panel so a dispatcher can adjust timing without leaving the screen.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
