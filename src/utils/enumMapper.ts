export function enumMapper<T extends Record<string, string | number>>(enumObject: T) {
  return Object.values(enumObject) as Array<T[keyof T]>;
}
