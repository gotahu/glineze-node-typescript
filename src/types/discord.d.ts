import { Collection } from 'discord.js';
import { Command } from '../interfaces/command';

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}
