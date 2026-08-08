export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const password = body.password || "";

    if (!name || !password) {
      return new Response(JSON.stringify({ error: "Missing name or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const user = await env.DB.prepare(
      "SELECT id, name, password, active FROM users WHERE name = ?"
    ).bind(name).first();

    if (!user || user.active !== 1 || user.password !== password) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)"
    ).bind(token, user.id, now).run();

    await env.DB.prepare(
      "UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?"
    ).bind(now, user.id).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
