import * as CalendarApi from "@googleapis/calendar";
import * as GmailApi from "@googleapis/gmail";
import * as PeopleApi from "@googleapis/people";
import type { ToolContext } from "eve/tools";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withGoogleAuth } from "@agent/lib/google-workspace/client";
import { searchGoogleContacts } from "@agent/lib/google-workspace/contacts";

interface RequestOptions {
  signal: AbortSignal;
}

const calendarMock = vi.spyOn(CalendarApi, "calendar");
const peopleMock = vi.spyOn(PeopleApi, "people");
const setCredentialsMock = vi.spyOn(
  GmailApi.auth.OAuth2.prototype,
  "setCredentials"
);

afterEach(() => vi.clearAllMocks());

describe("generated Google Workspace clients", () => {
  it("hands the Connect token to Google and requests reauthorization on 401", async () => {
    const ctx = toolContext();
    const error = new GoogleApiError(401);

    await expect(withGoogleAuth(ctx, () => Promise.reject(error))).rejects.toBe(
      error
    );

    expect(ctx.getToken).toHaveBeenCalledOnce();
    expect(setCredentialsMock).toHaveBeenCalledWith({
      access_token: "google-access-token",
    });
    expect(ctx.requireAuth).toHaveBeenCalledOnce();
  });

  it("warms the People search cache before the typed contact query", async () => {
    const ctx = toolContext();
    const client = PeopleApi.people({ version: "v1" });
    const searchContacts = vi
      .fn<
        (
          request: { pageSize?: number; query: string; readMask: string },
          options: RequestOptions
        ) => Promise<{
          data: { results?: { person: { resourceName: string } }[] };
        }>
      >()
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({
        data: { results: [{ person: { resourceName: "people/1" } }] },
      });
    Object.defineProperty(client.people, "searchContacts", {
      value: searchContacts,
    });
    googleClients({ people: client });

    await expect(searchGoogleContacts(ctx, "Person", 10)).resolves.toEqual({
      contacts: [{ person: { resourceName: "people/1" } }],
    });

    expect(searchContacts).toHaveBeenNthCalledWith(
      1,
      {
        query: "",
        readMask: "names,emailAddresses,phoneNumbers,organizations",
      },
      { signal: ctx.abortSignal }
    );
    expect(searchContacts).toHaveBeenNthCalledWith(
      2,
      {
        pageSize: 10,
        query: "Person",
        readMask: "names,emailAddresses,phoneNumbers,organizations",
      },
      { signal: ctx.abortSignal }
    );
  });
});

function toolContext() {
  const getToken = vi
    .fn<ToolContext["getToken"]>()
    .mockResolvedValue({ token: "google-access-token" });
  const requireAuth = vi.fn<ToolContext["requireAuth"]>();
  return {
    async getSandbox() {
      throw new Error("Sandbox access is outside this focused test.");
    },
    abortSignal: new AbortController().signal,
    callId: "call-1",
    getToken,
    requireAuth,
    session: {
      auth: { current: null, initiator: null },
      id: "session-1",
      turn: { id: "turn-1", sequence: 0 },
    },
    toolName: "google-workspace-test",
  } satisfies ToolContext;
}

function googleClients(clients: {
  calendar?: ReturnType<typeof CalendarApi.calendar>;
  people?: ReturnType<typeof PeopleApi.people>;
}) {
  if (clients.calendar) calendarMock.mockReturnValue(clients.calendar);
  if (clients.people) peopleMock.mockReturnValue(clients.people);
}

class GoogleApiError extends Error {
  readonly response: { status: number };

  constructor(status: number) {
    super(`Google API returned ${String(status)}`);
    this.response = { status };
  }
}
