export class ApiUtil {
  static ok(data?: any) {
    return { code: 0, data: data ?? null };
  }

  static fail(code: number, message: string) {
    return { code, data: null, message };
  }
}