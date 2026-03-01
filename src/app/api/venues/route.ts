import { NextRequest, NextResponse } from "next/server";
import {
  loadVenues,
  addVenue,
  renameVenue,
  deleteVenue,
} from "@/lib/storage/venue-store";
import { getErrorMessage } from "@/lib/utils/error";

/** GET /api/venues — 입점처 레지스트리 반환 */
export async function GET() {
  try {
    const registry = await loadVenues();
    return NextResponse.json(registry);
  } catch (error) {
    const message = getErrorMessage(error, "조회 실패");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/venues — 신규 입점처 등록 */
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "입점처 이름이 필요합니다." },
        { status: 400 }
      );
    }
    const venue = await addVenue(name.trim());
    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "등록 실패");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/venues — 입점처 이름 변경 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, name } = await request.json();
    if (!id || !name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "id와 name이 필요합니다." },
        { status: 400 }
      );
    }
    const venue = await renameVenue(id, name.trim());
    return NextResponse.json(venue);
  } catch (error) {
    const message = getErrorMessage(error, "수정 실패");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/venues — 입점처 삭제 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "id가 필요합니다." },
        { status: 400 }
      );
    }
    await deleteVenue(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = getErrorMessage(error, "삭제 실패");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
