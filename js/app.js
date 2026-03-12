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
    drawingHistory: [],
    historyStep: -1,
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

    try {
        // ローディング表示
        elements.canvasContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> 読み込み中...</div>';

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
        appState.pdfData = new Uint8Array(arrayBuffer);
        
        // PDFドキュメントの読み込み
        console.log('PDFドキュメントを読み込み中...');
        const loadingTask = pdfjsLib.getDocument({
            data: appState.pdfData,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            verbosity: 0
        });
        
        appState.pdfDoc = await loadingTask.promise;
        appState.totalPages = appState.pdfDoc.numPages;
        appState.currentPage = 1;
        appState.annotations = {};
        appState.blankMode = false; // PDFモードに切り替え
        appState.blankPages = [];

        console.log('✓ PDF読み込み成功:', appState.totalPages, 'ページ');

        // ページ追加ボタンを非表示
        elements.addPageBtn.style.display = 'none';

        // PDFを表示
        await renderPage(appState.currentPage);
        updatePageInfo();
    } catch (error) {
        console.error('❌ PDFの読み込みエラー:', error);
        console.error('エラー詳細:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = error.message || '不明なエラー';
        let suggestions = [];
        
        if (errorMessage.includes('Invalid PDF')) {
            suggestions.push('このファイルは有効なPDFファイルではない可能性があります。');
            suggestions.push('別のPDFファイルをお試しください。');
        } else if (errorMessage.includes('password')) {
            suggestions.push('このPDFはパスワード保護されています。');
            suggestions.push('パスワードのないPDFファイルをご使用ください。');
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            suggestions.push('ネットワークエラーが発生しました。');
            suggestions.push('インターネット接続を確認してください。');
        } else {
            suggestions.push('別のPDFファイルをお試しください。');
            suggestions.push('ブラウザを再読み込みしてください。');
        }
        
        elements.canvasContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
                <h2>PDFの読み込みに失敗しました</h2>
                <p style="color: #666; margin: 1rem 0;"><strong>エラー:</strong> ${errorMessage}</p>
                <div style="text-align: left; max-width: 500px; margin: 1rem auto;">
                    ${suggestions.map(s => `<p style="color: #666; margin: 0.5rem 0;">• ${s}</p>`).join('')}
                </div>
                <button class="btn btn-primary" onclick="document.getElementById('pdfInput').click()" style="margin-top: 1rem;">
                    <i class="fas fa-upload"></i> 別のPDFを選択
                </button>
            </div>
        `;
    }
}

// ページのレンダリング（オフスクリーンバッファリング対応）
async function renderPage(pageNum) {
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

        // 描画内容を復元（オフスクリーンに）- 座標ベース
        const savedStrokes = appState.annotations[pageNum];
        if (savedStrokes && savedStrokes.length > 0) {
            console.log(`✓ 注釈を復元中: ${savedStrokes.length} ストローク`);
            
            savedStrokes.forEach(stroke => {
                // 正規化座標を実座標に変換
                const startX = stroke.startX * viewport.width;
                const startY = stroke.startY * viewport.height;
                const endX = stroke.endX * viewport.width;
                const endY = stroke.endY * viewport.height;
                
                offscreenDrawingContext.beginPath();
                offscreenDrawingContext.moveTo(startX, startY);
                offscreenDrawingContext.lineTo(endX, endY);
                
                if (stroke.tool === 'eraser') {
                    offscreenDrawingContext.globalCompositeOperation = 'destination-out';
                    offscreenDrawingContext.lineWidth = stroke.thickness * 3;
                } else {
                    offscreenDrawingContext.globalCompositeOperation = 'source-over';
                    offscreenDrawingContext.strokeStyle = stroke.color;
                    offscreenDrawingContext.lineWidth = stroke.thickness;
                    offscreenDrawingContext.globalAlpha = stroke.alpha;
                }
                
                offscreenDrawingContext.lineCap = 'round';
                offscreenDrawingContext.lineJoin = 'round';
                offscreenDrawingContext.stroke();
                offscreenDrawingContext.globalAlpha = 1.0;
                offscreenDrawingContext.globalCompositeOperation = 'source-over';
            });
            
            console.log('✓ 注釈復元完了');
        }
        
        // 現在のページのストロークを復元
        appState.currentStrokes = savedStrokes ? [...savedStrokes] : [];
        
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
            thickness: appState.thickness,
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
    canvas.addEventListener('pointerleave', stopDrawing, { passive: false });
    canvas.addEventListener('pointercancel', stopDrawing, { passive: false });

    // タッチイベントを追加（ピンチズーム用）
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    function startDrawing(e) {
        // デフォルト動作を防止（iPad Safari のジェスチャー認識を無効化）
        e.preventDefault();
        
        // ペン専用モードの場合、ペン以外を処理
        if (appState.penOnlyMode) {
            // Apple Pencil の判定を改善
            // - pointerType が 'pen' である
            // - または pressure が 0 より大きい（Apple Pencil の特徴）
            const isPenInput = e.pointerType === 'pen' || (e.pressure && e.pressure > 0);
            
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
        
        // 最初の描画の場合、現在の空の状態を履歴に保存
        if (appState.drawingHistory.length === 0) {
            const currentState = canvas.toDataURL();
            appState.drawingHistory.push(currentState);
            appState.historyStep = 0;
        }
        
        appState.isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        appState.lastX = e.clientX - rect.left;
        appState.lastY = e.clientY - rect.top;

        // 履歴の分岐処理（やり直しの途中で新しい描画を開始した場合）
        if (appState.historyStep < appState.drawingHistory.length - 1) {
            appState.drawingHistory = appState.drawingHistory.slice(0, appState.historyStep + 1);
        }
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
        
        if (!appState.isDrawing) return;
        
        // ペン専用モードの場合、ペン以外を無視
        if (appState.penOnlyMode) {
            // Apple Pencil の判定を改善
            const isPenInput = e.pointerType === 'pen' || (e.pressure && e.pressure > 0);
            if (!isPenInput) {
                return;
            }
        }

        const rect = canvas.getBoundingClientRect();
        
        // Coalesced Events を取得（間引かれたイベントも含む）
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        
        // すべてのイベントを描画
        for (const event of events) {
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            drawPoint({ x, y });
        }
    }

    function stopDrawing(e) {
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
        if (e.touches.length === 1) {
            // 単一タッチ（Apple Pencil または指）
            const touch = e.touches[0];
            
            // Apple Pencil の判定：force > 0 または touchType === 'stylus'
            const isApplePencil = touch.force > 0 || touch.touchType === 'stylus';
            
            if (isApplePencil || !appState.penOnlyMode) {
                // Apple Pencil または ペン専用モードOFF の場合、描画開始
                // pointerdown の代わりに touchstart で startDrawing を呼ぶ
                const syntheticEvent = {
                    preventDefault: () => e.preventDefault(),
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    pointerType: isApplePencil ? 'pen' : 'touch',
                    pressure: touch.force || 0,
                    pointerId: touch.identifier
                };
                
                console.log('🟢 touchstart から startDrawing 呼び出し:', syntheticEvent.pointerType, 'force:', touch.force);
                startDrawing(syntheticEvent);
                return;
            }
        }
        
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
            appState.pinchZoom.centerX = relativeX;  // コンテナ内相対位置
            appState.pinchZoom.centerY = relativeY;
            
            // パン初期化
            appState.pan.active = true;
            appState.pan.startX = centerX;
            appState.pan.startY = centerY;
            appState.pan.scrollLeft = container.scrollLeft;
            appState.pan.scrollTop = container.scrollTop;
            
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
        if (e.touches.length === 1) {
            // 単一タッチ（Apple Pencil または指）
            const touch = e.touches[0];
            const isApplePencil = touch.force > 0 || touch.touchType === 'stylus';
            
            if (isApplePencil || !appState.penOnlyMode) {
                // 描画中なら draw を呼ぶ
                const syntheticEvent = {
                    preventDefault: () => e.preventDefault(),
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    pointerType: isApplePencil ? 'pen' : 'touch',
                    pressure: touch.force || 0,
                    pointerId: touch.identifier
                };
                
                draw(syntheticEvent);
                return;
            }
        }
        
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
        // 単一タッチ終了（Apple Pencil または指）
        if (e.changedTouches.length === 1 && e.touches.length === 0) {
            const touch = e.changedTouches[0];
            const isApplePencil = touch.force > 0 || touch.touchType === 'stylus';
            
            if (isApplePencil || !appState.penOnlyMode) {
                const syntheticEvent = {
                    preventDefault: () => e.preventDefault(),
                    type: 'pointerup',
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    pointerType: isApplePencil ? 'pen' : 'touch',
                    pressure: touch.force || 0,
                    pointerId: touch.identifier
                };
                
                stopDrawing(syntheticEvent);
            }
        }
        
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
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;

    const imageData = canvas.toDataURL();
    appState.drawingHistory.push(imageData);
    appState.historyStep++;

    // 履歴は最大50ステップまで
    if (appState.drawingHistory.length > 50) {
        appState.drawingHistory.shift();
        appState.historyStep--;
    }
}

// 現在のページの注釈を保存（座標ベース）
function saveCurrentAnnotations() {
    if (appState.currentStrokes && appState.currentStrokes.length > 0) {
        appState.annotations[appState.currentPage] = [...appState.currentStrokes];
        console.log('💾 注釈を保存:', appState.currentPage, 'ページ', `(${appState.currentStrokes.length} ストローク)`);
    }
}

// 注釈を復元
async function restoreAnnotations() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (appState.annotations[appState.currentPage]) {
        // 注釈がある場合は画像を復元
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                // キャンバスサイズに合わせて画像をスケーリング
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // 履歴を復元された注釈で初期化
                const restoredState = canvas.toDataURL();
                appState.drawingHistory = [restoredState];
                appState.historyStep = 0;
                console.log('✓ 注釈を復元:', appState.currentPage, 'ページ', `(${canvas.width}x${canvas.height})`);
                resolve();
            };
            img.onerror = function() {
                console.error('注釈画像の読み込みに失敗');
                appState.drawingHistory = [];
                appState.historyStep = -1;
                resolve();
            };
            img.src = appState.annotations[appState.currentPage];
        });
    } else {
        // 注釈がない場合は空の状態
        appState.drawingHistory = [];
        appState.historyStep = -1;
        console.log('注釈なし:', appState.currentPage, 'ページ（空白）');
    }
}

// 元に戻す
function undo() {
    if (appState.historyStep > 0) {
        appState.historyStep--;
        restoreFromHistory();
    }
}

// やり直し
function redo() {
    if (appState.historyStep < appState.drawingHistory.length - 1) {
        appState.historyStep++;
        restoreFromHistory();
    }
}

// 履歴から復元
function restoreFromHistory() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (appState.historyStep >= 0 && appState.drawingHistory[appState.historyStep]) {
        const img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
        };
        img.src = appState.drawingHistory[appState.historyStep];
    }
}

// キャンバスをクリア
function clearCanvas() {
    if (!confirm('このページの書き込みを全て消去しますか？')) return;

    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 履歴をリセット
    appState.drawingHistory = [];
    appState.historyStep = -1;
    delete appState.annotations[appState.currentPage];
    saveDrawingState();
}

// ページ変更
async function changePage(delta) {
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
    const pdfCanvas = document.getElementById('pdfCanvas');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
    if (!pdfCanvas || !drawingCanvas) {
        alert('キャンバスが見つかりません。');
        return;
    }
    
    // jsPDFが読み込まれているか確認
    if (typeof window.jspdf === 'undefined') {
        alert('PDF生成ライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
        return;
    }
    
    try {
        console.log('PDF生成を開始...');
        
        // 現在のページの注釈を保存
        saveCurrentAnnotations();
        
        // 元のページを記憶
        const originalPage = appState.currentPage;
        
        const { jsPDF } = window.jspdf;
        
        let pdf = null;
        let isFirstPage = true;
        
        // 全ページをループ
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            console.log(`ページ ${pageNum}/${appState.totalPages} を処理中...`);
            
            // ページを切り替え（表示を更新）
            if (pageNum !== appState.currentPage) {
                // ページ番号を変更する前に現在のページの注釈を保存
                saveCurrentAnnotations();
                
                appState.currentPage = pageNum;
                if (appState.blankMode) {
                    await renderBlankPage(1122, 793);
                } else {
                    await renderPage(pageNum);
                }
                // レンダリングを待つ（注釈の復元も含む）
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // キャンバスを取得（レンダリング後）
            const currentPdfCanvas = document.getElementById('pdfCanvas');
            const currentDrawingCanvas = document.getElementById('drawingCanvas');
            
            if (!currentPdfCanvas || !currentDrawingCanvas) continue;
            
            const canvasWidth = currentPdfCanvas.width;
            const canvasHeight = currentPdfCanvas.height;
            
            console.log(`キャンバスサイズ: ${canvasWidth} x ${canvasHeight}`);
            
            // 最初のページでPDFのサイズと向きを決定
            if (isFirstPage) {
                const orientation = canvasWidth > canvasHeight ? 'landscape' : 'portrait';
                pdf = new jsPDF({
                    orientation: orientation,
                    unit: 'px',
                    format: [canvasWidth, canvasHeight]
                });
                console.log(`PDF作成: ${orientation}, ${canvasWidth}x${canvasHeight}`);
            }
            
            // 一時的な結合キャンバスを作成
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasWidth;
            tempCanvas.height = canvasHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // PDFと描画を結合
            tempCtx.drawImage(currentPdfCanvas, 0, 0);
            tempCtx.drawImage(currentDrawingCanvas, 0, 0);
            
            // 画像データを取得
            const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
            
            // 最初のページ以外は新しいページを追加
            if (!isFirstPage) {
                pdf.addPage([canvasWidth, canvasHeight]);
            }
            isFirstPage = false;
            
            // 画像をPDFに追加
            pdf.addImage(imgData, 'JPEG', 0, 0, canvasWidth, canvasHeight);
        }
        
        // PDFを保存
        const fileName = appState.blankMode ? 'whiteboard-note.pdf' : 'pdf-note.pdf';
        pdf.save(fileName);
        
        console.log('✓ PDF保存完了:', fileName);
        
        // 元のページに戻る
        if (appState.currentPage !== originalPage) {
            appState.currentPage = originalPage;
            if (appState.blankMode) {
                renderBlankPage(1122, 793);
            } else {
                await renderPage(originalPage);
            }
            updatePageInfo();
        }
        
        alert('PDFファイルを保存しました！');
        
    } catch (error) {
        console.error('PDF生成エラー:', error);
        alert('PDF生成に失敗しました: ' + error.message);
    }
}

// 白紙ノートを作成
async function createBlankCanvas() {
    console.log('白紙ノートを作成中...');
    
    // 白紙モードを有効化
    appState.blankMode = true;
    appState.pdfDoc = null;
    appState.pdfData = null;
    appState.annotations = {};
    appState.drawingHistory = [];
    appState.historyStep = -1;
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
    
    console.log('アプリケーション初期化完了');
});
