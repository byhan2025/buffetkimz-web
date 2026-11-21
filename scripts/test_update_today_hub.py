#!/usr/bin/env python3
"""`scripts/update_today_hub.py` 단위 테스트 (v5.9.3).

실행: python3 scripts/test_update_today_hub.py -v
  · 성공 회차: 기준 시각·지표 값·카드 시각이 바뀌고 status: "ok"
  · 실패 회차: 값은 그대로, status: "failed" + lastGoodAsOf, 카드도 실패로 표시
  · 거부: 없는 id / 금지어 / 잘못된 시각 / 라벨·링크 불일치 → 파일이 바뀌지 않는다
  · CLI: --dry-run 은 쓰지 않고, 검증 실패면 원본 유지, 성공이면 원자적 교체
  · 결과 파일은 Node로 실제 import 해 값이 맞는지 확인(선택)
  · v5.9.3: scheduleConnected 는 **성공 회차 + --schedule-connected 플래그** 둘 다일 때만 true.
    수동 실행·`--fail` 실행은 false 를 그대로 둔다(실패 회차에 플래그가 와도 false).
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import update_today_hub as hub  # noqa: E402

APP = pathlib.Path(__file__).resolve().parent.parent
REAL = hub.DEFAULT_FILE


def read(text: str, key: str, iid: str | None = None) -> str:
    """갱신 결과에서 확인용 값만 꺼낸다(테스트가 정규식에 덜 묶이게)."""
    if key in ("asOf", "nextCheckAt"):
        pattern = rf'const ({"AS_OF" if key == "asOf" else "NEXT_CHECK"}) = "([^"]*)";'
    elif key == "status":
        return hub.HEADER_RE.search(text).group(0)
    elif key == "item":
        block = hub.block_of(text, "id", iid)
        return block or ""
    elif key == "indicator":
        block = hub.block_of(text, "id", iid)
        return block or ""
    else:
        raise KeyError(key)
    return hub.re.search(pattern, text).group(2)


class UpdateTextTest(unittest.TestCase):
    def setUp(self):
        self.text = REAL.read_text(encoding="utf-8")
        self.current = hub.snapshot(self.text)

    def ok_payload(self, **over):
        payload = {
            "asOf": over.get("asOf", "2026-11-21T19:00:41+09:00"),
            "nextCheckAt": over.get("nextCheckAt", "2026-11-22T06:00:00+09:00"),
            "indicators": [
                {
                    "id": "kospi",
                    "value": over.get("kospi", "4,912.35"),
                    "change": "+0.87%",
                    "direction": "up",
                    "asOf": "2026-11-21T15:30:00+09:00",
                    "asOfLabel": "장 마감 11. 21.",
                    "source": "한국거래소",
                    "sourceUrl": "https://www.yna.co.kr/view/AKR20261121123400008",
                    "basis": "42.39포인트 올림",
                }
            ],
        }
        payload.update({k: v for k, v in over.items() if k in ("items", "highlights", "ai", "status")})
        return payload

    # ---- 성공 회차
    def test_ok_run_updates_basis_and_indicator(self):
        updated, plan = hub.update_text(self.text, self.ok_payload())
        self.assertEqual(plan["status"], "ok")
        self.assertEqual(read(updated, "asOf"), "2026-11-21T19:00:41+09:00")
        self.assertEqual(read(updated, "nextCheckAt"), "2026-11-22T06:00:00+09:00")
        self.assertIn('status: "ok"', read(updated, "status"))
        block = read(updated, "indicator", "kospi")
        self.assertIn('value: "4,912.35"', block)
        self.assertIn('direction: "up"', block)
        self.assertIn('asOfLabel: "장 마감 11. 21."', block)
        self.assertIn("42.39포인트 올림", block)

    def test_ok_run_moves_every_card_reference_time(self):
        updated, _ = hub.update_text(self.text, self.ok_payload())
        for iid in self.current["item_ids"]:
            block = read(updated, "item", iid)
            self.assertIn('asOf: "2026-11-21T19:00:41+09:00"', block, iid)
            self.assertIn('fetchedAt: "2026-11-21T19:00:41+09:00"', block, iid)
            self.assertIn('nextCheckAt: "2026-11-22T06:00:00+09:00"', block, iid)
            self.assertIn('status: "ok"', block, iid)
            self.assertNotIn("lastGoodAsOf", block, iid)

    def test_ok_run_is_stable_when_repeated(self):
        once, _ = hub.update_text(self.text, self.ok_payload())
        twice, _ = hub.update_text(once, self.ok_payload())
        self.assertEqual(once, twice)

    def test_other_indicators_untouched(self):
        updated, _ = hub.update_text(self.text, self.ok_payload())
        before = hub.block_of(self.text, "id", "nasdaq")
        after = hub.block_of(updated, "id", "nasdaq")
        self.assertEqual(before, after)

    def test_ok_run_can_mark_one_card_failed(self):
        payload = self.ok_payload(items=[{"id": "mid-tax-2026", "status": "failed"}])
        updated, plan = hub.update_text(self.text, payload)
        self.assertEqual(plan["items"][0]["status"], "failed")
        block = read(updated, "item", "mid-tax-2026")
        self.assertIn('status: "failed"', block)
        self.assertIn("lastGoodAsOf", block)
        # 실패 카드는 기준 시각을 올리지 않는다 — 직전 값을 그대로 보여 준다
        self.assertIn('asOf: AS_OF', block)

    def test_highlights_and_ai_replaced(self):
        payload = self.ok_payload(
            highlights=[
                {"text": "코스피 4,912.35(+0.87%)로 마감", "meta": "장 마감 11. 21."},
                {"text": "미국 3대 지수 혼조", "meta": "마감 11. 22. 06:00"},
            ],
            ai={
                "label": "AI 정리",
                "asOf": "2026-11-21T18:40:00+09:00",
                "asOfLabel": "기준 11. 21. 18:40",
                "sourceLabel": "연합뉴스 — 마감 시황 (2026. 11. 21. 18:40)",
                "sourceUrl": "https://www.yna.co.kr/view/AKR20261121009252072",
                "lines": ["첫 줄입니다.", "둘째 줄입니다.", "셋째 줄입니다."],
                "note": "AI가 정리한 요약이며 원문과 다를 수 있습니다.",
            },
        )
        updated, _ = hub.update_text(self.text, payload)
        high = updated[updated.find("  highlights: [") : updated.find("\n  ],\n", updated.find("  highlights: ["))]
        self.assertIn("코스피 4,912.35(+0.87%)로 마감", high)
        self.assertNotIn("미국 나스닥 −5.28%", high)
        self.assertIn("기준 11. 21. 18:40", updated.split("  ai: {")[1][:800])

    # ---- v5.9.3 자동 갱신 연결 스위치(성공 + 명시 플래그에서만)
    def test_schedule_connected_starts_false(self):
        """배포 전 파일은 '수동 확인' 상태다 — 화면이 자동 갱신을 약속하지 않는 근거."""
        self.assertIn("\n  scheduleConnected: false,\n", self.text)
        self.assertIs(hub.snapshot(self.text)["scheduleConnected"], False)

    def test_manual_ok_run_keeps_schedule_disconnected(self):
        """수동 성공 회차 — 값은 갱신되지만 '자동 확인'을 켜지 않는다(플래그 없음)."""
        updated, plan = hub.update_text(self.text, self.ok_payload())
        self.assertEqual(plan["status"], "ok")
        self.assertIs(plan["scheduleConnected"], False)
        self.assertIn("\n  scheduleConnected: false,\n", updated)
        self.assertNotIn("scheduleConnected: true", updated)
        self.assertEqual(updated.count("scheduleConnected: false"), 1)

    def test_manual_failed_run_keeps_schedule_disconnected(self):
        updated, plan = hub.update_text(self.text, {"status": "failed"})
        self.assertEqual(plan["status"], "failed")
        self.assertIs(plan["scheduleConnected"], False)
        self.assertNotIn("scheduleConnected: true", updated)
        self.assertIn("\n  scheduleConnected: false,\n", updated)

    def test_flag_success_turns_schedule_connected_on(self):
        """등록된 스케줄러(성공)만 켤 수 있다."""
        updated, plan = hub.update_text(self.text, self.ok_payload(), schedule_connected=True)
        self.assertIs(plan["scheduleConnected"], True)
        self.assertIn("\n  scheduleConnected: true,\n", updated)
        self.assertNotIn("scheduleConnected: false", updated)
        self.assertEqual(updated.count("scheduleConnected: true"), 1)

    def test_flag_failure_keeps_schedule_disconnected(self):
        """--fail + --schedule-connected 이면 false 를 유지한다(실패한 회차는 약속의 근거가 아니다)."""
        updated, plan = hub.update_text(self.text, {"status": "failed"}, schedule_connected=True)
        self.assertEqual(plan["status"], "failed")
        self.assertIs(plan["scheduleConnected"], False)
        self.assertIn("\n  scheduleConnected: false,\n", updated)
        self.assertNotIn("scheduleConnected: true", updated)

    def test_flag_is_idempotent(self):
        once, _ = hub.update_text(self.text, self.ok_payload(), schedule_connected=True)
        twice, _ = hub.update_text(once, self.ok_payload(), schedule_connected=True)
        self.assertEqual(once, twice)
        self.assertEqual(twice.count("scheduleConnected: true"), 1)

    def test_manual_run_does_not_turn_connected_off(self):
        """이미 연결된 파일을 수동으로 돌렸다고 해서 연결을 끊지 않는다."""
        connected, _ = hub.update_text(self.text, self.ok_payload(), schedule_connected=True)
        manual, plan = hub.update_text(connected, self.ok_payload())
        self.assertIs(plan["scheduleConnected"], True)
        self.assertIn("\n  scheduleConnected: true,\n", manual)

    def test_missing_schedule_field_rejected(self):
        """v5.9.2 스키마가 아닌 파일에서는 거부한다(구조를 모르고 고치지 않는다)."""
        broken = self.text.replace("  scheduleConnected: false,\n", "")
        self.assertNotEqual(broken, self.text)
        with self.assertRaises(hub.UpdateError):
            hub.update_text(broken, self.ok_payload())

    # ---- 실패 회차
    def test_failed_run_keeps_values(self):
        updated, plan = hub.update_text(self.text, {"status": "failed", "reason": "19:00 수집 실패"})
        self.assertEqual(plan["status"], "failed")
        self.assertEqual(read(updated, "asOf"), self.current["asOf"])
        self.assertEqual(read(updated, "nextCheckAt"), self.current["nextCheckAt"])
        header = read(updated, "status")
        self.assertIn('status: "failed"', header)
        self.assertIn(self.current["asOf"], header)
        # 지표 값은 하나도 바뀌지 않는다
        for iid in self.current["indicator_ids"]:
            self.assertEqual(hub.block_of(self.text, "id", iid), hub.block_of(updated, "id", iid))
        # 카드도 실패로 남고, 값은 그대로
        for iid in self.current["item_ids"]:
            block = read(updated, "item", iid)
            self.assertIn('status: "failed"', block)
            self.assertIn("lastGoodAsOf", block)
            self.assertIn("asOf: AS_OF", block)  # 기준 시각은 그대로

    def test_failed_run_twice_keeps_last_good(self):
        once, _ = hub.update_text(self.text, {"status": "failed"})
        twice, _ = hub.update_text(once, {"status": "failed"})
        self.assertEqual(read(twice, "asOf"), self.current["asOf"])
        self.assertEqual(once.count('status: "failed"'), twice.count('status: "failed"'))

    # ---- 거부 경로
    def test_unknown_indicator_rejected(self):
        payload = self.ok_payload()
        payload["indicators"][0]["id"] = "bitcoin"
        with self.assertRaises(hub.UpdateError):
            hub.update_text(self.text, payload)

    def test_banned_word_rejected(self):
        payload = self.ok_payload()
        payload["highlights"] = [{"text": "속보 코스피 급등", "meta": "11. 21."}]
        with self.assertRaises(hub.UpdateError):
            hub.update_text(self.text, payload)

    def test_bad_iso_rejected(self):
        with self.assertRaises(hub.UpdateError):
            hub.update_text(self.text, self.ok_payload(asOf="2026-11-21 19:00"))

    def test_next_check_before_as_of_rejected(self):
        with self.assertRaises(hub.UpdateError):
            hub.update_text(
                self.text,
                self.ok_payload(asOf="2026-11-21T19:00:00+09:00", nextCheckAt="2026-11-21T06:00:00+09:00"),
            )

    def test_label_link_mismatch_rejected(self):
        payload = self.ok_payload()
        payload["indicators"][0]["sourceUrl"] = "https://finance.naver.com/marketindex/"
        payload["indicators"][0]["source"] = "한국거래소"
        with self.assertRaises(hub.UpdateError):
            hub.update_text(self.text, payload)

    def test_http_url_rejected(self):
        payload = self.ok_payload()
        payload["indicators"][0]["sourceUrl"] = "http://finance.naver.com/marketindex/"
        with self.assertRaises(hub.UpdateError):
            hub.update_text(self.text, payload)

    def test_duplicate_indicator_rejected(self):
        payload = self.ok_payload()
        payload["indicators"].append(dict(payload["indicators"][0]))
        with self.assertRaises(hub.UpdateError):
            hub.update_text(self.text, payload)


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="today-hub-test-"))
        self.file = self.tmp / "today.ts"
        self.file.write_text(REAL.read_text(encoding="utf-8"), encoding="utf-8")
        self.payload = self.tmp / "payload.json"
        self.payload.write_text(
            json.dumps(
                {
                    "asOf": "2026-11-21T19:00:41+09:00",
                    "nextCheckAt": "2026-11-22T06:00:00+09:00",
                    "indicators": [
                        {
                            "id": "usdkrw",
                            "value": "1,350.10",
                            "change": "+0.27%",
                            "direction": "up",
                            "asOf": "2026-11-21T18:55:00+09:00",
                            "asOfLabel": "11. 21. 18:55 고시",
                            "source": "네이버 금융 시장지표(하나은행 고시)",
                            "sourceUrl": "https://finance.naver.com/marketindex/",
                            "basis": "직전 고시 1,346.50원 대비 3.60원",
                        }
                    ],
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    def test_dry_run_writes_nothing(self):
        before = self.file.read_text(encoding="utf-8")
        code = hub.main(["--input", str(self.payload), "--file", str(self.file), "--dry-run", "--no-verify"])
        self.assertEqual(code, 0)
        self.assertEqual(before, self.file.read_text(encoding="utf-8"))

    def test_cli_success_replaces_file(self):
        code = hub.main(["--input", str(self.payload), "--file", str(self.file), "--no-verify"])
        self.assertEqual(code, 0)
        after = self.file.read_text(encoding="utf-8")
        self.assertIn('const AS_OF = "2026-11-21T19:00:41+09:00";', after)
        self.assertIn('value: "1,350.10"', after)
        # 수동 실행(플래그 없음)은 '수동 확인'을 유지한다
        self.assertIn("\n  scheduleConnected: false,\n", after)
        self.assertNotIn("scheduleConnected: true", after)
        self.assertFalse(self.file.with_name("today.candidate.ts").exists())

    def test_cli_flag_connected_turns_schedule_on(self):
        code = hub.main(
            ["--input", str(self.payload), "--file", str(self.file), "--no-verify", "--schedule-connected"]
        )
        self.assertEqual(code, 0)
        after = self.file.read_text(encoding="utf-8")
        self.assertIn("\n  scheduleConnected: true,\n", after)
        self.assertEqual(after.count("scheduleConnected: true"), 1)

    def test_cli_flag_with_fail_keeps_schedule_off(self):
        """--fail + --schedule-connected: 거부하지는 않되 false 를 유지하고 안내를 남긴다."""
        import io
        from contextlib import redirect_stderr

        err = io.StringIO()
        with redirect_stderr(err):
            code = hub.main(
                ["--fail", "19:00 수집 실패", "--file", str(self.file), "--no-verify", "--schedule-connected"]
            )
        self.assertEqual(code, 0)
        after = self.file.read_text(encoding="utf-8")
        self.assertIn('status: "failed"', hub.HEADER_RE.search(after).group(0))
        self.assertIn("\n  scheduleConnected: false,\n", after)
        self.assertNotIn("scheduleConnected: true", after)
        self.assertIn("--schedule-connected", err.getvalue())

    def test_cli_rejects_bad_input_and_keeps_file(self):
        before = self.file.read_text(encoding="utf-8")
        bad = self.tmp / "bad.json"
        bad.write_text(json.dumps({"asOf": "어제", "nextCheckAt": "내일"}), encoding="utf-8")
        code = hub.main(["--input", str(bad), "--file", str(self.file), "--no-verify"])
        self.assertEqual(code, 1)
        self.assertEqual(before, self.file.read_text(encoding="utf-8"))

    def test_cli_failure_mode(self):
        code = hub.main(["--fail", "19:00 수집 실패: 원문 응답 없음", "--file", str(self.file), "--no-verify"])
        self.assertEqual(code, 0)
        after = self.file.read_text(encoding="utf-8")
        self.assertIn('status: "failed"', hub.HEADER_RE.search(after).group(0))

    def test_cli_requires_one_mode(self):
        code = hub.main(["--file", str(self.file), "--no-verify"])
        self.assertEqual(code, 2)

    def test_build_failure_restores_original(self):
        """--build 가 실패하면 원본을 한 바이트도 바꾸지 않는다(기본 파일 경로 분기)."""
        from unittest import mock

        before = self.file.read_text(encoding="utf-8")
        with mock.patch.object(hub, "DEFAULT_FILE", self.file), mock.patch.object(
            hub, "run_build", side_effect=hub.UpdateError("빌드 실패(테스트)")
        ):
            code = hub.main(["--input", str(self.payload), "--file", str(self.file), "--no-verify", "--build"])
        self.assertEqual(code, 1)
        self.assertEqual(before, self.file.read_text(encoding="utf-8"))
        self.assertFalse(self.file.with_name("today.candidate.ts").exists())


class ImportCheckTest(unittest.TestCase):
    """결과 파일을 Node가 실제로 import 할 수 있는지 (node가 없으면 건너뜀)."""

    @unittest.skipUnless(hub.find_node(), "node 없음")
    def test_generated_file_imports(self):
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="today-hub-import-"))
        target = tmp / "today.ts"
        text = REAL.read_text(encoding="utf-8")
        updated, plan = hub.update_text(
            text,
            {
                "asOf": "2026-11-21T19:00:41+09:00",
                "nextCheckAt": "2026-11-22T06:00:00+09:00",
                "indicators": [],
            },
        )
        target.write_text(updated, encoding="utf-8")
        hub.verify_import(target, plan)  # 예외가 없어야 통과 — 수동 실행은 false 로 남는다
        self.assertIn("scheduleConnected: false", updated)

    @unittest.skipUnless(hub.find_node(), "node 없음")
    def test_flagged_file_imports_connected(self):
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="today-hub-import-flag-"))
        target = tmp / "today.ts"
        updated, plan = hub.update_text(
            REAL.read_text(encoding="utf-8"),
            {
                "asOf": "2026-11-21T19:00:41+09:00",
                "nextCheckAt": "2026-11-22T06:00:00+09:00",
                "indicators": [],
            },
            schedule_connected=True,
        )
        target.write_text(updated, encoding="utf-8")
        hub.verify_import(target, plan)
        # import 검증이 scheduleConnected 전환까지 확인한다(값이 기대와 다르면 UpdateError)
        self.assertIn("scheduleConnected: true", updated)

    @unittest.skipUnless(hub.find_node(), "node 없음")
    def test_import_check_catches_unplanned_switch(self):
        """계획은 false 인데 파일이 true 면 import 검증이 잡아낸다(조용히 넘어가지 않는다)."""
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="today-hub-import-bad-"))
        target = tmp / "today.ts"
        updated, plan = hub.update_text(
            REAL.read_text(encoding="utf-8"),
            {"asOf": "2026-11-21T19:00:41+09:00", "nextCheckAt": "2026-11-22T06:00:00+09:00", "indicators": []},
        )
        target.write_text(hub.set_schedule_connected(updated, True), encoding="utf-8")
        with self.assertRaises(hub.UpdateError):
            hub.verify_import(target, plan)

    @unittest.skipUnless(hub.find_node(), "node 없음")
    def test_failed_file_imports_with_failed_status(self):
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="today-hub-import2-"))
        target = tmp / "today.ts"
        updated, plan = hub.update_text(REAL.read_text(encoding="utf-8"), {"status": "failed"})
        target.write_text(updated, encoding="utf-8")
        hub.verify_import(target, plan)

    @unittest.skipUnless(hub.find_node(), "node 없음")
    def test_real_file_still_imports(self):
        """지금 저장소의 today.ts 자체가 유효한지 (회귀 방지)."""
        node = hub.find_node()
        probe = pathlib.Path(tempfile.mkdtemp(prefix="today-hub-real-")) / "p.mjs"
        probe.write_text(
            "import { today } from " + json.dumps(REAL.as_uri()) + "; console.log(today.asOf);\n", encoding="utf-8"
        )
        run = subprocess.run([node, "--experimental-strip-types", str(probe)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr[-400:])


if __name__ == "__main__":
    unittest.main(verbosity=2)
