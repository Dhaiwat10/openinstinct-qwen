import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

describe("phone allowlist", () => {
  it("admits only listed numbers when ALLOWED_PHONE_NUMBERS is set", async () => {
    vi.stubEnv("ALLOWED_PHONE_NUMBERS", "+919999900001");
    const { isPhoneNumberAllowed } =
      await import("@shared/identity/phone-allowlist");

    expect(isPhoneNumberAllowed("+919999900001")).toBe(true);
    expect(isPhoneNumberAllowed("+12025550123")).toBe(false);
  });

  it("keeps sign-up open when ALLOWED_PHONE_NUMBERS is unset", async () => {
    vi.stubEnv("ALLOWED_PHONE_NUMBERS", "");
    const { isPhoneNumberAllowed } =
      await import("@shared/identity/phone-allowlist");

    expect(isPhoneNumberAllowed("+12025550123")).toBe(true);
  });
});
