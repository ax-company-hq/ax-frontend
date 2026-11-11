import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shortDateTime } from "@/lib/format";
import { CLAIM_REASON_KO, CLAIM_TYPE_KO } from "@/lib/labels";
import type { MyClaim } from "@/lib/types";
import { AxClaimStatusBadge, AxClaimSummary } from "./AxClaimSummary";

// 신청은 판매 서버가 저장하고 AXcellent 고객지원이 읽어 가 판정한 뒤 결과를 적는다("접수됨 → 나중에 처리").
// 그래서 접수 직후에는 판정·환불액이 없다. 결과가 오기 전에는 값을 지어내지 않고 "접수됨"만 보여 준다.
const REFRESH_MS = 8_000;
const FINAL = new Set(["completed", "rejected", "not_accepted"]);

/** 내 신청 목록(주문별로 거를 수 있다). 끝나지 않은 신청이 있으면 주기적으로 다시 읽는다. */
export function useMyClaims(buyerId: string | undefined, orderId?: string) {
  const [claims, setClaims] = useState<MyClaim[]>([]);
  const reload = useCallback(async () => {
    if (!buyerId) return;
    try { setClaims(await api.myClaims(buyerId, orderId)); } catch { /* 다음 주기에 다시 읽는다 */ }
  }, [buyerId, orderId]);
  useEffect(() => { void reload(); }, [reload]);
  const waiting = claims.some((c) => !FINAL.has(c.status));
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { void reload(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [waiting, reload]);
  return { claims, reload };
}

export function MyClaimCard({ c }: { c: MyClaim }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <AxClaimStatusBadge status={c.status} />
        <span className="text-sm font-semibold">{CLAIM_TYPE_KO[c.type]} · {CLAIM_REASON_KO[c.reason]}</span>
        <span className="text-xs text-ink-500">#{c.id} · {shortDateTime(c.created_at)}</span>
      </div>
      {c.result && c.status !== "not_accepted" && <AxClaimSummary c={{ ...c.result, status: c.status }} />}
      {c.status === "not_accepted" && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          신청을 접수하지 못했습니다{c.result && "message" in c.result && c.result.message ? `: ${String(c.result.message)}` : ""}. 궁금한 점은 고객센터로 문의해 주세요.
        </p>
      )}
      {!c.result && (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-700">
          신청이 접수되었습니다. 고객지원이 확인하는 대로 이 화면에 결과가 나타납니다 (잠시 걸릴 수 있어요).
        </p>
      )}
    </div>
  );
}
