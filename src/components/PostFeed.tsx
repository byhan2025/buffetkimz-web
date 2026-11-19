import { useMemo, useState } from "react";
import { withBase } from "@/config/site";

export type FeedItem = {
  url: string;
  title: string;
  description: string;
  category: string;
  categoryName: string;
  tone: string;
  order?: number;
  date: string;
  readingMinutes: number;
  featured?: boolean;
  tags: string[];
};

type Props = {
  items: FeedItem[];
  variant?: "home" | "posts";
};

export default function PostFeed({ items, variant = "home" }: Props) {
  const [active, setActive] = useState<string>("all");

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: items.length };
    for (const item of items) map[item.category] = (map[item.category] ?? 0) + 1;
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const seen: { slug: string; name: string; order: number }[] = [];
    for (const item of items) {
      if (!seen.find((c) => c.slug === item.category)) {
        seen.push({ slug: item.category, name: item.categoryName, order: item.order ?? 99 });
      }
    }
    return seen.sort((a, b) => a.order - b.order);
  }, [items]);

  const filtered = useMemo(
    () => (active === "all" ? items : items.filter((i) => i.category === active)),
    [items, active]
  );

  const lead = filtered.length > 0 ? filtered[0] : null;
  const rest = lead ? filtered.slice(1) : filtered;

  return (
    <div>
      <div className="relative border-b border-line">
        <div className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
          <div role="tablist" aria-label="카테고리" className="flex min-w-max gap-6">
            <button
              role="tab"
              aria-selected={active === "all"}
              className="tab"
              onClick={() => setActive("all")}
            >
              전체
              <span className="ml-1.5 text-[12px] tabular-nums text-ink-faint">{counts.all ?? 0}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                role="tab"
                aria-selected={active === c.slug}
                className="tab"
                onClick={() => setActive(c.slug)}
              >
                {c.name}
                <span className="ml-1.5 text-[12px] tabular-nums text-ink-faint">
                  {counts[c.slug] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-[14px] text-ink-muted">아직 이 칸에는 글이 없습니다.</p>
      )}

      {lead && (
        <a href={withBase(lead.url)} className="group block py-7 md:py-9">
          <div className="flex items-baseline gap-3">
            <span className="text-[12px] font-semibold" style={{ color: lead.tone }}>
              {lead.categoryName}
            </span>
            <time className="dateline text-[12.5px]" dateTime={lead.date}>
              {lead.date}
            </time>
          </div>
          <h3 className="mt-2.5 max-w-[24ch] text-[26px] font-bold leading-[1.32] tracking-[-0.04em] text-ink group-hover:text-brand-deep md:text-[31px]">
            {lead.title}
          </h3>
          <p className="mt-3 max-w-[52ch] text-[14.5px] leading-[1.8] text-ink-muted md:text-[15px]">
            {lead.description}
          </p>
          <p className="mt-3 text-[12px] text-ink-faint">{lead.readingMinutes}분 읽기</p>
        </a>
      )}

      {lead && <div className="rule" />}

      <ul className="divide-y divide-line-soft">
        {rest.map((item) => (
          <li key={item.url}>
            <a href={withBase(item.url)} className="group grid gap-1.5 py-5 sm:grid-cols-[104px_1fr] sm:gap-6">
              <div className="flex items-baseline gap-2 sm:block">
                <time className="dateline block text-[12.5px]" dateTime={item.date}>
                  {item.date}
                </time>
                <span className="text-[12px] font-semibold sm:mt-1 sm:block" style={{ color: item.tone }}>
                  {item.categoryName}
                </span>
              </div>
              <div>
                <h3 className="text-[16.5px] font-semibold leading-[1.5] tracking-[-0.028em] text-ink group-hover:underline group-hover:decoration-line group-hover:underline-offset-4 md:text-[17.5px]">
                  {item.title}
                </h3>
                <p className="clamp-2 mt-1.5 text-[13.5px] leading-[1.72] text-ink-muted">
                  {item.description}
                </p>
                <p className="mt-1.5 text-[12px] text-ink-faint">{item.readingMinutes}분</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
