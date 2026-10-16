const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { PDFDocument, degrees, StandardFonts } = require('pdf-lib');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json');
        res.end(data);
    });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.waitForFunction(() => !appState.rendering && typeof PDFLib !== 'undefined' && typeof pdfjsLib !== 'undefined');
        await page.click('#createBlankBtn');
        await page.waitForSelector('#drawingCanvas');
        await page.click('#penModeBtn');
        async function draw() {
            const box = await page.locator('#drawingCanvas').boundingBox();
            await page.mouse.move(box.x + 100, box.y + 100);
            await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 150, { steps: 8 }); await page.mouse.up();
            await page.evaluate(() => saveQueue);
        }
        await draw();
        assert.ok(await page.evaluate(() => appState.currentStrokes.length > 0));
        await page.click('#undoBtn'); await page.click('#zoomInBtn');
        assert.equal(await page.evaluate(() => appState.currentStrokes.length), 0);
        await page.click('#redoBtn');
        const count = await page.evaluate(() => appState.currentStrokes.length);
        assert.ok(count > 0);
        await page.click('#clearBtn'); await page.click('#zoomOutBtn');
        assert.equal(await page.evaluate(() => appState.currentStrokes.length), 0);
        await page.click('#undoBtn');
        await page.click('#addPageBtn'); await page.click('#prevPageBtn');
        assert.equal(await page.evaluate(() => appState.currentStrokes.length), count);
        await page.evaluate(() => queueNotebookSave()); await page.reload();
        await page.waitForFunction(() => !appState.rendering && appState.totalPages === 2);
        assert.equal(await page.evaluate(() => appState.currentStrokes.length), count);
        console.log('PASS blank drawing, undo/redo, clear, zoom, page switch and reload');

        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        for (const angle of [0, 90, 180, 270]) {
            const p = pdf.addPage([400, 500]); p.setCropBox(20, 30, 350, 440); p.setRotation(degrees(angle));
            p.drawText('Searchable original text', { x: 50, y: 250, size: 16, font });
        }
        await page.setInputFiles('#pdfInput', { name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
        await page.waitForFunction(() => !appState.rendering && !appState.blankMode && appState.totalPages === 4);
        await page.click('#penModeBtn');
        await draw();
        for (let i = 0; i < 3; i++) {
            await page.click('#nextPageBtn'); await page.waitForFunction(() => !appState.rendering); await draw();
        }
        await page.evaluate(() => queueNotebookSave()); await page.reload();
        await page.waitForFunction(() => !appState.rendering && appState.pdfDoc && appState.totalPages === 4);
        const inkBeforeTouch = await page.evaluate(() => appState.currentStrokes.length);
        await page.evaluate(() => {
            const canvas = document.getElementById('drawingCanvas');
            for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
                canvas.dispatchEvent(new PointerEvent(type, { pointerId: 99, pointerType: 'touch', pressure: .8, clientX: 100, clientY: 100 }));
            }
        });
        assert.equal(await page.evaluate(() => appState.currentStrokes.length), inkBeforeTouch);
        const before = await page.evaluate(() => JSON.stringify([appState.currentPage, appState.annotations]));
        const downloadPromise = page.waitForEvent('download'); await page.click('#savePdfBtn');
        const download = await downloadPromise;
        fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
        const output = path.join(root, 'test-results/export.pdf'); await download.saveAs(output);
        const bytes = [...fs.readFileSync(output)];
        const result = await page.evaluate(async bytes => {
            const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
            const pages = [];
            for (let i=1; i<=doc.numPages; i++) {
                const p = await doc.getPage(i), text = await p.getTextContent();
                pages.push(text.items.map(item => item.str).join(''));
            }
            return pages;
        }, bytes);
        assert.equal(result.length, 4);
        assert.ok(result.every(text => text.includes('Searchable original text')));
        assert.equal(await page.evaluate(() => JSON.stringify([appState.currentPage, appState.annotations])), before);
        // Compare exported annotation placement with the screen, including crop boxes and rotation.
        const mismatch = await page.evaluate(async bytes => {
            const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
            let maxError = 0;
            for (let i=1; i<=4; i++) {
                const original = await appState.pdfDoc.getPage(i), exported = await doc.getPage(i);
                const viewport = original.getViewport({ scale: 1.5 });
                const a=document.createElement('canvas'), b=document.createElement('canvas');
                a.width=b.width=viewport.width; a.height=b.height=viewport.height;
                await original.render({ canvasContext:a.getContext('2d'), viewport }).promise;
                const ink=document.createElement('canvas'); ink.width=a.width; ink.height=a.height;
                Notebook.paint(ink.getContext('2d'), appState.annotations[i], ink.width, ink.height);
                a.getContext('2d').drawImage(ink,0,0);
                await exported.render({ canvasContext:b.getContext('2d'), viewport }).promise;
                const x=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
                const y=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
                let difference=0; for(let j=0;j<x.length;j++) difference+=Math.abs(x[j]-y[j]);
                maxError=Math.max(maxError,difference/x.length);
            }
            return maxError;
        }, bytes);
        assert.ok(mismatch < 1, `Export visual difference: ${mismatch}`);
        await page.screenshot({ path: path.join(root, 'test-results/app.png') });
        assert.deepEqual(errors, []);
        console.log('PASS PDF reload, searchable export, rotations/crop boxes and unchanged live notebook; visual difference', mismatch);
        await page.evaluate(async () => {
            const write = NotebookStore.write;
            NotebookStore.write = async () => { throw new DOMException('Full', 'QuotaExceededError'); };
            await queueNotebookSave();
            NotebookStore.write = write;
        });
        assert.match(await page.locator('#saveStatus').innerText(), /自動保存できません/);
        assert.ok(await page.evaluate(() => savedRevision < saveRevision));
        await page.evaluate(() => queueNotebookSave());
        assert.equal(await page.locator('#saveStatus').innerText(), '端末に保存済み');
        console.log('PASS pressure-only touch rejected; storage failure visible and retry succeeds');
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
