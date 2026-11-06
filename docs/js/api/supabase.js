// Supabase backend. Every method mirrors api/demo.js; see api/index.js for the contract.
const PROFILE = "id,username,display_name,bio,avatar_hue,is_private,yearly_goal,ranked_count,created_at";
const RANKING = "user_id,film_id,bucket,pos,score,note,watched_on,watched_where,watched_with,rewatch,created_at,updated_at";

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
const num = (r) => ({ ...r, score: r.score == null ? null : Number(r.score) });

export async function createSupabaseApi({ url, anonKey }) {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  let uid = (await sb.auth.getSession()).data.session?.user?.id ?? null;
  let recovery = false;
  sb.auth.onAuthStateChange((event, session) => {
    uid = session?.user?.id ?? null;
    if (event === "PASSWORD_RECOVERY") recovery = true;
  });

  const withProfiles = async (rows, key = "user_id") => {
    const ids = [...new Set(rows.map((r) => r[key]).filter(Boolean))];
    if (!ids.length) return rows;
    const ps = check(await sb.from("profiles").select(PROFILE).in("id", ids));
    const map = new Map(ps.map((p) => [p.id, p]));
    return rows.map((r) => ({ ...r, profile: map.get(r[key]) || null }));
  };

  const enrichActivities = async (rows) => {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const mine = uid ? check(await sb.from("likes").select("activity_id").eq("user_id", uid).in("activity_id", ids)) : [];
    const liked = new Set(mine.map((l) => l.activity_id));
    return rows.map(({ profiles, likes, comments, ...a }) => ({
      ...num(a),
      profile: profiles,
      likes: likes?.[0]?.count ?? 0,
      comments: comments?.[0]?.count ?? 0,
      liked: liked.has(a.id),
    }));
  };
  const ACTIVITY = "*, profiles!activities_user_id_fkey(" + PROFILE + "), likes(count), comments(count)";

  return {
    mode: "supabase",
    get uid() { return uid; },
    takeRecovery() { const r = recovery; recovery = false; return r; },

    async signUp({ email, password, username, displayName }) {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { username, display_name: displayName }, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw new Error(error.message);
      uid = data.session?.user?.id ?? null;
      return { needsConfirm: !data.session };
    },
    async signIn({ email, password }) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
      uid = data.user.id;
    },
    async signOut() { await sb.auth.signOut(); uid = null; },
    async resetPassword(email) {
      check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#/settings" }));
    },
    async updatePassword(password) { check(await sb.auth.updateUser({ password })); },
    async usernameAvailable(name) { return check(await sb.rpc("username_available", { name })); },
    async deleteAccount() { check(await sb.rpc("delete_me")); await sb.auth.signOut(); uid = null; },

    async getProfile(id) { return check(await sb.from("profiles").select(PROFILE).eq("id", id).maybeSingle()); },
    async getProfileByUsername(username) { return check(await sb.from("profiles").select(PROFILE).eq("username", username).maybeSingle()); },
    async updateProfile(patch) { return check(await sb.from("profiles").update(patch).eq("id", uid).select(PROFILE).single()); },
    async searchUsers(q, limit = 20) {
      const s = q.replace(/[%_,()]/g, "").trim();
      if (!s) return [];
      return check(await sb.from("profiles").select(PROFILE).or(`username.ilike.%${s}%,display_name.ilike.%${s}%`).order("ranked_count", { ascending: false }).limit(limit));
    },
    async listProfiles({ ids = null, limit = 50 } = {}) {
      let q = sb.from("profiles").select(PROFILE).order("ranked_count", { ascending: false }).limit(limit);
      if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return check(await q);
    },

    async getRankings(userId) { return check(await sb.from("rankings").select(RANKING).eq("user_id", userId)).map(num); },
    async rankingsOfUsers(ids) {
      if (!ids.length) return [];
      return check(await sb.from("rankings").select("user_id,film_id,bucket,score,created_at").in("user_id", ids).limit(10000)).map(num);
    },
    async rankingsForFilm(filmId) {
      return (await withProfiles(check(await sb.from("rankings").select(RANKING).eq("film_id", filmId).limit(200)))).map(num);
    },
    async saveLists(lists) { check(await sb.rpc("save_lists", lists)); },
    async updateEntry(filmId, patch) { check(await sb.from("rankings").update(patch).eq("user_id", uid).eq("film_id", filmId)); },

    async getWatchlist(userId) { return check(await sb.from("watchlist").select("film_id,from_user,created_at").eq("user_id", userId).order("created_at", { ascending: false })); },
    async addWatch(filmId, fromUser = null) {
      const { error } = await sb.from("watchlist").insert({ film_id: filmId, from_user: fromUser });
      if (error && error.code !== "23505") throw new Error(error.message);
    },
    async removeWatch(filmId) { check(await sb.from("watchlist").delete().eq("user_id", uid).eq("film_id", filmId)); },

    async follow(id) {
      const { data, error } = await sb.from("follows").insert({ followee: id }).select("status").single();
      if (error && error.code !== "23505") throw new Error(error.message);
      return data?.status ?? "accepted";
    },
    async unfollow(id) { check(await sb.from("follows").delete().eq("follower", uid).eq("followee", id)); },
    async removeFollower(id) { check(await sb.from("follows").delete().eq("follower", id).eq("followee", uid)); },
    async approveFollower(id) { check(await sb.from("follows").update({ status: "accepted" }).eq("follower", id).eq("followee", uid)); },
    async getFollows(userId) {
      const [out, inc] = await Promise.all([
        sb.from("follows").select("followee,status,created_at").eq("follower", userId),
        sb.from("follows").select("follower,status,created_at").eq("followee", userId),
      ]);
      const following = await withProfiles(check(out).map((r) => ({ id: r.followee, status: r.status, created_at: r.created_at })), "id");
      const followers = await withProfiles(check(inc).map((r) => ({ id: r.follower, status: r.status, created_at: r.created_at })), "id");
      return { following: following.filter((r) => r.profile), followers: followers.filter((r) => r.profile) };
    },

    async postActivity(a) { return num(check(await sb.from("activities").insert(a).select().single())); },
    async getFeed({ userIds = null, before = null, limit = 20 } = {}) {
      let q = sb.from("activities").select(ACTIVITY).order("created_at", { ascending: false }).limit(limit);
      if (userIds) q = q.in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      if (before) q = q.lt("created_at", before);
      return enrichActivities(check(await q));
    },
    async deleteActivity(id) { check(await sb.from("activities").delete().eq("id", id).eq("user_id", uid)); },
    async like(id) {
      const { error } = await sb.from("likes").insert({ activity_id: id });
      if (error && error.code !== "23505") throw new Error(error.message);
    },
    async unlike(id) { check(await sb.from("likes").delete().eq("activity_id", id).eq("user_id", uid)); },
    async getComments(activityId) {
      return withProfiles(check(await sb.from("comments").select("*").eq("activity_id", activityId).order("created_at")));
    },
    async addComment(activityId, body) {
      const c = check(await sb.from("comments").insert({ activity_id: activityId, body }).select().single());
      return (await withProfiles([c]))[0];
    },
    async deleteComment(id) { check(await sb.from("comments").delete().eq("id", id)); },

    async getNotifications(limit = 50) {
      const rows = check(await sb.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(limit));
      return (await withProfiles(rows, "actor_id")).map((n) => ({ ...n, actor: n.profile }));
    },
    async unreadCount() {
      const { count, error } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("read", false);
      if (error) throw new Error(error.message);
      return count || 0;
    },
    async markNotificationsRead() { check(await sb.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false)); },

    async sendRec(toId, filmId, message) { check(await sb.from("recommendations").insert({ to_user: toId, film_id: filmId, message })); },
    async getRecsForMe() {
      return withProfiles(check(await sb.from("recommendations").select("*").eq("to_user", uid).order("created_at", { ascending: false }).limit(100)), "from_user");
    },
    async deleteRec(id) { check(await sb.from("recommendations").delete().eq("id", id)); },

    async filmStats(ids) {
      if (!ids.length) return new Map();
      return new Map(check(await sb.rpc("film_stats", { ids })).map((r) => [r.film_id, r]));
    },
    async topFilms(minCount = 2, limit = 30) { return check(await sb.rpc("top_films", { min_count: minCount, lim: limit })); },
  };
}
