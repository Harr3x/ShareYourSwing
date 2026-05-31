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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
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
    .select('id, requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const friendIds = data.map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', friendIds);
  if (profilesError) throw profilesError;

  return data.map(f => {
    const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const profile = (profiles || []).find(p => p.id === friendId);
    return { friendshipId: f.id, userId: friendId, username: profile?.username || friendId };
  });
}

export async function getMyProfile() {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('profiles').select('id, username, is_admin').eq('id', user.id).single();
  if (error) console.error('getMyProfile:', error.message);
  return data || { id: user.id, username: user.user_metadata?.username, is_admin: false };
}

export async function getCourses() {
  const { data, error } = await supabase.from('courses').select('id, name, holes').order('name');
  if (error) throw error;
  return data || [];
}

export async function getCourse(id) {
  const { data, error } = await supabase.from('courses').select('id, name, holes').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getCloudRound(roundId) {
  const { data, error } = await supabase
    .from('cloud_rounds')
    .select('id, course_name, holes, date, round_participants(user_id, display_name, scores)')
    .eq('id', roundId)
    .single();
  if (error) throw error;
  return data;
}

export async function addCourse(name, holes) {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from('courses').insert({ name, holes, created_by: user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCourse(course) {
  const { error } = await supabase.from('courses').update({ name: course.name, holes: course.holes }).eq('id', course.id);
  if (error) throw error;
}

export async function deleteCourse(id) {
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw error;
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
    .select('id, requester_id')
    .eq('addressee_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const requesterIds = data.map(f => f.requester_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', requesterIds);
  if (profilesError) throw profilesError;

  return data.map(f => {
    const profile = (profiles || []).find(p => p.id === f.requester_id);
    return { friendshipId: f.id, userId: f.requester_id, username: profile?.username || f.requester_id };
  });
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function getUserRounds() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('round_participants')
    .select(`
      scores,
      cloud_rounds!inner(id, holes, date)
    `)
    .eq('user_id', user.id);
  if (error) throw error;
  return (data || []).map(p => ({
    courseId: p.cloud_rounds.id,
    playerIds: [user.id],
    scores: { [user.id]: p.scores },
    holes: p.cloud_rounds.holes,
    date: p.cloud_rounds.date,
  }));
}

export async function getCloudRoundsForPlayers(playerIds) {
  if (!playerIds.length) return { rounds: [], courseMap: new Map() };

  const { data: mine } = await supabase
    .from('round_participants')
    .select('round_id')
    .in('user_id', playerIds);

  const roundIds = [...new Set((mine || []).map(p => p.round_id))];
  if (!roundIds.length) return { rounds: [], courseMap: new Map() };

  const { data, error } = await supabase
    .from('round_participants')
    .select('round_id, user_id, scores, cloud_rounds(id, course_name, holes, date)')
    .in('round_id', roundIds);
  if (error) throw error;

  const roundMap = new Map();
  const courseMap = new Map();

  for (const p of (data || [])) {
    const cr = p.cloud_rounds;
    if (!courseMap.has(cr.id))
      courseMap.set(cr.id, { id: cr.id, name: cr.course_name, holes: cr.holes });
    if (!roundMap.has(p.round_id))
      roundMap.set(p.round_id, { courseId: cr.id, playerIds: [], scores: {}, date: cr.date });
    const round = roundMap.get(p.round_id);
    round.playerIds.push(p.user_id);
    round.scores[p.user_id] = p.scores;
  }

  return { rounds: [...roundMap.values()], courseMap };
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
