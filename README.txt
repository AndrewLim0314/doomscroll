Name: Andrew Lim
Email: andrew.k.lim@vanderbilt.edu

Project: Doomscroll (Change++ Fall 2025 Coding Challenge)

How to run: Outlined below, but summarized: Install dependencies, run app.py, go into terminal,
            cd to frontend-react, then type "npm run dev", then click on the link.
Backend (Flask)

    cd backend (or the folder with app.py)
    python -m venv .venv
    source .venv/bin/activate (Windows: .venv\Scripts\activate)
    pip install -r requirements.txt
    python app.py (runs on http://127.0.0.1:5000)
    Frontend (React + Vite)

    cd frontend-react
    npm install
    npm run dev (opens http://localhost:5173)

Features:
    Create posts (text + optional media: YouTube, image, video)
    View posts (newest first)
    Like/unlike posts
    View and add comments
    Clean, responsive styling
    Persistent data via data.json (backend); liked state saved in localStorage

API Endpoints:
    GET /posts
    POST /posts
    POST /posts/:id/like
    DELETE /posts/:id/like
    GET /posts/:id/comments
    POST /posts/:id/comments



Reflection: I learned a lot of new things. I had never done frontend developing before, so learning how to code
in CSS and Javascript was definitely a new thing for me. Issues that came up definitely came from the frontend,
as developing the backend in my opinion was not as difficult.