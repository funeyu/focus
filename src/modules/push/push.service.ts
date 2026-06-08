import { Injectable, OnModuleInit } from '@nestjs/common';
import { Provider, Notification } from '@parse/node-apn';

@Injectable()
export class PushService implements OnModuleInit {
  private provider: Provider | null = null;

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

    this.provider = new Provider({
      token: { key: keyPath, keyId, teamId },
      production: process.env.APN_PRODUCTION === 'true',
    });
  }

  async sendInviteNotification(
    deviceToken: string,
    captainName: string,
    from: string,
    to: string,
    flightId: string,
  ): Promise<void> {
    if (!this.provider) {
      console.warn('APNs not configured, skipping notification');
      return;
    }

    const notification = new Notification();
    notification.pushType = 'alert';
    notification.alert = {
      title: 'Flight Invite',
      body: `${captainName} invited you to a flight: ${from} → ${to}`,
    };
    notification.sound = 'default';
    notification.topic = process.env.APN_TOPIC!;
    notification.payload = { type: 'invite', flightId };

    try {
      const result = await this.provider.send(notification, deviceToken);
      if (result.failed.length > 0) {
        console.error('APNs delivery failed:', JSON.stringify(result.failed));
      } else {
        console.log('APNs sent successfully to', deviceToken);
      }
    } catch (err) {
      console.error('APNs send error:', err);
    }
  }
}
