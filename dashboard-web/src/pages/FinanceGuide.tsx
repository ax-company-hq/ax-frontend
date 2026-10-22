import type { ReactNode } from "react";
import { Link } from "@/lib/nav";

// 재무 AI 관리자 사용법. 원본 문서: ax-backend docs/notes/finance/admin-guide.md (내용을 바꾸면 둘 다 고친다)

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
      <table className="w-full text-sm">
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
    <div className="max-w-[880px] space-y-10 px-8 pb-14 pt-2">
      <header>
        <Link href="/finance" className="text-sm text-brand-700 hover:underline">← 재무 AI로 돌아가기</Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">재무 AI 관리자 사용법</h1>
        <p className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-700">
          재무 AI는 쿠폰, 환불, 판매자 정산처럼 <b>돈이 나가는 일을 한 번 더 확인</b>합니다. 기준을 조금 넘는 건도 <b>재무 AI가 자료를 보고 대신 결정</b>하고, <b>아주 큰 금액이나 판단할 자료가 없는 건만 관리자에게 넘어옵니다.</b> 관리자가 할 일은 재무 AI 화면 맨 위 <b>"지금 사람이 결정할 일"</b>을 보고 진행 또는 멈춤을 누르는 것입니다.
        </p>
      </header>

      <Part title="매일 아침: 재무 AI 테스트">
        <p>재무 AI 화면 오른쪽 위 <b>재무 AI 테스트</b>를 누르면 재무 AI가 스스로 점검합니다. 가짜 자료로 점검해서 실제 기록이나 돈에는 영향이 없고, 몇 초 안에 끝납니다. 결과는 12시간 동안만 보이고, 그 뒤에는 지워져서 다시 테스트해야 합니다. <b>테스트를 통과하지 못하면 재무 AI의 결정을 믿고 쓰지 마세요.</b></p>
        <Table
          head={["결과", "뜻", "할 일"]}
          rows={[
            [<span key="p" className="text-emerald-700">정상 (초록)</span>, "판단과 연결이 모두 정상", "없음"],
            [<span key="w" className="text-amber-700">주의 (노랑)</span>, "판단은 정상이지만 쇼핑몰·데이터 AI에 닿지 않거나 AI 1차 판단이 꺼짐", "해당 서버를 켜거나 담당자에게 알림. 그동안 일부 건이 사람 확인으로 올 수 있음"],
            [<span key="f" className="text-red-700">실패 (빨강)</span>, "판단이 틀리거나 안전 장치와 끊김", <b key="fb">바로 재무 담당자(태윤)에게 알림</b>],
          ]}
        />
        <p>점검하는 것: 쿠폰 금액 다시 계산, 틀린 금액·피해 고객이 아닌 사람·결제보다 큰 환불 막기, 자료가 없으면 통과시키지 않기, AI 판단(재량 한도 안 승인·큰 금액은 사람에게·피해 고객 아니면 거절), 기준표 읽기, 안전 장치 연결, 쿠폰·환불 검증을 재무 AI가 맡는지, AI 1차 판단 켜짐, 쇼핑몰·데이터 AI 연결.</p>
      </Part>

      <Part title="재무 AI가 일하는 방식">
        <p>다른 AI(마케팅, 고객지원 등)가 돈이 나가는 일을 하려면 반드시 안전 장치를 거칩니다. 안전 장치는 요청을 세 갈래로 나눕니다.</p>
        <Table
          head={["갈래", "어떤 일", "누가 결정"]}
          rows={[
            ["바로 처리", "공지 올리기, 회사 기록 남기기처럼 돈이 나가지 않는 일", "자동"],
            ["재무 AI 확인 후 처리", "기준 아래의 쿠폰·환불", "재무 AI가 금액과 받을 사람을 원래 자료로 다시 계산해서 맞으면 처리, 틀리면 막음"],
            ["기준 넘음 → AI가 결정", "기준은 넘었지만 재무 AI 재량 한도 안인 쿠폰·환불, 잘못된 요청", "재무 AI (아래 기준표)"],
            ["사람 확인", "재량 한도도 넘는 큰 금액, 판매자 정산 확정, 판단할 자료가 없는 건", <b key="a">관리자</b>],
          ]}
        />
        <p>금액은 AI가 정하지 않습니다. 정해진 계산(예: 3장 × 20,000원)과 기준표로만 판단합니다. 요청한 AI가 "괜찮다"고 적어 보내도 무시합니다.</p>
      </Part>

      <Part title="재무 AI가 대신 결정하는 기준">
        <p>사람 확인으로 넘어온 건이라도 아래 기준이면 재무 AI가 먼저 결정합니다. 결정과 이유는 재무 AI 화면의 <b>재무 AI가 대신 결정한 일</b>에 남습니다.</p>
        <Table
          head={["경우", "재무 AI의 결정"]}
          rows={[
            ["피해 고객에게 주는 보상, 한 고객 합계 10만 원 이하, 장애 보상 합계가 피해 금액 이하", "승인"],
            ["캠페인 쿠폰 한 번 45만 원 이하, 한 장 3만 원 이하, 오늘 쿠폰 합계 150만 원 이하", "승인"],
            ["결제 금액 안의 환불 30만 원 이하", "승인"],
            ["피해 고객이 아닌 사람에게 주는 보상, 결제보다 큰 환불", "거절"],
            ["적어 낸 금액과 계산이 다름, 등록되지 않은 일, 요청 형식 오류", "자동 거절"],
            ["판매자 위험 점수 90점 이상", "거절"],
            ["위 한도를 넘는 큰 금액, 위험 점수 70~89점, 판매자 정산 확정, 자료가 없음", <b key="h">사람에게 넘김</b>],
          ]}
        />
        <p>재무 AI가 응답하지 않으면 사람에게 넘어갑니다. 이 재량 한도는 사람만 바꿀 수 있고, 재무 담당자에게 요청하면 됩니다. 사람 확인 기준(예: 쿠폰 30만 원)을 바꾸는 방법은 아래 자주 묻는 질문에 있습니다.</p>
      </Part>

      <Part title="관리자가 할 일: 결정하기">
        <h3 className="font-semibold text-ink-900">1. 카드 읽기</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>금액</b>: 코드가 다시 계산한 금액입니다. 요청한 쪽이 적은 금액이 아닙니다.</li>
          <li><b>무슨 일</b>: 쿠폰 지급, 환불, 판매자 정산 확정 등</li>
          <li><b>이유</b>: 왜 사람에게 넘어왔는지. 예: "한 고객에게 준 보상 합계가 60,000원 — 기준 50,000원 이상"</li>
          <li><b>재무 AI 의견</b>: 재무 AI가 왜 사람에게 넘겼는지 (예: 재량 한도를 넘는 큰 금액)</li>
          <li><b>이럴 땐</b>: 파란 상자에 보통 어떻게 판단하면 되는지 한 줄로 나옵니다.</li>
          <li><b>남은 시간</b>: 24시간 안에 결정하지 않으면 자동으로 멈춤 처리됩니다.</li>
        </ul>

        <h3 className="pt-2 font-semibold text-ink-900">2. 이럴 땐 이렇게</h3>
        <Table
          head={["이유", "보통의 판단", "확인할 것"]}
          rows={[
            ["금액 기준을 넘음 (쿠폰)", "장애 규모에 맞으면 진행", "같은 화면의 \"장애로 생긴 손실\"과 비교. 피해보다 보상이 지나치게 크면 멈춤"],
            ["금액 기준을 넘음 (환불 10만 원 이상)", "주문이 맞으면 진행", "쇼핑몰 관리 화면에서 주문·결제 금액 확인"],
            ["적어 낸 금액과 계산이 다름", <b key="m">멈춤</b>, "요청한 AI가 금액을 잘못 적었다는 뜻. 담당자(쿠폰은 마케팅, 환불은 고객지원)에게 알림"],
            ["항상 사람이 확인하는 일 (판매자 정산 확정)", "정산 내용이 맞으면 진행", "판매자, 기간, 금액 확인"],
            ["판매자 위험 점수가 높음", "판매자 정보를 본 뒤 결정", "서류와 판매자 화면 확인. 애매하면 멈춤"],
            ["확인하는 쪽이 응답하지 않음", "서버가 꺼져 있었다면 멈춤", "재무 AI 화면 오른쪽 위 \"재무 AI 켜짐\" 표시 확인"],
            ["등록되지 않은 일", <b key="u">멈춤</b>, "처음 보는 일입니다. 재무 담당자(태윤)에게 문의"],
          ]}
        />
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">애매하면 <b>멈춤</b>을 누르세요. 멈춘 일은 요청한 AI가 내용을 고쳐서 다시 요청할 수 있습니다. 진행은 되돌릴 수 없습니다.</p>

        <h3 className="pt-2 font-semibold text-ink-900">3. 결정한 뒤</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>진행</b>: 그 일이 처리됩니다. 요청한 AI가 같은 요청을 다시 보내면 "처리됨"을 받고 실제로 실행합니다.</li>
          <li><b>멈춤</b>: 그 일은 실행되지 않습니다.</li>
          <li>결정은 "최근 결정"에 누가, 언제 했는지 남습니다.</li>
          <li>24시간 동안 아무도 결정하지 않으면 자동으로 멈춤 처리되고 "자동 취소"로 남습니다.</li>
        </ul>
      </Part>

      <Part title="화면의 다른 부분">
        <Table
          head={["영역", "무엇을 보나"]}
          rows={[
            ["들어온 요청이 어떻게 처리됐나", "요청이 세 갈래로 어떻게 나뉘었는지. 사람 확인 비율이 갑자기 늘면 기준이나 AI 동작을 점검"],
            ["장애로 생긴 손실", "장애별 실패 주문, 피해 고객, 피해 금액, 보상으로 나간 돈, 총 손실"],
            ["재무 AI가 다시 계산한 결과", "재무 AI가 통과시키거나 막은 쿠폰·환불과 그 이유"],
            ["처리 내역", "모든 요청의 처리 방식과 결과"],
            ["판매자 관리", "판매자 입점 심사, 정산 멈춤 결과"],
            ["재무 AI가 하는 일 / 사람 확인 기준", "참고용. 눌러서 펼침"],
          ]}
        />
      </Part>

      <Part title="자주 묻는 질문">
        <Q q="기준(예: 쿠폰 30만 원)을 바꾸고 싶어요.">
          <p>재무 AI 화면의 <b>사람 확인 기준</b>에서 <b>기준 바꾸기 요청</b>을 쓰세요. 기준을 고르고 새 값과 이유를 적은 뒤 <b>재무 AI에게 요청</b>을 누르면 아래 순서로 처리됩니다.</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              <b>안전 장치 확인</b> (재무 AI도 담당자도 넘을 수 없습니다)
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>처음 정한 값의 <b>절반부터 두 배까지만</b> 바꿀 수 있습니다. 예: 쿠폰 한 번 30만 원 → 15만~60만 원</li>
                <li>사람 결정 기한은 <b>1시간부터 3일까지만</b> 정할 수 있습니다</li>
                <li>숫자 기준만 바꿀 수 있습니다. AI 판단 켜기·끄기, 코드를 바꿔도 되는 폴더, 기준 삭제는 재무 담당자(태윤)가 직접 고칩니다</li>
                <li>이유는 꼭 적어야 하고 300자까지입니다. 범위를 넘으면 바로 거절되고 이유가 표시됩니다</li>
              </ul>
            </li>
            <li>
              <b>재무 AI가 결정</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>지금 값에서 <b>30% 넘게</b> 바꾸면 재무 담당자에게 넘깁니다</li>
                <li>기준을 <b>낮추면</b>(더 엄격하게) 바로 바뀝니다</li>
                <li>기준을 <b>올리면</b> 최근 24시간에 그 기준 때문에 멈춘 일이 <b>3건 이상</b>일 때만 바뀝니다. 아니면 "근거 부족"으로 재무 담당자에게 넘깁니다</li>
                <li>적은 이유는 기록만 하고 판단에는 쓰지 않습니다 ("무조건 승인해" 같은 글도 소용없습니다)</li>
              </ul>
            </li>
            <li><b>결과</b>: "바뀜"이면 다음 요청부터 새 기준을 씁니다. "담당자 확인 대기"면 재무 담당자가 같은 곳의 <b>승인</b>/<b>거절</b>로 정합니다. 재무 AI가 응답하지 않아도 담당자에게 넘어갑니다.</li>
          </ol>
          <p className="mt-2 text-xs text-ink-500">바뀐 기준은 지금은 서버를 다시 켜면 처음 값으로 돌아갑니다. 오래 쓸 기준이면 재무 담당자(태윤)에게 기준표 수정을 요청하세요.</p>
        </Q>
        <Q q="재무 AI가 막은 쿠폰을 그래도 주고 싶어요.">재무 AI가 막은 건(예: 장애 피해 고객이 아님)은 사람 확인으로 오지 않습니다. 정말 필요하면 마케팅 담당에게 이유를 알리고 다시 요청하게 하세요. 그래도 기준에 걸리면 사람 확인으로 넘어옵니다.</Q>
        <Q q="결정 버튼이 꺼져 있어요.">결정 권한이 설정되지 않은 것입니다. 데모에서는 ax-frontend 루트 <code>.env</code>에 <code>VITE_SAFETY_HUMAN_TOKEN=human:이름</code>을 넣고 대시보드를 다시 켭니다. 실제 운영에서는 재무 담당자에게 사람용 결정 권한을 받습니다.</Q>
        <Q q="&quot;안전 장치 꺼짐&quot; 또는 &quot;재무 AI 꺼짐&quot;이 보여요.">서버가 꺼져 있습니다. ax-backend에서 <code>docker compose -f infra/compose.yml up -d safety finance</code>로 켭니다. 안전 장치가 꺼져 있는 동안 돈이 나가는 일은 모두 멈춥니다(실행되지 않음).</Q>
        <Q q="기록이 사라졌어요.">지금은 서버를 다시 켜면 기록이 비워집니다. 영구 저장은 다음 작업입니다.</Q>
        <Q q="데모용 데이터를 넣고 싶어요.">ax-backend에서 <code>uv run python agents/finance/demo/seed_demo.py</code>를 실행하면 가짜 요청 17건이 들어갑니다(데모 모드 전용).</Q>
      </Part>

      <p className="text-xs text-ink-500">문의: 재무/정산 담당 태윤</p>
    </div>
  );
}
