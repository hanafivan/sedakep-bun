export const logger = {
  info:  (ctx: string, msg: string, extra?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'INFO',  ctx, msg, ts: Date.now(), ...extra })),
  warn:  (ctx: string, msg: string, extra?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'WARN',  ctx, msg, ts: Date.now(), ...extra })),
  error: (ctx: string, msg: string, extra?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'ERROR', ctx, msg, ts: Date.now(), ...extra })),
};