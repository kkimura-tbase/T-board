const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Notebook = vm.runInNewContext(fs.readFileSync(require.resolve('../js/notebook.js'), 'utf8') + '\nNotebook');
const stroke = { startX: .1, startY: .1, endX: .2, endY: .2, width: .003, color: '#000', tool: 'pen' };
const state = () => ({ currentPage: 1, currentStrokes: [], annotations: {}, histories: {} });
test('undo/redo and clear update export data, including empty pages', () => {
    const s = state(); Notebook.history(s);
    s.currentStrokes.push(stroke); Notebook.commit(s);
    Notebook.move(s, -1); assert.equal(s.annotations[1].length, 0);
    Notebook.move(s, 1); assert.equal(s.annotations[1].length, 1);
    s.currentStrokes = []; Notebook.commit(s); assert.equal(s.annotations[1].length, 0);
    Notebook.move(s, -1); assert.equal(s.annotations[1].length, 1);
});
test('page histories are isolated and branching discards redo', () => {
    const s = state(); Notebook.history(s);
    s.currentStrokes.push(stroke); Notebook.commit(s);
    s.currentPage = 2; s.currentStrokes = []; Notebook.history(s);
    assert.equal(Notebook.move(s, -1), false);
    s.currentPage = 1; s.currentStrokes = s.annotations[1];
    Notebook.move(s, -1); s.currentStrokes.push({ ...stroke, color: '#f00' }); Notebook.commit(s);
    assert.equal(Notebook.move(s, 1), false);
    assert.equal(s.annotations[1][0].color, '#f00');
});
test('pressure alone never identifies a pen', () => {
    assert.equal(Notebook.isPen({ pointerType: 'touch', pressure: .8 }), false);
    assert.equal(Notebook.isPen({ pointerType: 'mouse', pressure: .5 }), false);
    assert.equal(Notebook.isPen({ pointerType: 'pen', pressure: 0 }), true);
});
test('rendering scales line width with coordinates and resets eraser state', () => {
    const widths = [], ctx = { clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){ widths.push(this.lineWidth); } };
    Notebook.paint(ctx, [stroke, { ...stroke, tool: 'eraser' }], 2000, 1000);
    assert.deepEqual(widths, [6, 18]); assert.equal(ctx.globalCompositeOperation, 'source-over');
});
