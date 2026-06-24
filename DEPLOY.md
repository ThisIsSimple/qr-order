# 배포 가이드 (테스트용)

QR 대기열 모노레포를 **Vercel(웹 2개) + Supabase Cloud(백엔드)** 로 배포하는 절차입니다.

## ✅ 현재 배포 상태 (라이브)

| 앱 | Vercel 프로젝트 | URL |
|---|---|---|
| 홈페이지(web) | `qr-order-web` (root: `apps/web`) | **https://qr-order-web-seven.vercel.app** |
| 관리자(admin) | `qr-order-admin` (root: `apps/admin`) | **https://qr-order-admin-iota.vercel.app** |

- Vercel 팀: `yunmin-jeons-projects` · 두 프로젝트 모두 **GitHub(`ThisIsSimple/qr-order`)에 연결됨**
- **`git push origin main` 시 두 앱 자동 재배포**됩니다. (수동: 아래 "수동 배포" 참고)
- 손님 등록: https://qr-order-web-seven.vercel.app/q/DEMO01 · 관리자 로그인: `owner@demo.test` / `demo1234!`

> 남은 수동 단계(선택): Supabase 대시보드 → Authentication → URL Configuration 에 위 두 URL을 Site URL/Redirect URL로 추가하면 **회원가입 이메일 인증 링크**가 배포 주소로 갑니다. (비밀번호 로그인은 이 설정 없이도 동작)

### 수동 배포 (CLI)

모노레포라 **반드시 레포 루트에서** 배포해야 워크스페이스 의존성이 설치됩니다. 프로젝트별 Root Directory는 Vercel에 이미 설정돼 있습니다.

```bash
npx vercel link --yes --project qr-order-web   && npx vercel deploy --prod --yes   # web
npx vercel link --yes --project qr-order-admin && npx vercel deploy --prod --yes   # admin
```

---


```
손님 폰 ─┐
         ├─► web   (apps/web)   → Vercel 프로젝트 #1  ┐
점주 PC ─┤                                             ├─► Supabase Cloud (이미 배포됨)
         └─► admin (apps/admin) → Vercel 프로젝트 #2  ┘
```

| 구성요소 | 배포처 | 비고 |
|---|---|---|
| `apps/web` (Next.js 15) | Vercel 프로젝트 #1 | 랜딩·로그인·가입·매장관리·손님 등록(`/q`) |
| `apps/admin` (Next.js 15) | Vercel 프로젝트 #2 | 점주 대기열 운영 대시보드 |
| DB·Auth·Realtime·Storage | Supabase Cloud | 프로젝트 ref `zjrvpylcyfjwknpvnchk` (ap-northeast-2) |

---

## 1. GitHub 푸시

```bash
git add -A
git commit -m "init"            # 최초 1회 (이미 되어 있으면 생략)
git push -u origin main
```

> `.env`, `apps/*/.env.local` 은 `.gitignore` 처리되어 **커밋되지 않습니다.** 키는 Vercel 환경변수로만 넣습니다.

## 2. Vercel 프로젝트 2개 생성

Vercel 대시보드 → **Add New… → Project** → 이 레포를 **두 번** import.

| 설정 | web 프로젝트 | admin 프로젝트 |
|---|---|---|
| **Root Directory** | `apps/web` | `apps/admin` |
| Framework Preset | Next.js (자동) | Next.js (자동) |
| Install / Build Command | 기본값 (pnpm 워크스페이스 자동 인식) | 기본값 |
| Node.js Version | 20.x 이상 | 20.x 이상 |

> 모노레포는 Root Directory만 지정하면 Vercel이 루트에서 `pnpm install`(워크스페이스) 후 해당 앱을 빌드합니다. Turborepo도 자동 감지됩니다.

## 3. 환경변수 (두 프로젝트 각각 Settings → Environment Variables)

| Key | Value | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zjrvpylcyfjwknpvnchk.supabase.co` | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` (publishable 키) | 공개 |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` (secret 키) | **서버 전용** |
| `NEXT_PUBLIC_WEB_URL` | `https://<web>.vercel.app` | 공개 |
| `NEXT_PUBLIC_ADMIN_URL` | `https://<admin>.vercel.app` | 공개 |

> 실제 키 값은 로컬 `.env` / `apps/*/.env.local` 에 있습니다(레포에는 없음). 결제(토스페이먼츠) 키는 추후 추가.

## 4. Supabase Auth URL 등록

대시보드 → **Authentication → URL Configuration**

- **Site URL**: web 배포 주소 (`https://<web>.vercel.app`)
- **Redirect URLs**: web·admin 배포 주소 + `http://localhost:3100`, `http://localhost:3101` 추가

## 5. 2-pass 마무리 (닭-달걀)

배포 주소는 첫 배포 후에야 확정되므로:

1. 1차 배포 → 발급된 `*.vercel.app` 주소 확인
2. 그 주소를 `NEXT_PUBLIC_WEB_URL` / `NEXT_PUBLIC_ADMIN_URL`(3번)과 Supabase Redirect(4번)에 반영
3. **재배포** → 이래야 **QR 코드가 실제 배포 주소**를 가리켜 폰으로 스캔 가능

---

## 데이터베이스 마이그레이션 동기화

스키마는 `supabase/migrations/` 에 있습니다. 정식 흐름(권장):

```bash
supabase link --project-ref zjrvpylcyfjwknpvnchk   # SUPABASE_ACCESS_TOKEN 필요
supabase db push                                    # migrations 적용
supabase gen types typescript --linked > packages/db/src/database.types.ts
```

> 현재는 풀러(`SUPABASE_DB_URL`)로 직접 적용된 상태입니다. 새 환경/재현 시 위 흐름을 사용하세요.

## 테스트 계정 / 데모

- 손님 등록: `https://<web>.vercel.app/q/DEMO01`
- 관리자: `https://<admin>.vercel.app` → `owner@demo.test` / `demo1234!` (DEMO01 매장)

---

## ⚠️ 주의점

1. **로그인은 web/admin 별도** — 서로 다른 `*.vercel.app` 도메인이라 인증 쿠키가 공유되지 않습니다. 통합 로그인이 필요하면 같은 상위도메인(`app.도메인`/`admin.도메인`)에 커스텀 도메인을 연결하세요.
2. **회원가입 이메일** — Supabase 프로젝트가 실제 이메일 도메인만 허용(가짜 도메인 거부). 이메일 확인이 켜져 있으면 가입 시 메일 인증 필요. 테스트는 `owner@demo.test`(Admin API 생성) 사용.
3. **비용** — Vercel Hobby·Supabase Free 무료. Vercel Hobby는 비상업용이므로 정식 서비스 시 Pro 전환.
4. Realtime(웹소켓)·QR 서버생성(`qrcode`)·SSR 모두 Vercel Node 런타임에서 동작합니다.

## 대안 (참고)

- **Netlify**: Next.js 지원, Vercel과 거의 동일.
- **Cloudflare Pages**: 엣지, 일부 Node API 제약.
- **Railway / Render**: 컨테이너 기반, 설정 더 많음.

→ 테스트용은 **Vercel + Supabase Cloud** 권장.
