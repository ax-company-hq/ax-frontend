#!/usr/bin/env bash
# 백엔드 openapi.json에서 types/src/*.ts를 생성한다.
# 사용법: scripts/gen-types.sh <백엔드 ref>   (태그 v0.20261021.0900 또는 커밋 SHA)
set -euo pipefail

BACKEND_REPO="ax-company-hq/ax-backend"
OPENAPI_TS_VERSION="7.13.0"
SPECS=(shop-api dashboard-api)

ref="${1:-}"
if [[ -z "$ref" ]]; then
  echo "사용법: scripts/gen-types.sh <백엔드 ref: 태그 또는 커밋 SHA>" >&2
  exit 2
fi
if [[ ! "$ref" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "잘못된 ref: $ref" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$root/types/src"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out_dir"

generated=0
for name in "${SPECS[@]}"; do
  url="https://raw.githubusercontent.com/$BACKEND_REPO/$ref/contracts/openapi/$name.json"
  code="$(curl -sSL -o "$tmp/$name.json" -w '%{http_code}' "$url")"
  if [[ "$code" == "404" ]]; then
    echo "백엔드 openapi.json이 아직 없음: $BACKEND_REPO@$ref contracts/openapi/$name.json"
    continue
  fi
  if [[ "$code" != "200" ]]; then
    echo "다운로드 실패 (HTTP $code): $url" >&2
    exit 1
  fi

  npx --yes "openapi-typescript@$OPENAPI_TS_VERSION" "$tmp/$name.json" -o "$tmp/$name.ts" >/dev/null
  {
    echo "// 자동 생성 — 직접 수정 금지, scripts/gen-types.sh <ref>로 재생성"
    echo "// 원본: $BACKEND_REPO@$ref contracts/openapi/$name.json"
    echo
    cat "$tmp/$name.ts"
  } > "$out_dir/$name.ts"
  echo "생성: types/src/$name.ts ($BACKEND_REPO@$ref)"
  generated=$((generated + 1))
done

if [[ "$generated" -eq 0 ]]; then
  echo "생성한 파일 없음 — 백엔드 openapi.json이 아직 없음"
fi
exit 0
