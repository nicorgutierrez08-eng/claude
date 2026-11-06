// Checks the database rules (scores, privacy, notifications, permissions) against a Supabase project.
// Run: cd tests && npm install && SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run schema
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_ANON_KEY;
if (!KEY) { console.error('Set SUPABASE_ANON_KEY (and SUPABASE_URL)'); process.exit(1); }
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok', m); };
const t = Date.now() % 100000;
async function user(name, priv = false) {
  const c = mk();
  const { data, error } = await c.auth.signUp({ email: `${name}${t}@test.dev`, password: 'password123', options: { data: { username: `${name}${t}`, display_name: name } } });
  if (error) throw error;
  if (priv) await c.from('profiles').update({ is_private: true }).eq('id', data.user.id);
  return { c, id: data.user.id };
}
const a = await user('ana'), b = await user('ben'), p = await user('pri', true);
const anon = mk();

ok((await anon.rpc('username_available', { name: `ana${t}` })).data === false, 'username taken');
ok((await anon.rpc('username_available', { name: 'freshname' + t })).data === true, 'username free');
let r = await a.c.rpc('save_lists', { loved: [30001, 30002, 30003], fine: [30010], disliked: [] });
ok(!r.error, 'save_lists ' + (r.error?.message || ''));
r = await a.c.from('rankings').select('film_id,bucket,pos,score').eq('user_id', a.id).order('score', { ascending: false });
ok(r.data.length === 4 && Number(r.data[0].score) === 10 && Number(r.data.find(x => x.film_id === 30010).score) === 5.9, 'scores ' + JSON.stringify(r.data));
r = await a.c.from('rankings').update({ note: 'great' }).eq('user_id', a.id).eq('film_id', 30001);
ok(!r.error, 'note update');
r = await a.c.rpc('save_lists', { loved: [30003, 30001, 30002], fine: [], disliked: [30010] });
r = await a.c.from('rankings').select('film_id,note,bucket').eq('user_id', a.id).eq('film_id', 30001).single();
ok(r.data.note === 'great', 'note survives reorder');
r = await a.c.from('rankings').update({ score: 1 }).eq('film_id', 30001);
ok(!!r.error, 'cannot write score directly');
r = await a.c.from('profiles').update({ ranked_count: 999 }).eq('id', a.id);
ok(!!r.error, 'cannot fake ranked_count');
r = await a.c.from('profiles').select('ranked_count').eq('id', a.id).single();
ok(r.data.ranked_count === 4, 'ranked_count maintained');
r = await a.c.rpc('save_lists', { loved: [30001, 30001], fine: [], disliked: [] });
ok(!!r.error, 'duplicate rejected');

// activity, like, comment, notifications
r = await a.c.from('activities').insert({ kind: 'ranked', film_id: 30003, bucket: 'loved', score: 10, note: 'wow' }).select().single();
const act = r.data; ok(!!act, 'post activity');
r = await b.c.from('follows').insert({ followee: a.id }).select().single();
ok(r.data?.status === 'accepted', 'follow public accepted');
ok(!(await b.c.from('likes').insert({ activity_id: act.id })).error, 'like');
ok(!(await b.c.from('comments').insert({ activity_id: act.id, body: 'agreed' })).error, 'comment');
ok(!(await b.c.from('recommendations').insert({ to_user: a.id, film_id: 42, message: 'watch this' })).error, 'rec');
r = await a.c.from('notifications').select('kind,actor_id,body').eq('user_id', a.id).order('id');
ok(JSON.stringify(r.data.map(x => x.kind)) === '["follow","like","comment","rec"]', 'notifications ' + JSON.stringify(r.data.map(x => x.kind)));
r = await b.c.from('notifications').select('id');
ok(r.data.length === 0, 'ben sees no notifs of ana');
r = await b.c.from('notifications').insert({ user_id: a.id, actor_id: b.id, kind: 'like' });
ok(!!r.error, 'cannot forge notification');

// embedded feed query
r = await b.c.from('activities').select('*, profiles!activities_user_id_fkey(username,display_name,avatar_hue), likes(count), comments(count)').in('user_id', [a.id]).order('created_at', { ascending: false });
ok(r.data?.[0]?.likes?.[0]?.count === 1 && r.data[0].profiles.username === `ana${t}`, 'feed embed ' + (r.error?.message || JSON.stringify(r.data?.[0])));

// private account
await p.c.rpc('save_lists', { loved: [30005], fine: [], disliked: [] });
await p.c.from('activities').insert({ kind: 'ranked', film_id: 30005, bucket: 'loved', score: 9.2 });
r = await a.c.from('rankings').select('*').eq('user_id', p.id);
ok(r.data.length === 0, 'private rankings hidden');
r = await anon.from('rankings').select('*').eq('user_id', a.id);
ok(r.data.length === 4, 'anon sees public rankings');
r = await a.c.from('follows').insert({ followee: p.id }).select().single();
ok(r.data?.status === 'pending', 'follow private pending');
r = await a.c.from('follows').update({ status: 'accepted' }).eq('follower', a.id).eq('followee', p.id).select();
ok(!r.data?.length, 'cannot self-approve');
r = await p.c.from('notifications').select('kind');
ok(r.data.some(x => x.kind === 'follow_request'), 'request notif');
r = await p.c.from('follows').update({ status: 'accepted' }).eq('follower', a.id).eq('followee', p.id).select();
ok(r.data?.length === 1, 'approve');
r = await a.c.from('rankings').select('*').eq('user_id', p.id);
ok(r.data.length === 1, 'private visible after approval');
r = await a.c.from('notifications').select('kind');
ok(r.data.some(x => x.kind === 'follow_accepted'), 'accepted notif');

// stats
r = await b.c.rpc('save_lists', { loved: [30003], fine: [], disliked: [] });
r = await anon.rpc('film_stats', { ids: [30003, 30005] });
ok(r.data?.length === 2, 'film_stats ' + JSON.stringify(r.data));
r = await anon.rpc('top_films', { min_count: 2, lim: 100 });
ok(r.data?.some((x) => x.film_id === 30003), 'top_films ' + JSON.stringify(r.data));

// watchlist
ok(!(await b.c.from('watchlist').insert({ film_id: 77, from_user: a.id })).error, 'watchlist add');
ok(!!(await b.c.from('watchlist').insert({ user_id: a.id, film_id: 78 })).error, 'cannot add to others watchlist');

// delete account
r = await b.c.rpc('delete_me');
ok(!r.error, 'delete_me ' + (r.error?.message || ''));
r = await anon.from('profiles').select('id').eq('id', b.id);
ok(r.data.length === 0, 'profile gone');
