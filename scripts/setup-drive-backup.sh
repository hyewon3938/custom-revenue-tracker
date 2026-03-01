#!/bin/bash
set -euo pipefail

# ─── 구글 드라이브 심볼릭 링크 백업 설정 ─────────────────────────────────
#
# 사전 조건: Google Drive for Desktop 설치 + 로그인
# data/ 디렉터리를 Google Drive로 이동하고 심볼릭 링크를 생성합니다.
#
# 사용법: bash scripts/setup-drive-backup.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_FOLDER_NAME="revenue-tracker-data"

echo "=== 구글 드라이브 심볼릭 링크 백업 설정 ==="
echo ""

# ─── 1) 이미 심볼릭 링크인 경우 ────────────────────────────────────────
if [ -L "$DATA_DIR" ]; then
  TARGET="$(readlink "$DATA_DIR")"
  echo "[확인] data/ 디렉터리가 이미 심볼릭 링크로 설정되어 있습니다."
  echo "  → $TARGET"
  echo ""
  if [ -d "$TARGET" ]; then
    echo "[성공] 연결 상태 정상."
  else
    echo "[경고] 심볼릭 링크 대상 폴더가 존재하지 않습니다: $TARGET"
    echo "  → Google Drive 동기화 상태를 확인해주세요."
  fi
  exit 0
fi

# ─── 2) Google Drive 경로 탐색 ─────────────────────────────────────────
DRIVE_BASE=""

# macOS: Google Drive for Desktop — 한국어 (내 드라이브)
if [ -z "$DRIVE_BASE" ] && [ -d "$HOME/Google Drive/내 드라이브" ]; then
  # 쓰기 가능 여부 확인
  if touch "$HOME/Google Drive/내 드라이브/.write_test" 2>/dev/null; then
    rm -f "$HOME/Google Drive/내 드라이브/.write_test"
    DRIVE_BASE="$HOME/Google Drive/내 드라이브"
  fi
fi

# macOS: Google Drive for Desktop (CloudStorage — 영문)
if [ -z "$DRIVE_BASE" ]; then
  for d in "$HOME/Library/CloudStorage"/GoogleDrive-*/My\ Drive; do
    if [ -d "$d" ]; then
      DRIVE_BASE="$d"
      break
    fi
  done
fi

# macOS: Legacy 경로
if [ -z "$DRIVE_BASE" ] && [ -d "$HOME/Google Drive/My Drive" ]; then
  DRIVE_BASE="$HOME/Google Drive/My Drive"
fi

if [ -z "$DRIVE_BASE" ]; then
  echo "[오류] Google Drive 폴더를 찾을 수 없습니다."
  echo ""
  echo "  확인할 경로:"
  echo "    - ~/Google Drive/내 드라이브"
  echo "    - ~/Library/CloudStorage/GoogleDrive-*/My Drive"
  echo "    - ~/Google Drive/My Drive"
  echo ""
  echo "  Google Drive for Desktop을 설치하고 로그인해주세요."
  exit 1
fi

echo "[발견] Google Drive 경로: $DRIVE_BASE"

# ─── 3) 대상 폴더 생성 ────────────────────────────────────────────────
DRIVE_TARGET="$DRIVE_BASE/$BACKUP_FOLDER_NAME"

if [ -d "$DRIVE_TARGET" ]; then
  echo "[확인] 대상 폴더가 이미 존재합니다: $DRIVE_TARGET"

  if [ "$(ls -A "$DRIVE_TARGET" 2>/dev/null)" ]; then
    echo ""
    echo "[주의] 대상 폴더에 기존 파일이 있습니다."
    ls -la "$DRIVE_TARGET"
    echo ""
    read -p "  기존 파일에 현재 data/ 내용을 덮어쓰시겠습니까? (y/N): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
      echo "  작업이 취소되었습니다."
      exit 1
    fi
  fi
else
  echo "[생성] 대상 폴더 생성: $DRIVE_TARGET"
  mkdir -p "$DRIVE_TARGET"
fi

# ─── 4) data/ 내용 이동 ───────────────────────────────────────────────
echo "[이동] data/ 내용을 Google Drive로 이동합니다..."
rsync -av "$DATA_DIR/" "$DRIVE_TARGET/"

rm -rf "$DATA_DIR"
echo "[완료] 이동 완료."

# ─── 5) 심볼릭 링크 생성 ──────────────────────────────────────────────
echo "[심볼릭 링크] $DATA_DIR → $DRIVE_TARGET"
ln -s "$DRIVE_TARGET" "$DATA_DIR"

# ─── 6) 검증 ─────────────────────────────────────────────────────────
echo ""
echo "=== 검증 ==="

if [ -L "$DATA_DIR" ]; then
  echo "[확인] 심볼릭 링크 생성 성공"
else
  echo "[오류] 심볼릭 링크 생성 실패"
  exit 1
fi

if [ -d "$DATA_DIR/reports" ]; then
  REPORT_COUNT=$(ls "$DATA_DIR/reports/"*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "[확인] reports 폴더 접근 가능 (레포트 ${REPORT_COUNT}개)"
else
  echo "[경고] reports 폴더를 찾을 수 없습니다."
fi

if [ -f "$DATA_DIR/venues.json" ]; then
  echo "[확인] venues.json 접근 가능"
fi

echo ""
echo "=== 설정 완료 ==="
echo ""
echo "  Google Drive 경로: $DRIVE_TARGET"
echo "  프로젝트 심볼릭 링크: $DATA_DIR → $DRIVE_TARGET"
echo ""
echo "  기존 코드는 수정 없이 동일하게 동작합니다."
echo "  Google Drive가 자동으로 클라우드 백업을 관리합니다."
