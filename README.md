<!--
SPDX-FileCopyrightText: 2024 KindSpells Labs S.L.

SPDX-License-Identifier: CC-BY-4.0
-->
# Astro-Shield

[![NPM Version](https://img.shields.io/npm/v/%40kindspells%2Fastro-shield)](https://www.npmjs.com/package/@kindspells/astro-shield)
![NPM Downloads](https://img.shields.io/npm/dw/%40kindspells%2Fastro-shield)
![GitHub commit activity](https://img.shields.io/github/commit-activity/w/kindspells/astro-shield)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/kindspells/astro-shield/tests.yml)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@kindspells/astro-shield)](https://socket.dev/npm/package/@kindspells/astro-shield)

## Introduction

This library will help you to compute the subresource integrity hashes for your
JS scripts and CSS stylesheets.

It works by installing an Astro hook that runs once the build step is done. This
hook performs 3 steps:
1. Computes the Subresource Integrity hashes for your scripts and styles.
2. Modifies the generated HTML to include the integrity hashes.
3. In case you specified a filepath for your SRI hashes module, it will generate
   (or update) a module that exports the associated SRI hashes, so you can use
   them later for other purposes, such as configuring your
   `Content-Security-Policy` headers.

## How to install

```bash
# With NPM
npm install --save-dev @kindspells/astro-shield

# With Yarn
yarn add --dev @kindspells/astro-shield

# With PNPM
pnpm add --save-dev @kindspells/astro-shield
```

## How to use

In your `astro.config.mjs` file:

```javascript
import { resolve } from 'node:path'

import { defineConfig } from 'astro/config'
import { shield } from '@kindspells/astro-shield'

const rootDir = new URL('.', import.meta.url).pathname

export default defineConfig({
  integrations: [
    shield({
      sri: {
        // Enables SRI hashes generation for statically generated pages
        enableStatic: true, // true by default

        // Enables a middleware that generates SRI hashes for dynamically
        // generated pages
        enableMiddleware: false, // false by default

        // This is the path where we'll generate the module containing the SRI
        // hashes for your scripts and styles. There's no need to pass this
        // parameter if you don't need this data, but it can be useful to
        // configure your CSP policies.
        hashesModule: resolve(rootDir, 'src', 'utils', 'sriHashes.mjs'),

        // For SSR content, Cross-Origin scripts must be explicitly allow-listed
        // by URL in order to be allowed by the Content Security Policy.
        //
        // Defaults to []
        scriptsAllowListUrls: [
          'https://code.jquery.com/jquery-3.7.1.slim.min.js',
        ],

        // For SSR content, Cross-Origin styles must be explicitly allow-listed
        // by URL in order to be allowed by the Content Security Policy.
        //
        // Defaults to []
        stylesAllowListUrls: [
          'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
        ],

        /**
         * Inline styles are usually considered unsafe because they could make it
         * easier for an attacker to inject CSS rules in dynamic pages. However, they
         * don't pose a serious security risk for _most_ static pages.
         *
         * You can disable this option in case you want to enforce a stricter policy.
         *
         * @type {'all' | 'static' | false}
         *
         * Defaults to 'all'.
         */
        allowInlineStyles: 'all',

        /**
         * Inline scripts are usually considered unsafe because they could make it
         * easier for an attacker to inject JS code in dynamic pages. However, they
         * don't pose a serious security risk for _most_ static pages.
         *
         * You can disable this option in case you want to enforce a stricter policy.
         *
         * @type {'all' | 'static' | false}
         *
         * Defaults to 'all'.
         */
        allowInlineScript: 'all',
      },

      // - If set, it controls how the security headers will be generated in the
      //   middleware.
      // - If not set, no security headers will be generated in the middleware.
      securityHeaders: {
        // For now, we can only control CSP headers, but we'll add more options
        // in the future.
        // - If set, it controls how the CSP (Content Security Policy) header will be
        //   generated in the middleware.
        // - If not set, no CSP header will be generated in the middleware.
        contentSecurityPolicy: {
          // - If set, it controls the "default" CSP directives (they can be overriden
          //   at runtime).
          // - If not set, the middleware will use a minimal set of default directives.
          cspDirectives: {
            'default-src': "'none'",
          }
        }
      }
    })
  ]
})
```

### Generating Content-Security-Policy Headers

You can enable automated CSP headers generation by setting the option
`securityHeaders.contentSecurityPolicy` (it can be an empty object if you don't
need to customise any specific behavior, but it must be defined).

Besides enabling CSP, you can also configure its directives to some extent, via
the `cspDirectives` option.

> [!IMPORTANT]
> It is advisable to set the option `sriHashesModule` in case your dynamic pages
> include static JS or CSS resources.
> 
> Also, do not explicitly disable the `enableStatic_SRI` option if you want
> support for those static assets).

### Accessing metadata generated at build time

Once you run `astro build`, `@kindspells/astro-shield` will analyse the static
output and generate a new module that exports the SRI hashes, so you can use
them in your CSP headers.

Here you can see an example of how the generated module looks:

```javascript
// Do not edit this file manually

export const inlineScriptHashes = /** @type {string[]} */ ([])

export const inlineStyleHashes = /** @type {string[]} */ ([
  'sha256-VC84dQdO3Mo7nZIRaNTJgrqPQ0foHI8gdp/DS+e9/lk=',
])

export const extScriptHashes = /** @type {string[]} */ ([
  'sha256-+aSouJX5t2z1jleTbCvA9DS7+ag/F4e4ZpB/adun4Sg=',
])

export const extStyleHashes = /** @type {string[]} */ ([
	'sha256-iwd3GNfA+kImEozakD3ZZQSZ8VVb3MFBOhJH6dEMnDE=',
])

export const perPageSriHashes =
  /** @type {Record<string, { scripts: string[]; styles: string [] }>} */ ({
    'index.html': {
      scripts: [
        'sha256-+aSouJX5t2z1jleTbCvA9DS7+ag/F4e4ZpB/adun4Sg=',
      ],
      styles: [
        'sha256-VC84dQdO3Mo7nZIRaNTJgrqPQ0foHI8gdp/DS+e9/lk='
      ],
    },
    'about.html': {
      scripts: [
        'sha256-+aSouJX5t2z1jleTbCvA9DS7+ag/F4e4ZpB/adun4Sg=',
      ],
      styles: [
        'sha256-iwd3GNfA+kImEozakD3ZZQSZ8VVb3MFBOhJH6dEMnDE=',
      ],
    },
  })
```

> [!IMPORTANT]
> If your website is very small or it relies on
> [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API),
> then it's best to rely on the `inlineScriptHashes`, `inlineStyleHashes`,
> `extScriptHashes` and `extStyleHashes` values.

> [!IMPORTANT]
> If you don't rely on View Transitions and you care about minimising the size
> of your CSP headers, then you can rely on the `perPageSriHashes` exported
> value.

## Known limitations

- ⚠️ In case your SSR (dynamic) pages refer to static `.js` or `.css` files, and
  any of these resources change, then you will need to run the `astro build`
  command **two consecutive times** (Astro-Shield will emit a warning message
  telling you about it).

- The SRI hashes will be regenerated only when running `astro build`. This means
  that if you need them to be up to date when you run `astro dev`, then you will
  have to manually run `astro build`.

- In the context of Content-Security-Policy: When a script is loaded with a
  _static_ import rather than directly included with a `<script>` tag, having
  its hash present in the `script-src` directive is not enough to ensure that
  the browser will accept it.
  
  This means that, for now, it is advisable to add `'self'` to the `script-src`
  directive (adding `'strict-dynamic'` does not help either).

## Some guarantees for peace of mind

Astro generates files in a very deterministic way, which means that for both JS
and CSS files:
  - Their pseudo-random names are stable across different builds
  - The files' contents do not change from build to build (unless, of course, we
    change them on purpose), so their hashes are stable as well (this is nice
    for hot reloading, which does not trigger the logic of this integration).

## Other Relevant Guidelines

- [Code of Conduct](https://github.com/KindSpells/astro-shield?tab=coc-ov-file)
- [Contributing Guidelines](https://github.com/KindSpells/astro-shield/blob/main/CONTRIBUTING.md)
- [Security Policy](https://github.com/KindSpells/astro-shield/security/policy)

## Main Contributors

This library has been created and is being maintained by
[KindSpells Labs](https://kindspells.dev/?utm_source=github&utm_medium=astro_sri_scp&utm_campaign=floss).

## License

This library is released under [MIT License](https://github.com/KindSpells/astro-shield?tab=MIT-1-ov-file).
