import { prisma } from "@/app/lib/prisma";

const DEFAULT_HANDOFF_NUMBER = "+441234567890";

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function getHandoffNumber(): Promise<string> {
  const number = await getSetting("human_handoff_number");
  return number ?? DEFAULT_HANDOFF_NUMBER;
}
