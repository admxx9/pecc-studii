// This file is no longer needed for the simplified Discord purchase flow.
// It can be removed or kept for future payment gateway integrations.
// To keep the project clean, I'll clear its content.

export async function POST() {
  // This endpoint is currently not used.
  return new Response(JSON.stringify({ message: 'Endpoint not active' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
