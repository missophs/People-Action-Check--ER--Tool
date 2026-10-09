export function readConfig(env = process.env) {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_TEAM_ID', 'HR_USER_IDS'];
  for (const key of required) if (!env[key] || /replace/i.test(env[key])) throw Error(`Configure ${key} in .env`);
  if (!env.SLACK_BOT_TOKEN.startsWith('xoxb-')) throw Error('SLACK_BOT_TOKEN must be a bot token (xoxb-)');
  if (!env.SLACK_APP_TOKEN.startsWith('xapp-')) throw Error('SLACK_APP_TOKEN must be an app-level token (xapp-)');
  if (!/^T[A-Z0-9]+$/.test(env.SLACK_TEAM_ID)) throw Error('Invalid SLACK_TEAM_ID');
  const hrs = [...new Set(env.HR_USER_IDS.split(',').map(s => s.trim()).filter(Boolean))];
  if (!hrs.length || hrs.length > 20 || hrs.some(id => !/^[UW][A-Z0-9]+$/.test(id))) throw Error('HR_USER_IDS must contain 1–20 valid Slack member IDs');
  const retentionDays = env.RETENTION_DAYS === undefined || env.RETENTION_DAYS === '' ? 0 : Number(env.RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3650) throw Error('RETENTION_DAYS must be an integer from 0 to 3650');
  return { team: env.SLACK_TEAM_ID, hrs, token: env.SLACK_BOT_TOKEN, appToken: env.SLACK_APP_TOKEN,
    dataPath: env.DATA_PATH || './data/pac.sqlite', retentionDays };
}
export async function verifyWorkspace(client, team) {
  const auth = await client.auth.test();
  if (auth.team_id !== team || !auth.bot_id) throw Error('Bot token does not belong to the configured workspace');
}
