export const onRequest: PagesFunction = async ({ request }) => {
  const raw = await request.text();
  return Response.json({
    method: request.method,
    contentType: request.headers.get("content-type"),
    rawBody: raw,
  });
};
