document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素の取得 ---
    // 長文分割機能
    const longTextElement = document.getElementById('long-text');
    const maxLengthElement = document.getElementById('max-length');
    const divideButton = document.getElementById('divide-btn');
    const resultCardsElement = document.getElementById('result-cards');
    const clearTextButton = document.getElementById('clear-text-btn');

    // 定型文管理機能
    const templateNameElement = document.getElementById('template-name');
    const saveTemplateButton = document.getElementById('save-template-btn');
    const templateListElement = document.getElementById('template-list');

    // タブUI
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');


    // --- イベントリスナーの設定 ---

    /**
     * 「一括削除」ボタンのクリック処理
     */
    clearTextButton.addEventListener('click', () => {
        if (confirm('本当に入力中のテキストをすべて削除しますか？')) {
            longTextElement.value = '';
            resultCardsElement.innerHTML = ''; // 分割結果もクリア
        }
    });

    /**
     * 「分割する」ボタンのクリック処理
     */
    divideButton.addEventListener('click', () => {
        const text = longTextElement.value;
        const maxLength = parseInt(maxLengthElement.value, 10);
        if (!text.trim()) { alert('テキストが入力されていません。'); return; }
        if (isNaN(maxLength) || maxLength < 100 || maxLength > 2000) { alert('分割文字数は100から2000の間で設定してください。'); return; }
        const chunks = divideText(text, maxLength);
        renderResultCards(chunks);
    });

    /**
     * 分割結果カードのクリック処理（イベント委任）
     */
    resultCardsElement.addEventListener('click', (event) => {
        if (event.target.classList.contains('copy-btn')) {
            const card = event.target.closest('.card');
            const textToCopy = card.querySelector('p').textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = event.target.textContent;
                event.target.textContent = 'コピー完了！';
                event.target.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    event.target.textContent = originalText;
                    event.target.style.backgroundColor = '';
                }, 1500);
            }).catch(err => {
                console.error('コピーに失敗しました', err);
                alert('クリップボードへのコピーに失敗しました。');
            });
        }
    });

    /**
     * 「定型文として保存」ボタンのクリック処理
     */
    saveTemplateButton.addEventListener('click', () => {
        const name = templateNameElement.value.trim();
        const content = longTextElement.value.trim();

        if (!name || !content) {
            alert('定型文の名前と内容の両方を入力してください。');
            return;
        }

        saveTemplate(name, content);
        templateNameElement.value = ''; // 入力欄をクリア
        alert('定型文を保存しました。');
        renderTemplates(); // リストを再描画
    });

    /**
     * 定型文リストのクリック処理（イベント委任）
     */
    templateListElement.addEventListener('click', (event) => {
        const target = event.target;
        const templateItem = target.closest('.template-item');
        if (!templateItem) return;

        const templateId = templateItem.dataset.id;

        // 削除ボタンが押された場合
        if (target.classList.contains('delete-template-btn')) {
            if (confirm('この定型文を削除しますか？')) {
                deleteTemplate(templateId);
                renderTemplates();
            }
        } else { // リスト本体が押された場合
            const templates = getTemplates();
            const template = templates.find(t => t.id == templateId);
            if (template) {
                longTextElement.value = template.content;
                // 分割結果をクリア
                resultCardsElement.innerHTML = '';
            }
        }
    });

    /**
     * タブボタンのクリック処理
     */
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.dataset.tab;

            // すべてのタブボタンからactiveクラスを削除
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // クリックされたボタンにactiveクラスを追加
            button.classList.add('active');

            // すべてのタブコンテンツを非表示
            tabContents.forEach(content => content.classList.remove('active'));
            // 対象のタブコンテンツを表示
            document.getElementById(targetTabId).classList.add('active');
        });
    });


    // --- 機能実装 ---

    /**
     * テキストを指定文字数で分割する
     */
    function divideText(text, maxLength) {
        const chunks = [];
        let currentPosition = 0;
        while (currentPosition < text.length) {
            let sliceEnd = currentPosition + maxLength;
            if (sliceEnd >= text.length) {
                chunks.push(text.slice(currentPosition));
                break;
            }
            let splitPosition = -1;
            const punctuation = ['\n', '。', '」', '』', '！', '？', '、', ' '];
            for (const p of punctuation) {
                const lastIndex = text.lastIndexOf(p, sliceEnd);
                if (lastIndex > currentPosition) {
                    splitPosition = lastIndex + 1;
                    break;
                }
            }
            if (splitPosition === -1) {
                splitPosition = sliceEnd;
            }
            chunks.push(text.slice(currentPosition, splitPosition));
            currentPosition = splitPosition;
        }
        return chunks;
    }

    /**
     * 分割結果をカードとして表示する
     */
    function renderResultCards(chunks) {
        resultCardsElement.innerHTML = '';
        chunks.forEach((chunk, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            const paragraph = document.createElement('p');
            paragraph.textContent = chunk.trim();
            const cardActions = document.createElement('div');
            cardActions.className = 'card-actions';
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-btn';
            copyButton.textContent = `コピー (${index + 1}/${chunks.length})`;
            const lineButton = document.createElement('a');
            lineButton.className = 'line-send-btn';
            const encodedText = encodeURIComponent(chunk.trim());
            lineButton.href = `https://line.me/R/msg/text/?${encodedText}`;
            lineButton.textContent = 'LINEで送る';
            lineButton.target = '_blank';
            lineButton.rel = 'noopener noreferrer';
            cardActions.appendChild(copyButton);
            cardActions.appendChild(lineButton);
            card.appendChild(paragraph);
            card.appendChild(cardActions);
            resultCardsElement.appendChild(card);
        });
    }

    // --- 定型文管理機能 ---

    const STORAGE_KEY = 'lineHelperTemplates';

    /**
     * localStorageから全ての定型文を取得する
     * @returns {Array} 定型文の配列
     */
    function getTemplates() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    }

    /**
     * 定型文をlocalStorageに保存する
     * @param {Array} templates - 保存する定型文の配列
     */
    function saveTemplates(templates) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }

    /**
     * 新しい定型文を追加保存する
     * @param {string} name - 定型文の名前
     * @param {string} content - 定型文の内容
     */
    function saveTemplate(name, content) {
        const templates = getTemplates();
        const newTemplate = {
            id: Date.now(), // ユニークなIDとしてタイムスタンプを使用
            name: name,
            content: content,
            createdAt: new Date().toISOString()
        };
        templates.unshift(newTemplate); // 配列の先頭に追加
        saveTemplates(templates);
    }

    /**
     * 指定したIDの定型文を削除する
     * @param {string|number} id - 削除する定型文のID
     */
    function deleteTemplate(id) {
        let templates = getTemplates();
        templates = templates.filter(t => t.id != id);
        saveTemplates(templates);
    }

    /**
     * 定型文リストを画面に描画する
     */
    function renderTemplates() {
        const templates = getTemplates();
        templateListElement.innerHTML = ''; // リストをクリア

        if (templates.length === 0) {
            templateListElement.innerHTML = '<p>保存された定型文はありません。</p>';
            return;
        }

        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-item';
            item.dataset.id = template.id;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'template-item-name';
            nameSpan.textContent = template.name;

            const previewSpan = document.createElement('span');
            previewSpan.className = 'template-item-preview';
            previewSpan.textContent = template.content.substring(0, 30) + '...';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-template-btn';
            deleteBtn.textContent = '🗑️'; // アイコンに変更

            item.appendChild(nameSpan);
            item.appendChild(previewSpan);
            item.appendChild(deleteBtn);
            templateListElement.appendChild(item);
        });
    }

    // --- 初期化処理 ---
    renderTemplates(); // アプリ起動時に保存されている定型文を読み込んで表示

});