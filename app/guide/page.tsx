import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Brain,
  CalendarCheck,
  Clock,
  Flag,
  Flame,
  HeartPulse,
  ListChecks,
  ListTodo,
  Smile,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "Hướng dẫn · Smart Todo",
  description:
    "Cách Smart Todo giúp bạn lập kế hoạch và duy trì kỷ luật bền vững.",
};

// ---- Dữ liệu nội dung (tách khỏi layout cho gọn) ----

const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ListTodo,
    title: "Thêm việc",
    desc: "Gõ vào ô bên dưới rồi Enter. Cứ ghi tự nhiên, không cần khai báo gì phức tạp.",
  },
  {
    icon: Smile,
    title: "Làm xong & chấm cảm xúc",
    desc: "Tick vòng tròn khi xong, rồi chấm dễ / bình thường / mệt. Đây là tín hiệu quý nhất để AI hiểu bạn.",
  },
  {
    icon: HeartPulse,
    title: "Chấm trạng thái (tùy chọn)",
    desc: "1 chạm cho năng lượng / giấc ngủ. Hôm nào đuối, AI sẽ tự nhẹ tay với bạn.",
  },
  {
    icon: Sparkles,
    title: "Đề xuất cho ngày mai",
    desc: "Bấm một nút — AI đọc dữ liệu thật và gợi ý danh sách khả thi, kèm lý do. Bạn chọn việc muốn thêm.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Target,
    title: "Việc chính (80/20)",
    desc: 'Nổi bật một "việc chính" đáng làm nhất — nếu chỉ làm 1 việc hôm nay, hãy làm nó.',
  },
  {
    icon: ListChecks,
    title: "Tự chia nhỏ",
    desc: "Việc lớn hay hay bị trượt được AI bẻ thành các bước nhỏ, tick từng bước cho dễ tạo đà.",
  },
  {
    icon: Clock,
    title: "Khi nào / ở đâu",
    desc: 'Gắn ý định thực hiện cho việc quan trọng ("sau cà phê, ở bàn làm") — mẹo nhỏ, hiệu quả lớn.',
  },
  {
    icon: CalendarCheck,
    title: "Kế hoạch dài hạn",
    desc: "Mục tiêu lớn được chia thành cột mốc; mỗi ngày AI rót việc kế tiếp theo tốc độ thật.",
  },
  {
    icon: Flame,
    title: "Chuỗi giữ lửa",
    desc: "Đếm ngày bạn giữ nhịp. Lỡ một ngày vẫn không đứt — nhẹ nhàng, không trừng phạt.",
  },
  {
    icon: Flag,
    title: "Mức tác động",
    desc: "Đánh dấu việc tác động cao bằng một chạm; AI ưu tiên đúng thứ đáng làm.",
  },
];

const SCIENCE: { title: string; desc: string }[] = [
  {
    title: "Bám số thật, không theo mong muốn",
    desc: "Ta thường ước lượng quá lạc quan (planning fallacy). App hiệu chỉnh theo tốc độ & cảm xúc thật của chính bạn — nên đề xuất luôn khả thi.",
  },
  {
    title: '"Khi nào/ở đâu" rất mạnh',
    desc: "Nghiên cứu cho thấy gắn ý định thực hiện (implementation intention) là một trong những đòn đơn giản mà hiệu quả nhất để biến dự định thành hành động.",
  },
  {
    title: "Tử tế khi vấp, không trừng phạt",
    desc: "Tự tử tế với bản thân khi lỡ giúp quay lại nhanh hơn là tự trách. Vì vậy app không có nhãn đỏ, không phạt, streak tha thứ một ngày.",
  },
  {
    title: "Không điểm số, chỉ phản hồi thật",
    desc: "Điểm/huy hiệu có thể bào mòn động lực tự thân. App thay bằng phản hồi mang tính thông tin (vd “tuần này bạn xong 4 việc khó”).",
  },
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
      {/* Hero */}
      <section className="mx-auto max-w-2xl text-center">
        <Reveal>
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-foreground text-background">
            <Sparkles className="size-6" />
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Một trợ lý giúp bạn{" "}
            <span className="text-muted-foreground">giữ nhịp lâu dài</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Smart Todo không chạy theo việc bạn làm được nhiều hay ít hôm nay.
            Nó giúp bạn
            <strong className="font-medium text-foreground">
              {" "}
              duy trì kế hoạch suốt nhiều năm mà không kiệt sức
            </strong>{" "}
            — bằng cách học từ dữ liệu thật của chính bạn.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button asChild className="gap-2">
              <Link href="/">
                Bắt đầu hôm nay <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/plans">Tạo kế hoạch</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Một ngày với Smart Todo */}
      <section className="mt-12">
        <Reveal>
          <SectionTitle>Một ngày với Smart Todo</SectionTitle>
        </Reveal>
        <Reveal delay={60}>
          <p className="mt-1 text-sm text-muted-foreground">
            Một nhịp đơn giản, lặp lại mỗi ngày — phần &ldquo;mai làm gì&rdquo;
            để AI lo.
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
                    <span className="text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Những trợ thủ */}
      <section className="mt-12">
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

      {/* Vì sao app làm vậy */}
      <section className="mt-12">
        <Reveal>
          <SectionTitle>
            <Brain className="size-5" /> Vì sao app làm như vậy
          </SectionTitle>
        </Reveal>
        <Reveal delay={60}>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi lựa chọn thiết kế dựa trên nghiên cứu hành vi — giữ điều có ích,
            bỏ điều phản tác dụng.
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

      {/* Kết */}
      <section className="mt-12">
        <Reveal>
          <div className="mx-auto max-w-2xl rounded-lg border border-border/70 bg-muted/30 p-6 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Không cần hoàn hảo. Chỉ cần{" "}
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
    </div>
  );
}
