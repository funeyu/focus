export declare class TokenUtil {
    static generate(timestamp: number): string;
    static validate(token: string, currentTimestamp: number): boolean;
}
