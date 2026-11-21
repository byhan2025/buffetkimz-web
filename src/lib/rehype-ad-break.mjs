/**
 * 본문 중반 광고 자리 삽입 — rehype 플러그인 (3단계 · 2026-11-21)
 *
 * 회의실 기준안의 허용 위치 ①(본문 중반) 을 실제로 만들기 위한 플러그인이다.
 *  · 조건: ADS_ENABLED=1 또는 AD_PREVIEW=1 일 때만 동작한다. 기본 빌드에서는 아무것도 넣지 않는다.
 *  · 대상: 블로그 글만(소식지 letters 는 제외). 앞 3개 블록(본문 첫 화면)은 건드리지 않는다.
 *  · 위치: 글자 수 기준 50%를 넘는 첫 블록 '앞'. 뒤에 최소 2개 블록이 남아야 넣는다.
 *  · 높이 예약(min-height 250/280px)과 라벨(광고)을 마크업에 함께 넣어 CLS 를 0 으로 둔다.
 */

const FLAGS = new Set(["1", "true", "on", "yes"]);
const on = (key) => FLAGS.has((process.env[key] ?? "").trim().toLowerCase());

const MIN_DOC_CHARS = 900; // 짧은 글에는 넣지 않는다
const KEEP_FIRST_BLOCKS = 3; // 본문 첫 화면(제목 + 2~3단락)
const KEEP_LAST_BLOCKS = 2;

function textOf(node) {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  if (Array.isArray(node.children)) return node.children.map(textOf).join("");
  return "";
}

function el(tagName, properties, children = []) {
  return { type: "element", tagName, properties, children };
}

function adNode(state) {
  const label = el("p", { className: ["ad-slot-label"] }, [el("span", {}, [{ type: "text", value: "광고" }])]);
  const frame = el("div", { className: ["ad-slot-frame"], "data-ad-frame": "" }, []);
  return el(
    "aside",
    {
      className: ["ad-slot"],
      "data-ad-slot": "article-mid",
      "data-ad-size": "in-article",
      "data-ad-region": "article-mid",
      "data-ad-state": state,
      "data-ad-min-h-mobile": "250",
      "data-ad-min-h-desktop": "280",
      "aria-label": "광고 자리",
      style: "--ad-h-mobile:250px;--ad-h-desktop:280px;--ad-max-w:728px",
    },
    [label, frame]
  );
}

export function rehypeAdBreak() {
  const preview = on("AD_PREVIEW");
  const enabled = on("ADS_ENABLED");
  if (!preview && !enabled) return () => {};

  // unified 는 attacher(설정 함수)를 기대한다 — transformer 를 바로 반환하면 한 번만 호출되고 끝난다.
  return () => (tree, file) => {
    // 블로그 글만 — 소식지(letters/)는 제외한다. (rehype 단계에는 frontmatter 가 없어 경로로 가른다)
    const p = file?.path ?? "";
    if (!p.includes("/content/posts/")) return;
    const children = tree.children ?? [];
    const blocks = children.filter((n) => n.type === "element" && n.tagName !== "hr");
    const total = blocks.reduce((sum, n) => sum + textOf(n).length, 0);
    if (total < MIN_DOC_CHARS) return;

    const half = total / 2;
    let acc = 0;
    let target = -1;
    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];
      if (node.type !== "element") continue;
      acc += textOf(node).length;
      if (acc >= half) {
        target = i;
        break;
      }
    }
    if (target < 0) return;
    const elementIndex = children.slice(0, target + 1).filter((n) => n.type === "element").length;
    const remaining = children.slice(target).filter((n) => n.type === "element").length;
    if (elementIndex <= KEEP_FIRST_BLOCKS || remaining <= KEEP_LAST_BLOCKS) return;
    if (children[target].tagName === "table") return;

    children.splice(target, 0, adNode(enabled ? "enabled" : "preview"));
  };
}
