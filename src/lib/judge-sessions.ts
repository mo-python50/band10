export type JudgeSession = { evaluationId: string; code: string; evaluationName: string; judgeName: string };
const KEY = "band:sessions";

export function loadSessions(): JudgeSession[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as JudgeSession[];
    return list.filter((s) => localStorage.getItem(`band:judge:${s.evaluationId}`));
  } catch {
    return [];
  }
}

export function saveSession(s: JudgeSession) {
  const list = loadSessions().filter((x) => x.evaluationId !== s.evaluationId);
  localStorage.setItem(KEY, JSON.stringify([s, ...list].slice(0, 10)));
}

export function removeSession(evaluationId: string) {
  localStorage.removeItem(`band:judge:${evaluationId}`);
  localStorage.setItem(KEY, JSON.stringify(loadSessions().filter((x) => x.evaluationId !== evaluationId)));
}
