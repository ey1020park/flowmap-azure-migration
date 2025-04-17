// 📁 src/utils/values.ts
export function objectValues<T>(obj: { [key: string]: T }): T[] {
    return Object.keys(obj).map(key => obj[key]);
  }