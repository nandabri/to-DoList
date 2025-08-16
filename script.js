// ===== Internationalization =====
let translations = {};

// Load translations from JSON file
async function loadTranslations() {
    try {
        const response = await fetch('translations.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        console.log('Translations loaded successfully!');
    } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback translations in case the JSON file fails to load
        translations = {
            en: {
                'page-title': 'My To-Do List',
                'app-title': 'To-Do List',
                'empty-message': 'Nothing here… add a task above 👆',
                'all-done': 'All done ✨'
            }
        };
    }
}

let currentLang = 'en';
let currentTheme = 'dark';

function t(key, params = {}) {
    let text = translations[currentLang][key] || translations.en[key] || key;

    // Simple pluralization
    if (params.count !== undefined) {
        const isPlural = params.count !== 1;
        text = text.replace(/{count, plural, one \{([^}]+)\} other \{([^}]+)\}}/,
            isPlural ? '$2' : '$1');
        text = text.replace(/{count}/g, params.count);
    }

    return text;
}

function updateLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === 'he' ? 'he' : lang === 'pt' ? 'pt-BR' : 'en';
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (el.tagName === 'TITLE') {
            el.textContent = t(key);
        } else {
            el.textContent = t(key);
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const translatedText = t(key);

        if (el.type === 'date') {
            // For date inputs, extract just the format part
            const formatMatch = translatedText.match(/\(([^)]+)\)/);
            const format = formatMatch ? formatMatch[1] : translatedText;
            el.setAttribute('data-placeholder', format);
        } else {
            el.placeholder = translatedText;
        }
    });

    // Save language preference
    localStorage.setItem('todo.language', lang);

    // Re-render to update dynamic content
    render();
}

function updateTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Update theme toggle icon source
    const themeToggle = document.getElementById('themeToggle');
    const themeImg = themeToggle?.querySelector('img');
    if (themeImg) {
        themeImg.src = theme === 'light' ? 'image/dark-theme.svg' : 'image/light-theme.svg';
        themeToggle.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    }

    // Save theme preference
    localStorage.setItem('todo.theme', theme);
}

// ===== Utilidades =====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEY = 'todo.tasks.feminine.v1';

/** @type {{id:string,text:string,done:boolean,createdAt:number,dueDate:string|null}[]} */
let tasks = [];
let filter = 'all'; // 'all' | 'active' | 'done'

function uid() { return Math.random().toString(36).slice(2, 9) }

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)) }
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        tasks = raw ? JSON.parse(raw) : [];
    } catch (e) { tasks = [] }
}

function setFilter(next) {
    filter = next;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.filter === filter)));
    render();
}

// ===== Renderização =====
const listEl = $('#list');
const statsEl = $('#stats');

function render() {
    const visible = tasks.filter(t => filter === 'all' ? true : filter === 'active' ? !t.done : t.done);
    listEl.innerHTML = '';

    if (visible.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'item';
        empty.innerHTML = `<div></div><div class="text" style="opacity:.85">${t('empty-message')}</div><div></div>`;
        listEl.appendChild(empty);
    } else {
        for (const t of visible) { listEl.appendChild(renderItem(t)); }
    }

    const remaining = tasks.filter(t => !t.done).length;
    statsEl.textContent = remaining === 0 ? t('all-done') : t('tasks-remaining', { count: remaining });
}

function renderItem(t) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = t.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'checkbox';
    cb.checked = t.done;
    cb.ariaLabel = t.done ? translations[currentLang]['mark-incomplete'] : translations[currentLang]['mark-complete'];

    const textContainer = document.createElement('div');
    textContainer.style.flex = '1';

    const text = document.createElement('div');
    text.className = 'text' + (t.done ? ' done' : '');
    text.textContent = t.text;
    text.title = translations[currentLang]['edit-placeholder'];

    // Display due date if exists
    if (t.dueDate) {
        const dueDateEl = document.createElement('div');
        dueDateEl.className = 'due-date';
        dueDateEl.style.fontSize = '12px';
        dueDateEl.style.color = 'var(--muted)';
        dueDateEl.style.marginTop = '4px';

        const dueDate = new Date(t.dueDate);
        const isOverdue = dueDate < new Date() && !t.done;
        if (isOverdue) {
            dueDateEl.style.color = 'var(--danger)';
            dueDateEl.textContent = `📅 ${dueDate.toLocaleDateString()} (${translations[currentLang]['overdue']})`;
        } else {
            dueDateEl.textContent = `📅 ${dueDate.toLocaleDateString()}`;
        }
        textContainer.append(text, dueDateEl);
    } else {
        textContainer.append(text);
    }

    // Ações
    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnEdit = iconButton(translations[currentLang]['edit'], pencilIcon());
    const btnDel = iconButton(translations[currentLang]['delete'], trashIcon(), 'danger');

    // Eventos
    cb.addEventListener('change', () => toggleDone(t.id));
    btnDel.addEventListener('click', () => removeTask(t.id));
    btnEdit.addEventListener('click', () => startEdit(li, t));
    text.addEventListener('dblclick', () => startEdit(li, t));

    li.append(cb, textContainer, actions);
    actions.append(btnEdit, btnDel);
    return li;
}

function iconButton(label, svg, extraClass = '') {
    const b = document.createElement('button');
    b.className = 'icon-btn ' + extraClass;
    b.type = 'button';
    b.title = label;
    b.ariaLabel = label;
    b.innerHTML = svg;
    return b;
}

function pencilIcon() {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" stroke-width="1.6"/>
    <path d="M14.06 4.69l3.75 3.75 1.65-1.65a1.5 1.5 0 0 0 0-2.12l-1.63-1.63a1.5 1.5 0 0 0-2.12 0l-1.65 1.65z" stroke="currentColor" stroke-width="1.6"/>
  </svg>`;
}
function trashIcon() {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 7h16" stroke="currentColor" stroke-width="1.8"/>
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="1.8"/>
    <path d="M10 7V5a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.8"/>
  </svg>`;
}

// ===== Ações =====
function addTask(text, dueDate = null) {
    const trimmed = text.trim();
    if (!trimmed) return;
    tasks.unshift({
        id: uid(),
        text: trimmed,
        done: false,
        createdAt: Date.now(),
        dueDate: dueDate || null
    });
    save();
    render();
}

// ===== API Functions =====
async function fetchInitialTasks() {
    try {
        // Check if we already have tasks to avoid duplicate loading
        if (tasks.length > 0) return;

        console.log('Fetching initial tasks from API...');
        const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiTasks = await response.json();
        console.log('API Tasks received:', apiTasks);

        // Convert API format to our task format
        const convertedTasks = apiTasks.map(apiTask => ({
            id: uid(), // Generate new ID for our system
            text: apiTask.title,
            done: apiTask.completed,
            createdAt: Date.now(),
            dueDate: null // API doesn't provide due dates
        }));

        // Add converted tasks to our tasks array
        tasks.push(...convertedTasks);

        // Save to localStorage
        save();

        // Re-render the list
        render();

        console.log('Initial tasks loaded successfully!');

    } catch (error) {
        console.error('Error fetching initial tasks:', error);
        // Show user-friendly error message
        alert('Failed to load initial tasks from server. You can still add tasks manually.');
    }
}

function sortTasks() {
    tasks.sort((a, b) => {
        // Tasks without due date go to the end
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;

        // Compare due dates
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    save();
    render();
}

function toggleDone(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    save();
    render();
}

function removeTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    render();
}

function startEdit(li, t) {
    const textEl = li.querySelector('.text');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = t.text;
    input.className = 'input';
    input.style.padding = '10px 12px';
    textEl.replaceWith(input);
    input.focus();
    input.setSelectionRange(t.text.length, t.text.length);

    function commit() {
        const v = input.value.trim();
        if (v) { t.text = v; save(); }
        render();
    }
    function cancel() { render(); }
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') cancel();
    });
    input.addEventListener('blur', commit);
}

function clearCompleted() {
    const had = tasks.some(t => t.done);
    tasks = tasks.filter(t => !t.done);
    if (had) { save(); render(); }
}

// ===== Eventos UI =====
const form = $('#todoForm');
const input = $('#todoInput');
const dueDateInput = $('#dueDateInput');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(input.value, dueDateInput.value);
    input.value = '';
    dueDateInput.value = '';
    input.focus();
});

$$('.tab').forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
});

$('#clearCompleted').addEventListener('click', clearCompleted);
$('#clearCompleted').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearCompleted(); } });

// Sort by date button
$('#sortByDate').addEventListener('click', sortTasks);

// Language switching
$$('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => updateLanguage(btn.dataset.lang));
});

// Theme switching
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        updateTheme(newTheme);
    });
}

// ===== Inicialização =====
async function initializeApp() {
    // Load translations first
    await loadTranslations();

    // Load saved language and theme
    const savedLang = localStorage.getItem('todo.language') || 'en';
    const savedTheme = localStorage.getItem('todo.theme') || 'dark';

    updateLanguage(savedLang);
    updateTheme(savedTheme);

    // Load existing tasks from localStorage
    load();

    // Fetch initial tasks from API if no tasks exist
    fetchInitialTasks();

    render();
    input.focus();
}

// Initialize the app when page loads
initializeApp();
