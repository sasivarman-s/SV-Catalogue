/* ──────────────────────────────────────────────────────────
   SV Catalogue — app.js
   100% standalone: uses localStorage as database
   No server / Python required.
   ────────────────────────────────────────────────────────── */

/* ════════════════════════════════════════════════════════════
   LOCAL DATABASE  (localStorage wrapper)
   ════════════════════════════════════════════════════════════ */
const DB = {
  _key: 'sv_catalogue_books',
  _idKey: 'sv_catalogue_next_id',

  _nextId() {
    const id = parseInt(localStorage.getItem(this._idKey) || '1');
    localStorage.setItem(this._idKey, id + 1);
    return id;
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._key) || '[]');
    } catch { return []; }
  },

  _save(books) {
    localStorage.setItem(this._key, JSON.stringify(books));
  },

  seed() {
    if (this.getAll().length === 0) {
      const defaults = ['DSA', 'Java', 'CSS', 'Html'];
      const books = defaults.map((title, i) => ({
        id: this._nextId(),
        title,
        position: i + 1,
        added_at: new Date().toISOString()
      }));
      this._save(books);
    }
  },

  append(title) {
    const books = this.getAll();
    const pos = books.length + 1;
    books.push({ id: this._nextId(), title, position: pos, added_at: new Date().toISOString() });
    this._save(books);
    return `"${title}" added successfully`;
  },

  insertAt(title, position) {
    const books = this.getAll();
    let pos = parseInt(position);
    if (pos < 1) pos = 1;
    if (pos > books.length + 1) pos = books.length + 1;
    books.forEach(b => { if (b.position >= pos) b.position++; });
    books.push({ id: this._nextId(), title, position: pos, added_at: new Date().toISOString() });
    this._reorder(books);
    this._save(books);
    return `"${title}" inserted at position ${pos}`;
  },

  delete(id) {
    const numId = parseInt(id, 10);
    let books = this.getAll();
    const book = books.find(b => b.id === numId);
    if (!book) throw new Error('Book not found');
    books = books.filter(b => b.id !== numId);
    this._reorder(books);
    this._save(books);
    return `"${book.title}" removed successfully`;
  },

  clearAll() {
    this._save([]);
    return 'All books cleared';
  },

  update(id, title) {
    const numId = parseInt(id, 10);
    const books = this.getAll();
    const book = books.find(b => b.id === numId);
    if (!book) throw new Error('Book not found');
    book.title = title;
    this._save(books);
    return `Book updated to "${title}"`;
  },

  _reorder(books) {
    books.sort((a, b) => a.position - b.position);
    books.forEach((b, i) => b.position = i + 1);
  },

  stats() {
    const books = this.getAll().sort((a, b) => a.position - b.position);
    const sorted = [...books].sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    return { total: books.length, latest: sorted[0]?.title || null };
  }
};

/* ════════════════════════════════════════════════════════════
   DOM REFS
   ════════════════════════════════════════════════════════════ */
const bookGrid     = document.getElementById('bookGrid');
const emptyState   = document.getElementById('emptyState');
const totalCount   = document.getElementById('totalCount');
const latestBook   = document.getElementById('latestBook');

const searchInput  = document.getElementById('searchInput');
const clearSearch  = document.getElementById('clearSearch');

const newBookTitle = document.getElementById('newBookTitle');
const addBookBtn   = document.getElementById('addBookBtn');

const insertTitle  = document.getElementById('insertTitle');
const insertPos    = document.getElementById('insertPos');
const insertBookBtn= document.getElementById('insertBookBtn');

const clearAllBtn  = document.getElementById('clearAllBtn');

const viewGridBtn  = document.getElementById('viewGrid');
const viewListBtn  = document.getElementById('viewList');

const toastEl      = document.getElementById('toast');
const toastMsg     = document.getElementById('toastMsg');

const editModal    = document.getElementById('editModal');
const editTitle    = document.getElementById('editTitle');
const editBookId   = document.getElementById('editBookId');
const closeModal   = document.getElementById('closeModal');
const cancelEdit   = document.getElementById('cancelEdit');
const saveEdit     = document.getElementById('saveEdit');

const confirmModal  = document.getElementById('confirmModal');
const confirmMsg    = document.getElementById('confirmMsg');
const closeConfirmBtn= document.getElementById('closeConfirm');
const cancelConfirmBtn=document.getElementById('cancelConfirm');
const okConfirm     = document.getElementById('okConfirm');

/* ════════════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════════════ */
let allBooks         = [];
let isListView       = false;
let toastTimer       = null;
let pendingConfirmFn = null;

/* ════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  feather.replace();
  DB.seed();
  refresh();

  // init clear-search button
  clearSearch.style.opacity = '0';
  clearSearch.style.pointerEvents = 'none';
});

/* ════════════════════════════════════════════════════════════
   REFRESH (load + render + stats)
   ════════════════════════════════════════════════════════════ */
function refresh() {
  allBooks = DB.getAll().sort((a, b) => a.position - b.position);
  renderBooks(getFilteredBooks());
  updateStats();
}

function updateStats() {
  const s = DB.stats();
  totalCount.textContent = s.total;
  latestBook.textContent = s.latest || '—';
}

/* ════════════════════════════════════════════════════════════
   RENDER BOOKS
   ════════════════════════════════════════════════════════════ */
function renderBooks(books) {
  bookGrid.innerHTML = '';

  if (!books.length) {
    emptyState.classList.remove('hidden');
    bookGrid.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  bookGrid.classList.remove('hidden');

  books.forEach((book, idx) => {
    const card = createCard(book);
    card.style.animationDelay = `${idx * 50}ms`;
    bookGrid.appendChild(card);
  });

  feather.replace();
}

function createCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card' + (isListView ? ' list-view' : '');
  card.dataset.id = book.id;

  const date = new Date(book.added_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  card.innerHTML = `
    <div class="card-pos">${book.position}</div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(book.title)}</div>
      <div class="card-date">Added ${date}</div>
    </div>
    <div class="card-actions">
      <button class="card-btn edit" title="Edit book">
        <i data-feather="edit-2"></i> Edit
      </button>
      <button class="card-btn delete" title="Delete book">
        <i data-feather="trash"></i> Delete
      </button>
    </div>`;

  card.querySelector('.card-btn.edit').addEventListener('click', () => {
    openEditModal(book.id, book.title);
  });
  card.querySelector('.card-btn.delete').addEventListener('click', () => {
    openConfirm(
      `Remove "<strong>${escapeHtml(book.title)}</strong>" from the catalogue?`,
      () => handleDelete(book.id, card)
    );
  });

  return card;
}

/* ════════════════════════════════════════════════════════════
   SEARCH
   ════════════════════════════════════════════════════════════ */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearSearch.style.opacity = q ? '1' : '0';
  clearSearch.style.pointerEvents = q ? 'all' : 'none';
  renderBooks(getFilteredBooks());
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  clearSearch.style.opacity = '0';
  clearSearch.style.pointerEvents = 'none';
  renderBooks(allBooks);
  searchInput.focus();
});

function getFilteredBooks() {
  const q = searchInput.value.trim().toLowerCase();
  return q ? allBooks.filter(b => b.title.toLowerCase().includes(q)) : allBooks;
}

/* ════════════════════════════════════════════════════════════
   ADD BOOK
   ════════════════════════════════════════════════════════════ */
addBookBtn.addEventListener('click', () => {
  const title = newBookTitle.value.trim();
  if (!title) { shake(newBookTitle); return; }
  const msg = DB.append(title);
  showToast(msg);
  newBookTitle.value = '';
  refresh();
});
newBookTitle.addEventListener('keydown', e => { if (e.key === 'Enter') addBookBtn.click(); });

/* ════════════════════════════════════════════════════════════
   INSERT AT POSITION
   ════════════════════════════════════════════════════════════ */
insertBookBtn.addEventListener('click', () => {
  const title = insertTitle.value.trim();
  const pos   = insertPos.value;
  if (!title) { shake(insertTitle); return; }
  if (!pos || parseInt(pos) < 1) { shake(insertPos); return; }
  const msg = DB.insertAt(title, parseInt(pos));
  showToast(msg);
  insertTitle.value = '';
  insertPos.value   = '';
  refresh();
});
insertTitle.addEventListener('keydown', e => { if (e.key === 'Enter') insertPos.focus(); });
insertPos.addEventListener('keydown',   e => { if (e.key === 'Enter') insertBookBtn.click(); });

/* ════════════════════════════════════════════════════════════
   DELETE
   ════════════════════════════════════════════════════════════ */
function handleDelete(id, card) {
  // Capture title for toast before DOM removal
  const numId = parseInt(id, 10);
  const books  = DB.getAll();
  const book   = books.find(b => b.id === numId);
  if (!book) { showToast('Book not found', true); return; }

  // animate out then remove
  card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  card.style.transform  = 'scale(0.8)';
  card.style.opacity    = '0';
  setTimeout(() => {
    const msg = DB.delete(numId);
    showToast(msg);
    refresh();
  }, 280);
}

/* ════════════════════════════════════════════════════════════
   CLEAR ALL
   ════════════════════════════════════════════════════════════ */
clearAllBtn.addEventListener('click', () => {
  openConfirm(
    '⚠️ This will permanently delete <strong>all books</strong> from the catalogue.',
    () => {
      const msg = DB.clearAll();
      showToast(msg);
      refresh();
    }
  );
});

/* ════════════════════════════════════════════════════════════
   EDIT MODAL
   ════════════════════════════════════════════════════════════ */
function openEditModal(id, title) {
  editBookId.value = id;
  editTitle.value  = title;
  editModal.classList.remove('hidden');
  setTimeout(() => editTitle.select(), 80);
}
function closeEditModal() { editModal.classList.add('hidden'); }

closeModal.addEventListener('click', closeEditModal);
cancelEdit.addEventListener('click', closeEditModal);
editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });
editTitle.addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit.click(); });

saveEdit.addEventListener('click', () => {
  const id    = parseInt(editBookId.value);
  const title = editTitle.value.trim();
  if (!title) { shake(editTitle); return; }
  const msg = DB.update(id, title);
  showToast(msg);
  closeEditModal();
  refresh();
});

/* ════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ════════════════════════════════════════════════════════════ */
function openConfirm(message, onOk) {
  confirmMsg.innerHTML = message;
  pendingConfirmFn = onOk;
  confirmModal.classList.remove('hidden');
}
function closeConfirmModal() {
  confirmModal.classList.add('hidden');
  pendingConfirmFn = null;
}

closeConfirmBtn.addEventListener('click', closeConfirmModal);
cancelConfirmBtn.addEventListener('click', closeConfirmModal);
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) closeConfirmModal(); });
okConfirm.addEventListener('click', () => {
  if (pendingConfirmFn) {
    const fn = pendingConfirmFn; // save ref BEFORE closeConfirmModal nulls it
    closeConfirmModal();
    fn();
  }
});

/* ════════════════════════════════════════════════════════════
   VIEW TOGGLE  (Grid / List)
   ════════════════════════════════════════════════════════════ */
viewGridBtn.addEventListener('click', () => {
  isListView = false;
  viewGridBtn.classList.add('active');
  viewListBtn.classList.remove('active');
  renderBooks(getFilteredBooks());
});
viewListBtn.addEventListener('click', () => {
  isListView = true;
  viewListBtn.classList.add('active');
  viewGridBtn.classList.remove('active');
  renderBooks(getFilteredBooks());
});

/* ════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeConfirmModal();
  }
  // Ctrl+F → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

/* ════════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════════ */
function showToast(msg, isError = false) {
  toastMsg.textContent = msg;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function shake(el) {
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
  el.focus();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inject shake keyframe
const s = document.createElement('style');
s.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-7px); }
  40%      { transform: translateX(7px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}`;
document.head.appendChild(s);
