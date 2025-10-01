// Initialize socket only once
if (!window.socket) {
    window.socket = io();
    console.log('🔌 Socket initialized');
    
    // Store username from URL or session
    const urlParams = new URLSearchParams(window.location.search);
    window.currentUser = urlParams.get('me') || localStorage.getItem('username');
    
    if (window.currentUser) {
        window.socket.emit('register user', window.currentUser);
        console.log('✅ Registered user:', window.currentUser);
    }
    
    // Debug: Log all incoming socket events
    window.socket.onAny((event, ...args) => {
        console.log('📨 Socket event received:', event, args);
    });
}
