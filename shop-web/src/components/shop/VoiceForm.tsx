import { useRef, useState, type FormEvent } from "react";
import { ErrorNote } from "./bits";
import { api, ApiError } from "@/lib/api";
import type { IdeaKind } from "@/lib/types";

// 고객의 소리: "이런 걸 해 주면 좋겠다"를 보내는 곳. 불만·문의(위 1:1 문의)와는 따로 접수된다.
// 서버 한도(shop-api: 500자)와 같다. 서버 검증이 최종이고 화면은 먼저 막기만 한다.
const MAX_TEXT = 500;
const MIN_TEXT = 5;
const KINDS: { value: IdeaKind; label: string }[] = [
  { value: "event", label: "이벤트·혜택 요청" },
  { value: "feature", label: "새 기능 제안" },
  { value: "improvement", label: "개선 제안" },
  { value: "product", label: "상품·서비스 제안" },
  { value: "other", label: "기타 의견" },
];
const count = (s: string) => [...s].length;

/** 오류 코드별 안내. 코드가 알려 주는 사실만 말한다. */
function ideaErrorText(e: unknown): string {
  const generic = "의견을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (!(e instanceof ApiError)) return generic;
  switch (e.code) {
    case "USE_INQUIRY": return "환불·취소·불량 같은 문제는 위의 1:1 문의로 접수해 주세요. 고객의 소리는 앞으로 바라는 점을 받는 곳입니다.";
    case "INVALID_IDEA": return "광고·링크가 있거나 너무 짧은 글은 받을 수 없습니다.";
    case "RATE_LIMITED": return "의견을 짧은 시간에 너무 많이 보냈습니다. 잠시 후 다시 보내 주세요.";
    case "INVALID_BUYER_ID": return "구매자 정보가 올바르지 않습니다. 구매자를 다시 선택해 주세요.";
    default:
      if (e.status === 0) return "판매 서버에 연결할 수 없어 의견을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      return generic;
  }
}

export function VoiceForm({ buyer }: { buyer: string }) {
  const [kind, setKind] = useState<IdeaKind>("event");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inflight = useRef(false);

  const len = count(text.trim());
  const over = len > MAX_TEXT;
  const canSend = len >= MIN_TEXT && !over && !sending;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (inflight.current || !canSend) return;
    inflight.current = true;
    setSending(true);
    setError(null);
    setDone(false);
    try {
      await api.submitIdea({ buyer_id: buyer, kind, text: text.trim() });
      setDone(true);
      setText("");
    } catch (e) {
      // 의견 원문은 콘솔·저장소에 남기지 않는다. 오류 코드로 만든 안내만 보여 준다.
      setError(ideaErrorText(e));
    } finally {
      inflight.current = false;
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-ink-100 bg-surface p-4" aria-busy={sending} aria-labelledby="voice-title">
      <div>
        <h2 id="voice-title" className="font-semibold">고객의 소리</h2>
        <p className="mt-1 text-xs text-ink-500">이런 이벤트·기능이 있으면 좋겠다는 의견을 남겨 주세요. 문의·불만 접수와는 따로 모아 서비스를 준비할 때 참고합니다. 답변은 드리지 않습니다.</p>
      </div>
      {done && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">소중한 의견이 접수되었습니다. 감사합니다.</p>
      )}
      <ErrorNote error={error} />
      <fieldset disabled={sending}>
        <legend className="mb-1.5 text-sm font-medium">의견 종류</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}
              className={`chip py-1.5 text-sm ${kind === k.value ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700"}`}>{k.label}</button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 flex justify-between font-medium"><span>의견 <span className="text-red-700">(필수)</span></span><span className={`text-xs tabular-nums ${over ? "text-red-700" : "text-ink-500"}`}>{len}/{MAX_TEXT}</span></span>
        <textarea className="field h-28 resize-y" value={text} onChange={(e) => { setText(e.target.value); setDone(false); }} disabled={sending} placeholder="예: 생일에 쓸 수 있는 쿠폰을 주면 좋겠어요" />
        {over && <span className="mt-1 block text-xs text-red-700">의견은 {MAX_TEXT}자 이하로 입력해 주세요.</span>}
      </label>
      <p className="text-xs text-ink-500">환불·취소·불량 같은 문제는 위의 1:1 문의로 보내 주세요. 전화번호·카드번호 등 개인정보는 입력하지 마세요.</p>
      <button type="submit" className="btn-primary" disabled={!canSend}>{sending ? "보내는 중…" : "의견 보내기"}</button>
    </form>
  );
}
