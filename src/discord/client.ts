import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from '../config/config';
import { handleInteractionCreate, handleReactionAdd } from './interaction';
import { handleMessageCreate } from './message';
import { logger } from '../utils/logger';

const options = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.ThreadMember,
    Partials.GuildMember,
  ],
};

export const discordClient = new Client(options);

discordClient.login(config.discord.botToken);

discordClient.on('ready', () => {
  if (discordClient.user) {
    logger.info(`Logged in as ${discordClient.user.tag}!`);
  } else {
    logger.error('An error has occurred on discord.js preparing');
  }
});

discordClient.on('messageReactionAdd', handleReactionAdd);
discordClient.on('messageCreate', handleMessageCreate);
discordClient.on('interactionCreate', handleInteractionCreate);
