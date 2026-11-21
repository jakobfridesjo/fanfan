import type * as z from "zod/mini";

/**
 * The slice of `Storage` these helpers touch, injectable so tests can supply a
 * map instead of a DOM.
 */
export type ValueStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): ValueStorage | null {
  // Reading the property itself throws when storage is disabled (private
  // browsing, blocked site data), so this has to be a try/catch, not a check.
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface PersistedValue<T> {
  /** The stored value, or `fallback` when it is absent, unreadable or invalid. */
  load: (storage?: ValueStorage | null) => T;
  save: (value: T, storage?: ValueStorage | null) => void;
}

interface PersistedValueConfig<T> {
  key: string;
  /** Validates what came out of storage; a parse failure yields `fallback`. */
  schema: z.ZodMiniType<T>;
  fallback: T;
}

interface Codec<T> {
  /** Stored string to the shape `schema` validates; may throw. */
  decode: (stored: string) => unknown;
  encode: (value: T) => string;
}

function createPersistedValue<T>(
  { key, schema, fallback }: PersistedValueConfig<T>,
  codec: Codec<T>
): PersistedValue<T> {
  return {
    load: (storage = getBrowserStorage()) => {
      if (!storage) return fallback;

      try {
        const stored = storage.getItem(key);
        if (stored === null) return fallback;

        const parsed = schema.safeParse(codec.decode(stored));
        return parsed.success ? parsed.data : fallback;
      } catch {
        return fallback;
      }
    },

    save: (value, storage = getBrowserStorage()) => {
      if (!storage) return;

      try {
        storage.setItem(key, codec.encode(value));
      } catch {
        // A full or disabled quota loses the preference, never the interaction.
      }
    },
  };
}

/** A value persisted as JSON. */
export function persistedJson<T>(config: PersistedValueConfig<T>): PersistedValue<T> {
  return createPersistedValue(config, {
    decode: (stored): unknown => JSON.parse(stored),
    encode: (value) => JSON.stringify(value),
  });
}

/**
 * A value persisted as a bare string, for keys written before JSON encoding was
 * the convention — re-encoding them would read as a corrupt entry and silently
 * reset the user's preference. `schema` parses the raw string.
 */
export function persistedString<T>(config: PersistedValueConfig<T>): PersistedValue<T> {
  return createPersistedValue(config, {
    decode: (stored) => stored,
    encode: (value) => String(value),
  });
}
