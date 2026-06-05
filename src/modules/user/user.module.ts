import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Friendship } from '../../models/entities';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { FriendshipService } from './friendship.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Friendship])],
  controllers: [UserController],
  providers: [UserService, FriendshipService],
  exports: [UserService, FriendshipService],
})
export class UserModule {}