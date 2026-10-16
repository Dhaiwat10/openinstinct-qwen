import { describe, expect, it } from "vitest";
import { parseCalendarAvailability } from "@agent/lib/google-workspace/calendar";
import { googleWorkspaceAuthOptions } from "@agent/lib/google-workspace/client";
import {
  googleWorkspaceScopes,
  googleWorkspaceSubject,
  googleWorkspaceTokenParams,
} from "@shared/google-workspace/connection";

const userId = "better-auth:user-123";

describe("Google Workspace", () => {
  it("requests only read access to Google data", () => {
    expect(googleWorkspaceScopes).toEqual([
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.freebusy",
      "https://www.googleapis.com/auth/contacts.readonly",
    ]);
    expect(googleWorkspaceTokenParams(userId)).toEqual({
      scopes: [...googleWorkspaceScopes],
      subject: googleWorkspaceSubject(userId),
    });
    expect(googleWorkspaceAuthOptions.tokenParams).toEqual({
      scopes: [...googleWorkspaceScopes],
    });
    expect(googleWorkspaceAuthOptions.validate).toBe(true);
  });

  it("uses a user-scoped connector subject", () => {
    expect(googleWorkspaceSubject(userId)).toEqual({
      id: userId,
      issuer: "openinstinct",
      type: "user",
    });
  });

  it("does not treat calendar API errors as availability", () => {
    expect(() =>
      parseCalendarAvailability({
        calendars: {
          "missing@example.com": {
            errors: [{ domain: "global", reason: "notFound" }],
          },
        },
      })
    ).toThrow(/missing@example\.com: notFound/u);
  });
});
