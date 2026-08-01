export class ConfigurationError extends Error {}

export class MissingConfigurationError extends ConfigurationError {}

export class InvalidConfigurationError extends ConfigurationError {}

export class ConfigurationPersistenceError extends ConfigurationError {}
