from locust import HttpUser, TaskSet, task, between
import random, string
from bs4 import BeautifulSoup

def random_username():
    return "user_" + ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

class ChatTasks(TaskSet):
    def on_start(self):
        # Step 1: Register
        self.username = random_username()
        self.password = "test123"
        self.client.post("/api/register", data={
            "username": self.username,
            "email": f"{self.username}@test.com",
            "password": self.password
        })

        # Step 2: Login
        res = self.client.post("/api/login", data={
            "identifier": self.username,
            "password": self.password
        }, allow_redirects=True)

        # Save cookies/session for auth
        self.cookies = res.cookies

    @task
    def chat_random_user(self):
        # Step 3: Get list of users
        res = self.client.get("/users", cookies=self.cookies)
        soup = BeautifulSoup(res.text, "html.parser")
        users_links = soup.select("a[href^='/chat?user=']")  # select chat links
        if not users_links:
            return
        random_user_link = random.choice(users_links)['href']

        # Step 4: Open chat page
        self.client.get(random_user_link, cookies=self.cookies)

        # Step 5: Send message via POST
        target_username = random_user_link.split("=")[1]
        message = f"Hello {target_username}, from {self.username}!"
        self.client.post(f"/chat?user={target_username}", data={
            "message": message
        }, cookies=self.cookies)

class WebsiteUser(HttpUser):
    tasks = [ChatTasks]
    wait_time = between(1, 3)
