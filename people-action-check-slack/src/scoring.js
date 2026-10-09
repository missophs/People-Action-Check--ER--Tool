import { QS, computeScore } from './content.js';
// Explicit polarity rules; question wording, weights and guidance remain unchanged.
export const RISK_ON_YES = {
  'Performance Decline': [4],
  'Interpersonal Conflict': [4],
  'Policy Violation': [4],
  'Termination Consideration': [3],
  'Retaliation Concern': [0, 1],
};
export function assessment(record) {
  const qs = record.scenarios.flatMap(name => QS[name]);
  if (record.scoringVersion !== 2) return computeScore(qs, record.answers);
  let offset = 0;
  const normalized = record.scenarios.flatMap(name => QS[name].map((_, i) => {
    const answer = record.answers[offset++];
    return RISK_ON_YES[name]?.includes(i) && ['yes', 'no'].includes(answer)
      ? (answer === 'yes' ? 'no' : 'yes') : answer;
  }));
  const result = computeScore(qs, normalized);
  // Counts always describe actual user responses, not normalized scoring inputs.
  return { ...result, yes: record.answers.filter(a => a === 'yes').length,
    no: record.answers.filter(a => a === 'no').length,
    unk: record.answers.filter(a => a === 'unknown').length };
}
