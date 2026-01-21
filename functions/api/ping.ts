export const onRequest: PagesFunction = async () => {
  return Response.json({ ok: true, ts: new Date().toISOString() });
};
