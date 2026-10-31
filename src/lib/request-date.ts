import "server-only";
import { connection } from "next/server";
import { todayInSeoul, type IsoDate } from "./dates";

/**
 * 요청 시점의 서울 날짜. Cache Components 는 프리렌더 중 new Date() 를 막으므로
 * 서버 컴포넌트에서는 todayInSeoul() 대신 이것을 쓴다.
 */
export async function requestToday(): Promise<IsoDate> {
  await connection();
  return todayInSeoul();
}
