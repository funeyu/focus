let counter = 0;

export class IdUtil {
  private static prefixMap: Record<string, string> = {
    user: 'usr',
    flight: 'flt',
    passenger: 'psg',
    stats: 'sts',
    friendship: 'frd',
  };

  static next(type: string): string {
    const prefix = this.prefixMap[type] || type;
    const time = Date.now().toString(36);
    const seq = (counter++).toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `${prefix}_${time}${seq}${rand}`;
  }
}