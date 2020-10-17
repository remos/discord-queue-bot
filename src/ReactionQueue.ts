import {
  TextChannel,
  MessageEmbed,
  MessageEmbedOptions,
  DMChannel,
  EmojiIdentifierResolvable,
  User,
  Message,
  MessageResolvable,
  MessageReaction,
} from "discord.js";
import { ReactionHandler, ReactionOption } from "./ReactionHandler";

import { UserPrompt } from "./UserPrompt";
import { ComparisonMap } from "./ComparisonMap";
import { ComparisonQueue } from "./ComparisonQueue";
import { Comparator } from "./util";

import debounce = require("debounce-promise");
import { EventEmitter } from "tsee";

import { pascal } from "case";

export type QueueType = "available" | "active" | "pending" | "queue";
export type PassType = "timeout" | "skip";

export interface GetMessageFunction<T> {
  (context: T): string | MessageEmbed;
}

export interface AcceptGetMessageFunctionContext {
  user: User;
  userToString: ReactionQueueOptions["userToString"];
  counts: {
    skip: number;
    timeout: number;
  };
}

export interface AcceptOrSkipGetMessageFunctionContext {
  user: User;
  userToString: ReactionQueueOptions["userToString"];
  expires: Date;
  counts: {
    skip: number;
    timeout: number;
  };
}

export interface ReactionQueueOptions {
  /** Reference to an existing message to use rather than posting a new message - will default to posting a new message */
  existingMessage?: MessageResolvable;
  /** Require a user to mark themselves available to increase the maximum active user size */
  requireAvailable?: boolean;
  /** Maximum number of users - overridden by `requireAvailable` if set true */
  maxActive?: number;

  /** Time to allow a user to accept an active slot before returning them to queue */
  pendingTimeout?: number;
  /** Number of times to allow a user to timeout before removing them from the queue */
  maxPendingTimeouts?: number;
  /** Number of times to allow a user to skip accepting a slot before removing them from the queue */
  maxPendingSkips?: number;

  /** Emoji used for button to queue */
  queueEmoji?: EmojiIdentifierResolvable;
  /** Emoji used for button to add to the available pool */
  availableEmoji?: EmojiIdentifierResolvable;
  /** Emoji used for button to accept open position */
  acceptEmoji?: EmojiIdentifierResolvable;
  /** Emoji used for button to skip open position and return to queue */
  skipEmoji?: EmojiIdentifierResolvable;

  /** Message to display when a user can either accept or skip */
  promptAcceptOrSkipMessage?:
    | string
    | GetMessageFunction<AcceptOrSkipGetMessageFunctionContext>;
  /** Message to display when a user can only accept (i.e. no-one else in the queue behind them) */
  promptAcceptMessage?:
    | string
    | GetMessageFunction<AcceptGetMessageFunctionContext>;

  /** Any additional options to add to the message */
  additionalOptions?: ReactionOption[];

  messageDebounceTimeout?: number;

  /** Style/transform a user's name to display in the queue */
  userToString?: (user: User, queueType?: QueueType) => string;

  queue?: User[];
  active?: User[];
  pending?: User[];
  available?: User[];
}

const defaultUserToString: ReactionQueueOptions["userToString"] = (
  user: User,
  queueType?: QueueType
): string => {
  const str = user.toString();

  return queueType === "pending" ? `_${str}_` : str;
};

const defaultPromptAcceptOrSkip: GetMessageFunction<AcceptOrSkipGetMessageFunctionContext> = ({
  user,
  userToString,
  expires,
}): MessageEmbed => {
  const messageOptions: MessageEmbedOptions = {
    description: `${userToString(
      user
    )} - Accept newly active slot or return to the front of the queue?`,
    timestamp: expires,
    footer: { text: "Expires" },
  };

  return new MessageEmbed(messageOptions);
};

const defaultPromptAccept: GetMessageFunction<AcceptGetMessageFunctionContext> = ({
  user,
  userToString,
}): MessageEmbed => {
  const messageOptions: MessageEmbedOptions = {
    description: `${userToString(user)} - Accept newly active slot?`,
  };

  return new MessageEmbed(messageOptions);
};

type UserQueue = ComparisonQueue<User>;
const USER_COMPARATOR: Comparator<User> = (a: User, b: User): boolean =>
  a.id === b.id;

export class ReactionQueue extends EventEmitter<{
  userPass: (user: User, passType: PassType, returnedToQueue: boolean) => void;
  userQueue: (user: User, index: number) => void;
  userActive: (user: User, index: number) => void;
  userPending: (user: User, index: number) => void;
  userAvailable: (user: User, index: number) => void;
  userMove: (
    user: User,
    queueType: QueueType,
    index: number,
    lastQueueType?: QueueType
  ) => void;
  userAdd: (user: User) => void;
  userRemove: (user: User, queueName: QueueType) => void;
  messageCreated: (message: Message) => void;
  messageUpdated: (message: MessageEmbed) => void;
}> {
  private channel: TextChannel | DMChannel;
  title: string;
  message: Message;
  reactionHandler: ReactionHandler;

  requireAvailable: boolean;
  maxActive?: number;

  private available?: UserQueue;
  private active: UserQueue;
  private pending: UserQueue;
  private queue: UserQueue;

  additionalOptions: ReactionOption[];

  promptMap: ComparisonMap<
    User,
    {
      prompt: UserPrompt;
      skippable: boolean;
    }
  >;

  promptTimeoutCountMap: ComparisonMap<
    User,
    {
      timeout: number;
      skip: number;
    }
  >;

  promptAcceptOrSkipMessage:
    | string
    | GetMessageFunction<AcceptOrSkipGetMessageFunctionContext>;
  promptAcceptMessage:
    | string
    | GetMessageFunction<AcceptGetMessageFunctionContext>;

  pendingTimeout: number;
  maxPendingTimeouts: number;
  maxPendingSkips: number;

  queueEmoji: EmojiIdentifierResolvable;
  availableEmoji: EmojiIdentifierResolvable;
  acceptEmoji: EmojiIdentifierResolvable;
  skipEmoji: EmojiIdentifierResolvable;

  userToString: ReactionQueueOptions["userToString"];

  constructor(
    channel: TextChannel | DMChannel,
    title: string,
    {
      existingMessage,
      requireAvailable,
      maxActive,
      pendingTimeout = 600000,
      maxPendingTimeouts = 1,
      maxPendingSkips = 3,
      queueEmoji = "🎫",
      availableEmoji = "📋",
      acceptEmoji = "✔️",
      skipEmoji = "✖️",
      userToString = defaultUserToString,
      promptAcceptOrSkipMessage = defaultPromptAcceptOrSkip,
      promptAcceptMessage = defaultPromptAccept,
      additionalOptions = [],
      messageDebounceTimeout = 300,
      queue = [],
      active = [],
      pending = [],
      available = [],
    }: ReactionQueueOptions = {}
  ) {
    super();

    if (!requireAvailable && !maxActive) {
      throw "Queue must either be paired or have a set maxActive";
    }

    this.channel = channel;
    this.title = title;

    this.requireAvailable = !!requireAvailable;
    this.maxActive = maxActive;
    this.pendingTimeout = pendingTimeout;
    this.maxPendingTimeouts = maxPendingTimeouts;
    this.maxPendingSkips = maxPendingSkips;

    this.queueEmoji = queueEmoji;
    this.availableEmoji = availableEmoji;
    this.acceptEmoji = acceptEmoji;
    this.skipEmoji = skipEmoji;

    this.userToString = userToString;
    this.promptAcceptOrSkipMessage = promptAcceptOrSkipMessage;
    this.promptAcceptMessage = promptAcceptMessage;

    this.additionalOptions = additionalOptions;

    const updateMessage = this.updateMessage;
    this.updateMessage = debounce(this.updateMessage, messageDebounceTimeout);

    this.active = new ComparisonQueue(USER_COMPARATOR, active);
    this.pending = new ComparisonQueue(USER_COMPARATOR, pending);
    this.queue = new ComparisonQueue(USER_COMPARATOR, queue);
    this.available = new ComparisonQueue(USER_COMPARATOR, available);

    this.promptMap = new ComparisonMap(USER_COMPARATOR);
    this.promptTimeoutCountMap = new ComparisonMap(USER_COMPARATOR);

    this.on("userMove", (user, queueType, index) => {
      type MoveEventName =
        | "userQueue"
        | "userActive"
        | "userPending"
        | "userAvailable";
      this.emit(`user${pascal(queueType)}` as MoveEventName, user, index);
    });

    if (existingMessage) {
      (existingMessage instanceof Message
        ? Promise.resolve(existingMessage)
        : channel.messages.fetch(existingMessage)
      ).then((message) => {
        this.message = message;
        this.createReactionHandler();
        this.checkAndUpdatePrompts();
        updateMessage();
      });
    } else {
      this.channel.send(this.getMessage()).then((message) => {
        this.message = message;
        this.emit("messageCreated", message);
        this.createReactionHandler();
        this.checkAndUpdatePrompts();
      });
    }
  }

  updateMessage: () => Promise<void> = async () => {
    const message = this.getMessage();
    await this.message.edit(message);

    this.emit("messageUpdated", message);
  };

  private userAcceptPrompt = (
    _: MessageReaction,
    user: User
  ): boolean | void => {
    this.moveUserToActive(user);
  };

  private userPassPromptFactory = (passType: PassType, max: number) => (
    _: MessageReaction,
    user: User
  ): boolean | void => {
    const counts = this.promptTimeoutCountMap.get(user);
    if (!counts || ++counts[passType] < max) {
      this.moveUserToQueue(user, 1);
      this.emit("userPass", user, passType, true);
    } else {
      this.removeUser(user);
      this.emit("userPass", user, passType, false);
    }

    this.updateMessage();
  };

  private sendPendingPrompt(user: User): void {
    const options = [
      {
        emoji: this.acceptEmoji,
        collect: this.userAcceptPrompt,
      },
    ];

    if (this.queue.length > 0) {
      options.push({
        emoji: this.skipEmoji,
        collect: this.userPassPromptFactory("skip", this.maxPendingSkips),
      });
    }

    const prompt = this.promptMap.has(user)
      ? this.promptMap.get(user).prompt
      : new UserPrompt(user, this.channel);

    this.promptMap.add(user, {
      prompt: prompt,
      skippable: !!this.queue.length,
    });

    const context: AcceptGetMessageFunctionContext = {
      user: user,
      userToString: this.userToString,
      counts: this.promptTimeoutCountMap.get(user),
    };

    prompt.prompt(
      options,
      this.queue.length ? this.pendingTimeout : 0,
      {
        timeoutCallback: this.userPassPromptFactory(
          "timeout",
          this.maxPendingTimeouts
        ),
      },
      this.templateToMessage(
        user,
        this.queue.length
          ? this.promptAcceptOrSkipMessage
          : this.promptAcceptMessage,
        this.queue.length
          ? {
              ...context,
              expires: new Date(Date.now() + this.pendingTimeout),
            }
          : context
      )
    );
  }

  private templateToMessage<T>(
    user: User,
    template: string | GetMessageFunction<T>,
    context: T
  ): string | MessageEmbed {
    if (typeof template === "string") {
      return template;
    }

    return template(context);
  }

  private checkQueueAndPromote(): void {
    while (
      this.active.length + this.pending.length < this.getMaxActive() &&
      this.queue.length > 0
    ) {
      this.moveUserToPending(this.queue.get(0));
    }
  }

  private checkAndUpdatePrompts(): void {
    for (const entry of [...this.promptMap.getEntries()]) {
      if (entry.value.skippable !== !!this.queue.length) {
        this.sendPendingPrompt(entry.key);
      }
    }

    for (const user of this.pending.get()) {
      if (!this.promptMap.has(user)) {
        this.sendPendingPrompt(user);
      }
    }
  }

  private createReactionHandler(): ReactionHandler {
    const options: ReactionOption[] = [
      {
        emoji: this.queueEmoji,
        validate: (_, user): boolean => this.isUserQueued(user),
        collect: (_, user): boolean => this.addUser(user),
        remove: (_, user): void => this.removeUser(user),
      },
      ...this.additionalOptions,
    ];

    if (this.requireAvailable) {
      options.unshift({
        emoji: this.availableEmoji,
        condition: (): boolean => this.requireAvailable,
        validate: (_, user): boolean => this.available.has(user),
        collect: (_, user): boolean => this.addAvailableUser(user),
        remove: (_, user): void => this.removeAvailableUser(user),
      });
    }

    return (this.reactionHandler = new ReactionHandler(this.message, options, {
      defaultOption: { validate: (): boolean => false },
    }));
  }

  private getQueueByQueueType(queueType: QueueType): UserQueue {
    return this[queueType];
  }

  private getQueueFieldMessage(
    queueTypes: QueueType[] | QueueType,
    expectedLength = 1
  ): string[] {
    const out = [];

    if (!Array.isArray(queueTypes)) {
      queueTypes = [queueTypes];
    }

    for (const queueType of queueTypes) {
      const queue = this.getQueueByQueueType(queueType);
      if (!queue) {
        continue;
      }

      out.push(...queue.map((user) => this.userToString(user, queueType)));
    }

    // Display remaining slots - must be at least one or discord errors
    for (let i = out.length; i < Math.max(1, expectedLength); i++) {
      out.push("-");
    }

    return out;
  }

  private getMessage(): MessageEmbed {
    const fields = [];

    if (this.requireAvailable) {
      fields.push({
        name: `Open`,
        value: this.getQueueFieldMessage("available").join("\n"),
        inline: true,
      });
    }

    const active = this.getQueueFieldMessage(
      ["active", "pending"],
      this.getMaxActive()
    );

    fields.push({
      name: `Active ${this.active.length}${
        this.pending.length ? `+${this.pending.length}` : ""
      }/${this.getMaxActive()}`,
      value: active.join("\n"),
      inline: true,
    });
    fields.push({
      name: `Queued`,
      value: this.getQueueFieldMessage("queue").join("\n"),
      inline: true,
    });

    return new MessageEmbed({
      title: this.title,
      fields: fields,
      timestamp: new Date(),
      footer: { text: "Last updated" },
    });
  }

  async setMaxActive(maxActive: number): Promise<void> {
    this.maxActive = maxActive;
    await this.updateMessage();
  }

  getMaxActive(): number {
    return this.requireAvailable ? this.available.length : this.maxActive;
  }

  getActiveUsers(): UserQueue {
    return this.active;
  }

  getPendingUsers(): UserQueue {
    return this.pending;
  }

  getAvailableUsers(): UserQueue {
    return this.available;
  }

  getQueuedUsers(): UserQueue {
    return this.queue;
  }

  isUserQueued = (user: User): boolean =>
    this.active.has(user) || this.pending.has(user) || this.queue.has(user);

  private moveToQueueByQueueType(
    queueType: QueueType,
    user: User,
    targetIndex?: number
  ): void {
    const currentQueueTypes = this.getQueueTypesForUser(user, [
      "active",
      "pending",
      "queue",
    ]);

    if (queueType !== "pending") {
      this.promptMap.remove(user)?.prompt.cancel();
    }

    for (const removeQueueType of [
      "active",
      "pending",
      "queue",
    ] as QueueType[]) {
      if (removeQueueType !== queueType) {
        this.getQueueByQueueType(removeQueueType).remove(user);
      }
    }

    const queue = this.getQueueByQueueType(queueType);

    let index: number;
    if (targetIndex === undefined) {
      index = queue.has(user) ? queue.indexOf(user) : queue.push(user);
    } else {
      const currentIndex = queue.indexOf(user);
      if (currentIndex !== Math.max(0, targetIndex)) {
        if (currentIndex >= 0) {
          queue.remove(user);
        }
        index = queue.insert(user, targetIndex);
      } else {
        index = targetIndex;
      }
    }

    if (queueType === "pending") {
      this.sendPendingPrompt(user);
    }

    this.updateMessage();

    this.emit(
      "userMove",
      user,
      queueType,
      index,
      currentQueueTypes.length > 0 ? currentQueueTypes[0] : null
    );
  }

  moveUserToQueue = (user: User, targetIndex?: number): void => {
    this.moveToQueueByQueueType("queue", user, targetIndex);

    // Check if someone has just joined the queue behind people who are pending
    // And offer skipping to the pending people
    this.checkAndUpdatePrompts();

    this.checkQueueAndPromote();
  };
  moveUserToActive = (user: User, targetIndex?: number): void => {
    this.moveToQueueByQueueType("active", user, targetIndex);
  };
  moveUserToPending = (user: User, targetIndex?: number): void => {
    this.moveToQueueByQueueType("pending", user, targetIndex);
  };

  resetUserPromptCounts = (user: User): void => {
    this.promptTimeoutCountMap.add(user, {
      timeout: 0,
      skip: 0,
    });
  };

  getQueueTypesForUser = (
    user: User,
    checkTypes: QueueType[] = ["active", "pending", "queue", "available"],
    callback?: (queueType: QueueType) => void
  ): QueueType[] => {
    const queueTypes: QueueType[] = [];
    for (const queueType of checkTypes) {
      const queue = this.getQueueByQueueType(queueType);
      if (queue.has(user)) {
        queueTypes.push(queueType);
        if (callback) {
          callback(queueType);
        }
      }
    }

    return queueTypes;
  };

  addUser = (user: User): boolean => {
    if (
      this.active.has(user) ||
      this.pending.has(user) ||
      this.queue.has(user)
    ) {
      return true;
    }

    if (this.active.length + this.pending.length < this.getMaxActive()) {
      this.moveUserToActive(user);
    } else {
      this.resetUserPromptCounts(user);
      this.moveUserToQueue(user);
    }

    this.updateMessage();

    this.emit("userAdd", user);

    return true;
  };

  removeUser = (user: User): void => {
    const queueTypes = this.getQueueTypesForUser(
      user,
      ["active", "pending", "queue"],
      (queueType) => this.getQueueByQueueType(queueType).remove(user)
    );

    if (this.promptMap.has(user)) {
      this.promptMap.remove(user).prompt.cancel();
    }

    this.checkAndUpdatePrompts();
    this.checkQueueAndPromote();
    this.updateMessage();

    if (queueTypes.length > 0) {
      this.emit(
        "userRemove",
        user,
        queueTypes.length > 0 ? queueTypes[0] : null
      );
    }
  };

  addAvailableUser = (user: User): boolean => {
    const index = this.available.has(user)
      ? this.available.indexOf(user)
      : this.available.push(user);

    this.checkQueueAndPromote();
    this.updateMessage();

    this.emit("userMove", user, "available", index);

    return true;
  };

  removeAvailableUser = (user: User): void => {
    const removed = !!this.available.remove(user);
    this.updateMessage();

    if (removed) {
      this.emit("userRemove", user, "available");
    }
  };
}
