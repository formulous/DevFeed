import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [PostsModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
