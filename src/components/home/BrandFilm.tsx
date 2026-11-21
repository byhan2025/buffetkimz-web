/**
 * v5.1 — 1페이지 브랜드 모션그래픽 광고 (6컷 · 12초 자동 루프).
 *
 * · three.js — 씬1 폭발·응집 파티클 / 씬4 격자 / 씬5 록업 버스트 (GLSL 포인트, 시간만으로 결정)
 * · GSAP     — 하나의 마스터 타임라인(12s, repeat:-1). 씬 경계·키네틱 타이포·SVG 드로잉·와이프.
 * · DOM      — 실제 글자(한국어)는 DOM으로 그린다. 캔버스보다 선명하고 낭독기·검색에 남는다.
 *
 * 시간 결정성: 모든 그림은 t 하나로 계산한다. 그래서 `window.__bkFilm.seek(t)`로
 * 같은 순간을 몇 번이든 다시 그릴 수 있고, 검증 스크립트는 t=0.5/2.5/5.0/8.5를 캡처한다.
 *
 * 접근성: `prefers-reduced-motion: reduce`면 타임라인을 만들지 않고 정적 록업만 보여 준다.
 * 화면 밖·탭 비활성일 때는 스스로 멈춘다. 씬 텍스트는 장식이라 aria-hidden,
 * 필름 구역에는 요약 설명을 붙이고 H1은 정적 록업이 갖는다(자바스크립트 없이도 읽힌다).
 */
import { useEffect, useRef, useState } from "react";
import BrandMark from "@/components/BrandMark.tsx";
import { withBase } from "@/config/site";

const TOTAL = 12;
const SCENES = [
  { id: 1, start: 0.0, end: 1.5, label: "빛의 응집", short: "빛의 응집", en: "OPENING" },
  { id: 2, start: 1.5, end: 3.8, label: "다섯 개의 단어", short: "다섯 단어", en: "KEYWORDS" },
  { id: 3, start: 3.8, end: 6.0, label: "시간의 곡선", short: "시간 곡선", en: "TIME" },
  { id: 4, start: 6.0, end: 7.8, label: "장면 전환", short: "와이프", en: "WIPE" },
  { id: 5, start: 7.8, end: 10.2, label: "브랜드 록업", short: "브랜드", en: "LOCKUP" },
  { id: 6, start: 10.2, end: 12.0, label: "다음 장면", short: "다음 장면", en: "NEXT" },
] as const;

const WORDS = [
  { en: "FINANCE", kr: "금융", line: "돈이 도는 구조를 먼저 봅니다" },
  { en: "INVEST", kr: "투자", line: "얼마를 버는가보다, 얼마나 버티는가" },
  { en: "PENSION", kr: "연금", line: "받는 날의 시간표를 정하는 일" },
  { en: "RETIRE", kr: "노후", line: "매달 나가는 고정비부터 확인합니다" },
  { en: "INSURANCE", kr: "보험", line: "지급 조건과 고지 의무를 봅니다" },
];

const SLOT = 0.46;

/*
 * v5.6 — 손글씨 배너(2026-11-20 확정). 딥블루 바탕은 알파로 지워 두었으므로
 * 어떤 장면 위에 얹어도 사각 테두리 없이 붓글씨만 남는다. 영문 → 한글 순으로 넘긴다.
 */
const SIGN = {
  en: {
    src: withBase("/brand/buffetkimz-calligraphy-en-1400.webp"),
    srcSet: `${withBase("/brand/buffetkimz-calligraphy-en-700.webp")} 700w, ${withBase("/brand/buffetkimz-calligraphy-en-1400.webp")} 1400w`,
    width: 1400,
    height: 467,
  },
  ko: {
    src: withBase("/brand/buffetkimz-calligraphy-ko-720.webp"),
    srcSet: `${withBase("/brand/buffetkimz-calligraphy-ko-360.webp")} 360w, ${withBase("/brand/buffetkimz-calligraphy-ko-720.webp")} 720w`,
    width: 720,
    height: 194,
  },
};
const SIGN_SIZES = "(max-width: 767px) 72vw, 380px";

/** 빛 입자의 반지름·밝기·격자 — 시간 하나로만 결정된다(되감아도 같은 그림). */
const KEYS = {
  radius: [
    [0, 0.45],
    [0.38, 2.6],
    [0.66, 3.35],
    [1.2, 1.35],
    [1.5, 2.7],
    [3.8, 3.5],
    [6.0, 1.6],
    [7.3, 2.3],
    [7.86, 4.6],
    [8.7, 3.3],
    [10.2, 3.0],
    [12, 3.4],
  ] as [number, number][],
  alpha: [
    [0, 0.85],
    [0.7, 1.0],
    [1.5, 0.72],
    [2.1, 0.28],
    [3.6, 0.24],
    [3.9, 0.15],
    [5.9, 0.26],
    [6.9, 0.3],
    [7.88, 0.82],
    [9.2, 0.46],
    [10.2, 0.3],
    [11.4, 0.2],
    [12, 0.55],
  ] as [number, number][],
  grid: [
    [0, 0],
    [6.05, 0],
    [6.75, 1],
    [7.45, 0.3],
    [7.8, 0],
  ] as [number, number][],
  flatten: [
    [0, 0.1],
    [1.5, 0.55],
    [3.9, 0.65],
    [6.0, 0.85],
    [7.8, 0.4],
    [12, 0.5],
  ] as [number, number][],
};

function sample(keys: [number, number][], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const p = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      const e = p * p * (3 - 2 * p);
      return v0 + (v1 - v0) * e;
    }
  }
  return keys[keys.length - 1][1];
}

function sceneIndexAt(t: number): number {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
  return 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => `00:${pad2(Math.floor(t))}.${Math.floor((t % 1) * 10)}`;

export default function BrandFilm({ appsHref = "/apps" }: { appsHref?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!root || !stage || !canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.dataset.filmState = "static";
      setPlaying(false);
      return;
    }

    let killed = false;
    let tl: any = null;
    let draw: ((t: number) => void) | null = null;
    let gsapRef: any = null;
    let inView = true;
    let userPaused = false;
    let lastTick = -1;
    let lastTimer = "";

    const hudScene = root.querySelector<HTMLElement>("[data-film-hud-scene]");
    const hudLabel = root.querySelector<HTMLElement>("[data-film-hud-label]");
    const timer = root.querySelector<HTMLElement>("[data-film-timer]");
    const rail = root.querySelector<HTMLElement>("[data-film-progress]");
    const ticks = Array.from(root.querySelectorAll<HTMLElement>("[data-film-jump]"));
    const playBtn = root.querySelector<HTMLButtonElement>("[data-film-toggle]");
    const staticLayer = root.querySelector<HTMLElement>("[data-film-static]");

    const hud = (t: number) => {
      const i = sceneIndexAt(t);
      if (i !== lastTick) {
        lastTick = i;
        root.dataset.sceneActive = String(i + 1);
        if (hudScene) hudScene.textContent = `${pad2(i + 1)} / ${pad2(SCENES.length)}`;
        if (hudLabel) hudLabel.textContent = SCENES[i].label;
        ticks.forEach((el, k) => {
          el.dataset.on = k === i ? "1" : "0";
          el.setAttribute("aria-current", k === i ? "true" : "false");
        });
      }
      if (rail) rail.style.transform = `scaleX(${Math.min(1, t / TOTAL)})`;
      const label = `${clock(t)} / 00:${TOTAL}.0`;
      if (timer && label !== lastTimer) {
        lastTimer = label;
        timer.textContent = label;
      }
    };

    function paint(t: number) {
      hud(t);
      if (draw) draw(t);
    }

    function setState(s: "playing" | "paused") {
      root.dataset.filmState = s;
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", s === "playing" ? "false" : "true");
        playBtn.setAttribute("aria-label", s === "playing" ? "브랜드 필름 일시정지" : "브랜드 필름 재생");
      }
      setPlaying(s === "playing");
    }

    function onTick() {
      if (tl) paint(tl.time());
    }

    function startLoop() {
      if (!tl) return;
      tl.play();
      if (gsapRef) gsapRef.ticker.add(onTick);
      setState("playing");
    }

    function stopLoop() {
      if (tl) tl.pause();
      if (gsapRef) gsapRef.ticker.remove(onTick);
      paint(tl ? tl.time() : 0);
      setState("paused");
    }

    const control = {
      play: () => {
        userPaused = false;
        startLoop();
      },
      pause: () => {
        userPaused = true;
        stopLoop();
      },
      seek: (t: number) => {
        if (!tl) return;
        const clamped = Math.max(0, Math.min(TOTAL - 0.02, t));
        tl.pause();
        if (gsapRef) gsapRef.ticker.remove(onTick);
        tl.time(clamped);
        paint(clamped);
        setState("paused");
      },
      state: () => root.dataset.filmState ?? "idle",
    };
    (window as any).__bkFilm = { ...control, total: TOTAL, scenes: SCENES };

    (async () => {
      const gsap = (await import("gsap")).gsap;
      if (killed) return;
      gsapRef = gsap;

      /*
       * 가벼운 쪽부터 고른다 — 좁은 화면(폰)은 Canvas 2D 입자로 같은 그림을 그린다.
       * three.js(약 185KB gzip)는 넓은 화면에서만 내려받고, 실패하면 2D로 물러난다.
       */
      const narrow = stage.clientWidth < 720;
      const saveData = (navigator as any).connection?.saveData === true;
      if (narrow || saveData) {
        draw = buildField2D(canvas, stage);
      } else {
        try {
          const THREE = await import("three");
          if (killed) return;
          draw = buildField(THREE, canvas, stage);
          if (!draw) draw = buildField2D(canvas, stage);
        } catch {
          draw = buildField2D(canvas, stage);
        }
      }
      if (killed) return;

      tl = buildTimeline(gsap, root);
      tl.eventCallback("onRepeat", () => hud(0));

      paint(0);
      if (staticLayer) staticLayer.dataset.gone = "1";
      startLoop();

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            inView = entry.isIntersecting;
            if (!inView && root.dataset.filmState === "playing") stopLoop();
            else if (inView && !userPaused && root.dataset.filmState === "paused" && entry.isIntersecting) {
              startLoop();
            }
          });
        },
        { threshold: 0.15 }
      );
      io.observe(stage);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopLoop();
        else if (inView && !userPaused) startLoop();
      });
    })();

    playBtn?.addEventListener("click", () => {
      if (root.dataset.filmState === "playing") control.pause();
      else control.play();
    });
    ticks.forEach((el, k) => {
      el.addEventListener("click", () => control.seek(SCENES[k].start));
    });
    root.querySelectorAll<HTMLElement>("[data-film-skip]").forEach((el) => {
      el.addEventListener("click", () => control.pause());
    });

    return () => {
      killed = true;
      if (gsapRef && tl) gsapRef.ticker.remove(onTick);
      if (tl) tl.kill();
    };
  }, []);

  return (
    <div
      className="film"
      data-film
      data-film-state="loading"
      data-scene-active="1"
      ref={rootRef}
      role="region"
      aria-roledescription="브랜드 모션그래픽"
      aria-label="buffetkimz 12초 브랜드 필름 — 금융·투자·연금·노후·보험 다섯 분야와 기록의 기준을 보여 주는 장면 여섯 개"
    >
      <h1 className="sr-only">
        buffetkimz — 숫자 너머의 기준. 금융·투자·연금·노후·보험을 매일 기록하고, 확인한 기준과 출처를 함께 남깁니다.
      </h1>

      <div className="film-stage" ref={stageRef} data-film-stage>
        <canvas className="film-canvas" ref={canvasRef} aria-hidden="true" />

        <div className="film-scenes">
          {/* Scene 1 — 0.0~1.5 폭발하고 응집하는 빛 */}
          <div className="film-scene" data-scene="1" aria-hidden="true">
            <div className="fs1-core" data-fs1-core />
            <div className="fs1-rings" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <p className="film-mono fs1-cap" data-fs1-cap>
              BUFFETKIMZ · BRAND FILM · 2026
            </p>
          </div>

          {/* Scene 2 — 1.5~3.8 다섯 키워드 0.46초 스왑 */}
          <div className="film-scene" data-scene="2" aria-hidden="true">
            <div className="fs2-wrap">
              <p className="film-mono fs2-kicker">FIVE WORDS · 다섯 개의 단어</p>
              <div className="fs2-stack">
                {WORDS.map((w, i) => (
                  <div className="fs2-word" data-fs2-word={i} key={w.kr}>
                    <span className="fs2-meta">
                      <span className="fs2-en">{w.en}</span>
                      <span className="fs2-sep" aria-hidden="true" />
                      <span className="fs2-no film-mono">{`${pad2(i + 1)} / 05`}</span>
                    </span>
                    <span className="fs2-kr">{w.kr}</span>
                    <span className="fs2-line">{w.line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scene 3 — 3.8~6.0 시간축·현금흐름 곡선 */}
          <div className="film-scene" data-scene="3" aria-hidden="true">
            <div className="fs3-wrap">
              <div className="fs3-head">
                <div>
                  <p className="film-mono fs3-kicker">TIME · COMPOUND</p>
                  <p className="fs3-title">시간이 만드는 차이</p>
                </div>
                <p className="fs3-note">
                  수익률을 약속하지 않습니다.
                  <br />
                  가정과 기준일을 함께 적습니다.
                </p>
              </div>
              <div className="fs3-chart">
                <div className="fs3-legend" data-fs3-legend aria-hidden="true">
                  <span className="fs3-legend-item">
                    <span className="fs3-legend-swatch is-curve" />
                    가정 기반 예시
                  </span>
                  <span className="fs3-legend-item">
                    <span className="fs3-legend-swatch is-flat" />
                    단순 비례 비교선
                  </span>
                </div>
                <svg viewBox="0 0 900 330" className="fs3-svg" aria-hidden="true">
                  <defs>
                    <linearGradient id="bkFilmArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38b795" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="#38b795" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g className="fs3-grid" data-fs3-grid>
                    {[0, 1, 2, 3].map((i) => (
                      <line key={i} x1="40" x2="870" y1={60 + i * 72} y2={60 + i * 72} />
                    ))}
                    {[0, 1, 2, 3].map((i) => (
                      <line key={`v${i}`} x1={40 + i * 276.6} x2={40 + i * 276.6} y1="52" y2="292" />
                    ))}
                  </g>
                  <path
                    className="fs3-area"
                    data-fs3-area
                    d="M40 300 C 210 298 300 288 420 258 C 540 226 640 168 740 104 C 800 66 840 44 870 34 L870 300 Z"
                    fill="url(#bkFilmArea)"
                  />
                  <path
                    className="fs3-line"
                    data-fs3-curve
                    d="M40 300 C 210 298 300 288 420 258 C 540 226 640 168 740 104 C 800 66 840 44 870 34"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1}
                  />
                  <path
                    className="fs3-dash"
                    data-fs3-flat
                    d="M40 300 L870 118"
                  />
                  <circle className="fs3-dot" data-fs3-dot cx="40" cy="300" r="6" />
                </svg>
                <ul className="fs3-axis film-mono">
                  {["0년", "10년", "20년", "30년"].map((y) => (
                    <li key={y}>{y}</li>
                  ))}
                </ul>
              </div>
              <p className="fs3-foot film-mono">
                <span>가정 기반 예시 곡선</span>
                <span>점선 = 단순 비례 비교선</span>
                <span>원금 손실 가능</span>
                <span data-fs3-count>0년</span>
              </p>
            </div>
          </div>

          {/* Scene 4 — 6.0~7.8 서클 와이프 + 기하학 그리드 */}
          <div className="film-scene" data-scene="4" aria-hidden="true">
            <div className="fs4-wipe" data-fs4-wipe />
            <div className="fs4-grid" data-fs4-grid>
              {Array.from({ length: 13 }).map((_, i) => (
                <i key={`v${i}`} className="v" style={{ left: `${(i * 100) / 12}%` }} />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <i key={`h${i}`} className="h" style={{ top: `${(i * 100) / 7}%` }} />
              ))}
            </div>
            <div className="fs4-text">
              <p className="fs4-line" data-fs4-line1>
                다섯 개의 시선,
              </p>
              <p className="fs4-line" data-fs4-line2>
                하나의 기준.
              </p>
            </div>
          </div>

          {/* Scene 5 — 7.8~10.2 시네마틱 브랜드 록업 */}
          <div className="film-scene" data-scene="5" aria-hidden="true">
            <div className="fs5-flash" data-fs5-flash />
            <div className="fs5-wrap">
              <p className="film-mono fs5-kicker" data-fs5-kicker>
                잠깐의 숫자가 아니라, 오래 쓰는 기준
              </p>
              <p className="fs5-title" data-fs5-title>
                숫자 너머의 기준
              </p>
              <p className="fs5-mark" data-fs5-mark>
                <BrandMark tone="dark" />
              </p>
              <p className="fs5-sign" data-fs5-sign>
                <img
                  className="fs5-sign-art"
                  data-fs5-sign-en
                  src={SIGN.en.src}
                  srcSet={SIGN.en.srcSet}
                  sizes={SIGN_SIZES}
                  width={SIGN.en.width}
                  height={SIGN.en.height}
                  alt=""
                  decoding="async"
                />
                <img
                  className="fs5-sign-art"
                  data-fs5-sign-ko
                  src={SIGN.ko.src}
                  srcSet={SIGN.ko.srcSet}
                  sizes={SIGN_SIZES}
                  width={SIGN.ko.width}
                  height={SIGN.ko.height}
                  alt=""
                  decoding="async"
                />
              </p>
              <p className="fs5-sub" data-fs5-sub>
                금융 · 투자 · 연금 · 노후 · 보험을 매일 기록합니다
              </p>
            </div>
            <div className="fs5-sweep" data-fs5-sweep />
          </div>

          {/* Scene 6 — 10.2~12.0 스크롤 큐 */}
          <div className="film-scene" data-scene="6" aria-hidden="true">
            <div className="fs6-wrap">
              <div>
                <p className="film-mono fs6-kicker">NEXT · 다음 장면</p>
                <p className="fs6-title">버핏킴즈는 누구인가</p>
                <p className="fs6-body">
                  숫자를 먼저 확인하는 사람,
                  <br />
                  원문을 믿는 사람, 매일 나누는 사람.
                </p>
                <a className="fs6-link" href="#about" data-film-skip>
                  소개로 이동
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12h15M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
              <div className="fs6-cue" aria-hidden="true">
                <span className="fs6-cue-word">아래로</span>
                <span className="fs6-cue-line">
                  <i />
                </span>
                <svg className="fs6-cue-arrow" viewBox="0 0 24 24">
                  <path d="M12 4v15M6 13l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 정적 록업 — 자바스크립트 없음 · 모션 축소 · 첫 페인트 */}
        <div className="film-static" data-film-static>
          <p className="film-mono film-static-kicker">BUFFETKIMZ · BRAND FILM</p>
          <p className="film-static-title">
            숫자 너머의 기준,
            <br />
            <span className="film-static-mark">
              <BrandMark tone="dark" />
            </span>
          </p>
          <p className="film-static-sign">
            <img
              src={SIGN.en.src}
              srcSet={SIGN.en.srcSet}
              sizes="(max-width: 767px) 62vw, 300px"
              width={SIGN.en.width}
              height={SIGN.en.height}
              alt="BuffetKimz — 붓글씨 브랜드 배너"
              decoding="async"
            />
          </p>
          <p className="film-static-sub">숫자를 확인하고, 기록으로 남깁니다</p>
          <p className="film-mono film-static-fields">금융 · 투자 · 연금 · 노후 · 보험</p>
          <div className="film-static-actions">
            <a className="btn btn-primary film-btn-light" href="#about">
              버핏킴즈 소개
            </a>
            <a className="film-ghost-link" href="#film-credits">
              기록·도구 보기
            </a>
          </div>
        </div>

        {/* HUD — 좌 브랜드 / 우 현재 장면 */}
        <div className="film-hud">
          <div className="film-hud-left">
            <p className="film-hud-brand">
              <BrandMark tone="dark" size="21px" />
              <span className="film-mono">BRAND FILM</span>
            </p>
            <p className="film-hud-line">숫자를 확인하고, 기록으로 남깁니다</p>
          </div>
          <p className="film-hud-scene">
            <span className="film-mono" data-film-hud-scene>
              01 / 06
            </span>
            <span className="film-hud-label" data-film-hud-label>
              빛의 응집
            </span>
          </p>
        </div>

        {/* 컨트롤 — 재생/일시정지 · 장면 인디케이터 · 건너뛰기 */}
        <div className="film-controls" data-film-controls>
          <div className="film-controls-inner">
            <button
              type="button"
              className="film-btn film-btn-toggle"
              data-film-toggle
              aria-pressed="false"
              aria-label="브랜드 필름 일시정지"
            >
              <svg className="film-ico film-ico-pause" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5v14M15 5v14" />
              </svg>
              <svg className="film-ico film-ico-play" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5.5v13l10-6.5z" />
              </svg>
              <span className="film-btn-text">{playing ? "일시정지" : "재생"}</span>
            </button>

            <span className="film-mono film-timer" data-film-timer>
              00:00.0 / 00:12.0
            </span>

            <div className="film-rail" role="group" aria-label="장면 이동">
              <div className="film-rail-track" aria-hidden="true">
                <i data-film-progress />
              </div>
              <div className="film-ticks">
                {SCENES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="film-tick"
                    data-film-jump={s.id}
                    data-on="0"
                    aria-current="false"
                    aria-label={`장면 ${s.id} — ${s.label}로 이동`}
                  >
                    <span className="film-tick-no film-mono">{pad2(s.id)}</span>
                    <span className="film-tick-label">{s.short}</span>
                  </button>
                ))}
              </div>
            </div>

            <a className="film-btn film-skip" href="#about" data-film-skip aria-label="필름 건너뛰고 소개로 이동">
              <span className="film-btn-text">건너뛰기</span>
              <svg className="film-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M12 5l7 7-7 7" />
              </svg>
            </a>

            <div className="film-ctas">
              <a className="film-cta film-cta-primary" href="#about">
                소개 보기
              </a>
              <a className="film-cta" href={appsHref}>
                도구 둘러보기
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas 2D — 폰·저사양용 경량 입자(같은 KEYS, 같은 그림)            */
/* ------------------------------------------------------------------ */
type P2 = { x: number; y: number; z: number; seed: number; size: number; sprite: HTMLCanvasElement; gx: number; gy: number; gz: number };

function buildField2D(canvas: HTMLCanvasElement, stage: HTMLElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const COUNT = 760;
  const palette = ["#38b795", "#63b8ff", "#dff2ff", "#1f7a62", "#8ce8cd"];
  const gxN = 20;
  const gyN = 11;

  // 작은 빛 스프라이트를 색마다 한 번만 만들어 두고 확대해 찍는다(매 프레임 그라디언트 생성 금지).
  const sprites = palette.map((c) => {
    const s = document.createElement("canvas");
    s.width = 32;
    s.height = 32;
    const g = s.getContext("2d")!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, c);
    grad.addColorStop(0.34, c);
    grad.addColorStop(1, "rgba(4,16,26,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(16, 16, 16, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "destination-in";
    const fade = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    fade.addColorStop(0, "rgba(255,255,255,1)");
    fade.addColorStop(0.55, "rgba(255,255,255,0.7)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, 32, 32);
    return s;
  });

  const pts: P2[] = [];
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 0.55 + 0.45 * Math.pow(Math.random(), 0.6);
    const iz = Math.floor(i / (gxN * gyN));
    pts.push({
      x: Math.sin(phi) * Math.cos(theta) * r,
      y: Math.cos(phi) * r * 0.8,
      z: Math.sin(phi) * Math.sin(theta) * r * 0.75,
      seed: Math.random(),
      size: 0.5 + Math.random() * 1.5,
      sprite: sprites[Math.floor(Math.random() * sprites.length)],
      gx: (i % gxN - (gxN - 1) / 2) * 0.42,
      gy: (Math.floor(i / gxN) % gyN - (gyN - 1) / 2) * 0.42,
      gz: (iz - 2) * 0.42,
    });
  }

  let lastT = -1;
  const draw = (t: number) => {
    if (Math.abs(t - lastT) < 0.0005) return;
    lastT = t;

    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const R = sample(KEYS.radius, t);
    const A = Math.min(1, sample(KEYS.alpha, t) * 1.15);
    const G = sample(KEYS.grid, t);
    const F = sample(KEYS.flatten, t);
    const swirl = t * 0.42 + 0.6;
    const f = h * 0.5 / Math.tan((52 * Math.PI) / 360);
    const cx = w / 2;
    const cy = h / 2;

    ctx.globalCompositeOperation = "lighter";
    for (const p of pts) {
      const r = R * (0.62 + 0.62 * ((p.seed * 17.3) % 1));
      const ang = swirl * (0.5 + p.seed * 1.4);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);

      let x = (p.x * ca - p.z * sa) * r;
      let y = p.y * r * (1 - 0.48 * F);
      let z = (p.x * sa + p.z * ca) * r;

      if (G > 0) {
        const wob = Math.sin(t * 0.9 + p.gx * 3) * 0.04 * (1 - G);
        x = x + (p.gx - x) * G;
        y = y + (p.gy + wob - y) * G;
        z = z + (p.gz - z) * G;
      }

      const depth = Math.max(1.4, 6.4 - z);
      const sx = cx + (x * f) / depth;
      const sy = cy - (y * f) / depth;
      if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

      const tw = 0.55 + 0.45 * Math.sin(t * 3.1 + p.seed * 61);
      const size = (p.size * f) / depth * 0.028 * (0.6 + 0.4 * tw);
      const alpha = A * (0.16 + 0.34 * tw) * (1 - G * (0.3 - 0.2 * p.seed));
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(p.sprite, sx - size, sy - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  draw(0);
  window.addEventListener("resize", () => draw(lastT < 0 ? 0 : lastT + 0.0001));
  return draw;
}

/* ------------------------------------------------------------------ */
/*  three.js — 빛의 입자. t 하나로 위치·밝기가 결정된다.               */
/* ------------------------------------------------------------------ */
function buildField(THREE: any, canvas: HTMLCanvasElement, stage: HTMLElement) {
  let renderer: any;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 0, 6.4);

  const wide = stage.clientWidth >= 720;
  const COUNT = wide ? 2600 : 1200;

  const dir = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);
  const color = new Float32Array(COUNT * 3);
  const gridPos = new Float32Array(COUNT * 3);
  const pos = new Float32Array(COUNT * 3);

  const palette = [
    [0.22, 0.72, 0.58],
    [0.38, 0.76, 1.0],
    [0.86, 0.96, 1.0],
    [0.12, 0.48, 0.4],
    [0.55, 0.9, 0.82],
  ];

  const gx = 20;
  const gy = 11;
  const gz = Math.ceil(COUNT / (gx * gy));

  for (let i = 0; i < COUNT; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 0.55 + 0.45 * Math.pow(Math.random(), 0.6);
    dir[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    dir[i * 3 + 1] = Math.cos(phi) * r * 0.8;
    dir[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.75;

    seed[i] = Math.random();
    size[i] = 0.5 + Math.random() * 1.5;

    const c = palette[Math.floor(Math.random() * palette.length)];
    const k = 0.55 + Math.random() * 0.55;
    color[i * 3] = c[0] * k;
    color[i * 3 + 1] = c[1] * k;
    color[i * 3 + 2] = c[2] * k;

    const ix = i % gx;
    const iy = Math.floor(i / gx) % gy;
    const iz = Math.floor(i / (gx * gy));
    gridPos[i * 3] = (ix - (gx - 1) / 2) * 0.42 + (Math.random() - 0.5) * 0.03;
    gridPos[i * 3 + 1] = (iy - (gy - 1) / 2) * 0.42 + (Math.random() - 0.5) * 0.03;
    gridPos[i * 3 + 2] = (iz - (gz - 1) / 2) * 0.42 + (Math.random() - 0.5) * 0.03;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  geo.setAttribute("aGridPos", new THREE.BufferAttribute(gridPos, 3));

  const uniforms = {
    uTime: { value: 0 },
    uRadius: { value: 0.45 },
    uSwirl: { value: 0 },
    uGrid: { value: 0 },
    uAlpha: { value: 0.9 },
    uSize: { value: wide ? 26 : 22 },
    uFlatten: { value: 0.1 },
    uDpr: { value: dpr },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uRadius, uSwirl, uGrid, uAlpha, uSize, uFlatten, uDpr;
      attribute vec3 aDir, aColor, aGridPos;
      attribute float aSeed, aSize;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float s = aSeed;
        float r = uRadius * (0.62 + 0.62 * fract(s * 17.3));

        float ang = uSwirl * (0.5 + s * 1.4);
        float ca = cos(ang), sa = sin(ang);
        vec3 p = vec3(aDir.x * ca - aDir.z * sa, aDir.y, aDir.x * sa + aDir.z * ca) * r;

        p.y *= mix(1.0, 0.52, uFlatten);
        p += aDir * (0.05 + 0.05 * sin(uTime * 2.0 + s * 44.0));

        vec3 g = aGridPos + vec3(0.0, sin(uTime * 0.9 + aGridPos.x * 3.0) * 0.04, 0.0);
        p = mix(p, g, uGrid);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        float tw = 0.55 + 0.45 * sin(uTime * 3.1 + s * 61.0);
        gl_PointSize = uSize * aSize * (0.45 + 0.55 * tw) * uDpr / max(0.6, -mv.z);
        vAlpha = uAlpha * (0.3 + 0.7 * tw) * (1.0 - uGrid * (0.45 - 0.25 * s));
        vColor = aColor;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor, a * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, material);
  scene.add(points);

  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    draw(lastT < 0 ? 0 : lastT);
  };

  let lastT = -1;
  const draw = (t: number) => {
    if (Math.abs(t - lastT) < 0.0005) return;
    lastT = t;
    uniforms.uTime.value = t;
    uniforms.uRadius.value = sample(KEYS.radius, t);
    uniforms.uAlpha.value = sample(KEYS.alpha, t);
    uniforms.uGrid.value = sample(KEYS.grid, t);
    uniforms.uFlatten.value = sample(KEYS.flatten, t);
    uniforms.uSwirl.value = t * 0.42 + 0.6;
    points.rotation.z = Math.sin(t * 0.22) * 0.06;
    points.rotation.x = Math.sin(t * 0.17) * 0.05;
    camera.position.z = 6.4 + Math.sin(t * 0.35) * 0.22;
    renderer.render(scene, camera);
  };

  resize();
  window.addEventListener("resize", resize);
  draw(0);
  return draw;
}

/* ------------------------------------------------------------------ */
/*  GSAP — 12초 마스터 타임라인                                        */
/* ------------------------------------------------------------------ */
function buildTimeline(gsap: any, root: HTMLElement) {
  const q = (sel: string) => root.querySelector<HTMLElement>(sel);
  const qa = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

  const tl = gsap.timeline({ paused: true, repeat: -1, defaults: { ease: "power3.out" } });

  SCENES.forEach((s) => {
    const el = q(`[data-scene="${s.id}"]`);
    if (!el) return;
    tl.set(el, { autoAlpha: 1 }, s.start);
    tl.set(el, { autoAlpha: 0 }, Math.max(s.start + 0.01, s.end - 0.001));
  });

  /* Scene 1 — 폭발 & 응집 ------------------------------------------- */
  const core = q("[data-fs1-core]");
  if (core) {
    tl.fromTo(core, { scale: 0.12, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.44, ease: "power2.out" }, 0)
      .to(core, { scale: 2.7, autoAlpha: 0.22, duration: 0.86, ease: "power2.inOut" }, 0.5)
      .to(core, { autoAlpha: 0, duration: 0.25 }, 1.25);
  }
  qa(".fs1-rings > i").forEach((ring, i) => {
    tl.fromTo(
      ring,
      { scale: 0.15, autoAlpha: 0 },
      { scale: 1.7 + i * 0.35, autoAlpha: 0.42, duration: 1.0 + i * 0.1, ease: "power3.out" },
      0.06 + i * 0.12
    ).to(ring, { autoAlpha: 0, duration: 0.45, ease: "power2.in" }, 0.95 + i * 0.1);
  });
  const cap1 = q("[data-fs1-cap]");
  if (cap1) {
    tl.fromTo(cap1, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.36 }, 0.62).to(
      cap1,
      { autoAlpha: 0, duration: 0.22 },
      1.22
    );
  }

  /* Scene 2 — 0.46초 단위 키네틱 타이포 ------------------------------ */
  qa("[data-fs2-word]").forEach((el, i) => {
    const start = 1.5 + i * SLOT;
    const out = start + SLOT - 0.17;
    tl.fromTo(
      el,
      { yPercent: 118, autoAlpha: 0, skewY: 2.6 },
      { yPercent: 0, autoAlpha: 1, skewY: 0, duration: 0.15, ease: "power4.out" },
      start
    ).to(el, { yPercent: -112, autoAlpha: 0, duration: 0.1, ease: "power3.in" }, out);
  });
  const kicker2 = q(".fs2-kicker");
  if (kicker2) {
    tl.fromTo(kicker2, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.3 }, 1.52).to(
      kicker2,
      { autoAlpha: 0, duration: 0.2 },
      3.55
    );
  }

  /* Scene 3 — 곡선 드로잉 -------------------------------------------- */
  const grid3 = q("[data-fs3-grid]");
  if (grid3) tl.fromTo(grid3, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 3.82);
  tl.fromTo(
    qa(".fs3-head > div, .fs3-note"),
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.08 },
    3.84
  );
  tl.fromTo(qa(".fs3-axis > li, .fs3-foot, .fs3-legend"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, stagger: 0.05 }, 4.1);

  const curve = q("[data-fs3-curve]");
  const area = q("[data-fs3-area]");
  const flat = q("[data-fs3-flat]");
  if (area) tl.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 4.4);
  if (curve)
    tl.fromTo(curve, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.15, ease: "power2.inOut" }, 3.96);
  if (flat) tl.fromTo(flat, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" }, 4.32);

  const dot = q("[data-fs3-dot]");
  const count = q("[data-fs3-count]");
  if (curve && dot) {
    const pathEl = curve as unknown as SVGPathElement;
    const proxy = { p: 0 };
    tl.to(
      proxy,
      {
        p: 1,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => {
          const len = pathEl.getTotalLength();
          const pt = pathEl.getPointAtLength(len * proxy.p);
          dot.setAttribute("cx", String(pt.x));
          dot.setAttribute("cy", String(pt.y));
          if (count) count.textContent = `${Math.round(30 * proxy.p)}년`;
        },
      },
      4.0
    );
  }

  /* Scene 4 — 서클 와이프 + 격자 ------------------------------------- */
  const wipe = q("[data-fs4-wipe]");
  if (wipe) {
    tl.set(wipe, { clipPath: "circle(0% at 50% 50%)" }, 6.0).to(
      wipe,
      { clipPath: "circle(150% at 50% 50%)", duration: 0.62, ease: "power3.inOut" },
      6.0
    );
  }
  const g4 = q("[data-fs4-grid]");
  if (g4) tl.fromTo(g4, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 0.55 }, 6.12);
  const l1 = q("[data-fs4-line1]");
  const l2 = q("[data-fs4-line2]");
  if (l1)
    tl.fromTo(l1, { yPercent: 112, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.24, ease: "power4.out" }, 6.5);
  if (l2)
    tl.fromTo(l2, { yPercent: 112, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.24, ease: "power4.out" }, 6.62);
  if (g4) tl.to(g4, { autoAlpha: 0.25, duration: 0.4 }, 7.36);

  /* Scene 5 — 시네마틱 록업 ------------------------------------------ */
  const flash = q("[data-fs5-flash]");
  if (flash)
    tl.fromTo(flash, { autoAlpha: 0 }, { autoAlpha: 0.5, duration: 0.18, ease: "power2.out" }, 7.82).to(
      flash,
      { autoAlpha: 0, duration: 0.62, ease: "power2.in" },
      8.06
    );
  const k5 = q("[data-fs5-kicker]");
  const t5 = q("[data-fs5-title]");
  const m5 = q("[data-fs5-mark]");
  const s5 = q("[data-fs5-sub]");
  if (k5) tl.fromTo(k5, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 7.9);
  if (t5)
    tl.fromTo(
      t5,
      { autoAlpha: 0, y: 22, letterSpacing: "0.12em" },
      { autoAlpha: 1, y: 0, letterSpacing: "-0.04em", duration: 0.5 },
      7.98
    );
  if (m5)
    tl.fromTo(
      m5,
      { autoAlpha: 0, scale: 0.9, filter: "blur(12px)" },
      { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.62, ease: "power3.out" },
      8.16
    ).to(m5, { scale: 1.015, duration: 0.6, ease: "sine.inOut" }, 8.85);
  if (s5) tl.fromTo(s5, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 8.52);

  /* 손글씨 배너 — 영문이 먼저 지워지듯 나타났다가 한글로 넘어가 씬 끝까지 남는다 */
  const signEn = q("[data-fs5-sign-en]");
  const signKo = q("[data-fs5-sign-ko]");
  if (signEn)
    tl.fromTo(
      signEn,
      { autoAlpha: 0, scale: 1.05, filter: "blur(10px)", clipPath: "inset(0% 10% 0% 10%)" },
      { autoAlpha: 1, scale: 1, filter: "blur(0px)", clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "power2.out" },
      8.3
    ).to(signEn, { autoAlpha: 0, scale: 1.02, duration: 0.32, ease: "power2.inOut" }, 9.02);
  if (signKo)
    tl.fromTo(
      signKo,
      { autoAlpha: 0, scale: 1.06, filter: "blur(10px)", clipPath: "inset(0% 10% 0% 10%)" },
      { autoAlpha: 1, scale: 1, filter: "blur(0px)", clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, ease: "power2.out" },
      9.1
    );
  const sweep = q("[data-fs5-sweep]");
  if (sweep)
    tl.fromTo(
      sweep,
      { xPercent: -130, autoAlpha: 0 },
      { xPercent: 130, autoAlpha: 0.9, duration: 0.85, ease: "power2.inOut" },
      8.2
    ).to(sweep, { autoAlpha: 0, duration: 0.1 }, 9.02);

  /* Scene 6 — 스크롤 큐 ---------------------------------------------- */
  const q6 = qa(".fs6-wrap > div:first-child > *, .fs6-cue");
  tl.fromTo(q6, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.09 }, 10.28);
  const wrap6 = q(".fs6-wrap");
  if (wrap6) tl.to(wrap6, { autoAlpha: 0.55, duration: 0.32, ease: "power2.in" }, 11.66);

  return tl;
}
