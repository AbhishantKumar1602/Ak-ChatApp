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
async function updateUserList() {
    try {
        const res = await fetch(`/api/userlist`);
        if (res.ok) {
            allUsers = await res.json();
            const searchTerm = searchInput.value;
            if (searchTerm) {
                filterUsers(searchTerm);
            } else {
                renderUserList(allUsers);
            }
        } else {
            console.error('Failed to fetch user list:', res.status);
        }
    } catch (error) {
        console.error('Error updating user list:', error);
        loadingState.classList.remove('show');
        emptyState.classList.add('show');
    }
}
searchInput.addEventListener('input', (e) => {
    filterUsers(e.target.value);
});
window.socket.on('update userlist', updateUserList);
updateUserList();
setInterval(updateUserList, UPDATE_INTERVAL);
