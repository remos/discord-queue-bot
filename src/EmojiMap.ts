import { EmojiIdentifierResolvable, Client } from "discord.js";

import { compareEmoji } from "./util";

import { ComparisonMap } from "./ComparisonMap";

interface EmojiWrapper {
  emoji: EmojiIdentifierResolvable;
}

export class EmojiMap<T extends EmojiWrapper> {
  client: Client;
  map: ComparisonMap<EmojiIdentifierResolvable, T>;

  constructor(client: Client, options?: T[]) {
    this.client = client;

    this.map = new ComparisonMap<EmojiIdentifierResolvable, T>(compareEmoji);

    if (options) {
      for (const option of options) {
        this.add(option);
      }
    }
  }

  add(option: T): void {
    this.map.add(this.client.emojis.resolveIdentifier(option.emoji), option);
  }

  remove(option: T): T {
    return this.map.remove(this.client.emojis.resolveIdentifier(option.emoji));
  }

  get(emoji: EmojiIdentifierResolvable): T {
    return this.map.get(this.client.emojis.resolveIdentifier(emoji));
  }

  has(emoji: EmojiIdentifierResolvable): boolean {
    return this.map.has(this.client.emojis.resolveIdentifier(emoji));
  }

  getValues(): T[] {
    return this.map.getValues();
  }
}
