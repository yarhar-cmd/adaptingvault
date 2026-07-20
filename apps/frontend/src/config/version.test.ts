import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  VERSION_INFO,
  type AdaptationVersion,
  type GameVersion,
  type GeneratorVersion,
  type TelemetrySchemaVersion,
  type VersionInfo,
} from './version';

describe('Resonant Ruins version metadata', () => {
  it('provides the centralized MVP versions for future telemetry records', () => {
    expect(VERSION_INFO).toEqual({
      gameVersion: 'mvp-0.2',
      generatorVersion: 'generator-2',
      adaptationVersion: 'rules-1',
      telemetrySchemaVersion: 1,
    });
  });

  it('derives useful literal types from the version constant', () => {
    expectTypeOf(VERSION_INFO).toEqualTypeOf<VersionInfo>();
    expectTypeOf(VERSION_INFO.gameVersion).toEqualTypeOf<GameVersion>();
    expectTypeOf(VERSION_INFO.generatorVersion).toMatchTypeOf<GeneratorVersion>();
    expectTypeOf(VERSION_INFO.adaptationVersion).toEqualTypeOf<AdaptationVersion>();
    expectTypeOf(VERSION_INFO.telemetrySchemaVersion).toEqualTypeOf<TelemetrySchemaVersion>();
  });
});
