import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bot,
  Brain,
  CalendarCheck,
  CalendarClock,
  Flame,
  HeartPulse,
  ListChecks,
  ListTodo,
  MessageSquareText,
  Plug,
  Repeat,
  Smile,
  Sparkles,
  Sprout,
  Target,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Reveal } from '@/components/reveal';

export const metadata = {
  title: 'Hướng dẫn · Smart Todo',
  description: 'Cách Smart Todo giúp bạn lập kế hoạch và duy trì kỷ luật bền vững.',
};

// ---- Dữ liệu nội dung (tách khỏi layout cho gọn) ----

const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ListTodo,
    title: 'Thêm việc',
    desc: 'Gõ vào ô bên dưới rồi Enter. Cứ ghi tự nhiên, không cần khai báo gì phức tạp.',
  },
  {
    icon: Smile,
    title: 'Làm xong & chấm cảm xúc',
    desc: 'Tick vòng tròn khi xong, rồi chấm dễ / bình thường / mệt. Đây là tín hiệu quý nhất để AI hiểu bạn.',
  },
  {
    icon: HeartPulse,
    title: 'Chấm trạng thái (tùy chọn)',
    desc: '1 chạm cho năng lượng / giấc ngủ. Hôm nào đuối, AI sẽ tự nhẹ tay với bạn.',
  },
  {
    icon: Sparkles,
    title: 'Đề xuất cho ngày mai',
    desc: 'Bấm một nút — AI đọc dữ liệu thật và gợi ý danh sách khả thi, kèm lý do. Bạn chọn việc muốn thêm.',
  },
];

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Target,
    title: 'Việc chính (80/20)',
    desc: 'Nổi bật một "việc chính" đáng làm nhất — nếu chỉ làm 1 việc hôm nay, hãy làm nó.',
  },
  {
    icon: ListChecks,
    title: 'Tự chia nhỏ',
    desc: 'Việc lớn hay hay bị trượt được AI bẻ thành các bước nhỏ, tick từng bước cho dễ tạo đà.',
  },
  {
    icon: CalendarClock,
    title: 'Lịch tuần kéo-thả',
    desc: 'Khai báo lịch học/làm + khung tập trung trên lưới giờ — kéo để tạo, dời, đổi giờ. App tính quỹ rảnh thật.',
  },
  {
    icon: CalendarCheck,
    title: 'Kế hoạch dài hạn',
    desc: 'Mục tiêu lớn được chia thành cột mốc; mỗi ngày AI rót việc kế tiếp theo tốc độ thật.',
  },
  {
    icon: Sprout,
    title: 'Ấp ủ — để dành cho sau',
    desc: 'Trút những điều muốn làm nhưng chưa thể xử lý ngay vào hàng đợi không áp lực. Lúc rảnh, app gợi lấy ra làm — kéo thành việc hoặc nâng thành kế hoạch.',
  },
  {
    icon: Repeat,
    title: 'Nhịp sống & thói quen',
    desc: 'Thói quen tick 1 chạm + giờ thức/ngủ nuôi capacity. Không điểm số — chỉ phản chiếu đà.',
  },
  {
    icon: Flame,
    title: 'Chuỗi giữ lửa',
    desc: 'Đếm ngày bạn giữ nhịp. Lỡ một ngày vẫn không đứt — nhẹ nhàng, không trừng phạt.',
  },
];

const SCIENCE: { title: string; desc: string }[] = [
  {
    title: 'Bám số thật, không theo mong muốn',
    desc: 'Ta thường ước lượng quá lạc quan (planning fallacy). App hiệu chỉnh theo tốc độ & cảm xúc thật của chính bạn — nên đề xuất luôn khả thi.',
  },
  {
    title: '"Khi nào/ở đâu" rất mạnh',
    desc: 'Nghiên cứu cho thấy gắn ý định thực hiện (implementation intention) là một trong những đòn đơn giản mà hiệu quả nhất để biến dự định thành hành động.',
  },
  {
    title: 'Tử tế khi vấp, không trừng phạt',
    desc: 'Tự tử tế với bản thân khi lỡ giúp quay lại nhanh hơn là tự trách. Vì vậy app không có nhãn đỏ, không phạt, streak tha thứ một ngày.',
  },
  {
    title: 'Không điểm số, chỉ phản hồi thật',
    desc: 'Điểm/huy hiệu có thể bào mòn động lực tự thân. App thay bằng phản hồi mang tính thông tin (vd “tuần này bạn xong 4 việc khó”).',
  },
];

// ---- Nội dung tab MCP (dùng Claude lập kế hoạch trên dữ liệu thật, mục 15) ----

const MCP_STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Terminal,
    title: 'Claude Code (CLI)',
    desc: 'Chạy lệnh claude mcp add bên dưới — kết nối trực tiếp qua HTTP kèm Bearer token, KHÔNG cần npx mcp-remote.',
  },
  {
    icon: Plug,
    title: 'Claude Desktop',
    desc: "Settings → Connectors → Add custom connector → URL https://<tên-miền>/api/mcp. Desktop tự chạy OAuth: nhập MCP token ở trang xác nhận. Không cài npx, hết lỗi 'C:\\Program'.",
  },
  {
    icon: MessageSquareText,
    title: 'Bảo Claude lập kế hoạch',
    desc: 'Hỏi tự nhiên. Claude đọc lịch + quỹ giờ thật, trình bày kế hoạch, CHỜ bạn duyệt rồi mới ghi vào app.',
  },
];

// Lệnh kết nối trực tiếp (không cần cầu nối mcp-remote)
const MCP_CONNECT_CLI =
  'claude mcp add --transport http todo https://<tên-miền>/api/mcp \\\n  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"';

const MCP_TOOL_GROUPS: { icon: LucideIcon; label: string; tools: string[] }[] = [
  {
    icon: ListTodo,
    label: 'Việc',
    tools: [
      'create_task',
      'bulk_create_tasks',
      'update_task',
      'complete_task',
      'delete_task',
      'list_tasks',
      'get_task',
    ],
  },
  {
    icon: CalendarClock,
    label: 'Lịch & tải',
    tools: ['get_schedule', 'get_workload_summary'],
  },
  {
    icon: Target,
    label: 'Kế hoạch dài hạn',
    tools: [
      'create_plan',
      'add_milestones',
      'update_plan',
      'list_plans',
      'get_plan',
      'check_milestone',
    ],
  },
  {
    icon: Sprout,
    label: 'Ấp ủ (hàng đợi mục tiêu)',
    tools: [
      'add_to_queue',
      'list_queue',
      'update_goal',
      'promote_to_task',
      'promote_to_plan',
      'drop_goal',
    ],
  },
  {
    icon: Repeat,
    label: 'Thói quen',
    tools: ['list_habits', 'check_habit'],
  },
];

const MCP_PROMPTS: { name: string; desc: string }[] = [
  {
    name: 'plan_my_day',
    desc: 'Lập kế hoạch hôm nay theo giờ, dựa trên lịch & quỹ rảnh thật.',
  },
  {
    name: 'plan_week',
    desc: 'Dàn việc 7 ngày tới, tránh dồn một ngày quá tải.',
  },
  {
    name: 'plan_project',
    desc: 'Mục tiêu lớn + deadline → tạo kế hoạch (Plan) với roadmap cột mốc, rồi rót việc cuốn chiếu.',
  },
  {
    name: 'triage_queue',
    desc: 'Rà soát hàng đợi "Ấp ủ" → gợi kéo thành việc / nâng thành kế hoạch / buông.',
  },
  {
    name: 'review_and_reschedule',
    desc: 'Rà việc quá hạn/chưa xong → đề xuất dời lịch hợp lý.',
  },
];

const MCP_PHRASES: string[] = [
  'Lên kế hoạch hôm nay cho tôi dựa trên lịch và quỹ giờ rảnh.',
  'Tuần này tôi có mấy việc lớn, dàn giúp tôi tránh quá tải.',
  'Tôi muốn luyện thi N2 trong 6 tháng — tạo kế hoạch với các cột mốc kiểm chứng được.',
  'Xem việc nào đang trễ và đề xuất dời lịch giúp tôi.',
  'Tôi có vài điều đang ấp ủ — lúc rảnh giúp tôi chọn cái nào nên bắt đầu trước.',
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
      {children}
    </h2>
  );
}

export default function GuidePage() {
  return (
    <div className="py-8">
      {/* Hero (chung cho cả 2 tab) */}
      <section className="mx-auto max-w-2xl text-center">
        <Reveal>
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-foreground text-background">
            <Sparkles className="size-6" />
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Một trợ lý giúp bạn <span className="text-muted-foreground">giữ nhịp lâu dài</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Smart Todo không chạy theo việc bạn làm được nhiều hay ít hôm nay. Nó giúp bạn
            <strong className="font-medium text-foreground">
              {' '}
              duy trì kế hoạch suốt nhiều năm mà không kiệt sức
            </strong>{' '}
            — bằng cách học từ dữ liệu thật của chính bạn.
          </p>
        </Reveal>
      </section>

      <div className="mt-10">
        <Tabs defaultValue="app">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="app">Dùng app</TabsTrigger>
              <TabsTrigger value="mcp">
                <Bot /> Dùng với AI (MCP)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ───────── Tab 1: Dùng app ───────── */}
          <TabsContent value="app" className="mt-8 space-y-12">
            <section>
              <Reveal>
                <SectionTitle>Một ngày với Smart Todo</SectionTitle>
              </Reveal>
              <Reveal delay={60}>
                <p className="mt-1 text-sm text-muted-foreground">
                  Một nhịp đơn giản, lặp lại mỗi ngày — phần &ldquo;mai làm gì&rdquo; để AI lo.
                </p>
              </Reveal>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {STEPS.map((s, i) => (
                  <Reveal key={s.title} delay={i * 80} className="h-full">
                    <div className="flex h-full items-start gap-4 rounded-lg border border-border/70 p-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <s.icon className="size-5 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            <section>
              <Reveal>
                <SectionTitle>Những trợ thủ trong app</SectionTitle>
              </Reveal>
              <Reveal delay={60}>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tất cả đều tùy chọn và nhẹ — dùng được tới đâu hay tới đó.
                </p>
              </Reveal>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((f, i) => (
                  <Reveal key={f.title} delay={(i % 2) * 80} className="h-full">
                    <div className="flex h-full flex-col gap-2 rounded-lg border border-border/70 p-4 transition-colors hover:bg-muted/40">
                      <f.icon className="size-5 text-foreground" />
                      <p className="text-sm font-medium">{f.title}</p>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            <section>
              <Reveal>
                <SectionTitle>
                  <Brain className="size-5" /> Vì sao app làm như vậy
                </SectionTitle>
              </Reveal>
              <Reveal delay={60}>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mỗi lựa chọn thiết kế dựa trên nghiên cứu hành vi — giữ điều có ích, bỏ điều phản
                  tác dụng.
                </p>
              </Reveal>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {SCIENCE.map((s, i) => (
                  <Reveal key={s.title} delay={(i % 2) * 70} className="h-full">
                    <div className="flex h-full flex-col rounded-lg border border-border/70 p-4">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            <section>
              <Reveal>
                <div className="mx-auto max-w-2xl rounded-lg border border-border/70 bg-muted/30 p-6 text-center">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Không cần hoàn hảo. Chỉ cần{' '}
                    <strong className="font-medium text-foreground">
                      đều đặn và tử tế với chính mình
                    </strong>
                    . Nghỉ ngơi khi cần cũng là một phần của kỷ luật.
                  </p>
                  <Button asChild className="mt-4 gap-2">
                    <Link href="/">
                      Mở trang Hôm nay <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </Reveal>
            </section>
          </TabsContent>

          {/* ───────── Tab 2: Dùng với AI (MCP) ───────── */}
          <TabsContent value="mcp" className="mt-8 space-y-12">
            <section>
              <Reveal>
                <SectionTitle>
                  <Bot className="size-5" /> Để Claude lập kế hoạch trên dữ liệu thật
                </SectionTitle>
              </Reveal>
              <Reveal delay={60}>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Kết nối Claude (Desktop / Cursor / VS Code / claude.ai) với app qua{' '}
                  <strong className="font-medium text-foreground">Model Context Protocol</strong>.
                  Mọi suy luận nằm ở phía Claude; app chỉ cung cấp dữ liệu thật + ghi việc khi bạn
                  đồng ý.
                </p>
              </Reveal>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {MCP_STEPS.map((s, i) => (
                  <Reveal key={s.title} delay={i * 80} className="h-full">
                    <div className="flex h-full flex-col gap-2 rounded-lg border border-border/70 p-4">
                      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                        <s.icon className="size-5 text-foreground" />
                      </div>
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{' '}
                        {s.title}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={120}>
                <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Terminal className="size-4 text-muted-foreground" />
                    Kết nối nhanh bằng Claude Code
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-md border border-border/70 bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    {MCP_CONNECT_CLI}
                  </pre>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Thay <code className="font-mono">&lt;tên-miền&gt;</code> và{' '}
                    <code className="font-mono">&lt;MCP_AUTH_TOKEN&gt;</code>. Cách này nối thẳng
                    HTTP — không cần <code className="font-mono">npx mcp-remote</code>.{' '}
                    <code className="font-mono">mcp-remote</code> chỉ là phương án dự phòng; nếu
                    dùng, đặt <code className="font-mono">command</code> là{' '}
                    <code className="font-mono">npx</code> (đừng để đường dẫn đầy đủ có khoảng trắng
                    → lỗi “C:\Program”).
                  </p>
                </div>
              </Reveal>
            </section>

            <section>
              <Reveal>
                <SectionTitle>Việc Claude làm được</SectionTitle>
              </Reveal>
              <Reveal delay={60}>
                <p className="mt-1 text-sm text-muted-foreground">
                  Các công cụ Claude có thể gọi — luôn đọc ngữ cảnh trước, ghi sau khi bạn duyệt.
                </p>
              </Reveal>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {MCP_TOOL_GROUPS.map((g, i) => (
                  <Reveal key={g.label} delay={(i % 2) * 70} className="h-full">
                    <div className="flex h-full flex-col gap-2 rounded-lg border border-border/70 p-4">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <g.icon className="size-4 text-muted-foreground" />
                        {g.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.tools.map((t) => (
                          <code
                            key={t}
                            className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                          >
                            {t}
                          </code>
                        ))}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>

            <section>
              <Reveal>
                <SectionTitle>Prompt sẵn & câu nói gợi ý</SectionTitle>
              </Reveal>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Reveal className="h-full">
                  <div className="flex h-full flex-col gap-2 rounded-lg border border-border/70 p-4">
                    <p className="text-sm font-medium">Prompt sẵn (slash)</p>
                    <ul className="space-y-2">
                      {MCP_PROMPTS.map((p) => (
                        <li key={p.name}>
                          <code className="font-mono text-[11px] text-foreground">/{p.name}</code>
                          <span className="ml-1.5 text-xs text-muted-foreground">— {p.desc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
                <Reveal delay={70} className="h-full">
                  <div className="flex h-full flex-col gap-2 rounded-lg border border-border/70 p-4">
                    <p className="text-sm font-medium">Hoặc cứ nói tự nhiên</p>
                    <ul className="space-y-1.5">
                      {MCP_PHRASES.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-1.5 text-sm text-muted-foreground"
                        >
                          <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
                          “{p}”
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
