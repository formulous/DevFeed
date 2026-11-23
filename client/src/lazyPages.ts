import { preloadable } from '@/lib/preloadable';

export const communityPostPage = preloadable(() => import('@/features/community/CommunityPostPage').then((m) => m.CommunityPostPage));
