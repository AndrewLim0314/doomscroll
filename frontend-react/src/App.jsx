import { useState, useEffect } from 'react'
import './app.css'


const SUBWAY_URL = 'https://www.youtube.com/embed/vTfD20dbxho?si=i6sYnmktMqgi0aVt'

/**
 * Convert a timestamp (ms since epoch) to a human-friendly relative time.
 * Examples: "42s ago", "5m ago", "3h ago", "2d ago"
 */
function timeAgo(ms) {
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
}

/**
 * Derive up to 2-letter initials from a name. Fallback to "A".
 * Examples: "Ada Lovelace" -> "AL", "Plato" -> "P"
 */
function initials(name = '') {
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'A'
}

/**
 * Root app component:
 * - Fetches posts from Flask backend
 * - Creates posts
 * - Toggles likes (with local persistence of liked IDs)
 * - Keeps comment count in sync when new comments are added
 */
function App() {
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)

    // A Set of post IDs liked by this client (persisted in localStorage)
    const [likedIds, setLikedIds] = useState(() => {
        try {
            return new Set(JSON.parse(localStorage.getItem('likedIds') || '[]'))
        } catch {
            return new Set()
        }
    })

    /**
     * Load posts on mount.
     * Handles both array payload or { posts: [...] } to be robust.
     */
    useEffect(() => {
        fetch('http://127.0.0.1:5000/posts')
            .then(async res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                const postsArray = Array.isArray(data) ? data : (data.posts || [])
                setPosts(postsArray)
            })
            .catch(err => {
                console.error('Error loading posts:', err)
                setPosts([])
            })
            .finally(() => setLoading(false))
    }, [])

    /**
     * Persist likedIds to localStorage whenever it changes.
     */
    useEffect(() => {
        try {
            localStorage.setItem('likedIds', JSON.stringify(Array.from(likedIds)))
        } catch {
            // ignore storage errors
        }
    }, [likedIds])

    /**
     * Create a new post (text + optional media).
     * On success, prepend the new post to the list.
     */
    const createPost = async (author, text, mediaUrl) => {
        try {
            const res = await fetch('http://127.0.0.1:5000/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author,
                    text,
                    media: {
                        type: mediaUrl ? 'video' : 'none',
                        url: mediaUrl || ''
                    }
                })
            })
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}))
                throw new Error(errBody.error || `HTTP ${res.status}`)
            }
            const newPost = await res.json()
            setPosts(prev => [newPost, ...prev])
        } catch (err) {
            console.error('Failed to create post:', err)
            alert(err.message)
        }
    }

    /**
     * Toggle like/unlike for a given post ID.
     * - POST to like if not liked
     * - DELETE to unlike if already liked
     * Updates both the posts array and the likedIds Set.
     */
    const toggleLike = async (postId) => {
        const alreadyLiked = likedIds.has(postId)
        try {
            const res = await fetch(`http://127.0.0.1:5000/posts/${postId}/like`, {
                method: alreadyLiked ? 'DELETE' : 'POST'
            })
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}))
                throw new Error(errBody.error || `HTTP ${res.status}`)
            }
            const updated = await res.json()
            setPosts(prev => prev.map(p => (p.id === postId ? updated : p)))
            setLikedIds(prev => {
                const next = new Set(prev)
                if (alreadyLiked) next.delete(postId)
                else next.add(postId)
                return next
            })
        } catch (err) {
            console.error('Failed to like/unlike post:', err)
            alert(err.message)
        }
    }

    /**
     * When a comment is added to a post, bump its commentCount in parent state
     * so the collapsed comment count remains accurate.
     */
    const onCommentAdded = (postId) => {
        setPosts(prev =>
            prev.map(p =>
                p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
            )
        )
    }

    // Loading state (simple). You can swap for your skeleton if desired.
    if (loading) {
        return (
            <div className="container">
                <div className="card">
                    <p>Loading...</p>
                </div>
            </div>
        )
    }

    // Main UI
    return (
    <>
        <div className="container">
            <h1>Doomscroll</h1>

            <div className="card">
                <h3>Create Post</h3>
                <PostForm onSubmit={createPost} />
            </div>

            <div>
                {posts.length === 0 ? (
                    <p className="text-subtle">No posts yet. Create one above!</p>
                ) : (
                    posts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onLike={toggleLike}
                            liked={likedIds.has(post.id)}
                            onCommentAdded={onCommentAdded}
                        />
                    ))
                )}
            </div>

            {/* Spacer so fixed video doesn't cover the last post */}
            <div className="video-spacer" />
        </div>

        {/* Fixed video bar (always visible, same width as a post) */}
        <div className="video-fixed">
            <div className="subway-media-fixed">
                <iframe
                    className="subway-frame"
                    src={SUBWAY_URL}
                    title="Subway Surfers Gameplay"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    frameBorder="0"
                />
            </div>
        </div>
    </>
    )
}

/**
 * Post creation form:
 * - Author (optional)
 * - Text (required)
 * - Optional media URL (image/video/YouTube)
 */
function PostForm({ onSubmit }) {
    const [author, setAuthor] = useState('')
    const [text, setText] = useState('')
    const [mediaUrl, setMediaUrl] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!text.trim()) return
        onSubmit(author.trim() || 'Anonymous', text.trim(), mediaUrl.trim())
        setAuthor('')
        setText('')
        setMediaUrl('')
    }

    return (
        <form className="post-form" onSubmit={handleSubmit}>
            <div className="row">
                <input
                    className="input"
                    placeholder="Your name"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                />
                <textarea
                    className="textarea"
                    placeholder="What's happening?"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                />
                <input
                    className="input"
                    placeholder="Video/Image URL (optional)"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                />
            </div>
            <button className="btn btn-primary" type="submit">Post</button>
        </form>
    )
}

/**
 * Renders a single post with:
 * - Author + avatar
 * - Text content + media
 * - Like/unlike button
 * - Comments (toggle to view) and add comment form
 */
function PostCard({ post, onLike, liked, onCommentAdded }) {
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState([])

    // Infer media type from URL if not provided
    function inferTypeFromUrl(url) {
        if (!url) return 'none'
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
        if (/\.(mp4|webm|mov)$/i.test(url)) return 'video'
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return 'image'
        return 'video'
    }

    // Extract YouTube video ID from URL
    function getYouTubeId(url) {
        const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
        return m ? m[1] : null
    }

    // Render appropriate media element
    const renderMedia = () => {
        const media = post.content?.media
        if (!media || !media.url) return null
        const url = media.url
        const type = media.type || inferTypeFromUrl(url)

        if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
            const id = getYouTubeId(url)
            return id ? (
                <iframe
                    width="100%"
                    height="315"
                    src={`https://www.youtube.com/embed/${id}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video"
                />
            ) : null
        }

        if (type === 'video' || /\.(mp4|webm|mov)$/i.test(url)) {
            return <video src={url} controls muted playsInline />
        }

        if (type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
            return <img src={url} alt="Post media" />
        }

        return <a href={url} target="_blank" rel="noopener noreferrer">View media</a>
    }

    /**
     * Toggle comments panel. When opening, fetch latest comments for the post.
     */
    const toggleComments = async () => {
        if (!showComments) {
            try {
                const res = await fetch(`http://127.0.0.1:5000/posts/${post.id}/comments`)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                setComments(data)
            } catch (err) {
                console.error('Failed to load comments:', err)
                alert('Failed to load comments')
            }
        }
        setShowComments(!showComments)
    }

    /**
     * Add a new comment to this post.
     * On success, update local list and notify parent to bump commentCount.
     */
    const addComment = async (author, content) => {
        try {
            const res = await fetch(`http://127.0.0.1:5000/posts/${post.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ author, content })
            })
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}))
                throw new Error(errBody.error || `HTTP ${res.status}`)
            }
            const newComment = await res.json()
            setComments(prev => [...prev, newComment])
            onCommentAdded?.(post.id)
        } catch (err) {
            console.error('Failed to add comment:', err)
            alert(err.message)
        }
    }

    // If expanded, show the live count; otherwise use the post's commentCount
    const visibleCommentCount = showComments ? comments.length : (post.commentCount || 0)

    return (
        <div className="card post">
            <div className="post-header">
                <div className="avatar">{initials(post.author)}</div>
                <div>
                    <div className="post-author">{post.author}</div>
                    <div className="post-meta">{timeAgo(post.createdAt)}</div>
                </div>
            </div>

            {post.content?.text && (
                <p className="post-content">{post.content.text}</p>
            )}

            {renderMedia() && (
                <div className="media">{renderMedia()}</div>
            )}

            <div className="actions">
                <button
                    className={`btn btn-like ${liked ? 'liked' : ''}`}
                    onClick={() => onLike(post.id)}
                    title={liked ? 'Unlike' : 'Like'}
                >
                    {liked ? '💔' : '❤️'} {post.likeCount || 0}
                </button>

                <button
                    className="btn btn-comment"
                    onClick={toggleComments}
                    title="Toggle comments"
                >
                    💬 {showComments ? 'Hide' : 'Show'} Comments ({visibleCommentCount})
                </button>
            </div>

            {showComments && (
                <div className="comments">
                    <h4>Comments</h4>
                    {comments.map(c => (
                        <div key={c.id} className="comment-item">
                            <strong>{c.author}</strong>: {c.content}
                        </div>
                    ))}
                    <CommentForm onSubmit={addComment} />
                </div>
            )}
        </div>
    )
}

/**
 * Simple comment form (name + content).
 */
function CommentForm({ onSubmit }) {
    const [author, setAuthor] = useState('')
    const [content, setContent] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!content.trim()) return
        onSubmit(author.trim() || 'Anonymous', content.trim())
        setAuthor('')
        setContent('')
    }

    return (
        <form className="post-form" onSubmit={handleSubmit}>
            <div className="row">
                <input
                    className="input"
                    placeholder="Name"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                />
                <input
                    className="input"
                    placeholder="Add comment..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
            </div>
            <button className="btn btn-primary" type="submit">Comment</button>
        </form>
    )
}

export default App