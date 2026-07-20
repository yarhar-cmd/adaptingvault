export const VERSION_INFO = {
  gameVersion: 'mvp-0.2',
  generatorVersion: 'generator-2',
  adaptationVersion: 'rules-1',
  telemetrySchemaVersion: 1,
} as const;

export type VersionInfo = typeof VERSION_INFO;
export type GameVersion = VersionInfo['gameVersion'];
export type GeneratorVersion = 'generator-1' | VersionInfo['generatorVersion'];
export type AdaptationVersion = VersionInfo['adaptationVersion'];
export type TelemetrySchemaVersion = VersionInfo['telemetrySchemaVersion'];
