# Real-time Chat Application

This is a full-stack real-time chat application built with Node.js, Express, MongoDB, and Socket.IO. It features private messaging, user online status, typing indicators, read receipts, file sharing, and message reactions.

## Features

- **User Authentication**: Secure user registration and login with session management.
- **Real-time Messaging**: Instant message delivery using WebSockets (Socket.IO).
- **User Presence**: See which users are online or offline.
- **Typing Indicators**: Know when the other user is typing a message.
- **Read Receipts**: See when your messages have been sent and read (✓ and ✓✓).
- **File Sharing**: Upload and share images, videos, and documents (up to 10MB).
- **Message Reactions**: React to messages with emojis.
- **Chat History**: All conversations are saved to a MongoDB database.
- **Search**: Search through chat history.
- **Dark/Light Theme**: Toggle between dark and light modes.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Real-time Engine**: Socket.IO
- **Database**: MongoDB with Mongoose
- **Authentication**: `express-session`
- **File Uploads**: Multer
- **Frontend**: EJS (Embedded JavaScript templates), Vanilla JavaScript, CSS

## Project Flowchart

This flowchart illustrates the main user and data flows in the application.

```mermaid
graph TD
    subgraph User Authentication
        A[User visits site] --> B{Session exists?};
        B -- No --> C[Redirect to /login];
        B -- Yes --> G[Show User List /users];
        C --> D[User submits login form];
        D --> E[POST /api/login];
        E --> F{Credentials Valid?};
        F -- Yes --> G;
        F -- No --> C;
    end

    subgraph Chat Interaction
        G --> H[User clicks on another user to chat];
        H --> I[Load Chat Page /chat?user=...];
        I --> J[Client-side JS (chat.js) runs];
        J --> K[Fetch chat history from /api/chat-history];
        K --> L[Render messages in chat window];
        J --> M[Socket.emit('register user')];
    end

    subgraph Real-time Message Exchange
        N[User types message and clicks Send] --> O[Client emits 'private message'];
        O --> P[Server receives 'private message'];
        P --> Q[Save message to MongoDB];
        Q --> R{Recipient Online?};
        R -- Yes --> S[Server emits 'private message' to Recipient];
        R -- No --> T[Message stored for later viewing];
        S --> U[Recipient's client receives message];
        U --> V[Append message to chat window];
        P --> W[Server emits message back to Sender];
        W --> X[Sender's client updates message status (e.g., 'sent' checkmark)];
    end

    subgraph Other Real-time Events
        Y[User is typing] --> Z[Client emits 'typing' event];
        Z --> AA[Server relays 'typing' to recipient];
        AA --> AB[Recipient sees '... is typing' indicator];

        AC[User opens chat] --> AD[Client emits 'mark-as-read'];
        AD --> AE[Server updates 'seen' status in DB];
        AE --> AF[Server emits 'messages-read' to sender];
        AF --> AG[Sender sees double-blue checkmarks];
    end
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (A local instance or a cloud service like MongoDB Atlas)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    - Open `app.js` and update the `MONGODB_URI` constant with your MongoDB connection string.

4.  **Run the application:**
    ```bash
    node app.js
    ```

The server will start on `http://localhost:3000`.

## API Endpoints

- `POST /api/register`: Register a new user.
- `POST /api/login`: Log in a user and create a session.
- `GET /api/userlist`: Get the list of all users with their last message and unread count.
- `GET /api/chat-history`: Get the chat history between two users.
- `POST /api/upload-file`: Upload a file attachment.
- `GET /health`: Health check endpoint.