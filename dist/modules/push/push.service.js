"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const common_1 = require("@nestjs/common");
const node_apn_1 = require("@parse/node-apn");
let PushService = class PushService {
    constructor() {
        this.provider = null;
    }
    onModuleInit() {
        const keyPath = process.env.APN_KEY_PATH;
        const keyId = process.env.APN_KEY_ID;
        const teamId = process.env.APN_TEAM_ID;
        const topic = process.env.APN_TOPIC;
        console.log('APNs config:', { keyPath, keyId, teamId, topic });
        if (!keyPath || !keyId || !teamId || !topic) {
            console.warn('APNs not configured — push notifications disabled');
            return;
        }
        this.provider = new node_apn_1.Provider({
            token: { key: keyPath, keyId, teamId },
            production: process.env.APN_PRODUCTION === 'true',
        });
    }
    async sendInviteNotification(deviceToken, captainName, from, to, flightId) {
        if (!this.provider) {
            console.warn('APNs not configured, skipping notification');
            return;
        }
        const notification = new node_apn_1.Notification();
        notification.pushType = 'alert';
        notification.alert = {
            title: 'Flight Invite',
            body: `${captainName} invited you to a flight: ${from} → ${to}`,
        };
        notification.sound = 'default';
        notification.topic = process.env.APN_TOPIC;
        notification.payload = { type: 'invite', flightId };
        try {
            const result = await this.provider.send(notification, deviceToken);
            if (result.failed.length > 0) {
                console.error('APNs delivery failed:', JSON.stringify(result.failed));
            }
            else {
                console.log('APNs sent successfully to', deviceToken);
            }
        }
        catch (err) {
            console.error('APNs send error:', err);
        }
    }
};
exports.PushService = PushService;
exports.PushService = PushService = __decorate([
    (0, common_1.Injectable)()
], PushService);
//# sourceMappingURL=push.service.js.map