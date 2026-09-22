import { z } from "zod";

const optionalText = (limit: number) => z.string().trim().max(limit).transform(value => value || null);

// Account information is separate from the broker's opt-in public profile.
export const accountProfileSchema = z.object({
  display_name: optionalText(100),
  organization_name: optionalText(160),
  job_title: optionalText(120),
  phone: optionalText(50),
});
