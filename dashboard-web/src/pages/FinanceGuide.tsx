import type { ReactNode } from "react";
import { Link } from "@/lib/nav";

// 재무 AI 관리자 사용법. 기준 문서: ax-backend docs/notes/finance/2026-10-23-finance-redesign.md (재무팀 5개 모듈)
// 원본 사용법 문서(ax-backend docs/notes/finance/admin-guide.md)도 같은 내용으로 고쳐야 한다.

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="card overflow-x-auto p-1">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-xs text-ink-500">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-ink-100 align-top">
              {r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "font-medium text-ink-900" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Q = ({ q, children }: { q: string; children: ReactNode }) => (
  <div className="card p-4">
    <p className="font-semibold text-ink-900">{q}</p>
    <div className="mt-1 text-sm text-ink-700">{children}</div>
  </div>
);

export default function FinanceGuidePage() {
  return (
    <div className="max-w-[880px] space-y-10 px-4 pb-14 pt-2 sm:px-8">
      <header>
        <Link href="/finance" className="text-sm text-brand-700 hover:underline">← 재무 AI로 돌아가기</Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">재무 AI 관리자 사용법</h1>
        <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-700">
          재무 AI는 <b>캣북스의 재무팀</b>입니다. 실제 회사 재무팀처럼 <b>결산, 매출·PG 대사, 판매자 정산, 예산·한도 정책, 사후 감사</b>를 맡습니다.
          일하는 순서는 늘 같습니다: <b>자료를 자동으로 모으고 → 규칙으로 맞춰 보고 → 맞지 않는 예외만 사람에게 올리고 → 결산과 리포트를 만듭니다.</b>
          쿠폰이나 환불을 한 건씩 승인하는 일은 하지 않습니다.
        </p>
      </header>

      <Part title="매일 아침: 재무 AI 테스트">
        <p>재무 AI 화면 오른쪽 위 <b>재무 AI 테스트</b>를 누르면 재무 AI가 스스로 점검합니다. 가짜 자료로 점검해서 실제 기록이나 돈에는 영향이 없고, 몇 초 안에 끝납니다. 결과는 12시간 동안만 보이고, 그 뒤에는 다시 테스트해야 합니다.</p>
        <Table
          head={["결과", "뜻", "할 일"]}
          rows={[
            [<span key="p" className="text-emerald-700">정상 (초록)</span>, "계산과 연결이 모두 정상", "없음"],
            [<span key="w" className="text-amber-700">주의 (노랑)</span>, "계산은 정상이지만 쇼핑몰·안전 장치 등 일부 연결이 안 됨", "해당 서버를 켜거나 담당자에게 알림. 그동안 일부 숫자가 '확인할 수 없음'으로 보일 수 있음"],
            [<span key="f" className="text-red-700">실패 (빨강)</span>, "계산이 틀리거나 꼭 필요한 연결이 끊김", <b key="fb">바로 재무 담당자(태윤)에게 알림</b>],
          ]}
        />
      </Part>

      <Part title="재무 AI와 안전 장치는 하는 일이 다릅니다">
        <Table
          head={["", "안전 장치", "재무 AI (재무팀)"]}
          rows={[
            ["언제", "다른 AI가 쿠폰·환불 같은 일을 할 때마다, 한 건씩", "하루·한 주·한 달 단위로 모아서"],
            ["무엇을", "기준표(한도)를 넘는지, 금액 계산이 맞는지 검사", "결산, 대사, 판매자 정산, 한도 제안, 사후 감사"],
            ["사람에게", "한도를 넘는 건을 보류 큐로 보냄", "맞지 않는 예외와 확정·승인할 일만 '지금 사람이 할 일'에 올림"],
          ]}
        />
        <p>한도 안의 쿠폰·환불은 안전 장치가 바로 처리하고, 넘으면 <b>안전 장치 보류 큐</b>로 갑니다. 재무 AI는 그 한도를 얼마로 할지 데이터를 보고 <b>제안</b>하고, 나중에 전부 다시 훑어 수상한 패턴을 찾습니다.</p>
        <p>숫자는 모두 코드가 계산합니다. AI는 리포트의 설명 문장만 씁니다. 받지 못한 값은 짐작하지 않고 <b>"확인할 수 없음"</b>으로 표시합니다. 화면에 <b>예시 데이터</b> 표시가 있으면 실제 쇼핑몰 자료가 아니라 연습용 자료입니다.</p>
      </Part>

      <Part title="화면 맨 위: 지금 사람이 할 일 · 오늘의 재무">
        <p><b>지금 사람이 할 일</b>에는 재무 AI가 자동으로 맞춰 보고 남은 일만 나옵니다. 항목을 누르면 해당 모듈로 이동합니다.</p>
        <Table
          head={["종류", "예", "어디서 처리"]}
          rows={[
            ["판매자 정산", "판매자 정산 3곳 지급 승인 대기", "③ 판매자 정산 → 안전 장치 보류 큐"],
            ["결산", "어제 결산 확정 대기", "① 결산·리포트"],
            ["대사", "PG 금액이 주문과 다른 결제 2건", "② 매출·PG 대사"],
            ["감사", "같은 고객 반복 환불 의심", "⑦ 내부통제·감사"],
            ["한도", "이번 달 쿠폰 예산 80% 사용", "⑤ 예산·한도 정책"],
          ]}
        />
        <p><b>오늘의 재무</b> 카드는 오늘 숫자입니다.</p>
        <Table
          head={["카드", "뜻"]}
          rows={[
            ["총거래액", "고객이 결제한 금액 전체 (GMV). 판매자 몫이 섞여 있어 캣북스의 매출은 아닙니다"],
            ["판매 수수료 매출", "판매자에게 받는 수수료. 캣북스의 실제 매출입니다"],
            ["환불", "고객에게 돌려준 돈"],
            ["쿠폰 비용", "회사가 부담한 쿠폰 할인 (판매자가 부담한 쿠폰은 빠짐)"],
            ["PG 수수료", "카드 결제를 대신 처리해 주는 결제대행사(PG)에 내는 수수료"],
            ["영업 결과", "수수료 매출에서 쿠폰 비용·환불 부담·PG 수수료를 뺀 값. − 이면 손해"],
          ]}
        />
      </Part>

      <Part title="재무팀 5개 모듈">
        <h3 className="font-semibold text-ink-900">① 결산·리포트</h3>
        <p>하루 또는 한 달 동안 얼마를 벌고 얼마를 썼는지 정리합니다. 손익 요약표, 장부에 적을 내용(분개) 미리보기, 쉬운 말 설명이 나옵니다. 설명에는 <b>AI가 씀</b> 또는 <b>템플릿 문장</b> 표시가 붙습니다. 숫자는 표가 기준입니다.</p>
        <p><b>할 일:</b> 숫자를 확인하고 <b>결산 확정</b>을 누릅니다. 확정하면 그 기간 숫자를 보고 기준으로 고정합니다. 돈이 움직이지는 않습니다. 장애로 생긴 손실(실패 주문, 피해 금액, 보상 쿠폰, 총 손실)도 결산·리포트의 일부로 화면 아래에 나옵니다.</p>

        <h3 className="pt-2 font-semibold text-ink-900">② 매출·PG 대사</h3>
        <p>대사는 "우리 주문 기록"과 "결제대행사(PG)가 보낸 정산 자료"를 한 건씩 맞춰 보는 일입니다. 맞는 건(일치)은 기본으로 숨기고 아래 건만 보여 줍니다.</p>
        <Table
          head={["상태", "뜻", "보통 할 일"]}
          rows={[
            ["금액 다름", "주문 금액과 PG 금액이 다름", "쇼핑몰 주문과 PG 관리 화면을 비교하고 PG사에 문의"],
            ["PG에 기록 없음", "결제는 됐는데 PG 자료에 없음", "PG사에 문의. 결제 취소 여부 확인"],
            ["수수료 이상", "PG 수수료가 계약 비율과 다름", "PG 계약 수수료율 확인"],
            ["정산 전", "PG가 아직 돈을 보내기 전", "기다림. 입금일이 지나도 그대로면 문의"],
          ]}
        />
        <p><b>할 일:</b> 처리한 내용을 건마다 <b>메모</b>로 남깁니다 (예: "PG사에 문의함").</p>

        <h3 className="pt-2 font-semibold text-ink-900">③ 판매자 정산</h3>
        <p>판매자에게 줄 돈(정산금) = <b>판매액 − 판매 수수료 − 판매자가 부담한 쿠폰 − 환불</b>. 지난주(월~일) 거래를 판매자별로 계산합니다. 처리 중인 환불·교환이 있거나, 구매 확정이 안 됐거나, 위험한 판매자는 <b>보류 사유</b>가 붙고 자동으로 빠집니다.</p>
        <p><b>할 일:</b> 표를 확인하고 <b>정산 묶음 지급 승인 요청</b>을 누릅니다. 요청은 <b>안전 장치 보류 큐</b>로 가고(확인 번호가 나옵니다), 같은 화면 아래 보류 큐에서 <b>진행</b>을 눌러야 지급이 기록됩니다. 데모에서는 실제로 송금하지 않습니다. 안전 장치가 꺼져 있으면 요청 자체가 되지 않고 아무 기록도 남지 않습니다.</p>

        <h3 className="pt-2 font-semibold text-ink-900">⑤ 예산·한도 정책</h3>
        <p>쿠폰 한도, 환불 한도, 보상 한도, 판매자 위험 기준처럼 안전 장치가 쓰는 한도와 오늘·이번 달에 얼마나 썼는지 보여 줍니다. 막대 색: 초록은 여유, 노랑은 거의 다 씀, 빨강은 한도 넘음.</p>
        <p>재무 AI는 데이터를 보고 한도를 바꾸자고 <b>제안</b>만 합니다 (예: "최근 2주 환불 95%가 8만 원 이하 → 자동 환불 한도 10만 원을 8만 원으로"). <b>한도를 실제로 바꾸는 것은 사람</b>이고, 기준표(<code>thresholds.toml</code>)를 고치는 PR로 합니다. 재무 담당자(태윤)에게 요청하세요.</p>

        <h3 className="pt-2 font-semibold text-ink-900">⑦ 내부통제·감사</h3>
        <p>지난 7·14·30일 기록을 전부 다시 훑어 수상한 패턴을 찾습니다(사후 감사). 건마다 막는 것이 아니라 나중에 점검하는 것입니다.</p>
        <Table
          head={["찾는 것", "예"]}
          rows={[
            ["한도 바로 아래로 쪼개기", "한도 10,000원인데 1시간 안에 9,900원 쿠폰 3장"],
            ["같은 고객 반복 환불", "한 고객이 일주일에 환불 4번"],
            ["같은 고객 쿠폰 중복", "같은 쿠폰을 한 고객에게 두 번"],
            ["환불률 급변", "환불률이 지난주 3.1% → 이번 주 5.2%"],
            ["실행 관문 보류·거절 증가", "안전 장치가 보류·거절한 건이 늘어남"],
          ]}
        />
        <p><b>할 일:</b> 위험 <b>높음</b>부터 관련 기록 번호로 조사하고, 결론을 재무 담당자에게 알립니다.</p>
      </Part>

      <Part title="안전 장치 보류 큐에서 결정하기">
        <p>판매자 정산 지급처럼 사람만 정할 수 있는 일과, 안전 장치 한도를 넘은 쿠폰·환불이 여기 모입니다. 카드의 <b>금액</b>(코드가 다시 계산한 값), <b>이유</b>, 파란 상자의 <b>이럴 땐</b> 힌트를 읽고 <b>진행</b> 또는 <b>멈춤</b>을 누릅니다.</p>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">애매하면 <b>멈춤</b>을 누르세요. 진행은 되돌릴 수 없고, 멈춘 일은 요청한 쪽이 고쳐서 다시 요청할 수 있습니다. 정한 시간 안에 아무도 누르지 않으면 자동으로 멈춥니다.</p>
      </Part>

      <Part title="자주 묻는 질문">
        <Q q="쿠폰·환불 한도(예: 환불 10만 원)를 바꾸고 싶어요.">재무 AI 화면의 ⑤ 예산·한도 정책에서 재무 AI의 제안과 근거를 확인한 뒤, 재무 담당자(태윤)에게 기준표(<code>thresholds.toml</code>) 수정 PR을 요청하세요. 재무 AI도 화면에서도 한도를 직접 바꿀 수 없습니다.</Q>
        <Q q="결산 확정·메모 저장·결정 버튼이 꺼져 있어요.">사람 권한이 설정되지 않은 것입니다. 데모에서는 ax-frontend 루트 <code>.env</code>에 <code>VITE_SAFETY_HUMAN_TOKEN=human:이름</code>을 넣고 대시보드를 다시 켭니다. 실제 운영에서는 재무 담당자에게 사람용 권한을 받습니다.</Q>
        <Q q="&quot;확인할 수 없음&quot;이 보여요.">재무 AI가 그 값을 원래 자료(쇼핑몰, 안전 장치 등)에서 받지 못했다는 뜻입니다. 짐작한 값을 넣지 않습니다. 해당 서버가 켜져 있는지 확인하세요.</Q>
        <Q q="&quot;예시 데이터&quot; 표시가 있어요.">재무 AI가 목 모드로 켜져 있어 연습용 자료(판매자 3곳, 2주치 주문)를 보여 주는 중입니다. 실제 쇼핑몰 숫자가 아닙니다.</Q>
        <Q q="&quot;재무 AI 서버(8105)에 연결하지 못했습니다&quot;가 보여요.">서버가 꺼져 있습니다. ax-backend에서 <code>docker compose -f infra/compose.yml up -d safety finance</code>로 켭니다. 안전 장치가 꺼져 있는 동안 돈이 나가는 일은 모두 멈춥니다(실행되지 않음).</Q>
        <Q q="예전 화면의 '재무 AI가 대신 결정한 일'과 '처리 흐름'은 어디 갔나요?">재무 AI가 건별로 승인하는 방식을 없앴기 때문에 함께 없앴습니다. 건별 검사는 안전 장치가 하고, 보류·거절 추이는 ⑦ 내부통제·감사에서 봅니다.</Q>
      </Part>

      <p className="text-xs text-ink-500">문의: 재무/정산 담당 태윤</p>
    </div>
  );
}
