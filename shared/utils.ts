export function without<T, K extends keyof T>(omitKey: K, obj: T): Omit<T, K> {
  const newObj = {} as Omit<T, K>;
  for (const [key, value] of Object.entries(obj)) {
    if (key !== omitKey) {
      // @ts-ignore ^
      newObj[key] = value;
    }
  }
  return newObj;
}
