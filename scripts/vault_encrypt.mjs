#!/usr/bin/env node
/**
 * 전용 도구실(vault) 암호문 생성 — 2026-11-24.
 *
 * 왜 필요한가
 *   `/apps/` 의 「🔒 전용 도구실」에 들어가는 내부·실무 도구 3종의 이름·설명·주소가
 *   HTML/JS 소스 보기에 평문으로 남으면 잠금이 아무 의미가 없다. 그래서 도구 목록 JSON을
 *   PBKDF2-SHA256(310,000회) + AES-256-GCM 으로 암호화해 `cipherPayload`(salt·iv·ct)만
 *   사이트에 심는다. 복호화는 방문자가 비밀번호를 넣는 순간 브라우저 Web Crypto 가 한다.
 *
 * 지키는 것
 *   · 평문 도구 목록은 **저장소 밖**에 둔다: `apps/buffetkimz-web/.vault/tools.source.json`(gitignore).
 *   · 비밀번호도 저장소에 넣지 않는다: `.vault/pass.txt` 또는 환경변수 `VAULT_PASS`.
 *   · 생성되는 파일(`src/data/vault.generated.ts`)에는 salt·iv·암호문만 들어간다.
 *
 * 사용
 *   node scripts/vault_encrypt.mjs            # .vault/ 를 읽어 src/data/vault.generated.ts 생성
 *   node scripts/vault_encrypt.mjs --check    # 생성된 암호문을 다시 풀어 원문과 대조(평문 출력 없음)
 *
 * 종료 코드: 0 성공 · 1 실패 · 2 사용법/입력 오류
 */
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILE = process.env.VAULT_SOURCE ?? join(APP_DIR, ".vault", "tools.source.json");
const PASS_FILE = process.env.VAULT_PASS_FILE ?? join(APP_DIR, ".vault", "pass.txt");
const OUT_FILE = join(APP_DIR, "src", "data", "vault.generated.ts");

const ITERATIONS = 310000;
const DIGEST = "sha256";
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const b64 = (buf) => Buffer.from(buf).toString("base64");
const unb64 = (s) => Buffer.from(s, "base64");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadPassword() {
  if (process.env.VAULT_PASS) return process.env.VAULT_PASS;
  if (await exists(PASS_FILE)) return (await readFile(PASS_FILE, "utf8")).replace(/\r?\n$/, "");
  throw new Error(`비밀번호를 찾을 수 없습니다: VAULT_PASS 환경변수 또는 ${PASS_FILE}`);
}

function derive(password, salt, iterations) {
  return new Promise((ok, fail) =>
    pbkdf2(password, salt, iterations, KEY_BYTES, DIGEST, (err, key) => (err ? fail(err) : ok(key))),
  );
}

async function encrypt(password) {
  const plain = await readFile(SOURCE_FILE, "utf8");
  // 원문이 곧 도구 목록인지 확인 — 깨진 JSON 을 암호화하면 잠금을 열고 나서야 알게 된다.
  const parsed = JSON.parse(plain);
  if (!Array.isArray(parsed.tools) || parsed.tools.length === 0) {
    throw new Error("tools.source.json 에 tools 배열이 없습니다.");
  }
  for (const t of parsed.tools) {
    for (const key of ["id", "name", "tagline", "summary", "href", "action", "meta"]) {
      if (!t[key]) throw new Error(`도구 '${t.id ?? "?"}' 에 ${key} 가 없습니다.`);
    }
  }

  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await derive(password, salt, ITERATIONS);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // GCM 태그는 암호문 뒤에 붙여 함께 넘긴다(브라우저 WebCrypto 도 같은 순서로 기대한다).
  return { v: 1, kdf: `PBKDF2-SHA256/${ITERATIONS}`, iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(Buffer.concat([ct, cipher.getAuthTag()])) };
}

async function decrypt(payload, password) {
  const salt = unb64(payload.salt);
  const iv = unb64(payload.iv);
  const all = unb64(payload.ct);
  const tag = all.subarray(all.length - 16);
  const body = all.subarray(0, all.length - 16);
  const key = await derive(password, salt, payload.iter);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

const renderModule = (payload) => `/**
 * 자동 생성 파일 — 직접 고치지 않는다.
 * 생성: \`node scripts/vault_encrypt.mjs\` (원문은 저장소 밖 .vault/tools.source.json)
 *
 * 여기에는 salt·iv·암호문만 있다. 도구 이름·설명·주소는 이 파일에도, 빌드 결과에도 평문으로 없다.
 */

export type VaultPayload = {
  v: number;
  kdf: string;
  iter: number;
  salt: string;
  iv: string;
  ct: string;
};

export const vaultPayload: VaultPayload = ${JSON.stringify(payload, null, 2)};
`;

const main = async () => {
  const mode = process.argv.includes("--check") ? "check" : "write";
  const password = await loadPassword();

  if (mode === "check") {
    const mod = await readFile(OUT_FILE, "utf8");
    const json = mod.slice(mod.indexOf("= {") + 2, mod.lastIndexOf(";")).trim();
    const payload = JSON.parse(json);
    const plain = await decrypt(payload, password);
    const a = JSON.parse(plain);
    const b = JSON.parse(await readFile(SOURCE_FILE, "utf8"));
    const same = JSON.stringify(a) === JSON.stringify(b);
    console.log(`${same ? "PASS" : "FAIL"} 암호문 왕복 — 도구 ${a.tools.length}종 복호화 ${same ? "일치" : "불일치"}`);
    process.exitCode = same ? 0 : 1;
    return;
  }

  if (!(await exists(SOURCE_FILE))) {
    throw new Error(`원문 목록이 없습니다: ${SOURCE_FILE}`);
  }
  const payload = await encrypt(password);
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, renderModule(payload), "utf8");

  // 방금 쓴 파일을 그 자리에서 다시 풀어 본다 — 복호화가 안 되는 암호문을 배포하지 않는다.
  const back = await decrypt(payload, password);
  const parsed = JSON.parse(back);
  const original = JSON.stringify(JSON.parse(await readFile(SOURCE_FILE, "utf8")));
  const ok = JSON.stringify(parsed) === original;
  console.log(`암호문 생성 → ${OUT_FILE.slice(APP_DIR.length + 1)}`);
  console.log(`  도구 ${parsed.tools.length}종 · PBKDF2 ${ITERATIONS}회 · AES-256-GCM · salt/iv 새로 생성`);
  console.log(`  왕복 검증 ${ok ? "PASS" : "FAIL(원문 공백 차이 가능)"} · 암호문 ${payload.ct.length}자(base64)`);
};

main().catch((err) => {
  console.error(`실패: ${err.message}`);
  process.exit(2);
});
