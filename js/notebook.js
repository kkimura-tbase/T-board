// Shared stroke representation for drawing, history, persistence and export.
const Notebook = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));
    function paint(ctx, strokes, width, height) {
        ctx.clearRect(0, 0, width, height);
        for (const stroke of strokes) {
            ctx.beginPath();
            ctx.moveTo(stroke.startX * width, stroke.startY * height);
            ctx.lineTo(stroke.endX * width, stroke.endY * height);
            ctx.lineCap = ctx.lineJoin = 'round';
            ctx.lineWidth = stroke.width * width * (stroke.tool === 'eraser' ? 3 : 1);
            ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = stroke.color;
            ctx.globalAlpha = stroke.tool === 'marker' ? 0.25 : 1;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
    function history(state) {
        return state.histories[state.currentPage] ||= { entries: [clone(state.currentStrokes)], index: 0 };
    }
    function commit(state) {
        const h = history(state);
        h.entries = h.entries.slice(0, h.index + 1);
        h.entries.push(clone(state.currentStrokes));
        if (h.entries.length > 51) h.entries.shift();
        h.index = h.entries.length - 1;
        state.annotations[state.currentPage] = clone(state.currentStrokes);
    }
    function move(state, delta) {
        const h = history(state);
        const next = h.index + delta;
        if (next < 0 || next >= h.entries.length) return false;
        h.index = next;
        state.currentStrokes = clone(h.entries[next]);
        state.annotations[state.currentPage] = clone(state.currentStrokes);
        return true;
    }
    const isPen = event => event.pointerType === 'pen';
    return { clone, paint, history, commit, move, isPen };
})();

// Each transaction stores one complete notebook, including the original PDF.
const NotebookStore = (() => {
    let connection;
    function open() {
        if (!connection) connection = new Promise((resolve, reject) => {
            const request = indexedDB.open('t-board-notebook', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('notebooks');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('別のタブを閉じて再試行してください。'));
        });
        return connection;
    }
    async function transaction(mode, value) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('notebooks', mode);
            const store = tx.objectStore('notebooks');
            const request = mode === 'readonly' ? store.get('current') : store.put(value, 'current');
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = tx.onabort = () => reject(tx.error || new Error('保存に失敗しました。'));
        });
    }
    return { read: () => transaction('readonly'), write: value => transaction('readwrite', value) };
})();
