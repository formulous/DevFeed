export const PATHS = {
  tech: '/tech',
  techForYou: '/tech/for-you',
  techPopular: '/tech/popular',
  security: '/security',
  securityPopular: '/security/popular',
  community: '/community',
  communityPopular: '/community/popular',
  communityNew: '/community/new',
} as const;

export const HOME = PATHS.tech;

export const communityPostPath = (id: number) => `/community/posts/${id}`;
export const communityEditPath = (id: number) => `/community/posts/${id}/edit`;
