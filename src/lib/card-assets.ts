/**
 * 카드뉴스 자산 확인 — 빌드 시점에 `public/gallery/`에 실제로 있는 PNG만 센다.
 *
 * 왜 필요한가
 *  · 카드 6장은 이미지 제작과 페이지 작업이 따로 진행된다. 선언만 6장으로 두면,
 *    이미지가 아직 없을 때 화면이 '6장'이라 말하고 빈 칸을 그리게 된다.
 *  · 그래서 개수와 미리보기는 항상 '실제 파일'을 기준으로 한다. 파일이 들어오면 다음 빌드에서
 *    개수도 미리보기도 함께 늘어난다(코드 수정 없음).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LessonCardSet, LessonCardSlide } from "@/data/academy-lessons";

/**
 * public 폴더의 실제 위치 — 빌드는 앱 루트에서 돌지만, 번들된 모듈에서는 import.meta.url이
 * 파일 URL이 아닐 수 있다. 두 방법을 모두 시도해 gallery 폴더가 있는 쪽을 쓴다.
 */
function resolvePublicDir(): string {
  const candidates = [path.resolve(process.cwd(), "public")];
  try {
    candidates.push(path.resolve(fileURLToPath(new URL("../../public/", import.meta.url))));
  } catch {
    /* import.meta.url을 파일 경로로 풀 수 없으면 cwd 기준만 쓴다 */
  }
  return candidates.find((dir) => fs.existsSync(path.join(dir, "gallery"))) ?? candidates[0];
}

const publicDir = resolvePublicDir();

/** 실제로 존재하는 카드만 — 파일이 없으면 빈 이미지를 그리지 않는다 */
export function availableSlides(set: LessonCardSet): LessonCardSlide[] {
  return set.slides.filter((s) => {
    try {
      return fs.existsSync(path.join(publicDir, s.src));
    } catch {
      return false;
    }
  });
}

/** 화면에 적는 카드 수 — 없으면 `0` */
export const availableCount = (set: LessonCardSet): number => availableSlides(set).length;
