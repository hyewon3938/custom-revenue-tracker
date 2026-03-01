import fs from "fs/promises";
import path from "path";
import { VenueInfo } from "@/lib/types";

interface VenueRegistry {
  venues: VenueInfo[];
  lastModifiedAt: string;
}

const VENUE_PATH = path.join(process.cwd(), "data", "venues.json");

export async function loadVenues(): Promise<VenueRegistry> {
  try {
    const raw = await fs.readFile(VENUE_PATH, "utf-8");
    return JSON.parse(raw) as VenueRegistry;
  } catch {
    // 파일 없으면 기본값 생성
    const registry: VenueRegistry = {
      venues: [
        {
          id: "gosan",
          name: "고산의낮",
          createdAt: "2024-11-01T00:00:00.000Z",
        },
      ],
      lastModifiedAt: new Date().toISOString(),
    };
    await saveVenues(registry);
    return registry;
  }
}

async function saveVenues(registry: VenueRegistry): Promise<void> {
  await fs.mkdir(path.dirname(VENUE_PATH), { recursive: true });
  await fs.writeFile(VENUE_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

/** 한글 이름에서 slug ID 생성. 중복 시 숫자 suffix 추가. */
function generateId(name: string, existing: VenueInfo[]): string {
  // 한글은 그대로 사용하되 공백과 특수문자 제거 후 소문자
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = base || "venue";

  const ids = new Set(existing.map((v) => v.id));
  if (!ids.has(slug)) return slug;

  let i = 2;
  while (ids.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export async function addVenue(name: string): Promise<VenueInfo> {
  const registry = await loadVenues();
  const venue: VenueInfo = {
    id: generateId(name, registry.venues),
    name,
    createdAt: new Date().toISOString(),
  };
  registry.venues.push(venue);
  registry.lastModifiedAt = new Date().toISOString();
  await saveVenues(registry);
  return venue;
}

export async function renameVenue(
  id: string,
  newName: string
): Promise<VenueInfo> {
  const registry = await loadVenues();
  const venue = registry.venues.find((v) => v.id === id);
  if (!venue) throw new Error(`입점처 '${id}'를 찾을 수 없습니다.`);
  venue.name = newName;
  registry.lastModifiedAt = new Date().toISOString();
  await saveVenues(registry);
  return venue;
}

export async function deleteVenue(id: string): Promise<void> {
  const registry = await loadVenues();
  const idx = registry.venues.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error(`입점처 '${id}'를 찾을 수 없습니다.`);
  registry.venues.splice(idx, 1);
  registry.lastModifiedAt = new Date().toISOString();
  await saveVenues(registry);
}
