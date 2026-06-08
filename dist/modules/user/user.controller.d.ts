import { UserService } from './user.service';
import { FriendshipService } from './friendship.service';
export declare class UserController {
    private readonly userService;
    private readonly friendshipService;
    constructor(userService: UserService, friendshipService: FriendshipService);
    create(body: {
        name: string;
        avatar?: string;
        region?: string;
        deviceToken?: string;
    }): Promise<{
        code: number;
        data: any;
    }>;
    getFriends(userId: string): Promise<{
        code: number;
        data: any;
    }>;
    getUser(userId: string): Promise<{
        code: number;
        data: any;
    }>;
    registerDeviceToken(body: {
        userId: string;
        token: string;
    }): Promise<{
        code: number;
        data: any;
    }>;
}
