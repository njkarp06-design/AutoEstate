import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const turnStartedSchema = z.object({
  event: z.literal("turn_started"),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  platform: z.enum(["whatsapp", "telegram"]),
  userMessage: z.string().optional(),
  occurredAt: z.string().datetime(),
});

const turnCompletedSchema = z.object({
  event: z.literal("turn_completed"),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  platform: z.enum(["whatsapp", "telegram"]),
  userMessage: z.string().min(1),
  assistantResponse: z.string().min(1),
  occurredAt: z.string().datetime(),
});

const bodySchema = z.discriminatedUnion("event", [
  turnStartedSchema,
  turnCompletedSchema,
]);

function deriveTitle(userMessage: string): string {
  return userMessage.split("\n")[0].slice(0, 60);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "missing bearer token" },
      { status: 401 },
    );
  }

  const secretHash = createHash("sha256").update(secret).digest("hex");
  const customer = await prisma.customer.findUnique({
    where: { ingestionSecretHash: secretHash },
  });
  if (!customer) {
    return NextResponse.json(
      { ok: false, error: "invalid credentials" },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.message },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const startedAt = new Date(body.occurredAt);

  // Grouping key is the turn, not the session: Hermes doesn't reset a
  // WhatsApp/Telegram session between messages, so a session can span many
  // unrelated listings sent back-to-back. One turn = one Run.
  if (body.event === "turn_started") {
    const run = await prisma.run.upsert({
      where: {
        customerId_hermesTurnId: {
          customerId: customer.id,
          hermesTurnId: body.turnId,
        },
      },
      create: {
        customerId: customer.id,
        hermesSessionId: body.sessionId,
        hermesTurnId: body.turnId,
        source: body.platform,
        startedAt,
        status: "IN_PROGRESS",
        title: body.userMessage ? deriveTitle(body.userMessage) : null,
      },
      update: {},
    });
    return NextResponse.json({ ok: true, runId: run.id });
  }

  // turn_completed
  const run = await prisma.run.upsert({
    where: {
      customerId_hermesTurnId: {
        customerId: customer.id,
        hermesTurnId: body.turnId,
      },
    },
    create: {
      customerId: customer.id,
      hermesSessionId: body.sessionId,
      hermesTurnId: body.turnId,
      source: body.platform,
      startedAt,
      status: "COMPLETED",
      title: deriveTitle(body.userMessage),
    },
    update: {
      status: "COMPLETED",
    },
  });

  if (!run.title) {
    await prisma.run.update({
      where: { id: run.id },
      data: { title: deriveTitle(body.userMessage) },
    });
  }

  await prisma.runMessage.createMany({
    data: [
      {
        runId: run.id,
        role: "user",
        content: body.userMessage,
        timestamp: startedAt,
        sortIndex: 0,
      },
      {
        runId: run.id,
        role: "assistant",
        content: body.assistantResponse,
        timestamp: new Date(),
        sortIndex: 1,
      },
    ],
  });

  return NextResponse.json({ ok: true, runId: run.id });
}
