export interface CountdownMessageSender {
  sendStringsToChannel(messages: string[], channelId: string): Promise<void>;
}

export interface BotActivityPort {
  setBotActivity(message: string): void;
}

export interface CountdownDependencies {
  discord: CountdownMessageSender;
}
