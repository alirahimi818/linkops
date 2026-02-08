export function requireDeviceId(request: Request): string {
  const id = request.headers.get("X-Device-Id") ?? "";
  if (!id) throw new Error("Missing X-Device-Id");

  // Loose UUID validation
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    throw new Error("Invalid X-Device-Id");
  }

  return id;
}
