export declare class ApiUtil {
    static ok(data?: any): {
        code: number;
        data: any;
    };
    static fail(code: number, message: string): {
        code: number;
        data: any;
        message: string;
    };
}
