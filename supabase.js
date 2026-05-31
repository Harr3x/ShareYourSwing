import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, username });
  if (profileError) throw profileError;
  return data.user;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
  location.hash = '#login';
}

// Cloud round helpers

export async function publishRound(course, date, participantMap) {
  const user = await getCurrentUser();
  const { data: round, error } = await supabase
    .from('cloud_rounds')
    .insert({
      created_by: user.id,
      course_name: course.name,
      holes: course.holes,
      date,
    })
    .select()
    .single();
  if (error) throw error;

  const participants = participantMap.map(p => ({
    round_id: round.id,
    user_id: p.userId,
    display_name: p.displayName,
    scores: p.scores,
  }));
  const { error: partError } = await supabase.from('round_participants').insert(participants);
  if (partError) throw partError;
  return round;
}

export async function getFriends() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id, profiles!friendships_requester_id_fkey(username), profiles!friendships_addressee_id_fkey(username)')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  if (error) throw error;
  return (data || []).map(f => {
    const isSender = f.requester_id === user.id;
    return {
      friendshipId: f.id,
      userId: isSender ? f.addressee_id : f.requester_id,
      username: isSender
        ? f['profiles!friendships_addressee_id_fkey']?.username
        : f['profiles!friendships_requester_id_fkey']?.username,
    };
  });
}

export async function findProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .single();
  if (error) return null;
  return data;
}

export async function sendFriendRequest(addresseeId) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId });
  if (error) throw error;
}

export async function getPendingRequests() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, profiles!friendships_requester_id_fkey(username)')
    .eq('addressee_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  return (data || []).map(f => ({
    friendshipId: f.id,
    userId: f.requester_id,
    username: f['profiles!friendships_requester_id_fkey']?.username,
  }));
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function getFeedRounds() {
  const { data, error } = await supabase
    .from('cloud_rounds')
    .select(`
      id, course_name, holes, date, created_by,
      profiles!cloud_rounds_created_by_fkey(username),
      round_participants(user_id, display_name, scores)
    `)
    .order('date', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}
