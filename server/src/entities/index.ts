import { Comment } from './comment.entity';
import { CrawlRun } from './crawl-run.entity';
import { Post } from './post.entity';
import { PostLike } from './post-like.entity';
import { PostSearch } from './post-search.entity';
import { PostTag } from './post-tag.entity';
import { ScoreEvent } from './score-event.entity';
import { Source } from './source.entity';
import { Tag } from './tag.entity';
import { TagSynonym } from './tag-synonym.entity';
import { User } from './user.entity';
import { UserPasskey } from './user-passkey.entity';
import { WebauthnChallenge } from './webauthn-challenge.entity';

export const ENTITIES = [Source, CrawlRun, Tag, TagSynonym, Post, PostTag, PostSearch, User, PostLike, Comment, UserPasskey, WebauthnChallenge, ScoreEvent];

export { Comment, CrawlRun, Post, PostLike, PostSearch, PostTag, ScoreEvent, Source, Tag, TagSynonym, User, UserPasskey, WebauthnChallenge };
