#!/usr/bin/env python3
"""자료앨범(/gallery) 3D 스토리 캐러셀 렌더러 — v7.5.0.

1080×1350(4:5) 카드 = ①생성한 3D 클레이 일러스트(전면) + ②하단 그라데이션 패널의 한글 타이포.
이미지 안에는 글자를 넣지 않고(NO text), 타이포는 Chromium이 실제 폰트로 그린다 → 깨짐 0.

    python3 scripts/render_gallery_3d.py              # 카드 전체
    python3 scripts/render_gallery_3d.py --only s1-01
    python3 scripts/render_gallery_3d.py --prefix s3,s4   # v7.8.0 새 세트만
"""
from __future__ import annotations

import argparse
import base64
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "gallery"
# 카드마다 생성 원본이 있는 폴더를 `raw` 키로 지정한다(기본 v75/raw). RAW_BASE 기준.
RAW_BASE = pathlib.Path("/workspace/downloads")
FONTS = pathlib.Path("/workspace/.fonts")
CHROME = os.environ.get(
    "PK_CHROME",
    "/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell",
)
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)

W, H = 1080, 1350


def font_face(family: str, weight: int, filename: str) -> str:
    data = base64.b64encode((FONTS / filename).read_bytes()).decode()
    return (
        "@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:block;"
        "src:url(data:font/otf;base64,%s) format('opentype')}" % (family, weight, data)
    )


FONT_CSS = "".join(
    [
        font_face("BK", 800, "Pretendard-ExtraBold.otf"),
        font_face("BK", 600, "Pretendard-SemiBold.otf"),
        font_face("BK", 500, "Pretendard-Medium.otf"),
    ]
)

DARK = {
    "panel": "#0f2d25",
    "ink": "#f8f5ea",
    "desc": "rgba(248,245,234,0.80)",
    "kicker": "#a9e0c4",
    "accent": "#f2c879",
    "brand": "#f8f5ea",
    "page": "rgba(248,245,234,0.62)",
    "source": "rgba(248,245,234,0.56)",
    "rule": "rgba(248,245,234,0.16)",
    "chipbg": "rgba(9,26,21,0.42)",
}
LIGHT = {
    "panel": "#faf7ef",
    "ink": "#0d2a20",
    "desc": "rgba(13,42,32,0.74)",
    "kicker": "#146c58",
    "accent": "#a85a3b",
    "brand": "#0d2a20",
    "page": "rgba(13,42,32,0.52)",
    "source": "rgba(13,42,32,0.50)",
    "rule": "rgba(13,42,32,0.14)",
    "chipbg": "rgba(9,26,21,0.46)",
}

LEAF = (
    '<svg class="leaf" width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">'
    '<path d="M12 21.2c0-6.6 3.7-11.5 9.2-13.6C21.4 14.4 17.7 20 12 21.2Z" fill="{a}"/>'
    '<path d="M12 21.2C9.3 15.2 6 11.9 2.3 11.1c1.2 5.9 4.5 9.4 9.7 10.1Z" fill="{b}"/>'
    "</svg>"
)


def esc(s: str) -> str:
    return s


CARDS = [
    # ── 세트 1 — 연말정산 148만 원 돌려받는 연금 순서 (딥그린 패널)
    dict(
        key="s1-01",
        src="s1-01b.png",
        shift=6,
        theme="dark",
        chip="연말정산 · 연금 순서",
        kicker="표지 · 2026 연말정산",
        title="똑같은 월급인데<br>연말정산이 다른 이유",
        desc="연금저축·IRP 900만 원의 비밀",
        page="1 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 국세청 연금계좌 세액공제 안내",
        out="3d-yearend-order-01.png",
    ),
    dict(
        key="s1-02",
        src="s1-02c.png",
        shift=8,
        theme="dark",
        chip="연말정산 · 연금 순서",
        kicker="STEP 01 · 연금저축",
        title="연금저축 먼저<br><em>600만 원</em>",
        desc="중도 인출이 유연하고 ETF도 자유롭게",
        page="2 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 연금저축 세액공제 한도 600만 원",
        out="3d-yearend-order-02.png",
    ),
    dict(
        key="s1-03",
        src="s1-03.png",
        theme="dark",
        chip="연말정산 · 연금 순서",
        kicker="STEP 02 · IRP",
        title="IRP로 <em>300만 원</em><br>더 채우기",
        desc="합산 900만 원까지 세액공제 꽉 채움",
        page="3 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 연금저축+IRP 합산 900만 원",
        out="3d-yearend-order-03.png",
    ),
    dict(
        key="s1-04",
        src="s1-04b.png",
        theme="dark",
        chip="연말정산 · 연금 순서",
        kicker="STEP 03 · 내 숫자",
        title="총급여 5,500만 이하<br>환급률 <em>16.5%</em>",
        desc="최대 148만 5천 원 현금 환급",
        page="4 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 지방소득세 포함 16.5%(5,500만 원 초과 13.2%)",
        out="3d-yearend-order-04.png",
    ),
    dict(
        key="s1-05",
        src="s1-05.png",
        theme="dark",
        chip="연말정산 · 연금 순서",
        kicker="주의 · 중도 해지",
        title="55세 전 해지하면<br><em>16.5%</em> 추징",
        desc="여유자금으로만 채우는 게 원칙",
        page="5 / 6",
        source="기준 2026.11.22 · 소득세법 제21조 · 연금계좌 중도해지 기타소득세 16.5%",
        out="3d-yearend-order-05.png",
    ),
    dict(
        key="s1-06",
        src="s1-06.png",
        theme="dark",
        chip="연말정산 · 연금 순서",
        kicker="마감 · 12월 31일",
        title="올해 12월 31일<br>입금분까지 적용",
        desc="buffetkimz 앱스토어에서 내 환급액 바로 계산",
        page="6 / 6",
        source="기준 2026.11.22 · 국세청 연말정산 안내 · 12월 31일까지 입금된 금액이 대상",
        out="3d-yearend-order-06.png",
    ),
    # ── 세트 2 — ISA 계좌 5분 정리 (크림 패널)
    dict(
        key="s2-01",
        src="s2-01b.png",
        shift=5,
        theme="light",
        chip="ISA · 절세 계좌",
        kicker="표지 · ISA 5분 정리",
        title="예금 이자 <em>15.4%</em> 세금,<br>그냥 다 내시나요?",
        desc="만능 절세 통장 ISA 핵심 4가지",
        page="1 / 6",
        source="기준 2026.11.22 · 소득세법 제129조 · 이자소득 원천징수 15.4%(지방소득세 포함)",
        out="3d-isa-basics-01.png",
    ),
    dict(
        key="s2-02",
        src="s2-02.png",
        shift=8,
        theme="light",
        chip="ISA · 절세 계좌",
        kicker="핵심 01 · 비과세",
        title="서민형 <em>400만</em><br>일반형 <em>200만</em> 비과세",
        desc="초과분도 9.9% 분리과세로 끝",
        page="2 / 6",
        source="기준 2026.11.22 · 조세특례제한법 제91조의18 · 순이익 기준 비과세 한도",
        out="3d-isa-basics-02.png",
    ),
    dict(
        key="s2-03",
        src="s2-03b.png",
        shift=10,
        theme="light",
        chip="ISA · 절세 계좌",
        kicker="핵심 02 · 손익통산",
        title="수익과 손실을<br>합쳐서 계산합니다",
        desc="한쪽에서 잃고 한쪽에서 벌면 순이익만 과세",
        page="3 / 6",
        source="기준 2026.11.22 · 조세특례제한법 제91조의18 · ISA 손익통산 구조",
        out="3d-isa-basics-03.png",
    ),
    dict(
        key="s2-04",
        src="s2-04.png",
        shift=6,
        theme="light",
        chip="ISA · 절세 계좌",
        kicker="핵심 03 · 납입한도",
        title="연 <em>2,000만</em> · 최대 <em>1억</em>까지<br>넣을 수 있습니다",
        desc="안 쓴 한도는 다음 해로 이월",
        page="4 / 6",
        source="기준 2026.11.22 · 조세특례제한법 제91조의18 · 연 2,000만 원·총 1억 원 한도",
        out="3d-isa-basics-04.png",
    ),
    dict(
        key="s2-05",
        src="s2-05.png",
        shift=6,
        theme="light",
        chip="ISA · 절세 계좌",
        kicker="핵심 04 · 연금 전환",
        title="3년 채우고<br>연금계좌로 넘기면",
        desc="전환액 10%(최대 300만) 추가 세액공제",
        page="5 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · ISA 만기자금 전환 시 10%·최대 300만 원",
        out="3d-isa-basics-05.png",
    ),
    dict(
        key="s2-06",
        src="s2-06.png",
        theme="light",
        chip="ISA · 절세 계좌",
        kicker="클로징",
        title="일반 계좌 쓰기 전에<br><em>ISA</em>부터",
        desc="buffetkimz 자산리포트 · 앱스토어",
        page="6 / 6",
        source="기준 2026.11.22 · 조세특례제한법 제91조의18 · ISA 주요 제도 안내",
        out="3d-isa-basics-06.png",
    ),
    # ── 세트 3 (v7.8.0) — 1·2세대 실손 계약전환 (딥그린 패널)
    dict(
        key="s3-01",
        raw="v78/raw",
        src="s1-01.png",
        shift=4,
        theme="dark",
        chip="실손 · 계약전환",
        kicker="표지 · 11. 23. 시행",
        title="내일부터 시작되는<br>실손 <em>50% 할인</em>",
        desc="바로 갈아타면 안 되는 이유",
        page="1 / 6",
        source="기준 2026.11.22 · 금융위원회 보도자료(2026.11.19.) · 2026.11.23. 시행",
        out="3d-silson-switch-01.png",
    ),
    dict(
        key="s3-02",
        raw="v78/raw",
        src="s1-02.png",
        shift=2,
        theme="dark",
        chip="실손 · 계약전환",
        kicker="대상 · 누가 바꿀 수 있나",
        title="2013년 3월 이전<br>1·2세대 실손",
        desc="5세대 전환 시 3년간 보험료 50% 할인",
        page="2 / 6",
        source="기준 2026.11.22 · 금융위원회 · 재가입 조건 없는 2013.3. 이전 계약 · 신청 2027.5.22.까지",
        out="3d-silson-switch-02.png",
    ),
    dict(
        key="s3-03",
        raw="v78/raw",
        src="s1-03.png",
        shift=2,
        theme="dark",
        chip="실손 · 계약전환",
        kicker="함정 01 · 병원 이용",
        title="병원 자주 간다면<br>먼저 따져야 해요",
        desc="전환 후 비중증 비급여 자기부담률은 50%",
        page="3 / 6",
        source="기준 2026.11.22 · 금융위원회 · 5세대 비중증 비급여 자기부담 50%·연간 1천만 원 한도",
        out="3d-silson-switch-03.png",
    ),
    dict(
        key="s3-04",
        raw="v78/raw",
        src="s1-04.png",
        shift=3,
        theme="dark",
        chip="실손 · 계약전환",
        kicker="함정 02 · 되돌릴 수 없음",
        title="선택형 할인은<br>철회·해지 <em>1회</em>",
        desc="한 번 해지하면 다시 가입할 수 없어요",
        page="4 / 6",
        source="기준 2026.11.22 · 금융위원회 · 선택형 할인특약 청약철회·해지 1회 제한, 재가입 불가",
        out="3d-silson-switch-04.png",
    ),
    dict(
        key="s3-05",
        raw="v78/raw",
        src="s1-05.png",
        shift=2,
        theme="dark",
        chip="실손 · 계약전환",
        kicker="함정 03 · 기존 계약 해지",
        title="전환 전 6개월<br>기존 계약 해지하면",
        desc="50% 할인 혜택이 그 자리에서 끝납니다",
        page="5 / 6",
        source="기준 2026.11.22 · 금융위원회 · 전환 신청일 이전 6개월 내 기존 계약 해지 시 할인 종료",
        out="3d-silson-switch-05.png",
    ),
    dict(
        key="s3-06",
        raw="v78/raw",
        src="s1-06.png",
        shift=2,
        theme="dark",
        chip="실손 · 계약전환",
        kicker="클로징 · 오늘 할 일",
        title="숫자보다 증권을<br>먼저 펼쳐 보세요",
        desc="가입일과 병원 이용 빈도부터 확인",
        page="6 / 6",
        source="기준 2026.11.22 · 금융위원회 보도자료 · 보장·할인율은 보험사·선택 조건에 따라 다름",
        out="3d-silson-switch-06.png",
    ),
    # ── 세트 4 (v7.8.0) — 연말 전 900만 원 채우기 (크림 패널)
    dict(
        key="s4-01",
        raw="v78/raw",
        src="s2-01.png",
        shift=3,
        theme="light",
        chip="연금저축 · IRP · 세액공제",
        kicker="표지 · 연말 전 900만 원",
        title="연말 전 <em>900만 원</em><br>채우는 순서",
        desc="연금저축 600 → IRP 300 → ISA 300",
        page="1 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 연금저축·IRP 합산 900만 원",
        out="3d-pension-tax-01.png",
    ),
    dict(
        key="s4-02",
        raw="v78/raw",
        src="s2-02.png",
        shift=3,
        theme="light",
        chip="연금저축 · IRP · 세액공제",
        kicker="STEP 01 · 연금저축",
        title="먼저 연금저축<br><em>600만 원</em>",
        desc="중도 인출이 자유롭고 ETF도 담을 수 있어요",
        page="2 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 연금저축 세액공제 한도 600만 원",
        out="3d-pension-tax-02.png",
    ),
    dict(
        key="s4-03",
        raw="v78/raw",
        src="s2-03.png",
        shift=2,
        theme="light",
        chip="연금저축 · IRP · 세액공제",
        kicker="STEP 02 · IRP",
        title="IRP로 <em>300만 원</em><br>더 채우기",
        desc="합산 900만 원까지 공제 한도를 채웁니다",
        page="3 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 연금저축+IRP 합산 900만 원",
        out="3d-pension-tax-03.png",
    ),
    dict(
        key="s4-04",
        raw="v78/raw",
        src="s2-04.png",
        shift=2,
        theme="light",
        chip="연금저축 · IRP · 세액공제",
        kicker="STEP 03 · ISA 전환",
        title="ISA 만기 자금<br><em>300만 원</em> 더",
        desc="전환액의 10%, 최대 300만 원 추가 한도",
        page="4 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · ISA 전환액의 10%·최대 300만 원 추가",
        out="3d-pension-tax-04.png",
    ),
    dict(
        key="s4-05",
        raw="v78/raw",
        src="s2-05.png",
        shift=3,
        theme="light",
        chip="연금저축 · IRP · 세액공제",
        kicker="내 숫자 · 공제율",
        title="총급여 5,500만 기준<br><em>16.5%</em> 아니면 <em>13.2%</em>",
        desc="900만 원 채우면 최대 148만 5천 원",
        page="5 / 6",
        source="기준 2026.11.22 · 소득세법 제59조의3 · 5,500만 원 초과 13.2%, 최대 148만 5천 원",
        out="3d-pension-tax-05.png",
    ),
    dict(
        key="s4-06",
        raw="v78/raw",
        src="s2-06.png",
        shift=2,
        theme="light",
        chip="연금저축 · IRP · 세액공제",
        kicker="마감 · 12월 31일",
        title="12월 31일 입금분까지<br>해지는 <em>55세</em> 이후에",
        desc="55세 전에 해지하면 16.5% 기타소득세",
        page="6 / 6",
        source="기준 2026.11.22 · 소득세법 제21조·제59조의3 · 12.31. 입금분까지, 중도해지 16.5%",
        out="3d-pension-tax-06.png",
    ),
]


def build_html(c: dict) -> str:
    t = DARK if c["theme"] == "dark" else LIGHT
    title_html = "".join(f'<span class="ln">{line}</span>' for line in c["title"].split("<br>"))
    leaf = LEAF.replace("{a}", t["accent"]).replace("{b}", t["kicker"] if c["theme"] == "dark" else "#8fb394")
    shot = (RAW_BASE / c.get("raw", "v75/raw") / c["src"]).read_bytes()
    src_uri = "data:image/png;base64," + base64.b64encode(shot).decode()
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
{FONT_CSS}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{W}px;height:{H}px}}
body{{font-family:'BK','Noto Sans CJK KR',sans-serif;-webkit-font-smoothing:antialiased}}
.card{{position:relative;width:{W}px;height:{H}px;overflow:hidden;background:{t['panel']}}}
.shot{{position:absolute;left:0;top:0;width:{W}px;height:{H}px;object-fit:cover;object-position:50% 50%;transform:translateY(-{round(c.get("shift",0)/100*H)}px)}}
.veil{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(15,45,37,0) 0%, rgba(15,45,37,0) 42%, rgba(15,45,37,0.05) 50%,
  rgba(15,45,37,0.20) 56%, rgba(15,45,37,0.52) 61%, rgba(15,45,37,0.80) 65%, rgba(15,45,37,0.96) 68%, {t['panel']} 72%, {t['panel']} 100%)}}
.light .veil{{background:linear-gradient(180deg,
  rgba(250,247,239,0) 0%, rgba(250,247,239,0) 42%, rgba(250,247,239,0.06) 50%,
  rgba(250,247,239,0.24) 56%, rgba(250,247,239,0.56) 61%, rgba(250,247,239,0.84) 65%, rgba(250,247,239,0.97) 68%, {t['panel']} 72%, {t['panel']} 100%)}}
.chip{{position:absolute;left:54px;top:52px;display:flex;align-items:center;gap:10px;height:46px;
  padding:0 20px;border-radius:999px;background:{t['chipbg']};color:#f6f2e6;
  font-size:19px;font-weight:600;letter-spacing:.02em;backdrop-filter:blur(4px)}}
.chip i{{width:9px;height:9px;border-radius:50%;background:{t['accent']};display:block}}
.text{{position:absolute;left:72px;right:72px;bottom:88px;display:flex;flex-direction:column}}
.kicker{{text-shadow:0 1px 3px rgba(6,20,16,.55),0 6px 20px rgba(6,20,16,.40);font-size:21px;font-weight:600;letter-spacing:.16em;color:{t['kicker']}}}
h1{{margin-top:16px;text-shadow:0 2px 24px rgba(0,0,0,.22);font-weight:800;font-size:78px;line-height:1.15;letter-spacing:-0.038em;color:{t['ink']}}}
h1 .ln{{display:block;white-space:nowrap}}
h1 em{{font-style:normal;color:{t['accent']}}}
.light h1,.light .kicker{{text-shadow:none}}
.desc{{margin-top:20px;font-size:31px;line-height:1.46;font-weight:500;color:{t['desc']};letter-spacing:-0.012em}}
.rule{{margin-top:34px;height:1px;background:{t['rule']}}}
.meta{{margin-top:16px;display:flex;align-items:center;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:10px;font-size:25px;font-weight:800;letter-spacing:-0.01em;color:{t['brand']}}}
.page{{font-size:20px;font-weight:600;letter-spacing:.10em;color:{t['page']};font-variant-numeric:tabular-nums}}
.source{{margin-top:6px;font-size:16px;line-height:1.5;font-weight:500;color:{t['source']};letter-spacing:-0.005em}}
</style></head>
<body><div class="card {c['theme']}">
  <img class="shot" src="{src_uri}" alt="">
  <div class="veil"></div>
  <div class="chip"><i></i>{c['chip']}</div>
  <div class="text">
    <p class="kicker">{c['kicker']}</p>
    <h1>{title_html}</h1>
    <p class="desc">{c['desc']}</p>
    <div class="rule"></div>
    <div class="meta">
      <span class="brand">{leaf}buffetkimz</span>
      <span class="page">{c['page']}</span>
    </div>
    <p class="source">{c['source']}</p>
  </div>
</div>
<script>
document.fonts.ready.then(() => {{
  const h = document.querySelector('h1');
  const lines = [...h.querySelectorAll('.ln')];
  const maxW = h.getBoundingClientRect().width;
  let size = parseFloat(getComputedStyle(h).fontSize);
  while (lines.some(l => l.scrollWidth > maxW + 1) && size > 44) {{
    size -= 2; h.style.fontSize = size + 'px';
  }}
}});
</script>
</body></html>"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--prefix", default="")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright

    prefixes = tuple(p for p in args.prefix.split(",") if p)
    jobs = [
        c
        for c in CARDS
        if (not args.only or c["key"] == args.only) and (not prefixes or c["key"].startswith(prefixes))
    ]
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--no-sandbox", "--font-render-hinting=none", "--allow-file-access-from-files"],
        )
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        for c in jobs:
            page.set_content(build_html(c), wait_until="load")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(320)
            path = OUT / c["out"]
            page.screenshot(path=str(path), clip={"x": 0, "y": 0, "width": W, "height": H})
            print(f"✓ {c['key']:6s} {c['out']:26s} {path.stat().st_size/1024:.0f}KB")
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
