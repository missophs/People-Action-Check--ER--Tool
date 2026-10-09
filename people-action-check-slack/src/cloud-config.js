export function readCloudConfig(env) {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_TEAM_ID', 'HR_USER_IDS', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const key of required) if (!env[key]) throw Error('Missing protected app configuration');
  const hrs = [...new Set(env.HR_USER_IDS.split(',').map(x => x.trim()).filter(Boolean))];
  if (!env.SLACK_BOT_TOKEN.startsWith('xoxb-') || !/^T[A-Z0-9]+$/.test(env.SLACK_TEAM_ID) || !hrs.length || hrs.length > 20 || hrs.some(id => !/^[UW][A-Z0-9]+$/.test(id))) throw Error('Invalid protected app configuration');
  const retentionDays = env.RETENTION_DAYS ? Number(env.RETENTION_DAYS) : 0;
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3650) throw Error('Invalid protected app configuration');
  return { hrs, retentionDays };
}
