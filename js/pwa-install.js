// PWA インストール機能

const PWAInstall = {
    deferredPrompt: null,
    isInitialized: false,
    
    init() {
        if (this.isInitialized) {
            console.log('⚠️ PWA Install: 既に初期化済み');
            return;
        }
        
        console.log('🚀 PWA Install: 初期化開始');
        this.isInitialized = true;
        
        // インストール可能イベントをキャプチャ
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 PWA: インストール可能（beforeinstallprompt発火）');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });
        
        // インストール完了イベント
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA: インストール完了');
            this.deferredPrompt = null;
            this.hideInstallButton();
        });
        
        // iOS Safari の検出
        this.checkiOS();
        
        console.log('🚀 PWA Install: 初期化完了');
    },
    
    // インストールボタンを表示
    showInstallButton() {
        console.log('🎯 PWA: showInstallButton() 実行開始');
        
        const headerRight = document.querySelector('.header-right');
        console.log('📍 headerRight 要素:', headerRight);
        
        if (!headerRight) {
            console.error('❌ PWA: .header-right が見つかりません');
            return;
        }
        
        if (document.getElementById('pwaInstallBtn')) {
            console.log('⚠️ PWA: インストールボタンは既に存在します');
            return;
        }
        
        const btn = document.createElement('button');
        btn.id = 'pwaInstallBtn';
        btn.className = 'btn btn-secondary pwa-install-btn';
        btn.title = 'ホーム画面に追加';
        btn.innerHTML = '<i class="fas fa-download"></i> <span class="btn-text">インストール</span>';
        btn.addEventListener('click', () => this.promptInstall());
        
        // 教師用ボタンの後に挿入
        const teacherBtn = document.getElementById('teacherToolBtn');
        console.log('📍 teacherToolBtn 要素:', teacherBtn);
        
        if (teacherBtn && teacherBtn.nextSibling) {
            headerRight.insertBefore(btn, teacherBtn.nextSibling);
            console.log('✅ PWA: インストールボタンを教師用ボタンの後に挿入しました');
        } else {
            headerRight.insertBefore(btn, headerRight.firstChild);
            console.log('✅ PWA: インストールボタンをヘッダーの先頭に挿入しました');
        }
        
        console.log('🎯 PWA: showInstallButton() 実行完了');
    },
    
    // インストールボタンを非表示
    hideInstallButton() {
        const btn = document.getElementById('pwaInstallBtn');
        if (btn) btn.remove();
    },
    
    // インストールプロンプトを表示
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('❌ PWA: インストールプロンプトが利用できません');
            return;
        }
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        console.log(`📱 PWA: ユーザーの選択 = ${outcome}`);
        
        if (outcome === 'accepted') {
            console.log('✅ PWA: インストール承認');
        } else {
            console.log('❌ PWA: インストール拒否');
        }
        
        this.deferredPrompt = null;
        this.hideInstallButton();
    },
    
    // iOS Safari の検出と案内
    checkiOS() {
        // iPad OS 13+ は MacOS を装うため、より確実な検出が必要
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // iPadOS 13+ の検出（タッチスクリーンを持つ Mac として認識される）
        const isIPadOS = navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform);
        
        const isStandalone = window.navigator.standalone === true;
        
        console.log('🔍 PWA: デバイス検出', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            maxTouchPoints: navigator.maxTouchPoints,
            isIOS: isIOS,
            isIPadOS: isIPadOS,
            isIOSorIPadOS: isIOS || isIPadOS,
            isStandalone: isStandalone,
            standalone: window.navigator.standalone
        });
        
        // 既にホーム画面から起動されている場合は何もしない
        if (isStandalone) {
            console.log('✅ PWA: スタンドアロンモードで実行中');
            return;
        }
        
        if (isIOS || isIPadOS) {
            console.log('📱 iOS/iPadOS Safari を検出: 手動インストール案内を準備');
            console.log('🎯 showiOSInstallButton() を呼び出します...');
            this.showiOSInstallButton();
        } else {
            console.log('💻 非iOS環境: beforeinstallprompt イベントを待機中');
        }
    },
    
    // iOS 用インストールボタンを表示
    showiOSInstallButton() {
        console.log('📱 showiOSInstallButton() 実行開始');
        
        const headerRight = document.querySelector('.header-right');
        console.log('📍 headerRight 要素:', headerRight);
        
        if (!headerRight) {
            console.error('❌ iOS: .header-right が見つかりません');
            alert('エラー: .header-right が見つかりません');
            return;
        }
        
        if (document.getElementById('iosInstallBtn')) {
            console.log('⚠️ iOS: インストールボタンは既に存在します');
            return;
        }
        
        const btn = document.createElement('button');
        btn.id = 'iosInstallBtn';
        btn.className = 'btn btn-secondary ios-install-btn';
        btn.title = 'ホーム画面に追加';
        btn.innerHTML = '<i class="fas fa-plus-square"></i> <span class="btn-text">追加方法</span>';
        btn.addEventListener('click', () => this.showiOSInstructions());
        
        // 教師用ボタンの後に挿入
        const teacherBtn = document.getElementById('teacherToolBtn');
        console.log('📍 teacherToolBtn 要素:', teacherBtn);
        
        if (teacherBtn && teacherBtn.nextSibling) {
            headerRight.insertBefore(btn, teacherBtn.nextSibling);
            console.log('✅ iOS: インストールボタンを教師用ボタンの後に挿入しました');
        } else {
            headerRight.insertBefore(btn, headerRight.firstChild);
            console.log('✅ iOS: インストールボタンをヘッダーの先頭に挿入しました');
        }
        
        console.log('📱 showiOSInstallButton() 実行完了');
        
        // 確認用アラート（デバッグ後に削除）
        console.log('🎯 iOS ボタン追加完了 - ページを確認してください');
    },
    
    // iOS 用インストール手順を表示
    showiOSInstructions() {
        const overlay = document.createElement('div');
        overlay.className = 'pwa-ios-overlay';
        overlay.innerHTML = `
            <div class="pwa-ios-dialog">
                <div class="dialog-header">
                    <i class="fab fa-apple"></i>
                    <h3>ホーム画面に追加</h3>
                </div>
                
                <div class="dialog-body">
                    <div class="ios-instructions">
                        <div class="instruction-step">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <p>画面下部（または上部）の<strong>共有ボタン</strong>をタップ</p>
                                <div class="icon-example">
                                    <i class="fas fa-share"></i>
                                    <span>または</span>
                                    <i class="fas fa-arrow-up-from-bracket"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="instruction-step">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <p><strong>「ホーム画面に追加」</strong>を選択</p>
                                <div class="icon-example">
                                    <i class="fas fa-plus-square"></i>
                                </div>
                            </div>
                        </div>
                        
                        <div class="instruction-step">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <p>画面右上の<strong>「追加」</strong>をタップ</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ios-note">
                        <i class="fas fa-lightbulb"></i>
                        <p>ホーム画面に T-Board のアイコンが追加され、アプリのように使えます。</p>
                    </div>
                </div>
                
                <div class="dialog-footer">
                    <button class="btn-primary" onclick="this.closest('.pwa-ios-overlay').remove()">
                        閉じる
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // オーバーレイクリックで閉じる
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded: PWA Install の初期化をスケジュール');
    
    // T-fab Integration の初期化を待ってから実行
    // すぐに初期化を開始（beforeinstallprompt イベントを逃さないため）
    PWAInstall.init();
});

// beforeinstallprompt イベントを逃さないよう、即座にリスナーを登録
if (document.readyState === 'loading') {
    console.log('📄 Document loading: PWA Install を即座に初期化');
    PWAInstall.init();
}
