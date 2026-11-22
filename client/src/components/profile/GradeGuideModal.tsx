import { Modal } from '@/components/common/Modal';
import { formatNumber } from '@/lib/format';
import { GRADES, SCORE_RULES } from '@/lib/grades';

const th = 'py-1.5 pr-3 text-left text-xs font-semibold text-fg-secondary';
const td = 'py-1.5 pr-3 align-top';

export function GradeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="등급 안내">
      <p className="mb-3 text-sm text-fg-secondary">읽고 참여한 만큼 점수가 쌓이고, 누적 점수에 따라 등급이 올라가요.</p>
      <table className="mb-5 w-full text-sm">
        <caption className="sr-only">등급별 필요 점수</caption>
        <thead className="border-b border-line">
          <tr>
            <th className={th}>등급</th>
            <th className={th}>이름</th>
            <th className={`${th} text-right`}>누적 점수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {GRADES.map((g) => (
            <tr key={g.level}>
              <td className={`${td} font-medium`}>Lv.{g.level}</td>
              <td className={td}>{g.name}</td>
              <td className={`${td} text-right tabular-nums`}>{formatNumber(g.minScore)}점</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full text-sm">
        <caption className="sr-only">활동별 점수</caption>
        <thead className="border-b border-line">
          <tr>
            <th className={th}>활동</th>
            <th className={th}>점수</th>
            <th className={th}>기준</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {SCORE_RULES.map((r) => (
            <tr key={r.activity}>
              <td className={`${td} whitespace-nowrap font-medium`}>{r.activity}</td>
              <td className={`${td} tabular-nums`}>{r.point}</td>
              <td className={`${td} text-fg-secondary`}>{r.limit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-fg-muted">읽은 기록을 지워도 쌓인 점수는 그대로예요. 좋아요 취소나 댓글 삭제처럼 활동을 되돌리면 점수도 빠지고 등급이 내려갈 수 있어요.</p>
    </Modal>
  );
}
