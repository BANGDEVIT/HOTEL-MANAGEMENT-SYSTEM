import type { Room } from "../../../types/room";

export interface FloorGroup {
  floor: number;
  rooms: Room[];
}

/**
 * Gom danh sách phòng thành từng nhóm theo tầng, tầng thấp lên trước.
 * GIỮ NGUYÊN thứ tự phòng trong mỗi tầng như BE trả về,
 * để lựa chọn "Sắp xếp" trên toolbar (theo số phòng, theo giá...) vẫn có tác dụng.
 */
export function groupByFloor(rooms: Room[]): FloorGroup[] {
  const map = new Map<number, Room[]>();
  for (const room of rooms) {
    const list = map.get(room.floor);
    if (list) list.push(room);
    else map.set(room.floor, [room]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, list]) => ({ floor, rooms: list }));
}
