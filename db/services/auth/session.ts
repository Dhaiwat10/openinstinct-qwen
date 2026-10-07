import { z } from "zod";
import { getAuth } from "@db/services/auth";
import { isPhoneNumberAllowed } from "@shared/identity/phone-allowlist";

const authenticatedSessionSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        phoneNumber: z.string().min(1),
        phoneNumberVerified: z.literal(true),
      })
      .loose(),
  })
  .loose();

export async function getAuthSession(headers: Headers) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers });
  const parsed = authenticatedSessionSchema.safeParse(session);
  if (!parsed.success) return null;
  // Sessions created before a number left the allowlist stop working too.
  return isPhoneNumberAllowed(parsed.data.user.phoneNumber)
    ? parsed.data
    : null;
}
