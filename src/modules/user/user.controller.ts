import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { FriendshipService } from './friendship.service';
import { ApiUtil } from '../../common/api.util';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly friendshipService: FriendshipService,
  ) {}

  @Post('create')
  async create(@Body() body: { name: string; avatar?: string; region?: string }) {
    const user = await this.userService.create(body);
    return ApiUtil.ok(user);
  }

  @Post('device-token')
  async registerDeviceToken(@Body() body: { userId: string; token: string }) {
    await this.userService.updateDeviceToken(body.userId, body.token);
    return ApiUtil.ok(null);
  }

  @Get('friends/:userId')
  async getFriends(@Param('userId') userId: string) {
    const friendships = await this.friendshipService.getFriends(userId);
    return ApiUtil.ok(friendships);
  }
}
