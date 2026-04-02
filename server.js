// server.js - Simple backend for Colin Archive
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const POSTS_DIR = path.join(__dirname, 'posts');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public/

// Homepage route – now serves index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Ensure posts directory exists
async function ensurePostsDir() {
  try {
    await fs.access(POSTS_DIR);
  } catch {
    await fs.mkdir(POSTS_DIR, { recursive: true });
  }
}

// Generate slug from title
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Save post as markdown file
app.post('/api/posts', async (req, res) => {
  try {
    const { title, excerpt, content, tags, access } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const slug = slugify(title);
    const filename = `${dateStr}-${slug}.md`;

    // Calculate read time
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const readTime = Math.max(1, Math.ceil(words / 200));

    // Create markdown with frontmatter
    const markdown = `---
title: ${title}
date: ${date.toISOString()}
excerpt: ${excerpt || content.substring(0, 200) + '...'}
tags: ${tags.join(', ')}
access: ${access}
readTime: ${readTime}
---

${content}`;

    const filepath = path.join(POSTS_DIR, filename);
    await fs.writeFile(filepath, markdown, 'utf8');

    res.json({
      success: true,
      filename,
      message: 'Post published'
    });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    const files = await fs.readdir(POSTS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const posts = await Promise.all(
      mdFiles.map(async (file) => {
        const filepath = path.join(POSTS_DIR, file);
        const content = await fs.readFile(filepath, 'utf8');

        // Parse frontmatter
        const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
        if (!match) return null;

        const [, frontmatter, body] = match;
        const meta = {};

        frontmatter.split('\n').forEach(line => {
          const [key, ...values] = line.split(': ');
          meta[key] = values.join(': ');
        });

        return {
          id: file.replace('.md', ''),
          title: meta.title,
          excerpt: meta.excerpt,
          content: body.trim(),
          tags: meta.tags ? meta.tags.split(', ') : [],
          access: meta.access,
          date: meta.date,
          readTime: meta.readTime,
          meta: new Date(meta.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        };
      })
    );

    // Filter out nulls and sort by date (newest first)
    const validPosts = posts.filter(p => p !== null);
    validPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(validPosts);
  } catch (error) {
    console.error('Error reading posts:', error);
    res.status(500).json({ error: 'Failed to read posts' });
  }
});

// Get single post by ID
app.get('/api/posts/:id', async (req, res) => {
  try {
    const filepath = path.join(POSTS_DIR, `${req.params.id}.md`);
    const content = await fs.readFile(filepath, 'utf8');

    const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
    if (!match) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [, frontmatter, body] = match;
    const meta = {};

    frontmatter.split('\n').forEach(line => {
      const [key, ...values] = line.split(': ');
      meta[key] = values.join(': ');
    });

    res.json({
      id: req.params.id,
      title: meta.title,
      excerpt: meta.excerpt,
      content: body.trim(),
      tags: meta.tags ? meta.tags.split(', ') : [],
      access: meta.access,
      date: meta.date,
      readTime: meta.readTime
    });
  } catch (error) {
    console.error('Error reading post:', error);
    res.status(404).json({ error: 'Post not found' });
  }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const filepath = path.join(POSTS_DIR, `${req.params.id}.md`);
    await fs.unlink(filepath);
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Start server
ensurePostsDir().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   Colin Archive Server Running        ║
║   http://localhost:${PORT}               ║
║                                       ║
║   Posts saved to: /posts/             ║
║   Homepage: /                         ║
║   Archive: /archive.html              ║
║   Admin panel: /write.html            ║
╚═══════════════════════════════════════╝
    `);
  });
});
