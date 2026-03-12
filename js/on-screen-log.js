// 画面上にログを表示する簡易デバッグツール
// デバッグが必要な場合のみ有効化される
(function() {
    // デバッグモードが無効の場合は何もしない
    if (!window.enableDebugLog) {
        return;
    }
    
    // ログコンテナを作成
    const logContainer = document.createElement('div');
    logContainer.id = 'onScreenLog';
    logContainer.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 10px;
        width: calc(100% - 20px);
        max-width: 600px;
        max-height: 300px;
        background: rgba(0, 0, 0, 0.95);
        color: #0f0;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        padding: 10px;
        border-radius: 8px;
        overflow-y: auto;
        z-index: 99999;
        border: 2px solid #0f0;
        box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
        display: none;
    `;
    
    // ログ内容
    const logContent = document.createElement('div');
    logContent.id = 'logContent';
    logContainer.appendChild(logContent);
    
    // トグルボタン
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '📊 ログ';
    toggleBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        z-index: 100000;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
    `;
    
    // ストロークカウンター（常に表示）
    const strokeCounter = document.createElement('div');
    strokeCounter.id = 'strokeCounter';
    strokeCounter.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: #0f0;
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        padding: 15px 25px;
        border-radius: 12px;
        z-index: 99999;
        border: 2px solid #0f0;
        box-shadow: 0 4px 20px rgba(0, 255, 0, 0.5);
    `;
    strokeCounter.innerHTML = '✏️ ストローク: 0<br>📊 合計: 0';
    document.body.appendChild(strokeCounter);
    
    // グローバルにカウンターを更新する関数を公開
    window.updateStrokeCounter = function(strokeNum, totalPoints) {
        strokeCounter.innerHTML = `✏️ ストローク: ${strokeNum}<br>📊 合計: ${totalPoints}`;
    };
    
    toggleBtn.addEventListener('click', () => {
        if (logContainer.style.display === 'none') {
            logContainer.style.display = 'block';
            toggleBtn.textContent = '❌ 閉じる';
        } else {
            logContainer.style.display = 'none';
            toggleBtn.textContent = '📊 ログ';
        }
    });
    
    // クリアボタン
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ クリア';
    clearBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 100px;
        background: #dc2626;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        z-index: 100000;
        box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
        transition: all 0.3s ease;
    `;
    
    clearBtn.addEventListener('click', () => {
        logContent.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">ログがクリアされました</div>';
        window.logHistory = []; // ログ履歴もクリア
    });
    
    // コピーボタン
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 コピー';
    copyBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 210px;
        background: #10b981;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        z-index: 100000;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        transition: all 0.3s ease;
    `;
    
    copyBtn.addEventListener('click', async () => {
        const logText = (window.logHistory || []).join('\n');
        
        try {
            // クリップボードAPIを使用
            await navigator.clipboard.writeText(logText);
            
            // フィードバック表示
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ コピー完了！';
            copyBtn.style.background = '#3b82f6';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '#10b981';
            }, 2000);
        } catch (err) {
            // フォールバック：テキストエリアを使った古い方法
            const textarea = document.createElement('textarea');
            textarea.value = logText;
            textarea.style.cssText = 'position: fixed; top: -9999px; left: -9999px;';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                copyBtn.textContent = '✅ コピー完了！';
                copyBtn.style.background = '#3b82f6';
                
                setTimeout(() => {
                    copyBtn.textContent = '📋 コピー';
                    copyBtn.style.background = '#10b981';
                }, 2000);
            } catch (e) {
                copyBtn.textContent = '❌ エラー';
                setTimeout(() => {
                    copyBtn.textContent = '📋 コピー';
                }, 2000);
            }
            
            document.body.removeChild(textarea);
        }
    });
    
    document.body.appendChild(logContainer);
    document.body.appendChild(toggleBtn);
    document.body.appendChild(clearBtn);
    document.body.appendChild(copyBtn);
    
    // console.log を上書き
    const originalLog = console.log;
    const maxLogs = 100;
    let logCount = 0;
    
    // ログ履歴を保存（コピー用）
    window.logHistory = [];
    
    console.log = function(...args) {
        originalLog.apply(console, args);
        
        logCount++;
        const logLine = document.createElement('div');
        logLine.style.cssText = 'margin-bottom: 3px; border-bottom: 1px solid #333; padding-bottom: 3px;';
        
        const timestamp = new Date().toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });
        
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg);
            }
            return String(arg);
        }).join(' ');
        
        // ログ履歴に追加（プレーンテキスト）
        const plainText = `[${timestamp}] ${message}`;
        window.logHistory.unshift(plainText);
        
        // 古いログを削除
        if (window.logHistory.length > maxLogs) {
            window.logHistory.pop();
        }
        
        // 色分け
        let color = '#0f0';
        if (message.includes('🔵')) color = '#3b82f6';
        if (message.includes('✏️')) color = '#fbbf24';
        if (message.includes('✅')) color = '#10b981';
        if (message.includes('❌')) color = '#ef4444';
        if (message.includes('⚠️')) color = '#f59e0b';
        
        logLine.innerHTML = `<span style="color: #666;">[${timestamp}]</span> <span style="color: ${color};">${message}</span>`;
        
        logContent.insertBefore(logLine, logContent.firstChild);
        
        // 古いログを削除
        while (logContent.children.length > maxLogs) {
            logContent.removeChild(logContent.lastChild);
        }
    };
    
    console.log('📊 画面上ログシステム起動');
})();
