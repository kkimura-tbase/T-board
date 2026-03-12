// T-fab Tile 連携機能

// T-fab Tile 設定の管理
const TfabIntegration = {
    // 初期化
    init() {
        this.checkUrlParams();
        this.setupAutoJoin();
        this.setupButtons();
        this.setupTeacherButton();
        this.showWelcomeNoticeIfNeeded(); // 初回利用者向け案内
    },

    // 教師用ボタンのセットアップ
    setupTeacherButton() {
        const headerRight = document.querySelector('.header-right');
        if (headerRight && !document.getElementById('teacherToolBtn')) {
            const btn = document.createElement('button');
            btn.id = 'teacherToolBtn';
            btn.className = 'btn btn-secondary';
            btn.title = '教師用：生徒配布URL生成';
            btn.innerHTML = '<i class="fas fa-chalkboard-teacher"></i> <span class="btn-text">教師用</span>';
            btn.addEventListener('click', () => {
                this.showTeacherTool();
            });
            
            // 最初に挿入
            headerRight.insertBefore(btn, headerRight.firstChild);
        }
    },

    // 教師用ツールを表示
    showTeacherTool() {
        const overlay = document.createElement('div');
        overlay.className = 'tfab-teacher-overlay';
        overlay.innerHTML = `
            <div class="tfab-teacher-dialog">
                <div class="dialog-header">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <h3>教師用：生徒配布 URL 生成</h3>
                </div>
                
                <div class="dialog-body">
                    <div class="teacher-instruction">
                        <p>📝 生徒に配布する URL を簡単に作成できます</p>
                    </div>
                    
                    <div class="room-input-section">
                        <label>教室名を入力してください：</label>
                        <input type="text" 
                               id="teacherRoomInput" 
                               placeholder="例: 【○○高校〇年】論理・表現Ⅱ"
                               autocomplete="off">
                        <p class="help-text">
                            <i class="fas fa-lightbulb"></i>
                            年度、科目名、学校名、学年などを含めると分かりやすいです
                        </p>
                    </div>
                    
                    <div class="url-output-section" id="urlOutputSection" style="display: none;">
                        <label>📎 生徒配布用 URL：</label>
                        <div class="url-display">
                            <input type="text" 
                                   id="generatedUrl" 
                                   readonly 
                                   class="generated-url">
                            <button class="btn-copy" onclick="TfabIntegration.copyUrl()">
                                <i class="fas fa-copy"></i> コピー
                            </button>
                        </div>
                        
                        <div class="qr-section">
                            <button class="btn-qr" onclick="TfabIntegration.showQR()">
                                <i class="fas fa-qrcode"></i> QR コード表示
                            </button>
                        </div>
                        
                        <div class="distribution-tips">
                            <h4>📨 配布方法の例：</h4>
                            <ul>
                                <li><i class="fas fa-school"></i> Google Classroom に投稿</li>
                                <li><i class="fas fa-envelope"></i> メールで送信</li>
                                <li><i class="fas fa-video"></i> Zoom チャットに貼り付け</li>
                                <li><i class="fas fa-mobile-alt"></i> QR コードをスクリーンに表示</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="dialog-footer">
                    <button class="btn-secondary" onclick="TfabIntegration.closeTeacherTool()">
                        閉じる
                    </button>
                    <button class="btn-primary" id="generateUrlBtn">
                        <i class="fas fa-link"></i> URL を生成
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const roomInput = document.getElementById('teacherRoomInput');
        roomInput.focus();
        
        // Enter キーで生成
        roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.generateUrl();
            }
        });
        
        // 入力時にリアルタイムで URL を更新
        roomInput.addEventListener('input', () => {
            if (roomInput.value.trim()) {
                this.generateUrl();
            }
        });
        
        // 生成ボタン
        document.getElementById('generateUrlBtn').addEventListener('click', () => {
            this.generateUrl();
        });
        
        // オーバーレイクリックで閉じる
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeTeacherTool();
            }
        });
    },

    // URL を生成
    generateUrl() {
        const roomInput = document.getElementById('teacherRoomInput');
        const roomName = roomInput.value.trim();
        
        if (!roomName) {
            alert('教室名を入力してください');
            roomInput.focus();
            return;
        }
        
        // URL を生成
        const baseUrl = window.location.origin + window.location.pathname;
        const generatedUrl = `${baseUrl}?tfab=${encodeURIComponent(roomName)}`;
        
        // URL を表示
        const urlOutput = document.getElementById('urlOutputSection');
        const urlInput = document.getElementById('generatedUrl');
        
        urlOutput.style.display = 'block';
        urlInput.value = generatedUrl;
        
        console.log('✓ 生徒配布用 URL を生成:', generatedUrl);
    },

    // URL をコピー
    copyUrl() {
        const urlInput = document.getElementById('generatedUrl');
        urlInput.select();
        
        try {
            document.execCommand('copy');
            this.showCopyNotification('URL をコピーしました！');
        } catch (err) {
            // モダンブラウザ用
            navigator.clipboard.writeText(urlInput.value).then(() => {
                this.showCopyNotification('URL をコピーしました！');
            }).catch(() => {
                alert('コピーに失敗しました。手動でコピーしてください。');
            });
        }
    },

    // QR コードを表示
    showQR() {
        const urlInput = document.getElementById('generatedUrl');
        const url = urlInput.value;
        
        // QR コード生成 API を使用（qr-server API）
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
        
        const qrOverlay = document.createElement('div');
        qrOverlay.className = 'qr-overlay';
        qrOverlay.innerHTML = `
            <div class="qr-dialog">
                <div class="dialog-header">
                    <i class="fas fa-qrcode"></i>
                    <h3>QR コード</h3>
                </div>
                <div class="qr-body">
                    <img src="${qrUrl}" alt="QR Code" crossorigin="anonymous">
                    <p>スマートフォンで読み取ってください</p>
                    <p class="qr-url">${this.escapeHtml(url)}</p>
                </div>
                <div class="dialog-footer">
                    <button class="btn-primary" onclick="this.closest('.qr-overlay').remove()">
                        閉じる
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(qrOverlay);
        
        // オーバーレイクリックで閉じる
        qrOverlay.addEventListener('click', (e) => {
            if (e.target === qrOverlay) {
                qrOverlay.remove();
            }
        });
    },

    // コピー通知
    showCopyNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    },

    // 教師用ツールを閉じる
    closeTeacherTool() {
        const overlay = document.querySelector('.tfab-teacher-overlay');
        if (overlay) {
            overlay.remove();
        }
    },

    // URL パラメータをチェック
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomName = urlParams.get('tfab');
        
        if (roomName) {
            const savedName = localStorage.getItem('studentName');
            const savedRoom = localStorage.getItem('tfabRoomName');
            
            // 教室名を保存
            localStorage.setItem('tfabRoomName', roomName);
            
            // 初回または教室が変わった場合
            if (!savedName || savedRoom !== roomName) {
                this.showSetupDialog(roomName);
            }
        }
    },

    // 初回セットアップダイアログを表示
    showSetupDialog(roomName) {
        const overlay = document.createElement('div');
        overlay.className = 'tfab-setup-overlay';
        overlay.innerHTML = `
            <div class="tfab-setup-dialog">
                <div class="dialog-header">
                    <i class="fas fa-video"></i>
                    <h3>モニタリング設定</h3>
                </div>
                
                <div class="dialog-body">
                    <p class="info-text">
                        この授業では画面モニタリングを使用します。
                    </p>
                    
                    <div class="room-info">
                        <label>📚 教室名：</label>
                        <strong>${this.escapeHtml(roomName)}</strong>
                    </div>
                    
                    <div class="name-input-section">
                        <label>👤 あなたの名前：</label>
                        <input type="text" 
                               id="studentNameInput" 
                               placeholder="例: 田中 太郎"
                               autocomplete="name"
                               required>
                        <p class="help-text">
                            <i class="fas fa-info-circle"></i>
                            教師にこの名前で表示されます
                        </p>
                    </div>
                    
                    <p class="auto-info">
                        ℹ️ 次回から自動的にモニタリング教室に参加します
                    </p>
                </div>
                
                <div class="dialog-footer">
                    <button class="btn-primary btn-large" id="joinTfabBtn">
                        <i class="fas fa-arrow-right"></i> 参加する
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Enter キーで送信
        const nameInput = document.getElementById('studentNameInput');
        nameInput.focus();
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinWithName(roomName);
            }
        });
        
        // ボタンクリック
        document.getElementById('joinTfabBtn').addEventListener('click', () => {
            this.joinWithName(roomName);
        });
    },

    // 名前を保存して T-fab Tile に参加
    joinWithName(roomName) {
        const nameInput = document.getElementById('studentNameInput');
        const studentName = nameInput.value.trim();
        
        if (!studentName) {
            alert('名前を入力してください');
            nameInput.focus();
            return;
        }
        
        // 設定を保存
        localStorage.setItem('studentName', studentName);
        localStorage.setItem('tfabRoomName', roomName);
        
        // T-fab Tile を開く
        this.openTfabTile(roomName, studentName);
        
        // ダイアログを閉じる
        const overlay = document.querySelector('.tfab-setup-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // UI を更新
        this.updateUI();
    },

    // T-fab Tile を開く
    openTfabTile(roomName, studentName) {
        const tfabUrl = `https://tile.tfabworks.com/student-top/?roomid=${encodeURIComponent(roomName)}&name=${encodeURIComponent(studentName)}`;
        
        // シンプルにウィンドウを開くだけ
        window.open(tfabUrl, '_blank', 'noopener,noreferrer');
        
        console.log('✓ T-fab Tile に参加:', roomName, '-', studentName);
        
        // 今回のセッションで参加済みとマーク
        sessionStorage.setItem('tfabJoinedThisSession', 'true');
        
        // バナーを削除
        const banner = document.getElementById('autoJoinBanner');
        if (banner) {
            banner.remove();
        }
    },

    // 自動参加
    setupAutoJoin() {
        const studentName = localStorage.getItem('studentName');
        const roomName = localStorage.getItem('tfabRoomName');
        
        // 今回のセッションで既に参加済みの場合はバナーを表示しない
        const alreadyJoined = sessionStorage.getItem('tfabJoinedThisSession');
        
        if (studentName && roomName && !alreadyJoined) {
            // ポップアップブロック対策：通知バナーを表示
            this.showAutoJoinBanner(roomName, studentName);
            
            // UI を更新
            this.updateUI();
        }
    },

    // 自動参加バナーを表示
    showAutoJoinBanner(roomName, studentName) {
        // 既にバナーがある場合は削除
        const existingBanner = document.getElementById('autoJoinBanner');
        if (existingBanner) {
            existingBanner.remove();
        }

        const banner = document.createElement('div');
        banner.id = 'autoJoinBanner';
        banner.className = 'auto-join-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <div class="banner-info">
                    <i class="fas fa-video"></i>
                    <span>モニタリング教室: ${this.escapeHtml(roomName)}</span>
                </div>
                <button class="banner-btn" id="autoJoinBtn">
                    <i class="fas fa-arrow-right"></i> 参加する
                </button>
                <button class="banner-close" id="bannerCloseBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // 参加ボタンのクリックイベント
        document.getElementById('autoJoinBtn').addEventListener('click', () => {
            this.openTfabTile(roomName, studentName);
            banner.remove();
        });
        
        // 閉じるボタンのクリックイベント
        document.getElementById('bannerCloseBtn').addEventListener('click', () => {
            sessionStorage.setItem('tfabJoinedThisSession', 'true');
            banner.remove();
        });
        
        // 3秒後に少し目立たせる
        setTimeout(() => {
            if (document.getElementById('autoJoinBanner')) {
                banner.classList.add('pulse');
            }
        }, 3000);
    },

    // ボタンのセットアップ
    setupButtons() {
        const studentName = localStorage.getItem('studentName');
        const roomName = localStorage.getItem('tfabRoomName');
        
        if (!studentName || !roomName) return;
        
        // ヘッダーにモニタリング参加ボタンを追加
        const headerRight = document.querySelector('.header-right');
        if (headerRight && !document.getElementById('manualJoinTfabBtn')) {
            const btn = document.createElement('button');
            btn.id = 'manualJoinTfabBtn';
            btn.className = 'btn btn-secondary';
            btn.title = 'T-fab Tile モニタリングに参加';
            btn.innerHTML = '<i class="fas fa-video"></i> <span class="btn-text">モニタリング</span>';
            btn.addEventListener('click', () => {
                this.openTfabTile(roomName, studentName);
            });
            
            // レイアウトボタンの前に挿入
            const layoutBtn = document.getElementById('toggleLayoutBtn');
            headerRight.insertBefore(btn, layoutBtn);
        }
        
        // 設定ボタンを追加
        if (headerRight && !document.getElementById('tfabSettingsBtn')) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'tfabSettingsBtn';
            settingsBtn.className = 'btn btn-secondary';
            settingsBtn.title = 'モニタリング設定';
            settingsBtn.innerHTML = '<i class="fas fa-cog"></i>';
            settingsBtn.addEventListener('click', () => {
                this.showSettingsDialog();
            });
            
            const layoutBtn = document.getElementById('toggleLayoutBtn');
            headerRight.insertBefore(settingsBtn, layoutBtn);
        }
    },

    // UI を更新（生徒名表示）
    updateUI() {
        const studentName = localStorage.getItem('studentName');
        
        if (studentName) {
            const headerLeft = document.querySelector('.header-left');
            if (headerLeft && !document.getElementById('studentNameBadge')) {
                const badge = document.createElement('span');
                badge.id = 'studentNameBadge';
                badge.className = 'student-name-badge';
                badge.innerHTML = `<i class="fas fa-user"></i> <span>${this.escapeHtml(studentName)}</span>`;
                headerLeft.appendChild(badge);
            }
        }
    },

    // 設定ダイアログを表示
    showSettingsDialog() {
        const studentName = localStorage.getItem('studentName') || '';
        const roomName = localStorage.getItem('tfabRoomName') || '';
        
        const overlay = document.createElement('div');
        overlay.className = 'tfab-settings-overlay';
        overlay.innerHTML = `
            <div class="tfab-settings-dialog">
                <div class="dialog-header">
                    <i class="fas fa-cog"></i>
                    <h3>モニタリング設定</h3>
                </div>
                
                <div class="dialog-body">
                    <div class="setting-item">
                        <label>📚 教室名：</label>
                        <div class="setting-value">${this.escapeHtml(roomName)}</div>
                    </div>
                    
                    <div class="setting-item">
                        <label>👤 あなたの名前：</label>
                        <input type="text" 
                               id="settingStudentName" 
                               value="${this.escapeHtml(studentName)}"
                               class="setting-input">
                        <p class="help-text">
                            名前を変更すると、次回参加時から反映されます
                        </p>
                    </div>
                    
                    <div class="setting-item info-box">
                        <i class="fas fa-info-circle"></i>
                        <p>モニタリングは常に有効です</p>
                    </div>
                    
                    <div class="setting-item danger-zone">
                        <button class="btn-danger" id="resetTfabBtn">
                            <i class="fas fa-trash"></i> 設定をリセット
                        </button>
                        <p class="help-text">
                            設定をリセットすると、次回起動時に再度名前の入力が必要です
                        </p>
                    </div>
                </div>
                
                <div class="dialog-footer">
                    <button class="btn-secondary" id="closeSettingsBtn">
                        キャンセル
                    </button>
                    <button class="btn-primary" id="saveSettingsBtn">
                        <i class="fas fa-save"></i> 保存
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // イベントリスナー
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            overlay.remove();
        });
        
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const newName = document.getElementById('settingStudentName').value.trim();
            if (newName) {
                localStorage.setItem('studentName', newName);
                // 生徒名バッジを更新
                const badge = document.querySelector('#studentNameBadge span');
                if (badge) {
                    badge.textContent = newName;
                }
                alert('設定を保存しました');
                overlay.remove();
            } else {
                alert('名前を入力してください');
            }
        });
        
        document.getElementById('resetTfabBtn').addEventListener('click', () => {
            if (confirm('モニタリング設定をリセットしますか？\n次回起動時に再度名前の入力が必要です。')) {
                localStorage.removeItem('studentName');
                localStorage.removeItem('tfabRoomName');
                alert('設定をリセットしました');
                overlay.remove();
                location.reload();
            }
        });
        
        // オーバーレイクリックで閉じる
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    },

    // ポップアップブロック通知
    showPopupBlockedNotice() {
        // 既に通知がある場合は表示しない
        if (document.querySelector('.popup-blocked-notice')) {
            return;
        }
        
        const notice = document.createElement('div');
        notice.className = 'popup-blocked-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>ポップアップがブロックされました</span>
                <button onclick="TfabIntegration.retryOpen()">
                    もう一度開く
                </button>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(notice);
        
        // 10秒後に自動的に削除
        setTimeout(() => {
            if (notice.parentElement) {
                notice.remove();
            }
        }, 10000);
    },

    // 再試行
    retryOpen() {
        const roomName = localStorage.getItem('tfabRoomName');
        const studentName = localStorage.getItem('studentName');
        if (roomName && studentName) {
            this.openTfabTile(roomName, studentName);
        }
        const notice = document.querySelector('.popup-blocked-notice');
        if (notice) notice.remove();
    },

    // 初回利用者向け案内を表示
    showWelcomeNoticeIfNeeded() {
        const studentName = localStorage.getItem('studentName');
        const roomName = localStorage.getItem('tfabRoomName');
        
        // 既に設定済みの場合は表示しない
        if (studentName && roomName) {
            return;
        }
        
        // URLパラメータがある場合は表示しない（セットアップダイアログが出るため）
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tfab')) {
            return;
        }
        
        // 「次回から表示しない」が設定されている場合は表示しない
        const dontShowAgain = localStorage.getItem('welcomeNoticeDismissed');
        if (dontShowAgain === 'true') {
            return;
        }
        
        // 案内バナーを表示
        const notice = document.createElement('div');
        notice.className = 'welcome-notice';
        notice.innerHTML = `
            <div class="welcome-content">
                <div class="welcome-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="welcome-text">
                    <h4>📘 生徒の皆さんへ</h4>
                    <p>初回起動時は、<strong>教師から配布された専用URL</strong>からアクセスしてください。</p>
                    <p class="welcome-sub">専用URLには教室情報が含まれており、モニタリング機能を使用するために必要です。</p>
                    <div class="welcome-checkbox">
                        <label>
                            <input type="checkbox" id="dontShowWelcome">
                            <span>次回から表示しない</span>
                        </label>
                    </div>
                </div>
                <button class="welcome-close" id="closeWelcomeBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notice);
        
        // 閉じるボタンのイベント
        document.getElementById('closeWelcomeBtn').addEventListener('click', () => {
            const checkbox = document.getElementById('dontShowWelcome');
            if (checkbox.checked) {
                localStorage.setItem('welcomeNoticeDismissed', 'true');
            }
            notice.remove();
        });
        
        // 20秒後に自動的にフェードアウト（チェックボックスがONなら記憶）
        setTimeout(() => {
            if (notice.parentElement) {
                const checkbox = document.getElementById('dontShowWelcome');
                if (checkbox && checkbox.checked) {
                    localStorage.setItem('welcomeNoticeDismissed', 'true');
                }
                notice.classList.add('fade-out');
                setTimeout(() => notice.remove(), 500);
            }
        }, 20000);
    },

    // HTML エスケープ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    TfabIntegration.init();
});
