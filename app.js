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
  return { id: null, title: "", artist: "", chordUrl: "", chordChart: "", youtubeUrl: "", notes: "", needsRehearsal: false, songIdea: false };
}

function hasChords(song) {
  return !!(song.chordUrl || (song.chordChart && song.chordChart.trim()));
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

function openChords(id, from) {
  STATE.selectedSongId = id;
  STATE.backTo = from;
  STATE.view = "chords";
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
  const chordChart = document.getElementById("song-chordchart-input").value;
  const youtubeUrl = document.getElementById("song-youtube-input").value.trim();
  const notes = document.getElementById("song-notes-input").value;
  const s = STATE.editingSong;
  const updated = Object.assign({}, s, { title, artist, chordUrl, chordChart, youtubeUrl, notes });
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
  if (STATE.view === "chords") { const sg = getSong(STATE.selectedSongId); title = sg ? sg.title : "Chords"; }
  if (STATE.view === "setlistDetail") { const sl = STATE.setlists.find(x => x.id === STATE.selectedSetlistId); title = sl ? sl.name : "Setlist"; }
  if (STATE.view === "setlistPicker") title = "Add Songs";
  if (STATE.view === "data") title = "Backup & Restore";

  if (STATE.view === "edit") {
    right = '<button data-action="save-song" class="p-2 rounded-full active:bg-zinc-800 text-amber-400 text-2xl" aria-label="Save">&#10003;</button>';
  }
  if (STATE.view === "chords") {
    const sg = getSong(STATE.selectedSongId);
    if (sg) right = '<button data-action="open-edit" data-id="' + sg.id + '" data-from="chords" class="p-2 rounded-full active:bg-zinc-800 text-amber-400 text-xl" aria-label="Edit chart">&#9999;&#65039;</button>';
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
  if (STATE.view === "chords") return renderChords();
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
          '<div class="min-w-0">
