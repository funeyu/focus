import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, User } from '../../models/entities';
import { IdUtil } from '../../common/id.util';

@Injectable()
export class FriendshipService {
  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepo: Repository<Friendship>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createForFlight(flightId: string, userIds: string[]): Promise<void> {
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        await this.createIfNotExists(userIds[i], userIds[j], flightId);
      }
    }
  }

  private async createIfNotExists(userA: string, userB: string, flightId: string): Promise<void> {
    const existing = await this.friendshipRepo.findOne({
      where: [
        { userIdA: userA, userIdB: userB },
        { userIdA: userB, userIdB: userA },
      ],
    });
    if (existing) return;

    const now = Math.floor(Date.now() / 1000);
    await this.friendshipRepo.save({
      id: IdUtil.next('friendship'),
      userIdA: userA,
      userIdB: userB,
      flightId,
      createdAt: now,
    });
  }

  async getFriends(userId: string): Promise<FriendDto[]> {
    const friendships = await this.getRawFriendships(userId);

    const friendIds = friendships.map(f =>
      f.userIdA === userId ? f.userIdB : f.userIdA,
    );

    if (friendIds.length === 0) return [];

    const users = await this.userRepo.findByIds(friendIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    return friendIds
      .map(id => {
        const user = userMap.get(id);
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          status: 'offline',
        };
      })
      .filter(Boolean);
  }

  async getRawFriendships(userId: string): Promise<Friendship[]> {
    return this.friendshipRepo.find({
      where: [{ userIdA: userId }, { userIdB: userId }],
    });
  }
}

interface FriendDto {
  id: string;
  name: string;
  avatar: string;
  status: string;
}