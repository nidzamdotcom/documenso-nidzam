# documenso-nidzam

The source of the modified [Documenso](https://github.com/documenso/documenso) that runs at
[sign.nidzam.com](https://sign.nidzam.com). It is the official `documenso/documenso` image with the
Documenso name and logos replaced by NIDZAM.COM. Nothing else is changed.

Documenso is licensed under the GNU AGPL v3. This repository publishes our modifications so that
users of sign.nidzam.com can get the source of the version they interact with.

## What it changes

`patch-nidzam.mjs` runs during `docker build` and rewrites the already-built app files:

- **Logos:** the two shared logo components (wordmark and icon) become NIDZAM.COM SVGs. The
  header logo PNGs, the signing-celebration background and a sample profile picture on the
  sign-up page are swapped too.
- **Name:** user-facing "Documenso" text (UI, emails, page titles, signature disclosure, passkey
  name) becomes "NIDZAM.COM". Code identifiers, `X-Documenso-*` headers, package names and CSS
  class names are left alone. The "Check out Documenso" line after signing is removed.
- **Static files:** favicons, app icons, web manifest, link-preview image, and the logo used on
  the signing certificate and audit log (`assets/branding/`).
- **Cache-safe names:** changed browser assets are renamed (`x.js` → `x.nz.js`), and references to
  them are updated, because `/assets/*` is served as immutable.

The script counts every change and fails the build if a count differs from what it expects for
v2.20.0, or if any plain "Documenso" is left. Every patched JS file is syntax-checked.

## Build

```bash
./build.sh            # documenso-nidzam:v2.20.0 from documenso/documenso:v2.20.0
./build.sh v2.21.0    # for a newer Documenso; fails if the patch needs adjusting
```

Then use `documenso-nidzam:<version>` in place of `documenso/documenso:<version>` in your compose
file. Runtime configuration is unchanged (see Documenso's self-hosting docs). Set
`NEXT_PRIVATE_SIGNING_REASON` to change the "Signed by …" reason in sealed PDFs.

## Licence

The code in this repository (`Dockerfile`, `build.sh`, `patch-nidzam.mjs`) is licensed under the
GNU AGPL v3, the same licence as Documenso. See [LICENSE](LICENSE).

The NIDZAM.COM name and logo files in `assets/` are NIDZAM.COM brand assets. They are published
so the build is reproducible; they are not licensed for use as your own branding. To rebrand
Documenso for yourself, replace the files in `assets/` and the `NAME` constant in
`patch-nidzam.mjs`.

"Documenso" is a trademark of Documenso, Inc. This project is not affiliated with or endorsed by
Documenso, Inc.
