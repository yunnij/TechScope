interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const count = await env.DB.prepare("SELECT COUNT(*) as count FROM posts").first<{ count: number }>();
  return new Response(
    JSON.stringify({ ok: true, postCount: count?.count ?? 0, now: new Date().toISOString() }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
};
