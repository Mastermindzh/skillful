/** Brand helper used to keep nominal types separate from raw strings. */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A path that has been validated as absolute (Posix or Windows). */
export type AbsolutePath = Brand<string, "AbsolutePath">;

/**
 * A path that has been validated as relative and free of traversal segments,
 * absolute prefixes, or NUL bytes.
 */
export type SafeRelativePath = Brand<string, "SafeRelativePath">;
