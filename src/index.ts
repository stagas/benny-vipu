#!/usr/bin/env node

import * as path from 'path'
import { vipu } from 'vipu'
import { suite, add, cycle, complete, configure } from 'benny'
import { asciiChartReporter } from 'benny-ascii-chart-reporter'
import { arg, decarg } from 'decarg'
import type { Client } from './public/client'

export interface Server {
  runSuite: (name: string, cases: string[]) => Promise<void>
  finish: () => Promise<void>
}

export class Options {
  @arg('<file>', 'Benchmark filename to run')
  filename!: string

  @arg('-c', '--clear', 'Clear screen between page reloads')
  clear = false

  @arg('-f', '--force', 'Force cache renewal')
  force = false

  @arg('-d', '--debug', 'Print debug information')
  debug = false

  @arg('--min', 'Minimum iteration samples (default: 3)')
  minSamples = 3

  @arg('--max', 'Maximum time in seconds (default: 1)')
  maxTime = 1
}

/**
 * Runs a given benchmark file.
 *
 * @param filename The benchmark filename
 * @param options
 * @param options.clear Clear screen between page reloads
 * @param options.force Force cache renewal
 * @param options.debug Print debug information
 * @param options.minSamples Minimum iteration samples (default: 3)
 * @param options.maxTime Maximum time in seconds (default: 1)
 */
export const run = async (
  filename: string,
  options: Options = new Options(),
) => {
  const { server, client, finish } = await vipu<Server, Client>(
    require.resolve('./public/client.ts'),
    {
      rpc: {
        server: { debug: options.debug, name: 'benny' },
        client: { debug: options.debug, name: 'bench' },
      },
      vite: {
        clearScreen: options.clear,
        server: { force: options.force },
        resolve: {
          alias: {
            'benny-vipu': require.resolve('./public/index.ts'),
            'benny-benchmark': filename,
          },
        },
      },
    },
  )

  server.finish = finish
  server.runSuite = async (name, cases) => {
    await suite(
      name,
      configure({
        cases: {
          minSamples: options.minSamples,
          maxTime: options.maxTime,
        },
      }),
      ...cases.map(c => add(c, () => () => client.runCase(name, c))),
      cycle(),
      complete(asciiChartReporter({ reverse: true, sort: false })),
      complete(),
    )
  }
}

// these exports are facade only for intellisense,
// when it compiles it uses a different file (public/index.ts)
export { suite, add }
export const finish = async () => {
  /* void */
}

// cli execution
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const options = decarg(new Options())!
  run(path.resolve(process.cwd(), options.filename), options)
}
