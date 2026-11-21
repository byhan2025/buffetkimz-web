#!/usr/bin/env python3
"""자료앨범(/gallery) 카드 렌더러 — v7.1.

1080×1350(4:5) 에디토리얼 카드뉴스·캐러셀·인포그래픽·체크리스트를 HTML로 짜서 PNG로 굽는다.
(정적 사이트라 서버 업로드가 없다. 관리자가 이 스크립트로 이미지를 만들어 public/gallery/에 넣고,
 src/data/gallery.ts에 카드를 등록한 뒤 빌드·배포한다.)

    python3 scripts/render_gallery.py                # 전체
    python3 scripts/render_gallery.py --only accounts-02

시각 기준 (회의실 4호 봇 샘플 검토 반영)
 · 크림 종이(#F7F6F0) 위 숲색(#244C38) 활자, 세이지(#DCEAE0) 면, 테라코타 한 점
 · 제목은 Noto Serif CJK KR, 본문·숫자는 Noto Sans CJK KR(시스템 폰트)
 · 상단 워터마크는 '버핏킴즈 · BUFFETKIMZ' — 외부 브랜드 표기는 쓰지 않는다
 · 카드마다 기준일·출처 한 줄, 수치는 가정을 함께 적는다
"""
from __future__ import annotations

import argparse
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "gallery"
CHROME = os.environ.get(
    "PK_CHROME", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
)
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.pwlibs/root/usr/lib/x86_64-linux-gnu:/workspace/.local/lib"
)

W, H = 1080, 1350

CSS = """
@font-face{font-family:'BKSans';src:local('Noto Sans CJK KR');font-weight:100 900}
@font-face{font-family:'BKSerif';src:local('Noto Serif CJK KR');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:__W__px;height:__H__px}
body{font-family:'BKSans','Noto Sans CJK KR',sans-serif;background:#F7F6F0;color:#1E2B22;-webkit-font-smoothing:antialiased}
.card{position:relative;width:__W__px;height:__H__px;overflow:hidden;background:#F7F6F0}
.orb{position:absolute;border-radius:50%;background:#E7EEE6;pointer-events:none}
.orb.a{width:520px;height:520px;right:-170px;top:-150px;opacity:.85}
.orb.b{width:300px;height:300px;left:-130px;bottom:180px;opacity:.5}
.pad{position:absolute;inset:0;padding:66px 74px 58px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:13px;font-size:19px;font-weight:700;letter-spacing:.18em;color:#244C38}
.top .meta{font-size:16px;font-weight:600;letter-spacing:.14em;color:#6B7A6E}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:26px 0 10px}
.kicker{font-size:21px;font-weight:700;letter-spacing:.01em;color:#244C38}
h1{font-family:'BKSerif','Noto Serif CJK KR',serif;font-size:80px;line-height:1.16;letter-spacing:-.03em;font-weight:600;margin-top:18px;color:#18251D}
h1 em{font-style:normal;color:#244C38}
h2{font-family:'BKSerif','Noto Serif CJK KR',serif;font-size:54px;line-height:1.22;letter-spacing:-.03em;font-weight:600;color:#18251D}
.lede{margin-top:18px;font-size:24px;line-height:1.6;color:#4E5F53;font-weight:450}
.lede b{color:#244C38;font-weight:700}
.foot{border-top:1px solid #D9D6C8;padding-top:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:26px}
.foot .src{font-size:15.5px;line-height:1.55;color:#6B7A6E;max-width:840px}
.foot .pg{font-size:16px;font-weight:700;letter-spacing:.12em;color:#244C38;white-space:nowrap}
.foot .how{margin-top:6px;font-size:15px;color:#8A9589}
/* 2×2 계좌 카드 */
.map{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px}
.acct{background:#fff;border:1px solid #E4E1D4;border-radius:20px;padding:22px 22px 16px}
.acct .nm{display:flex;align-items:baseline;gap:9px}
.acct .nm b{font-size:28px;font-weight:800;letter-spacing:-.03em;color:#18251D}
.acct .nm span{font-size:12.5px;font-weight:700;letter-spacing:.12em;color:#8A9589}
.acct dl{margin-top:10px}
.acct .r{display:grid;grid-template-columns:58px 1fr;gap:8px;padding:11px 0;border-top:1px dotted #DDD9C9}
.acct .r dt{font-size:16px;font-weight:700;color:#244C38}
.acct .r dd{font-size:16.5px;line-height:1.5;color:#3C4C41}
/* 숫자 표 */
.tbl{background:#fff;border:1px solid #E4E1D4;border-radius:20px;overflow:hidden;margin-top:24px}
.tbl .tr{display:grid;grid-template-columns:1.15fr .95fr .9fr 1fr;align-items:center;padding:17px 22px;border-top:1px solid #E9E6D8}
.tbl .tr:first-child{border-top:0;background:#F1F0E6;font-size:15.5px;font-weight:700;color:#6B7A6E;letter-spacing:.02em}
.tbl .tr .nm{font-size:20px;font-weight:750;color:#18251D;letter-spacing:-.02em}
.tbl .tr .nm small{display:block;font-size:14px;font-weight:500;color:#7C8A7F;letter-spacing:0;margin-top:2px}
.tbl .tr .v{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;text-align:right;color:#3C4C41}
.tbl .tr .v.hi{color:#244C38;font-weight:800;font-size:22px}
.tbl .tr.head .v{font-size:15.5px;font-weight:700;color:#6B7A6E}
/* 세 가지 기억 */
.three{display:flex;flex-direction:column;gap:14px;margin-top:26px}
.tri{display:grid;grid-template-columns:64px 1fr;gap:18px;padding:20px 22px;background:#fff;border:1px solid #E4E1D4;border-radius:18px}
.tri .n{font-family:'BKSerif',serif;font-size:34px;font-weight:600;color:#C4714A;line-height:1}
.tri b{font-size:22px;font-weight:750;color:#18251D;letter-spacing:-.02em}
.tri p{font-size:17px;line-height:1.55;color:#4E5F53;margin-top:5px}
.note{margin-top:18px;padding:16px 20px;border-radius:14px;background:#E8F0E6;font-size:17px;line-height:1.55;color:#33503D;font-weight:500}
.note.warm{background:#F6EBE3;color:#7A4A32}
/* 표지 엠블럼 */
.emblem{display:flex;flex-direction:column;align-items:center;margin-top:30px}
.emblem .ring{width:330px;height:330px;border:1px solid #C9D8CB;border-radius:50%;display:flex;align-items:flex-end;justify-content:center;gap:16px;padding-bottom:74px;position:relative;background:radial-gradient(circle at center,#EEF3EC 0%,#F7F6F0 72%)}
.emblem .ring:after{content:"";position:absolute;inset:22px;border:1px dashed #CBD9CD;border-radius:50%}
.emblem .bar{width:34px;border-radius:3px 3px 0 0;background:#9CBE9F}
.emblem .bar.d{background:#244C38}
.emblem .cap{margin-top:16px;font-size:16px;font-weight:700;letter-spacing:.26em;color:#6B7A6E}
/* 큰 숫자 */
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px}
.trio .n{background:#fff;border:1px solid #E4E1D4;border-radius:18px;padding:22px 18px;text-align:center}
.trio .n em{display:block;font-family:'BKSerif',serif;font-style:normal;font-size:54px;font-weight:600;color:#244C38;letter-spacing:-.03em}
.trio .n b{display:block;margin-top:4px;font-size:17px;font-weight:700;color:#3C4C41}
.trio .n span{display:block;margin-top:6px;font-size:14.5px;line-height:1.45;color:#7C8A7F}
/* 인출 4칸 */
.steps{display:flex;flex-direction:column;gap:11px;margin-top:22px}
.step{display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:18px;background:#fff;border:1px solid #E4E1D4;border-radius:16px;padding:16px 20px}
.step .no{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#E3EDE3;font-size:20px;font-weight:800;color:#244C38}
.step b{display:block;font-size:22px;font-weight:750;letter-spacing:-.02em;color:#18251D}
.step p{font-size:16px;line-height:1.45;color:#5E6E62;margin-top:3px}
.step .tag{font-size:14px;font-weight:700;padding:6px 12px;border-radius:999px;background:#EEF3EC;color:#33503D;white-space:nowrap}
.step .tag.warm{background:#F6EBE3;color:#7A4A32}
/* 체크리스트 */
.checks{display:flex;flex-direction:column;gap:9px;margin-top:22px}
.chk{display:grid;grid-template-columns:42px 1fr;gap:14px;padding:14px 18px;background:#fff;border:1px solid #E4E1D4;border-radius:14px}
.chk .bx{width:28px;height:28px;border:2px solid #8FB394;border-radius:7px;position:relative;margin-top:2px}
.chk .bx:after{content:"";position:absolute;left:7px;top:3px;width:10px;height:16px;border-right:2.5px solid #244C38;border-bottom:2.5px solid #244C38;transform:rotate(40deg)}
.chk b{font-size:20px;font-weight:750;color:#18251D;letter-spacing:-.02em}
.chk p{font-size:15.5px;line-height:1.45;color:#5E6E62;margin-top:3px}
""".replace("__W__", str(W)).replace("__H__", str(H))

LEAF = (
    '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">'
    '<path d="M12 21c0-6.5 3.6-11.3 9-13.4C21 14.4 17.4 19.8 12 21Z" fill="#244C38"/>'
    '<path d="M12 21C9.4 15.2 6.2 12 2.6 11.2 3.8 17 7 20.4 12 21Z" fill="#8FB394"/></svg>'
)


def shell(inner: str, page: str, src: str, how: str = "카드마다 기준일·출처·가정을 함께 적습니다") -> str:
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{CSS}</style></head>
<body><div class="card"><div class="orb a"></div><div class="orb b"></div>
<div class="pad">
  <div class="top">
    <span class="brand">{LEAF} 버핏킴즈 · BUFFETKIMZ</span>
    <span class="meta">GALLERY · {page}</span>
  </div>
  <div class="body">{inner}</div>
  <div class="foot">
    <div><p class="src">{src}</p><p class="how">{how}</p></div>
    <span class="pg">{page}</span>
  </div>
</div></div></body></html>"""


SRC_ACCOUNTS = "기준일 2026.11.21. · 출처: 국세청 연금계좌 세액공제 · 국세청 연금소득 원천징수 · 소득세법 제17조·제20조의3·제129조 · 조세특례제한법 제91조의18(ISA)"


def cover() -> str:
    inner = f"""
    <p class="kicker">RETIREMENT · A PRACTICAL GUIDE</p>
    <h1>같은 돈,<br><em>네 계좌의 세금</em></h1>
    <p class="lede">연금저축 · IRP · ISA · 일반계좌를<br>‘넣을 때 · 굴릴 때 · 꺼낼 때’로 나눠 봅니다.</p>
    <div class="emblem">
      <div class="ring">
        <span class="bar" style="height:74px"></span>
        <span class="bar" style="height:96px"></span>
        <span class="bar d" style="height:134px"></span>
        <span class="bar d" style="height:134px"></span>
      </div>
      <p class="cap">적립 · 운용 · 인출 · 점검</p>
    </div>"""
    return shell(
        inner,
        "01 / 04",
        "출발 자료: 버핏킴즈 『연금·퇴직 마스터 가이드』 6편 · 세법 확인일 2026.11.21.",
        "내 상황에 맞는 순서로 골라 읽어 보세요",
    )


def account_map() -> str:
    def acct(name, en, rows):
        body = "".join(f"<div class='r'><dt>{k}</dt><dd>{v}</dd></div>" for k, v in rows)
        return f"<div class='acct'><div class='nm'><b>{name}</b><span>{en}</span></div><dl>{body}</dl></div>"

    left = acct("연금저축", "PENSION SAVINGS", [
        ("납입", "요건에 맞는 납입액은 세액공제 대상이 될 수 있어요."),
        ("운용", "계좌 안 운용 중 과세를 미루는 구조예요."),
        ("수령", "연금 요건과 재원 구분에 따라 세금이 달라져요."),
    ])
    right = acct("IRP", "RETIREMENT PENSION", [
        ("납입", "개인 납입 공제는 연금저축과 합산 기준으로 봐요."),
        ("운용", "위험자산 70% 한도, 계좌 안 수익은 인출 때 확인해요."),
        ("수령", "퇴직급여와 개인 납입 재원의 경로를 나눠 봐요."),
    ])
    left2 = acct("ISA", "INDIVIDUAL SAVINGS", [
        ("납입", "연금계좌의 세액공제와는 별도 제도예요."),
        ("운용", "요건을 갖추면 이자·배당은 한도까지 비과세, 초과분은 9% 분리과세(지방소득세 별도)."),
        ("이전", "만기자금의 연금계좌 이전은 60일 등 별도 요건을 확인해요."),
    ])
    right2 = acct("일반계좌", "TAXABLE ACCOUNT", [
        ("납입", "연금계좌 세액공제 대상 계좌가 아니에요."),
        ("운용", "과세는 보유자산·분배·매매 유형에 따라 달라져요."),
        ("수령", "모든 ETF에 통하는 단일 세율·공식은 없어요."),
    ])
    inner = f"""
    <p class="kicker">01 · 계좌별 세금의 타이밍</p>
    <h1 style="font-size:66px">네 계좌, 세금의 때가<br>다릅니다</h1>
    <p class="lede">세금은 ‘낭을 때 · 굴릴 때 · 꺼낼 때’로 나눠 비교해요.</p>
    <div class="map">{left}{right}{left2}{right2}</div>
    <p class="note">세금은 상품 종류·소득 성격·계약 조건을 함께 봐야 해요. 저축성보험은 계좌가 아닌 별도 상품군이라 이 비교에서 분리했습니다.</p>"""
    return shell(inner, "02 / 04", SRC_ACCOUNTS)


def tax_numbers() -> str:
    def row(name, sub, tax, net, when, hi=False):
        return (
            f"<div class='tr'><span class='nm'>{name}<small>{sub}</small></span>"
            f"<span class='v'>{tax}</span><span class='v{' hi' if hi else ''}'>{net}</span>"
            f"<span class='v'>{when}</span></div>"
        )
    rows = (
        row("일반계좌", "해외·배당·채권형", "770만원", "4,230만원", "수익 실현 때")
        + row("ISA", "일반형 · 200만원 비과세", "475만 2,000원", "4,524만 8,000원", "만기·해지 때")
        + row("연금저축", "55~69세 연금 수령", "275만원", "4,725만원", "꺼낼 때", True)
        + row("IRP", "55~69세 연금 수령", "275만원", "4,725만원", "꺼낼 때", True)
        + row("연금저축·IRP", "연금 외 일시 수령", "825만원", "4,175만원", "꺼낼 때")
    )
    inner = f"""
    <p class="kicker">02 · 같은 수익, 다른 세후</p>
    <h1 style="font-size:64px">5,000만원 수익,<br>세후로 남는 돈</h1>
    <p class="lede">과세대상 이익 5,000만원을 가정했어요. 세율보다 <b>세금이 붙는 때</b>가 결과를 가릅니다.</p>
    <div class="tbl">
      <div class="tr head"><span>계좌</span><span class="v">세금</span><span class="v">세후</span><span class="v">과세 시점</span></div>
      {rows}
    </div>
    <p class="note">국내주식형 ETF 매매차익은 일반계좌에서도 비과세예요. 위 15.4%는 해외·채권·배당형처럼 매매차익과 분배금이 모두 과세되는 자산에 적용됩니다. 세액공제는 이 표에 넣지 않았어요.</p>"""
    return shell(inner, "03 / 04", SRC_ACCOUNTS)


def cautions() -> str:
    inner = f"""
    <p class="kicker">03 · 비교할 때 기억할 것</p>
    <h1 style="font-size:66px">숫자보다 먼저,<br>세 가지 조건</h1>
    <div class="three">
      <div class="tri"><span class="n">1</span><div><b>자산 유형을 먼저 나눕니다</b><p>국내주식형 매매차익은 일반계좌에서도 비과세. 해외·채권·배당형은 매매차익과 분배금 모두 15.4%(지방소득세 포함)로 봅니다.</p></div></div>
      <div class="tri"><span class="n">2</span><div><b>9.9%는 소득세 9% + 지방소득세</b><p>ISA 비과세 한도(일반형 200만원·서민형 400만원)를 넘는 순이익에 붙습니다. 지방소득세는 별도로 확인해요.</p></div></div>
      <div class="tri"><span class="n">3</span><div><b>연금은 ‘언제·얼마’가 세율을 바꿉니다</b><p>55세·5년 요건, 연 1,500만원 기준(과세대상 사적연금소득), 연금 외 수령 16.5%를 함께 봐요.</p></div></div>
    </div>
    <p class="note warm">세액공제는 ‘납입할 때 돌려받는 돈’, 인출세는 ‘꺼낼 때 내는 돈’이에요. 성격이 달라 한 표에 섞지 않고, 세후 실수령액에서 따로 표시했습니다.</p>"""
    return shell(inner, "04 / 04", SRC_ACCOUNTS)


def yearend_cover() -> str:
    inner = f"""
    <p class="kicker">YEAR-END · PENSION TAX CREDIT</p>
    <h1>12월의<br><em>세 숫자</em></h1>
    <p class="lede">12월 31일 전에 확인할 공제 한도와,<br>환급액이 아닌 숫자를 구분합니다.</p>
    <div class="trio">
      <div class="n"><em>600</em><b>연금저축</b><span>세액공제 대상 납입액</span></div>
      <div class="n"><em>900</em><b>IRP 합산</b><span>연금저축과 합쳐 공제</span></div>
      <div class="n"><em>300</em><b>ISA 전환</b><span>늘어나는 공제대상 한도</span></div>
    </div>
    <p class="note">공제율은 <b>16.5%</b>(총급여 5,500만원 이하) 또는 <b>13.2%</b>예요. 지방소득세를 포함한 체감 공제율입니다.</p>"""
    return shell(
        inner,
        "01 / 03",
        "기준일 2026.11.21. · 출처: 국세청 연금계좌 세액공제 · 소득세법 제59조의3 · 시행령 제118조의2·제118조의3",
        "한도는 목표가 아니라 상한입니다",
    )


def yearend_limit() -> str:
    inner = f"""
    <p class="kicker">01 · 600과 900</p>
    <h1 style="font-size:64px">한도와 공제율,<br>두 숫자를 곱합니다</h1>
    <div class="tbl">
      <div class="tr head"><span>공제대상 납입액</span><span class="v">16.5%</span><span class="v">13.2%</span><span class="v">비고</span></div>
      <div class="tr"><span class="nm">연금저축 600만원<small>연금저축 단독 한도</small></span><span class="v">99만원</span><span class="v">79만 2,000원</span><span class="v"></span></div>
      <div class="tr"><span class="nm">IRP 합산 900만원<small>900 전액을 IRP로 채워도 됨</small></span><span class="v hi">148만 5,000원</span><span class="v">118만 8,000원</span><span class="v">최대</span></div>
      <div class="tr"><span class="nm">ISA 전환 포함 1,200만원<small>전환액의 10%·최대 300만원</small></span><span class="v">198만원</span><span class="v">158만 4,000원</span><span class="v">별도 한도</span></div>
    </div>
    <p class="note">공제는 <b>결정세액을 넘을 수 없어요.</b> 넘는 부분은 그 해에 쓰이지 않고, 공제받지 못한 납입액은 다음 연도 납입액으로 전환 신청할 수 있어요.</p>
    <p class="note warm">12월 31일까지 <b>입금</b>된 금액이 그해 대상입니다. 휴일이면 영업일 기준으로 앞당겨 확인하세요.</p>"""
    return shell(inner, "02 / 03", "기준일 2026.11.21. · 출처: 국세청 연말정산 안내 · 소득세법 제59조의3 · 시행령 제118조의3")


def yearend_isa() -> str:
    inner = f"""
    <p class="kicker">02 · 300의 정체</p>
    <h1 style="font-size:64px">300만원은<br>환급액이 아닙니다</h1>
    <p class="lede">ISA 만기 자금을 연금계좌로 옮기면, 옮긴 금액의 <b>10%(최대 300만원)</b>이 공제대상 납입액에 더해져요.</p>
    <div class="three" style="margin-top:22px">
      <div class="tri"><span class="n">1</span><div><b>공제대상 한도가 늘어납니다</b><p>900만원 → 최대 1,200만원. 통장으로 300만원이 돌아오는 구조가 아니에요.</p></div></div>
      <div class="tri"><span class="n">2</span><div><b>실제 절감액은 300만원 × 공제율</b><p>16.5%면 49만 5,000원, 13.2%면 39만 6,000원이에요.</p></div></div>
      <div class="tri"><span class="n">3</span><div><b>연 1,800만원 납입한도와 별도</b><p>만기일부터 60일 이내 전환. 옮긴 돈은 55세·5년 요건 전에는 꺼내기 어려워요.</p></div></div>
    </div>
    <p class="note">전환 대상은 <b>만기</b> 자금이에요. 중도 해지한 자금은 이 방식으로 옮길 수 없습니다.</p>"""
    return shell(inner, "03 / 03", "기준일 2026.11.21. · 출처: 소득세법 제59조의3 제3·4항 · 시행령 제118조의2 · 조세특례제한법 제91조의18")


def draw_order() -> str:
    steps = [
        ("1", "세액공제 받지 않은 납입액", "과세 제외 재원", "과세 제외", ""),
        ("2", "퇴직급여에서 넘어온 이연퇴직소득", "연금수령 방식·수령 연차 등 조건 확인", "별도 과세 경로", ""),
        ("3", "세액공제를 받은 개인 납입액", "국세청 분류상 과세대상 재원에 포함", "과세대상", ""),
        ("4", "계좌에서 불어난 운용수익", "3번과 같은 과세대상 묶음으로 살펴보기", "과세대상", ""),
    ]
    html = "".join(
        f"<div class='step'><span class='no'>{n}</span><div><b>{t}</b><p>{d}</p></div><span class='tag{' warm' if i == 1 else ''}'>{tag}</span></div>"
        for i, (n, t, d, tag, _) in enumerate(steps)
    )
    inner = f"""
    <p class="kicker">03 · 인출 재원부터 살피기</p>
    <h1 style="font-size:64px">연금계좌를 꺼낼 땐<br>돈의 출처부터</h1>
    <p class="lede">먼저 과세제외·퇴직급여·과세대상 재원을 나누고, 수령 요건을 확인합니다.</p>
    <div class="steps">{html}</div>
    <p class="note warm">4칸은 이해를 위한 필침이에요. 3·4번은 국세청이 하나의 ‘과세금액’ 범주로 함께 안내합니다. 두 재원 사이에 별도의 법정 인출 우선순위가 있다는 뜻은 아닙니다.</p>
    <p class="note">일반 연금수령 요건: 통상 만 55세 이후 신청, 가입일부터 5년 경과, 연금수령한도 이내. 이연퇴직소득·의료목적 등 예외는 계좌별로 확인하세요.</p>"""
    return shell(
        inner,
        "01 / 01",
        "기준일 2026.11.21. · 출처: 국세청 연금소득·연금계좌 구성 · 국세청 연금소득 원천징수 · 소득세법 시행령 제40조의2",
        "요건·예외·한도는 해당 연도 공식 안내 확인",
    )


def retire_checklist() -> str:
    items = [
        ("55세·5년 요건 확인", "계좌 개설일과 가입기간을 먼저 봅니다"),
        ("수령용·적립용 계좌 분리", "수령 개시 후에는 추가 납입이 안 됩니다"),
        ("연 1,500만원은 계좌 합산", "과세대상 사적연금소득을 더해 계산"),
        ("연금수령한도 확인", "평가액 ÷ (11 − 연차) × 120%, 11년차부터 없음"),
        ("건보료 두 기준 분리", "피부양자 2,000만원(공적연금 전액) · 지역가입자 50% 반영"),
        ("IRP 중도인출 7가지 사유", "주택·전세·요양·재난·파산·개인회생·담보대출"),
        ("중도해지 16.5% 확인", "세액공제분과 운용수익에 기타소득세"),
    ]
    html = "".join(
        f"<div class='chk'><span class='bx'></span><div><b>{t}</b><p>{d}</p></div></div>" for t, d in items
    )
    inner = f"""
    <p class="kicker">CHECKLIST · 은퇴 전 점검</p>
    <h1 style="font-size:64px">은퇴 전에 볼<br>일곱 가지</h1>
    <div class="checks">{html}</div>"""
    return shell(
        inner,
        "01 / 01",
        "기준일 2026.11.21. · 출처: 국민건강보험법 시행규칙 별표 1의2 · 근로자퇴직급여 보장법 시행령 제18조 · 소득세법 제21조",
        "건보료·세금·인출 규칙은 매년 바뀔 수 있어요",
    )


JOBS = {
    "accounts-01": (cover, "pension-accounts-01.png"),
    "accounts-02": (account_map, "pension-accounts-02.png"),
    "accounts-03": (tax_numbers, "pension-accounts-03.png"),
    "accounts-04": (cautions, "pension-accounts-04.png"),
    "yearend-01": (yearend_cover, "pension-yearend-01.png"),
    "yearend-02": (yearend_limit, "pension-yearend-02.png"),
    "yearend-03": (yearend_isa, "pension-yearend-03.png"),
    "draw-order": (draw_order, "pension-draw-order.png"),
    "retire-checklist": (retire_checklist, "pension-retire-checklist.png"),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright

    jobs = {k: v for k, v in JOBS.items() if not args.only or k == args.only}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        for key, (fn, name) in jobs.items():
            page.set_content(fn(), wait_until="load")
            page.wait_for_timeout(260)
            path = OUT / name
            page.screenshot(path=str(path), clip={"x": 0, "y": 0, "width": W, "height": H})
            print(f"✓ {key:16s} {name}  {path.stat().st_size/1024:.0f}KB")
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
