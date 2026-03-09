const { contextBridge, ipcRenderer } = require('electron');

// Експортує безпечний API для взаємодії рендерера (UI) з головним процесом (main.js)
contextBridge.exposeInMainWorld('electronAPI', {
    sendTextChanged: () => ipcRenderer.send('text-changed'),
    notifyDocumentLoaded: () => ipcRenderer.send('document-loaded'),
    requestCurrentFileName: () => ipcRenderer.invoke('request-current-file-name'),

    onFileNew: (callback) => ipcRenderer.on('file-new', callback),
    onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
    onFileSaved: (callback) => ipcRenderer.on('file-saved', (event, data) => callback(data))
});

// Експортує API для отримання тексту безпосередньо з елемента редактора
contextBridge.exposeInMainWorld('editorAPI', {
    getEditorText: () => {
        const editor = document.getElementById('editor');
        return editor ? editor.value : '';
    }
});