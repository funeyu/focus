import { Repository } from 'typeorm';
import { Friendship, User } from '../../models/entities';
export declare class FriendshipService {
    private readonly friendshipRepo;
    private readonly userRepo;
    constructor(friendshipRepo: Repository<Friendship>, userRepo: Repository<User>);
    createForFlight(flightId: string, userIds: string[]): Promise<void>;
    private createIfNotExists;
    getFriends(userId: string): Promise<FriendDto[]>;
    getRawFriendships(userId: string): Promise<Friendship[]>;
}
interface FriendDto {
    id: string;
    name: string;
    avatar: string;
    status: string;
}
export {};
