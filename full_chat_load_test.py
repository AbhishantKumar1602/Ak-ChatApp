import requests
import socketio
import threading
import time

BASE_URL = 'https://ak-chatting.onrender.com'
REGISTER_URL = f'{BASE_URL}/api/register'
LOGIN_URL = f'{BASE_URL}/api/login'
SOCKET_URL = BASE_URL.replace('https', 'wss')  # Socket.io expects ws/wss

USER_COUNT = 100
PASSWORD = 'test123'

users = []  # List of dicts: {username, email, session, sio}

# 1. Register users
def register_users():
    for i in range(USER_COUNT):
        username = f'user_{i+1}'
        email = f'user_{i+1}@test.com'
        data = {'username': username, 'email': email, 'password': PASSWORD}
        try:
            resp = requests.post(REGISTER_URL, json=data)
            if resp.status_code == 201 or 'already exists' in resp.text:
                print(f'Registered: {username}')
                users.append({'username': username, 'email': email})
            else:
                print(f'Failed to register {username}: {resp.text}')
        except Exception as e:
            print(f'Error registering {username}: {e}')

# 2. Login users and save session cookies
def login_users():
    for user in users:
        session = requests.Session()
        data = {'identifier': user['username'], 'password': PASSWORD}
        try:
            resp = session.post(LOGIN_URL, json=data)
            if resp.status_code == 200:
                print(f'Logged in: {user["username"]}')
                user['session'] = session
            else:
                print(f'Failed to login {user["username"]}: {resp.text}')
        except Exception as e:
            print(f'Error logging in {user["username"]}: {e}')

# 3. Connect each user to Socket.io
def connect_socketio(user):
    session = user['session']
    cookies = session.cookies.get_dict()
    headers = {'Cookie': '; '.join([f'{k}={v}' for k, v in cookies.items()])}
    sio = socketio.Client()
    user['sio'] = sio
    try:
        sio.connect(BASE_URL, headers=headers, transports=['websocket'])
        sio.emit('register user', user['username'])
        print(f'Socket connected: {user["username"]}')
    except Exception as e:
        print(f'Socket connect failed for {user["username"]}: {e}')

# 4. Each user sends a message to every other user
def send_all_to_all():
    def send_messages(sender):
        sio = sender['sio']
        for receiver in users:
            if receiver['username'] != sender['username']:
                msg = f'Hello from {sender["username"]} to {receiver["username"]}'
                sio.emit('private message', {'from': sender['username'], 'to': receiver['username'], 'message': msg})
                print(f'{sender["username"]} -> {receiver["username"]}')
                time.sleep(0.01)  # Throttle to avoid flooding
    threads = []
    for user in users:
        t = threading.Thread(target=send_messages, args=(user,))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

if __name__ == '__main__':
    print('Registering users...')
    register_users()
    print('Logging in users...')
    login_users()
    print('Connecting sockets...')
    for user in users:
        connect_socketio(user)
    print('Sending all-to-all messages...')
    send_all_to_all()
    print('Done!')
    # Optionally, disconnect all sockets
    for user in users:
        if 'sio' in user:
            user['sio'].disconnect()
