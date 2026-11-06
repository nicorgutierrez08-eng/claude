// Picks the backend. Fill in docs/config.js to switch from demo mode to Supabase.
//
// Contract shared by api/demo.js and api/supabase.js (all methods async):
//   auth:     uid, signUp, signIn, signOut, resetPassword, updatePassword, usernameAvailable, deleteAccount
//   profiles: getProfile, getProfileByUsername, updateProfile, searchUsers, listProfiles
//   rankings: getRankings, rankingsOfUsers, rankingsForFilm, saveLists, updateEntry
//   watch:    getWatchlist, addWatch, removeWatch
//   social:   follow, unfollow, removeFollower, approveFollower, getFollows
//   feed:     postActivity, deleteActivity, getFeed, like, unlike, getComments, addComment, deleteComment
//   inbox:    getNotifications, unreadCount, markNotificationsRead, sendRec, getRecsForMe, deleteRec
//   stats:    filmStats, topFilms
export let api = null;

export async function initApi() {
  const cfg = window.MOVI_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
    const { createSupabaseApi } = await import("./supabase.js");
    api = await createSupabaseApi({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey });
  } else {
    const { createDemoApi } = await import("./demo.js");
    api = await createDemoApi();
  }
  return api;
}
