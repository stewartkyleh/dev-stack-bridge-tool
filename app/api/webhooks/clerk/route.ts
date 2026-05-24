import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { NextRequest } from 'next/server';
import { db } from '@/app/lib/prismaSingleton';

export async function POST(req: NextRequest) {
  console.log('Webhook received:', req.method, req.url);
  try{
    const event = await verifyWebhook(req);

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

  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Webhook error', { status: 400 });
  }
}