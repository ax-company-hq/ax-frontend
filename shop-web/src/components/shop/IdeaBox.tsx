import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorNote } from "@/components/shop/bits";
import { api, ApiError } from "@/lib/api";
import { shortDateTime } from "@/lib/format";
import { IDEA_KIND_KO, IDEA_STATUS_KO } from "@/lib/labels";
import type { IdeaKind, MyIdea } from "@/lib/types";

// 서버 한도(shop-api: 500자, 하루 5건)와 같다. 서버 검증이 최종이고 화면은 먼저 막기만 한다.
const MAX_TEXT = 500;
const PREVIEW_CHARS = 30; // 내역에는 앞부분 30자만 온다(서버가 원문 사본을 지운다)
const KINDS = Object.keys(IDEA_KIND_KO) as IdeaKind[];
// 고객지원이 읽어 가 처리하기 전(접수됨)에는 주기적으로 다시 읽는다.
const REFRESH_MS = 8_000;

const count = (s: string) => [...s].length;

function ideaErrorText(e: unknown): string {
  const generic = "의견을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (!(e instanceof ApiError)) return generic;
  if (e.code === "RATE_LIMITED") return "오늘 보낼 수 있는 의견 수를 넘었습니다. 내일 다시 보내 주세요.";
  if (e.status === 0) return "판매 서버에 연결할 수 없어 의견을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (e.status === 422) return "의견은 1자 이상 " + MAX_TEXT + "자 이하로 입력해 주세요.";
  return generic;
}

/** 내 의견 내역. 접수된 뒤 고객지원이 읽어 가기까지 잠시 걸리므로, 처리 전 항목이 있으면 다시 읽는다. */
function useMyIdeas(buyerId: string) {
  const [ideas, setIdeas] = useState<MyIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setIdeas(await api.myIdeas(buyerId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "내역을 불러오지 못했습니다.");
    }
  }, [buyerId]);
  useEffect(() => { void reload(); }, [reload]);
  const waiting = !!ideas?.some((i) => i.status === "pending");
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { void reload(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [waiting, reload]);
  return { ideas, error, reload };
}

const BADGE: Record<string, string> = {
  pending: "bg-ink-100 text-ink-700",
  received: "bg-emerald-50 text-emerald-800",
  redirected: "bg-amber-50 text-amber-900",
  not_accepted: "bg-red-50 text-red-800",
};

export function IdeaBox({ buyerId }: { buyerId: string }) {
  const { ideas, error, reload } = useMyIdeas(buyerId);
  const [kind, setKind] = useState<IdeaKind>("feature");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inflight = useRef(false);

  const len = count(text.trim());
  const over = len > MAX_TEXT;
  const canSend = len > 0 && !over && !sending;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (inflight.current || !canSend) return;
    inflight.current = true;
    setSending(true);
    setFormError(null);
    setDone(false);
    try {
      await api.submitIdea({ buyer_id: buyerId, kind, text: text.trim() });
      setText("");
      setDone(true);
      void reload();
    } catch (e) {
      // 의견 원문은 콘솔·저장소에 남기지 않는다. 오류 코드로 만든 안내만 보여 준다.
      setFormError(ideaErrorText(e));
    } finally {
      inflight.current = false;
      setSending(false);
    }
  }

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-ink-100 bg-surface p-4" aria-labelledby="idea-title">
      <div>
        <h2 id="idea-title" className="font-semibold">고객의 소리</h2>
        <p className="mt-1 text-xs text-ink-500">
          이벤트·새 기능·개선 아이디어를 남겨 주세요. 하루 5건까지 받습니다. 환불·취소·불량 같은 문제는 위의 1:1 문의나 주문 상세에서 신청해 주세요.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3" aria-busy={sending}>
        {done && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            의견이 접수되었습니다. 고객지원이 확인하면 아래 내역에 처리 상태가 나타납니다.
          </p>
        )}
        <ErrorNote error={formError} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">종류</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as IdeaKind)} disabled={sending}>
            {KINDS.map((k) => <option key={k} value={k}>{IDEA_KIND_KO[k]}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex justify-between font-medium">
            <span>내용</span>
            <span className={"text-xs tabular-nums " + (over ? "text-red-700" : "text-ink-500")}>{len}/{MAX_TEXT}</span>
          </span>
          <textarea className="field h-24 resize-y" value={text} onChange={(e) => { setText(e.target.value); setDone(false); }} disabled={sending} />
          {over && <span className="mt-1 block text-xs text-red-700">의견은 {MAX_TEXT}자 이하로 입력해 주세요.</span>}
        </label>
        <p className="text-xs text-ink-500">이름·연락처·주민등록번호·카드번호 등 개인정보는 적지 마세요.</p>
        <button type="submit" className="btn-primary" disabled={!canSend}>{sending ? "보내는 중…" : "의견 보내기"}</button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold">내가 보낸 의견</h3>
        <ErrorNote error={error} />
        {ideas === null && !error && <p className="text-sm text-ink-500">불러오는 중…</p>}
        {ideas?.length === 0 && <p className="text-sm text-ink-500">아직 보낸 의견이 없습니다.</p>}
        <ul className="space-y-2">
          {ideas?.map((i) => (
            <li key={i.idea_id} className="rounded-lg border border-ink-100 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + (BADGE[i.status] ?? BADGE.pending)}>{IDEA_STATUS_KO[i.status] ?? i.status}</span>
                <span className="text-xs text-ink-500">{IDEA_KIND_KO[i.kind] ?? i.kind} · #{i.idea_id} · {shortDateTime(i.created_at)}</span>
              </div>
              {/* 내역에는 앞부분만 있다. 서버가 보낸 처리 안내가 있으면 그대로 보여 준다 */}
              <p className="mt-1 text-ink-700">{i.preview}{[...i.preview].length >= PREVIEW_CHARS ? "…" : ""}</p>
              {i.notice && <p className="mt-1 text-xs text-ink-500">{i.notice}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
