// Инициализация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC0QrE4gjjV7ZU7x8IzmCcr6EYQSCMjAbg",
    authDomain: "max-pinlab.firebaseapp.com",
    databaseURL: "https://max-pinlab-default-rtdb.firebaseio.com",
    projectId: "max-pinlab",
    storageBucket: "max-pinlab.firebasestorage.app",
    messagingSenderId: "708865541327",
    appId: "1:708865541327:web:8cf92cffebc1c3c63e23ba",
    measurementId: "G-44D7FE0GJV"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let currentTab = 'chats';
let isAdmin = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let callPeerConnection = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let isMuted = false;
let typingTimeout = null;

// DOM элементы
const elements = {
    // Аутентификация
    authScreen: document.getElementById('auth-screen'),
    app: document.getElementById('app'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    registerUsername: document.getElementById('register-username'),
    registerUserid: document.getElementById('register-userid'),
    registerPassword: document.getElementById('register-password'),
    registerConfirm: document.getElementById('register-confirm'),
    authError: document.getElementById('auth-error'),
    
    // Верхняя панель
    menuToggle: document.getElementById('menu-toggle'),
    currentChatName: document.getElementById('current-chat-name'),
    currentChatAvatar: document.getElementById('current-chat-avatar'),
    chatStatus: document.getElementById('chat-status'),
    callBtn: document.getElementById('call-btn'),
    adminPanelBtn: document.getElementById('admin-panel-btn'),
    userMenuBtn: document.getElementById('user-menu-btn'),
    dropdownMenu: document.querySelector('.dropdown-menu'),
    
    // Сайдбар
    sidebar: document.getElementById('sidebar'),
    usernameDisplay: document.getElementById('username-display'),
    userAvatar: document.getElementById('user-avatar'),
    userStatus: document.getElementById('user-status'),
    searchInput: document.getElementById('search-input'),
    
    // Списки
    sidebarTabs: document.querySelectorAll('.sidebar-tab'),
    chatsList: document.getElementById('chats-list'),
    contactsList: document.getElementById('contacts-list'),
    groupsList: document.getElementById('groups-list'),
    
    // Чат
    chatMessages: document.getElementById('chat-messages'),
    typingIndicator: document.getElementById('typing-indicator'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    attachFileBtn: document.getElementById('attach-file-btn'),
    attachImageBtn: document.getElementById('attach-image-btn'),
    voiceRecordBtn: document.getElementById('voice-record-btn'),
    fileInput: document.getElementById('file-input'),
    imageInput: document.getElementById('image-input'),
    
    // Модальные окна
    modals: document.querySelectorAll('.modal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),
    
    // Админ панель
    adminModal: document.getElementById('admin-modal'),
    adminTabs: document.querySelectorAll('.admin-tab'),
    usersTable: document.getElementById('users-table'),
    groupsAdminTable: document.getElementById('groups-admin-table'),
    chatsAdminTable: document.getElementById('chats-admin-table'),
    
    // Профиль
    profileModal: document.getElementById('profile-modal'),
    profileUsername: document.getElementById('profile-username'),
    profileUserid: document.getElementById('profile-userid'),
    profileStatus: document.getElementById('profile-status'),
    
    // Звонки
    callModal: document.getElementById('call-modal'),
    voiceModal: document.getElementById('voice-modal'),
    imageModal: document.getElementById('image-modal')
};

// Утилиты
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.getElementById('notifications').appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // Сегодня
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) { // На этой неделе
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

function generateChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Аутентификация
async function login(username, password) {
    try {
        if (username === 'мокасин' && password === '123321') {
            // Администратор
            currentUser = {
                uid: '123',
                username: 'мокасин',
                userid: '123',
                isAdmin: true,
                status: 'online'
            };
            isAdmin = true;
            await initializeUser();
            return true;
        }
        
        // Проверка в базе данных
        const userRef = database.ref(`users/${username}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            throw new Error('Пользователь не найден');
        }
        
        const userData = snapshot.val();
        
        if (userData.password !== password) {
            throw new Error('Неверный пароль');
        }
        
        if (userData.banned) {
            throw new Error('Аккаунт заблокирован');
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
        console.error('Login error:', error);
        elements.authError.textContent = error.message;
        return false;
    }
}

async function register(username, userid, password, confirmPassword) {
    try {
        if (!username || !userid || !password) {
            throw new Error('Заполните все поля');
        }
        
        if (password !== confirmPassword) {
            throw new Error('Пароли не совпадают');
        }
        
        if (password.length < 6) {
            throw new Error('Пароль должен быть не менее 6 символов');
        }
        
        // Проверка уникальности
        const usernameRef = database.ref(`users/${username}`);
        const useridRef = database.ref(`userids/${userid}`);
        
        const [usernameSnap, useridSnap] = await Promise.all([
            usernameRef.once('value'),
            useridRef.once('value')
        ]);
        
        if (usernameSnap.exists()) {
            throw new Error('Этот никнейм уже занят');
        }
        
        if (useridSnap.exists()) {
            throw new Error('Этот ID уже занят');
        }
        
        // Создаем пользователя
        await usernameRef.set({
            userid: userid,
            password: password,
            username: username,
            status: 'online',
            createdAt: Date.now(),
            lastSeen: Date.now(),
            isAdmin: false
        });
        
        await useridRef.set({
            username: username
        });
        
        showNotification('Регистрация успешна!', 'success');
        switchAuthTab('login');
        
    } catch (error) {
        console.error('Register error:', error);
        elements.authError.textContent = error.message;
    }
}

async function logout() {
    if (currentUser) {
        const userRef = database.ref(`users/${currentUser.username}`);
        await userRef.update({
            status: 'offline',
            lastSeen: Date.now()
        });
    }
    
    currentUser = null;
    isAdmin = false;
    elements.authScreen.style.display = 'flex';
    elements.app.style.display = 'none';
    window.location.reload();
}

// Инициализация пользователя
async function initializeUser() {
    // Скрываем экран аутентификации
    elements.authScreen.style.display = 'none';
    elements.app.style.display = 'flex';
    
    // Обновляем информацию о пользователе
    elements.usernameDisplay.textContent = currentUser.username;
    elements.userStatus.textContent = 'В сети';
    elements.userStatus.className = 'user-status online';
    
    // Показываем кнопку админ-панели для администратора
    if (isAdmin) {
        elements.adminPanelBtn.style.display = 'block';
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
    
    // Слушаем изменения статуса контактов
    const contactsRef = database.ref('users');
    contactsRef.on('value', (snapshot) => {
        snapshot.forEach((child) => {
            const user = child.val();
            if (user.username !== currentUser.username) {
                updateContactStatus(user.username, user.status);
            }
        });
    });
}

// Загрузка контактов
async function loadContacts() {
    const contactsRef = database.ref('users');
    contactsRef.on('value', (snapshot) => {
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
    contactItem.dataset.userid = user.userid;
    
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

function updateContactStatus(username, status) {
    const contactItem = document.querySelector(`.contact-item[data-username="${username}"] .item-status`);
    if (contactItem) {
        contactItem.className = `item-status ${status === 'online' ? 'online' : 'offline'}`;
    }
}

// Загрузка чатов
async function loadChats() {
    if (!currentUser) return;
    
    const chatsRef = database.ref(`user_chats/${currentUser.username}`);
    chatsRef.on('value', async (snapshot) => {
        elements.chatsList.innerHTML = '';
        const chats = snapshot.val() || {};
        
        for (const chatId in chats) {
            await addChatToList(chatId, chats[chatId]);
        }
    });
}

async function addChatToList(chatId, chatData) {
    let chatName = '';
    let lastMessage = '';
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
        const otherUsername = chatId.split('_').find(u => u !== currentUser.username);
        if (otherUsername) {
            const userRef = database.ref(`users/${otherUsername}`);
            const userSnap = await userRef.once('value');
            if (userSnap.exists()) {
                const user = userSnap.val();
                chatName = user.username || otherUsername;
            }
        }
    }
    
    // Получаем последнее сообщение
    const messagesRef = database.ref(`messages/${chatId}`).limitToLast(1);
    messagesRef.once('value', (snapshot) => {
        snapshot.forEach((child) => {
            const message = child.val();
            lastMessage = message.text || (message.type === 'image' ? '📷 Изображение' : 
                         message.type === 'file' ? '📎 Файл' : 
                         message.type === 'voice' ? '🎤 Голосовое сообщение' : '');
        });
    });
    
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.chatId = chatId;
    
    chatItem.innerHTML = `
        <div class="item-avatar">
            <i class="fas ${isGroup ? 'fa-users' : 'fa-user'}"></i>
        </div>
        <div class="item-info">
            <div class="item-name">${chatName}</div>
            <div class="item-last-message">${lastMessage}</div>
        </div>
        <div class="item-time">${formatTime(Date.now())}</div>
    `;
    
    chatItem.addEventListener('click', () => openChat(chatId, isGroup ? 'group' : 'private'));
    elements.chatsList.appendChild(chatItem);
}

// Загрузка групп
async function loadGroups() {
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
                elements.chatStatus.textContent = user.status === 'online' ? 'онлайн' : 'был(а) недавно';
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
    
    // Слушаем набор текста
    const typingRef = database.ref(`typing/${chatId}/${currentUser.username}`);
    typingRef.onDisconnect().remove();
    
    elements.messageInput.addEventListener('input', () => {
        typingRef.set(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typingRef.remove();
        }, 1000);
    });
    
    // Слушаем набор текста других пользователей
    database.ref(`typing/${chatId}`).on('value', (snapshot) => {
        const typers = [];
        snapshot.forEach((child) => {
            if (child.key !== currentUser.username) {
                typers.push(child.key);
            }
        });
        
        if (typers.length > 0) {
            elements.typingIndicator.style.display = 'flex';
            elements.typingIndicator.querySelector('span').textContent = 
                `${typers.join(', ')} печатает${typers.length > 1 ? 'ют' : ''}...`;
        } else {
            elements.typingIndicator.style.display = 'none';
        }
    });
}

function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === currentUser.username ? 'my-message' : 'other-message'}`;
    
    let content = '';
    
    switch (message.type) {
        case 'text':
            content = `<div class="message-text">${message.text}</div>`;
            break;
            
        case 'image':
            content = `
                <div class="message-text">${message.text || ''}</div>
                <img src="${message.url}" alt="Изображение" class="message-image" onclick="viewImage('${message.url}')">
            `;
            break;
            
        case 'file':
            content = `
                <div class="message-text">${message.text || ''}</div>
                <div class="message-file">
                    <i class="fas fa-file"></i>
                    <a href="${message.url}" download="${message.filename}">${message.filename}</a>
                    <span>(${(message.size / 1024).toFixed(1)} KB)</span>
                </div>
            `;
            break;
            
        case 'voice':
            content = `
                <div class="message-text">${message.text || ''}</div>
                <div class="message-voice">
                    <button class="voice-control" onclick="playVoice('${message.url}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <span class="voice-duration">${message.duration || 0}s</span>
                </div>
            `;
            break;
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
    if (!currentChat || !elements.messageInput.value.trim()) return;
    
    const message = {
        sender: currentUser.username,
        text: elements.messageInput.value.trim(),
        type: 'text',
        timestamp: Date.now()
    };
    
    const messageRef = database.ref(`messages/${currentChat.id}`).push();
    await messageRef.set(message);
    
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
}

async function sendFile(file, type) {
    if (!currentChat) return;
    
    try {
        // Загружаем файл в Storage
        const storageRef = storage.ref(`chat_files/${currentChat.id}/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload progress:', progress);
            },
            (error) => {
                console.error('Upload error:', error);
                showNotification('Ошибка загрузки файла', 'error');
            },
            async () => {
                const url = await uploadTask.snapshot.ref.getDownloadURL();
                
                const message = {
                    sender: currentUser.username,
                    type: type,
                    url: url,
                    filename: file.name,
                    size: file.size,
                    timestamp: Date.now()
                };
                
                if (type === 'image') {
                    message.text = '📷 Изображение';
                } else if (type === 'voice') {
                    message.duration = recordingSeconds;
                    message.text = '🎤 Голосовое сообщение';
                } else {
                    message.text = '📎 Файл';
                }
                
                const messageRef = database.ref(`messages/${currentChat.id}`).push();
                await messageRef.set(message);
                
                showNotification('Файл отправлен', 'success');
            }
        );
        
    } catch (error) {
        console.error('Send file error:', error);
        showNotification('Ошибка отправки файла', 'error');
    }
}

// Голосовые сообщения
async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordingSeconds = 0;
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.start();
        
        // Показываем модалку записи
        elements.voiceModal.classList.add('active');
        
        // Запускаем таймер
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const minutes = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
            const seconds = (recordingSeconds % 60).toString().padStart(2, '0');
            document.getElementById('voice-timer').textContent = `${minutes}:${seconds}`;
        }, 1000);
        
    } catch (error) {
        console.error('Voice recording error:', error);
        showNotification('Ошибка доступа к микрофону', 'error');
    }
}

async function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    elements.voiceModal.classList.remove('active');
}

async function sendVoiceMessage() {
    if (audioChunks.length === 0) return;
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
    
    await sendFile(audioFile, 'voice');
    
    // Сбрасываем запись
    audioChunks = [];
    recordingSeconds = 0;
}

// Звонки
async function startCall() {
    if (!currentChat || currentChat.type !== 'private') return;
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        callPeerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            callPeerConnection.addTrack(track, localStream);
        });
        
        // Получаем удаленный поток
        callPeerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            document.getElementById('remote-audio').srcObject = remoteStream;
        };
        
        // Создаем предложение
        const offer = await callPeerConnection.createOffer();
        await callPeerConnection.setLocalDescription(offer);
        
        // Сохраняем в базу
        const callRef = database.ref(`calls/${currentChat.id}`);
        await callRef.set({
            from: currentUser.username,
            offer: offer,
            timestamp: Date.now(),
            status: 'calling'
        });
        
        // Слушаем ответ
        callRef.on('value', async (snapshot) => {
            const callData = snapshot.val();
            if (callData && callData.answer && !callPeerConnection.remoteDescription) {
                await callPeerConnection.setRemoteDescription(new RTCSessionDescription(callData.answer));
            }
            
            if (callData && callData.status === 'ended') {
                endCall();
            }
        });
        
        // Показываем модалку звонка
        isInCall = true;
        elements.callModal.classList.add('active');
        document.getElementById('call-username').textContent = elements.currentChatName.textContent;
        document.getElementById('call-status').textContent = 'Вызов...';
        
    } catch (error) {
        console.error('Call error:', error);
        showNotification('Ошибка начала звонка', 'error');
        endCall();
    }
}

function endCall() {
    if (callPeerConnection) {
        callPeerConnection.close();
        callPeerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (currentChat) {
        database.ref(`calls/${currentChat.id}`).set({
            status: 'ended'
        });
    }
    
    isInCall = false;
    elements.callModal.classList.remove('active');
}

// Слушатель входящих звонков
function setupCallListener() {
    if (!currentUser) return;
    
    database.ref('calls').on('child_added', async (snapshot) => {
        const callData = snapshot.val();
        const chatId = snapshot.key;
        
        if (chatId.includes(currentUser.username) && callData.from !== currentUser.username && callData.status === 'calling') {
            // Входящий звонок
            const accept = confirm(`${callData.from} звонит вам. Принять звонок?`);
            
            if (accept) {
                try {
                    // Принимаем звонок
                    currentChat = { id: chatId, type: 'private' };
                    await openChat(chatId, 'private');
                    
                    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    callPeerConnection = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });
                    
                    localStream.getTracks().forEach(track => {
                        callPeerConnection.addTrack(track, localStream);
                    });
                    
                    callPeerConnection.ontrack = (event) => {
                        remoteStream = event.streams[0];
                        document.getElementById('remote-audio').srcObject = remoteStream;
                    };
                    
                    await callPeerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
                    
                    const answer = await callPeerConnection.createAnswer();
                    await callPeerConnection.setLocalDescription(answer);
                    
                    await database.ref(`calls/${chatId}`).update({
                        answer: answer,
                        status: 'connected'
                    });
                    
                    isInCall = true;
                    elements.callModal.classList.add('active');
                    document.getElementById('call-username').textContent = callData.from;
                    document.getElementById('call-status').textContent = 'Разговор';
                    
                } catch (error) {
                    console.error('Accept call error:', error);
                    showNotification('Ошибка приема звонка', 'error');
                    endCall();
                }
            } else {
                // Отклоняем звонок
                await database.ref(`calls/${chatId}`).update({
                    status: 'rejected'
                });
            }
        }
    });
}

// Админ-панель
async function loadAdminData() {
    if (!isAdmin) return;
    
    // Загружаем пользователей
    const usersRef = database.ref('users');
    usersRef.on('value', (snapshot) => {
        elements.usersTable.innerHTML = '';
        snapshot.forEach((child) => {
            const user = child.val();
            addUserToAdminTable(child.key, user);
        });
    });
    
    // Загружаем группы
    const groupsRef = database.ref('groups');
    groupsRef.on('value', (snapshot) => {
        elements.groupsAdminTable.innerHTML = '';
        snapshot.forEach((child) => {
            const group = child.val();
            addGroupToAdminTable(child.key, group);
        });
    });
    
    // Загружаем чаты
    const chatsRef = database.ref('messages');
    chatsRef.on('value', (snapshot) => {
        elements.chatsAdminTable.innerHTML = '';
        snapshot.forEach((child) => {
            addChatToAdminTable(child.key);
        });
    });
}

function addUserToAdminTable(username, user) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td><code>${user.userid}</code></td>
        <td>${username}</td>
        <td>
            <span class="item-status ${user.status === 'online' ? 'online' : 'offline'}"></span>
            ${user.status === 'online' ? 'В сети' : 'Не в сети'}
        </td>
        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
        <td>
            <button class="btn-icon" onclick="adminMessageUser('${username}')" title="Написать">
                <i class="fas fa-comment"></i>
            </button>
            ${!user.isAdmin ? `
                <button class="btn-icon" onclick="adminBanUser('${username}')" title="Заблокировать">
                    <i class="fas fa-ban"></i>
                </button>
                <button class="btn-icon" onclick="adminDeleteUser('${username}')" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </td>
    `;
    
    elements.usersTable.appendChild(row);
}

function addGroupToAdminTable(groupId, group) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td><code>${groupId}</code></td>
        <td>${group.name || 'Группа'}</td>
        <td>${group.creator || 'Неизвестно'}</td>
        <td>${Object.keys(group.members || {}).length}</td>
        <td>
            <button class="btn-icon" onclick="adminJoinGroup('${groupId}')" title="Присоединиться">
                <i class="fas fa-sign-in-alt"></i>
            </button>
            <button class="btn-icon" onclick="adminDeleteGroup('${groupId}')" title="Удалить">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    elements.groupsAdminTable.appendChild(row);
}

async function addChatToAdminTable(chatId) {
    let chatInfo = '';
    let participants = [];
    
    if (chatId.startsWith('group_')) {
        chatInfo = 'Группа';
        const groupRef = database.ref(`groups/${chatId}`);
        const groupSnap = await groupRef.once('value');
        if (groupSnap.exists()) {
            const group = groupSnap.val();
            participants = Object.keys(group.members || {});
        }
    } else {
        chatInfo = 'Личный чат';
        participants = chatId.split('_');
    }
    
    // Получаем последнее сообщение
    let lastMessage = '';
    const messagesRef = database.ref(`messages/${chatId}`).limitToLast(1);
    const messagesSnap = await messagesRef.once('value');
    messagesSnap.forEach((child) => {
        const message = child.val();
        lastMessage = message.text || 'Медиа-сообщение';
    });
    
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td><code>${chatId}</code></td>
        <td>${chatInfo}</td>
        <td>${participants.join(', ')}</td>
        <td>${lastMessage.substring(0, 30)}${lastMessage.length > 30 ? '...' : ''}</td>
        <td>
            <button class="btn-icon" onclick="adminJoinChat('${chatId}')" title="Присоединиться">
                <i class="fas fa-sign-in-alt"></i>
            </button>
            <button class="btn-icon" onclick="adminClearChat('${chatId}')" title="Очистить">
                <i class="fas fa-broom"></i>
            </button>
        </td>
    `;
    
    elements.chatsAdminTable.appendChild(row);
}

// Админ-действия
async function adminMessageUser(username) {
    const chatId = generateChatId(currentUser.username, username);
    await openChat(chatId, 'private');
    elements.adminModal.classList.remove('active');
}

async function adminJoinGroup(groupId) {
    await openChat(groupId, 'group');
    elements.adminModal.classList.remove('active');
}

async function adminJoinChat(chatId) {
    const type = chatId.startsWith('group_') ? 'group' : 'private';
    await openChat(chatId, type);
    elements.adminModal.classList.remove('active');
}

async function adminBanUser(username) {
    if (confirm(`Заблокировать пользователя ${username}?`)) {
        await database.ref(`users/${username}`).update({
            banned: true
        });
        showNotification(`Пользователь ${username} заблокирован`, 'success');
    }
}

async function adminDeleteUser(username) {
    if (confirm(`Удалить пользователя ${username}? Это действие нельзя отменить.`)) {
        await database.ref(`users/${username}`).remove();
        showNotification(`Пользователь ${username} удален`, 'success');
    }
}

async function adminDeleteGroup(groupId) {
    if (confirm(`Удалить группу ${groupId}?`)) {
        await database.ref(`groups/${groupId}`).remove();
        await database.ref(`messages/${groupId}`).remove();
        showNotification(`Группа удалена`, 'success');
    }
}

async function adminClearChat(chatId) {
    if (confirm(`Очистить чат ${chatId}?`)) {
        await database.ref(`messages/${chatId}`).remove();
        showNotification(`Чат очищен`, 'success');
    }
}

// Управление вкладками
function switchAuthTab(tab) {
    elements.tabLogin.classList.toggle('active', tab === 'login');
    elements.tabRegister.classList.toggle('active', tab === 'register');
    elements.loginForm.style.display = tab === 'login' ? 'block' : 'none';
    elements.registerForm.style.display = tab === 'register' ? 'block' : 'none';
    elements.authError.textContent = '';
}

function switchSidebarTab(tab) {
    elements.sidebarTabs.forEach(tabEl => {
        tabEl.classList.toggle('active', tabEl.dataset.tab === tab);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
    });
    
    currentTab = tab;
}

function switchAdminTab(tab) {
    elements.adminTabs.forEach(tabEl => {
        tabEl.classList.toggle('active', tabEl.dataset.tab === tab);
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tab}-tab`);
    });
}

// Инициализация приложения
function initApp() {
    // Переключение вкладок аутентификации
    elements.tabLogin.addEventListener('click', () => switchAuthTab('login'));
    elements.tabRegister.addEventListener('click', () => switchAuthTab('register'));
    
    // Формы аутентификации
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = elements.loginUsername.value.trim();
        const password = elements.loginPassword.value;
        
        if (await login(username, password)) {
            showNotification('Вход выполнен успешно!', 'success');
        }
    });
    
    elements.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = elements.registerUsername.value.trim();
        const userid = elements.registerUserid.value.trim();
        const password = elements.registerPassword.value;
        const confirmPassword = elements.registerConfirm.value;
        
        await register(username, userid, password, confirmPassword);
    });
    
    // Меню пользователя
    elements.userMenuBtn.addEventListener('click', () => {
        elements.dropdownMenu.style.display = 
            elements.dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        if (!elements.userMenuBtn.contains(e.target) && !elements.dropdownMenu.contains(e.target)) {
            elements.dropdownMenu.style.display = 'none';
        }
    });
    
    // Пункты меню
    document.getElementById('profile-btn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        
        elements.profileUsername.textContent = currentUser.username;
        elements.profileUserid.textContent = currentUser.userid;
        elements.profileStatus.textContent = 'В сети';
        elements.profileStatus.className = 'online';
        
        elements.profileModal.classList.add('active');
    });
    
    document.getElementById('add-friend-btn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        document.getElementById('add-friend-modal').classList.add('active');
    });
    
    document.getElementById('create-group-btn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        document.getElementById('create-group-modal').classList.add('active');
    });
    
    document.getElementById('join-group-btn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        document.getElementById('join-group-modal').classList.add('active');
    });
    
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        elements.dropdownMenu.style.display = 'none';
        logout();
    });
    
    // Кнопка админ-панели
    elements.adminPanelBtn.addEventListener('click', () => {
        elements.adminModal.classList.add('active');
        loadAdminData();
    });
    
    // Переключение вкладок сайдбара
    elements.sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchSidebarTab(tab.dataset.tab);
        });
    });
    
    // Переключение вкладок админ-панели
    elements.adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchAdminTab(tab.dataset.tab);
        });
    });
    
    // Меню на мобильных устройствах
    elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('active');
    });
    
    // Отправка сообщений
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Автоматическое изменение высоты textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Прикрепление файлов
    elements.attachFileBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.attachImageBtn.addEventListener('click', () => {
        elements.imageInput.click();
    });
    
    elements.voiceRecordBtn.addEventListener('click', startVoiceRecording);
    
    elements.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await sendFile(file, 'file');
            elements.fileInput.value = '';
        }
    });
    
    elements.imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await sendFile(file, 'image');
            elements.imageInput.value = '';
        }
    });
    
    // Звонки
    elements.callBtn.addEventListener('click', startCall);
    
    // Кнопки модальных окон
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
    
    // Голосовые сообщения
    document.getElementById('stop-voice-btn').addEventListener('click', stopVoiceRecording);
    document.getElementById('send-voice-btn').addEventListener('click', sendVoiceMessage);
    
    // Звонки
    document.getElementById('hangup-btn').addEventListener('click', endCall);
    document.getElementById('mute-call-btn').addEventListener('click', () => {
        isMuted = !isMuted;
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
        }
        document.getElementById('mute-call-btn').innerHTML = 
            `<i class="fas fa-microphone${isMuted ? '-slash' : ''}"></i>`;
    });
    
    // Добавление друга
    document.getElementById('add-friend-confirm').addEventListener('click', async () => {
        const friendId = document.getElementById('friend-id-input').value.trim();
        
        if (!friendId) {
            showNotification('Введите ID пользователя', 'error');
            return;
        }
        
        // Находим пользователя по ID
        const useridRef = database.ref(`userids/${friendId}`);
        const useridSnap = await useridRef.once('value');
        
        if (!useridSnap.exists()) {
            showNotification('Пользователь с таким ID не найден', 'error');
            return;
        }
        
        const friendUsername = useridSnap.val().username;
        
        if (friendUsername === currentUser.username) {
            showNotification('Нельзя добавить самого себя', 'error');
            return;
        }
        
        // Создаем чат
        const chatId = generateChatId(currentUser.username, friendUsername);
        
        // Добавляем чат обоим пользователям
        await database.ref(`user_chats/${currentUser.username}/${chatId}`).set(true);
        await database.ref(`user_chats/${friendUsername}/${chatId}`).set(true);
        
        document.getElementById('add-friend-modal').classList.remove('active');
        showNotification(`Пользователь ${friendUsername} добавлен в контакты`, 'success');
        document.getElementById('friend-id-input').value = '';
    });
    
    // Создание группы
    document.getElementById('create-group-confirm').addEventListener('click', async () => {
        const groupName = document.getElementById('group-name-input').value.trim();
        const groupId = document.getElementById('group-id-input').value.trim() || `group_${Date.now()}`;
        
        if (!groupName) {
            showNotification('Введите название группы', 'error');
            return;
        }
        
        // Проверяем, существует ли группа с таким ID
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
        
        document.getElementById('create-group-modal').classList.remove('active');
        showNotification(`Группа "${groupName}" создана`, 'success');
        document.getElementById('group-name-input').value = '';
        document.getElementById('group-id-input').value = '';
    });
    
    // Вход в группу
    document.getElementById('join-group-confirm').addEventListener('click', async () => {
        const groupId = document.getElementById('join-group-id-input').value.trim();
        
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
            document.getElementById('join-group-modal').classList.remove('active');
            return;
        }
        
        // Добавляем пользователя в группу
        await groupRef.child(`members/${currentUser.username}`).set(true);
        
        // Добавляем группу в список чатов пользователя
        await database.ref(`user_chats/${currentUser.username}/${groupId}`).set(true);
        
        document.getElementById('join-group-modal').classList.remove('active');
        showNotification(`Вы присоединились к группе "${group.name || 'Группа'}"`, 'success');
        document.getElementById('join-group-id-input').value = '';
    });
    
    // Копирование ID
    document.getElementById('copy-id-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(currentUser.userid)
            .then(() => showNotification('ID скопирован в буфер обмена', 'success'))
            .catch(() => showNotification('Ошибка копирования', 'error'));
    });
    
    // Админ-действия
    document.getElementById('ban-user-btn').addEventListener('click', async () => {
        const userId = document.getElementById('ban-user-id').value.trim();
        if (!userId) return;
        
        // Находим пользователя по ID
        const useridRef = database.ref(`userids/${userId}`);
        const useridSnap = await useridRef.once('value');
        
        if (!useridSnap.exists()) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        const username = useridSnap.val().username;
        await adminBanUser(username);
        document.getElementById('ban-user-id').value = '';
    });
    
    document.getElementById('mute-user-btn').addEventListener('click', async () => {
        const userId = document.getElementById('mute-user-id').value.trim();
        const duration = document.getElementById('mute-duration').value;
        
        if (!userId) return;
        
        // Находим пользователя по ID
        const useridRef = database.ref(`userids/${userId}`);
        const useridSnap = await useridRef.once('value');
        
        if (!useridSnap.exists()) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        const username = useridSnap.val().username;
        const muteUntil = Date.now() + (duration * 1000);
        
        await database.ref(`muted_users/${username}`).set({
            mutedUntil: muteUntil,
            mutedBy: currentUser.username
        });
        
        showNotification(`Пользователь ${username} замучен до ${new Date(muteUntil).toLocaleString()}`, 'success');
        document.getElementById('mute-user-id').value = '';
    });
    
    document.getElementById('clear-chat-btn').addEventListener('click', async () => {
        const chatId = document.getElementById('clear-chat-id').value.trim();
        if (!chatId) return;
        
        await adminClearChat(chatId);
        document.getElementById('clear-chat-id').value = '';
    });
    
    document.getElementById('close-group-btn').addEventListener('click', async () => {
        const groupId = document.getElementById('close-group-id').value.trim();
        if (!groupId) return;
        
        if (confirm(`Закрыть группу ${groupId} для новых участников?`)) {
            await database.ref(`groups/${groupId}/closed`).set(true);
            showNotification('Группа закрыта', 'success');
            document.getElementById('close-group-id').value = '';
        }
    });
    
    // Слушатель звонков
    setupCallListener();
    
    // Автоматический вход если есть сохраненные данные
    const savedUser = localStorage.getItem('max_user');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        elements.loginUsername.value = userData.username;
        elements.loginPassword.value = userData.password;
    }
}

// Глобальные функции для использования в HTML
window.viewImage = function(url) {
    document.getElementById('modal-image').src = url;
    elements.imageModal.classList.add('active');
};

window.playVoice = function(url) {
    const audio = new Audio(url);
    audio.play();
};

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
