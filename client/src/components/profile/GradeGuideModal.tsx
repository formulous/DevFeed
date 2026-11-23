import { Modal } from '@/components/common/Modal';
import { formatNumber } from '@/lib/format';
import { GRADES, SCORE_RULES } from '@/lib/grades';

const heading = 'mb-2 text-xs font-semibold text-fg-secondary';
const th = 'whitespace-nowrap pb-2 text-left text-xs font-medium text-fg-muted';

export function GradeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="등급 안내" size="md" variant="sheet">
      <div className="break-keep">
        <p className="text-sm text-fg-secondary">읽고 참여한 만큼 점수가 쌓이고, 누적 점수에 따라 등급이 올라가요.</p>

        <section aria-labelledby="grade-guide-levels" className="mt-5">
          <h3 id="grade-guide-levels" className={heading}>
            등급
          </h3>
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={`${th} w-14 pr-3`}>레벨</th>
                <th className={`${th} pr-3`}>이름</th>
                <th className={`${th} text-right`}>누적 점수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {GRADES.map((g) => (
                <tr key={g.level}>
                  <td className="whitespace-nowrap py-2 pr-3 font-medium">Lv.{g.level}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{g.name}</td>
                  <td className="whitespace-nowrap py-2 text-right tabular-nums">{formatNumber(g.minScore)}점</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="grade-guide-rules" className="mt-6">
          <h3 id="grade-guide-rules" className={heading}>
            점수 얻는 법
          </h3>
          <ul className="divide-y divide-line border-t border-line">
            {SCORE_RULES.map((r) => (
              <li key={r.activity} className="py-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="whitespace-nowrap font-medium">{r.activity}</span>
                  <span className="whitespace-nowrap tabular-nums text-fg">{r.point === '0' ? '0점' : `${r.point}점`}</span>
                </div>
                <p className="mt-0.5 text-xs text-fg-secondary">{r.limit}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-5 rounded-[var(--radius-md)] bg-subtle px-3 py-2.5 text-xs leading-relaxed text-fg-secondary">
          읽은 기록을 지워도 쌓인 점수는 그대로예요. 좋아요 취소나 댓글 삭제처럼 활동을 되돌리면 점수도 빠지고 등급이 내려갈 수 있어요.
        </p>
      </div>
    </Modal>
  );
}
