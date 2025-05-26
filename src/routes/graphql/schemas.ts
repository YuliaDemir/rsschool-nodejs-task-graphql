import { Type } from '@fastify/type-provider-typebox';
import { 
  GraphQLObjectType,
  GraphQLSchema, 
  GraphQLString, 
  GraphQLInt, 
  GraphQLBoolean, 
  GraphQLList, 
  GraphQLNonNull, 
  GraphQLFloat, 
  GraphQLEnumType,
  GraphQLInputObjectType,
 } from 'graphql';
import { UUIDType } from './types/uuid.js';
import { create } from 'domain';
import { subscribe } from 'diagnostics_channel';

export const gqlResponseSchema = Type.Partial(
  Type.Object({
    data: Type.Any(),
    errors: Type.Any(),
  }),
);

export const createGqlResponseSchema = {
  body: Type.Object(
    {
      query: Type.String(),
      variables: Type.Optional(Type.Record(Type.String(), Type.Any())),
    },
    {
      additionalProperties: false,
    },
  ),
};

export function createSchema(prisma: any) {
  const MemberType = new GraphQLObjectType({
    name: 'MemberType',
    fields:  () => ({
      id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
      discount: { type: new GraphQLNonNull(GraphQLFloat) },
      postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
      profiles: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Profile)))}
    }),
  });
  
  const User = new GraphQLObjectType({
    name: 'User',
    fields:() => ({
      id: { type: new GraphQLNonNull(UUIDType) },
      name: { type: new GraphQLNonNull(GraphQLString) },
      balance: { type: new GraphQLNonNull(GraphQLFloat) },

      profile: { 
        type: Profile,
        resolve: (parent, args, context) => {
          return context.prisma.profile
            .findUnique({ where: { userId: parent.id} });  
        },
      },
      
      posts: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Post))),
        resolve: (parent, args, context) => {
          return context.prisma.post
            .findMany({ where: { authorId: parent.id } });
        },
      },

      userSubscribedTo: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))),
        resolve: async (parent, args, context) => {
          const userIsSubLinks = await context.prisma.subscribersOnAuthors
            .findMany({ where: { subscriberId: parent.id } });

          const authors = await context.prisma.user
            .findMany({ where: { id: { in: userIsSubLinks.map((link) => link.authorId) } }});

          return authors;
        },
      },

      subscribedToUser: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))),
        resolve: async (parent, args, context) => {
          const userIsAuthorLinks = await context.prisma.subscribersOnAuthors
            .findMany({ where: { authorId: parent.id } });

          const subscribers = await context.prisma.user
            .findMany({ where: { id: { in: userIsAuthorLinks.map((link) => link.subscriberId) } }});

          return subscribers;
        },
      },
    }),
  });

  const SubscribersOnAuthors = new GraphQLObjectType({
    name: 'SubscribersOnAuthors',
    fields: {
      subscriber: {
        type: User,
        resolve: (parent, args, context) => {
          return context.prisma.user
            .findUnique({ where: { id: parent.subscriberId} });
        },
      },

      author: {
        type: User,
        resolve: (parent, args, context) => {
          return context.prisma.user
            .findUnique({ where: { id: parent.authorId} });
        },
      },
    },
  });

  const Post = new GraphQLObjectType({
    name: 'Post',
    fields: {
      id: { type: new GraphQLNonNull(UUIDType) },
      title: { type: new GraphQLNonNull(GraphQLString) },
      content: { type: new GraphQLNonNull(GraphQLString) },

      author: {
        type: User,
        resolve: (parent, args, context) => {
          return context.prisma.user
            .findUnique({ where: { id: parent.authorId} });
        },
      }
    },
  });

  const Profile = new GraphQLObjectType({
    name: 'Profile',
    fields: () => ({
      id: { type: new GraphQLNonNull(UUIDType) },
      isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
      yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
      userId: { type: new GraphQLNonNull(GraphQLString) },
      memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },

      user: {
        type: User,
        resolve: (parent, args, context) => {
          return context.prisma.user
            .findUnique({ where: { id: parent.userId} });
        },
      },

      memberType: {
        type: MemberType,
        resolve: (parent, args, context) => {
          return context.prisma.memberType
            .findUnique({ where: { id: parent.memberTypeId} });
        },
      },
    }),
  });

  const MemberTypeIdEnum = new GraphQLEnumType({
    name: 'MemberTypeId',
    values: {
      BASIC: { value: 'BASIC' },
      BUSINESS: { value: 'BUSINESS'},
    },
  });

  const Query = new GraphQLObjectType({
    name: 'Query',
    fields: {
      memberTypes: { 
        type: new GraphQLList(MemberType) ,
        resolve: (_, __, context) => context.prisma.memberType.findMany(),
      },
      memberType: { 
        type: MemberType,
        args: {
          id: { type: new GraphQLNonNull(MemberTypeIdEnum) },
        },
        resolve: (_, { id }, context) => context.prisma.memberType.findUnique({ where: { id } }),
      },
      posts: { 
        type: new GraphQLList(Post) ,
        resolve: (_, __, context) => context.prisma.post.findMany(),
      },
      post: { 
        type: Post,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: (_, { id }, context) => context.prisma.post.findUnique({ where: { id } }),
      },
      users: { 
        type: new GraphQLList(User) ,
        resolve: (_, __, context) => context.prisma.user.findMany(),
      },
      user: { 
        type: User,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: (_, { id }, context) => context.prisma.user.findUnique({ where: { id } }),
      },
      profiles: { 
        type: new GraphQLList(Profile) ,
        resolve: (_, __, context) => context.prisma.profile.findMany(),
      },
      profile: { 
        type: Profile,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: (_, { id }, context) => context.prisma.profile.findUnique({ where: { id } }),
      },
    },
  });

  const CreateUserInput = new GraphQLInputObjectType({
    name: 'CreateUserInput',
    fields: {
      name: { type: new GraphQLNonNull(GraphQLString) },
      balance: { type: new GraphQLNonNull(GraphQLFloat) }
    }
  });

  const CreatePostInput = new GraphQLInputObjectType({
    name: 'CreatePostInput',
    fields: {
      title: { type: new GraphQLNonNull(GraphQLString) },
      content: { type: new GraphQLNonNull(GraphQLString) },
      authorId: { type: new GraphQLNonNull(UUIDType) },
    }
  });

  const CreateProfileInput = new GraphQLInputObjectType({
    name: 'CreateProfileInput',
    fields: {
      isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
      yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
      userId: { type: new GraphQLNonNull(UUIDType) },
      memberTypeId: { type: new GraphQLNonNull(MemberTypeIdEnum) },
    }
  });

  const ChangePostInput = new GraphQLInputObjectType({
    name: 'ChangePostInput',
    fields: {
      title: { type: GraphQLString },
      content: { type: GraphQLString },
    }
  });

  const ChangeProfileInput = new GraphQLInputObjectType({
    name: 'ChangeProfileInput',
    fields: {
      isMale: { type: GraphQLBoolean },
      yearOfBirth: { type: GraphQLInt },
      memberTypeId: { type: MemberTypeIdEnum },
    }
  });

  const ChangeUserInput = new GraphQLInputObjectType({
    name: 'ChangeUserInput',
    fields: {
      name: { type: GraphQLString },
      balance: { type: GraphQLFloat },
    }
  });

  const Mutation = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      createUser: {
        type: new GraphQLNonNull(User),
        args: {
          dto: { type: new GraphQLNonNull(CreateUserInput) },
        },
        resolve: (_, { dto }, context) => 
          context.prisma.user.create({ data: dto }),
      },

      createProfile: {
        type: new GraphQLNonNull(Profile),
        args: {
          dto: { type: new GraphQLNonNull(CreateProfileInput) },
        },
        resolve: (_, { dto }, context) => 
          context.prisma.profile.create({ data: dto }),
      },

      createPost: {
        type: new GraphQLNonNull(Post),
        args: {
          dto: { type: new GraphQLNonNull(CreatePostInput) },
        },
        resolve: (_, { dto }, context) => 
          context.prisma.post.create({ data: dto }),
      },

      changePost: {
        type: new GraphQLNonNull(Post),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangePostInput) },
        },
        resolve: (_, { id, dto }, context) => 
          context.prisma.post.update({ where: { id }, data: dto }),
      },

      changeProfile: {
        type: new GraphQLNonNull(Profile),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangeProfileInput) },
        },
        resolve: (_, { id, dto }, context) => 
          context.prisma.profile.update({ where: { id }, data: dto }),
      },

      changeUser: {
        type: new GraphQLNonNull(User),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangeUserInput) },
        },
        resolve: (_, { id, dto }, context) => 
          context.prisma.user.update({ where: { id }, data: dto }),
      },

      deleteUser: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (__dirname, { id }, context) => {
          await context.prisma.user.delete({ where: { id }});
          return 'User deleted';
        },
      },

      deletePost: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, { id }, context) => {
          await context.prisma.post.delete({ where: { id }});
          return 'Post deleted';
        },
      },

      deleteProfile: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, { id }, context) => {
          await context.prisma.profile.delete({ where: { id }});
          return 'Profile deleted';
        },
      },

      subscribeTo: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          userId: { type: new GraphQLNonNull(UUIDType) },
          authorId: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, { userId, authorId }, context) => {
          await context.prisma.subscribersOnAuthors.create({ 
            data: { subscriberId: userId, authorId },
          });
          return 'User subscribed';
        },
      },

      unsubscribeFrom: {
        type: new GraphQLNonNull(GraphQLString),
        args: {
          userId: { type: new GraphQLNonNull(UUIDType) },
          authorId: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, { userId, authorId }, context) => {
          await context.prisma.subscribersOnAuthors.delete({ 
            where: { 
              subscriberId_authorId: {
                subscriberId: userId,
                authorId: authorId,
              }
            },
          });
          return 'User unsubscribed';
        },
      },

    },
  });

  return new GraphQLSchema({ query: Query, mutation: Mutation });
};

