from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os, time, uuid
app = Flask(__name__)
# Enable CORS so the React dev server (localhost:5173) can call this API during development.
# For production, restrict origins.
CORS(app)

# Path to simple JSON "database" file for persistence across restarts.
DATA_PATH = os.path.join(os.path.dirname(__file__), "data.json")


def load_db():
    """
    Load the JSON database from disk.
    Returns a dict with:
      {
        "posts": [Post, ...],
        "comments": [Comment, ...]
      }
    If the file doesn't exist yet, return an empty structure.
    """
    if not os.path.exists(DATA_PATH):
        return {"posts": [], "comments": []}
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_db(db):
    """
    Persist the entire in-memory database (dict) to disk as JSON.
    """
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)


@app.get("/posts")
def get_posts():
    """
    List all posts (newest first).

    Response: 200 OK
      [
        {
          "id": str(UUID),
          "author": str,
          "content": { "text": str, "media": { "type": "video|image|youtube|none", "url": str } },
          "likeCount": int,
          "commentCount": int,
          "createdAt": int (ms since epoch)
        }, ...
      ]
    """
    db = load_db()
    # Sort by creation time descending (newest first)
    return jsonify(sorted(db["posts"], key=lambda p: p["createdAt"], reverse=True))


@app.post("/posts")
def create_post():
    """
    Create a new post.

    Request JSON (supports two formats, we normalize):
      {
        "author": str (optional; defaults to "Anonymous"),
        "text": str (optional if media.url provided),
        "media": { "type": str, "url": str } (optional)
      }

    Validation:
      - Must include non-empty 'text' or a non-empty 'media.url'
      - 'text' length <= 2000

    Response:
      201 Created + post object (see schema in get_posts)
      400 on validation error
    """
    data = request.get_json() or {}

    # Normalize author, default to "Anonymous"
    author = (data.get("author") or "").strip() or "Anonymous"

    # Support both new format (text) and legacy (content)
    text_content = data.get("text") or data.get("content") or ""
    text_content = text_content.strip()

    # Normalize media
    media = data.get("media") or {}
    media_url = media.get("url", "").strip()
    media_type = media.get("type", "none")

    # Validation: need some content (text or media)
    if not text_content and not media_url:
        return jsonify({"error": "Post must have text or media"}), 400

    if len(text_content) > 2000:
        return jsonify({"error": "Text too long"}), 400

    # Construct post object
    post = {
        "id": str(uuid.uuid4()),
        "author": author,
        "content": {
            "text": text_content,
            "media": {
                "type": media_type,
                "url": media_url
            }
        },
        "likeCount": 0,
        "commentCount": 0,
        "createdAt": int(time.time() * 1000)
    }

    # Persist
    db = load_db()
    db["posts"].append(post)
    save_db(db)
    return jsonify(post), 201


@app.post("/posts/<post_id>/like")
def like_post(post_id):
    """
    Increment like count on a post (client-side "like").
    No authentication; purely count-based.

    Response:
      200 OK + updated post
      404 if post not found
    """
    db = load_db()
    post = next((p for p in db["posts"] if p["id"] == post_id), None)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    post["likeCount"] = post.get("likeCount", 0) + 1
    save_db(db)
    return jsonify(post), 200


@app.delete("/posts/<post_id>/like")
def unlike_post(post_id):
    """
    Decrement like count on a post (client-side "unlike").
    Clamped to 0 (never negative).

    Response:
      200 OK + updated post
      404 if post not found
    """
    db = load_db()
    post = next((p for p in db["posts"] if p["id"] == post_id), None)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    post["likeCount"] = max(0, post.get("likeCount", 0) - 1)
    save_db(db)
    return jsonify(post), 200


@app.get("/posts/<post_id>/comments")
def get_comments(post_id):
    """
    List comments for a specific post (oldest-first).

    Response:
      200 OK
        [
          { "id": str(UUID), "postId": str, "author": str, "content": str, "createdAt": int(ms) }, ...
        ]
      404 if post not found
    """
    db = load_db()

    # Ensure the post exists before returning comments
    if not any(p["id"] == post_id for p in db["posts"]):
        return jsonify({"error": "Post not found"}), 404

    # Filter comments for the post, oldest-first
    comments = [c for c in db["comments"] if c["postId"] == post_id]
    comments.sort(key=lambda c: c["createdAt"])
    return jsonify(comments), 200


@app.post("/posts/<post_id>/comments")
def add_comment(post_id):
    """
    Add a new comment to a post.

    Request JSON:
      {
        "author": str (optional; defaults to "Anonymous"),
        "content": str (required, non-empty)
      }

    Response:
      201 Created + comment
      400 if content missing
      404 if post not found
    """
    data = request.get_json() or {}
    author = (data.get("author") or "").strip() or "Anonymous"
    content = (data.get("content") or "").strip()

    if not content:
        return jsonify({"error": "Comment content required"}), 400

    db = load_db()
    post = next((p for p in db["posts"] if p["id"] == post_id), None)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    # Construct comment object
    comment = {
        "id": str(uuid.uuid4()),
        "postId": post_id,
        "author": author,
        "content": content,
        "createdAt": int(time.time() * 1000)
    }

    # Persist comment and bump commentCount on the post
    db["comments"].append(comment)
    post["commentCount"] = post.get("commentCount", 0) + 1
    save_db(db)
    return jsonify(comment), 201


if __name__ == "__main__":
    # Run API on a separate port from the frontend (Vite default is 5173).
    app.run(port=5000, debug=True)