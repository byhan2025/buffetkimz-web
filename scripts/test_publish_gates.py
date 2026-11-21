#!/usr/bin/env python3
"""v6.0 발행 게이트 단위 테스트 — Answer-First · Information-Gain · 100점 리뷰(해시 결속) · 화면 게이트.

스펙: reports/buffetkimz-web/v60-pension-sim/01-publish-gate-spec.md
실행: python3 scripts/test_publish_gates.py      (종료 코드 0 = 전부 통과)

원칙
  · 신규 초안(mode="draft")은 error로 막고, 이미 발행된 아카이브(mode="archive")는 warn 그림자 모드다.
  · 리뷰는 파일이 아니라 **초안 해시**에 결속된다 — 초안이 바뀌면 리뷰가 무효가 되는지 확인한다.
"""
from __future__ import annotations

import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import publish_pipeline as pipe  # noqa: E402

CFG = pipe.load_rules()

GOOD_DESC = "연금저축·IRP에 합산 900만원까지 넣으면 세액공제 148만원을 돌려받습니다."
GOOD_BODY = (
    "올해 연금저축·IRP 세액공제 한도는 합산 900만원입니다. "
    "총급여 5,500만원 이하면 16.5%를 적용해 148만5,000원까지 돌려받습니다.\n\n"
    "## 왜 900만원인가\n\n연금저축 600만원과 IRP 300만원이 각각 따로 있습니다.\n"
)


def make_post(tmp: pathlib.Path, body: str = GOOD_BODY, description: str = GOOD_DESC, **fm_extra) -> pipe.Post:
    fm = {
        "title": "연금계좌 세액공제 900만원 한도",
        "category": "pension",
        "description": description,
        "publishedAt": "2026-11-21",
        "baseDate": "2026-11-21",
        "tags": ["연금저축", "세액공제"],
        "sources": [{"label": "소득세법 제59조의3", "url": "https://www.law.go.kr/"}],
    }
    fm.update(fm_extra)
    slug = fm_extra.get("slug_override", "test-post")
    fm.pop("slug_override", None)
    path = tmp / f"{slug}.md"
    path.write_text(pipe.emit_frontmatter(fm) + "\n\n" + body, encoding="utf-8")
    return pipe.Post(slug=slug, path=path, fm=fm, body=body)


def codes(findings: list[pipe.Finding]) -> list[str]:
    return [f.code for f in findings]


def levels(findings: list[pipe.Finding]) -> dict[str, int]:
    out = {"error": 0, "warn": 0, "info": 0}
    for f in findings:
        out[f.level] += 1
    return out


class AnswerFirstTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="gate-af-"))

    def test_요약에_숫자가_없으면_초안_차단(self) -> None:
        post = make_post(self.tmp, description="연금계좌 세액공제를 정리했습니다.")
        found = pipe.check_answer_first(post, CFG, "draft")
        self.assertIn("answer-first-desc", codes(found))
        self.assertEqual(levels(found)["error"], 1)

    def test_본문_첫_300자에_직답이_없으면_차단(self) -> None:
        body = "요즘 연금 이야기가 많습니다. 배경을 먼저 살펴보겠습니다.\n\n" + "가" * 320 + "\n\n## 본론\n\n900만원이 한도입니다."
        post = make_post(self.tmp, body=body)
        found = pipe.check_answer_first(post, CFG, "draft")
        self.assertIn("answer-first-body", codes(found))

    def test_직답이_있으면_통과(self) -> None:
        post = make_post(self.tmp)
        found = pipe.check_answer_first(post, CFG, "draft")
        self.assertNotIn("answer-first-desc", codes(found))
        self.assertNotIn("answer-first-body", codes(found))

    def test_첫_소제목이_직답보다_앞이면_경고(self) -> None:
        body = "## 배경\n\n연금계좌는 2014년에 개편됐습니다. " + "가" * 100 + " 한도는 900만원입니다."
        post = make_post(self.tmp, body=body)
        found = pipe.check_answer_first(post, CFG, "draft")
        self.assertIn("answer-first-order", codes(found))
        self.assertEqual(levels(found)["warn"], 1)

    def test_아카이브는_경고까지만(self) -> None:
        post = make_post(self.tmp, description="연금계좌 세액공제를 정리했습니다.")
        found = pipe.check_answer_first(post, CFG, "archive")
        self.assertEqual(levels(found)["error"], 0)
        self.assertGreaterEqual(levels(found)["warn"], 1)


class InformationGainTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="gate-ig-"))

    def test_gain이_없으면_차단(self) -> None:
        post = make_post(self.tmp)
        found = pipe.check_information_gain(post, CFG, "draft")
        self.assertEqual(codes(found), ["information-gain"])
        self.assertEqual(found[0].level, "error")

    def test_gain이_짧으면_차단(self) -> None:
        post = make_post(self.tmp, gain="연금 한도 정리")
        self.assertIn("information-gain-short", codes(pipe.check_information_gain(post, CFG, "draft")))

    def test_상투어면_차단(self) -> None:
        post = make_post(self.tmp, gain="연금 인출 세금을 자세히 정리한 글")
        self.assertIn("information-gain-cliche", codes(pipe.check_information_gain(post, CFG, "draft")))

    def test_gainType이_없으면_경고(self) -> None:
        post = make_post(self.tmp, gain="국세청 상담 12건에서 사적연금 피부양자 포함 여부가 갈린 지점을 표로 정리")
        found = pipe.check_information_gain(post, CFG, "draft")
        self.assertIn("information-gain-type", codes(found))
        self.assertEqual(levels(found)["error"], 0)

    def test_tool_타입인데_toolHref가_없으면_차단(self) -> None:
        post = make_post(
            self.tmp,
            gain="인출 세금 두 갈래를 같은 화면에서 비교하는 계산기를 새로 만들었다",
            gainType="tool",
        )
        self.assertIn("information-gain-tool", codes(pipe.check_information_gain(post, CFG, "draft")))

    def test_좋은_gain_문장은_통과(self) -> None:
        post = make_post(
            self.tmp,
            gain="국세청 상담 12건에서 사적연금 피부양자 포함 여부가 갈린 지점을 표로 정리",
            gainType="original-data",
        )
        found = pipe.check_information_gain(post, CFG, "draft")
        self.assertEqual([f.code for f in found if f.level == "error"], [])

    def test_아카이브는_경고까지만(self) -> None:
        post = make_post(self.tmp)
        found = pipe.check_information_gain(post, CFG, "archive")
        self.assertEqual(found[0].level, "warn")


class ReviewGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="gate-rv-"))
        self.reviews = self.tmp / "reviews"
        self.reviews.mkdir()
        self._old = pipe.REVIEW_DIR
        pipe.REVIEW_DIR = self.reviews
        self.post = make_post(self.tmp)

    def tearDown(self) -> None:
        pipe.REVIEW_DIR = self._old

    def write_review(self, **over) -> pathlib.Path:
        data = {
            "slug": self.post.slug,
            "reviewedDraftHash": pipe.draft_digest(self.post),
            "scores": {"content": 27, "evidence": 23, "search": 18, "ai": 13, "tech": 9},
            "total": 90,
            "p0": [],
            "reviewer": "회의실 4호 봇 + 한대리 교차",
            "reviewedAt": "2026-11-21T10:12:00+09:00",
            "blocking": False,
        }
        data.update(over)
        path = self.reviews / f"{self.post.slug}.review.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def test_리뷰_파일이_없으면_차단(self) -> None:
        found = pipe.check_review(self.post, CFG, "draft")
        self.assertIn("review-missing", codes(found))
        self.assertEqual(found[0].level, "error")

    def test_초안이_바뀌면_리뷰_무효(self) -> None:
        self.write_review(reviewedDraftHash="sha256:" + "0" * 64)
        self.assertIn("review-stale", codes(pipe.check_review(self.post, CFG, "draft")))

    def test_초안을_고치면_저장된_해시가_달라져_무효(self) -> None:
        self.write_review()
        self.assertEqual([f for f in pipe.check_review(self.post, CFG, "draft") if f.level == "error"], [])
        body = GOOD_BODY + "\n한 줄을 더 고쳤습니다.\n"
        self.post = make_post(self.tmp, body=body)
        self.assertIn("review-stale", codes(pipe.check_review(self.post, CFG, "draft")))

    def test_합계가_범주합과_다르면_차단(self) -> None:
        self.write_review(total=95)  # 범주 합 90
        self.assertIn("review-total-mismatch", codes(pipe.check_review(self.post, CFG, "draft")))

    def test_90점_미만이면_차단(self) -> None:
        self.write_review(scores={"content": 24, "evidence": 20, "search": 16, "ai": 12, "tech": 8}, total=80)
        self.assertIn("review-blocking", codes(pipe.check_review(self.post, CFG, "draft")))

    def test_P0가_남아_있으면_차단(self) -> None:
        self.write_review(p0=["unsourced-key-number"])
        self.assertIn("review-blocking", codes(pipe.check_review(self.post, CFG, "draft")))

    def test_정상_리뷰는_통과(self) -> None:
        self.write_review()
        found = pipe.check_review(self.post, CFG, "draft")
        self.assertEqual([f for f in found if f.level == "error"], [])

    def test_아카이브는_리뷰가_없어도_경고까지만(self) -> None:
        found = pipe.check_review(self.post, CFG, "archive")
        self.assertEqual(found[0].level, "warn")


class VisualGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="gate-vis-"))
        self._old = pipe.REPORT_DIR
        pipe.REPORT_DIR = self.tmp

    def tearDown(self) -> None:
        pipe.REPORT_DIR = self._old

    def test_계측_파일이_없으면_차단(self) -> None:
        found = pipe.check_visual_gate(CFG, "draft")
        self.assertIn("gate-visual-missing", codes(found))

    def test_계측_실패가_있으면_차단(self) -> None:
        (self.tmp / "mobile-390.json").write_text(
            json.dumps({"failures": ["[mobile390] 가로 넘침 4px"], "warnings": [], "summary": ""}), encoding="utf-8"
        )
        found = pipe.check_visual_gate(CFG, "draft")
        self.assertIn("gate-visual-fail", codes(found))

    def test_계측이_정상이면_통과(self) -> None:
        (self.tmp / "mobile-390.json").write_text(
            json.dumps({"failures": [], "warnings": [], "summary": "본문 16px · 가로 넘침 0px"}), encoding="utf-8"
        )
        self.assertEqual([f for f in pipe.check_visual_gate(CFG, "draft") if f.level == "error"], [])


class RuleCoherenceTest(unittest.TestCase):
    def test_규칙_파일에_gates와_루브릭이_있다(self) -> None:
        self.assertIn("gates", CFG)
        self.assertEqual(CFG["rubric"]["block_below"], 90)
        self.assertEqual(sum(CFG["rubric"][k] for k in ("content", "evidence", "search", "ai", "tech")), 100)
        for name in ("answer_first", "information_gain", "review", "visual", "links"):
            self.assertIn(name, CFG["gates"])

    def test_게이트를_끄면_아무것도_보고하지_않는다(self) -> None:
        cfg = json.loads(json.dumps(CFG))
        for g in cfg["gates"].values():
            if isinstance(g, dict):
                g["enabled"] = False
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="gate-off-"))
        post = make_post(tmp)
        self.assertEqual(pipe.check_answer_first(post, cfg, "draft"), [])
        self.assertEqual(pipe.check_information_gain(post, cfg, "draft"), [])
        self.assertEqual(pipe.check_visual_gate(cfg, "draft"), [])

    def test_실제_아카이브는_차단되지_않는다(self) -> None:
        archive = pipe.load_posts()
        self.assertGreater(len(archive), 0)
        errors = 0
        for post in archive:
            others = [p for p in archive if p.slug != post.slug]
            errors += len([f for f in pipe.validate_post(post, CFG, others, mode="archive") if f.level == "error"])
        self.assertEqual(errors, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
