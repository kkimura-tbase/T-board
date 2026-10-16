// アプリケーションの状態管理
const appState = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.5,
    currentTool: 'pen',
    currentColor: '#000000',
    thickness: 3,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    histories: {},
    rendering: false,
    renderVersion: 0,
    annotations: {}, // ページごとの注釈を保存（座標配列ベース）
    currentStrokes: [], // 現在のページの描画ストローク（座標ベース）
    pdfData: null, // PDFのバイナリデータを保持
    penOnlyMode: true, // ペン専用モード（手の動きを無視）デフォルトON
    blankMode: false, // 白紙ノートモード
    blankPages: [], // 白紙ノートのページ数
    toolSettings: { // 各ツールのデフォルト設定
        pen: 3,
        marker: 20,
        eraser: 20
    },
    // ピンチズーム・パン用
    pinchZoom: {
        active: false,
        initialDistance: 0,
        initialScale: 1.0,
        centerX: 0,
        centerY: 0
    },
    pan: {
        active: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0
    },
    // 1本指スクロール（ペン専用モード時）
    fingerScroll: {
        active: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0
    },
    // 滑らかなズーム・スクロール用
    renderTimer: null,
    targetScale: 1.5
};

let saveQueue = Promise.resolve();
let saveRevision = 0;
let savedRevision = 0;
let recoveryAvailable = false;

function setSaveStatus(text) {
    document.getElementById('saveStatus').textContent = text;
}

function captureNotebook() {
    return {
        version: 1,
        blankMode: appState.blankMode,
        pdfData: appState.pdfData?.slice() || null,
        totalPages: appState.totalPages,
        currentPage: appState.currentPage,
        annotations: Notebook.clone(appState.annotations),
        scale: appState.scale
    };
}

function queueNotebookSave() {
    if (!appState.totalPages) return saveQueue;
    saveCurrentAnnotations();
    const snapshot = captureNotebook();
    const revision = ++saveRevision;
    setSaveStatus('端末に保存中…');
    saveQueue = saveQueue.catch(() => {}).then(() => NotebookStore.write(snapshot)).then(() => {
        savedRevision = revision;
        recoveryAvailable = true;
        if (revision === saveRevision) setSaveStatus('端末に保存済み');
    }).catch(error => {
        console.error('自動保存失敗:', error);
        setSaveStatus('自動保存できません。PDF保存してください');
    });
    return saveQueue;
}

async function confirmReplaceNotebook() {
    if (!appState.totalPages && !recoveryAvailable) return true;
    return confirm('新しいノートを開くと、自動保存中のノートを置き換えます。必要な内容はPDF保存しましたか？');
}

async function restoreNotebook() {
    // Prevent a late database read from replacing a notebook the user has just opened.
    document.querySelector('.main-container').inert = true;
    document.querySelector('.app-header').inert = true;
    appState.rendering = true;
    try {
        const saved = await NotebookStore.read();
        if (!saved) return;
        recoveryAvailable = true;
        if (saved.version !== 1 || !saved.totalPages || !saved.annotations) throw new Error('保存形式を読み込めません');
        if (!confirm('前回のノートを復元しますか？')) {
            setSaveStatus('前回のノートは保持されています');
            return;
        }
        let pdfDoc = null;
        if (!saved.blankMode) {
            pdfDoc = await pdfjsLib.getDocument({
                data: saved.pdfData.slice(), isEvalSupported: false,
                cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', cMapPacked: true
            }).promise;
        }
        Object.assign(appState, saved, { pdfDoc, histories: {}, currentStrokes: [] });
        appState.blankPages = saved.blankMode ? Array.from({ length: saved.totalPages }, (_, i) => i + 1) : [];
        elements.addPageBtn.style.display = saved.blankMode ? 'flex' : 'none';
        if (saved.blankMode) await renderBlankPage(1122, 793);
        else await renderPage(saved.currentPage);
        updatePageInfo();
        elements.zoomInfo.textContent = Math.round(appState.scale * 100) + '%';
        setSaveStatus('前回のノートを復元しました');
    } catch (error) {
        console.error(error);
        setSaveStatus('保存データを読み込めません。再読み込みをお試しください');
    } finally {
        appState.rendering = false;
        document.querySelector('.main-container').inert = false;
        document.querySelector('.app-header').inert = false;
    }
}

window.addEventListener('beforeunload', event => {
    if (savedRevision < saveRevision || appState.isDrawing) {
        event.preventDefault();
        event.returnValue = '';
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && appState.totalPages) queueNotebookSave();
});

// DOM要素の取得
const elements = {
    pdfInput: document.getElementById('pdfInput'),
    loadPdfBtn: document.getElementById('loadPdfBtn'),
    createBlankBtn: document.getElementById('createBlankBtn'),
    canvasContainer: document.getElementById('canvasContainer'),
    currentPageSpan: document.getElementById('currentPage'),
    totalPagesSpan: document.getElementById('totalPages'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    addPageBtn: document.getElementById('addPageBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    resetZoomBtn: document.getElementById('resetZoomBtn'),
    fitWidthBtn: document.getElementById('fitWidthBtn'),
    zoomInfo: document.getElementById('zoomInfo'),
    thicknessSlider: document.getElementById('thicknessSlider'),
    thicknessValue: document.getElementById('thicknessValue'),
    undoBtn: document.getElementById('undoBtn'),
    redoBtn: document.getElementById('redoBtn'),
    clearBtn: document.getElementById('clearBtn'),
    saveBtn: document.getElementById('saveBtn'),
    savePdfBtn: document.getElementById('savePdfBtn'),
    penModeBtn: document.getElementById('penModeBtn'),
    menuToggleBtn: document.getElementById('menuToggleBtn'),
    toolbar: document.getElementById('toolbar'),
    toolbarOverlay: document.getElementById('toolbarOverlay'),
    scrollUpBtn: document.getElementById('scrollUpBtn'),
    scrollDownBtn: document.getElementById('scrollDownBtn'),
    scrollLeftBtn: document.getElementById('scrollLeftBtn'),
    scrollRightBtn: document.getElementById('scrollRightBtn'),
    toggleLayoutBtn: document.getElementById('toggleLayoutBtn'),
    layoutIcon: document.getElementById('layoutIcon'),
    mainContainer: document.querySelector('.main-container')
};

// イベントリスナーの設定
function setupEventListeners() {
    // メニュートグル（モバイル用）
    if (elements.menuToggleBtn) {
        elements.menuToggleBtn.addEventListener('click', toggleToolbar);
    }
    if (elements.toolbarOverlay) {
        elements.toolbarOverlay.addEventListener('click', closeToolbar);
    }
    
    // PDFファイル読み込み
    elements.loadPdfBtn.addEventListener('click', () => elements.pdfInput.click());
    elements.pdfInput.addEventListener('change', handleFileSelect);
    
    // 白紙ノート作成
    elements.createBlankBtn.addEventListener('click', createBlankCanvas);

    // ページ操作
    elements.prevPageBtn.addEventListener('click', () => changePage(-1));
    elements.nextPageBtn.addEventListener('click', () => changePage(1));
    elements.addPageBtn.addEventListener('click', addBlankPage);

    // ズーム操作
    elements.zoomInBtn.addEventListener('click', () => changeZoom(0.25));
    elements.zoomOutBtn.addEventListener('click', () => changeZoom(-0.25));
    elements.resetZoomBtn.addEventListener('click', resetZoom);
    elements.fitWidthBtn.addEventListener('click', fitToWidth);

    // スクロール操作（押しっぱなしで連続スクロール）
    let scrollInterval = null;
    
    const setupScrollButton = (btn, deltaX, deltaY) => {
        btn.addEventListener('mousedown', () => {
            scrollCanvas(deltaX, deltaY);
            scrollInterval = setInterval(() => scrollCanvas(deltaX, deltaY), 50);
        });
        btn.addEventListener('mouseup', () => {
            if (scrollInterval) {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (scrollInterval) {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }
        });
        // タッチデバイス対応
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            scrollCanvas(deltaX, deltaY);
            scrollInterval = setInterval(() => scrollCanvas(deltaX, deltaY), 50);
        });
        btn.addEventListener('touchend', () => {
            if (scrollInterval) {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }
        });
    };
    
    setupScrollButton(elements.scrollUpBtn, 0, -100);
    setupScrollButton(elements.scrollDownBtn, 0, 100);
    setupScrollButton(elements.scrollLeftBtn, -100, 0);
    setupScrollButton(elements.scrollRightBtn, 100, 0);

    // ペンモード切り替え
    elements.penModeBtn.addEventListener('click', togglePenMode);

    // レイアウト切り替え
    if (elements.toggleLayoutBtn) {
        elements.toggleLayoutBtn.addEventListener('click', toggleLayout);
    }

    // キーボードショートカット
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // ツール選択
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const newTool = this.dataset.tool;
            appState.currentTool = newTool;
            
            // ツールに応じて太さを自動調整
            if (appState.toolSettings[newTool]) {
                appState.thickness = appState.toolSettings[newTool];
                elements.thicknessSlider.value = appState.thickness;
                elements.thicknessValue.textContent = appState.thickness;
                console.log(`✓ ${newTool}を選択 - 太さ: ${appState.thickness}px`);
            }
        });
    });

    // 色選択
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            appState.currentColor = this.dataset.color;
        });
    });

    // 太さ調整
    elements.thicknessSlider.addEventListener('input', function() {
        appState.thickness = parseInt(this.value);
        elements.thicknessValue.textContent = this.value;
        
        // 現在のツールの設定を更新（ユーザーの好みを記憶）
        if (appState.currentTool && appState.toolSettings[appState.currentTool] !== undefined) {
            appState.toolSettings[appState.currentTool] = appState.thickness;
        }
    });

    // アクションボタン
    elements.undoBtn.addEventListener('click', undo);
    elements.redoBtn.addEventListener('click', redo);
    elements.clearBtn.addEventListener('click', clearCanvas);
    elements.saveBtn.addEventListener('click', saveAsImage);
    elements.savePdfBtn.addEventListener('click', saveAsPDF);
}

// PDFファイルの選択処理
async function handleFileSelect(event) {
    if (appState.rendering) return;
    const file = event.target.files[0];
    if (!file) {
        alert('ファイルを選択してください。');
        return;
    }
    
    // PDFファイルのチェックを緩和（拡張子でもチェック）
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('PDFファイルを選択してください。');
        return;
    }

    if (!await confirmReplaceNotebook()) return;
    appState.rendering = true;
    try {
        setSaveStatus('PDFを読み込み中…');

        console.log('ファイル情報:', {
            name: file.name,
            type: file.type,
            size: file.size
        });

        // PDFライブラリの存在確認
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.jsライブラリが読み込まれていません。ページを再読み込みしてください。');
        }

        console.log('PDF.js version:', pdfjsLib.version);

        const arrayBuffer = await file.arrayBuffer();
        console.log('ArrayBuffer size:', arrayBuffer.byteLength);
        
        // PDFデータを保存
        const pdfData = new Uint8Array(arrayBuffer);
        
        // PDFドキュメントの読み込み
        console.log('PDFドキュメントを読み込み中...');
        const loadingTask = pdfjsLib.getDocument({
            data: pdfData.slice(),
            isEvalSupported: false,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            verbosity: 0
        });
        
        appState.pdfDoc = await loadingTask.promise;
        appState.pdfData = pdfData;
        appState.totalPages = appState.pdfDoc.numPages;
        appState.currentPage = 1;
        appState.annotations = {};
        appState.currentStrokes = [];
        appState.histories = {};
        appState.blankMode = false; // PDFモードに切り替え
        appState.blankPages = [];

        console.log('✓ PDF読み込み成功:', appState.totalPages, 'ページ');

        // ページ追加ボタンを非表示
        elements.addPageBtn.style.display = 'none';

        // PDFを表示
        await renderPage(appState.currentPage);
        updatePageInfo();
        queueNotebookSave();
    } catch (error) {
        console.error('❌ PDFの読み込みエラー:', error);
        console.error('エラー詳細:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        setSaveStatus('PDFを読み込めませんでした。現在のノートは保持されています');
        alert('PDFの読み込みに失敗しました。パスワードのない有効なPDFを選択してください。');
    } finally {
        appState.rendering = false;
        elements.pdfInput.value = '';
    }
}

async function renderPage(pageNum) {
    const version = ++appState.renderVersion;
    appState.rendering = true;
    try {
        console.log('ページレンダリング開始:', pageNum);

        console.log('ページ取得中...');
        const page = await appState.pdfDoc.getPage(pageNum);
        console.log('ページ取得成功');
        
        const viewport = page.getViewport({ scale: appState.scale });
        console.log('Viewport:', {
            width: viewport.width,
            height: viewport.height,
            scale: appState.scale
        });

        // 既存のキャンバスを取得または新規作成
        let pdfCanvas = document.getElementById('pdfCanvas');
        let drawingCanvas = document.getElementById('drawingCanvas');
        let canvasWrapper = document.querySelector('.canvas-wrapper');
        
        const isFirstRender = !pdfCanvas || !drawingCanvas;
        
        if (isFirstRender) {
            // 初回のみ DOM を作成
            elements.canvasContainer.innerHTML = `
                <div class="canvas-wrapper" style="width: ${viewport.width}px; height: ${viewport.height}px;">
                    <canvas id="pdfCanvas"></canvas>
                    <canvas id="drawingCanvas"></canvas>
                </div>
            `;
            
            pdfCanvas = document.getElementById('pdfCanvas');
            drawingCanvas = document.getElementById('drawingCanvas');
            canvasWrapper = document.querySelector('.canvas-wrapper');
        } else {
            // 既存の Canvas を再利用し、サイズのみ更新
            canvasWrapper.style.width = viewport.width + 'px';
            canvasWrapper.style.height = viewport.height + 'px';
        }
        
        if (!pdfCanvas || !drawingCanvas) {
            throw new Error('キャンバス要素が見つかりません');
        }
        
        // オフスクリーンキャンバスを作成（裏で描画）
        const offscreenPdfCanvas = document.createElement('canvas');
        const offscreenDrawingCanvas = document.createElement('canvas');
        
        offscreenPdfCanvas.width = viewport.width;
        offscreenPdfCanvas.height = viewport.height;
        offscreenDrawingCanvas.width = viewport.width;
        offscreenDrawingCanvas.height = viewport.height;
        
        const offscreenPdfContext = offscreenPdfCanvas.getContext('2d');
        const offscreenDrawingContext = offscreenDrawingCanvas.getContext('2d');
        
        console.log('オフスクリーンキャンバスサイズ設定:', offscreenPdfCanvas.width, 'x', offscreenPdfCanvas.height);

        // PDFページをオフスクリーンキャンバスにレンダリング
        console.log('PDFレンダリング開始（オフスクリーン）...');
        const renderContext = {
            canvasContext: offscreenPdfContext,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        console.log('✓ PDFレンダリング完了（オフスクリーン）');

        if (version !== appState.renderVersion) return;
        const savedStrokes = appState.annotations[pageNum] || [];
        Notebook.paint(offscreenDrawingContext, savedStrokes, viewport.width, viewport.height);
        appState.currentStrokes = Notebook.clone(savedStrokes);
        Notebook.history(appState);

        // ここで一気に表Canvas に転送（チラつき最小化）
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        drawingCanvas.width = viewport.width;
        drawingCanvas.height = viewport.height;
        
        const pdfContext = pdfCanvas.getContext('2d');
        const drawingContext = drawingCanvas.getContext('2d');
        
        // オフスクリーンから一気に転送
        pdfContext.drawImage(offscreenPdfCanvas, 0, 0);
        drawingContext.drawImage(offscreenDrawingCanvas, 0, 0);
        
        console.log('✓ オフスクリーンから表キャンバスに転送完了');

        // 描画キャンバスのイベントリスナー設定（初回のみ）
        if (isFirstRender) {
            setupDrawingCanvas(drawingCanvas);
        }

        updatePageInfo();
        
        console.log('✓ ページ表示完了');
    } catch (error) {
        if (version !== appState.renderVersion) return;
        console.error('❌ ページのレンダリングエラー:', error);
        console.error('エラー詳細:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        elements.canvasContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
                <h2>ページの表示に失敗しました</h2>
                <p style="color: #666;">エラー: ${error.message}</p>
                <p style="color: #666;">ブラウザのコンソールで詳細を確認してください。</p>
            </div>
        `;
    } finally {
        if (version === appState.renderVersion) appState.rendering = false;
    }
}

// 描画キャンバスのセットアップ
function setupDrawingCanvas(canvas) {
    const ctx = canvas.getContext('2d');

    // タッチアクションを無効化（ブラウザのデフォルト動作を防ぐ）
    canvas.style.touchAction = 'none';
    
    // 実際の描画処理
    function drawPoint(point) {
        const { x, y } = point;
        
        // Canvas 座標を正規化座標に変換（0-1の範囲）
        const normalizedX = x / canvas.width;
        const normalizedY = y / canvas.height;
        const normalizedLastX = appState.lastX / canvas.width;
        const normalizedLastY = appState.lastY / canvas.height;

        // ストローク情報を保存
        const strokeData = {
            startX: normalizedLastX,
            startY: normalizedLastY,
            endX: normalizedX,
            endY: normalizedY,
            color: appState.currentColor,
            width: appState.thickness / canvas.width,
            tool: appState.currentTool,
            alpha: appState.currentTool === 'marker' ? 0.25 : 1.0
        };
        appState.currentStrokes.push(strokeData);

        ctx.beginPath();
        ctx.moveTo(appState.lastX, appState.lastY);
        ctx.lineTo(x, y);

        if (appState.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = appState.thickness * 3;
            ctx.lineCap = 'round';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = appState.currentColor;
            ctx.lineWidth = appState.thickness;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (appState.currentTool === 'marker') {
                ctx.globalAlpha = 0.25;
            } else {
                ctx.globalAlpha = 1.0;
            }
        }

        ctx.stroke();
        ctx.globalAlpha = 1.0;

        appState.lastX = x;
        appState.lastY = y;
    }

    // Pointer Eventsを使用（統一されたイベント処理）
    // passive: false を指定してブラウザのデフォルト動作を完全に制御
    canvas.addEventListener('pointerdown', startDrawing, { passive: false });
    canvas.addEventListener('pointermove', draw, { passive: false });
    canvas.addEventListener('pointerup', stopDrawing, { passive: false });
    canvas.addEventListener('lostpointercapture', stopDrawing, { passive: false });
    canvas.addEventListener('pointercancel', stopDrawing, { passive: false });

    // タッチイベントを追加（ピンチズーム用）
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    let activePointer = null;
    function startDrawing(e) {
        if (appState.rendering || appState.pinchZoom.active || activePointer !== null) return;
        // デフォルト動作を防止（iPad Safari のジェスチャー認識を無効化）
        e.preventDefault();
        
        // ペン専用モードの場合、ペン以外を処理
        if (appState.penOnlyMode) {
            // Apple Pencil の判定を改善
            // - pointerType が 'pen' である
            const isPenInput = Notebook.isPen(e);
            
            if (!isPenInput && e.pointerType === 'touch') {
                // 指の場合はスクロールモードに入る
                const container = elements.canvasContainer;
                appState.fingerScroll.active = true;
                appState.fingerScroll.startX = e.clientX;
                appState.fingerScroll.startY = e.clientY;
                appState.fingerScroll.scrollLeft = container.scrollLeft;
                appState.fingerScroll.scrollTop = container.scrollTop;
                return; // 描画はしない
            }
            
            if (!isPenInput && e.pointerType !== 'touch') {
                return; // マウスなどを拒否
            }
        }
        
        Notebook.history(appState);
        activePointer = e.pointerId;
        appState.isDrawing = true;
        canvas.setPointerCapture?.(e.pointerId);
        const rect = canvas.getBoundingClientRect();
        appState.lastX = e.clientX - rect.left;
        appState.lastY = e.clientY - rect.top;
        drawPoint({ x: appState.lastX, y: appState.lastY });
    }


    function draw(e) {
        // デフォルト動作を防止（iPad Safari のジェスチャー認識を無効化）
        e.preventDefault();
        
        // 指スクロール処理（ペン専用モード時）
        if (appState.fingerScroll.active && appState.penOnlyMode && e.pointerType === 'touch') {
            const container = elements.canvasContainer;
            const deltaX = e.clientX - appState.fingerScroll.startX;
            const deltaY = e.clientY - appState.fingerScroll.startY;
            
            container.scrollLeft = appState.fingerScroll.scrollLeft - deltaX;
            container.scrollTop = appState.fingerScroll.scrollTop - deltaY;
            return; // 描画はしない
        }
        
        if (!appState.isDrawing || e.pointerId !== activePointer) return;
        
        // ペン専用モードの場合、ペン以外を無視
        if (appState.penOnlyMode) {
            // Apple Pencil の判定を改善
            const isPenInput = Notebook.isPen(e);
            if (!isPenInput) {
                return;
            }
        }

        const rect = canvas.getBoundingClientRect();
        
        // Coalesced Events を取得（間引かれたイベントも含む）
        const coalesced = e.getCoalescedEvents?.() || [];
        const events = coalesced.length ? coalesced : [e];
        
        // すべてのイベントを描画
        for (const event of events) {
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            drawPoint({ x, y });
        }
    }

    function stopDrawing(e) {
        if (activePointer !== null && e.pointerId !== activePointer) return;
        activePointer = null;
        // 指スクロール終了
        if (appState.fingerScroll.active) {
            appState.fingerScroll.active = false;
        }
        
        if (appState.isDrawing) {
            appState.isDrawing = false;
            saveDrawingState();
        }
    }

    // ピンチズーム・パン用のタッチイベント処理
    function handleTouchStart(e) {
        if (e.touches.length === 2) {
            // 2本指タッチ = ピンチズームまたはパン
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // 2本指の中心点を計算（スクリーン座標）
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            // コンテナの位置を取得
            const container = elements.canvasContainer;
            const rect = container.getBoundingClientRect();
            
            // 中心点のコンテナ内相対位置を計算
            const relativeX = centerX - rect.left + container.scrollLeft;
            const relativeY = centerY - rect.top + container.scrollTop;
            
            // ピンチズーム開始時に注釈を保存
            saveCurrentAnnotations();
            
            // ピンチズーム初期化
            appState.pinchZoom.active = true;
            appState.pinchZoom.initialDistance = getTouchDistance(touch1, touch2);
            appState.pinchZoom.initialScale = appState.scale;
            appState.targetScale = appState.scale;
            appState.pinchZoom.centerX = relativeX;  // コンテナ内相対位置
            appState.pinchZoom.centerY = relativeY;
            
            // パン初期化
            appState.pan.active = true;
            appState.pan.startX = centerX;
            appState.pan.startY = centerY;
            appState.pan.scrollLeft = container.scrollLeft;
            appState.pan.scrollTop = container.scrollTop;
            
            activePointer = null;
            // 描画を停止
            if (appState.isDrawing) {
                appState.isDrawing = false;
                saveDrawingState();
            }
            
            console.log('🤏 2本指操作開始:', {
                distance: appState.pinchZoom.initialDistance,
                scale: appState.pinchZoom.initialScale,
                center: { x: relativeX, y: relativeY }
            });
        }
        // 1本指タッチの場合はPointer Eventsに任せる
    }

    function handleTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // 現在の2本指の中心点
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;
            
            // 現在の距離
            const currentDistance = getTouchDistance(touch1, touch2);
            const distanceRatio = currentDistance / appState.pinchZoom.initialDistance;
            
            // 距離の変化が大きい場合 = ピンチズーム
            const distanceChange = Math.abs(distanceRatio - 1.0);
            
            if (distanceChange > 0.05) {
                // ピンチズーム処理
                let newScale = appState.pinchZoom.initialScale * distanceRatio;
                newScale = Math.max(0.5, Math.min(5.0, newScale));
                
                // ズーム表示を即座に更新
                appState.targetScale = newScale;
                elements.zoomInfo.textContent = Math.round(newScale * 100) + '%';
                
                // 再描画をdebounce（滑らかにするため）
                if (appState.renderTimer) {
                    cancelAnimationFrame(appState.renderTimer);
                }
                
                appState.renderTimer = requestAnimationFrame(() => {
                    if (Math.abs(appState.targetScale - appState.scale) > 0.03) {
                        const oldScale = appState.scale;
                        appState.scale = appState.targetScale;
                        
                        // ズーム中心を維持するためのスクロール調整
                        const container = elements.canvasContainer;
                        const scaleChange = appState.scale / oldScale;
                        
                        // 中心点を基準にスクロール位置を調整
                        const newScrollLeft = appState.pinchZoom.centerX * scaleChange - appState.pinchZoom.centerX + container.scrollLeft;
                        const newScrollTop = appState.pinchZoom.centerY * scaleChange - appState.pinchZoom.centerY + container.scrollTop;
                        
                        if (appState.blankMode) {
                            renderBlankPage(1122, 793).then(() => {
                                container.scrollLeft = newScrollLeft;
                                container.scrollTop = newScrollTop;
                            });
                        } else if (appState.pdfDoc) {
                            renderPage(appState.currentPage).then(() => {
                                container.scrollLeft = newScrollLeft;
                                container.scrollTop = newScrollTop;
                            });
                        }
                    }
                });
            } else {
                // パン（スクロール）処理 - リアルタイムで滑らかに
                const container = elements.canvasContainer;
                const deltaX = centerX - appState.pan.startX;
                const deltaY = centerY - appState.pan.startY;
                
                // 逆方向にスクロール（指の動きに追従）
                container.scrollLeft = appState.pan.scrollLeft - deltaX;
                container.scrollTop = appState.pan.scrollTop - deltaY;
            }
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length < 2) {
            // 2本指操作終了
            if (appState.pinchZoom.active || appState.pan.active) {
                appState.pinchZoom.active = false;
                appState.pan.active = false;
                
                // 最終的な再描画（正確なスケールで）
                if (appState.renderTimer) {
                    cancelAnimationFrame(appState.renderTimer);
                }
                
                if (Math.abs(appState.targetScale - appState.scale) > 0.001) {
                    appState.scale = appState.targetScale;
                    
                    if (appState.blankMode) {
                        renderBlankPage(1122, 793);
                    } else if (appState.pdfDoc) {
                        renderPage(appState.currentPage);
                    }
                }
                
                console.log('🤏 2本指操作終了:', {
                    finalScale: appState.scale
                });
            }
        }
    }

    // 2点間の距離を計算
    function getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// 描画状態を保存
function saveDrawingState() {
    Notebook.commit(appState);
    queueNotebookSave();
}

function saveCurrentAnnotations() {
    appState.annotations[appState.currentPage] = Notebook.clone(appState.currentStrokes);
}

async function restoreAnnotations() {
    appState.currentStrokes = Notebook.clone(appState.annotations[appState.currentPage] || []);
    Notebook.history(appState);
    repaintAnnotations();
}

function repaintAnnotations() {
    const canvas = document.getElementById('drawingCanvas');
    if (canvas) Notebook.paint(canvas.getContext('2d'), appState.currentStrokes, canvas.width, canvas.height);
}

function undo() {
    if (appState.rendering || appState.isDrawing) return;
    if (Notebook.move(appState, -1)) { repaintAnnotations(); queueNotebookSave(); }
}

function redo() {
    if (appState.rendering || appState.isDrawing) return;
    if (Notebook.move(appState, 1)) { repaintAnnotations(); queueNotebookSave(); }
}

function clearCanvas() {
    if (appState.rendering || appState.isDrawing || !appState.totalPages) return;
    if (!confirm('このページの書き込みを全て消去しますか？')) return;
    Notebook.history(appState);
    appState.currentStrokes = [];
    saveDrawingState();
    repaintAnnotations();
}


// ページ変更
async function changePage(delta) {
    if (appState.rendering || appState.isDrawing) return;
    const newPage = appState.currentPage + delta;
    if (newPage < 1 || newPage > appState.totalPages) return;

    // 重要：ページ番号を変更する前に現在のページの注釈を保存
    saveCurrentAnnotations();
    
    // ページ番号を変更
    appState.currentPage = newPage;
    
    if (appState.blankMode) {
        // 白紙モードの場合
        const width = 1122;
        const height = 793;
        await renderBlankPage(width, height);
        updatePageInfo();
    } else {
        // PDFモードの場合
        await renderPage(appState.currentPage);
    }
}

// ズーム変更（注釈を保持）
async function changeZoom(delta) {
    if (appState.rendering || appState.isDrawing) return;
    // 現在の注釈を保存
    saveCurrentAnnotations();
    
    appState.scale += delta;
    if (appState.scale < 0.5) appState.scale = 0.5;
    if (appState.scale > 5.0) appState.scale = 5.0;

    elements.zoomInfo.textContent = Math.round(appState.scale * 100) + '%';
    
    // PDFモードの場合のみrenderPage、白紙モードの場合はrenderBlankPage
    if (appState.blankMode) {
        await renderBlankPage(1122, 793);
    } else if (appState.pdfDoc) {
        await renderPage(appState.currentPage);
    }
}

// 幅に合わせる
async function fitToWidth() {
    if (appState.rendering || appState.isDrawing) return;
    if (appState.blankMode) {
        saveCurrentAnnotations();
        appState.scale = Math.max(0.5, Math.min(5, (elements.canvasContainer.clientWidth - 40) / 1122));
        await renderBlankPage(1122, 793);
        elements.zoomInfo.textContent = Math.round(appState.scale * 100) + '%';
        return;
    }
    if (!appState.pdfDoc) {
        console.warn('PDFが読み込まれていません');
        return;
    }
    
    // 現在の注釈を保存
    saveCurrentAnnotations();
    
    const containerWidth = elements.canvasContainer.clientWidth - 100;
    const page = await appState.pdfDoc.getPage(appState.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    appState.scale = containerWidth / viewport.width;

    elements.zoomInfo.textContent = Math.round(appState.scale * 100) + '%';
    await renderPage(appState.currentPage);
    
    // スクロール位置を一番上にリセット
    setTimeout(() => {
        elements.canvasContainer.scrollTop = 0;
        elements.canvasContainer.scrollLeft = 0;
    }, 100);
}

// ズームを100%にリセット
async function resetZoom() {
    if (appState.rendering || appState.isDrawing) return;
    // 現在の注釈を保存
    saveCurrentAnnotations();
    
    appState.scale = 1.0;
    elements.zoomInfo.textContent = '100%';
    
    if (appState.blankMode) {
        await renderBlankPage(1122, 793);
    } else if (appState.pdfDoc) {
        await renderPage(appState.currentPage);
    }
}

// キャンバスをスクロール
function scrollCanvas(deltaX, deltaY) {
    const container = elements.canvasContainer;
    container.scrollBy({
        left: deltaX,
        top: deltaY,
        behavior: 'auto' // 連続スクロール用に'auto'を使用
    });
}

// ペンモードの切り替え
function togglePenMode() {
    appState.penOnlyMode = !appState.penOnlyMode;
    
    if (appState.penOnlyMode) {
        elements.penModeBtn.classList.add('active');
        elements.penModeBtn.innerHTML = '<i class="fas fa-pen"></i><span>ペン専用</span>';
        console.log('✓ ペン専用モード ON - 手の動きを無視します');
    } else {
        elements.penModeBtn.classList.remove('active');
        elements.penModeBtn.innerHTML = '<i class="fas fa-hand-paper"></i><span>手書きモード</span>';
        console.log('✓ 手書きモード ON - タッチ操作が有効です');
    }
}

// レイアウト切り替え（左サイドバー ⇔ 上部バー）
function toggleLayout() {
    if (elements.mainContainer) {
        elements.mainContainer.classList.toggle('layout-top');
        
        const isTopLayout = elements.mainContainer.classList.contains('layout-top');
        
        // アイコンを変更（上レイアウト時は←、左レイアウト時は↑）
        if (elements.layoutIcon) {
            if (isTopLayout) {
                elements.layoutIcon.className = 'fas fa-arrow-left';
                console.log('✓ レイアウト: 上部バー');
                // ツールバーを閉じる（モバイル時）
                closeToolbar();
            } else {
                elements.layoutIcon.className = 'fas fa-arrow-up';
                console.log('✓ レイアウト: 左サイドバー');
            }
        }
        
        // レイアウト変更を保存（LocalStorage）
        try {
            localStorage.setItem('toolbarLayout', isTopLayout ? 'top' : 'left');
        } catch (e) {
            console.warn('レイアウト設定を保存できませんでした');
        }
    }
}

// 保存済みツールバーレイアウトを復元
function restoreToolbarLayout() {
    try {
        const savedLayout = localStorage.getItem('toolbarLayout');
        if (savedLayout === 'top' && elements.mainContainer) {
            elements.mainContainer.classList.add('layout-top');
            // アイコンを左向き矢印に変更
            if (elements.layoutIcon) {
                elements.layoutIcon.className = 'fas fa-arrow-left';
            }
            console.log('✓ 保存済みレイアウトを復元: 上部バー');
        } else if (savedLayout === 'left') {
            // アイコンを上向き矢印に変更（デフォルト）
            if (elements.layoutIcon) {
                elements.layoutIcon.className = 'fas fa-arrow-up';
            }
            console.log('✓ 保存済みレイアウトを復元: 左サイドバー');
        }
    } catch (e) {
        console.warn('レイアウト設定の復元に失敗しました');
    }
}

// ツールバーの開閉（モバイル用）
function toggleToolbar() {
    if (elements.toolbar && elements.toolbarOverlay) {
        elements.toolbar.classList.toggle('open');
        elements.toolbarOverlay.classList.toggle('show');
    }
}

function closeToolbar() {
    if (elements.toolbar && elements.toolbarOverlay) {
        elements.toolbar.classList.remove('open');
        elements.toolbarOverlay.classList.remove('show');
    }
}

// キーボードショートカット
function handleKeyboardShortcuts(e) {
    // Ctrl+Z または Cmd+Z で元に戻す
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        console.log('⎌ 元に戻す');
    }
    
    // Ctrl+Shift+Z または Cmd+Shift+Z または Ctrl+Y でやり直し
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
        (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        redo();
        console.log('⎌ やり直し');
    }
}

// ページ情報の更新
function updatePageInfo() {
    elements.currentPageSpan.textContent = appState.currentPage;
    elements.totalPagesSpan.textContent = appState.totalPages;

    elements.prevPageBtn.disabled = appState.currentPage <= 1;
    elements.nextPageBtn.disabled = appState.currentPage >= appState.totalPages;
}

// 画像として保存
function saveAsImage() {
    const pdfCanvas = document.getElementById('pdfCanvas');
    const drawingCanvas = document.getElementById('drawingCanvas');
    if (!pdfCanvas || !drawingCanvas) return;

    // 一時的な結合キャンバスを作成
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pdfCanvas.width;
    tempCanvas.height = pdfCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // PDFと描画を結合
    tempCtx.drawImage(pdfCanvas, 0, 0);
    tempCtx.drawImage(drawingCanvas, 0, 0);

    // ダウンロード
    tempCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pdf-note-page${appState.currentPage}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// PDFとして保存（全ページ）
async function saveAsPDF() {
    if (!appState.totalPages || appState.rendering || appState.isDrawing || appState.exporting) return;
    appState.exporting = true;
    elements.savePdfBtn.disabled = true;
    try {
        saveCurrentAnnotations();
        // Snapshot before awaiting: export never changes the visible page or live notebook.
        const snapshot = captureNotebook();
        const { PDFDocument, degrees } = window.PDFLib;
        const pdf = snapshot.blankMode ? await PDFDocument.create() : await PDFDocument.load(snapshot.pdfData);
        for (let i = 0; i < snapshot.totalPages; i++) {
            const page = snapshot.blankMode ? pdf.addPage([841.5, 594.75]) : pdf.getPage(i);
            const strokes = snapshot.annotations[i + 1] || [];
            if (!strokes.length) continue;
            const box = page.getCropBox();
            const rotation = ((page.getRotation().angle % 360) + 360) % 360;
            const sideways = rotation === 90 || rotation === 270;
            const width = sideways ? box.height : box.width;
            const height = sideways ? box.width : box.height;
            const canvas = document.createElement('canvas');
            // Fixed resolution, independent of screen zoom; bound peak canvas memory.
            const factor = Math.min(2, 4096 / Math.max(width, height));
            canvas.width = Math.ceil(width * factor);
            canvas.height = Math.ceil(height * factor);
            Notebook.paint(canvas.getContext('2d'), strokes, canvas.width, canvas.height);
            const png = await pdf.embedPng(canvas.toDataURL('image/png'));
            const x = box.x + (rotation === 90 || rotation === 180 ? box.width : 0);
            const y = box.y + (rotation === 180 || rotation === 270 ? box.height : 0);
            page.drawImage(png, { x, y, width, height, rotate: degrees(rotation) });
            canvas.width = canvas.height = 0;
        }
        const bytes = await pdf.save();
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = snapshot.blankMode ? 'whiteboard-note.pdf' : 'pdf-note.pdf';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
        console.error(error);
        alert('PDF保存に失敗しました。暗号化されたPDFは非対応です。書き込みは保持されています。');
    } finally {
        appState.exporting = false;
        elements.savePdfBtn.disabled = false;
    }
}


// 白紙ノートを作成
async function createBlankCanvas() {
    if (appState.rendering || !await confirmReplaceNotebook()) return;
    console.log('白紙ノートを作成中...');
    
    // 白紙モードを有効化
    appState.blankMode = true;
    appState.pdfDoc = null;
    appState.pdfData = null;
    appState.annotations = {};
    appState.histories = {};
    appState.currentStrokes = [];
    appState.blankPages = [1]; // 最初のページ
    
    // A4サイズのキャンバスを作成（横向き：1122 x 793、96dpi）
    const width = 1122;
    const height = 793;
    
    // ページ情報を設定
    appState.currentPage = 1;
    appState.totalPages = 1;
    appState.scale = 1.0;
    
    // キャンバスを作成
    await renderBlankPage(width, height);
    
    // ページ情報を更新
    updatePageInfo();
    
    // ズーム情報を更新
    elements.zoomInfo.textContent = '100%';
    
    // ページ追加ボタンを表示
    elements.addPageBtn.style.display = 'flex';
    
    queueNotebookSave();
    console.log('✓ 白紙ノート作成完了:', width, 'x', height);
}

// 白紙ページをレンダリング
async function renderBlankPage(width, height) {
    // スケールを適用したサイズを計算
    const scaledWidth = Math.floor(width * appState.scale);
    const scaledHeight = Math.floor(height * appState.scale);
    
    // キャンバスを作成
    elements.canvasContainer.innerHTML = `
        <div class="canvas-wrapper" style="width: ${scaledWidth}px; height: ${scaledHeight}px;">
            <canvas id="pdfCanvas" width="${scaledWidth}" height="${scaledHeight}"></canvas>
            <canvas id="drawingCanvas" width="${scaledWidth}" height="${scaledHeight}"></canvas>
        </div>
    `;
    
    // 背景を白で塗りつぶす
    const pdfCanvas = document.getElementById('pdfCanvas');
    const pdfContext = pdfCanvas.getContext('2d');
    pdfContext.fillStyle = 'white';
    pdfContext.fillRect(0, 0, scaledWidth, scaledHeight);
    
    // 保存されている注釈を復元（イベントリスナー設定の前に）
    await restoreAnnotations();
    
    // 描画キャンバスを設定
    const drawingCanvas = document.getElementById('drawingCanvas');
    setupDrawingCanvas(drawingCanvas);
    
    console.log('✓ 白紙ページ表示:', {
        originalSize: `${width}x${height}`,
        scaledSize: `${scaledWidth}x${scaledHeight}`,
        scale: appState.scale
    });
}

// 白紙ページを追加
async function addBlankPage() {
    if (appState.rendering || appState.isDrawing) return;
    if (!appState.blankMode) return;
    
    // 現在の注釈を保存
    saveCurrentAnnotations();
    
    // 新しいページを追加
    appState.totalPages++;
    appState.blankPages.push(appState.totalPages);
    appState.currentPage = appState.totalPages;
    
    // 新しいページをレンダリング
    const width = 1122;
    const height = 793;
    await renderBlankPage(width, height);
    
    // ページ情報を更新
    updatePageInfo();
    
    queueNotebookSave();
    console.log('✓ ページを追加:', appState.currentPage, '/', appState.totalPages);
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('アプリケーション初期化開始');
    
    // PDF.jsの確認
    if (typeof pdfjsLib !== 'undefined') {
        console.log('PDF.js version:', pdfjsLib.version);
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    
    // 保存済みツールバーレイアウトを復元
    restoreToolbarLayout();
    
    // ペン専用モードのUIを初期化（デフォルトON）
    if (appState.penOnlyMode && elements.penModeBtn) {
        elements.penModeBtn.classList.add('active');
        elements.penModeBtn.innerHTML = '<i class="fas fa-pen"></i><span>ペン専用</span>';
        console.log('✓ ペン専用モード ON（デフォルト）');
    }
    
    // イベントリスナーのセットアップ
    setupEventListeners();
    restoreNotebook();
    
    console.log('アプリケーション初期化完了');
});
