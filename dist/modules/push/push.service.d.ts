import { OnModuleInit } from '@nestjs/common';
export declare class PushService implements OnModuleInit {
    private provider;
    onModuleInit(): void;
    sendInviteNotification(deviceToken: string, captainName: string, from: string, to: string, flightId: string): Promise<void>;
}
