# eslint-plugin-php-templates

An ESLint processor that strips PHP tags from PHP templates files to enable linting of embedded HTML code

---

This plugin is a fork of [`eslint-plugin-php-markup`](https://github.com/tengattack/eslint-plugin-php-markup), which doesn't support ESLint 9. All plugin settings have been removed. While `eslint-plugin-php-markup` was created to allow linting of JavaScript within PHP templates, my use case has been to support the use of `eslint-plugin-tailwindcss` via `@angular-eslint/template-parser`.

## Installation

```bash
npm install eslint-plugin-php-templates --save-dev
```

## Usage

This is how I use this plugin:

```javascript
import phpTemplates from 'eslint-plugin-php-templates';
import tailwindcss from 'eslint-plugin-tailwindcss';
import angularTemplateParser from '@angular-eslint/template-parser';

export default [
    {
        files: ['**/*.php'],
        languageOptions: {
            parser: phpTemplates.suppressParserErrors(angularTemplateParser),
        },
        plugins: {
            'php-templates': phpTemplates,
            tailwindcss,
        },
        processor: 'php-templates/strip-php',
        rules: {
            'tailwindcss/classnames-order': 'warn',
            'tailwindcss/no-custom-classname': 'off',
        },
        settings: {
			tailwindcss: {
				config: '/full/path/to/tailwind.css',
			},
		},
    },
];
```
