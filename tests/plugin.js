'use strict'

require('should')

const path = require('path')
const CLIEngine = require('eslint').CLIEngine
const plugin = require('../lib')

function execute(file, baseConfig) {
  if (!baseConfig) baseConfig = {}

  const cli = new CLIEngine({
    extensions: ['php'],
    baseConfig: {
      rules: Object.assign(
        {
          'no-console': 'error',
        },
        baseConfig.rules
      ),
      globals: baseConfig.globals,
      env: baseConfig.env,
      parserOptions: baseConfig.parserOptions,
    },
    plugins: baseConfig.plugins,
    ignore: false,
    useEslintrc: false,
    fix: baseConfig.fix,
  })
  cli.addPlugin('php-templates', plugin)
  const results = cli.executeOnFiles([path.join(__dirname, 'fixtures', file)]).results[0]
  return baseConfig.fix ? results : results && results.messages
}

function assertLineColumn(messages, linecols) {
  messages.length.should.be.exactly(linecols.length)
  for (var i = 0; i < messages.length; i++) {
    messages[i].line.should.be.exactly(linecols[i][0])
    messages[i].column.should.be.exactly(linecols[i][1])
    if (linecols[i][2]) {
      messages[i].ruleId.should.equal(linecols[i][2])
    }
  }
}

it('should work', () => {
  const messages = execute('simple.js.php')
  assertLineColumn(messages, [
    [4, 3],
    [6, 3],
  ])
})

it('should work with html', () => {
  const messages = execute('html.php', { plugins: ['html'] })
  assertLineColumn(messages, [
    [7, 7],
    [11, 7],
  ])
})
