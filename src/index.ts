import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono'
import * as dbSchema from './db/schema';
import bcrypt from 'bcryptjs';
import { createSchema, createYoga } from 'graphql-yoga';
import { sign, verify } from 'hono/jwt'; // التصحيح هنا

export type Env = {
  myAppD1: D1Database;
  JWT_SECRET: string;
}

// تعريف مخرجات عملية تسجيل الدخول
type AuthPayload = {
  user: any;
  token: string;
}

type GraphQLContext = {
  db: ReturnType<typeof drizzle<typeof dbSchema>>;
  env: Env;
  currentUser?: any;
};

const app = new Hono<{ Bindings: Env }>()

const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    userName: String!
    email: String!
    role: String!
    createdAt: String!
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type School {
    id: ID!
    name: String!
    adminId: User!
    classRooms: [ClassRoom]
  }

  type ClassRoom {
    id: ID!
    name: String!
    schoolId: Int!
  }

  type Query {
    users: [User]
    schools: [School]
    me: User
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createUser(userName: String!, email: String!, role: String!, password: String!): User
    createSchool(name: String!, adminId: Int): School
    createClassRoom(name: String!): ClassRoom
  }
`;

const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      users: async (_, __, { db }) => await db.select().from(dbSchema.user).all(),
      me: (_, __, { currentUser }) => currentUser,
      schools: async (_, __, { db }) => await db.select().from(dbSchema.school).all(),
    },
    Mutation: {
      login: async (_, { email, password }, { db, env }) => {
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, email)).get();
        if (!user) throw new Error("User not found");

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) throw new Error("Invalid password");

        const token = await sign({
          id: user.id,
          email: user.email,
          role: user.role,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
        }, env.JWT_SECRET);

        return { user, token };
      },
      createUser: async (_, args, { db }) => {
        const hashedPassword = await bcrypt.hash(args.password, 10);
        const existingUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, args.email)).get();
        if (existingUser) throw new Error("User already exists");
        const result = await db.insert(dbSchema.user).values({ ...args, password: hashedPassword }).returning();
        return result[0];
      },
      createSchool: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const existingSchool = await db.select().from(dbSchema.school).where(eq(dbSchema.school.adminId, Number(currentUser.id))).get();
        if (existingSchool) throw new Error("You already have a school");
        const result = await db.insert(dbSchema.school).values({ ...args, adminId: Number(currentUser.id) }).returning();
        return result[0];
      },
      createClassRoom: async (_, { name }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized to create a class");
        const school = await db.select().from(dbSchema.school).where(eq(dbSchema.school.adminId, Number(currentUser.id))).get();
        if (!school) throw new Error("You don't have a school to add classes to");


        const result = await db.insert(dbSchema.classRoom).values({ name, schoolId: school.id }).returning();
        return result[0];
      }
    },
    School: {
      adminId: async (parent, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, parent.adminId)).get(),
      classRooms: async (parent, _, { db }) => await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, parent.id)).all(),
    }
  },
})

const yoga = createYoga<GraphQLContext>({ schema, graphqlEndpoint: '/graphql' })

app.all('/graphql', async (c) => {
  const db = drizzle(c.env.myAppD1, { schema: dbSchema });
  const authHeader = c.req.header("Authorization");
  let currentUser = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = await verify(token, c.env.JWT_SECRET);
      currentUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, Number(payload.id))).get();
    } catch (e) {
      console.error("JWT Verification Error:", e);
    }
  }

  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser });
})

export default app