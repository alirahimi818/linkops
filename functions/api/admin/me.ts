import { requireAuth } from "./_auth";
import type { EnvAuth } from "./_auth";

export const onRequest: PagesFunction<EnvAuth> = async ({ request, env }) => {
  const user = await requireAuth(env, request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email ?? null,
    },
  });
};
