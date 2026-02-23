interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "D1 binding `DB` is not configured",
        hint: "Check wrangler.toml [[d1_databases]] binding = \"DB\" and Pages local/dev bindings"
      }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const count = await env.DB.prepare("SELECT COUNT(*) as count FROM posts").first<{ count: number }>();
  return new Response(
    JSON.stringify({ ok: true, postCount: count?.count ?? 0, now: new Date().toISOString() }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
};
