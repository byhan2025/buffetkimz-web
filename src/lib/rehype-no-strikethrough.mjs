/**
 * v7.2 — 본문에 취소선(`<del>`)이 생기면 빌드를 세운다.
 *
 * 왜: remark-gfm은 기본값이 `singleTilde: true`여서 `3.3~5.5%`, `5~10년`처럼
 * 한 줄(한 문단)에 숫자 범위 물결표가 두 번 나오면 그 사이 문장이 통째로 취소선이 되고
 * 물결표는 사라진다. 2026-11-21 `pension-master-06-healthcheck`에서
 * `3.3~5.5%로 단순하지만 … 은퇴 5~10년` → `3.3` + <del>5.5%로 … 은퇴 5</del> +`10년`으로 깨졌다.
 *
 * 막는 층은 둘이다.
 *   ① astro.config.mjs — remark-gfm을 `singleTilde: false`로 직접 등록(구조적 차단)
 *   ② 이 플러그인 — 그래도 취소선이 생기면(예: `~~`) 파일·줄과 함께 빌드 실패
 * 이 사이트는 취소선을 쓰지 않는다. 쓰게 되면 이 파일의 허용 목록에 이유와 함께 적는다.
 */
const ALLOWED = new Set();

export function rehypeNoStrikethrough() {
  /* unified의 attacher 규칙 — 옵션을 받는 바깥 함수가 transformer를 돌려준다.
     (rehypeTableWrap·rehypeBase 같은 모양. transformer를 그대로 넘기면 호출되지 않는다.) */
  return () => (tree, file) => {
    const path = file?.path || file?.history?.[0] || "(알 수 없는 파일)";
    let count = 0;
    const lines = [];

    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "element" && node.tagName === "del" && !ALLOWED.has(path)) {
        count += 1;
        if (lines.length < 5) {
          const start = node.position?.start?.line;
          const text = textOf(node).slice(0, 60);
          lines.push(`${start ? `${start}행: ` : ""}"${text}"`);
        }
      }
      for (const child of node.children ?? []) walk(child);
    };

    const textOf = (node) => {
      if (typeof node.value === "string") return node.value;
      return (node.children ?? []).map(textOf).join("");
    };

    walk(tree);

    if (count > 0) {
      throw new Error(
        [
          `[rehypeNoStrikethrough] 본문에 취소선(<del>) ${count}곳이 생겼습니다 — ${path}`,
          ...lines.map((l) => `  · ${l}`),
          "숫자 범위는 물결표(`~`) 대신 en dash(`–`)로 적으세요. 예: 3.3~5.5% → 3.3–5.5%",
        ].join("\n")
      );
    }
  };
}
