import { calendar, type calendar_v3 } from "@googleapis/calendar";
import type { ToolContext } from "eve/tools";
import { withGoogleAuth } from "./client";

export async function listCalendarEvents(
  ctx: ToolContext,
  input: {
    calendarId: string;
    maxResults: number;
    timeMax: string;
    timeMin: string;
  }
) {
  return withCalendar(ctx, async (client) => {
    const { data } = await client.events.list(
      {
        calendarId: input.calendarId,
        fields:
          "items(id,status,summary,description,location,start,end,attendees(email,responseStatus),htmlLink)",
        maxResults: input.maxResults,
        orderBy: "startTime",
        singleEvents: true,
        timeMax: input.timeMax,
        timeMin: input.timeMin,
      },
      { signal: ctx.abortSignal }
    );
    return { events: data.items ?? [] };
  });
}

export async function checkCalendarAvailability(
  ctx: ToolContext,
  input: {
    calendars: string[];
    timeMax: string;
    timeMin: string;
    timezone: string;
  }
) {
  return withCalendar(ctx, async (client) => {
    const { data } = await client.freebusy.query(
      {
        requestBody: {
          items: input.calendars.map((id) => ({ id })),
          timeMax: input.timeMax,
          timeMin: input.timeMin,
          timeZone: input.timezone,
        },
      },
      { signal: ctx.abortSignal }
    );
    return parseCalendarAvailability(data);
  });
}

export function parseCalendarAvailability(
  value: calendar_v3.Schema$FreeBusyResponse
) {
  const failures = Object.entries(value.calendars ?? {}).flatMap(
    ([calendarId, calendarResult]) =>
      (calendarResult.errors ?? []).map(
        (error) => `${calendarId}: ${error.reason ?? error.domain ?? "unknown"}`
      )
  );
  if (failures.length > 0) {
    throw new Error(
      `Google Calendar could not read availability for ${failures.join(", ")}.`
    );
  }
  return value;
}

function withCalendar<T>(
  ctx: ToolContext,
  execute: (client: ReturnType<typeof calendar>) => Promise<T>
) {
  return withGoogleAuth(ctx, (auth) =>
    execute(calendar({ auth, version: "v3" }))
  );
}
