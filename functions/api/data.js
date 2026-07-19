export async function onRequestGet(context) {
  const { env } = context;
  try {
    const row = await env.DB.prepare("SELECT songs, setlists FROM store WHERE id = 1").first();
    if (!row) {
      return new Response(JSON.stringify({ songs: [], setlists: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      songs: JSON.parse(row.songs || "[]"),
      setlists: JSON.parse(row.setlists || "[]")
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const songs = JSON.stringify(Array.isArray(body.songs) ? body.songs : []);
    const setlists = JSON.stringify(Array.isArray(body.setlists) ? body.setlists : []);
    await env.DB.prepare(
      "INSERT INTO store (id, songs, setlists, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET songs=excluded.songs, setlists=excluded.setlists, updated_at=excluded.updated_at"
    ).bind(songs, setlists, new Date().toISOString()).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
