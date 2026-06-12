/**
 * Discord sending layer (section 13). One-way: app → a Discord channel's webhook.
 * Kept separate so other channels (Telegram/Slack) can be added later without touching the content composer.
 */

/** A minimal Discord embed — enough for the app's notifications */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  /** left-border color, as a decimal number (e.g. 0x10b981) */
  color?: number;
  footer?: { text: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

export interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

// Discord limits (looked up): description ≤ 4096, title ≤ 256. Truncate to be safe.
const MAX_DESC = 4000;
const MAX_TITLE = 250;

function clamp(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * POST a message to the webhook. Does NOT throw — always returns {ok} so the caller can log
 * and degrade gracefully (section 11.1). Handles 429 by reporting back for the caller to decide.
 */
export async function sendDiscord(
  webhookUrl: string,
  message: DiscordMessage,
): Promise<SendResult> {
  if (!webhookUrl) {
    return { ok: false, status: 0, error: 'Chưa cấu hình webhook Discord' };
  }

  const body: DiscordMessage = {
    content: message.content,
    embeds: message.embeds?.map((e) => ({
      ...e,
      title: e.title ? clamp(e.title, MAX_TITLE) : undefined,
      description: e.description ? clamp(e.description, MAX_DESC) : undefined,
    })),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        error: `Discord ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Lỗi mạng khi gửi Discord',
    };
  }
}
