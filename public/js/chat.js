
// Full chat logic from chat.ejs
// This script expects variables 'me' and 'other' to be available globally
// You may need to set these from server-side rendering or window object

const me = window.me;
const other = window.other;
const socket = io();
if (me) {
	socket.emit('register user', me);
}

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const typingIndicator = document.getElementById('typingIndicator');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const fileBtn = document.getElementById('fileBtn');
const fileInput = document.getElementById('fileInput');
const searchBtn = document.getElementById('searchBtn');
const searchBar = document.getElementById('searchBar');
const chatSearch = document.getElementById('chatSearch');
const themeBtn = document.getElementById('themeBtn');
const statusDot = document.getElementById('statusDot');
const userStatus = document.getElementById('userStatus');
const imageViewer = document.getElementById('imageViewer');
const viewerImage = document.getElementById('viewerImage');
const viewerClose = document.getElementById('viewerClose');
let typingTimeout;
let isTyping = false;

// Theme toggle
if (themeBtn) {
	themeBtn.addEventListener('click', () => {
		document.body.classList.toggle('dark-mode');
		const isDark = document.body.classList.contains('dark-mode');
		themeBtn.textContent = isDark ? '☀️' : '🌙';
		localStorage.setItem('theme', isDark ? 'dark' : 'light');
	});
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme === 'dark') {
		document.body.classList.add('dark-mode');
		themeBtn.textContent = '☀️';
	}
}

// Search
if (searchBtn && searchBar && chatSearch) {
	searchBtn.addEventListener('click', () => {
		searchBar.classList.toggle('show');
		if (searchBar.classList.contains('show')) {
			chatSearch.focus();
		} else {
			chatSearch.value = '';
			document.querySelectorAll('.message').forEach(msg => {
				msg.style.display = 'flex';
			});
		}
	});
	chatSearch.addEventListener('input', (e) => {
		const searchTerm = e.target.value.toLowerCase();
		const messages = document.querySelectorAll('.message');
		messages.forEach(msg => {
			const text = msg.querySelector('.message-content').textContent.toLowerCase();
			if (text.includes(searchTerm) || searchTerm === '') {
				msg.style.display = 'flex';
			} else {
				msg.style.display = 'none';
			}
		});
	});
}

// User status
socket.on('user-status', (data) => {
	if (data.username === other) {
		if (data.online) {
			statusDot.classList.add('online');
			userStatus.textContent = 'Online';
		} else {
			statusDot.classList.remove('online');
			userStatus.textContent = 'Offline';
		}
	}
});

// Read receipts
socket.on('messages-read', (data) => {
	if (data.user === other) {
		document.querySelectorAll('.my-message').forEach(msg => {
			const status = msg.querySelector('.message-status');
			if (status) {
				status.textContent = '✓✓';
				status.style.color = '#4fc3f7';
			}
		});
	}
});

// Emoji functionality
const emojis = ['😊', '😂', '❤️', '👍', '🎉', '😍', '😢', '😎', '🤔', '😴', '🔥', '✨', '💯', '👏', '🙏', '💪', '🎈', '🎂', '🎁', '⭐', '🌟', '💫', '✅', '❌', '🚀', '💡', '📱', '💻', '📧', '🔔', '⏰', '☕'];
emojis.forEach(emoji => {
	const emojiSpan = document.createElement('span');
	emojiSpan.className = 'emoji-item';
	emojiSpan.textContent = emoji;
	emojiSpan.onclick = () => insertEmoji(emoji);
	emojiGrid.appendChild(emojiSpan);
});
if (emojiBtn && emojiPicker) {
	emojiBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		emojiPicker.classList.toggle('show');
	});
	document.addEventListener('click', (e) => {
		if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
			emojiPicker.classList.remove('show');
		}
	});
}
function insertEmoji(emoji) {
	messageInput.value += emoji;
	messageInput.focus();
	emojiPicker.classList.remove('show');
	sendButton.disabled = false;
}

// File upload
if (fileBtn && fileInput) {
	fileBtn.addEventListener('click', () => fileInput.click());
	fileInput.addEventListener('change', async (e) => {
		const file = e.target.files[0];
		if (!file) return;
		if (file.size > 10 * 1024 * 1024) {
			alert('File too large. Max 10MB');
			return;
		}
		const formData = new FormData();
		formData.append('file', file);
		formData.append('from', me);
		formData.append('to', other);
		try {
			const response = await fetch('/api/upload-file', {
				method: 'POST',
				body: formData
			});
			if (response.ok) {
				const data = await response.json();
				socket.emit('private message', {
					from: me,
					to: other,
					message: `📎 ${file.name}`,
					fileUrl: data.fileUrl,
					fileType: data.fileType
				});
			} else {
				const errorText = await response.text();
				alert('Failed to upload file: ' + errorText);
			}
			fileInput.value = '';
		} catch (error) {
			alert('Failed to upload file: ' + error.message);
		}
	});
}

// Chat functionality
if (messageInput && sendButton) {
	messageInput.addEventListener('input', function() {
		this.style.height = 'auto';
		this.style.height = Math.min(this.scrollHeight, 100) + 'px';
		sendButton.disabled = !this.value.trim();
		if (!isTyping && this.value.trim()) {
			socket.emit('typing', { from: me, to: other, typing: true });
			isTyping = true;
		}
		clearTimeout(typingTimeout);
		typingTimeout = setTimeout(() => {
			socket.emit('typing', { from: me, to: other, typing: false });
			isTyping = false;
		}, 1000);
	});
	sendButton.addEventListener('click', sendMessage);
	messageInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});
}
function sendMessage() {
	const message = messageInput.value.trim();
	if (message) {
		socket.emit('private message', { from: me, to: other, message });
		messageInput.value = '';
		messageInput.style.height = 'auto';
		sendButton.disabled = true;
		if (isTyping) {
			socket.emit('typing', { from: me, to: other, typing: false });
			isTyping = false;
		}
	}
}

socket.on('typing', (data) => {
	if (data.from === other && data.to === me) {
		if (data.typing) {
			typingIndicator.classList.add('show');
			chatMessages.appendChild(typingIndicator);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		} else {
			typingIndicator.classList.remove('show');
		}
	}
});

function formatTime(timestamp) {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function reactToMessage(btn, reaction) {
	const messageDiv = btn.closest('.message');
	let reactionDisplay = messageDiv.querySelector('.message-reaction-display');
	if (!reactionDisplay) {
		reactionDisplay = document.createElement('div');
		reactionDisplay.className = 'message-reaction-display';
		messageDiv.querySelector('.message-content').appendChild(reactionDisplay);
	}
	reactionDisplay.textContent = reaction;
	socket.emit('message-reaction', {
		from: me,
		to: other,
		reaction: reaction,
		messageId: messageDiv.dataset.messageId
	});
}
function appendMessage(sender, msg, time, status = 'sent', fileUrl = null, fileType = null, messageId = null, reactions = []) {
	const isMe = sender === me;
	const messageDiv = document.createElement('div');
	messageDiv.className = 'message ' + (isMe ? 'my-message' : 'other-message');
	messageDiv.dataset.messageId = messageId || Date.now();
	const contentDiv = document.createElement('div');
	contentDiv.className = 'message-content';
	if (fileUrl && fileType) {
		if (fileType.startsWith('image/')) {
			const img = document.createElement('img');
			img.src = fileUrl;
			img.alt = 'Image attachment';
			img.onclick = (e) => {
				e.preventDefault();
				viewerImage.src = fileUrl;
				imageViewer.classList.add('show');
			};
			contentDiv.appendChild(img);
			if (msg && !msg.startsWith('📎')) {
				const caption = document.createElement('div');
				caption.textContent = msg;
				caption.style.marginTop = '8px';
				contentDiv.appendChild(caption);
			}
		} else if (fileType.startsWith('video/')) {
			const video = document.createElement('video');
			video.src = fileUrl;
			video.controls = true;
			contentDiv.appendChild(video);
			if (msg && !msg.startsWith('📎')) {
				const caption = document.createElement('div');
				caption.textContent = msg;
				caption.style.marginTop = '8px';
				contentDiv.appendChild(caption);
			}
		} else {
			const docLink = document.createElement('a');
			docLink.href = fileUrl;
			docLink.target = '_blank';
			docLink.className = 'file-container';
			docLink.style.textDecoration = 'none';
			docLink.style.color = 'inherit';
			docLink.style.cursor = 'pointer';
			const fileIcon = document.createElement('span');
			fileIcon.className = 'file-icon';
			fileIcon.textContent = '📄';
			const fileName = document.createElement('div');
			fileName.textContent = msg.replace('📎 ', '');
			docLink.appendChild(fileIcon);
			docLink.appendChild(fileName);
			contentDiv.appendChild(docLink);
		}
	} else {
		contentDiv.textContent = msg;
	}
	const footerDiv = document.createElement('div');
	footerDiv.className = 'message-footer';
	const timeSpan = document.createElement('span');
	timeSpan.textContent = formatTime(time);
	footerDiv.appendChild(timeSpan);
	if (isMe) {
		const statusSpan = document.createElement('span');
		statusSpan.className = 'message-status';
		if (status === 'read') {
			statusSpan.textContent = '✓✓';
			statusSpan.title = 'Read';
			statusSpan.style.color = '#4fc3f7';
		} else if (status === 'sending') {
			statusSpan.textContent = '⏳';
			statusSpan.title = 'Sending';
		} else {
			statusSpan.textContent = '✓';
			statusSpan.title = 'Sent';
		}
		footerDiv.appendChild(statusSpan);
	}
	// WhatsApp-style reaction display (show all unique emojis with counts)
	let reactionDisplay = null;
	if (reactions && reactions.length > 0) {
		reactionDisplay = document.createElement('div');
		reactionDisplay.className = 'message-reaction-display';
		// Count reactions by emoji
		const counts = {};
		reactions.forEach(r => {
			if (!counts[r.emoji]) counts[r.emoji] = 0;
			counts[r.emoji]++;
		});
		// Show each emoji with count
		reactionDisplay.innerHTML = Object.entries(counts).map(([emoji, count]) =>
			`<span class="reaction-emoji">${emoji}${count > 1 ? ' ' + count : ''}</span>`
		).join(' ');
		contentDiv.appendChild(reactionDisplay);
	}
	// Floating reactions bar
	const reactionsDiv = document.createElement('div');
	reactionsDiv.className = 'message-reactions';
	['❤️', '👍', '😂', '😮', '😢', '🔥'].forEach(emoji => {
		const reactBtn = document.createElement('button');
		reactBtn.className = 'react-btn';
		reactBtn.textContent = emoji;
		reactBtn.onclick = (e) => {
			e.stopPropagation();
			reactToMessage(reactBtn, emoji);
		};
		reactionsDiv.appendChild(reactBtn);
	});
	messageDiv.appendChild(contentDiv);
	messageDiv.appendChild(footerDiv);
	messageDiv.appendChild(reactionsDiv);
	if (typingIndicator.classList.contains('show')) {
		chatMessages.insertBefore(messageDiv, typingIndicator);
	} else {
		chatMessages.appendChild(messageDiv);
	}
	chatMessages.scrollTop = chatMessages.scrollHeight;
}
let lastMessageIds = [];
async function loadHistory() {
	const res = await fetch(`/api/chat-history?user1=${encodeURIComponent(me)}&user2=${encodeURIComponent(other)}`);
	if (res.ok) {
		const history = await res.json();
		// Mark all messages from other as read
		if (history.some(m => m.from === other && !m.seen)) {
			socket.emit('mark-as-read', { from: other, to: me });
		}
		// Only update if new messages
		const ids = history.map(m => m._id).join(',');
		if (ids !== lastMessageIds.join(',')) {
			lastMessageIds = history.map(m => m._id);
			// Save typing indicator if present
			const typingElem = typingIndicator.parentElement === chatMessages ? typingIndicator : null;
			chatMessages.innerHTML = '<div class="date-separator"><span class="date-badge">Today</span></div>';
			history.forEach(msg => {
				appendMessage(
					msg.from, 
					msg.message, 
					msg.timestamp, 
					msg.status || (msg.seen ? 'read' : 'sent'),
					msg.fileUrl,
					msg.fileType,
					msg._id,
					msg.reactions && msg.reactions.length ? msg.reactions : []
				);
			});
			// Always preserve typing indicator if it was showing
			if (typingIndicator.classList.contains('show')) {
				chatMessages.appendChild(typingIndicator);
			}
		}
	}
}
loadHistory();
setInterval(loadHistory, 500);
socket.on('private message', (data) => {
	if ((data.from === me && data.to === other) || (data.from === other && data.to === me)) {
		appendMessage(
			data.from, 
			data.message, 
			new Date(), 
			data.status,
			data.fileUrl,
			data.fileType,
			data.messageId
		);
		if (data.from === other) {
			playNotificationSound();
		}
	}
});
socket.on('message-reaction', (data) => {
	const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
	if (messageDiv) {
		let reactionDisplay = messageDiv.querySelector('.message-reaction-display');
		if (!reactionDisplay) {
			reactionDisplay = document.createElement('div');
			reactionDisplay.className = 'message-reaction-display';
			messageDiv.querySelector('.message-content').appendChild(reactionDisplay);
		}
		// WhatsApp-style: show all unique emojis with counts
		const counts = {};
		(data.reactions || []).forEach(r => {
			if (!counts[r.emoji]) counts[r.emoji] = 0;
			counts[r.emoji]++;
		});
		reactionDisplay.innerHTML = Object.entries(counts).map(([emoji, count]) =>
			`<span class="reaction-emoji">${emoji}${count > 1 ? ' ' + count : ''}</span>`
		).join(' ');
	}
});
sendButton.disabled = true;
viewerClose.addEventListener('click', () => {
	imageViewer.classList.remove('show');
});
imageViewer.addEventListener('click', (e) => {
	if (e.target === imageViewer) {
		imageViewer.classList.remove('show');
	}
});
function playNotificationSound() {
	const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBiqF0fPTgjMGHm7A7+OZRQ0RVKzn7q9cGAY+ltrzxnMoBSl+zPDblkMKE1Ou5+2nUxQKRp/g8r5sIQYqhdHz04IzBh5uwO/jmUUNEVSs5+6vXBgGPpba88ZzKAUpfszPDblkMKE1Ou5+2nUxQKRp/g8r5sIQYqhdHz04IzBh5uwO/jmUUNEVSs5+6vXBgGPpba88ZzKAUpfsz');
	audio.volume = 0.3;
	audio.play().catch(e => console.log('Sound play failed:', e));
}
console.log('✅ Chat loaded successfully!');
