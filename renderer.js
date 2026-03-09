const editor = document.getElementById('editor');
const statusPosition = document.getElementById('statusPosition');
const statusChars = document.getElementById('statusChars');

let currentFileName = 'Без назви';
let isModified = false;
let isInternalUpdate = false;

// Оновлює статистику рядків, стовпців та загальної кількості символів у статусному рядку
function updateStats() {
    const text = editor.value;
    const charsCount = text.length;

    const cursorPosition = editor.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;

    statusPosition.textContent = `Рядок ${lineNumber}, Стовпець ${columnNumber}`;
    statusChars.textContent = `Символів: ${charsCount}`;
}

// Обробник введення тексту: сповіщає головний процес про зміни та оновлює статистику
editor.addEventListener('input', () => {
    if (isInternalUpdate) return;

    isModified = true;
    window.electronAPI.sendTextChanged();
    updateStats();
});

// Обробники подій для оновлення статистики при навігації по тексту з клавіатури або мишею
editor.addEventListener('keyup', updateStats);
editor.addEventListener('click', updateStats);

// Обробник події створення нового файлу
window.electronAPI.onFileNew(() => {
    isInternalUpdate = true;
    editor.value = '';
    currentFileName = 'Без назви';
    isModified = false;
    updateStats();
    isInternalUpdate = false;
});

// Обробник події відкриття існуючого файлу
window.electronAPI.onFileOpened((data) => {
    isInternalUpdate = true;
    editor.value = data.content;
    currentFileName = data.filePath.split(/[\\/]/).pop();
    isModified = false;
    updateStats();
    window.electronAPI.notifyDocumentLoaded();
    isInternalUpdate = false;
});

// Обробник події успішного збереження файлу
window.electronAPI.onFileSaved((data) => {
    currentFileName = data.filePath.split(/[\\/]/).pop();
    isModified = false;
    updateStats();
});

// Ініціалізація редактора при повному завантаженні документа
window.addEventListener('DOMContentLoaded', async () => {
    currentFileName = await window.electronAPI.requestCurrentFileName();
    updateStats();
});