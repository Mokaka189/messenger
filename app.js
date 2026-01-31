// Инициализация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC0QrE4gjjV7ZU7x8IzmCcr6EYQSCMjAbg",
    authDomain: "max-pinlab.firebaseapp.com",
    databaseURL: "https://max-pinlab-default-rtdb.firebaseio.com",
    projectId: "max-pinlab",
    storageBucket: "max-pinlab.firebasestorage.app",
    messagingSenderId: "708865541327",
    appId: "1:708865541327:web:8cf92cffebc1c3c63e23ba"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let isAdmin = false;
let mediaRecorder = null;
let audioChunks = [];

// DOM элементы
const elements = {
    authScreen: document.getElementById('auth-screen'),
    app: document.getElementById('app'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    registerUsername: document.getElementById('register-username'),
    registerPassword: document.getElementById('register-password'),
    registerConfirm: document.getElementById('register-confirm'),
    authError: document.getElementById('auth-error'),
    
    // Основное приложение
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.getElementById('sidebar'),
    usernameDisplay: document.getElementById('username-display'),
    userAvatar: document.getElementById('user-avatar'),
    adminPanelBtn: document.getElementById('admin-panel-btn'),
    
    // Списки
    chatsList: document.getElementById('chats-list'),
    contactsList: document.getElementById('contacts-list'),
    groupsList: document.getElementById('groups-list'),
    
    // Чат
    chatMessages: document.getElementById('chat-messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    currentChatName: document.getElementById('current-chat-name'),
    chatStatus: document.getElementById('chat-status'),
    callBtn: document.getElementById('call-btn'),
    
    // Модалки
    modals: document.querySelectorAll('.modal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),
    addFriendModal: document.getElementById('add-friend-modal'),
    createGroupModal: document.getElementById('create-group-modal'),
    joinGroupModal: document.getElementById('join-group-modal'),
    profileModal: document.getElementById('profile-modal'),
    adminModal: document.getElementById('admin-modal'),
    voiceModal: document.getElementById('voice-modal'),
    callModal: document.getElementById('call-modal')
};

// Утилиты
function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications') || (() => {
        const div = document.createElement('div');
        div.id = 'notifications';
        document.body.appendChild(div);
        return div;
    })();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function generateChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Аутентификация
async function login(username, password) {
    try {
        console.log('Попытка входа:', username);
        
        // Проверка администратора
        if (username === 'мокасин' && password === '123321') {
            console.log('Вход как администратор');
            currentUser = {
                uid: '123',
                username: 'мокасин',
                userid: '123',
                isAdmin: true,
                status: 'online'
            };
            isAdmin = true;
            
            // Сохраняем в базу данных
            await database.ref(`users/мокасин`).set({
                username: 'мокасин',
                userid: '123',
                password: '123321',
                isAdmin: true,
                status: 'online',
                createdAt: Date.now()
            });
            
            await initializeUser();
            return true;
        }
        
        // Проверка обычного пользователя
        const userRef = database.ref(`users/${username}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            showNotification('Пользователь не найден', 'error');
            return false;
        }
        
        const userData = snapshot.val();
        console.log('Данные пользователя:', userData);
        
        if (userData.password !== password) {
            showNotification('Неверный пароль', 'error');
            return false;
        }
        
        currentUser = {
            uid: userData.userid || username,
            username: username,
            userid: userData.userid || username,
            isAdmin: userData.isAdmin || false,
            status: 'online'
        };
        
        isAdmin = currentUser.isAdmin;
        
        // Обновляем статус
        await userRef.update({
            status: 'online',
            lastSeen: Date.now()
        });
        
        await initializeUser();
        return true;
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification('Ошибка входа: ' + error.message, 'error');
        return false;
    }
}

async function register(username, userid, password, confirmPassword) {
    try {
        console.log('Регистрация:', username, userid);
        
        if (!username || !userid || !password) {
            showNotification('Заполните все поля', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Пароли не совпадают', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('Пароль должен быть не менее 6 символов', 'error');
            return;
        }
        
        // Проверяем уникальность
        const usersRef = database.ref('users');
        const snapshot = await usersRef.once('value');
        let userExists = false;
        let userIdExists = false;
        
        snapshot.forEach(child => {
            const user = child.val();
            if (user.username === username) userExists = true;
            if (user.userid === userid) userIdExists = true;
        });
        
        if (userExists) {
            showNotification('Этот никнейм уже занят', 'error');
            return;
        }
        
        if (userIdExists) {
            showNotification('Этот ID уже занят', 'error');
            return;
        }
        
        // Создаем пользователя
        await database.ref(`users/${username}`).set({
            username: username,
            userid: userid,
            password: password,
            status: 'online',
            createdAt: Date.now(),
            lastSeen: Date.now(),
            isAdmin: false
        });
        
        showNotification('Регистрация успешна! Теперь войдите в систему.', 'success');
        switchAuthTab('login');
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showNotification('Ошибка регистрации: ' + error.message, 'error');
    }
}

async function logout() {
    if (currentUser) {
        try {
            await database.ref(`users/${currentUser.username}`).update({
                status: 'offline',
                lastSeen: Date.now()
            });
        } catch (error) {
            console.error('Ошибка выхода:', error);
        }
    }
    
    currentUser = null;
    isAdmin = false;
    elements.authScreen.style.display = 'flex';
    elements.app.style.display = 'none';
}

// Инициализация пользователя
async function initializeUser() {
    console.log('Инициализация пользователя:', currentUser);
    
    // Скрываем экран аутентификации
    elements.authScreen.style.display = 'none';
    elements.app.style.display = 'flex';
    
    // Обновляем информацию о пользователе
    elements.usernameDisplay.textContent = currentUser.username;
    
    // Показываем кнопку админ-панели для администратора
    if (isAdmin) {
        elements.adminPanelBtn.style.display = 'block';
        showNotification('Вы вошли как администратор', 'success');
    }
    
    // Загружаем данные
    await loadContacts();
    await loadChats();
    await loadGroups();
    
    // Слушаем изменения статуса
    setupStatusListener();
}

// Слушатель статуса
function setupStatusListener() {
    if (!currentUser) return;
    
    // Обновляем статус при фокусе/разфокусе окна
    window.addEventListener('focus', () => {
        if (currentUser) {
            database.ref(`users/${currentUser.username}`).update({
                status: 'online',
                lastSeen: Date.now()
            });
        }
    });
    
    window.addEventListener('blur', () => {
        if (currentUser) {
            database.ref(`users/${currentUser.username}`).update({
                status: 'away',
                lastSeen: Date.now()
            });
        }
    });
}

// Загрузка контактов
async function loadContacts() {
    console.log('Загрузка контактов');
    
    const usersRef = database.ref('users');
    usersRef.on('value', (snapshot) => {
        elements.contactsList.innerHTML = '';
        snapshot.forEach((child) => {
            const user = child.val();
            if (user.username !== currentUser.username) {
                addContactToList(user);
            }
        });
    });
}

function addContactToList(user) {
    const contactItem = document.createElement('div');
    contactItem.className = 'contact-item';
    contactItem.dataset.username = user.username;
    
    contactItem.innerHTML = `
        <div class="item-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="item-info">
            <div class="item-name">${user.username}</div>
            <div class="item-last-message">ID: ${user.userid}</div>
        </div>
        <div class="item-status ${user.status === 'online' ? 'online' : 'offline'}"></div>
    `;
    
    contactItem.addEventListener('click', () => openChat(user.username, 'private'));
    elements.contactsList.appendChild(contactItem);
}

// Загрузка чатов
async function loadChats() {
    console.log('Загрузка чатов');
    
    if (!currentUser) return;
    
    const chatsRef = database.ref(`user_chats/${currentUser.username}`);
    chatsRef.on('value', async (snapshot) => {
        elements.chatsList.innerHTML = '';
        const chats = snapshot.val() || {};
        
        for (const chatId in chats) {
            await addChatToList(chatId);
        }
    });
}

async function addChatToList(chatId) {
    let chatName = 'Чат';
    let isGroup = chatId.startsWith('group_');
    
    if (isGroup) {
        // Групповой чат
        const groupRef = database.ref(`groups/${chatId}`);
        const groupSnap = await groupRef.once('value');
        if (groupSnap.exists()) {
            const group = groupSnap.val();
            chatName = group.name || 'Группа';
        }
    } else {
        // Личный чат
        const participants = chatId.split('_');
        const otherUser = participants.find(u => u !== currentUser.username);
        if (otherUser) {
            const userRef = database.ref(`users/${otherUser}`);
            const userSnap = await userRef.once('value');
            if (userSnap.exists()) {
                const user = userSnap.val();
                chatName = user.username || otherUser;
            }
        }
    }
    
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.chatId = chatId;
    
    chatItem.innerHTML = `
        <div class="item-avatar">
            <i class="fas ${isGroup ? 'fa-users' : 'fa-user'}"></i>
        </div>
        <div class="item-info">
            <div class="item-name">${chatName}</div>
            <div class="item-last-message">Нажмите чтобы открыть</div>
        </div>
    `;
    
    chatItem.addEventListener('click', () => openChat(chatId, isGroup ? 'group' : 'private'));
    elements.chatsList.appendChild(chatItem);
}

// Загрузка групп
async function loadGroups() {
    console.log('Загрузка групп');
    
    if (!currentUser) return;
    
    const groupsRef = database.ref('groups');
    groupsRef.on('value', (snapshot) => {
        elements.groupsList.innerHTML = '';
        snapshot.forEach((child) => {
            const group = child.val();
            if (group.members && group.members[currentUser.username]) {
                addGroupToList(child.key, group);
            }
        });
    });
}

function addGroupToList(groupId, group) {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.dataset.groupId = groupId;
    
    groupItem.innerHTML = `
        <div class="item-avatar">
            <i class="fas fa-users"></i>
        </div>
        <div class="item-info">
            <div class="item-name">${group.name || 'Группа'}</div>
            <div class="item-last-message">${Object.keys(group.members || {}).length} участников</div>
        </div>
    `;
    
    groupItem.addEventListener('click', () => openChat(groupId, 'group'));
    elements.groupsList.appendChild(groupItem);
}

// Открытие чата
async function openChat(chatId, type) {
    console.log('Открытие чата:', chatId, type);
    
    currentChat = { id: chatId, type: type };
    
    // Обновляем активный элемент
    document.querySelectorAll('.chat-item, .contact-item, .group-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`[data-chat-id="${chatId}"], [data-group-id="${chatId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // Обновляем информацию в заголовке
    if (type === 'private') {
        const otherUsername = chatId.split('_').find(u => u !== currentUser.username);
        if (otherUsername) {
            const userRef = database.ref(`users/${otherUsername}`);
            const userSnap = await userRef.once('value');
            if (userSnap.exists()) {
                const user = userSnap.val();
                elements.currentChatName.textContent = user.username;
                elements.chatStatus.textContent = user.status === 'online' ? 'онлайн' : 'не в сети';
                elements.chatStatus.className = `chat-status ${user.status === 'online' ? 'online' : 'offline'}`;
            }
        }
    } else if (type === 'group') {
        const groupRef = database.ref(`groups/${chatId}`);
        const groupSnap = await groupRef.once('value');
        if (groupSnap.exists()) {
            const group = groupSnap.val();
            elements.currentChatName.textContent = group.name || 'Группа';
            elements.chatStatus.textContent = `${Object.keys(group.members || {}).length} участников`;
            elements.chatStatus.className = 'chat-status';
        }
    }
    
    // Загружаем сообщения
    loadMessages(chatId);
    
    // Показываем кнопку звонка для личных чатов
    elements.callBtn.style.display = type === 'private' ? 'block' : 'none';
    
    // На мобильных устройствах скрываем сайдбар
    if (window.innerWidth <= 768) {
        elements.sidebar.classList.remove('active');
    }
}

// Загрузка сообщений
function loadMessages(chatId) {
    console.log('Загрузка сообщений для чата:', chatId);
    
    elements.chatMessages.innerHTML = '';
    
    const messagesRef = database.ref(`messages/${chatId}`);
    messagesRef.on('value', (snapshot) => {
        elements.chatMessages.innerHTML = '';
        snapshot.forEach((child) => {
            const message = child.val();
            addMessageToChat(message);
        });
        
        // Прокручиваем вниз
        setTimeout(() => {
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        }, 100);
    });
}

function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === currentUser.username ? 'my-message' : 'other-message'}`;
    
    let content = '';
    
    if (message.type === 'text') {
        content = `<div class="message-text">${message.text}</div>`;
    } else if (message.type === 'image') {
        content = `
            <div class="message-text">${message.text || ''}</div>
            <img src="${message.url}" alt="Изображение" class="message-image" onclick="viewImage('${message.url}')">
        `;
    } else if (message.type === 'file') {
        content = `
            <div class="message-text">${message.text || ''}</div>
            <div class="message-file">
                <i class="fas fa-file"></i>
                <a href="${message.url}" download="${message.filename}">${message.filename}</a>
            </div>
        `;
    } else if (message.type === 'voice') {
        content = `
            <div class="message-text">${message.text || ''}</div>
            <div class="message-voice">
                <button class="voice-control" onclick="playVoice('${message.url}')">
                    <i class="fas fa-play"></i>
                </button>
                <span class="voice-duration">${message.duration || 0}s</span>
            </div>
        `;
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${message.sender}</span>
            <span class="message-time">${formatTime(message.timestamp)}</span>
        </div>
        <div class="message-content">
            ${content}
        </div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
}

// Отправка сообщений
async function sendMessage() {
    if (!currentChat || !elements.messageInput.value.trim()) {
        showNotification('Введите сообщение', 'error');
        return;
    }
    
    const message = {
        sender: currentUser.username,
        text: elements.messageInput.value.trim(),
        type: 'text',
        timestamp: Date.now()
    };
    
    try {
        const messageRef = database.ref(`messages/${currentChat.id}`).push();
        await messageRef.set(message);
        
        elements.messageInput.value = '';
        showNotification('Сообщение отправлено', 'success');
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        showNotification('Ошибка отправки сообщения', 'error');
    }
}

// Добавление друга
async function addFriend(friendId) {
    try {
        if (!friendId) {
            showNotification('Введите ID пользователя', 'error');
            return;
        }
        
        // Ищем пользователя по ID
        const usersRef = database.ref('users');
        const snapshot = await usersRef.once('value');
        let friendUsername = null;
        
        snapshot.forEach(child => {
            const user = child.val();
            if (user.userid === friendId) {
                friendUsername = user.username;
            }
        });
        
        if (!friendUsername) {
            showNotification('Пользователь с таким ID не найден', 'error');
            return;
        }
        
        if (friendUsername === currentUser.username) {
            showNotification('Нельзя добавить самого себя', 'error');
            return;
        }
        
        // Создаем чат
        const chatId = generateChatId(currentUser.username, friendUsername);
        
        // Добавляем чат обоим пользователям
        await database.ref(`user_chats/${currentUser.username}/${chatId}`).set(true);
        await database.ref(`user_chats/${friendUsername}/${chatId}`).set(true);
        
        showNotification(`Пользователь ${friendUsername} добавлен в контакты`, 'success');
        
    } catch (error) {
        console.error('Ошибка добавления друга:', error);
        showNotification('Ошибка добавления друга', 'error');
    }
}

// Создание группы
async function createGroup(groupName, groupId) {
    try {
        if (!groupName) {
            showNotification('Введите название группы', 'error');
            return;
        }
        
        groupId = groupId || `group_${Date.now()}`;
        
        // Проверяем, существует ли группа
        const groupRef = database.ref(`groups/${groupId}`);
        const groupSnap = await groupRef.once('value');
        
        if (groupSnap.exists()) {
            showNotification('Группа с таким ID уже существует', 'error');
            return;
        }
        
        // Создаем группу
        await groupRef.set({
            name: groupName,
            creator: currentUser.username,
            createdAt: Date.now(),
            members: {
                [currentUser.username]: true
            }
        });
        
        // Добавляем группу в список чатов пользователя
        await database.ref(`user_chats/${currentUser.username}/${groupId}`).set(true);
        
        showNotification(`Группа "${groupName}" создана`, 'success');
        
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        showNotification('Ошибка создания группы', 'error');
    }
}

// Вход в группу
async function joinGroup(groupId) {
    try {
        if (!groupId) {
            showNotification('Введите ID группы', 'error');
            return;
        }
        
        // Проверяем, существует ли группа
        const groupRef = database.ref(`groups/${groupId}`);
        const groupSnap = await groupRef.once('value');
        
        if (!groupSnap.exists()) {
            showNotification('Группа с таким ID не найдена', 'error');
            return;
        }
        
        const group = groupSnap.val();
        
        // Проверяем, не участник ли уже пользователь
        if (group.members && group.members[currentUser.username]) {
            showNotification('Вы уже в этой группе', 'info');
            return;
        }
        
        // Добавляем пользователя в группу
        await groupRef.child(`members/${currentUser.username}`).set(true);
        
        // Добавляем группу в список чатов пользователя
        await database.ref(`user_chats/${currentUser.username}/${groupId}`).set(true);
        
        showNotification(`Вы присоединились к группе "${group.name || 'Группа'}"`, 'success');
        
    } catch (error) {
        console.error('Ошибка входа в группу:', error);
        showNotification('Ошибка входа в группу', 'error');
    }
}

// Админ-панель
async function loadAdminData() {
    if (!isAdmin) return;
    
    console.log('Загрузка данных админ-панели');
    
    try {
        // Загружаем пользователей
        const usersRef = database.ref('users');
        const usersSnap = await usersRef.once('value');
        
        const usersTable = document.getElementById('users-table');
        if (usersTable) {
            usersTable.innerHTML = '';
            
            usersSnap.forEach(child => {
                const user = child.val();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td><code>${user.userid}</code></td>
                    <td>${user.username}</td>
                    <td>${user.status || 'offline'}</td>
                    <td>${new Date(user.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-icon" onclick="adminMessageUser('${user.username}')" title="Написать">
                            <i class="fas fa-comment"></i>
                        </button>
                    </td>
                `;
                
                usersTable.appendChild(row);
            });
        }
        
        // Загружаем группы
        const groupsRef = database.ref('groups');
        const groupsSnap = await groupsRef.once('value');
        
        const groupsTable = document.getElementById('groups-admin-table');
        if (groupsTable) {
            groupsTable.innerHTML = '';
            
            groupsSnap.forEach(child => {
                const group = child.val();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td><code>${child.key}</code></td>
                    <td>${group.name || 'Группа'}</td>
                    <td>${group.creator || 'Неизвестно'}</td>
                    <td>${Object.keys(group.members || {}).length}</td>
                    <td>
                        <button class="btn-icon" onclick="adminJoinGroup('${child.key}')" title="Присоединиться">
                            <i class="fas fa-sign-in-alt"></i>
                        </button>
                    </td>
                `;
                
                groupsTable.appendChild(row);
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных админ-панели:', error);
    }
}

// Глобальные функции
window.viewImage = function(url) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');
    if (img) img.src = url;
    if (modal) modal.classList.add('active');
};

window.playVoice = function(url) {
    const audio = new Audio(url);
    audio.play().catch(error => {
        console.error('Ошибка воспроизведения голоса:', error);
        showNotification('Ошибка воспроизведения', 'error');
    });
};

window.adminMessageUser = async function(username) {
    const chatId = generateChatId(currentUser.username, username);
    await openChat(chatId, 'private');
    elements.adminModal.classList.remove('active');
};

window.adminJoinGroup = async function(groupId) {
    await openChat(groupId, 'group');
    elements.adminModal.classList.remove('active');
};

// Инициализация приложения
function initApp() {
    console.log('Инициализация приложения');
    
    // Переключение вкладок аутентификации
    if (elements.tabLogin) {
        elements.tabLogin.addEventListener('click', () => switchAuthTab('login'));
    }
    
    if (elements.tabRegister) {
        elements.tabRegister.addEventListener('click', () => switchAuthTab('register'));
    }
    
    // Форма входа
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = elements.loginUsername.value.trim();
            const password = elements.loginPassword.value;
            
            if (await login(username, password)) {
                console.log('Вход выполнен успешно');
            }
        });
    }
    
    // Форма регистрации
    if (elements.registerForm) {
        elements.registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = elements.registerUsername.value.trim();
            const userid = elements.registerUserid.value.trim();
            const password = elements.registerPassword.value;
            const confirmPassword = elements.registerConfirm.value;
            
            await register(username, userid, password, confirmPassword);
        });
    }
    
    // Отправка сообщений
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', sendMessage);
    }
    
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Меню на мобильных устройствах
    if (elements.menuToggle) {
        elements.menuToggle.addEventListener('click', () => {
            elements.sidebar.classList.toggle('active');
        });
    }
    
    // Кнопка админ-панели
    if (elements.adminPanelBtn) {
        elements.adminPanelBtn.addEventListener('click', () => {
            elements.adminModal.classList.add('active');
            loadAdminData();
        });
    }
    
    // Закрытие модальных окон
    elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });
    
    // Закрытие модальных окон при клике вне их
    elements.modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Добавление друга
    const addFriendConfirm = document.getElementById('add-friend-confirm');
    if (addFriendConfirm) {
        addFriendConfirm.addEventListener('click', async () => {
            const friendId = document.getElementById('friend-id-input').value.trim();
            await addFriend(friendId);
            elements.addFriendModal.classList.remove('active');
        });
    }
    
    // Создание группы
    const createGroupConfirm = document.getElementById('create-group-confirm');
    if (createGroupConfirm) {
        createGroupConfirm.addEventListener('click', async () => {
            const groupName = document.getElementById('group-name-input').value.trim();
            const groupId = document.getElementById('group-id-input').value.trim();
            await createGroup(groupName, groupId);
            elements.createGroupModal.classList.remove('active');
        });
    }
    
    // Вход в группу
    const joinGroupConfirm = document.getElementById('join-group-confirm');
    if (joinGroupConfirm) {
        joinGroupConfirm.addEventListener('click', async () => {
            const groupId = document.getElementById('join-group-id-input').value.trim();
            await joinGroup(groupId);
            elements.joinGroupModal.classList.remove('active');
        });
    }
    
    // Смена вкладок сайдбара
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchSidebarTab(tabName);
        });
    });
    
    // Смена вкладок админ-панели
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchAdminTab(tabName);
        });
    });
    
    // Проверяем, был ли пользователь уже авторизован
    checkAutoLogin();
}

function switchAuthTab(tab) {
    console.log('Переключение вкладки:', tab);
    
    if (elements.tabLogin && elements.tabRegister) {
        elements.tabLogin.classList.toggle('active', tab === 'login');
        elements.tabRegister.classList.toggle('active', tab === 'register');
    }
    
    if (elements.loginForm && elements.registerForm) {
        elements.loginForm.style.display = tab === 'login' ? 'block' : 'none';
        elements.registerForm.style.display = tab === 'register' ? 'block' : 'none';
    }
    
    if (elements.authError) {
        elements.authError.textContent = '';
    }
}

function switchSidebarTab(tab) {
    console.log('Переключение вкладки сайдбара:', tab);
    
    const tabs = document.querySelectorAll('.sidebar-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.sidebar-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`${tab}-tab`)?.classList.add('active');
}

function switchAdminTab(tab) {
    console.log('Переключение вкладки админ-панели:', tab);
    
    const tabs = document.querySelectorAll('.admin-tab');
    const panes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));
    
    document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`${tab}-tab`)?.classList.add('active');
}

async function checkAutoLogin() {
    // Проверяем сохраненные данные в localStorage
    const savedUser = localStorage.getItem('max_current_user');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            // Пытаемся войти с сохраненными данными
            if (await login(userData.username, userData.password)) {
                showNotification('Автоматический вход выполнен', 'success');
            } else {
                // Очищаем неверные данные
                localStorage.removeItem('max_current_user');
            }
        } catch (error) {
            console.error('Ошибка автоматического входа:', error);
            localStorage.removeItem('max_current_user');
        }
    }
}

// Сохраняем данные пользователя при успешном входе
function saveUserData(username, password) {
    localStorage.setItem('max_current_user', JSON.stringify({
        username: username,
        password: password,
        timestamp: Date.now()
    }));
}

// Обновляем функцию login для сохранения данных
async function login(username, password) {
    try {
        console.log('Попытка входа:', username);
        
        // Проверка администратора
        if (username === 'мокасин' && password === '123321') {
            console.log('Вход как администратор');
            currentUser = {
                uid: '123',
                username: 'мокасин',
                userid: '123',
                isAdmin: true,
                status: 'online'
            };
            isAdmin = true;
            
            // Сохраняем в базу данных
            await database.ref(`users/мокасин`).set({
                username: 'мокасин',
                userid: '123',
                password: '123321',
                isAdmin: true,
                status: 'online',
                createdAt: Date.now()
            });
            
            // Сохраняем в localStorage
            saveUserData(username, password);
            
            await initializeUser();
            return true;
        }
        
        // Проверка обычного пользователя
        const userRef = database.ref(`users/${username}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            showNotification('Пользователь не найден', 'error');
            return false;
        }
        
        const userData = snapshot.val();
        console.log('Данные пользователя:', userData);
        
        if (userData.password !== password) {
            showNotification('Неверный пароль', 'error');
            return false;
        }
        
        currentUser = {
            uid: userData.userid || username,
            username: username,
            userid: userData.userid || username,
            isAdmin: userData.isAdmin || false,
            status: 'online'
        };
        
        isAdmin = currentUser.isAdmin;
        
        // Обновляем статус
        await userRef.update({
            status: 'online',
            lastSeen: Date.now()
        });
        
        // Сохраняем в localStorage
        saveUserData(username, password);
        
        await initializeUser();
        return true;
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification('Ошибка входа: ' + error.message, 'error');
        return false;
    }
}

// Запускаем приложение
document.addEventListener('DOMContentLoaded', initApp);

// Экспортируем функции для использования в консоли
window.login = login;
window.logout = logout;
window.sendMessage = sendMessage;
window.addFriend = addFriend;
window.createGroup = createGroup;
window.joinGroup = joinGroup;
window.loadAdminData = loadAdminData;
