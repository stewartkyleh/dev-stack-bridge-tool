export async function POST() {
  console.log('TEST ROUTE HIT');
  return new Response('test', { status: 200 });
}