export function filterAndScore(
  segs: any[],
  opts: { targetDistanceM: number; targetElevDiffM: number; distTolRatio?: number; elevTolAbs?: number; top?: number }
) {
  const { targetDistanceM, targetElevDiffM, distTolRatio=0.1, elevTolAbs=100, top=5 } = opts;
  const minD = targetDistanceM*(1-distTolRatio), maxD = targetDistanceM*(1+distTolRatio);
  const minE = targetElevDiffM-elevTolAbs,   maxE = targetElevDiffM+elevTolAbs;

  const cand = segs.filter(s => s.distance>=minD && s.distance<=maxD && s.elev_difference>=minE && s.elev_difference<=maxE);

  const scored = cand.map((s:any) => {
    const distScore = 1/(1+Math.abs(s.distance-targetDistanceM));
    const elevScore = 1/(1+Math.abs(s.elev_difference-targetElevDiffM));
    const gradeBonus = Math.max(0, Math.min((s.avg_grade ?? 0)/10, 0.2));
    return { score: 0.6*distScore+0.3*elevScore+0.1*gradeBonus, ...s };
  }).sort((a:any,b:any)=>b.score-a.score);

  return scored.slice(0, top);
}