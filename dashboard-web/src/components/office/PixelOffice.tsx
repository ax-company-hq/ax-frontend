import { useEffect, useRef } from "react";
import { DESKS, type Bubble, type DeskKey, type OfficeView } from "@/lib/office";

// 픽셀 사무실 캔버스. 그림은 논리 픽셀(256×176)로 그리고 3배로 키운다. 글자(이름표·말풍선)는 키우지 않은 좌표에 선명하게 그린다.
// 픽셀 그림의 색은 캔버스 전용 팔레트다 (화면 UI는 디자인 토큰을 쓴다).

const S = 3, W = 256, H = 176;
const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const DESK_BY = Object.fromEntries(DESKS.map((d) => [d.key, d])) as Record<DeskKey, (typeof DESKS)[number]>;
const ORCH = DESK_BY.orchestrator;
const HOME = { x: ORCH.x + 13, y: ORCH.y - 12 };
/** 두 줄 책상 사이 복도(러그) */
const AISLE_Y = 96;
const SPEED = 70; // 논리 px/초

type Pt = { x: number; y: number };
const standOf = (k: DeskKey): Pt => ({ x: DESK_BY[k].x - 11, y: DESK_BY[k].y - 16 });

export function PixelOffice({ view, label }: { view: OfficeView; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const pos: Pt = { ...HOME };
    let route: Pt[] = [];
    let target: DeskKey | null = null;
    let last = performance.now();
    let raf = 0;

    const plan = (to: DeskKey | null) => {
      const dest = to ? standOf(to) : HOME;
      route = [{ x: pos.x, y: AISLE_Y }, { x: dest.x, y: AISLE_Y }, dest];
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = viewRef.current;
      if (v.walkTo !== target) { target = v.walkTo; plan(target); }
      let moving = false;
      let budget = SPEED * dt;
      while (route.length && budget > 0) {
        const p = route[0];
        const dx = p.x - pos.x, dy = p.y - pos.y, d = Math.hypot(dx, dy);
        if (d <= budget) { pos.x = p.x; pos.y = p.y; budget -= d; route.shift(); }
        else { pos.x += (dx / d) * budget; pos.y += (dy / d) * budget; budget = 0; moving = true; }
      }
      const seated = !route.length && target === null && pos.x === HOME.x && pos.y === HOME.y;
      draw(ctx, v, now / 1000, pos, seated ? "sit" : moving ? "walk" : "stand");
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={ref} width={W * S} height={H * S} role="img" aria-label={label}
      className="block h-auto w-full rounded-2xl [image-rendering:pixelated]" />
  );
}

// ---------------------------------------------------------------- 그리기
type Mode = "sit" | "walk" | "stand";

function draw(ctx: CanvasRenderingContext2D, v: OfficeView, t: number, orch: Pt, orchMode: Mode) {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  drawRoom(R, v);
  for (const row of [DESKS.slice(0, 4), DESKS.slice(4)]) {
    for (const d of row) {
      R(d.x + 11, d.y - 9, 14, 10, "#30354d"); R(d.x + 12, d.y - 8, 12, 8, "#3d4361");
      if (d.key === "orchestrator" && orchMode !== "sit") continue;
      drawChar(R, d.key, d.x + 13, d.y - 12, t, "sit", v.desks[d.key].state);
    }
    for (const d of row) drawDesk(R, d.key, t, v);
  }
  if (orchMode !== "sit") drawChar(R, "orchestrator", orch.x, orch.y, t, orchMode, v.desks.orchestrator.state);

  // 선명한 글자 층
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const d of DESKS) nameTag(ctx, d.key);
  tvText(ctx, v);
  for (const d of DESKS) {
    const dv = v.desks[d.key];
    const away = d.key === "orchestrator" && orchMode !== "sit";
    const cx = away ? (orch.x + 5) * S : (d.x + 18) * S;
    // 총괄이 다른 부서 옆에 서 있으면 그 부서 말풍선과 겹치지 않게 한 칸 위로 띄운다
    const crowded = away && v.walkTo !== null && (v.desks[v.walkTo].state === "waiting" || v.desks[v.walkTo].bubble !== null);
    const top = away ? orch.y * S - (crowded ? 36 : 0) : (d.y - 12) * S;
    if (dv.state === "waiting") bubble(ctx, cx, top, { text: "! 승인 대기", kind: "warn" }, t, true);
    else if (dv.bubble) bubble(ctx, cx, top, dv.bubble, t, false);
  }
}

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;

function drawRoom(R: Rect, v: OfficeView) {
  // 벽
  R(0, 0, W, 30, "#3d4263"); R(0, 0, W, 3, "#4c5276"); R(0, 27, W, 3, "#2a2e47");
  for (const wx of [44, 100, 150]) { R(wx, 6, 30, 16, "#262a41"); R(wx + 1, 7, 28, 14, "#8fc7e8"); R(wx + 1, 7, 28, 5, "#b7dcf2"); R(wx + 14, 7, 2, 14, "#262a41"); R(wx + 1, 13, 28, 1, "#262a41"); }
  // 캣북스 책장
  R(4, 4, 30, 24, "#5b3a22"); R(5, 5, 28, 22, "#3e2716");
  const bc = ["#e76f51", "#2a9d8f", "#e9c46a", "#8e6cf0", "#f4a261", "#3a86ff", "#ff6b9a"];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { const h = 8 - ((i * 3 + r) % 3); R(6 + i * 4, 6 + r * 11 + (9 - h), 3, h, bc[(i + r * 2) % 7]); }
  R(5, 15, 28, 1, "#5b3a22");
  // 벽 화면: 사건 진행
  R(192, 3, 56, 25, "#15172a"); R(194, 5, 52, 21, "#0d1b2a");
  const { done, total } = v.progress;
  if (total > 0) {
    const w = Math.round((done / total) * 46);
    R(197, 20, 46, 3, "#24324a");
    R(197, 20, w, 3, v.status === "alert" ? "#ffb020" : v.status === "degraded" ? "#ff8a3d" : "#3ddc84");
  }
  // 바닥
  for (let y = 30; y < H; y += 12) for (let x = 0; x < W + 24; x += 24) {
    const off = ((y / 12) % 2) * 12;
    R(x - off, y, 24, 12, ((x + y) / 12) % 2 ? "#d9c39e" : "#d2bb94"); R(x - off, y + 11, 24, 1, "#c4ab82"); R(x - off + 23, y, 1, 11, "#c9b087");
  }
  // 복도 러그
  R(2, 91, 252, 24, "#7d8bb5"); R(4, 93, 248, 20, "#8e9cc6"); for (let i = 0; i < 248; i += 8) R(4 + i, 93, 4, 1, "#a8b4d8");
  // 화분
  for (const [px, py] of [[240, 150], [4, 152], [240, 40]]) {
    R(px, py + 10, 10, 8, "#9c5b34"); R(px + 1, py + 10, 8, 2, "#b06c40"); R(px + 2, py, 6, 10, "#3f8f4f"); R(px, py + 3, 4, 6, "#4fa85f"); R(px + 6, py + 2, 4, 6, "#4fa85f"); R(px + 3, py - 2, 4, 4, "#5fbf6f");
  }
}

function shade(hex: string, p: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (p < 0 ? c * p : (255 - c) * p))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawChar(R: Rect, key: DeskKey, x: number, y: number, t: number, mode: Mode, state: string) {
  const d = DESK_BY[key];
  const seed = DESKS.indexOf(d) + 1;
  const typing = mode === "sit" && state === "working";
  R(x + 1, y, 8, 3, d.hair); R(x + 1, y + 3, 1, 2, d.hair); R(x + 8, y + 3, 1, 2, d.hair);
  R(x + 2, y + 2, 6, 5, d.skin); R(x + 1, y + 2, 8, 1, d.hair);
  if (key === "orchestrator") { R(x + 2, y - 1, 6, 1, "#ffb020"); R(x + 2, y - 2, 1, 1, "#ffb020"); R(x + 4, y - 2, 2, 1, "#ffb020"); R(x + 7, y - 2, 1, 1, "#ffb020"); }
  const blink = (t * 1000 + seed * 997) % 3600 < 130;
  const look = mode === "sit" && Math.floor(t / 2.7 + seed) % 4 === 0 ? 1 : 0;
  if (!blink) { R(x + 3 + look, y + 4, 1, 1, "#222"); R(x + 6 + look, y + 4, 1, 1, "#222"); }
  if (state === "waiting") R(x + 4, y + 6, 2, 1, "#b23a48");
  R(x + 1, y + 7, 8, 5, d.shirt); R(x + 4, y + 7, 2, 1, d.skin);
  const dark = shade(d.shirt, -0.25);
  R(x, y + 8, 1, 3, dark); R(x + 9, y + 8, 1, 3, dark);
  if (typing) { const ph = Math.floor(t * 9 + seed) % 2; R(x + 1, y + 11 - ph, 2, 1, d.skin); R(x + 7, y + 10 + ph, 2, 1, d.skin); }
  else if (mode === "sit") { R(x + 1, y + 11, 2, 1, d.skin); R(x + 7, y + 11, 2, 1, d.skin); }
  else { R(x, y + 11, 1, 1, d.skin); R(x + 9, y + 11, 1, 1, d.skin); }
  if (mode !== "sit") {
    const ph = mode === "walk" ? Math.floor(t * 8) % 2 : 0;
    R(x + 2, y + 12, 2, 2 + (ph ? 0 : 1), "#2b2f45"); R(x + 6, y + 12, 2, 2 + (ph ? 1 : 0), "#2b2f45");
  }
}

function drawDesk(R: Rect, key: DeskKey, t: number, v: OfficeView) {
  const d = DESK_BY[key], s = v.desks[key].state, seed = DESKS.indexOf(d) + 1;
  const { x, y } = d;
  R(x + 2, y - 10, 13, 9, "#20232f");
  const scr = s === "working" ? "#183a2d" : s === "waiting" ? (Math.floor(t * 3) % 2 ? "#5a1d26" : "#3a1820") : "#2e3b55";
  R(x + 3, y - 9, 11, 6, scr);
  if (s === "working") for (let i = 0; i < 3; i++) R(x + 4, y - 8 + i * 2, Math.min(9, 3 + ((Math.floor(t * 6) + i * 5 + seed) % 6)), 1, "#3ddc84");
  else if (s === "idle") R(x + 6, y - 7, 5, 2, "#45577d");
  R(x + 7, y - 2, 3, 2, "#20232f");
  const top = key === "orchestrator" ? "#5b4fd0" : "#a7703f";
  R(x, y, 36, 4, top); R(x, y, 36, 1, shade(top, 0.2)); R(x, y + 4, 36, 9, shade(top, -0.3)); R(x + 2, y + 13, 3, 3, "#5c3a1d"); R(x + 31, y + 13, 3, 3, "#5c3a1d");
  R(x + 29, y - 3, 4, 3, "#f1f1f1"); R(x + 33, y - 2, 1, 2, "#f1f1f1"); R(x + 21, y - 1, 6, 1, "#f5f0e1");
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function nameTag(ctx: CanvasRenderingContext2D, key: DeskKey) {
  const d = DESK_BY[key];
  const cx = (d.x + 18) * S, cy = (d.y + 19) * S;
  ctx.font = `700 12px ${FONT}`;
  const w = ctx.measureText(d.label).width + 28;
  ctx.fillStyle = "rgba(22,25,40,.8)"; rr(ctx, cx - w / 2, cy - 10, w, 20, 10); ctx.fill();
  ctx.fillStyle = d.shirt; ctx.beginPath(); ctx.arc(cx - w / 2 + 11, cy, 4, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d.label, cx + 6, cy + 0.5);
}

function tvText(ctx: CanvasRenderingContext2D, v: OfficeView) {
  const { done, total } = v.progress;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `600 11px ${FONT}`; ctx.fillStyle = "#8da2c0";
  ctx.fillText(total ? "사건 진행" : "총괄 사건", 197 * S, 11 * S);
  ctx.font = `800 14px ${FONT}`; ctx.textAlign = "right";
  const txt = !v.incident ? "없음" : v.status === "alert" ? `${done}/${total}` : v.status === "degraded" ? "일부 미완료" : "해결";
  ctx.fillStyle = v.status === "alert" ? "#ffb020" : v.status === "degraded" ? "#ff8a3d" : "#3ddc84";
  ctx.fillText(txt, 244 * S, 11 * S + 2);
  if (v.incident && v.status === "alert") {
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = "#c9d3e2"; ctx.textAlign = "left";
    ctx.fillText("결제 장애 대응", 197 * S, 17 * S + 2);
  }
}

function bubble(ctx: CanvasRenderingContext2D, cx: number, top: number, b: Bubble, t: number, blink: boolean) {
  ctx.font = `700 13px ${FONT}`;
  const think = b.kind === "think";
  const txt = think ? b.text + ".".repeat(1 + (Math.floor(t * 3) % 3)) : b.text;
  const w = Math.ceil(ctx.measureText(think ? `${b.text}...` : txt).width) + 18, h = 26;
  const x = Math.round(Math.max(6, Math.min(W * S - w - 6, cx - w / 2))), y = Math.round(top - h - 10);
  const look: Record<string, [string, string, string]> = {
    say: ["#ffffff", "#1d2233", "#1d2233"], think: ["#eef1ff", "#2e2688", "#2e2688"], ok: ["#dcf7e6", "#065f46", "#065f46"],
    warn: [blink && Math.floor(t * 2.5) % 2 ? "#ffb020" : "#ffc95a", "#3b2600", "#6b4500"], alert: ["#ff4d5e", "#ffffff", "#7a1420"],
  };
  const [bg, fg, bd] = look[b.kind];
  ctx.fillStyle = bd; ctx.fillRect(x - 3, y, w + 6, h); ctx.fillRect(x, y - 3, w, h + 6);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = bd; ctx.fillRect(cx - 6, y + h, 12, 3); ctx.fillRect(cx - 3, y + h + 3, 6, 3); ctx.fillRect(cx, y + h + 6, 3, 3);
  ctx.fillStyle = bg; ctx.fillRect(cx - 3, y + h, 6, 3); ctx.fillRect(cx, y + h + 3, 3, 1);
  ctx.fillStyle = fg; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, x + 9, y + h / 2 + 0.5);
}
