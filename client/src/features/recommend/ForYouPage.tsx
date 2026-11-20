import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { FiZap } from 'react-icons/fi';
import { Link } from 'react-router';
import { ApiError } from '@/api/http';
import { fetchRecommendations } from '@/api/recommend';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/common/Toast';
import { PostCard } from '@/components/post/PostCard';
import { PostCardSkeleton } from '@/components/post/PostCardSkeleton';
import { interestTagsQuery } from '@/features/me/queries';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { POSTS_KEY, useOpenPost, useToggleBookmark } from '@/hooks/usePostActions';
import { reasonText } from './reasons';

const RECOMMEND_KEY = [...POSTS_KEY, 'recommendations'] as const;
const ONBOARDING_LINK = '/onboarding/tags?redirect=%2Ffor-you';

function InterestHeader() {
  const { me } = useAuth();
  const tags = useQuery(interestTagsQuery);
  const items = tags.data ?? [];
  const hasTags = me?.hasInterestTags || items.length > 0;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h1 className="w-full text-xl font-bold sm:mr-auto sm:w-auto">나를 위한 추천</h1>
      {hasTags ? (
        <>
          <span className="text-sm text-fg-secondary">관심 태그:</span>
          <ul className="flex flex-wrap gap-1" aria-label="관심 태그">
            {items.map((t) => (
              <li key={t.id} className="text-sm text-brand">
                #{t.name}
              </li>
            ))}
          </ul>
          <Link to="/me/settings" className="text-sm font-medium text-fg-secondary hover:text-brand">
            [편집]
          </Link>
        </>
      ) : (
        <Link to={ONBOARDING_LINK} className="text-sm font-medium text-brand">
          관심 태그 고르기
        </Link>
      )}
    </div>
  );
}

export function ForYouPage() {
  const client = useQueryClient();
  const toast = useToast();
  const list = useInfiniteQuery({
    queryKey: RECOMMEND_KEY,
    queryFn: ({ pageParam, signal }) => fetchRecommendations(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
  });
  const openPost = useOpenPost();
  const toggleBookmark = useToggleBookmark();
  const sentinel = useInfiniteScroll(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, list.hasNextPage && !list.isError);

  const expired = list.error instanceof ApiError && list.error.code === 'INVALID_CURSOR';
  useEffect(() => {
    if (!expired) return;
    client.resetQueries({ queryKey: RECOMMEND_KEY });
    toast('추천 목록이 오래돼서 새로 불러왔음');
  }, [expired, client, toast]);

  const entries = useMemo(
    () => list.data?.pages.flatMap((p) => p.items.map((post) => ({ post, recommendationId: p.recommendationId }))) ?? [],
    [list.data],
  );
  const fallback = list.data?.pages[0]?.fallback ?? false;

  return (
    <section className="mx-auto max-w-3xl" aria-label="추천 피드">
      <InterestHeader />

      {fallback && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-brand-line bg-brand-soft p-4 text-sm">
          <p className="mr-auto">
            아직 취향 정보가 없어서 인기 글을 보여주는 중임. 관심 태그를 고르면 더 정확해짐
          </p>
          <Link to={ONBOARDING_LINK} className="rounded-md bg-brand px-3 py-1.5 font-medium text-white">
            관심 태그 고르기
          </Link>
        </div>
      )}

      {list.isPending || expired ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : list.isError && entries.length === 0 ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="지금 추천할 새 글이 없음"
          description="최근 2주 글을 이미 다 읽었거나 관심 태그 글이 아직 없음"
          action={
            <Link to="/" className="text-sm font-medium text-brand">
              최신 피드 보기
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {entries.map(({ post, recommendationId }) => {
            const why = reasonText(post.reasons);
            return (
              <li key={post.id}>
                {why && (
                  <p className="mb-1.5 flex items-center gap-1 text-xs text-fg-secondary">
                    <FiZap size={12} className="text-amber-500" aria-hidden />
                    <span>추천 이유: {why}</span>
                  </p>
                )}
                <PostCard
                  post={post}
                  onOpen={(p) => openPost(p, recommendationId)}
                  onToggleBookmark={toggleBookmark}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div ref={sentinel} />
      {list.isFetchingNextPage && (
        <div className="mt-3">
          <PostCardSkeleton />
        </div>
      )}
    </section>
  );
}
