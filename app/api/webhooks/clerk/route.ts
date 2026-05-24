import { Webhook } from 'svix';
import { headers } from 'next/headers';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/app/lib/prismaSingleton';

export async function POST(req: Request) {
  console.log('Webhook received:', req.method, req.url);
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) throw new Error('CLERK_WEBHOOK_SECRET is not set');

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing Svix headers', { status: 400 });
  }

  const body = await req.text();

  let event: WebhookEvent;
  try {
    event = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  console.log('Event type:', event.type);
  if (event.type === 'user.created') {
    console.log('Creating user:', event.data.id);
    const primaryEmail = event.data.email_addresses.find(
      (e) => e.id === event.data.primary_email_address_id
    );

    if (!primaryEmail) {
      return new Response('No primary email on user.created', { status: 400 });
    }

    await db.user.create({
      data: {
        id: event.data.id,
        email: primaryEmail.email_address,
      },
    });
  }

  return new Response('OK', { status: 200 });
}