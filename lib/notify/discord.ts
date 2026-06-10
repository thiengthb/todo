/**
 * Tầng gửi Discord (mục 13). Một chiều: app → webhook của một kênh Discord.
 * Tách riêng để sau dễ thêm kênh khác (Telegram/Slack) mà không đụng phần soạn nội dung.
 */

/** Một embed Discord tối giản — đủ cho thông báo của app */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  /** màu viền trái, dạng số thập phân (vd 0x10b981) */
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

// Giới hạn Discord (đã tra cứu): description ≤ 4096, title ≤ 256. Cắt cho an toàn.
const MAX_DESC = 4000;
const MAX_TITLE = 250;

function clamp(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * POST một message lên webhook. KHÔNG ném lỗi — luôn trả {ok} để caller ghi log
 * và degrade mượt (mục 11.1). Xử lý 429 bằng cách báo lại để caller quyết định.
 */
export async function sendDiscord(
  webhookUrl: string,
  message: DiscordMessage,
): Promise<SendResult> {
  if (!webhookUrl) {
    return { ok: false, status: 0, error: "Chưa cấu hình webhook Discord" };
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
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
      error: err instanceof Error ? err.message : "Lỗi mạng khi gửi Discord",
    };
  }
}
