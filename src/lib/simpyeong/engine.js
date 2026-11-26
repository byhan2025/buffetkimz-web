/**
 * 심평원 고지 정리기 — 분류·판정 엔진 (2026-11-26)
 *
 * 이 파일 하나가 두 곳에서 같은 판정을 낸다.
 *   · buffetkimz.com  — `src/components/tools/SimpyeongOrganizer.tsx` 가 ES 모듈로 가져간다.
 *   · InsureCRM       — `scripts/build_simpyeong_core.mjs` 가 클래식 스크립트로 바꿔
 *                       `apps/insure-crm/simpyeong-core.js` 로 내보낸다(window.Simpyeong).
 *
 * 원칙
 *   1. 파일은 브라우저 밖으로 나가지 않는다. 이 파일에는 통신 코드가 없다.
 *   2. 판정은 '고지 문항에 걸리는지'까지만 한다. 가입 가능·인수 여부는 판정하지 않는다.
 *   3. 숫자를 지어내지 않는다. 근거 줄(날짜·병원·상병)이 없는 항목은 0으로 센다.
 *   4. 표 머리글을 못 찾으면 '읽지 못한 파일'로 돌려주고, 화면은 그 사실을 말한다.
 *
 * 내보내는 것
 *   analyze(tables, options) → 결과 묶음(요약 카드·고지 문항·근거 줄·투약 분류)
 *   buildSummary(result, sections) → 심사용 요약문
 *   buildCustomerMessage(result, options) → 카톡 붙여넣기용 안내 문구
 *   buildReportHTML(result, options) → 오프라인 단일 HTML 레포트
 *   EXAMPLE_TABLES(baseISO) → 예시 데이터 3종(기본진료·세부진료·처방조제) 표
 *   parseTablesFromLines(name, lines) → PDF·텍스트 줄을 표로
 */

/* ────────────────────────────── 날짜 ────────────────────────────── */

const DAY = 86400000;
export const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function isoAddDays(iso, n) {
  if (!iso) return "";
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) return "";
  return new Date(t + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  if (!a || !b) return 0;
  const t1 = Date.parse(a + "T00:00:00Z");
  const t2 = Date.parse(b + "T00:00:00Z");
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 0;
  return Math.round((t2 - t1) / DAY);
}

export function dotDate(iso) {
  return iso ? iso.replace(/-/g, ".") : "";
}

/** 기준일에서 며칠 전인지 — '26일 전', '3개월 전' */
export function ago(iso, baseISO) {
  if (!iso || !baseISO) return "";
  const d = daysBetween(iso, baseISO);
  if (d < 0) return `${-d}일 후`;
  if (d === 0) return "오늘";
  if (d <= 60) return `${d}일 전`;
  const m = Math.round(d / 30.44);
  if (m < 24) return `${m}개월 전`;
  return `${Math.floor(d / 365)}년 전`;
}

export function normalizeDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const p = (n) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  // 엑셀 일련번호 (1900 체계)
  if (/^\d{5}$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      const t = Date.UTC(1899, 11, 30) + n * DAY;
      return new Date(t).toISOString().slice(0, 10);
    }
  }
  let m = /^(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/.exec(s);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    if (y >= 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const p = (n) => String(n).padStart(2, "0");
      return `${y}-${p(mo)}-${p(d)}`;
    }
  }
  m = /^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
  if (m) {
    const p = (n) => String(n).padStart(2, "0");
    return `20${m[1]}-${p(+m[2])}-${p(+m[3])}`;
  }
  m = /^(\d{4})년?(\d{1,2})월?(\d{1,2})일?$/.exec(s.replace(/\s/g, ""));
  if (m) {
    const p = (n) => String(n).padStart(2, "0");
    return `${m[1]}-${p(+m[2])}-${p(+m[3])}`;
  }
  return "";
}

/* ────────────────────────────── 표 → 레코드 ────────────────────────────── */

const norm = (s) =>
  String(s == null ? "" : s)
    .replace(/\s+/g, "")
    .replace(/[()[\]{}]/g, "")
    .replace(/[·:：.,]/g, "")
    .toLowerCase();

/** 열 이름 사전 — 심평원 파일은 내려받는 시기마다 열 이름이 조금씩 다르다. */
const FIELDS = {
  date: ["진료일자", "진료일", "내원일", "내원일자", "처방일자", "처방일", "조제일자", "조제일", "투약일자", "요양개시일", "진료개시일", "수진일", "수진일자", "발생일", "일자", "진료시작일", "시작일"],
  hospital: ["의료기관명", "요양기관명", "의료기관", "요양기관", "병원명", "기관명", "병의원명", "청구기관", "요양기관명칭", "병의원&약국", "병의원약국", "병의원"],
  dept: ["진료과목", "진료과", "과목", "진료부서", "진료과명"],
  code: ["상병코드", "주상병코드", "상병기호", "상병코드번호", "kcd코드", "질병코드", "상병분류기호", "주상병", "부상병코드"],
  name: ["상병명", "주상병명", "질병명", "진단명", "상병", "부상병명", "상병명칭"],
  visit: ["내원구분", "진료구분", "입원구분", "외래구분", "진료형태", "내원형태", "입원외래구분", "구분", "처방조제", "외래처방조제", "조제"],
  days: ["입원일수", "재원일수", "입원일", "요양일수", "총입원일수", "입원외래일수", "입원외래"],
  category: ["분류", "항목구분", "진료분류", "수가분류", "분류명", "진료항목구분", "진료내역"],
  item: ["명칭", "수가명", "항목명", "처치명", "수술명", "검사명", "처치및수술명", "진료항목명", "코드명"],
  drug: ["약품명", "약제명", "약품", "처방약품명", "처방약품", "투약약품명", "약품명칭"],
  ingredient: ["성분명", "성분", "일반명"],
  supply: ["투약일수", "총투약일수", "조제일수", "복용일수", "일수"],
  amount: ["총진료비", "진료비", "청구금액", "총액", "급여비용", "요양급여비용", "진료비총액"],
  selfPay: ["본인부담금", "내가낸의료비", "환자부담금", "본인부담", "비급여본인부담금", "총본인부담금"],
  count: ["횟수", "진료횟수", "내원횟수", "건수"],
};

function matchField(headerCell) {
  const h = norm(headerCell);
  if (!h) return null;
  for (const [field, list] of Object.entries(FIELDS)) {
    for (const alias of list) {
      if (h === alias) return field;
    }
  }
  // 부분 일치 — '상병명(주)' 같은 표기
  for (const [field, list] of Object.entries(FIELDS)) {
    for (const alias of list) {
      if (h.includes(alias) && alias.length >= 2) return field;
    }
  }
  return null;
}

function mapHeader(row) {
  const map = {};
  let hits = 0;
  row.forEach((cell, i) => {
    const f = matchField(cell);
    if (f && map[f] == null) {
      map[f] = i;
      hits++;
    }
  });
  return { map, hits };
}

function isHeaderRow(cells) {
  const { map, hits } = mapHeader(cells);
  const usable = map.date != null || (map.hospital != null && (map.days != null || map.amount != null || map.selfPay != null));
  return hits >= 3 && usable;
}

/* ────────────────────────────── PDF 글자 상자 → 행 ────────────────────────────── */

/**
 * PDF에서 뽑은 글자 상자(words)를 표의 행으로 바꾼다.
 *
 * PDF는 글자를 한 자씩 따로 주기도 한다(Chromium·한글 PDF). 그래서 '줄 → 칸'을 좌표로 만든다.
 *   1) 같은 높이의 글자를 모아 줄로 묶는다.
 *   2) 줄 안에서 간격이 벌어진 곳을 칸 경계로 본다.
 *   3) 표 머리글 줄을 찾아 그 칸들의 x 위치로 열 경계를 정하고, 아래 줄은 x 위치로 칸을 채운다.
 * 이렇게 하면 칸 사이에 탭 문자가 없어도(글자마다 따로 와도) 표로 읽힌다.
 *
 * @param {{x0:number,x1:number,cy:number,h:number,t:string}[]} words
 * @returns {string[][]}
 */
export function pdfWordsToRows(words) {
  const items = (words || []).filter((w) => w && String(w.t || "").trim());
  if (!items.length) return [];
  const hs = items.map((w) => w.h || w.y1 - w.y0 || 8).sort((a, b) => a - b);
  const mh = hs[hs.length >> 1] || 8;

  /* 1) 줄 묶기 */
  const lines = [];
  for (const w of items.slice().sort((a, b) => a.cy - b.cy || a.x0 - b.x0)) {
    let line = null;
    for (const l of lines.slice(-4)) if (Math.abs(l.cy - w.cy) <= mh * 0.5) line = l;
    if (line) {
      line.items.push(w);
      line.cy = (line.cy * (line.items.length - 1) + w.cy) / line.items.length;
    } else lines.push({ cy: w.cy, items: [w] });
  }

  /* 2) 줄 안의 칸 나누기 — 글자 사이 간격이 글자 높이의 0.9배를 넘으면 다른 칸 */
  const withCells = lines.map((l) => {
    const ws = l.items.sort((a, b) => a.x0 - b.x0);
    const cells = [];
    let cur = null;
    for (const w of ws) {
      const t = String(w.t);
      if (cur) {
        const gap = w.x0 - cur.x1;
        if (gap <= mh * 0.1) {
          cur.text += (gap > mh * 0.25 ? " " : "") + t;
          cur.x1 = Math.max(cur.x1, w.x1);
          continue;
        }
      }
      cur = { text: t.trim(), x0: w.x0, x1: w.x1 };
      cells.push(cur);
    }
    return { cy: l.cy, cells: cells.filter((c) => c.text) };
  }).filter((l) => l.cells.length);

  if (!withCells.length) return [];

  /* 3) 머리글을 찾는다 — 심평원 PDF는 머리글이 2~3줄로 쌓여 있다(순번/병원/일수 + 총진료비/혜택/내가낸).
        그래서 '짧은 줄'을 연달아 붙여 하나의 머리글로 보고, 열 이름이 가장 많이 걸리는 자리를 고른다. */
  const isDateCell = (t) => /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(t);
  const isDataish = (line) => line.cells.some((c) => isDateCell(c.text)) || line.cells.filter((c) => /^[\d,.()\s-]+$/.test(c.text)).length >= 2;
  const boundsOf = (cells) =>
    cells.map((c, i) => {
      const prev = cells[i - 1];
      const next = cells[i + 1];
      const left = prev ? (prev.x1 + c.x0) / 2 : c.x0 - mh * 2;
      const right = next ? (c.x1 + next.x0) / 2 : c.x1 + 2000;
      return { left, right, name: c.text };
    });
  const rowOf = (line, bounds) => {
    const cells = bounds.map(() => []);
    for (const c of line.cells) {
      const center = (c.x0 + c.x1) / 2;
      let idx = bounds.findIndex((b) => center >= b.left && center < b.right);
      if (idx < 0) idx = center < bounds[0].left ? 0 : bounds.length - 1;
      cells[idx].push(c.text);
    }
    return cells.map((parts) => parts.join(" ").trim());
  };

  /* 열 이름이 글자 단위로 쪼개져 온 경우('총'+'진료비', '내가'+'낸'+'의료비')를 붙인다.
     붙였을 때 알려진 열 이름이 되거나 그 앞부분이 될 때만 붙인다 — '투여횟수'+'투약일수'는 붙이지 않는다. */
  const aliasStarts = (t) => {
    if (!t) return false;
    for (const list of Object.values(FIELDS)) for (const a of list) if (a.startsWith(t) || t === a) return true;
    return false;
  };
  const joinHeaderCells = (cellsIn) => {
    const out = cellsIn.slice().sort((a, b) => a.x0 - b.x0);
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < out.length - 1; i++) {
        const joined = `${out[i].text}${out[i + 1].text}`.replace(/\s+/g, "");
        if (aliasStarts(norm(joined)) && joined.length <= 12) {
          out[i] = {
            text: `${out[i].text} ${out[i + 1].text}`.trim(),
            x0: Math.min(out[i].x0, out[i + 1].x0),
            x1: Math.max(out[i].x1, out[i + 1].x1),
          };
          out.splice(i + 1, 1);
          merged = true;
          break;
        }
      }
    }
    return out;
  };

  /* 머리글 후보 — 첫 줄의 열 이름을 기준으로 삼고, 아래 줄에서 그 열에 걸리지 않는 칸만 새 열로 더한다.
     (심평원 PDF는 '총 진료비 / (건강보험 적용분)'처럼 열 이름과 단위가 두 줄로 쌓여 있고,
      접힌 자료 글자가 아래 줄에 섞여 오기도 한다. 기준 열에 걸리는 아래 칸은 이름을 흐리므로 버린다.) */
  const stackable = (line) => {
    if (isDataish(line) || line.cells.length > 6) return false;
    if (line.cells.some((c) => c.text.length > 24)) return false;
    if (line.cells.some((c) => matchField(c.text))) return true;
    return line.cells.every((c) => c.text.length <= 12 && !/\d/.test(c.text));
  };
  let bestHead = null;
  withCells.forEach((line, i) => {
    if (isDataish(line)) return;
    let end = i;
    const cells = joinHeaderCells(line.cells.slice());
    for (let k = 1; k <= 2 && withCells[i + k]; k++) {
      const nx = withCells[i + k];
      if (!stackable(nx) || nx.cy - withCells[end].cy > mh * 2.2) break;
      for (const c of nx.cells) {
        const center = (c.x0 + c.x1) / 2;
        if (cells.some((b) => center >= b.x0 - 2 && center <= b.x1 + 2)) continue;
        cells.push({ ...c });
      }
      end = i + k;
    }
    cells.sort((a, b) => a.x0 - b.x0);
    const hits = cells.filter((c) => matchField(c.text)).length;
    if (hits >= 3 && (!bestHead || hits > bestHead.hits)) bestHead = { i, end, cells, hits };
  });

  if (!bestHead) {
    /* 머리글을 못 찾으면 줄마다 칸만 나눠 둔다(사람이 보고 판단할 수 있게) */
    return withCells.map((l) => l.cells.map((c) => c.text));
  }

  const bounds = boundsOf(bestHead.cells);
  const rows = [bestHead.cells.map((c) => c.text)];
  const headerBottom = withCells[bestHead.end].cy + mh * 0.6;
  const colOf = (w) => {
    const center = (w.x0 + w.x1) / 2;
    let idx = bounds.findIndex((b) => center >= b.left && center < b.right);
    return idx < 0 ? (center < bounds[0].left ? 0 : bounds.length - 1) : idx;
  };

  /* 4) 줄 앵커로 행을 나눈다 — '순번' 열의 y를 행의 기준으로 삼는다.
     한 칸이 여러 줄로 접혀도(진료내역·약품명) 같은 행으로 모이고, 줄 높이가 달라도 어긋나지 않는다. */
  const seqCol = bounds.findIndex((b) => /순번|번호/.test(b.name || ""));
  let anchors = [];
  if (seqCol >= 0) {
    anchors = items
      .filter((w) => w.cy > headerBottom && colOf(w) === seqCol && /^\d{1,4}$/.test(String(w.t).trim()))
      .map((w) => w.cy)
      .sort((a, b) => a - b);
  }
  if (anchors.length >= 2) {
    const below = items.filter((w) => w.cy > headerBottom);
    for (let k = 0; k < anchors.length; k++) {
      /* 행 경계는 이웃한 순번의 가운데 — 칸이 위아래로 접혀도(약품명 3줄) 같은 행에 모인다. */
      const gap = k + 1 < anchors.length ? (anchors[k + 1] - anchors[k]) / 2 : mh * 3;
      const prevGap = k > 0 ? (anchors[k] - anchors[k - 1]) / 2 : gap;
      const top = anchors[k] - prevGap;
      const bottom = anchors[k] + gap;
      const inBand = below.filter((x) => x.cy >= top && x.cy < bottom);
      /* 한 칸이 두 줄로 접히거나(진료내역·약품명) 칸 폭보다 긴 글자가 가운데로 넘쳐도 같은 칸에 모이도록
         '글자 묶음(run)'을 만들어 그 가운데 x로 열을 정한다. 글자 하나씩 나누면 '에피나온정'의 '에'가 옆 칸으로 샌다. */
      const visLines = [];
      for (const w of inBand.slice().sort((a, b) => a.cy - b.cy || a.x0 - b.x0)) {
        let line = visLines.find((l) => Math.abs(l.cy - w.cy) <= mh * 0.45);
        if (!line) {
          line = { cy: w.cy, ws: [] };
          visLines.push(line);
        }
        line.ws.push(w);
      }
      const cellsByCol = bounds.map(() => []);
      for (const line of visLines.sort((a, b) => a.cy - b.cy)) {
        const runs = [];
        let cur = null;
        for (const w of line.ws.sort((a, b) => a.x0 - b.x0)) {
          if (cur && w.x0 - cur.x1 <= mh * 0.3 && w.x0 - cur.x1 > -0.6) {
            cur.text += (w.x0 - cur.x1 > mh * 0.12 ? " " : "") + w.t;
            cur.x1 = Math.max(cur.x1, w.x1);
            continue;
          }
          cur = { text: String(w.t), x0: w.x0, x1: w.x1 };
          runs.push(cur);
        }
        for (const r of runs) {
          /* 칸과 겹치는 폭이 가장 큰 열로 넣는다 — 칸보다 긴 이름(긴 병원명·약품명)이 가운데로 넘쳐도
             왼쪽 끝이 걸친 열을 놓치지 않는다(가운데 x만 보면 옆 열로 샌다). */
          const center = (r.x0 + r.x1) / 2;
          let ci = 0;
          let bestD = Infinity;
          let bestOverlap = 0;
          bounds.forEach((b, i) => {
            const ov = Math.min(b.right, r.x1) - Math.max(b.left, r.x0);
            if (ov > bestOverlap) {
              bestOverlap = ov;
              ci = i;
            }
            const d = center < b.left ? b.left - center : center > b.right ? center - b.right : 0;
            if (d < bestD) bestD = d;
          });
          if (!bestOverlap) {
            let d2 = Infinity;
            bounds.forEach((b, i) => {
              const d = center < b.left ? b.left - center : center > b.right ? center - b.right : 0;
              if (d < d2) {
                d2 = d;
                ci = i;
              }
            });
          }
          /* '외래'·'처방조제' 같은 진료 구분 값이 옆 칸으로 새지 않게 그 열로 고정한다. */
          if (/^(외래|처방조제|입원|조제|약국|의원)$/.test(r.text.trim())) {
            const vi = bounds.findIndex((b) => matchField(b.name || "") === "visit");
            if (vi >= 0) ci = vi;
          }
          cellsByCol[ci].push(r.text.trim());
        }
      }
      const row = cellsByCol.map((parts) => parts.filter(Boolean).join("").replace(/\s+/g, " ").trim());
      if (row.some(Boolean)) rows.push(row);
    }
    return rows;
  }

  /* 5) '순번' 열이 없는 표 — 줄 단위로 칸을 채운다. */
  for (const line of withCells.slice(bestHead.end + 1)) {
    const cells = rowOf(line, bounds);
    if (!cells.some(Boolean)) continue;
    if (cells.filter((t) => matchField(t)).length >= 3) continue;   // 다음 장에 되풀이된 머리글 줄
    rows.push(cells);
  }
  return rows;
}

/**
 * PDF·텍스트에서 온 줄을 표로 바꾼다.
 * 탭(\t)이 칸 구분자다. 탭이 없으면 공백 2칸 이상도 칸으로 본다.
 */
export function parseTablesFromLines(name, lines) {
  const rows = (lines || [])
    .map((line) => String(line || "").replace(/\u00a0/g, " "))
    .filter((line) => line.trim())
    .map((line) => (line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/)).map((c) => c.trim()));
  return [{ name: name || "PDF", rows }];
}

function cleanCell(v) {
  return String(v == null ? "" : v).replace(/[\u00a0]/g, " ").trim();
}

function guessSource(map) {
  if (map.drug != null || (map.supply != null && map.item == null && map.category == null)) return "rx";
  if (map.category != null || map.item != null) return "detail";
  return "basic";
}

/* 수술 판정은 코드명(item)으로 한다. 진료내역(category)의 "처치 및 수술"은 처치(치석제거 등)도 함께 담아
   그것만으로 세면 수술이 부풀려진다. */
const SURGERY_ITEM_RE = /(수술|절제술|적출술|정복술|고정술|봉합술|성형술|이식술|절개술|소작술|색전술|확장술|절단술|천자술|배액술|결찰술|제거술|교정술|유리술|문합술|골절정복)/;
const ANES_RE = /(마취)/;
const INPATIENT_RE = /(입원)/;
const OUTPATIENT_RE = /(외래|통원|내원)/;
const RX_RE = /(투약|처방|조제)/;

function parseAmount(v) {
  const s = cleanCell(v);
  if (!s) return 0;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/**
 * 표 하나 → 레코드 배열. 머리글을 못 찾으면 `{ name, rows: 0, failed: true }`.
 */
export function tableToRecords(table) {
  const rows = (table.rows || []).map((r) => (Array.isArray(r) ? r : [r]));
  let headerAt = -1;
  let header = null;
  let best = { hits: 0 };
  const limit = Math.min(rows.length, 60);
  for (let i = 0; i < limit; i++) {
    const { map, hits } = mapHeader(rows[i]);
    const usable = map.date != null || (map.hospital != null && (map.days != null || map.amount != null || map.selfPay != null));
    if (hits >= 3 && usable) {
      const scored = { map, hits, i };
      if (hits > best.hits) {
        best = scored;
        headerAt = i;
        header = map;
      }
    }
  }
  if (headerAt < 0) return { name: table.name, records: [], failed: true, rows: rows.length };

  const records = [];
  let activeHeader = header;
  for (let i = headerAt + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells || !cells.length) continue;
    /* PDF 한 장이나 엑셀 한 시트에 표가 여러 개 이어질 때 — 새 머리글을 만나면 그 표의 열로 바꾼다. */
    if (isHeaderRow(cells)) {
      const next = mapHeader(cells);
      if (next.map.date != null) activeHeader = next.map;
      continue;
    }
    const at = (f) => (activeHeader[f] != null ? cleanCell(cells[activeHeader[f]]) : "");
    const rawDate = at("date");
    const date = normalizeDate(rawDate);
    const hospital = at("hospital");
    const dept = at("dept");
    const code = at("code").replace(/\s+/g, "").toUpperCase();
    const name = at("name");
    const visit = at("visit");
    const daysRaw = at("days");
    const category = at("category");
    const item = at("item");
    /* 같은 줄에 붙어 나온 진료 구분 값('처방조제'·'외래')이 약품명에 섞이면 이름이 망가진다 — 약 이름에서만 지운다. */
    const stripVisit = (v) => v.replace(/(처방조제|외래|입원)/g, "").replace(/\s+/g, " ").trim();
    const drug = stripVisit(at("drug") || (guessSource(activeHeader) === "rx" ? item : ""));
    const ingredient = at("ingredient");
    /* 날짜 열이 있는 표에서 날짜가 빈 줄은 칸이 여러 줄로 접힌 조각이다(값이 겹쳐 세지 않게 버린다). */
    if (!date && activeHeader.date != null) continue;
    if (!date && !hospital && !drug && !item && !name) continue;
    if (!hospital && !drug && !item && !name) continue;   // 자료 생성 시각·쪽번호만 있는 줄
    /* 되풀이된 머리글 줄·안내문 줄 — 병원 칸이 열 이름 그대로이거나, 값이 하나도 없는 줄은 버린다. */
    if (hospital && FIELDS.hospital.some((a) => norm(a) === norm(hospital))) continue;
    const supply = at("supply");
    const amount = parseAmount(at("amount"));
    const selfPay = parseAmount(at("selfPay"));
    const source = guessSource(activeHeader);
    const label = [category, item, drug].filter(Boolean).join(" ");
    /* 심평원 PDF는 '입원(외래)일수'를 0(18) 처럼 적는다 — 앞이 입원일수, 괄호가 외래 횟수다. */
    const dm = /^(\d+)\s*\(\s*(\d+)\s*\)$/.exec(daysRaw.replace(/\s/g, ""));
    const inpatientDays = dm ? Number(dm[1]) : /^\d+$/.test(daysRaw.replace(/[^\d]/g, "")) ? Number(daysRaw.replace(/[^\d]/g, "")) : 0;
    const visits = dm ? Number(dm[2]) : 0;
    /* 날짜가 없는 표(기본진료 PDF)는 금액·일수·횟수 중 하나라도 있어야 진료 줄로 본다(안내문·쪽번호 걸러내기). */
    if (!date && !inpatientDays && !visits && !amount && !selfPay) continue;
    records.push({
      source,
      date,
      hospital,
      dept,
      code,
      name: name || (source === "rx" ? drug : ""),
      visit,
      inpatient: INPATIENT_RE.test(visit) || inpatientDays > 0 || INPATIENT_RE.test(category),
      visits,
      ingredient,
      outpatient: OUTPATIENT_RE.test(visit),
      inpatientDays,
      category,
      item,
      drug,
      supplyDays: /^\d+$/.test(supply.replace(/[^\d]/g, "")) ? Number(supply.replace(/[^\d]/g, "")) : 0,
      isSurgery: SURGERY_ITEM_RE.test(item || "") && !/마취/.test(item || ""),
      isAnesthesia: ANES_RE.test(label),
      amount,
      selfPay,
      isRx: Boolean(drug),
      raw: { date: rawDate, visit, category, item, drug, supply },
    });
  }
  return { name: table.name, records, failed: false, rows: rows.length, header: headerAt };
}

/* ────────────────────────────── 약 분류 ────────────────────────────── */

const DRUG_GROUPS = [
  {
    key: "bp",
    label: "혈압약",
    short: "고혈압",
    words: ["암로디핀", "노르바스크", "노바스크", "아모잘탄", "로자탄", "로사르탄", "발사르탄", "올메사르탄", "올메텍", "텔미사르탄", "미카르디스", "이르베사르탄", "이베사르탄", "칸데사르탄", "아타칸", "니페디핀", "아달라트", "펠로디핀", "딜티아젬", "헤르벤", "카르베딜롤", "아테놀롤", "비소프롤롤", "메토프롤롤", "라베탈롤", "히드로클로로티아지드", "하이드로클로로티아지드", "인다파미드", "클로르탈리돈", "스피로놀락톤", "알리스키렌", "라실레", "amlodipine", "losartan", "valsartan", "olmesartan", "telmisartan", "irbesartan", "candesartan", "nifedipine", "diltiazem", "carvedilol", "bisoprolol", "hydrochlorothiazide"],
  },
  {
    key: "lipid",
    label: "고지혈증약",
    short: "고지혈",
    words: ["아토르바스타틴", "로수바스타틴", "심바스타틴", "프라바스타틴", "피타바스타틴", "리피토", "크레스토", "조코", "바이토린", "아토젯", "로제트", "리바로", "에제티미브", "페노피브레이트", "로수젯", "아토르바", "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "pitavastatin", "ezetimibe", "fenofibrate"],
  },
  {
    key: "dm",
    label: "당뇨약",
    short: "당뇨",
    words: ["메트포르민", "글리메피리드", "글리클라지드", "글리피지드", "다이아미크론", "아마릴", "자누비아", "시타글립틴", "빌다글립틴", "리나글립틴", "엠파글리플로진", "다파글리플로진", "포시가", "자디앙", "인슐린", "란투스", "노보래피드", "트라젠타", "액토스", "피오글리타존", "metformin", "gliclazide", "glimepiride", "sitagliptin", "vildagliptin", "linagliptin", "empagliflozin", "dapagliflozin", "insulin"],
  },
];

export function drugGroup(name) {
  const s = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (!s) return null;
  for (const g of DRUG_GROUPS) {
    for (const w of g.words) {
      if (s.includes(w.toLowerCase())) return g;
    }
  }
  return null;
}

/* ────────────────────────────── 병명 분류 ────────────────────────────── */

const TEN_DISEASES = [
  { key: "암", codes: [/^C\d/i], names: /(암|악성신생물|림프종|골수종|육종|상피내암|중피종)/ },
  { key: "백혈병", codes: [/^C9[0-5]/i], names: /(백혈병)/ },
  { key: "고혈압", codes: [/^I1[0-5]/i], names: /(고혈압)/ },
  { key: "협심증·심근경색", codes: [/^I2[0-5]/i], names: /(협심증|심근경색)/ },
  { key: "심장판막증", codes: [/^I0[5-8]|^I3[4-9]/i], names: /(판막)/ },
  { key: "간경화증", codes: [/^K7[0-4]/i], names: /(간경화|간섬유화)/ },
  { key: "뇌졸중", codes: [/^I6\d|^G45/i], names: /(뇌졸중|뇌경색|뇌출혈|지주막하|뇌혈전|일과성허혈)/ },
  { key: "당뇨병", codes: [/^E1[0-4]/i], names: /(당뇨)/ },
  { key: "에이즈", codes: [/^B2[0-4]/i], names: /(에이즈|인간면역결핍)/ },
];

const NOTABLE = [
  { key: "고지혈증", codes: [/^E78/i], names: /(고지혈|이상지질)/ },
  { key: "심부전·부정맥", codes: [/^I4[4-9]|^I5[0-2]/i], names: /(심부전|부정맥|심방세동)/ },
  { key: "간질환", codes: [/^K7[5-7]|^B18/i], names: /(간염|지방간|간질환)/ },
  { key: "만성신장병", codes: [/^N1[89]/i], names: /(신부전|신장병|콩팥)/ },
  { key: "결핵", codes: [/^A1[5-9]/i], names: /(결핵)/ },
  { key: "갑상선", codes: [/^E0[0-7]/i], names: /(갑상선)/ },
  { key: "천식·COPD", codes: [/^J4[4-6]/i], names: /(천식|만성폐쇄|copd)/i },
  { key: "정신·신경", codes: [/^F\d|^G4[0-3]/i], names: /(우울|불안|조현|간질|뇌전증|공황)/ },
  { key: "골절·탈구", codes: [/^S\d|^T\d/i], names: /(골절|탈구)/ },
];

function diseaseTags(rec) {
  const code = (rec.code || "").toUpperCase();
  const name = rec.name || "";
  const tags = [];
  for (const d of TEN_DISEASES) {
    const hit = (code && d.codes.some((re) => re.test(code))) || (name && d.names.test(name));
    if (hit) tags.push({ key: d.key, ten: true });
  }
  for (const d of NOTABLE) {
    const hit = (code && d.codes.some((re) => re.test(code))) || (name && d.names.test(name));
    if (hit) tags.push({ key: d.key, ten: false });
  }
  // 중복 키 제거
  const seen = new Set();
  return tags.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));
}

/* ────────────────────────────── 분석 ────────────────────────────── */

const within = (date, baseISO, days) => date && daysBetween(date, baseISO) >= 0 && daysBetween(date, baseISO) <= days;

function dedupeEvents(list, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function evidenceLine(rec, baseISO, extra) {
  const parts = [dotDate(rec.date), rec.hospital || "", rec.dept || ""];
  const disease = [rec.code, rec.name].filter(Boolean).join(" ");
  if (disease) parts.push(disease);
  if (extra) parts.push(extra);
  else if (rec.visit) parts.push(rec.visit);
  const agoText = ago(rec.date, baseISO);
  return parts.filter(Boolean).join(" / ") + (agoText ? ` (${agoText})` : "");
}

/**
 * @param {{name:string, rows:any[][]}[]} tables
 * @param {{baseDate?:string}} options
 */
export function analyze(tables, options = {}) {
  const baseISO = options.baseDate || todayISO();
  const parsed = (tables || []).map(tableToRecords);
  const records = parsed.flatMap((p) => p.records);
  const failed = parsed.filter((p) => p.failed).map((p) => p.name);
  const fileStats = parsed.map((p) => ({ name: p.name, rows: p.records.length, failed: !!p.failed }));

  const r5 = records.filter((r) => within(r.date, baseISO, 365 * 5));
  const r3mStart = isoAddDays(baseISO, -92);
  const basicAll = records.filter((r) => r.source === "basic");
  const basicFile = basicAll.length > 0;
  const basicUndated = basicAll.some((r) => !r.date);
  const hasDiseaseData = records.some((r) => r.code || (r.name && r.source !== "rx" && !r.item));

  /* 입원 — 같은 날 같은 병원은 한 건으로 센다. 기본진료 PDF는 날짜가 없고 '입원(외래)일수'만 있어
     그 값(앞 숫자)이 0보다 크면 입원으로 센다. 날짜가 없으면 '기간'은 셀 수 없다. */
  const inpatientRows = basicFile
    ? basicAll.filter((r) => r.inpatientDays > 0 || r.inpatient)
    : r5.filter((r) => r.inpatient || r.inpatientDays > 0);
  const admissions = dedupeEvents(inpatientRows, (r) => `${r.date}|${r.hospital}`).map((r) => ({
    rec: r,
    days: Math.max(
      1,
      ...inpatientRows.filter((x) => x.date === r.date && x.hospital === r.hospital).map((x) => x.inpatientDays || 0),
    ),
  }));
  const inpatientDays = admissions.reduce((a, b) => a + b.days, 0);

  /* 수술 — 세부진료 기준 */
  const surgeries = dedupeEvents(
    r5.filter((r) => r.isSurgery),
    (r) => `${r.date}|${r.hospital}|${r.item || r.name}`
  );
  const anesthesia = dedupeEvents(
    r5.filter((r) => r.isAnesthesia),
    (r) => `${r.date}|${r.hospital}|${r.item || r.name}`
  );

  /* 세부진료 없음 — 기본진료에만 있고 세부진료 기록이 없는 건(비급여 처방 후보).
     기본진료 PDF에는 날짜가 없으므로 병원 단위로 맞춘다(같은 병원의 세부진료가 한 줄도 없을 때). */
  const detailFile = parsed.some((p) => p.records.some((r) => r.source === "detail"));
  let noDetail = [];
  if (detailFile && basicFile) {
    if (basicUndated) {
      const detailHosp = new Set(records.filter((r) => r.source === "detail" && r.hospital).map((r) => r.hospital));
      noDetail = dedupeEvents(
        basicAll.filter((r) => r.hospital && !detailHosp.has(r.hospital)),
        (r) => r.hospital,
      );
    } else {
      const detailKeys = new Set(records.filter((r) => r.source === "detail").map((r) => `${r.date}|${r.hospital}`));
      noDetail = dedupeEvents(
        r5.filter((r) => r.source === "basic" && !detailKeys.has(`${r.date}|${r.hospital}`)),
        (r) => `${r.date}|${r.hospital}`,
      );
    }
  }
  const surgeryThreshold = Number(options.surgeryThreshold) || 0;
  const suspected = noDetail.filter((r) => surgeryThreshold > 0 && Math.max(r.amount, r.selfPay) >= surgeryThreshold);
  const noDetailCount = detailFile ? (surgeryThreshold > 0 ? suspected.length : noDetail.length) : null;

  /* 투약 — 처방조제 정보의 약품명만 센다. 같은 약이 '외래'(처방)와 '처방조제'(약국) 두 줄로 오므로
     날짜·약품명·투약일수가 같으면 한 번만 센다. */
  const rxSeen = new Set();
  const rxRows = [];
  for (const r of r5) {
    if (!r.drug || r.isSurgery || r.isAnesthesia) continue;
    const k = `${r.date}|${(r.drug || "").replace(/\s+/g, "")}|${r.supplyDays}`;
    if (rxSeen.has(k)) continue;
    rxSeen.add(k);
    rxRows.push(r);
  }
  const rxList = rxRows.map((r) => {
    const group = drugGroup(`${r.drug || ""} ${r.ingredient || ""}`);
    const days = Math.max(r.supplyDays || 0, 0);
    const end = days > 0 ? isoAddDays(r.date, days - 1) : r.date;
    return { ...r, group, days, end };
  });

  /* 3개월 이내 — 처방일이 3개월 안이거나, 3개월 전에 받았어도 복용이 아직 끝나지 않은 약 */
  const recent3m = rxList.filter((r) => {
    const startIn = daysBetween(r.date, baseISO) >= 0 && daysBetween(r.date, baseISO) <= 92;
    const ongoing = r.days > 0 && r.end >= r3mStart && daysBetween(r.date, baseISO) >= 0;
    return startIn || ongoing;
  });
  const recent3mVisits = dedupeEvents(
    r5.filter((r) => !r.isRx && daysBetween(r.date, baseISO) >= 0 && daysBetween(r.date, baseISO) <= 92),
    (r) => `${r.date}|${r.hospital}|${r.code || r.name}`
  );
  const recent3mAll = [...recent3mVisits, ...recent3m].sort((a, b) => b.date.localeCompare(a.date));

  /* 30일 이상 — 한 처방이 30일 이상이거나, 같은 약을 이어 받아 합이 30일 이상 */
  const courses = [];
  const byDrug = new Map();
  for (const r of rxList.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    const key = (r.drug || r.name || "").replace(/\s+/g, "").toLowerCase() || `${r.date}|${r.hospital}`;
    if (!byDrug.has(key)) byDrug.set(key, []);
    byDrug.get(key).push(r);
  }
  for (const list of byDrug.values()) {
    let cur = null;
    for (const r of list) {
      const span = r.days || 1;
      if (cur && daysBetween(cur.end, r.date) <= 31) {
        cur.end = isoAddDays(r.end, 0) > cur.end ? r.end : cur.end;
        cur.days += span;
        cur.recs.push(r);
      } else {
        cur = { drug: r.drug || r.name || r.item, group: r.group, start: r.date, end: r.end, days: span, recs: [r] };
        courses.push(cur);
      }
      if (daysBetween(r.date, r.end) > 0 && r.end > cur.end) cur.end = r.end;
    }
  }
  const longCourses = courses.filter((c) => c.days >= 30);

  /* 그 외 주요 약 — 혈압·고지혈·당뇨로 묶이지 않은 나머지 성분 */
  const otherDrugs = new Map();
  for (const r of rxList) {
    if (r.group) continue;
    const key = (r.drug || r.name || "").replace(/\s+/g, " ").trim();
    if (!key) continue;
    if (!otherDrugs.has(key)) otherDrugs.set(key, []);
    otherDrugs.get(key).push(r);
  }

  const bp = rxList.filter((r) => r.group?.key === "bp");
  const lipid = rxList.filter((r) => r.group?.key === "lipid");
  const dm = rxList.filter((r) => r.group?.key === "dm");

  /* 주의 병명 — 5년, 코드·병명 기준 분야 */
  const diseaseMap = new Map();
  for (const r of r5) {
    if (!r.name && !r.code) continue;
    const tags = diseaseTags(r);
    if (!tags.length) continue;
    const key = (r.code || r.name).toUpperCase();
    if (!diseaseMap.has(key)) diseaseMap.set(key, { rec: r, tags, count: 0 }, );
    const entry = diseaseMap.get(key);
    entry.count++;
    if (!entry.rec.name && r.name) entry.rec = r;
  }
  const warnKeys = new Set();
  for (const entry of diseaseMap.values()) for (const t of entry.tags) warnKeys.add(t.key);

  /* 같은 질병 7회 이상 통원 — 5년, 상병코드(없으면 병명) 기준 */
  const visitMap = new Map();
  for (const r of r5) {
    if (r.inpatient || r.inpatientDays > 0) continue;
    if (r.source === "rx" || r.drug) continue;          // 약품명은 병명이 아니다
    if (r.source === "detail" && !r.name && !r.code) continue;
    const key = (r.code || r.name || "").toUpperCase().replace(/\s+/g, "");
    if (!key) continue;
    if (!visitMap.has(key)) visitMap.set(key, { key, name: r.name, code: r.code, dates: new Set(), rec: r });
    visitMap.get(key).dates.add(r.date);
  }
  const frequent = [...visitMap.values()]
    .filter((v) => v.dates.size >= 7)
    .map((v) => ({ ...v, count: v.dates.size, dates: [...v.dates].sort() }))
    .sort((a, b) => b.count - a.count);

  /* 10대 질병 — 5년 */
  const tenHits = [];
  for (const entry of diseaseMap.values()) {
    for (const t of entry.tags) {
      if (t.ten && !tenHits.some((x) => x.key === t.key)) tenHits.push({ key: t.key, rec: entry.rec });
    }
  }

  /* 고지 문항 */
  const q3Rows = dedupeEvents(
    [...recent3mVisits, ...recent3m.map((r) => r)],
    (r) => `${r.date}|${r.hospital}|${r.code || r.drug || r.name}`
  ).sort((a, b) => b.date.localeCompare(a.date));
  const q1y = r5.filter((r) => /재검사|재촬영|추가검사|조직검사|재생검|추적검사/.test(`${r.category || ""} ${r.item || ""} ${r.name || ""}`));
  const q2y = dedupeEvents(
    r5.filter((r) => (r.inpatient || r.inpatientDays > 0 || r.isSurgery) && within(r.date, baseISO, 365 * 2)),
    (r) => `${r.date}|${r.hospital}|${r.isSurgery ? r.item || r.name : "입원"}`
  );
  const q5yLong = longCourses;
  const q5yTreat = dedupeEvents(
    r5.filter((r) => (r.inpatient || r.inpatientDays > 0) && within(r.date, baseISO, 365 * 5)),
    (r) => `${r.date}|${r.hospital}`
  );
  const computed = {
    q3m: { hit: q3Rows.length > 0, count: q3Rows.length, rows: q3Rows.slice(0, 30) },
    q1y: { hit: q1y.length > 0, count: q1y.length, rows: q1y.slice(0, 20), unsure: q1y.length === 0 },
    q2y: { hit: q2y.length > 0, count: q2y.length, rows: q2y.slice(0, 30) },
    q5y: { hit: q5yLong.length > 0 || q5yTreat.length > 0, count: q5yLong.length + q5yTreat.length, rows: [...q5yTreat.slice(0, 20), ...q5yLong.slice(0, 10)] },
    q10: { hit: tenHits.length > 0, count: tenHits.length, rows: tenHits, unsure: !hasDiseaseData },
  };
  const questionHits = Object.values(computed).filter((q) => q.hit).length;
  const questionUnsure = (computed.q1y.unsure ? 1 : 0) + (computed.q10.unsure ? 1 : 0);

  /* 요약 카드 */
  const cards = [
    {
      key: "inpatient",
      label: "입원",
      value: basicFile ? admissions.length : "확인 불가",
      unit: basicFile ? "건" : "",
      sub: basicFile ? `총 ${inpatientDays}일` : "기본진료 파일이 있으면 셉니다",
      tone: admissions.length ? "rose" : "jade",
    },
    { key: "surgery", label: "수술 확인", value: surgeries.length, unit: "건", sub: "세부진료 기준", tone: surgeries.length ? "rose" : "jade" },
    { key: "anesthesia", label: "마취 있음 (수술·시술 의심)", value: anesthesia.length, unit: "건", sub: "세부진료 마취 기록", tone: anesthesia.length ? "rose" : "jade" },
    {
      key: "noDetail",
      label: "세부진료 없음",
      value: noDetailCount == null ? "확인 불가" : noDetailCount,
      unit: noDetailCount == null ? "" : "건",
      sub:
        noDetailCount == null
          ? "세부진료 파일을 올리면 셉니다"
          : surgeryThreshold > 0
            ? `본인부담 ${surgeryThreshold.toLocaleString("ko-KR")}원 이상 후보`
            : "비급여 처방 후보",
      tone: noDetailCount ? "amber" : "jade",
    },
    {
      key: "bpLipidDm",
      label: "혈압·고지혈·당뇨 약",
      value: [bp.length ? "혈압" : "", lipid.length ? "고지혈" : "", dm.length ? "당뇨" : ""].filter(Boolean).join("·") || "없음",
      unit: "",
      sub: bp.length || lipid.length || dm.length ? "복용 중인 약 기준" : "해당 약 없음",
      tone: bp.length || lipid.length || dm.length ? "rose" : "jade",
    },
    { key: "recent3m", label: "3개월 이내 처방·투약", value: recent3m.length, unit: "건", sub: "처방조제 기준", tone: recent3m.length ? "rose" : "jade" },
    { key: "long30", label: "30일 이상 연속 투약", value: longCourses.length, unit: "건", sub: "5년 내", tone: longCourses.length ? "rose" : "jade" },
    { key: "otherDrugs", label: "그 외 주요 약", value: otherDrugs.size, unit: "성분", sub: "5년 내", tone: "amber" },
    {
      key: "warnDisease",
      label: "주의 병명",
      value: hasDiseaseData ? warnKeys.size : "확인 불가",
      unit: hasDiseaseData ? "분야" : "",
      sub: hasDiseaseData ? "5년 내" : "자료에 상병명이 없습니다",
      tone: warnKeys.size ? "amber" : "jade",
    },
    {
      key: "frequent",
      label: "같은 질병 7회 이상 통원",
      value: hasDiseaseData ? frequent.length : "확인 불가",
      unit: hasDiseaseData ? "건" : "",
      sub: hasDiseaseData ? "5년 내" : "자료에 상병명이 없습니다",
      tone: frequent.length ? "rown" : "jade",
    },
    { key: "questions", label: "고지 문항", value: `${questionHits}개 해당`, unit: "", sub: questionUnsure ? `${questionUnsure}개 확인 필요` : "3개월·1년·2년·5년 기준", tone: questionHits ? "rose" : "jade" },
  ];

  return {
    baseDate: baseISO,
    customer: options.customer || "",
    birth: options.birth || "",
    reviewType: options.reviewType || "일반심사(표준 계약 전 알릴 의무)",
    surgeryThreshold,
    totalThreshold: Number(options.totalThreshold) || 0,
    files: fileStats,
    failedFiles: failed,
    records,
    basicFile,
    basicUndated,
    hasDiseaseData,
    counts: {
      admissions: admissions.length,
      inpatientDays,
      surgeries: surgeries.length,
      anesthesia: anesthesia.length,
      noDetail: noDetail.length,
      noDetailCount,
      detailFile,
      suspected: suspected.length,
      recent3m: recent3m.length,
      longCourses: longCourses.length,
      otherDrugs: otherDrugs.size,
      warnKeys: warnKeys.size,
      frequent: frequent.length,
      ten: tenHits.length,
    },
    admissions,
    surgeries,
    anesthesia,
    noDetail,
    suspected,
    detailFile,
    recent3m,
    recent3mAll,
    longCourses,
    courses,
    rxList,
    otherDrugs: [...otherDrugs.entries()].map(([name, rows]) => ({ name, rows })),
    groups: { bp, lipid, dm },
    diseaseMap: [...diseaseMap.values()],
    warnKeys: [...warnKeys],
    tenHits,
    frequent,
    questions: computed,
    questionHits,
    questionUnsure,
    cards,
  };
}

/* ────────────────────────────── 문자열 출력 ────────────────────────────── */

export const SECTIONS = [
  { key: "inpatient", label: "입원" },
  { key: "surgery", label: "수술" },
  { key: "recent3m", label: "3개월 이내 진료·투약" },
  { key: "meds", label: "투약(혈압·고지혈·당뇨)" },
  { key: "notable", label: "주의 병명" },
  { key: "frequent", label: "7회 이상 통원" },
  { key: "q", label: "고지 문항" },
];

function lineFor(rec, baseISO, extra) {
  return evidenceLine(rec, baseISO, extra);
}

export function buildSummary(result, sections) {
  const on = new Set(sections && sections.length ? sections : SECTIONS.map((s) => s.key));
  const base = result.baseDate;
  const out = [];
  const head = [result.customer ? `고객: ${result.customer}` : "", result.birth ? `생년월일: ${dotDate(result.birth)}` : "", `기준일: ${dotDate(base)}`, result.reviewType ? `심사 유형: ${result.reviewType}` : ""].filter(Boolean);
  if (head.length) out.push(head.join("\n"), "");

  if (on.has("inpatient") && !result.basicFile && false) {
    /* 기본진료 파일이 없으면 입원은 셀 수 없다 — 아래 안내로 남긴다. */
  }
  if (on.has("inpatient") && result.admissions.length) {
    out.push("[입원]");
    for (const a of result.admissions.slice().sort((x, y) => y.rec.date.localeCompare(x.rec.date))) {
      const parts = [dotDate(a.rec.date), a.rec.hospital || "", a.rec.dept || "", [a.rec.code, a.rec.name].filter(Boolean).join(" ")].filter(Boolean);
      out.push(`- ${parts.join(" / ")} / 입원 ${a.days}일 (${ago(a.rec.date, base)})`);
    }
    out.push("");
  }
  if (on.has("surgery") && result.surgeries.length) {
    out.push("[수술]");
    for (const r of result.surgeries.slice().sort((x, y) => y.date.localeCompare(x.date))) {
      out.push(`- ${lineFor(r, base, r.item || r.category || "수술")}`);
    }
    if (result.anesthesia.length) {
      out.push(`- 마취 기록 ${result.anesthesia.length}건 (수술·시술 여부 확인 필요)`);
    }
    out.push("");
  }
  if (on.has("recent3m") && result.recent3mAll.length) {
    out.push("[3개월 이내 진료·투약]");
    for (const r of result.recent3mAll.slice(0, 40)) {
      const extra = r.drug ? `${r.drug}${r.days ? ` ${r.days}일분` : ""}` : "";
      out.push(`- ${lineFor(r, base, extra)}`);
    }
    out.push("");
  }
  if (on.has("meds")) {
    const g = result.groups;
    const has = g.bp.length || g.lipid.length || g.dm.length;
    out.push("[투약]");
    out.push(`- 고혈압: ${g.bp.length ? `있음 (${g.bp[0].drug || g.bp[0].name})` : "없음"}`);
    out.push(`- 고지혈: ${g.lipid.length ? `있음 (${g.lipid[0].drug || g.lipid[0].name})` : "없음"}`);
    out.push(`- 당뇨: ${g.dm.length ? `있음 (${g.dm[0].drug || g.dm[0].name})` : "없음"}`);
    if (!has) out.push("- 혈압·고지혈·당뇨 약에 해당하는 처방 없음");
    out.push("");
  }
  if (on.has("notable") && result.warnKeys.length) {
    out.push("[주의 병명]");
    out.push(`- ${result.warnKeys.join(", ")} (5년 내 진료 기록 기준)`);
    out.push("");
  } else if (on.has("notable") && !result.hasDiseaseData) {
    out.push("[주의 병명]");
    out.push("- 올린 자료에 상병명이 없어 확인하지 못했습니다 (심평원 자료에 상병명이 포함된 파일이 필요합니다)");
    out.push("");
  }
  if (on.has("frequent") && result.frequent.length) {
    out.push("[같은 질병 7회 이상 통원]");
    for (const f of result.frequent) {
      out.push(`- ${f.code ? f.code + " " : ""}${f.name || ""} / ${f.count}회 (${dotDate(f.dates[0])}~${dotDate(f.dates[f.dates.length - 1])})`);
    }
    out.push("");
  }
  if (on.has("q")) {
    out.push("[고지 문항]");
    const q = result.questions;
    out.push(`- ① 최근 3개월 이내 진찰·검사·치료·입원·수술·투약: ${q.q3m.hit ? `해당 ${q.q3m.count}건` : "해당 없음"}`);
    out.push(`- ② 최근 1년 이내 재검사·추가검사 소견: ${q.q1y.hit ? `해당 ${q.q1y.count}건` : "기록에서 확인되지 않음(직접 확인 필요)"}`);
    out.push(`- ③ 최근 2년 이내 입원·수술: ${q.q2y.hit ? `해당 ${q.q2y.count}건` : "해당 없음"}`);
    out.push(`- ④ 최근 5년 이내 7일 이상 치료·30일 이상 투약: ${q.q5y.hit ? `해당 ${q.q5y.count}건` : "해당 없음"}`);
    out.push(
      `- ⑤ 최근 5년 이내 10대 질병 진단·치료: ${
        q.q10.hit ? `해당 ${q.q10.count}건 (${result.tenHits.map((t) => t.key).join(", ")})` : q.q10.unsure ? "확인 불가 (자료에 상병명 없음)" : "해당 없음"
      }`,
    );
    out.push("");
  }
  if (result.basicUndated) out.push("※ 기본진료 파일에는 진료일자가 없어, 기간별(3개월·1년·2년·5년) 판정은 세부진료·처방조제 파일의 날짜로 했습니다.");
  if (!out.length) out.push("정리할 항목이 없습니다. 올린 파일과 기준일을 확인해 주세요.");
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export function buildCustomerMessage(result, options = {}) {
  const name = (result.customer || "").trim();
  const who = name ? `${name}님` : "고객님";
  const q = result.questions;
  const big = [];
  if (result.admissions.length) big.push(`입원 ${result.admissions.length}건(총 ${result.counts.inpatientDays}일)`);
  if (result.surgeries.length) big.push(`수술 ${result.surgeries.length}건`);
  if (result.longCourses.length) big.push(`30일 이상 투약 ${result.longCourses.length}건`);
  if (result.recent3m.length) big.push(`3개월 이내 투약 ${result.recent3m.length}건`);

  const lines = [];
  lines.push(`${who}, 보험 청약 전에 확인할 진료 이력을 정리해 봤어요.`);
  lines.push("");
  if (big.length) {
    lines.push(`최근 5년 기록에서 ${big.join(", ")}이 확인됩니다.`);
  } else {
    lines.push("최근 5년 기록에서 입원·수술·장기 투약은 확인되지 않았습니다.");
  }
  const hitLabels = [];
  if (q.q3m.hit) hitLabels.push("3개월 이내 진료·투약");
  if (q.q2y.hit) hitLabels.push("2년 이내 입원·수술");
  if (q.q5y.hit) hitLabels.push("5년 이내 7일 이상 치료·30일 이상 투약");
  if (q.q10.hit) hitLabels.push("5년 이내 10대 질병");
  lines.push("");
  if (hitLabels.length) {
    lines.push(`청약서에서 확인이 필요한 항목은 ${hitLabels.join(", ")}입니다.`);
  } else {
    lines.push("청약서 질문에 걸리는 항목은 확인되지 않았습니다.");
  }
  lines.push("1년 이내 재검사(추가검사) 소견은 자료에 남지 않는 경우가 있어, 직접 한 번만 확인해 주세요.");
  lines.push("");
  lines.push("가져오실 서류는 진단서 또는 진료확인서, 입퇴원확인서, 수술확인서, 처방전이나 약제비 영수증입니다. 있는 것만 챙겨 주세요.");
  lines.push("");
  lines.push("정리한 내용은 참고용이고, 최종 고지는 고객님 확인과 보험사 청약서 질문 기준을 따릅니다.");
  if (options.sender) lines.push(`문의는 ${options.sender}로 주세요.`);
  return lines.join("\n");
}

/* ────────────────────────────── HTML 레포트 ────────────────────────────── */

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CARD_ANCHOR = {
  inpatient: "s-inpatient",
  surgery: "s-surgery",
  anesthesia: "s-surgery",
  noDetail: "s-nodetail",
  bpLipidDm: "s-meds",
  recent3m: "s-recent",
  long30: "s-meds",
  otherDrugs: "s-meds",
  warnDisease: "s-notable",
  frequent: "s-frequent",
  questions: "s-questions",
};

export function buildReportHTML(result, options = {}) {
  const base = result.baseDate;
  const title = `${result.customer ? result.customer + " " : ""}심평원 고지 정리`;
  const q = result.questions;
  const cards = result.cards
    .map(
      (c) => `<a class="card t-${esc(c.tone)}" href="#${CARD_ANCHOR[c.key] || "s-questions"}">
      <span class="lbl">${esc(c.label)}</span>
      <strong>${esc(c.value)}${esc(c.unit || "")}</strong>
      <span class="sub">${esc(c.sub || "")}</span>
    </a>`
    )
    .join("");

  const list = (rows, fn) => (rows.length ? `<ul>${rows.map((r) => `<li>${fn(r)}</li>`).join("")}</ul>` : `<p class="none">기록 없음</p>`);

  const qBlock = (no, text, obj, extra) => `
    <details class="q" id="q${no}" ${obj.hit ? "open" : ""}>
      <summary><span class="qno">${no}</span><span class="qt">${esc(text)}</span><span class="badge ${obj.hit ? "on" : "off"}">${obj.hit ? `해당 ${obj.count}건` : "해당 없음"}</span></summary>
      ${extra ? `<p class="qnote">${esc(extra)}</p>` : ""}
      ${list(obj.rows || [], (r) => esc(lineFor(r, base)))}
    </details>`;

  const section = (id, titleText, inner) => `<section id="${id}"><h2>${esc(titleText)}</h2>${inner}</section>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{--ink:#0b1b29;--soft:#26333f;--muted:#3f4b57;--line:#dde3e8;--paper:#faf9f6;--brand:#1a4ffd;--jade:#1f7a62;--clay:#a85a3b;--amber:#8a6320}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.7 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all}
  .wrap{max-width:900px;margin:0 auto;padding:28px 18px 64px}
  header h1{font-size:26px;line-height:1.3;margin:0 0 6px;letter-spacing:-.03em}
  .meta{color:var(--muted);font-size:13.5px;margin:0}
  .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:22px 0 28px}
  @media(min-width:720px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
  .card{display:block;border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px;text-decoration:none;color:inherit}
  .card .lbl{display:block;font-size:12.5px;color:var(--muted)}
  .card strong{display:block;margin-top:4px;font-size:22px;letter-spacing:-.02em}
  .card .sub{display:block;font-size:12px;color:var(--muted)}
  .t-rose strong{color:var(--clay)}.t-jade strong{color:var(--jade)}.t-amber strong{color:var(--amber)}.t-rown strong{color:#8a3b52}
  section{border-top:1px solid var(--line);padding-top:18px;margin-top:26px;scroll-margin-top:16px}
  h2{font-size:16px;margin:0 0 10px;letter-spacing:-.02em}
  ul{margin:0;padding-left:18px}
  li{margin:4px 0;font-size:14px;color:var(--soft)}
  .none{color:var(--muted);font-size:13.5px;margin:0}
  .q{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px 14px;margin:8px 0}
  .q summary{cursor:pointer;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;list-style:none}
  .q summary::-webkit-details-marker{display:none}
  .qno{font-weight:700;color:var(--brand)}
  .qt{font-weight:600;font-size:14.5px;flex:1;min-width:180px}
  .badge{font-size:12px;border-radius:999px;padding:2px 9px;font-weight:700;color:#fff}
  .badge.on{background:var(--clay)}.badge.off{background:var(--jade)}
  .qnote{font-size:13px;color:var(--muted);margin:8px 0 4px}
  .note{border-left:2px solid var(--ink);background:#f2f0e8;padding:10px 12px;font-size:13px;color:var(--muted);margin-top:26px}
  .print{position:fixed;right:16px;bottom:16px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 16px;font:inherit;font-size:14px;cursor:pointer}
  @media print{.print{display:none}body{background:#fff}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${esc(title)}</h1>
  <p class="meta">기준일 ${esc(dotDate(base))}${result.birth ? ` · 생년월일 ${esc(dotDate(result.birth))}` : ""}${result.reviewType ? ` · ${esc(result.reviewType)}` : ""}</p>
  <p class="meta">올린 자료 ${result.files.length}개${result.failedFiles.length ? ` (읽지 못한 파일 ${result.failedFiles.length}개)` : ""}</p>
</header>
<nav class="cards">${cards}</nav>
${section("s-questions", "고지 문항", [
    qBlock(1, "최근 3개월 이내 진찰·검사로 질병 진단·질병의심소견·치료·입원·수술·투약을 받은 사실", q.q3m, "3개월 전에 처방받아 아직 복용 중인 약도 포함합니다."),
    qBlock(2, "최근 1년 이내 재검사(추가검사)를 받은 사실", q.q1y, "자료에 재검사 표기가 없으면 '해당 없음'이 아니라 '직접 확인'으로 봅니다."),
    qBlock(3, "최근 2년 이내 입원·수술을 받은 사실", q.q2y, ""),
    qBlock(4, "최근 5년 이내 7일 이상 치료 또는 30일 이상 약 복용", q.q5y, ""),
    qBlock(5, "최근 5년 이내 10대 질병 진단·치료", q.q10, "암, 백혈병, 고혈압, 협심증, 심근경색, 심장판막증, 간경화증, 뇌졸중, 당뇨병, 에이즈"),
  ].join(""))}
${section("s-inpatient", "입원", list(result.admissions, (a) => `${esc(lineFor(a.rec, base))} — 입원 ${a.days}일`))}
${section("s-surgery", "수술·마취", result.surgeries.length || result.anesthesia.length
    ? `${list(result.surgeries, (r) => esc(lineFor(r, base, r.item || r.category || "수술")))}${result.anesthesia.length ? `<p class="qnote">마취 기록 ${result.anesthesia.length}건은 수술·시술 여부를 함께 확인해 주세요.</p>` : ""}`
    : `<p class="none">세부진료 기준 수술 기록 없음</p>`)}
${section("s-nodetail", "세부진료 없음",
    !result.detailFile
      ? `<p class="none">세부진료 파일을 올리지 않아 세지 않았습니다.</p>`
      : result.noDetailCount
        ? `${list(result.suspected.length ? result.suspected : result.noDetail, (r) => esc(lineFor(r, base)))}<p class="qnote">기본진료에만 있는 진료입니다. 본인부담금이 기준을 넘는 건은 수술·시술 여부를 확인해 볼 만합니다.</p>`
        : `<p class="none">기본진료와 세부진료가 모두 있는 자료입니다.</p>`)}
${section("s-recent", "3개월 이내 진료·투약", list(result.recent3mAll, (r) => `${esc(lineFor(r, base, r.drug ? `${r.drug}${r.days ? ` ${r.days}일분` : ""}` : ""))}`))}
${section("s-meds", "투약", `
  <table style="width:100%;border-collapse:collapse;font-size:13.5px">
    <tr><th align="left">구분</th><th align="left">복용</th><th align="left">최근 처방</th></tr>
    <tr><td>혈압약</td><td>${result.groups.bp.length ? "있음" : "없음"}</td><td>${esc(result.groups.bp[0]?.drug || "-")}</td></tr>
    <tr><td>고지혈증약</td><td>${result.groups.lipid.length ? "있음" : "없음"}</td><td>${esc(result.groups.lipid[0]?.drug || "-")}</td></tr>
    <tr><td>당뇨약</td><td>${result.groups.dm.length ? "있음" : "없음"}</td><td>${esc(result.groups.dm[0]?.drug || "-")}</td></tr>
  </table>
  <h3 style="font-size:14px;margin:14px 0 6px">30일 이상 연속 투약</h3>
  ${list(result.longCourses, (c) => `${esc(c.drug)} — ${c.days}일 (${esc(dotDate(c.start))}~${esc(dotDate(c.end))})`)}
  <h3 style="font-size:14px;margin:14px 0 6px">그 외 주요 약</h3>
  ${list(result.otherDrugs, (d) => `${esc(d.name)} — ${d.rows.length}회`)}
`)}
${section("s-notable", "주의 병명 (5년)", result.warnKeys.length ? `<p style="margin:0 0 6px;font-size:14px">${esc(result.warnKeys.join(", "))}</p>${list(result.diseaseMap.filter((d) => d.tags.length).slice(0, 40), (d) => `${esc(lineFor(d.rec, base))}${d.count > 1 ? ` — ${d.count}회` : ""}`)}` : `<p class="none">기준에 걸리는 병명 없음</p>`)}
${section("s-frequent", "같은 질병 7회 이상 통원 (5년)", list(result.frequent, (f) => `${esc(f.code ? f.code + " " : "")}${esc(f.name || "")} — ${f.count}회 (${esc(dotDate(f.dates[0]))}~${esc(dotDate(f.dates[f.dates.length - 1]))})`))}
${section("s-files", "올린 자료", `<ul>${result.files.map((f) => `<li>${esc(f.name)} — ${f.failed ? "표 머리글을 읽지 못했습니다" : f.rows + "줄 인식"}</li>`).join("")}</ul>`)}
<p class="note">예시·참고용 정리 도구이며, 최종 고지 판단은 고객 본인 확인과 보험사 청약서 질문 기준을 따릅니다. 이 파일은 브라우저에서 만들었고 원본 자료는 어디에도 전송되지 않았습니다.</p>
</div>
<button class="print" onclick="window.print()">인쇄·PDF 저장</button>
</body>
</html>`;
}

/* ────────────────────────────── 예시 데이터 ────────────────────────────── */

/**
 * 예시 데이터 — 실제 심평원 '내 진료정보 열람' 내려받기와 같은 표 모양(머리글 이름)을 쓴다.
 * 날짜는 오늘을 기준으로 만들기 때문에 언제 열어도 '며칠 전' 표기가 자연스럽다.
 */
export function EXAMPLE_TABLES(baseISO) {
  const b = baseISO || todayISO();
  const d = (n) => dotDate(isoAddDays(b, -n));
  const H = {
    basic: ["진료일자", "의료기관명", "진료과목", "상병코드", "상병명", "내원구분", "입원일수", "총진료비", "본인부담금"],
    detail: ["진료일자", "의료기관명", "진료과목", "상병코드", "상병명", "분류", "명칭", "금액"],
    rx: ["처방일자", "의료기관명", "진료과목", "상병코드", "상병명", "약품명", "투약일수"],
  };
  const basic = [
    H.basic,
    [d(3), "튼튼내과의원", "내과", "E78.5", "상세불명의 고지혈증", "외래", 0, 62000, 18000],
    [d(3), "튼튼내과의원", "내과", "J06.9", "급성 상기도감염", "외래", 0, 41000, 12000],
    [d(8), "바른정형외과의원", "정형외과", "M51.1", "요추 추간판 장애", "외래", 0, 88000, 26000],
    [d(12), "온누리약국", "약국", "E78.5", "상세불명의 고지혈증", "외래", 0, 39000, 11000],
    [d(21), "서울대장항문외과", "외과", "K63.5", "대장 용종", "입원", 4, 2350000, 620000],
    [d(23), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 45000, 13000],
    [d(35), "바른피부과의원", "피부과", "L70.0", "여드름", "외래", 0, 55000, 22000],
    [d(48), "하나이비인후과의원", "이비인후과", "J30.1", "알레르기성 비염", "외래", 0, 38000, 11000],
    [d(63), "튼튼내과의원", "내과", "I10", "본태성 고혈압", "외래", 0, 47000, 14000],
    [d(88), "밝은안과의원", "안과", "H25.1", "노년성 백내장", "외래", 0, 76000, 24000],
    [d(104), "바른정형외과의원", "정형외과", "S82.6", "외측 복사뼈의 골절", "입원", 9, 3820000, 980000],
    [d(130), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 43000, 12500],
    [d(152), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 43000, 12500],
    [d(174), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 42000, 12000],
    [d(196), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 42000, 12000],
    [d(241), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 41000, 11800],
    [d(268), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "외래", 0, 41000, 11800],
    [d(402), "하나외과의원", "외과", "I84.2", "내치핵", "외래", 0, 64000, 19000],
    [d(455), "미소담내과", "내과", "K80.2", "담낭의 결석", "외래", 0, 51000, 16000],
    [d(520), "튼튼내과의원", "내과", "I25.1", "죽상경화성 심장질환", "외래", 0, 72000, 21000],
    [d(600), "튼튼내과의원", "내과", "E03.9", "상세불명의 갑상선기능저하증", "외래", 0, 54000, 16000],
    [d(720), "숨편한내과의원", "내과", "J45.9", "상세불명의 천식", "외래", 0, 61000, 18000],
    [d(980), "튼튼내과의원", "내과", "E78.5", "상세불명의 고지혈증", "외래", 0, 50000, 15000],
    [d(1180), "바른정형외과의원", "정형외과", "M17.9", "상세불명의 무릎관절증", "외래", 0, 67000, 20000],
  ];
  const detail = [
    H.detail,
    [d(104), "바른정형외과의원", "정형외과", "S82.6", "외측 복사뼈의 골절", "수술", "관혈적 정복술-외측 복사뼈", 1850000],
    [d(104), "바른정형외과의원", "정형외과", "S82.6", "외측 복사뼈의 골절", "입원료", "입원 9일", 620000],
    [d(21), "서울대장항문외과", "외과", "K63.5", "대장 용종", "수술", "내시경적 대장 용종절제술-폴립절제술", 890000],
    [d(88), "밝은안과의원", "안과", "H25.1", "노년성 백내장", "수술", "백내장 수술(초음파유화술)", 1620000],
    [d(402), "하나외과의원", "외과", "I84.2", "내치핵", "수술", "치핵 결찰술", 740000],
    [d(455), "미소담내과", "내과", "K80.2", "담낭의 결석", "수술", "내시경적 담낭 결석 제거술", 1180000],
    [d(3), "튼튼내과의원", "내과", "E78.5", "상세불명의 고지혈증", "검사", "지질검사(콜레스테롤)", 38000],
    [d(3), "튼튼내과의원", "내과", "J06.9", "급성 상기도감염", "처치", "수액주입", 26000],
    [d(8), "바른정형외과의원", "정형외과", "M51.1", "요추 추간판 장애", "검사", "요추 MRI", 420000],
    [d(21), "서울대장항문외과", "외과", "K63.5", "대장 용종", "마취", "수면 마취", 210000],
    [d(88), "밝은안과의원", "안과", "H25.1", "노년성 백내장", "마취", "국소 마취", 60000],
    [d(241), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "검사", "재검사(흉부 X선)", 32000],
  ];
  const rx = [
    H.rx,
    [d(3), "튼튼내과의원", "내과", "E78.5", "상세불명의 고지혈증", "로수바스타틴칼슘정 10mg", 90],
    [d(3), "튼튼내과의원", "내과", "J06.9", "급성 상기도감염", "아세트아미노펜정 500mg", 3],
    [d(63), "튼튼내과의원", "내과", "I10", "본태성 고혈압", "암로디핀베실레이트정 5mg", 60],
    [d(88), "밝은안과의원", "안과", "H25.1", "노년성 백내장", "플루오로메토론점안액", 14],
    [d(35), "바른피부과의원", "피부과", "L70.0", "여드름", "피나스테리드정 1mg", 90],
    [d(152), "튼튼내과의원", "내과", "J20.9", "급성 기관지염", "레보플록사신정 500mg", 7],
    [d(600), "튼튼내과의원", "내과", "E03.9", "상세불명의 갑상선기능저하증", "레보티록신나트륨정 0.05mg", 28],
    [d(720), "숨편한내과의원", "내과", "J45.9", "상세불명의 천식", "몬테루카스트정 10mg", 28],
    [d(980), "튼튼내과의원", "내과", "E78.5", "상세불명의 고지혈증", "아토르바스타틴칼슘정 10mg", 28],
    [d(21), "서울대장항문외과", "외과", "K63.5", "대장 용종", "세프트리악손주", 1],
  ];
  // 세부진료가 없는 기본진료 1건 — '세부진료 없음' 카드가 실제로 세어지는지 보이도록.
  basic.push([d(56), "한빛한의원", "한방내과", "M54.5", "요통", "외래", 0, 96000, 32000]);
  return [
    { name: "기본진료정보(예시)", rows: basic },
    { name: "세부진료정보(예시)", rows: detail },
    { name: "처방조제정보(예시)", rows: rx },
  ];
}
