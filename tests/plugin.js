'use strict'

require('should')

const path = require('path')
const { ESLint } = require('eslint')
const plugin = require('../lib')

async function execute(file, baseConfig) {
  if (!baseConfig) baseConfig = {}

  const config = [
    {
      files: ['**/*.php'],
      plugins: {
        'php-templates': plugin,
        ...(baseConfig.plugins || {}),
      },
      processor: 'php-templates/strip-php',
      rules: {
        'no-console': 'error',
        ...(baseConfig.rules || {}),
      },
      languageOptions: {
        globals: baseConfig.globals || {},
        parserOptions: baseConfig.parserOptions || {},
      },
    },
  ]

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: config,
    fix: baseConfig.fix || false,
  })

  const results = await eslint.lintFiles([path.join(__dirname, 'fixtures', file)])
  return baseConfig.fix ? results[0] : results[0] && results[0].messages
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

it('should work', async () => {
  const messages = await execute('simple.js.php')
  assertLineColumn(messages, [
    [4, 3],
    [6, 3],
  ])
})

it('should work with html', async () => {
  const html = require('eslint-plugin-html')
  const messages = await execute('html.php', {
    plugins: { html },
  })
  assertLineColumn(messages, [
    [7, 7],
    [11, 7],
  ])
})
