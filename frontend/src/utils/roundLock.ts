import type { Plot } from '../types/plot';

/**
 * 往期封存判定：样地「锁定往期」后，小于当前复查期次的记录一律只读，
 * 拒绝新增、改动或移除；当前期（等于 surveyRound）不受影响，解锁后恢复。
 */
export function isRoundSealed(
  plot: Pick<Plot, 'locked' | 'surveyRound'> | undefined | null,
  round: number,
): boolean {
  return !!plot && plot.locked && round < plot.surveyRound;
}

/** 封存说明文案（按钮提示、表格标注与拦截报错共用） */
export function sealedRoundText(round: number): string {
  return `第 ${round} 期已封存：样地已锁定往期，该期记录仅可查看。如需修改，请先在样地台账「解锁往期」。`;
}
