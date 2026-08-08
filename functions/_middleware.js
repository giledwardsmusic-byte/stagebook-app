export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const publicPaths = ["/login.html", "/api/login"];
  if (publicPaths.includes(url.pathname) || url.pathname.startsWith("/assets")) {
    return next();
  }

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return Response.redirect(url.origin + "/login.html", 302);
  }

  const session = await env.DB.prepare(
    "SELECT sessions.user_id, users.active FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ?"
  ).bind(token).first();

  if (!session || session.active !== 1) {
    return Response.redirect(url.origin + "/login.html", 302);
  }

  return next();
}
