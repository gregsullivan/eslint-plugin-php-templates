'use strict'

function remapMessages(ctx, messages, code) {
  var startPosition = ctx.filtered[0].start.position
  var start
  for (var i = 0; i < messages[0].length; i++) {
    var message = messages[0][i]
    if (!start) {
      var position = getPosition(message, code.lineStartIndices)
      if (position > startPosition) {
        start = true
      }
    }
    if (start) {
      var loc = getOriginalLocation(ctx, message)
      message.line = loc.line
      message.column = loc.column

      // Map fix range
      if (message.fix && message.fix.range) {
        message.fix.range = [
          getOriginalPosition(ctx, message.fix.range[0]),
          // The range end is exclusive, meaning it should replace all characters with indexes from
          // start to end - 1. We have to get the original index of the last targeted character.
          getOriginalPosition(ctx, message.fix.range[1] - 1) + 1,
        ]

        // Restore PHP in fix text
        if (message.fix.text != null) {
          for (var j = 0; j < ctx.filtered.length; j++) {
            var f = ctx.filtered[j]
            if (f.replacement) {  // skip empty-string replacements
              message.fix.text = message.fix.text.split(f.replacement).join(f.original)
            }
          }
        }
      }

      // Map end location
      if (message.endLine && message.endColumn) {
        loc = getOriginalLocation(
          ctx,
          {
            line: message.endLine,
            column: message.endColumn,
          },
          code.lineStartIndices
        )
        message.endLine = loc.line
        message.endColumn = loc.column
      }
    }
  }
}

function getLineStartIndices(text) {
  return text
    .split('\n')
    .map((s) => s.length)
    .reduce(
      (prev, current) => {
        prev.push(prev[prev.length - 1] + current + 1)
        return prev
      },
      [0]
    )
}

function getLocation(position, lineStartIndices) {
  var i
  for (i = 1; i < lineStartIndices.length; i++) {
    if (position >= lineStartIndices[i - 1] && position < lineStartIndices[i]) {
      break
    }
  }
  return {
    line: i,
    column: position - lineStartIndices[i - 1] + 1,
  }
}

function getPosition(loc, lineStartIndices) {
  return lineStartIndices[loc.line - 1] + loc.column - 1
}

function getOriginalPosition(ctx, position) {
  for (var i = 0; i < ctx.filtered.length; i++) {
    var f = ctx.filtered[i]
    if (position > f.start.position) {
      // remove the length of replaced text
      position = position + (f.end.position - f.start.position) - f.replacement.length
    }
  }
  return position
}

function getOriginalLocation(ctx, loc) {
  var position = getPosition(loc, ctx.code.lineStartIndices)
  for (var i = 0; i < ctx.filtered.length; i++) {
    var f = ctx.filtered[i]
    if (position > f.start.position) {
      // remove the length of replaced text
      position = position + (f.end.position - f.start.position) - f.replacement.length
    }
  }
  return getLocation(position, ctx.originalLineStartIndices)
}

function isInsideQuotedAttribute(filteredText) {
  // Scan backward to find the last HTML tag boundary
  for (var i = filteredText.length - 1; i >= 0; i--) {
    if (filteredText[i] === '>') return false  // we're in content between tags
    if (filteredText[i] === '<') {
      // We're inside a tag. Scan forward to determine quote state.
      var inQuote = false
      var quoteChar = null
      for (var j = i + 1; j < filteredText.length; j++) {
        var ch = filteredText[j]
        if (!inQuote && (ch === '"' || ch === "'")) {
          inQuote = true
          quoteChar = ch
        } else if (inQuote && ch === quoteChar) {
          inQuote = false
          quoteChar = null
        }
      }
      return inQuote
    }
  }
  return false
}

var _messages = []
var PHP_MARKUP_EOL = /<\?[\s\S]*?\?>(\r?\n)?/g
var ctxIndex = -1
var processor = {
  meta: {
    name: 'eslint-plugin-php-templates',
    version: require('../package.json').version,
  },
  preprocess: (text, filename) => {
    if (typeof text === 'string') {
      var m,
        found = false,
        ms = []
      var filteredText = ''
      var originalLineStartIndices
      // Default: keepEOL = false, so use PHP_MARKUP_EOL
      var regex = PHP_MARKUP_EOL
      // reset match position
      regex.lastIndex = 0
      do {
        var lastIndex = regex.lastIndex
        m = regex.exec(text)
        if (m) {
          if (!found) {
            found = true
            originalLineStartIndices = getLineStartIndices(text)
          }
          var startLoc = getLocation(m.index, originalLineStartIndices)
          startLoc.position = m.index
          var endLoc = getLocation(regex.lastIndex, originalLineStartIndices)
          endLoc.position = regex.lastIndex

          // Append text up to this PHP match
          filteredText += text.substr(lastIndex, m.index - lastIndex)

          // Detect context: placeholder for attribute values, empty string otherwise
          var replacement = isInsideQuotedAttribute(filteredText)
            ? '__PHP' + ms.length + '__'
            : ''

          ms.push({
            start: startLoc,
            end: endLoc,
            replacement,
            original: m[0],
          })
          filteredText += replacement
        } else {
          filteredText += text.substr(lastIndex)
        }
      } while (m)
      ctxIndex++
      _messages.push({
        source: text,
        filtered: ms,
        code: { lineStartIndices: getLineStartIndices(filteredText) },
        originalLineStartIndices: originalLineStartIndices,
      })
      return [filteredText]
    } else {
      _messages[ctxIndex].code = text
      return [text]
    }
  },
  postprocess: (messages, filename) => {
    if (ctxIndex >= 0 && _messages[ctxIndex].filtered.length > 0) {
      var m = _messages[ctxIndex]
      remapMessages(m, messages, m.code)
    }
    return messages[0]
  },
  supportsAutofix: true,
}

// Helper function to suppress parser errors for parsers that may fail on invalid HTML
function suppressParserErrors(parser) {
  return {
    parseForESLint: (code, options) => {
      try {
        return parser.parseForESLint(code, options)
      } catch {
        // Return minimal valid AST when parsing fails
        return {
          ast: {
            type: 'Program',
            body: [],
            sourceType: 'module',
            loc: {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 0 },
            },
            range: [0, code.length],
            tokens: [],
            comments: [],
          },
          services: {},
          visitorKeys: {},
        }
      }
    }
  }
}

// Export for ESLint 9+ flat config
module.exports = {
  processors: {
    'strip-php': processor,
  },
  suppressParserErrors
}
