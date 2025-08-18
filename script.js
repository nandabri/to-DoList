// ===== Internacionalização =====
let translations = {};

// Carrega traduções do arquivo JSON
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
        // Traduções de fallback caso o arquivo JSON falhe ao carregar
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

    // Pluralização simples
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

    // Atualiza botões de idioma
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Atualiza todos os elementos traduzíveis
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (el.tagName === 'TITLE') {
            el.textContent = t(key);
        } else {
            el.textContent = t(key);
        }
    });

    // Atualiza placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const translatedText = t(key);

        if (el.type === 'date') {
            // Para inputs de data, extrai apenas a parte do formato
            const formatMatch = translatedText.match(/\(([^)]+)\)/);
            const format = formatMatch ? formatMatch[1] : translatedText;
            el.setAttribute('data-placeholder', format);
        } else {
            el.placeholder = translatedText;
        }
    });

    // Salva preferência de idioma
    localStorage.setItem('todo.language', lang);

    // Re-renderiza para atualizar conteúdo dinâmico
    render();
}

function updateTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Atualiza ícone do alternador de tema
    const themeToggle = document.getElementById('themeToggle');
    const themeImg = themeToggle?.querySelector('img');
    if (themeImg) {
        themeImg.src = theme === 'light' ? 'image/dark-theme.svg' : 'image/light-theme.svg';
        themeToggle.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    }

    // Salva preferência de tema
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

    // Exibe data de vencimento se existir
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

// ===== Funções da API =====
async function fetchInitialTasks() {
    try {
        // Verifica se já temos tarefas para evitar carregamento duplicado
        if (tasks.length > 0) return;

        console.log('Fetching initial tasks from API...');
        const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiTasks = await response.json();
        console.log('API Tasks received:', apiTasks);

        // Converte formato da API para nosso formato de tarefa
        const convertedTasks = apiTasks.map(apiTask => ({
            id: uid(), // Gera novo ID para nosso sistema
            text: apiTask.title,
            done: apiTask.completed,
            createdAt: Date.now(),
            dueDate: null // API não fornece datas de vencimento
        }));

        // Adiciona tarefas convertidas ao nosso array de tarefas
        tasks.push(...convertedTasks);

        // Salva no localStorage
        save();

        // Re-renderiza a lista
        render();

        console.log('Initial tasks loaded successfully!');

    } catch (error) {
        console.error('Error fetching initial tasks:', error);
        // Mostra mensagem de erro amigável ao usuário
        alert('Failed to load initial tasks from server. You can still add tasks manually.');
    }
}

function sortTasks() {
    tasks.sort((a, b) => {
        // Tarefas sem data de vencimento vão para o final
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;

        // Compara datas de vencimento
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

// Melhoria para input de data no mobile
function setupDateInput() {
    if (dueDateInput) {
        // Detecta se é um dispositivo mobile
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // Força o tipo date mesmo em browsers que podem ter problemas
            dueDateInput.setAttribute('type', 'date');
            dueDateInput.setAttribute('pattern', '[0-9]{4}-[0-9]{2}-[0-9]{2}');

            // Adiciona evento para garantir que o calendário abra no toque
            dueDateInput.addEventListener('touchstart', function (e) {
                // Força o foco no input de data
                this.focus();
                this.click();
            }, { passive: true });

            // Testa se o input de data funciona corretamente
            const testDate = '2023-01-01';
            dueDateInput.value = testDate;

            // Se o valor não foi definido corretamente, o browser não suporta input date
            if (dueDateInput.value !== testDate) {
                console.log('Native date input not supported, creating custom date picker');
                createCustomDatePicker();
            } else {
                // Limpa o valor de teste
                dueDateInput.value = '';
            }

            // Fallback para dispositivos que não suportam input type="date"
            dueDateInput.addEventListener('focus', function () {
                if (this.type !== 'date') {
                    this.type = 'date';
                }
            });
        }
    }
}

// Cria um seletor de data customizado para dispositivos sem suporte nativo
function createCustomDatePicker() {
    // Remove atributos do input nativo
    dueDateInput.removeAttribute('type');
    dueDateInput.setAttribute('type', 'text');
    dueDateInput.setAttribute('readonly', 'true');
    dueDateInput.setAttribute('data-type', 'date');
    dueDateInput.style.cursor = 'pointer';

    // Cria interface customizada
    dueDateInput.addEventListener('click', showCustomDatePicker);
    dueDateInput.addEventListener('touchstart', showCustomDatePicker, { passive: true });
}

function showCustomDatePicker() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    // Cria um prompt simples para seleção de data
    const dateStr = prompt(
        `${t('select-date')} (${t('format-example')}: ${currentDay}/${currentMonth + 1}/${currentYear})`,
        `${currentDay}/${currentMonth + 1}/${currentYear}`
    );

    if (dateStr) {
        // Tenta parsear a data inserida
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
                const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                dueDateInput.value = formattedDate;
                dueDateInput.setAttribute('data-display-date', `${day}/${month}/${year}`);

                // Atualiza o placeholder visual
                const placeholder = dueDateInput.getAttribute('data-placeholder');
                dueDateInput.style.setProperty('--placeholder-text', `"📅 ${day}/${month}/${year}"`);
            }
        }
    }
}

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

// Botão de ordenar por data
$('#sortByDate').addEventListener('click', sortTasks);

// Alternância de idioma
$$('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => updateLanguage(btn.dataset.lang));
});

// Alternância de tema
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        updateTheme(newTheme);
    });
}

// ===== Inicialização =====
async function initializeApp() {
    // Carrega traduções primeiro
    await loadTranslations();

    // Carrega idioma e tema salvos
    const savedLang = localStorage.getItem('todo.language') || 'en';
    const savedTheme = localStorage.getItem('todo.theme') || 'dark';

    updateLanguage(savedLang);
    updateTheme(savedTheme);

    // Configura input de data para mobile
    setupDateInput();

    // Carrega tarefas existentes do localStorage
    load();

    // Busca tarefas iniciais da API se não existirem tarefas
    fetchInitialTasks();

    render();
    input.focus();
}

// Inicializa o app quando a página carrega
initializeApp();
