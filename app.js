let STATE = {
  songs: [],
  setlists: [],
  tab: "library",
  view: "main",
  backTo: "main",
  selectedSongId: null,
  selectedSetlistId: null,
  editingSong: null,
  search: "",
  showSearch: false,
  quickAddOpen: false,
  addingSetlistOpen: false,
  confirm: null,
  importMsg: "",
  storageError: false,
  loaded: false
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emptySong() {
  return { id: null, title: "", artist: "", chordUrl: "", youtubeUrl: "", notes: "", needsRehearsal: false, songIdea: false };
}

/* ---------- data ---------- */

async function loadData() {
  try {
    const res = await fetch("/api/data");
    const d = await res.json();
    STATE.songs = d.songs || [];
    STATE.setlists = d.setlists || [];
  } catch (e) {
    STATE.storageError = true;
  }
  STATE.loaded = true;
  render();
}

async function saveData() {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songs: STATE.songs, setlists: STATE.setlists })
    });
    STATE.storageError = false;
  } catch (e) {
    STATE.storageError = true;
  }
}

function getSong(id) { return STATE.songs.find(s => s.id === id); }
function getSongSetlists(song) { return STATE.setlists.filter(sl => sl.songIds.includes(song.id)); }

/* ---------- navigation ---------- */

function goTab(t) {
  STATE.tab = t; STATE.view = "main"; STATE.showSearch = false; STATE.search = "";
  render();
}

function openDetail(id, from) {
  STATE.selectedSongId = id; STATE.backTo = from; STATE.view = "detail";
  render();
}
function closeDetail() { STATE.view = STATE.backTo; render(); }

function openEdit(song, from) {
  STATE.editingSong = song ? Object.assign({}, song) : Object.assign(emptySong(), { id: null });
  STATE.backTo = from;
  STATE.view = "edit";
  render();
}

/* ---------- mutations ---------- */

function handleSaveSong() {
  const title = document.getElementById("song-title-input").value.trim();
  if (!title) {
    document.getElementById("title-error").classList.remove("hidden");
    return;
  }
  const artist = document.getElementById("song-artist-input").value.trim();
  const chordUrl = document.getElementById("song-chord-input").value.trim();
  const youtubeUrl = document.getElementById("song-youtube-input").value.trim();
  const notes = document.getElementById("song-notes-input").value;
  const s = STATE.editingSong;
  const updated = Object.assign({}, s, { title, artist, chordUrl, youtubeUrl, notes });
  if (updated.id) {
    STATE.songs = STATE.songs.map(x => x.id === updated.id ? updated : x);
  } else {
    updated.id = uid();
    STATE.songs = STATE.songs.concat([updated]);
  }
  STATE.selectedSongId = updated.id;
  saveData();
  STATE.view = STATE.backTo;
  render();
}

function toggleEditFlag(flag) {
  STATE.editingSong[flag] = !STATE.editingSong[flag];
  const btn = document.getElementById("flag-" + flag);
  const checked = STATE.editingSong[flag];
  const color = flag === "needsRehearsal" ? "rose" : "teal";
  btn.className = "w-full flex items-center justify-between px-4 py-3 rounded-xl border " +
    (checked ? "bg-" + color + "-950 border-" + color + "-700" : "bg-zinc-900 border-zinc-700");
  const dot = btn.querySelector(".flag-dot");
  if (checked) {
    dot.className = "flag-dot w-6 h-6 rounded-full border-2 flex items-center justify-center bg-" + color + "-500 border-" + color + "-500";
    dot.innerHTML = '<span class="text-black text-sm font-bold">&#10003;</span>';
  } else {
    dot.className = "flag-dot w-6 h-6 rounded-full border-2 border-zinc-600 flex items-center justify-center";
    dot.innerHTML = "";
  }
}

function toggleEditSetlistMembership(setlistId) {
  if (!STATE.editingSong.id) return;
  toggleSongInSetlist(setlistId, STATE.editingSong.id);
  const btn = document.getElementById("setlist-chip-" + setlistId);
  const sl = STATE.setlists.find(x => x.id === setlistId);
  const checked = sl.songIds.includes(STATE.editingSong.id);
  btn.className = "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left " +
    (checked ? "bg-amber-950 border-amber-700" : "bg-zinc-900 border-zinc-700");
  btn.querySelector(".chip-check").innerHTML = checked ? '<span class="text-amber-400">&#10003;</span>' : "";
}

function deleteSong(id) {
  showConfirm("Delete this song? This can't be undone.", "Delete", true, function () {
    STATE.songs = STATE.songs.filter(s => s.id !== id);
    STATE.setlists = STATE.setlists.map(sl => Object.assign({}, sl, { songIds: sl.songIds.filter(sid => sid !== id) }));
    saveData();
    STATE.confirm = null;
    STATE.view = STATE.backTo;
    render();
  });
}

function quickAddSave() {
  const title = document.getElementById("quick-title-input").value.trim();
  if (!title) return;
  const artist = document.getElementById("quick-artist-input").value.trim();
  const song = Object.assign(emptySong(), { id: uid(), title, artist, songIdea: true });
  STATE.songs = STATE.songs.concat([song]);
  saveData();
  STATE.quickAddOpen = false;
  render();
}

function createSetlist() {
  const name = document.getElementById("new-setlist-input").value.trim();
  if (!name) return;
  const sl = { id: uid(), name: name, songIds: [] };
  STATE.setlists = STATE.setlists.concat([sl]);
  saveData();
  STATE.addingSetlistOpen = false;
  render();
}

function deleteSetlist(id) {
  showConfirm("Delete this setlist? Songs inside it won't be deleted, just removed from this list.", "Delete", true, function () {
    STATE.setlists = STATE.setlists.filter(sl => sl.id !== id);
    saveData();
    STATE.confirm = null;
    STATE.tab = "setlists";
    STATE.view = "main";
    render();
  });
}

function toggleSongInSetlist(setlistId, songId) {
  STATE.setlists = STATE.setlists.map(sl => {
    if (sl.id !== setlistId) return sl;
    const has = sl.songIds.includes(songId);
    return Object.assign({}, sl, { songIds: has ? sl.songIds.filter(id => id !== songId) : sl.songIds.concat([songId]) });
  });
  saveData();
}

function moveSongInSetlist(setlistId, songId, dir) {
  STATE.setlists = STATE.setlists.map(sl => {
    if (sl.id !== setlistId) return sl;
    const idx = sl.songIds.indexOf(songId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sl.songIds.length) return sl;
    const next = sl.songIds.slice();
    const tmp = next[idx]; next[idx] = next[newIdx]; next[newIdx] = tmp;
    return Object.assign({}, sl, { songIds: next });
  });
  saveData();
}

function showConfirm(message, label, danger, onConfirm) {
  STATE.confirm = { message, label, danger, onConfirm };
  render();
}

function handleSearchInput(value) {
  STATE.search = value;
  const wrap = document.getElementById("library-list-wrap");
  if (wrap) wrap.outerHTML = renderLibraryListHtml();
}

function handleExport() {
  const data = JSON.stringify({ songs: STATE.songs, setlists: STATE.setlists }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stagebook-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  showConfirm("Import will replace all songs and setlists currently in StageBook. Continue?", "Import", false, function () {
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const parsed = JSON.parse(ev.target.result);
        STATE.songs = Array.isArray(parsed.songs) ? parsed.songs : [];
        STATE.setlists = Array.isArray(parsed.setlists) ? parsed.setlists : [];
        saveData();
        STATE.importMsg = "Import complete.";
      } catch (err) {
        STATE.importMsg = "That file couldn't be read. Make sure it's a StageBook backup file.";
      }
      STATE.confirm = null;
      render();
    };
    reader.readAsText(file);
  });
  input.value = "";
}

/* ---------- rendering ---------- */

function render() {
  const app = document.getElementById("app");
  if (!STATE.loaded) {
    app.innerHTML = '<div class="h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-400">Loading your songbook&hellip;</div>';
    return;
  }
  app.innerHTML =
    '<div class="h-screen w-full flex flex-col bg-zinc-950 text-zinc-100">' +
      renderHeader() +
      '<div class="flex-1 overflow-y-auto">' + renderBody() + "</div>" +
      (STATE.view === "main" ? renderBottomNav() : "") +
      (STATE.confirm ? renderConfirm() : "") +
    "</div>";
}

function titleForTab(t) {
  if (t === "library") return "STAGEBOOK";
  if (t === "ideas") return "SONG IDEAS";
  if (t === "rehearse") return "NEEDS REHEARSAL";
  if (t === "setlists") return "SETLISTS";
  return "STAGEBOOK";
}

function renderHeader() {
  if (STATE.view === "main") {
    let dots = "";
    for (let i = 0; i < 8; i++) dots += '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>';
    return (
      '<div class="sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800">' +
        '<div class="flex items-center justify-between px-4 pt-4 pb-2">' +
          '<h1 class="text-xl font-black tracking-widest text-zinc-100">' + titleForTab(STATE.tab) + "</h1>" +
          '<div class="flex items-center gap-1">' +
            (STATE.tab === "library"
              ? '<button data-action="toggle-search" class="p-2 rounded-full active:bg-zinc-800 text-xl" aria-label="Search">&#128269;</button>'
              : "") +
            '<button data-action="open-data" class="p-2 rounded-full active:bg-zinc-800 text-xl" aria-label="Backup and restore">&#128190;</button>' +
          "</div>" +
        "</div>" +
        '<div class="flex gap-1 px-4 pb-3">' + dots + "</div>" +
        (STATE.tab === "library" && STATE.showSearch
          ? '<div class="px-4 pb-3"><input id="search-input" value="' + esc(STATE.search) + '" oninput="handleSearchInput(this.value)" placeholder="Search title or artist" autofocus class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>'
          : "") +
      "</div>"
    );
  }

  let title = "";
  let right = "";
  if (STATE.view === "detail") { const sg = getSong(STATE.selectedSongId); title = sg ? sg.title : "Song"; }
  if (STATE.view === "edit") title = STATE.editingSong && STATE.editingSong.id ? "Edit Song" : "Add Song";
  if (STATE.view === "setlistDetail") { const sl = STATE.setlists.find(x => x.id === STATE.selectedSetlistId); title = sl ? sl.name : "Setlist"; }
  if (STATE.view === "setlistPicker") title = "Add Songs";
  if (STATE.view === "data") title = "Backup & Restore";

  if (STATE.view === "edit") {
    right = '<button data-action="save-song" class="p-2 rounded-full active:bg-zinc-800 text-amber-400 text-2xl" aria-label="Save">&#10003;</button>';
  }

  return (
    '<div class="sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800">' +
      '<div class="flex items-center justify-between px-2 py-3">' +
        '<button data-action="back" class="p-2 rounded-full active:bg-zinc-800 text-xl" aria-label="Back">&#8592;</button>' +
        '<h1 class="text-base font-bold tracking-wide text-zinc-100 truncate max-w-[60%] text-center">' + esc(title) + "</h1>" +
        '<div class="w-10 flex justify-end">' + right + "</div>" +
      "</div>" +
    "</div>"
  );
}

function renderBottomNav() {
  const tabs = [
    { key: "library", label: "Library", icon: "&#127925;" },
    { key: "ideas", label: "Ideas", icon: "&#128161;" },
    { key: "rehearse", label: "Rehearse", icon: "&#128260;" },
    { key: "setlists", label: "Setlists", icon: "&#128203;" }
  ];
  let html = '<div class="sticky bottom-0 z-20 bg-zinc-950 border-t border-zinc-800 flex">';
  tabs.forEach(t => {
    const active = STATE.tab === t.key;
    html += '<button data-action="goto-tab" data-tab="' + t.key + '" class="flex-1 flex flex-col items-center gap-1 py-3">' +
      '<span class="text-xl ' + (active ? "opacity-100" : "opacity-50") + '">' + t.icon + "</span>" +
      '<span class="text-xs font-semibold ' + (active ? "text-amber-400" : "text-zinc-500") + '">' + t.label + "</span>" +
      '<span class="w-1 h-1 rounded-full ' + (active ? "bg-amber-400" : "bg-transparent") + '"></span>' +
    "</button>";
  });
  html += "</div>";
  return html;
}

function renderConfirm() {
  const c = STATE.confirm;
  return (
    '<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color:rgba(0,0,0,0.65)">' +
      '<div class="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-5 pb-8">' +
        '<p class="text-zinc-100 text-base mb-5">' + esc(c.message) + "</p>" +
        '<div class="flex gap-3">' +
          '<button data-action="confirm-cancel" class="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-200 font-semibold active:bg-zinc-700">Cancel</button>' +
          '<button data-action="confirm-yes" class="flex-1 py-3 rounded-xl font-semibold ' +
            (c.danger ? "bg-rose-600 text-white active:bg-rose-700" : "bg-amber-400 text-black active:bg-amber-500") +
            '">' + esc(c.label) + "</button>" +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

function renderEmptyState(text) {
  return '<div class="flex flex-col items-center justify-center text-center px-8 py-20"><p class="text-zinc-500 text-base leading-relaxed">' + esc(text) + "</p></div>";
}

function renderBody() {
  if (STATE.view === "main") {
    if (STATE.tab === "library") return renderLibrary();
    if (STATE.tab === "ideas") return renderIdeas();
    if (STATE.tab === "rehearse") return renderRehearse();
    if (STATE.tab === "setlists") return renderSetlists();
  }
  if (STATE.view === "detail") return renderDetail();
  if (STATE.view === "edit") return renderEdit();
  if (STATE.view === "setlistDetail") return renderSetlistDetail();
  if (STATE.view === "setlistPicker") return renderSetlistPicker();
  if (STATE.view === "data") return renderData();
  return "";
}

function getFilteredLibrary() {
  const q = STATE.search.trim().toLowerCase();
  return STATE.songs
    .filter(s => !q || s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function renderLibraryListHtml() {
  const list = getFilteredLibrary();
  let inner;
  if (list.length === 0) {
    inner = renderEmptyState(STATE.songs.length === 0 ? "Your songbook is empty. Add your first song to get started." : "No songs match your search.");
  } else {
    inner = '<ul class="divide-y divide-zinc-800">' + list.map(song =>
      '<li><button data-action="open-detail" data-id="' + song.id + '" data-from="main" class="w-full flex items-center justify-between px-4 py-4 text-left active:bg-zinc-900">' +
        '<div class="min-w-0">' +
          '<p class="text-lg font-bold text-zinc-100 truncate">' + esc(song.title) + "</p>" +
          (song.artist ? '<p class="text-sm text-zinc-400 truncate">' + esc(song.artist) + "</p>" : "") +
        "</div>" +
        '<div class="flex items-center gap-2 shrink-0 ml-3">' +
          (song.needsRehearsal ? '<span class="w-2 h-2 rounded-full bg-rose-500"></span>' : "") +
          (song.songIdea ? '<span class="w-2 h-2 rounded-full bg-teal-400"></span>' : "") +
          '<span class="text-zinc-600">&rsaquo;</span>' +
        "</div>" +
      "</button></li>"
    ).join("") + "</ul>";
  }
  return '<div id="library-list-wrap">' + inner + "</div>";
}

function renderLibrary() {
  return (
    '<div class="pb-24 relative min-h-full">' +
      renderLibraryListHtml() +
      '<button data-action="open-edit" data-from="main" class="fixed right-5 bottom-24 w-16 h-16 rounded-full bg-amber-400 active:bg-amber-500 flex items-center justify-center shadow-lg text-3xl text-black" aria-label="Add song">+</button>' +
    "</div>"
  );
}

function renderIdeas() {
  const list = STATE.songs.filter(s => s.songIdea).sort((a, b) => a.title.localeCompare(b.title));
  const inner = list.length === 0
    ? renderEmptyState("No song ideas yet. Jot one down before you forget it.")
    : '<ul class="divide-y divide-zinc-800">' + list.map(song =>
        '<li><button data-action="open-detail" data-id="' + song.id + '" data-from="main" class="w-full flex items-center justify-between px-4 py-4 text-left active:bg-zinc-900">' +
          '<div class="min-w-0"><p class="text-lg font-bold text-zinc-100 truncate">' + esc(song.title) + "</p>" +
          (song.artist ? '<p class="text-sm text-zinc-400 truncate">' + esc(song.artist) + "</p>" : "") + "</div>" +
          '<span class="text-zinc-600 shrink-0 ml-3">&rsaquo;</span>' +
        "</button></li>"
      ).join("") + "</ul>";

  const quickAddModal = STATE.quickAddOpen ? (
    '<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color:rgba(0,0,0,0.65)">' +
      '<div class="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-5 pb-8">' +
        '<p class="text-sm font-bold uppercase tracking-wide text-teal-400 mb-3">New song idea</p>' +
        '<input id="quick-title-input" placeholder="Song title" autofocus class="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 mb-3 focus:outline-none focus:ring-2 focus:ring-teal-400" />' +
        '<input id="quick-artist-input" placeholder="Artist (optional)" class="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 mb-5 focus:outline-none focus:ring-2 focus:ring-teal-400" />' +
        '<div class="flex gap-3">' +
          '<button data-action="quick-add-cancel" class="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-200 font-semibold active:bg-zinc-700">Cancel</button>' +
          '<button data-action="quick-add-save" class="flex-1 py-3 rounded-xl bg-teal-400 text-black font-semibold active:bg-teal-500">Save Idea</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  ) : "";

  return (
    '<div class="pb-24 relative min-h-full">' + inner +
      '<button data-action="quick-add-open" class="fixed right-5 bottom-24 w-16 h-16 rounded-full bg-teal-400 active:bg-teal-500 flex items-center justify-center shadow-lg text-3xl text-black" aria-label="Add song idea">+</button>' +
      quickAddModal +
    "</div>"
  );
}

function renderRehearse() {
  const list = STATE.songs.filter(s => s.needsRehearsal).sort((a, b) => a.title.localeCompare(b.title));
  const inner = list.length === 0
    ? renderEmptyState("Nothing flagged. You're all caught up.")
    : '<ul class="divide-y divide-zinc-800">' + list.map(song =>
        '<li><button data-action="open-detail" data-id="' + song.id + '" data-from="main" class="w-full flex items-center justify-between px-4 py-4 text-left active:bg-zinc-900">' +
          '<div class="min-w-0"><p class="text-lg font-bold text-zinc-100 truncate">' + esc(song.title) + "</p>" +
          (song.artist ? '<p class="text-sm text-zinc-400 truncate">' + esc(song.artist) + "</p>" : "") + "</div>" +
          '<span class="text-zinc-600 shrink-0 ml-3">&rsaquo;</span>' +
        "</button></li>"
      ).join("") + "</ul>";
  return '<div class="pb-24 min-h-full">' + inner + "</div>";
}

function renderSetlists() {
  const inner = STATE.setlists.length === 0
    ? renderEmptyState("No setlists yet. Build your first one.")
    : '<ul class="divide-y divide-zinc-800">' + STATE.setlists.map(sl =>
        '<li><button data-action="open-setlist" data-id="' + sl.id + '" class="w-full flex items-center justify-between px-4 py-4 text-left active:bg-zinc-900">' +
          '<div class="min-w-0"><p class="text-lg font-bold text-zinc-100 truncate">' + esc(sl.name) + "</p>" +
          '<p class="text-sm text-zinc-400">' + sl.songIds.length + " song" + (sl.songIds.length === 1 ? "" : "s") + "</p></div>" +
          '<span class="text-zinc-600 shrink-0 ml-3">&rsaquo;</span>' +
        "</button></li>"
      ).join("") + "</ul>";

  const modal = STATE.addingSetlistOpen ? (
    '<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color:rgba(0,0,0,0.65)">' +
      '<div class="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-5 pb-8">' +
        '<p class="text-sm font-bold uppercase tracking-wide text-amber-400 mb-3">New setlist</p>' +
        '<input id="new-setlist-input" placeholder="e.g. Main Set, Senior Living, Christmas" autofocus class="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 mb-5 focus:outline-none focus:ring-2 focus:ring-amber-400" />' +
        '<div class="flex gap-3">' +
          '<button data-action="new-setlist-cancel" class="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-200 font-semibold active:bg-zinc-700">Cancel</button>' +
          '<button data-action="new-setlist-save" class="flex-1 py-3 rounded-xl bg-amber-400 text-black font-semibold active:bg-amber-500">Create</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  ) : "";

  return (
    '<div class="pb-24 relative min-h-full">' + inner +
      '<button data-action="new-setlist-open" class="fixed right-5 bottom-24 w-16 h-16 rounded-full bg-amber-400 active:bg-amber-500 flex items-center justify-center shadow-lg text-3xl text-black" aria-label="New setlist">+</button>' +
      modal +
    "</div>"
  );
}

function renderDetail() {
  const song = getSong(STATE.selectedSongId);
  if (!song) return renderEmptyState("This song was deleted.");
  const songSetlists = getSongSetlists(song);
  let html = '<div class="px-5 py-6 pb-10">';
  html += '<h2 class="text-2xl font-black tracking-wide text-zinc-100 mb-1">' + esc(song.title) + "</h2>";
  html += song.artist
    ? '<p class="text-base text-zinc-400 mb-4">' + esc(song.artist) + "</p>"
    : '<p class="text-base text-zinc-600 mb-4">No artist listed</p>';

  if (songSetlists.length > 0) {
    html += '<div class="flex flex-wrap gap-2 mb-5">' + songSetlists.map(sl =>
      '<span class="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300">' + esc(sl.name) + "</span>"
    ).join("") + "</div>";
  }

  if (song.needsRehearsal || song.songIdea) {
    html += '<div class="flex gap-2 mb-6">';
    if (song.needsRehearsal) html += '<span class="px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-xs font-semibold text-rose-400">Needs rehearsal</span>';
    if (song.songIdea) html += '<span class="px-3 py-1 rounded-full bg-teal-950 border border-teal-800 text-xs font-semibold text-teal-400">Song idea</span>';
    html += "</div>";
  }

  if (song.notes) {
    html += '<div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">' +
      '<p class="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Notes</p>' +
      '<p class="text-base text-zinc-200 whitespace-pre-wrap">' + esc(song.notes) + "</p></div>";
  }

  html += '<div class="flex flex-col gap-3 mt-4">';
  html += '<button data-action="open-chords" data-id="' + song.id + '" ' + (!song.chordUrl ? "disabled" : "") +
    ' class="w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 ' +
    (song.chordUrl ? "bg-amber-400 text-black active:bg-amber-500" : "bg-zinc-800 text-zinc-500 opacity-50") + '">' +
    "<span>&#127928;</span> Open Chords</button>";
  html += '<button data-action="open-youtube" data-id="' + song.id + '" ' + (!song.youtubeUrl ? "disabled" : "") +
    ' class="w-full py-4 rounded-xl border text-lg font-bold flex items-center justify-center gap-2 ' +
    (song.youtubeUrl ? "bg-zinc-800 border-zinc-700 text-zinc-100 active:bg-zinc-700" : "bg-zinc-900 border-zinc-800 text-zinc-600 opacity-50") + '">' +
    "<span>&#9654;&#65039;</span> Open YouTube</button>";
  html += '<button data-action="open-edit" data-id="' + song.id + '" data-from="detail" class="w-full py-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-lg font-bold active:bg-zinc-700 flex items-center justify-center gap-2"><span>&#9999;&#65039;</span> Edit Song</button>';
  html += '<button data-action="delete-song" data-id="' + song.id + '" class="w-full py-4 rounded-xl bg-zinc-900 border border-rose-900 text-rose-400 text-lg font-bold active:bg-zinc-800 flex items-center justify-center gap-2"><span>&#128465;&#65039;</span> Delete Song</button>';
  html += "</div></div>";
  return html;
}

function field(label, id, value, placeholder) {
  return '<label class="block mb-4"><span class="text-xs font-bold uppercase tracking-wide text-zinc-500">' + label + "</span>" +
    '<input id="' + id + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" class="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400" /></label>';
}

function flagButton(flag, label, checked, color) {
  return '<button type="button" id="flag-' + flag + '" data-action="toggle-flag" data-flag="' + flag + '" class="w-full flex items-center justify-between px-4 py-3 rounded-xl border ' +
    (checked ? "bg-" + color + "-950 border-" + color + "-700" : "bg-zinc-900 border-zinc-700") + '">' +
    '<span class="text-base text-zinc-100">' + label + "</span>" +
    '<span class="flag-dot w-6 h-6 rounded-full border-2 flex items-center justify-center ' +
      (checked ? "bg-" + color + "-500 border-" + color + "-500" : "border-zinc-600") + '">' +
      (checked ? '<span class="text-black text-sm font-bold">&#10003;</span>' : "") +
    "</span></button>";
}

function renderEdit() {
  const s = STATE.editingSong;
  if (!s) return "";
  let html = '<div class="px-5 py-5 pb-16">';

  html += field("Song Title *", "song-title-input", s.title, "Song title");
  html += field("Artist", "song-artist-input", s.artist, "Artist");
  html += field("Chord URL", "song-chord-input", s.chordUrl, "https://...");
  html += field("YouTube URL", "song-youtube-input", s.youtubeUrl, "https://...");

  html += '<label class="block mb-5"><span class="text-xs font-bold uppercase tracking-wide text-zinc-500">Notes</span>' +
    '<textarea id="song-notes-input" rows="4" placeholder="Key changes, tempo, reminders..." class="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400">' + esc(s.notes) + "</textarea></label>";

  html += '<div class="mb-5"><span class="text-xs font-bold uppercase tracking-wide text-zinc-500 block mb-2">Setlists</span>';
  if (STATE.setlists.length === 0) {
    html += '<p class="text-sm text-zinc-500">No setlists yet. Create one from the Setlists tab.</p>';
  } else {
    html += '<div class="flex flex-col gap-2">';
    STATE.setlists.forEach(sl => {
      const checked = s.id ? sl.songIds.includes(s.id) : false;
      html += '<button type="button" id="setlist-chip-' + sl.id + '" ' + (!s.id ? "disabled" : "") +
        ' data-action="toggle-edit-setlist" data-id="' + sl.id + '"' +
        ' class="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left ' +
        (checked ? "bg-amber-950 border-amber-700" : "bg-zinc-900 border-zinc-700") + (!s.id ? " opacity-40" : "") + '">' +
        '<span class="text-base text-zinc-100">' + esc(sl.name) + "</span>" +
        '<span class="chip-check">' + (checked ? '<span class="text-amber-400">&#10003;</span>' : "") + "</span>" +
      "</button>";
    });
    html += "</div>";
  }
  if (!s.id && STATE.setlists.length > 0) {
    html += '<p class="text-xs text-zinc-500 mt-2">Save this song first, then add it to setlists.</p>';
  }
  html += "</div>";

  html += '<div class="flex flex-col gap-3 mb-6">';
  html += flagButton("needsRehearsal", "Needs rehearsal", s.needsRehearsal, "rose");
  html += flagButton("songIdea", "Song idea", s.songIdea, "teal");
  html += "</div>";

  html += '<p id="title-error" class="text-sm text-rose-400 mb-3 hidden">Song title is required before you can save.</p>';
  html += '<button data-action="save-song" class="w-full py-4 rounded-xl bg-amber-400 text-black text-lg font-bold active:bg-amber-500">Save Song</button>';

  html += "</div>";
  return html;
}

function renderSetlistDetail() {
  const sl = STATE.setlists.find(x => x.id === STATE.selectedSetlistId);
  if (!sl) return renderEmptyState("This setlist was deleted.");
  const orderedSongs = sl.songIds.map(id => getSong(id)).filter(Boolean);
  let html = '<div class="pb-28">';
  html += '<div class="px-5 pt-5 pb-2 flex items-center justify-between">' +
    '<p class="text-sm text-zinc-500">' + orderedSongs.length + " song" + (orderedSongs.length === 1 ? "" : "s") + "</p>" +
    '<button data-action="delete-setlist" data-id="' + sl.id + '" class="text-sm font-semibold text-rose-400 active:opacity-70">Delete setlist</button>' +
  "</div>";

  if (orderedSongs.length === 0) {
    html += renderEmptyState("No songs in this setlist yet.");
  } else {
    html += '<ul class="divide-y divide-zinc-800 mt-2">';
    orderedSongs.forEach((song, idx) => {
      html += '<li class="flex items-center px-4 py-3 gap-3">' +
        '<div class="flex flex-col gap-1">' +
          '<button data-action="move-song" data-setlist="' + sl.id + '" data-song="' + song.id + '" data-dir="-1" ' + (idx === 0 ? "disabled" : "") + ' class="p-1 rounded active:bg-zinc-800 text-zinc-400 ' + (idx === 0 ? "opacity-20" : "") + '">&#9650;</button>' +
          '<button data-action="move-song" data-setlist="' + sl.id + '" data-song="' + song.id + '" data-dir="1" ' + (idx === orderedSongs.length - 1 ? "disabled" : "") + ' class="p-1 rounded active:bg-zinc-800 text-zinc-400 ' + (idx === orderedSongs.length - 1 ? "opacity-20" : "") + '">&#9660;</button>' +
        "</div>" +
        '<button data-action="open-detail" data-id="' + song.id + '" data-from="setlistDetail" class="flex-1 min-w-0 text-left">' +
          '<p class="text-base font-bold text-zinc-100 truncate">' + (idx + 1) + ". " + esc(song.title) + "</p>" +
          (song.artist ? '<p class="text-sm text-zinc-400 truncate">' + esc(song.artist) + "</p>" : "") +
        "</button>" +
        '<button data-action="remove-from-setlist" data-setlist="' + sl.id + '" data-song="' + song.id + '" class="p-2 rounded-full active:bg-zinc-800 text-zinc-500">&#10005;</button>' +
      "</li>";
    });
    html += "</ul>";
  }

  html += '<div class="px-5 mt-5"><button data-action="open-picker" class="w-full py-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-base font-bold active:bg-zinc-700">+ Add Songs</button></div>';
  html += "</div>";
  return html;
}

function renderSetlistPicker() {
  const sl = STATE.setlists.find(x => x.id === STATE.selectedSetlistId);
  if (!sl) return "";
  const notIn = STATE.songs.filter(s => !sl.songIds.includes(s.id)).sort((a, b) => a.title.localeCompare(b.title));
  let html = '<div class="pb-10">';
  if (notIn.length === 0) {
    html += renderEmptyState("Every song is already in this setlist.");
  } else {
    html += '<ul class="divide-y divide-zinc-800">' + notIn.map(song =>
      '<li><button data-action="picker-add" data-setlist="' + sl.id + '" data-song="' + song.id + '" class="w-full flex items-center justify-between px-4 py-4 text-left active:bg-zinc-900">' +
        '<div class="min-w-0"><p class="text-base font-bold text-zinc-100 truncate">' + esc(song.title) + "</p>" +
        (song.artist ? '<p class="text-sm text-zinc-400 truncate">' + esc(song.artist) + "</p>" : "") + "</div>" +
        '<span class="text-amber-400 shrink-0 ml-3 text-xl">+</span>' +
      "</button></li>"
    ).join("") + "</ul>";
  }
  html += '<div class="px-5 mt-5"><button data-action="picker-done" class="w-full py-4 rounded-xl bg-amber-400 text-black text-base font-bold active:bg-amber-500">Done</button></div>';
  html += "</div>";
  return html;
}

function renderData() {
  let html = '<div class="px-5 py-6">';
  html += '<p class="text-sm text-zinc-400 mb-6 leading-relaxed">StageBook saves everything to the cloud automatically, so it stays in sync across your phone and any other device. Export a backup any time, or import one to restore your songs and setlists.</p>';
  html += '<button data-action="export" class="w-full py-4 rounded-xl bg-amber-400 text-black text-base font-bold active:bg-amber-500 flex items-center justify-center gap-2 mb-3"><span>&#11015;&#65039;</span> Export Backup</button>';
  html += '<button data-action="import-click" class="w-full py-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-base font-bold active:bg-zinc-700 flex items-center justify-center gap-2"><span>&#11014;&#65039;</span> Import Backup</button>';
  html += '<input id="import-file-input" type="file" accept="application/json" class="hidden" onchange="handleImportFile(this)" />';
  if (STATE.importMsg) html += '<p class="text-sm text-zinc-400 mt-4">' + esc(STATE.importMsg) + "</p>";
  if (STATE.storageError) html += '<p class="text-sm text-rose-400 mt-4">There was a problem reaching the server. Changes may not have saved &mdash; check your connection and try again.</p>';
  html += '<div class="mt-8 pt-6 border-t border-zinc-800"><p class="text-xs text-zinc-600">' + STATE.songs.length + " songs &middot; " + STATE.setlists.length + " setlists</p></div>";
  html += "</div>";
  return html;
}

/* ---------- events ---------- */

function handleClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");

  if (action === "goto-tab") { goTab(btn.getAttribute("data-tab")); return; }
  if (action === "toggle-search") { STATE.showSearch = !STATE.showSearch; render(); return; }
  if (action === "open-data") { STATE.backTo = "main"; STATE.view = "data"; render(); return; }
  if (action === "back") {
    if (STATE.view === "detail") closeDetail();
    else if (STATE.view === "setlistPicker") { STATE.view = "setlistDetail"; render(); }
    else { STATE.view = STATE.backTo; render(); }
    return;
  }
  if (action === "open-detail") { openDetail(btn.getAttribute("data-id"), btn.getAttribute("data-from")); return; }
  if (action === "open-edit") {
    const id = btn.getAttribute("data-id");
    const from = btn.getAttribute("data-from");
    openEdit(id ? getSong(id) : null, from);
    return;
  }
  if (action === "save-song") { handleSaveSong(); return; }
  if (action === "delete-song") { deleteSong(btn.getAttribute("data-id")); return; }
  if (action === "open-chords") { const s = getSong(btn.getAttribute("data-id")); if (s && s.chordUrl) window.open(s.chordUrl, "_blank"); return; }
  if (action === "open-youtube") { const s = getSong(btn.getAttribute("data-id")); if (s && s.youtubeUrl) window.open(s.youtubeUrl, "_blank"); return; }
  if (action === "toggle-flag") { toggleEditFlag(btn.getAttribute("data-flag")); return; }
  if (action === "toggle-edit-setlist") { toggleEditSetlistMembership(btn.getAttribute("data-id")); return; }
  if (action === "quick-add-open") { STATE.quickAddOpen = true; render(); return; }
  if (action === "quick-add-cancel") { STATE.quickAddOpen = false; render(); return; }
  if (action === "quick-add-save") { quickAddSave(); return; }
  if (action === "new-setlist-open") { STATE.addingSetlistOpen = true; render(); return; }
  if (action === "new-setlist-cancel") { STATE.addingSetlistOpen = false; render(); return; }
  if (action === "new-setlist-save") { createSetlist(); return; }
  if (action === "open-setlist") { STATE.selectedSetlistId = btn.getAttribute("data-id"); STATE.backTo = "main"; STATE.view = "setlistDetail"; render(); return; }
  if (action === "delete-setlist") { deleteSetlist(btn.getAttribute("data-id")); return; }
  if (action === "move-song") { moveSongInSetlist(btn.getAttribute("data-setlist"), btn.getAttribute("data-song"), parseInt(btn.getAttribute("data-dir"), 10)); render(); return; }
  if (action === "remove-from-setlist") { toggleSongInSetlist(btn.getAttribute("data-setlist"), btn.getAttribute("data-song")); render(); return; }
  if (action === "open-picker") { STATE.view = "setlistPicker"; render(); return; }
  if (action === "picker-add") { toggleSongInSetlist(btn.getAttribute("data-setlist"), btn.getAttribute("data-song")); render(); return; }
  if (action === "picker-done") { STATE.view = "setlistDetail"; render(); return; }
  if (action === "export") { handleExport(); return; }
  if (action === "import-click") { document.getElementById("import-file-input").click(); return; }
  if (action === "confirm-cancel") { STATE.confirm = null; render(); return; }
  if (action === "confirm-yes") { STATE.confirm.onConfirm(); return; }
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("app").addEventListener("click", handleClick);
  loadData();
});
