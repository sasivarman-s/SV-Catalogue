from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os

app = Flask(__name__, static_folder='.')

DB_PATH = os.path.join(os.path.dirname(__file__), 'catalogue.db')

# ─── Database Setup ────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                title    TEXT    NOT NULL,
                position INTEGER NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Seed default books if table is empty
        cur = conn.execute('SELECT COUNT(*) FROM books')
        if cur.fetchone()[0] == 0:
            defaults = ['DSA', 'Java', 'CSS', 'Html']
            for i, title in enumerate(defaults, start=1):
                conn.execute(
                    'INSERT INTO books (title, position) VALUES (?, ?)', (title, i)
                )
        conn.commit()

def reorder(conn):
    """Reindex position column to keep it contiguous (1-based)."""
    rows = conn.execute('SELECT id FROM books ORDER BY position, id').fetchall()
    for idx, row in enumerate(rows, start=1):
        conn.execute('UPDATE books SET position=? WHERE id=?', (idx, row['id']))
    conn.commit()

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# GET  /api/books            → list all
# POST /api/books            → append
# POST /api/books/insert     → insert at position
# DELETE /api/books/<id>     → delete by id
# DELETE /api/books          → clear all
# PUT  /api/books/<id>       → rename

@app.route('/api/books', methods=['GET'])
def get_books():
    with get_db() as conn:
        rows = conn.execute(
            'SELECT id, title, position, added_at FROM books ORDER BY position'
        ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.get_json(force=True)
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    with get_db() as conn:
        cur = conn.execute('SELECT COALESCE(MAX(position),0)+1 FROM books')
        next_pos = cur.fetchone()[0]
        conn.execute('INSERT INTO books (title, position) VALUES (?, ?)', (title, next_pos))
        conn.commit()
    return jsonify({'message': f'"{title}" added successfully'}), 201

@app.route('/api/books/insert', methods=['POST'])
def insert_book():
    data = request.get_json(force=True)
    title = (data.get('title') or '').strip()
    position = data.get('position')
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if position is None:
        return jsonify({'error': 'Position is required'}), 400
    position = int(position)
    with get_db() as conn:
        count = conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
        if position < 1:
            position = 1
        if position > count + 1:
            position = count + 1
        # Shift existing books
        conn.execute(
            'UPDATE books SET position = position + 1 WHERE position >= ?', (position,)
        )
        conn.execute('INSERT INTO books (title, position) VALUES (?, ?)', (title, position))
        reorder(conn)
    return jsonify({'message': f'"{title}" inserted at position {position}'}), 201

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    with get_db() as conn:
        row = conn.execute('SELECT title FROM books WHERE id=?', (book_id,)).fetchone()
        if not row:
            return jsonify({'error': 'Book not found'}), 404
        title = row['title']
        conn.execute('DELETE FROM books WHERE id=?', (book_id,))
        reorder(conn)
    return jsonify({'message': f'"{title}" removed successfully'})

@app.route('/api/books', methods=['DELETE'])
def clear_books():
    with get_db() as conn:
        conn.execute('DELETE FROM books')
        conn.commit()
    return jsonify({'message': 'All books cleared'})

@app.route('/api/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    data = request.get_json(force=True)
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    with get_db() as conn:
        row = conn.execute('SELECT id FROM books WHERE id=?', (book_id,)).fetchone()
        if not row:
            return jsonify({'error': 'Book not found'}), 404
        conn.execute('UPDATE books SET title=? WHERE id=?', (title, book_id))
        conn.commit()
    return jsonify({'message': f'Book updated to "{title}"'})

# ─── Stats endpoint ────────────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
def stats():
    with get_db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
        latest = conn.execute(
            'SELECT title FROM books ORDER BY added_at DESC LIMIT 1'
        ).fetchone()
    return jsonify({
        'total': total,
        'latest': latest['title'] if latest else None
    })

if __name__ == '__main__':
    init_db()
    print("✅  SV Catalogue API running → http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
