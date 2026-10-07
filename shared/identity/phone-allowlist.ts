import { env } from "@shared/environment";

// Deployments without ALLOWED_PHONE_NUMBERS keep upstream's open sign-up.
export function isPhoneNumberAllowed(phoneNumber: string) {
  return env.ALLOWED_PHONE_NUMBERS?.includes(phoneNumber) ?? true;
}
