import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let courseName = '';
  try {
    const body = await req.json();
    courseName = String(body.courseName ?? '').slice(0, 100);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();
  const username = profile?.username ?? 'Jemand';

  const { data: friendships } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (!friendships?.length) return new Response('ok', { headers: corsHeaders });

  const friendIds = friendships.map((f: any) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, subscription')
    .in('user_id', friendIds);

  if (!subs?.length) return new Response('ok', { headers: corsHeaders });

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const payload = JSON.stringify({
    title: 'Neue Runde geteilt',
    body: `@${username} hat eine Runde auf ${courseName} abgeschlossen`,
    icon: '/icon-192.png',
  });

  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async ({ id, subscription }: any) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err: any) {
        if (err.statusCode === 410) staleIds.push(id);
        else console.error('Push delivery error:', err.statusCode, err.message);
      }
    })
  );

  if (staleIds.length) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }

  return new Response('ok', { headers: corsHeaders });
});
