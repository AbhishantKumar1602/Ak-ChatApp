function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🔒';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

document.getElementById('loginForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button');
    const msgDiv = document.getElementById('msg');
    button.classList.add('loading');
    button.disabled = true;
    msgDiv.style.display = 'none';
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: form.identifier.value,
                password: form.password.value
            })
        });
        const data = await res.json();
        button.classList.remove('loading');
        button.disabled = false;
        msgDiv.textContent = data.message;
        msgDiv.className = res.ok ? 'success' : 'error';
        if (res.ok) {
            setTimeout(() => {
                window.location = '/users';
            }, 1000);
        }
    } catch (error) {
        button.classList.remove('loading');
        button.disabled = false;
        msgDiv.textContent = 'An error occurred. Please try again.';
        msgDiv.className = 'error';
    }
};
