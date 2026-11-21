/**
 * 본문 표를 감싸는 rehype 플러그인 (v6.0).
 *
 * 왜 필요한가
 *  · `<table>`에 `display:block; overflow-x:auto`를 주는 방식은 표 레이아웃을 깨고,
 *    좁은 화면에서 헤더가 3줄로 접히는 원인이 됐다(2026-11-21 사용자 지적).
 *  · 표는 `.table-wrap` 안에서 **표 레이아웃 그대로** 두고, 넘칠 때만 그 상자 안에서 가로 스크롤한다.
 *  · 금액·퍼센트만 있는 셀에는 `is-num` 클래스를 붙여 `tabular-nums` + 줄바꿈 금지(값이 두 줄로 갈라지지 않게).
 *
 * 규칙
 *  · 이미 `.table-wrap` 안에 있는 표는 다시 감싸지 않는다.
 *  · 판정은 '한글 없이 숫자와 단위만 있는가' — '추가 300만원의 절감액' 같은 문장형 헤더는 수치 셀로 보지 않는다.
 */

/** 수치 셀에서 허용하는 단위 글자 — 이 글자만 남으면 숫자 셀로 본다 */
const UNIT_CHARS = /[만억천원년개월일세배명건회포인트\s]/g;

function isNumericText(text) {
  const rest = String(text || "").replace(UNIT_CHARS, "");
  return /\d/.test(rest) && !/[가-힣]/.test(rest);
}

function textOf(node) {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  return (node.children ?? []).map(textOf).join("");
}

function addClass(node, name) {
  const props = node.properties ?? (node.properties = {});
  const current = props.className ?? props.class ?? [];
  const list = Array.isArray(current) ? current : String(current).split(/\s+/).filter(Boolean);
  if (!list.includes(name)) props.className = [...list, name];
}

function markCells(table) {
  const walk = (node) => {
    if (!node || node.type !== "element") return;
    if (node.tagName === "td" || node.tagName === "th") {
      const text = textOf(node).trim();
      if (text && isNumericText(text)) addClass(node, "is-num");
    }
    (node.children ?? []).forEach(walk);
  };
  walk(table);
}

export function rehypeTableWrap() {
  /* unified의 attacher 규칙 — 옵션을 받는 바깥 함수가 transformer를 돌려준다.
     (rehypeBase와 같은 모양. transformer를 그대로 플러그인으로 넘기면 호출되지 않는다.) */
  return () => (tree) => {
    const visit = (node) => {
      if (!node || !Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        if (child?.type === "element" && child.tagName === "table") {
          markCells(child);
          return {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"] },
            children: [child],
          };
        }
        visit(child);
        return child;
      });
    };
    visit(tree);
    return tree;
  };
}
