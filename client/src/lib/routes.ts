export const PATHS = {
  tech: '/tech',
  techForYou: '/tech/for-you',
  techPopular: '/tech/popular',
  techComments: '/tech/comments',
  security: '/security',
  securityPopular: '/security/popular',
  community: '/community',
  communityPopular: '/community/popular',
  communityComments: '/community/comments',
  communityLikes: '/community/likes',
  communityNew: '/community/new',
} as const;

export const HOME = PATHS.tech;

export const communityPostPath = (id: number) => `/community/posts/${id}`;
export const communityEditPath = (id: number) => `/community/posts/${id}/edit`;
