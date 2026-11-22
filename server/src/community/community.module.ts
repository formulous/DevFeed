import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { AdminCommunityController, ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PostsModule],
  controllers: [CommunityController, ReportsController, AdminCommunityController],
  providers: [CommunityService, ReportsService],
})
export class CommunityModule {}
