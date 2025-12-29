import depthLimit from 'graphql-depth-limit';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as dbSchema from './db/schema';
import { createSchema, createYoga } from 'graphql-yoga';
import { verify } from 'hono/jwt';
import { cors } from 'hono/cors';
import { createLoaders } from './loaders';
import { Env, GraphQLContext } from './types/context';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { rateLimit } from './middleware/rateLimit';

const app = new Hono<{ Bindings: Env }>();

// Middleware: Rate Limiting
app.use('*', rateLimit);

// Middleware: CORS
app.use('*', cors({
  origin: ['https://main.school-management-frontend-66i.pages.dev'],
  allowMethods: ['POST', 'OPTIONS'],
  credentials: true,
}));

const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: resolvers as any,
});

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: '/graphql',
  maskedErrors: true,
  plugins: [
    {
      onValidate({ addValidationRule }: any) {
        addValidationRule(depthLimit(5));
      }
    }
  ]
});

app.all('/graphql', async (c) => {
  const db = drizzle(c.env.myAppD1, { schema: dbSchema });
  const authHeader = c.req.header("Authorization");
  let currentUser = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const payload = await verify(token, c.env.JWT_SECRET);
      currentUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, Number(payload.id))).get();
    } catch (e) {
      console.error("JWT Verification Failed.");
    }
  }

  const loaders = createLoaders(db);
  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser, loaders });
});

export default app;