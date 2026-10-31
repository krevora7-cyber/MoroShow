/**
 * Browser-native provider registry (NO Bridge required).
 * Implement individual adapters from independently reviewed, legitimately
 * accessible source APIs, then import them and register here.
 *
 * At this time CNC Verse, StreamPlay, Yacintv and Cricify have NOT been ported
 * from their Android CloudStream/Kotlin code. Keeping this list empty is
 * intentional: a missing adapter must NEVER be shown as a working source.
 */
import type { ProviderAdapter } from '../chromeProviderEngine.ts';
export const browserProviders:ProviderAdapter[]=[];
