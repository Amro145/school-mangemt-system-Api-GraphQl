import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono'
import * as schema from './db/schema';
const { posts, comments } = schema;

export type Env = {
  MY_VAR: string;
  PRIVATE: string;
  myAppD1: D1Database;
}
const app = new Hono<{ Bindings: Env }>()
// get All posts
app.get('/posts', async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const result = await db.query.posts.findMany({
    with: {
      comments: true
    }
  })
  return c.json(result)
})
// create post
app.post("/post", async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const { title, content } = await c.req.json()
  const result = await db.insert(posts).values({ title, content }).returning()
  return c.json(result)
})
// get post by id
app.get("/post/:id", async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const result = await db.query.posts.findFirst({
    where: eq(posts.id, Number(c.req.param("id"))),
    with: {
      comments: true
    }
  })
  return c.json(result)
})
// update post
app.put("/post/:id", async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const { title, content } = await c.req.json()
  const result = await db.update(posts).set({ title, content }).where(eq(posts.id, Number(c.req.param("id")))).returning()
  return c.json(result)
})
// delete post
app.delete("/post/:id", async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const result = await db.delete(posts).where(eq(posts.id, Number(c.req.param("id")))).returning()
  return c.json(result)
})
// get all comments
app.get("/comments", async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const result = await db.select().from(comments)
  return c.json(result)
})
// create comment
app.post("/comment", async (c) => {
  const db = drizzle(c.env.myAppD1, { schema })
  const { postId, content } = await c.req.json()
  const result = await db.insert(comments).values({ postId, content }).returning()
  return c.json(result)
})
export default app
