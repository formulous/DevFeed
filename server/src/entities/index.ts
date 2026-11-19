import { CrawlRun } from './crawl-run.entity';
import { Post } from './post.entity';
import { PostSearch } from './post-search.entity';
import { PostTag } from './post-tag.entity';
import { Source } from './source.entity';
import { Tag } from './tag.entity';
import { TagSynonym } from './tag-synonym.entity';
import { User } from './user.entity';

export const ENTITIES = [Source, CrawlRun, Tag, TagSynonym, Post, PostTag, PostSearch, User];

export { CrawlRun, Post, PostSearch, PostTag, Source, Tag, TagSynonym, User };
