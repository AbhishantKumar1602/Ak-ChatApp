console.log('✅ users.js loaded');
// --- Browser Push Notification Logic ---
function requestNotificationPermission() {
    if ('Notification' in window) {
        console.log('Notification permission:', Notification.permission);
        if (Notification.permission === 'default') {
            Notification.requestPermission().then((perm) => {
                console.log('Notification permission result:', perm);
            });
        }
    }
}
function showBrowserNotification(title, body) {
    if ('Notification' in window) {
        console.log('Trying to show notification. Permission:', Notification.permission, 'Title:', title, 'Body:', body);
        if (Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }
}
requestNotificationPermission();
window.socket = window.socket || io();
if (window.me) {
    window.socket.emit('register user', window.me);
}
const UPDATE_INTERVAL = 500;
let allUsers = [];
const userListElement = document.getElementById('user-list');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
const loadingState = document.querySelector('.loading');
// --- FRIEND SYSTEM LOGIC ---
const notifBadge = document.getElementById('notifBadge');
const friendRequestsModal = document.getElementById('friendRequestsModal');
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}
function getInitials(username) {
    return username.substring(0, 2).toUpperCase();
}
function truncateMessage(message, maxLength = 35) {
    if (!message || message.length <= maxLength) return message || 'No messages yet';
    return message.substring(0, maxLength) + '...';
}
function createUserRow(user) {
    const row = document.createElement('li');
    row.className = 'user-row';
    row.setAttribute('data-username', user.username);
    const unreadBadge = user.unreadCount > 0 
        ? `<span class="unread-badge">${user.unreadCount}</span>` 
        : '';
    const statusIndicator = user.online 
        ? '<span class="status-indicator"></span>' 
        : '<span class="status-indicator offline"></span>';
    const messageStatus = user.lastMessageSent ? '✓' : '';
    row.innerHTML = `
        <a href="/chat?user=${encodeURIComponent(user.username)}" 
           class="user-link">
            <div class="profile-badge">
                ${getInitials(user.username)}
                ${statusIndicator}
            </div>
            <div class="user-info">
                <div class="user-name">
                    ${user.username}
                </div>
                <div class="last-message">
                    <span class="message-status">${messageStatus}</span>
                    ${truncateMessage(user.lastMessage)}
                </div>
            </div>
        </a>
        <div class="right-info">
            <span class="last-time">${formatTime(user.lastTime)}</span>
            ${unreadBadge}
        </div>
    `;
    return row;
}
function renderUserList(users) {
    userListElement.innerHTML = '';
    loadingState.classList.remove('show');
    if (users.length === 0) {
        emptyState.classList.add('show');
        return;
    }
    emptyState.classList.remove('show');
    users.forEach(user => {
        const row = createUserRow(user);
        userListElement.appendChild(row);
    });
}
function filterUsers(searchTerm) {
    const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.lastMessage && user.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    renderUserList(filtered);
}
async function fetchContacts() {
    const res = await fetch('/api/contacts');
    if (res.ok) return res.json();
    return [];
}
async function fetchAllUsers() {
    const res = await fetch('/api/userlist');
    if (res.ok) return res.json();
    return [];
}
async function fetchFriendRequests() {
    const res = await fetch('/api/friend-requests');
    if (res.ok) return res.json();
    return [];
}
async function renderAllUsersModal() {
    allUsersList.innerHTML = '<li>Loading...</li>';
    const [allUsers, contacts, requests] = await Promise.all([
        fetchAllUsers(), fetchContacts(), fetchFriendRequests()
    ]);
    const pendingFrom = requests.map(r => r.from);
    const me = window.me;
    const filtered = allUsers.filter(u =>
        u.username !== me &&
        !contacts.includes(u.username) &&
        !pendingFrom.includes(u.username)
    );
    if (filtered.length === 0) {
        allUsersList.innerHTML = '<li>No users to add</li>';
        return;
    }
    allUsersList.innerHTML = '';
    filtered.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.username + ' ';
        const btn = document.createElement('button');
        btn.textContent = 'Send Request';
        btn.onclick = async () => {
            btn.disabled = true;
            const resp = await fetch('/api/friend-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: u.username })
            });
            if (resp.ok) {
                btn.textContent = 'Requested';
            } else {
                btn.textContent = 'Error';
            }
        };
        li.appendChild(btn);
        allUsersList.appendChild(li);
    });
}
document.getElementById('addChatBtn').addEventListener('click', renderAllUsersModal);
// Render friend requests in modal and update notification badge
async function renderFriendRequests() {
    const requests = await fetchFriendRequests();
    // If there are new friend requests, show a browser notification
    if (Array.isArray(requests) && requests.length > 0) {
        // Only notify if badge is not already showing (avoid spam)
        if (notifBadge && notifBadge.textContent !== requests.length.toString()) {
            showBrowserNotification('New Friend Request', 'You have a new friend request!');
        }
    }
    // Update badge
    if (requests.length > 0) {
        notifBadge.textContent = requests.length;
        notifBadge.style.display = '';
    } else {
        notifBadge.style.display = 'none';
    }
    // Only render in modal
    const friendRequestsList = document.getElementById('friendRequestsList');
    friendRequestsList.innerHTML = '';
    if (requests.length === 0) {
        friendRequestsList.innerHTML = '<li style="text-align:center;color:#888;">No friend requests</li>';
        return;
    }
    requests.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r.from + ' ';
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept';
        acceptBtn.onclick = async () => {
            await fetch('/api/friend-request/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: r.from, accept: true })
            });
            renderFriendRequests();
            updateUserList();
        };
        const denyBtn = document.createElement('button');
        denyBtn.textContent = 'Deny';
        denyBtn.onclick = async () => {
            await fetch('/api/friend-request/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: r.from, accept: false })
            });
            renderFriendRequests();
        };
        li.appendChild(acceptBtn);
        li.appendChild(denyBtn);
        friendRequestsList.appendChild(li);
    });
}
async function updateUserList() {
    const contacts = await fetchContacts();
    const res = await fetch(`/api/userlist`);
    let users = [];
    if (res.ok) {
        users = await res.json();
    }
    const filtered = users.filter(u => contacts.includes(u.username));
    allUsers = filtered;
    const searchTerm = searchInput.value;
    if (searchTerm) {
        filterUsers(searchTerm);
    } else {
        renderUserList(allUsers);
    }
}
searchInput.addEventListener('input', (e) => {
    filterUsers(e.target.value);
});
window.socket.on('update userlist', updateUserList);
updateUserList();
renderFriendRequests();
setInterval(updateUserList, UPDATE_INTERVAL);
setInterval(renderFriendRequests, 1000); // Update every 1 second
