import { gmail, type gmail_v1 } from "@googleapis/gmail";
import type { ToolContext } from "eve/tools";
import { withGoogleAuth } from "./client";

type GmailMessage = gmail_v1.Schema$Message;
type GmailPart = gmail_v1.Schema$MessagePart;

export async function searchGmail(
  ctx: ToolContext,
  query: string,
  maxResults: number
) {
  return withGmail(ctx, async (client) => {
    const listed = await client.users.messages.list(
      { maxResults, q: query, userId: "me" },
      { signal: ctx.abortSignal }
    );
    const messages = await Promise.all(
      (listed.data.messages ?? []).flatMap(({ id }) =>
        id
          ? [
              client.users.messages.get(
                {
                  format: "metadata",
                  id,
                  metadataHeaders: [
                    "From",
                    "To",
                    "Subject",
                    "Date",
                    "Message-ID",
                  ],
                  userId: "me",
                },
                { signal: ctx.abortSignal }
              ),
            ]
          : []
      )
    );
    return messages.map(({ data }) => minimizeMessage(data));
  });
}

export async function readGmailThread(ctx: ToolContext, threadId: string) {
  return withGmail(ctx, async (client) => {
    const { data: thread } = await client.users.threads.get(
      { format: "full", id: threadId, userId: "me" },
      { signal: ctx.abortSignal }
    );
    return {
      id: thread.id ?? threadId,
      messages: (thread.messages ?? []).slice(-20).map((message) =>
        Object.assign({}, minimizeMessage(message), {
          attachments: collectAttachments(message.payload),
          body: redactGoogleText(plainText(message.payload)),
        })
      ),
    };
  });
}

function header(part: GmailPart | undefined, name: string) {
  return (
    part?.headers?.find(
      (item) => item.name?.toLowerCase() === name.toLowerCase()
    )?.value ?? null
  );
}

function plainText(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const text = plainText(child);
    if (text) return text;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data)
      .replace(/<[^>]+>/gu, " ")
      .replace(/\s+/gu, " ");
  }
  return "";
}

function minimizeMessage(message: GmailMessage) {
  return {
    date: header(message.payload, "Date"),
    from: header(message.payload, "From"),
    id: message.id ?? null,
    labels: message.labelIds ?? [],
    messageId: header(message.payload, "Message-ID"),
    snippet: redactGoogleText(message.snippet ?? "", 500),
    subject: header(message.payload, "Subject"),
    threadId: message.threadId ?? null,
    to: header(message.payload, "To"),
  };
}

function collectAttachments(part: GmailPart | undefined): {
  attachmentId: string;
  filename: string;
  size: number;
}[] {
  if (!part) return [];
  const own =
    part.filename && part.body?.attachmentId
      ? [
          {
            attachmentId: part.body.attachmentId,
            filename: part.filename,
            size: part.body.size ?? 0,
          },
        ]
      : [];
  const nested = (part.parts ?? []).flatMap((child) => {
    return collectAttachments(child);
  });
  return [...own, ...nested];
}

function withGmail<T>(
  ctx: ToolContext,
  execute: (client: ReturnType<typeof gmail>) => Promise<T>
) {
  return withGoogleAuth(ctx, (auth) => execute(gmail({ auth, version: "v1" })));
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

const secretPatterns: readonly (readonly [RegExp, string])[] = [
  [/\b\d{6}\b/gu, "[six-digit code redacted]"],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/gu, "[api key redacted]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu, "[github token redacted]"],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu, "[aws key redacted]"],
  [/\bAIza[A-Za-z0-9_-]{30,}\b/gu, "[google api key redacted]"],
  [/\b(?:bearer\s+)[A-Za-z0-9._~+/-]+=*\b/giu, "Bearer [token redacted]"],
  [
    /\b(password|passcode|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu,
    "$1=[credential redacted]",
  ],
  [/\b(?:\d[ -]*?){13,19}\b/gu, "[payment number redacted]"],
];

function redactGoogleText(value: string, maxLength = 12_000) {
  let redacted = value.slice(0, maxLength);
  for (const [pattern, replacement] of secretPatterns) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}
