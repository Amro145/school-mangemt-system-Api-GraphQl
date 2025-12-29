import { queries } from './queries';
import { mutations } from './mutations';
import { typeResolvers } from './typeResolvers';

export const resolvers = {
    Query: queries,
    Mutation: mutations,
    ...typeResolvers,
};
