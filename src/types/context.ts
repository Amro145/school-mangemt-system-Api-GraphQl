import { GraphQLError } from "graphql";
import { drizzle } from 'drizzle-orm/d1';
import * as dbSchema from '../db/schema';
import { Loaders } from '../loaders';

export type Env = {
    myAppD1: D1Database;
    JWT_SECRET: string;
};

export type GraphQLContext = {
    db: ReturnType<typeof drizzle<typeof dbSchema>>;
    env: Env;
    currentUser?: any;
    loaders: Loaders;
};

export const ensureAdmin = (currentUser: any) => {
    if (!currentUser || currentUser.role !== 'admin' || !currentUser.schoolId) {
        throw new GraphQLError("Unauthorized: Admin access required with a linked school.", { extensions: { code: "UNAUTHORIZED" } });
    }
};

export const ensureTeacherOrAdmin = (currentUser: any) => {
    if (!currentUser) {
        throw new GraphQLError("Unauthorized: Access required.", { extensions: { code: "UNAUTHORIZED" } });
    }

    const allowedRoles = ['admin', 'teacher'];
    if (!allowedRoles.includes(currentUser.role)) {
        throw new GraphQLError("Unauthorized: Sufficient permissions required.", { extensions: { code: "UNAUTHORIZED" } });
    }

    return true;
};
