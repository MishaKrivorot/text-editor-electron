const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Поточний шлях до файлу
let currentFilePath = '';
// Чи є незбережені зміни
let isModified = false;

// Отримує назву поточного відкритого файлу або повертає "Без назви", якщо файл новий
function getFileName() {
    return currentFilePath ? path.basename(currentFilePath) : 'Без назви';
}

// Оновлює заголовок вікна додатку, додаючи зірочку (*), якщо є незбережені зміни
function updateTitle() {
    if (!mainWindow) return;
    const title = isModified ? `${getFileName()} *` : getFileName();
    mainWindow.setTitle(title);
}

// Створює головне вікно додатку та налаштовує його параметри, меню і події закриття
function createWindow() {
    // Створення головного вікна з заданими розмірами та обмеженнями
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 700,
        minHeight: 500,
        webPreferences: {
            // Підключення preload-скрипта для безпечної взаємодії з Node.js
            preload: path.join(__dirname, 'preload.js'),
            // Ізоляція контексту та вимкнена інтеграція Node.js для безпеки сторінки
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Завантаження HTML-файлу (інтерфейсу) у вікно
    mainWindow.loadFile('index.html');
    updateTitle();

    // Обробка події закриття вікна
    let isAppClosing = false;
    mainWindow.on('close', async (e) => {
        // Якщо вже в процесі закриття - нічого не робимо
        if (isAppClosing) return;

        // Скасовуємо стандартне закриття, щоб спочатку перевірити наявність незбережених змін
        e.preventDefault();
        const shouldClose = await checkSaveBeforeAction();
        // Якщо користувач підтвердив (або змін не було), закриваємо вікно
        if (shouldClose) {
            isAppClosing = true;
            mainWindow.close();
        }
    });

    // Створення нативного меню додатку (верхня панель)
    const menu = Menu.buildFromTemplate([
        {
            label: 'Файл',
            submenu: [
                // Пункт меню "Новий"
                {
                    label: 'Новий',
                    accelerator: 'CmdOrCtrl+N',
                    click: async () => {
                        const ok = await checkSaveBeforeAction();
                        if (!ok) return;

                        // Скидаємо шлях та стан, оскільки створюється новий порожній файл
                        currentFilePath = '';
                        isModified = false;
                        updateTitle();

                        mainWindow.webContents.send('file-new');
                    }
                },
                // Пункт меню "Відкрити"
                {
                    label: 'Відкрити',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const ok = await checkSaveBeforeAction();
                        if (!ok) return;

                        // Виклик системного діалогу вибору файлу для відкриття
                        const result = await dialog.showOpenDialog(mainWindow, {
                            title: 'Відкрити файл',
                            filters: [
                                { name: 'Text Files', extensions: ['txt'] },
                                { name: 'All Files', extensions: ['*'] }
                            ],
                            properties: ['openFile']
                        });

                        if (result.canceled || result.filePaths.length === 0) return;

                        // Зчитування вмісту вибраного файлу
                        const filePath = result.filePaths[0];
                        const content = fs.readFileSync(filePath, 'utf-8');

                        currentFilePath = filePath;
                        isModified = false;
                        updateTitle();

                        mainWindow.webContents.send('file-opened', {
                            content,
                            filePath
                        });
                    }
                },
                {
                    label: 'Зберегти',
                    accelerator: 'CmdOrCtrl+S',
                    click: async () => {
                        await saveFile();
                    }
                },
                {
                    label: 'Зберегти як',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: async () => {
                        await saveFileAs();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Вихід',
                    click: () => {
                        mainWindow.close();
                    }
                }
            ]
        }
    ]);

    Menu.setApplicationMenu(menu);
}

// Зберігає поточний текст у відкритий файл або викликає "Зберегти як", якщо файл ще не було збережено
async function saveFile() {
    if (!mainWindow) return false;

    // Отримання тексту з редактора через виконання скрипта в контексті сторінки (виклик API з preload)
    const content = await mainWindow.webContents.executeJavaScript(
        'window.editorAPI.getEditorText()'
    );

    // Якщо це новий файл і він ще не був збережений
    if (!currentFilePath) {
        return await saveFileAs();
    }

    // Запис тексту в існуючий файл
    fs.writeFileSync(currentFilePath, content, 'utf-8');
    isModified = false;
    updateTitle();
    // Сповіщення інтерфейсу про успішне збереження
    mainWindow.webContents.send('file-saved', { filePath: currentFilePath });

    return true;
}

// Відкриває діалогове вікно для збереження нового файлу та записує в нього текст
async function saveFileAs() {
    if (!mainWindow) return false;

    // Отримання актуального тексту з текстового поля редактора
    const content = await mainWindow.webContents.executeJavaScript(
        'window.editorAPI.getEditorText()'
    );

    // Виклик системного діалогу збереження файлу
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Зберегти файл',
        filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        defaultPath: currentFilePath || 'Без назви.txt'
    });

    if (result.canceled || !result.filePath) return false;

    currentFilePath = result.filePath;
    fs.writeFileSync(currentFilePath, content, 'utf-8');

    isModified = false;
    updateTitle();

    mainWindow.webContents.send('file-saved', { filePath: currentFilePath });

    return true;
}

// Перевіряє наявність незбережених змін перед закриттям або відкриттям нового файлу.
// Пропонує користувачеві зберегти зміни. Повертає true, якщо можна продовжувати дію.
async function checkSaveBeforeAction() {
    // Якщо змін не було, можна безпечно продовжувати
    if (!isModified) return true;

    // Відображення діалогу з питанням
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Так', 'Ні', 'Скасувати'],
        defaultId: 0,
        cancelId: 2,
        title: 'Підтвердження',
        message: 'Файл було змінено. Зберегти зміни?'
    });

    // Обробка відповіді користувача (0 = 'Так', 1 = 'Ні', 2 = 'Скасувати')
    if (result.response === 0) {
        // Користувач вибрав зберігати - чекаємо на завершення збереження
        return await saveFile();
    } else if (result.response === 1) {
        // Користувач вибрав не зберігати - продовжуємо дію, втрачаючи зміни
        return true;
    } else {
        // Користувач скасував дію
        return false;
    }
}

// Обробник події зміни тексту в редакторі
ipcMain.on('text-changed', () => {
    isModified = true;
    updateTitle();
});

// Обробник події завантаження документа
ipcMain.on('document-loaded', () => {
    isModified = false;
    updateTitle();
});

// Обробник запиту на отримання назви поточного файлу
ipcMain.handle('request-current-file-name', () => {
    return getFileName();
});

// Ініціалізація додатку після його готовності
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Завершення роботи додатку, коли всі вікна закриті (окрім macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});